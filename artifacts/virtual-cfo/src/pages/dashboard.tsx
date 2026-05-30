import { getCommerceMetrics } from "@/lib/analytics/commerceMetrics";
import { useLatestDataPeriod } from "@/lib/analytics/useLatestDataPeriod";
import { DataPeriodLabel } from "@/components/DataPeriodLabel";
import { getPhase2aMetrics, type Phase2aMetricsResponse } from "@/lib/analytics/phase2aMetrics";
import { usePhase2Deltas } from "@/lib/analytics/usePhase2Deltas";
import { formatDeltaPct, formatDeltaPp } from "@/lib/analytics/phase2DeltaMetrics";
import { type DeltaSentiment, DELTA_POLARITY, deltaToSentiment } from "@/lib/analytics/deltaSentiment";
import { useEffect, useState } from "react";
import {
  ArrowUpRight, ArrowDownRight, Minus,
  Sparkles, TrendingUp, AlertTriangle, ArrowRight,
  ChevronRight, Info,
} from "lucide-react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { type Driver } from "@/components/TopDrivers";
import { canAccess } from "@/lib/plan";
import { DataBenchmarkAssumptions } from "@/components/DataBenchmarkAssumptions";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { TimingBadge } from "@/components/TimingBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MONTHLY_CM_PCT, MONTHLY_REVENUE, MONTHLY_OPERATING_PROFIT, RECOVERABLE_LOW, RECOVERABLE_HIGH } from "@/lib/data/business-snapshot";
import { supabase } from "@/lib/supabase";
import { CASH_RUNWAY } from "@/lib/data/cash-snapshot";
import { DISCOUNT_DEP, REPEAT_RATE } from "@/lib/data/growth-metrics";
// Treat 0 as "no data" (e.g. current month has no orders yet)
// so we fall back to snapshot/computed metrics instead of showing £0
// ─── Data constants ───────────────────────────────────────────────────────────
// Live KPI overrides from Supabase-backed commerce metrics.
// Any KPI not listed here continues to use the mock snapshot value.

// ── Phase 1 metrics config ────────────────────────────────────────────────────
// DEV-ONLY — hardcoded seed store UUID.  Must be replaced with the
// authenticated session's store_id before any real merchant can use this page.
// Primary source: auth session → stores.id lookup.
// Not safe for production multi-tenant deployment.
const PHASE1_STORE_ID = "10000000-0000-0000-0000-000000000001";

// Date range is now resolved dynamically by useLatestDataPeriod() inside the
// component — it walks back from the current month until it finds a period
// with order data (up to 3 months). activeDateFrom / activeDateTo are used
// by both the Phase 1 and Phase 2a fetches so both cover the same period.

type KpiStatus = "warning" | "positive" | "danger" | "neutral";

// DeltaSentiment, DELTA_POLARITY, and deltaToSentiment imported from
// @/lib/analytics/deltaSentiment — shared with Margin Analysis and Growth Quality.

// DEV-ONLY FALLBACK — RECOVERABLE_TILE_VALUE and RECOVERABLE_TILE_CHANGE are computed
// from the RECOVERABLE_LOW / RECOVERABLE_HIGH snapshot constants (business-snapshot.ts).
// They are used as the KPI_CARDS "rc" card's static initial value only.  The liveKpiCards
// wiring block overrides both with values from the recoverable_contribution_range() Supabase
// RPC once phase1Metrics resolves.  These constants remain as the explicit fallback if
// the RPC fails.  Do not remove the fallback — it prevents a blank tile on RPC error.
const RECOVERABLE_TILE_VALUE =
  RECOVERABLE_LOW > 0 || RECOVERABLE_HIGH > 0
    ? `£${(RECOVERABLE_LOW  / 1_000).toFixed(0)}k–£${(RECOVERABLE_HIGH / 1_000).toFixed(0)}k`
    : "Opportunity being calculated";

const RECOVERABLE_TILE_CHANGE =
  RECOVERABLE_LOW > 0 || RECOVERABLE_HIGH > 0
    ? "Immediate margin recovery available"
    : "Analysis in progress";

/**
 * Formats an operating profit figure as a currency string.
 * Negative values use the Unicode minus sign (−, U+2212) rather than a hyphen
 * so the display reads as "−£10,184" rather than "-£10,184".
 * Zero renders as "£0".  Rounded to the nearest whole pound.
 */
function formatOpProfit(v: number): string {
  const abs = Math.abs(Math.round(v));
  if (v < 0)  return `\u2212£${abs.toLocaleString("en-GB")}`;
  if (v === 0) return "£0";
  return `£${abs.toLocaleString("en-GB")}`;
}

// DELTA_POLARITY and deltaToSentiment imported from @/lib/analytics/deltaSentiment above.

/** Status derived from sign of an operating profit value. */
function opProfitStatus(v: number): KpiStatus {
  if (v < 0) return "danger";
  if (v > 0) return "positive";
  return "neutral";
}

function getSafeKpiDisplay(kpi: { value: string; change: string }) {
  const value = kpi.value.trim();
  const looksBroken = value === "" || value.includes("NaN") || value.includes("Infinity");
  const looksLikeLoadingZero = (value === "£0" || value === "0%") && kpi.change.trim() === "";

  if (looksBroken || looksLikeLoadingZero) {
    return { value: "Awaiting live data", unavailable: true };
  }

  return { value, unavailable: false };
}

// Tile IDs (id field below) are the internal short codes for each KPI card.
// Each tile id maps to exactly one canonical metric name defined in src/lib/metrics.ts.
// See TILE_METRIC_MAP for the authoritative tile id → canonical name mapping.
//
// DEV-ONLY FALLBACK GUIDE — three tiers of data for every tile:
//
//   Tier 1 (canonical): liveKpiCards wiring block below overrides value/change/status
//                       from a Supabase Phase 1 RPC once phase1Metrics resolves.
//   Tier 2 (fallback):  if the Phase 1 RPC fails, liveKpiCards falls back to
//                       commerceMetrics (all-time, no date filter, different formulas).
//                       Both Tier 1 and Tier 2 are labelled in each wiring block.
//   Tier 3 (static):    values declared in this array are loading sentinels shown
//                       only while both async sources are still pending.
//
//   Exceptions — tiles with no commerceMetrics fallback (Tier 2 is snapshot constant):
//     "cr"  — CASH_RUNWAY snapshot constant.  Primary: cash_runway_months() Phase 2a RPC.
//     "ae"  — "Meta CAC +14%" literal.  Needs Meta Ads API integration (Phase 3).
//     "np"  — MONTHLY_OPERATING_PROFIT snapshot constant.  Primary: operating_profit_monthly() Phase 2a RPC.
//
//   change strings — ALL static for every tile.  No prior-period SQL functions
//                    exist yet.  Replace in Phase 2 with computed ±X% deltas.
const KPI_CARDS: {
  id: string;
  title: string;
  value: string;
  change: string;
  status: KpiStatus;
  text: string;
  /** Set by liveKpiCards when a live Phase 2 delta is available. Undefined until then. */
  changeSentiment?: DeltaSentiment | null;
  /**
   * Phase 2c rolling 3-month trend context line.
   * Only set for tiles that have a rolling_3m_averages counterpart.
   * null  = trends resolved but not enough data to show a line.
   * undefined = trends not yet resolved (loading).
   */
  trendLine?: {
    /**
     * Narrative insight sentence combining MoM change and rolling 3m trend comparison.
     * e.g. "AOV fell 6.0% this month but is still £2.28 above your recent trend"
     */
    text: string;
    sentiment: "positive" | "negative" | null;
  } | null;
}[] = [
  {
    // value: Tier 3 loading sentinel (MONTHLY_CM_PCT snapshot = 42.3%) until
    //        liveKpiCards wiring block resolves contribution_margin_pct() RPC (Tier 1)
    //        or commerceMetrics.contributionMarginPercent (Tier 2 DEV-ONLY fallback).
    // change: DEV-ONLY static string — no prior-period contribution_margin_pct() RPC yet.
    //         Replace with computed "±X.Xpp vs last month" in Phase 2.
    id: "cm",   title: "Contribution Margin",      value: `${MONTHLY_CM_PCT}%`,          change: "↓ 2.8% vs last month",                status: "warning",
    text: "Margin is below target and weakening.",
  },
  {
    // value: Tier 3 loading sentinel — "£0" shown while phase1Metrics and commerceMetrics
    //        are both still loading.  Overridden by net_sales() RPC (Tier 1) or
    //        commerceMetrics.netSales (Tier 2 DEV-ONLY fallback) in liveKpiCards.
    // change: intentionally empty — no prior-period net_sales() delta yet (Phase 2).
    id: "ns",
    title: "Net Sales",
    value: "£0",
    change: "",
    status: "positive",
    text: "Revenue after discounts and refunds.",
  },
  {
    // value/change/status: Tier 3 — RECOVERABLE_TILE_VALUE/CHANGE are derived from the
    //   RECOVERABLE_LOW/HIGH snapshot constants (business-snapshot.ts) as the loading
    //   sentinel.  Overridden by recoverable_contribution_range() RPC in liveKpiCards.
    //   The snapshot constants also serve as the Tier 2 DEV-ONLY fallback if the RPC fails.
    id: "rc",
    title: "Money to Win Back",
    value: RECOVERABLE_TILE_VALUE,
    change: RECOVERABLE_TILE_CHANGE,
    status: RECOVERABLE_LOW > 0 || RECOVERABLE_HIGH > 0 ? "positive" : "neutral",
    text: "Contribution recoverable across margin, marketing and fulfilment.",
  },
  {
    // DEV-ONLY — NO LIVE WIRING.  value and change are fully mock (Phase 1 only).
    // value:  CASH_RUNWAY = 3.4 from cash-snapshot.ts.
    //         Primary source: cash_runway_months() Supabase RPC (Phase 2, requires Xero
    //         cash balance + monthly fixed costs).  Do not ship to production without Xero.
    // change: "Moderate" is a static qualitative label.
    //         Replace with computed "±X.X months vs last month" once Xero is connected.
    id: "cr",   title: "Cash Runway",              value: `${CASH_RUNWAY} months`,        change: "Moderate",                            status: "warning",
    text: "Positive. Runway shortening — action needed.",
  },
  {
    // value: Tier 3 loading sentinel (DISCOUNT_DEP snapshot = 38%) until liveKpiCards
    //        wiring block resolves discount_dependency() RPC (Tier 1) or
    //        commerceMetrics.discountRate (Tier 2 DEV-ONLY fallback).
    // change: DEV-ONLY static string — no prior-period discount_dependency() RPC yet.
    //         Replace with computed "±X% vs last month" in Phase 2.
    id: "dd",   title: "Discount Dependency",      value: `${DISCOUNT_DEP}%`,             change: "↑ 11% vs last month",                status: "danger",
    text: "Discounting sustaining growth at an unsustainable rate.",
  },
  {
    // DEV-ONLY — NO LIVE WIRING.  value and change are fully mock (Phase 1 only).
    // value:  "Meta CAC +14%" is a hardcoded snapshot string.
    //         Primary source: meta_cac_trend() Supabase RPC (Phase 3, requires Meta
    //         Ads API spend ingestion + customer acquisition source attribution).
    //         Do not ship to production without the Meta integration.
    // change: "↓ efficiency" is a hardcoded qualitative direction label.
    //         Replace with computed "±X% vs last month" once meta_cac_trend() exists.
    id: "ae",   title: "Acquisition Efficiency",   value: "Meta CAC +14%",                change: "↓ efficiency",                       status: "danger",
    text: "CAC rising faster than contribution per order.",
  },
  {
    // value: Tier 3 loading sentinel (REPEAT_RATE snapshot = 28%) until liveKpiCards
    //        wiring block resolves repeat_purchase_rate() RPC (Tier 1) or
    //        commerceMetrics.repeatPurchaseRate (Tier 2 DEV-ONLY fallback).
    // change: DEV-ONLY static string — no prior-period repeat_purchase_rate() RPC yet.
    //         Replace with computed "±X.X% vs last month" in Phase 2.
    id: "rpr",  title: "Repeat Purchase Rate",     value: `${REPEAT_RATE}%`,              change: "↑ 4.2% vs last month",               status: "positive",
    text: "Retention strengthening. Repeat rate trending up.",
  },
  {
    // value: Tier 3 loading sentinel (MONTHLY_REVENUE snapshot = £124,500) until
    //        liveKpiCards wiring block resolves gross_revenue() RPC (Tier 1) or
    //        commerceMetrics.totalRevenue (Tier 2 DEV-ONLY fallback).
    // change: DEV-ONLY static string — no prior-period gross_revenue() RPC yet.
    //         Replace with computed "±X.X% vs last month" in Phase 2.
    id: "mr",   title: "Monthly Revenue",          value: `£${MONTHLY_REVENUE.toLocaleString("en-GB")}`, change: "↑ 12.4% vs last month", status: "positive",
    text: "Revenue growing. Margin quality declining.",
  },
  {
    // value: Tier 3 loading sentinel — MONTHLY_OPERATING_PROFIT snapshot = −£10,184.
    //        Shown only while phase2aMetrics is still loading (null).
    //        Overridden by operating_profit_monthly() Phase 2a RPC in liveKpiCards (Tier 1).
    //        Falls back to MONTHLY_OPERATING_PROFIT if the RPC fails or returns null (Tier 2).
    // change: static — no prior-period operating_profit_monthly() delta yet (Phase 2).
    //         Replace with computed "±X.X% vs last month" once prior-period RPC exists.
    id: "np",   title: "Net Profit",
    value:  formatOpProfit(MONTHLY_OPERATING_PROFIT),
    change: "",
    status: opProfitStatus(MONTHLY_OPERATING_PROFIT),
    text: "Net operating profit after fixed overheads.",
  },
  {
    // value: Tier 3 loading sentinel — "£0" shown while phase1Metrics and commerceMetrics
    //        are both still loading.  Overridden by average_order_value() RPC (Tier 1) or
    //        commerceMetrics.averageOrderValue (Tier 2 DEV-ONLY fallback) in liveKpiCards.
    // change: intentionally empty — no prior-period average_order_value() delta yet (Phase 2).
    id: "aov",
    title: "Average Order Value",
    value: "£0",
    change: "",
    status: "positive",
    text: "Average revenue per order placed.",
  },
  {
    // value: Tier 3 loading sentinel — "0%" shown while phase1Metrics and commerceMetrics
    //        are both still loading.  Overridden by refund_rate() RPC (Tier 1) or
    //        commerceMetrics.refundRate (Tier 2 DEV-ONLY fallback) in liveKpiCards.
    // change: intentionally empty — no prior-period refund_rate() delta yet (Phase 2).
    id: "rr",
    title: "Refund Rate",
    value: "0%",
    change: "",
    status: "warning",
    text: "Refunds as a proportion of gross revenue.",
  },
];

const KPI_EXPLANATIONS: Record<string, { means: string; matters: string }> = {
  cm: {
    means: "How much profit is left from each sale after variable costs.",
    matters: "If this falls, growth can look healthy while cash quietly gets tighter.",
  },
  ns: {
    means: "Sales after discounts, refunds and tax have been taken out.",
    matters: "This is the money your business actually keeps from orders before costs.",
  },
  rc: {
    means: "The monthly profit you may be able to recover from known weak spots.",
    matters: "It shows where action could turn into cash, not just better reporting.",
  },
  cr: {
    means: "How long your current cash could cover normal running costs.",
    matters: "Shorter runway means less room to absorb mistakes or slow months.",
  },
  dd: {
    means: "How much revenue is being given away through discounts.",
    matters: "Heavy discounting can grow sales while shrinking the profit you keep.",
  },
  ae: {
    means: "Whether paid marketing is getting more or less expensive.",
    matters: "Rising acquisition costs can make new revenue less valuable.",
  },
  rpr: {
    means: "How many customers are coming back to buy again.",
    matters: "Repeat customers usually make growth cheaper and more resilient.",
  },
  mr: {
    means: "Gross sales for the month before discounts and refunds.",
    matters: "Useful directionally, but it only tells part of the profit story.",
  },
  np: {
    means: "Estimated profit after fixed overheads.",
    matters: "This shows whether the business is actually converting sales into profit.",
  },
  aov: {
    means: "The average value of each order.",
    matters: "Higher order values can improve profit if costs stay controlled.",
  },
  rr: {
    means: "How much revenue is being lost to refunds.",
    matters: "Refunds reduce sales quality and can add handling costs too.",
  },
};

const TOP_DRIVERS: Driver[] = [
  {
    id: "1",
    text: "Fulfilment costs rose 12% per order, compressing contribution margin.",
    proDetail: "Fulfilment cost per order up 12%. Contribution impact: −£3.2k vs last month.",
    trend: "worsening",
    href: "/margin-analysis",
  },
  {
    id: "2",
    text: "Repeat rate improved month-on-month.",
    trend: "improving",
    href: "/growth-quality",
  },
  {
    id: "3",
    text: "Meta CAC up 14%. ROAS fell from 3.1x to 2.7x.",
    proDetail: "Meta CAC now £28 per customer (+14% MoM). ROAS declined from 3.1x to 2.7x.",
    trend: "worsening",
    href: "/marketing-efficiency",
  },
  {
    id: "4",
    text: "Discounting growing faster than revenue.",
    proDetail: "Discount-attached orders +8% vs revenue +5.2%. Margin drag: −£4.2k per month.",
    trend: "worsening",
    href: "/margin-analysis",
  },
  {
    id: "5",
    text: "AOV stable. No material movement.",
    trend: "neutral",
  },
];

const PRIORITY_ACTIONS = [
  {
    title:  "Reduce fulfilment cost leakage",
    impact: "+£6.8k contribution",
    reason: "Largest single source of margin compression this month.",
    badge:  "High impact",
    color:  "red",
    timing: "2–4 weeks" as const,
  },
  {
    title:  "Tighten discount exposure",
    impact: "+£4.2k contribution",
    reason: "Discount-attached orders up 8% against revenue growth of 5.2%.",
    badge:  "High impact",
    color:  "red",
    timing: "Immediate" as const,
  },
  {
    title:  "Reallocate inefficient marketing spend",
    impact: "+£3.1k contribution",
    reason: "Meta CAC up 14%. ROAS declined from 3.1x to 2.7x.",
    badge:  "Medium impact",
    color:  "orange",
    timing: "1–2 weeks" as const,
  },
] as const;

// Engine cards — ordered per spec
const HEALTH_MODULES = [
  {
    id:       "profit",
    title:    "Profit Quality / Margin Analysis",
    headline: "£20.4k margin recovery identified",
    subtitle: "Identify where contribution is being lost and quantify the recovery.",
    cta:      "Analyse margin",
    href:     "/margin-analysis",
  },
  {
    id:       "pricing",
    title:    "Pricing Optimisation",
    headline: "£52k recoverable contribution",
    subtitle: "Quantify discount leakage and model pricing improvements.",
    cta:      "Improve pricing",
    href:     "/pricing-optimisation",
  },
  {
    id:       "growth",
    title:    "Growth Quality",
    headline: "38% discount dependency",
    subtitle: "Assess whether growth is profitable or dependent on discounting and paid acquisition.",
    cta:      "Analyse growth",
    href:     "/growth-quality",
  },
  {
    id:       "acquisition",
    title:    "Marketing / Acquisition Efficiency",
    headline: "Meta CAC +14%",
    subtitle: "Identify which channels generate profitable customers and at what cost.",
    cta:      "Diagnose acquisition",
    href:     "/marketing-efficiency",
  },
  {
    id:       "cash",
    title:    "Cash Control",
    headline: "£64k cash headroom opportunity",
    subtitle: "Quantify cash headroom, runway position and liquidity protection actions.",
    cta:      "Review cash position",
    href:     "/cash-control",
  },
  {
    id:       "scenario",
    title:    "Scenario Lab / Opportunities",
    headline: "£18k–£42k contribution upside",
    subtitle: "Model the combined impact of the priority improvement actions.",
    cta:      "Model opportunity",
    href:     "/scenario-lab",
  },
] as const;

const FREE_HEALTH_MODULE_CTAS: Record<(typeof HEALTH_MODULES)[number]["id"], string> = {
  profit:      "Unlock recovery plan",
  pricing:     "Unlock pricing opportunities",
  growth:      "Unlock growth analysis",
  acquisition: "Unlock acquisition insights",
  cash:        "Unlock cash opportunities",
  scenario:    "Unlock scenario modelling",
};

const FREE_HEALTH_MODULE_HEADLINES: Record<(typeof HEALTH_MODULES)[number]["id"], string> = {
  profit:      "Margin recovery opportunity identified",
  pricing:     "Pricing leakage detected",
  growth:      "Growth quality concern detected",
  acquisition: "Acquisition efficiency issue detected",
  cash:        "Cash headroom opportunity identified",
  scenario:    "Improvement scenarios available",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [metrics, setMetrics] = useState<any>(null);

  // ── Phase 1: walk back from current month to the most recent month with data ──
  // activeDateFrom / activeDateTo are forwarded to Phase 2a so both fetches
  // cover the same resolved period.
  const {
    phase1: phase1Metrics,
    dateFrom: activeDateFrom,
    dateTo:        activeDateTo,
    periodLabel:   activePeriodLabel,
    loading:       periodLoading,
  } = useLatestDataPeriod(PHASE1_STORE_ID);

  useEffect(() => {
    getCommerceMetrics().then(setMetrics);
  }, []);

  // ── Phase 2a metrics: Cash Runway tile (METRIC.CASH_RUNWAY_MONTHS / tile id "cr") ──
  // Fetches cash_runway_months() and operating_profit_monthly() independently of
  // Phase 1.  A failure here leaves phase2aMetrics null and the affected tiles fall
  // back to their snapshot constants.  Phase 1 tiles are completely unaffected.
  const [phase2aMetrics, setPhase2aMetrics] = useState<Phase2aMetricsResponse | null>(null);

  useEffect(() => {
    // Wait until useLatestDataPeriod has resolved the active period before
    // fetching Phase 2a — both phases must cover the same month.
    if (!activeDateFrom || !activeDateTo) return;
    getPhase2aMetrics(PHASE1_STORE_ID, activeDateFrom, activeDateTo)
      .then(setPhase2aMetrics)
      .catch(() => {
        // Network or RPC error: leave phase2aMetrics null so affected tiles
        // fall back to their snapshot constants rather than breaking.
      });
  }, [activeDateFrom, activeDateTo]);

  // ── Opportunity breakdown: recoverable contribution headline ─────────────────
  // Fetches opportunity_breakdown(p_store_id) to compute recoverableLow / recoverableHigh
  // for the headline panel by summing impact_low and impact_high across all rows.
  // Independent of phase1Metrics — a failure here does not affect any other tile.
  // Falls back to RECOVERABLE_LOW / RECOVERABLE_HIGH from business-snapshot.ts
  // while loading (null) or if the RPC returns an error.
  const [oppBreakdown, setOppBreakdown] = useState<{ lo: number; hi: number } | null>(null);

  useEffect(() => {
    // supabase.rpc() returns PromiseLike, not Promise — wrap to get .catch().
    Promise.resolve(
      supabase.rpc("opportunity_breakdown", { p_store_id: PHASE1_STORE_ID }),
    )
      .then(({ data, error }) => {
        if (error || !Array.isArray(data)) return; // leave null → snapshot fallback
        const lo = data.reduce((sum: number, row: Record<string, unknown>) => sum + (Number(row.impact_low) || 0), 0);
        const hi = data.reduce((sum: number, row: Record<string, unknown>) => sum + (Number(row.impact_high) || 0), 0);
        setOppBreakdown({ lo, hi });
      })
      .catch(() => {
        // Network or RPC error: leave oppBreakdown null so the headline falls
        // back to RECOVERABLE_LOW / RECOVERABLE_HIGH rather than breaking.
      });
  }, []);

  // Headline recoverable contribution range for the green opportunity panel.
  // oppBreakdown null = still loading → safe fallback to snapshot constants.
  // oppBreakdown resolved = use live summed RPC values.
  const rcHeadlineLo = oppBreakdown !== null ? oppBreakdown.lo : RECOVERABLE_LOW;
  const rcHeadlineHi = oppBreakdown !== null ? oppBreakdown.hi : RECOVERABLE_HIGH;
  const rcHeadlineStr = `£${(rcHeadlineLo / 1_000).toFixed(0)}k–£${(rcHeadlineHi / 1_000).toFixed(0)}k`;

  // ── Phase 2: month-on-month delta metrics ────────────────────────────────
  // Fires after useLatestDataPeriod resolves — same period gate as Phase 2a.
  // A failure here leaves phase2Deltas null; all delta badge strings fall back
  // to card.change static sentinel (shown while loading) or "—" (after load,
  // no prior-period data).  Phase 1 and Phase 2a tiles are unaffected.
  const { deltas: phase2Deltas, trends: phase2Trends, loading: phase2DeltasLoading } = usePhase2Deltas(
    PHASE1_STORE_ID, activeDateFrom, activeDateTo,
  );

  const liveKpiCards = KPI_CARDS.map((card) => {
    // ── Net Sales tile — wired to Phase 1 Supabase function ──────────────────
    // @canonical METRIC.NET_SALES / tile id "ns"
    // Source (primary):  phase1Metrics.data.netSales
    //   Formula: SUM(gross_sales − discounts − refunds − tax), excl. cancelled
    //   Period:  current calendar month (PHASE1_DATE_FROM → PHASE1_DATE_TO)
    // Source (fallback): metrics.netSales from commerceMetrics.ts
    //   Formula: SUM(gross_sales − discounts − refunds − tax), all-time, no date filter
    // Source (static):   KPI_CARDS "ns" card.value ("£0") while both still loading
    if (card.id === "ns") {
      const nsValue =
        phase1Metrics !== null && !phase1Metrics.errors.some(e => e.fn === "net_sales")
          ? phase1Metrics.data.netSales   // canonical — phase1 SQL function
          : metrics?.netSales;            // DEV-ONLY fallback — commerceMetrics all-time, no date filter
      if (nsValue == null) return card;   // static fallback while both loading
      return {
        ...card,
        value:  `£${Math.round(nsValue).toLocaleString("en-GB")}`,
        // Phase 2: live net_sales_delta_pct; "—" when prior period has no data
        change: !phase2DeltasLoading
          ? formatDeltaPct(phase2Deltas?.net_sales_delta_pct ?? null)
          : card.change,
        changeSentiment: !phase2DeltasLoading
          ? deltaToSentiment(phase2Deltas?.net_sales_delta_pct ?? null, DELTA_POLARITY.ns)
          : undefined,
      };
    }

    // ── Monthly Revenue tile — wired to Phase 1 Supabase function ────────────
    // @canonical METRIC.MONTHLY_REVENUE / tile id "mr"
    // Source (primary):  phase1Metrics.data.grossRevenue
    //   Formula: SUM(gross_sales), excl. cancelled orders
    //   Period:  current calendar month (PHASE1_DATE_FROM → PHASE1_DATE_TO)
    // Source (fallback): metrics.totalRevenue from commerceMetrics.ts
    //   Formula: SUM(gross_sales), all-time, no date filter
    // Source (static):   KPI_CARDS "mr" card.value while both still loading
    if (card.id === "mr") {
      const mrValue =
        phase1Metrics !== null && !phase1Metrics.errors.some(e => e.fn === "gross_revenue") && phase1Metrics.data.grossRevenue > 0
          ? phase1Metrics.data.grossRevenue   // canonical — phase1 SQL function
          : metrics?.totalRevenue;             // DEV-ONLY fallback — commerceMetrics all-time, no date filter; also used when RPC returns 0 (no orders in period)
      if (mrValue == null) return card;        // static fallback while both loading
      return {
        ...card,
        value:  `£${Math.round(mrValue).toLocaleString("en-GB")}`,
        // Phase 2: live gross_revenue_delta_pct; "—" when prior period has no data
        change: !phase2DeltasLoading
          ? formatDeltaPct(phase2Deltas?.gross_revenue_delta_pct ?? null)
          : card.change,
        changeSentiment: !phase2DeltasLoading
          ? deltaToSentiment(phase2Deltas?.gross_revenue_delta_pct ?? null, DELTA_POLARITY.mr)
          : undefined,
      };
    }

    // ── Average Order Value tile — wired to Phase 1 Supabase function ─────────
    // @canonical METRIC.AVERAGE_ORDER_VALUE / tile id "aov"
    // Source (primary):  phase1Metrics.data.averageOrderValue
    //   Formula: net_sales / qualifying_order_count
    //            where qualifying = non-cancelled AND non-fully-refunded orders
    //   Period:  current calendar month (PHASE1_DATE_FROM → PHASE1_DATE_TO)
    // Source (fallback): metrics.averageOrderValue from commerceMetrics.ts
    //   Formula: total_sales / COUNT(*) — all orders, no date filter, no exclusions
    //   NOTE: this formula differs from phase1; see docs/data-dictionary-v1.md §A.6
    // Source (static):   KPI_CARDS "aov" card.value ("£0") while both still loading
    if (card.id === "aov") {
      const aovValue =
        phase1Metrics !== null && !phase1Metrics.errors.some(e => e.fn === "average_order_value") && phase1Metrics.data.averageOrderValue > 0
          ? phase1Metrics.data.averageOrderValue   // canonical — phase1 SQL function
          : metrics?.averageOrderValue;             // DEV-ONLY fallback — commerceMetrics all-time; formula differs (see data dict §A.6); also used when RPC returns 0 (no orders in period)
      if (aovValue == null) return card;            // static fallback while both loading

      // Phase 2c: rolling 3m trend context for AOV.
      // Narrative combines MoM % change and absolute £ delta vs 3m trend.
      // Shown once phase2Trends resolves (same Promise.all gate as deltas).
      const aovTrendLine: typeof card.trendLine =
        !phase2DeltasLoading && phase2Trends != null
          ? (() => {
              const avg        = phase2Trends.aov_3m_avg;
              const trendDelta = aovValue - avg;
              const sentiment: "positive" | "negative" | null =
                trendDelta >  0.5 ? "positive"
                : trendDelta < -0.5 ? "negative"
                : null;
              // Only include MoM direction when prior period has data.
              const momPct = phase2Deltas?.aov_delta_pct ?? null;
              let text: string;
              if (momPct !== null) {
                const trendAbs = `£${Math.abs(trendDelta).toFixed(2)}`;
                const trendDir = trendDelta >= 0 ? "above" : "below";
                text = momPct < 0
                  ? `AOV fell ${Math.abs(momPct).toFixed(1)}% this month but remains ${trendAbs} ${trendDir} trend`
                  : `AOV rose ${Math.abs(momPct).toFixed(1)}% this month and is ${trendAbs} ${trendDir} trend`;
              } else {
                const trendAbs = `£${Math.abs(trendDelta).toFixed(2)}`;
                const trendDir = trendDelta >= 0 ? "above" : "below";
                text = `AOV is ${trendAbs} ${trendDir} trend`;
              }
              return { text, sentiment };
            })()
          : undefined;

      return {
        ...card,
        value:  `£${aovValue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        // Phase 2: live aov_delta_pct; "—" when prior period has no data
        change: !phase2DeltasLoading
          ? formatDeltaPct(phase2Deltas?.aov_delta_pct ?? null)
          : card.change,
        changeSentiment: !phase2DeltasLoading
          ? deltaToSentiment(phase2Deltas?.aov_delta_pct ?? null, DELTA_POLARITY.aov)
          : undefined,
        trendLine: aovTrendLine,
      };
    }

    // ── Refund Rate tile — wired to Phase 1 Supabase function ───────────────
    // @canonical METRIC.REFUND_RATE_PCT / tile id "rr"
    // Source (primary):  phase1Metrics.data.refundRate   [0, 1] ratio → × 100 for %
    //   Formula: SUM(refunds) / SUM(gross_sales), excl. cancelled orders
    //            (return_amount / gross_revenue in the period)
    //   Period:  current calendar month (PHASE1_DATE_FROM → PHASE1_DATE_TO)
    // Source (fallback): metrics.refundRate from commerceMetrics.ts   [0, 1] ratio
    //   Formula: SUM(refunds) / SUM(gross_sales), all-time, no date filter
    // Source (static):   KPI_CARDS "rr" card.value ("0%") while both still loading
    if (card.id === "rr") {
      const rrValue =
        phase1Metrics !== null && !phase1Metrics.errors.some(e => e.fn === "refund_rate")
          ? phase1Metrics.data.refundRate   // canonical — phase1 SQL function [0,1]
          : metrics?.refundRate;            // DEV-ONLY fallback — commerceMetrics all-time, no date filter [0,1]
      if (rrValue == null) return card;     // static fallback while both loading
      return {
        ...card,
        value:  `${Math.round(rrValue * 100)}%`,
        // Phase 2: live refund_rate_delta_pp (already pp — do NOT multiply by 100)
        // "—" when prior period has no data
        change: !phase2DeltasLoading
          ? formatDeltaPp(phase2Deltas?.refund_rate_delta_pp ?? null)
          : card.change,
        // down-is-good: a falling refund rate is a positive signal
        changeSentiment: !phase2DeltasLoading
          ? deltaToSentiment(phase2Deltas?.refund_rate_delta_pp ?? null, DELTA_POLARITY.rr)
          : undefined,
      };
    }

    // ── Discount Dependency tile — wired to Phase 1 Supabase function ──────────
    // @canonical METRIC.DISCOUNT_DEPENDENCY_RATIO / tile id "dd"
    // Source (primary):  phase1Metrics.data.discountDependency   [0, 1] ratio → × 100 for %
    //   Formula: SUM(discounts) / SUM(gross_sales), excl. cancelled orders
    //            (discount_cost / gross_revenue in the period — value-based, not order-count-based)
    //   Period:  current calendar month (PHASE1_DATE_FROM → PHASE1_DATE_TO)
    // Source (fallback): metrics.discountRate from commerceMetrics.ts   [0, 1] ratio
    //   Formula: SUM(discounts) / SUM(gross_sales), all-time, no date filter
    // Source (static):   KPI_CARDS "dd" card.value while both still loading
    if (card.id === "dd") {
      const ddValue =
        phase1Metrics !== null && !phase1Metrics.errors.some(e => e.fn === "discount_dependency")
          ? phase1Metrics.data.discountDependency   // canonical — phase1 SQL function [0,1]
          : metrics?.discountRate;                  // DEV-ONLY fallback — commerceMetrics all-time, no date filter [0,1]
      if (ddValue == null) return card;             // static fallback while both loading
      return {
        ...card,
        value:  `${Math.round(ddValue * 100)}%`,
        // Phase 2: live discount_dep_delta_pp (already pp — do NOT multiply by 100)
        // "—" when prior period has no data
        change: !phase2DeltasLoading
          ? formatDeltaPp(phase2Deltas?.discount_dep_delta_pp ?? null)
          : card.change,
        // down-is-good: falling discount dependency is a positive signal
        changeSentiment: !phase2DeltasLoading
          ? deltaToSentiment(phase2Deltas?.discount_dep_delta_pp ?? null, DELTA_POLARITY.dd)
          : undefined,
      };
    }

    // ── Repeat Purchase Rate tile — wired to Phase 1 Supabase function ─────────
    // @canonical METRIC.REPEAT_PURCHASE_RATE / tile id "rpr"
    // Source (primary):  phase1Metrics.data.repeatPurchaseRate   [0, 1] ratio → × 100 for %
    //   Formula: returning_customers / all_period_customers
    //     returning  = customer whose first_order_at < period start (ordered before this month)
    //     all        = distinct non-guest customers who placed a non-cancelled order this period
    //     guest checkouts excluded from both numerator and denominator (customer_id IS NULL)
    //   Period:  current calendar month (PHASE1_DATE_FROM → PHASE1_DATE_TO)
    // Source (fallback): metrics.repeatPurchaseRate from commerceMetrics.ts   [0, 1] ratio
    //   Formula: customers with > 1 order / all customers — all-time, no date filter
    // Source (static):   KPI_CARDS "rpr" card.value while both still loading
    if (card.id === "rpr") {
      const rprValue =
        phase1Metrics !== null && !phase1Metrics.errors.some(e => e.fn === "repeat_purchase_rate")
          ? phase1Metrics.data.repeatPurchaseRate   // canonical — phase1 SQL function [0,1]
          : metrics?.repeatPurchaseRate;            // DEV-ONLY fallback — commerceMetrics all-time, no date filter [0,1]
      if (rprValue == null) return card;            // static fallback while both loading
      return {
        ...card,
        value:  `${Math.round(rprValue * 100)}%`,
        // Phase 2: live rpr_delta_pp (already pp — do NOT multiply by 100)
        // "—" when prior period has no data
        change: !phase2DeltasLoading
          ? formatDeltaPp(phase2Deltas?.rpr_delta_pp ?? null)
          : card.change,
        changeSentiment: !phase2DeltasLoading
          ? deltaToSentiment(phase2Deltas?.rpr_delta_pp ?? null, DELTA_POLARITY.rpr)
          : undefined,
      };
    }

    // ── Contribution Margin tile — wired to Phase 1 Supabase cost model ─────────
    // @canonical METRIC.CONTRIBUTION_MARGIN_PCT / tile id "cm"
    // Source (primary):  phase1Metrics.data.contributionMarginPct   [0, 1] | null → × 100 for %
    //   Formula: (net_sales − payment_fees − fulfilment − packaging − return_handling) / net_sales
    //     payment_fees         = net_sales × payment_fee_rate
    //     fulfilment_cost      = order_count × fulfilment_cost_per_order
    //     packaging_cost       = order_count × packaging_cost_per_order
    //     return_handling_cost = return_amount × return_handling_rate
    //   Cost rates: v_current_cost_assumptions (most recent effective_from ≤ today row per store)
    //   Period:  current calendar month (PHASE1_DATE_FROM → PHASE1_DATE_TO)
    //   NULL:  when no cost assumption row exists for the store → triggers fallback
    //   0:     when net_sales = 0 in the period (legitimate zero margin)
    // Source (fallback): metrics.contributionMarginPercent from commerceMetrics.ts   [0, 1]
    //   Formula: estimated from static cost assumptions — not store-personalised
    // Source (static):   KPI_CARDS "cm" card.value while both still loading
    if (card.id === "cm") {
      const cmValue =
        phase1Metrics !== null &&
        !phase1Metrics.errors.some(e => e.fn === "contribution_margin_pct") &&
        phase1Metrics.data.contributionMarginPct !== null
          ? phase1Metrics.data.contributionMarginPct   // canonical — phase1 SQL function [0,1]
          : metrics?.contributionMarginPercent;         // DEV-ONLY fallback — commerceMetrics estimated value, not store-personalised [0,1]
      if (cmValue == null) return card;                 // static fallback while both loading
      return {
        ...card,
        value:  `${Math.round(cmValue * 100)}%`,
        // Phase 2: live cm_pct_delta_pp (already pp — do NOT multiply by 100)
        // "—" when prior period has no data
        change: !phase2DeltasLoading
          ? formatDeltaPp(phase2Deltas?.cm_pct_delta_pp ?? null)
          : card.change,
        changeSentiment: !phase2DeltasLoading
          ? deltaToSentiment(phase2Deltas?.cm_pct_delta_pp ?? null, DELTA_POLARITY.cm)
          : undefined,
      };
    }

    // ── Recoverable Contribution tile — wired to recoverable_contribution_range() ──
    // @canonical METRIC.RECOVERABLE_CONTRIBUTION_RANGE / tile id "rc"
    // Source (primary):  phase1Metrics.data.recoverableLow / recoverableHigh
    //   Formula: SUM(impact_low), SUM(impact_high) from non-archived opportunities
    //   No date filter — opportunities are store-level, not period-bound.
    //   A result of (0, 0) is valid — it means no non-archived opportunities exist.
    // Source (fallback): RECOVERABLE_LOW / RECOVERABLE_HIGH from business-snapshot.ts
    //   Used when: RPC has not yet resolved (null) or the specific RPC failed.
    //   Static constants seeded from the opportunity-engine snapshot.
    // Source (static):   KPI_CARDS "rc" card.value ("Opportunity being calculated")
    //   Shown only while phase1Metrics is still loading (null).
    if (card.id === "rc") {
      const rcResolved =
        phase1Metrics !== null &&
        !phase1Metrics.errors.some(e => e.fn === "recoverable_contribution_range");
      const lo = rcResolved
        ? phase1Metrics!.data.recoverableLow
        : RECOVERABLE_LOW;                    // DEV-ONLY fallback — business-snapshot.ts snapshot constant; remove when Supabase opportunities table is reliable
      const hi = rcResolved
        ? phase1Metrics!.data.recoverableHigh
        : RECOVERABLE_HIGH;                   // DEV-ONLY fallback — business-snapshot.ts snapshot constant; remove when Supabase opportunities table is reliable
      // "Opportunity being calculated" only while the async call has not yet settled.
      // Once resolved, a (0, 0) result is a legitimate £0k–£0k state, not an error.
      const isCalculating = phase1Metrics === null;
      const hasOpportunities = lo > 0 || hi > 0;
      return {
        ...card,
        value: isCalculating
          ? "Opportunity being calculated"
          : `£${(lo / 1_000).toFixed(0)}k–£${(hi / 1_000).toFixed(0)}k`,
        change: isCalculating
          ? "Analysis in progress"
          : hasOpportunities
            ? "Immediate margin recovery available"
            : "No recovery opportunities identified",
        status: (!isCalculating && hasOpportunities ? "positive" : "neutral") as KpiStatus,
      };
    }

    // ── Cash Runway tile — wired to Phase 2a Supabase function ──────────────
    // @canonical METRIC.CASH_RUNWAY_MONTHS / tile id "cr"
    // Source (primary):  phase2aMetrics.data.cashRunwayMonths
    //   Formula: SUM(cash_balance at MAX(snapshot_date)) / current-month actual overhead
    //   No date range — cash_runway_months() uses CURRENT_DATE internally.
    //   NULL:  when no cash_balance_snapshots row exists, or overhead = 0.
    // Source (fallback): CASH_RUNWAY constant (3.4) from cash-snapshot.ts
    //   Used when: RPC failed (error entry in phase2aMetrics.errors) or returned null.
    //   No commerceMetrics equivalent — cash runway cannot be derived from order data.
    // Source (static):   KPI_CARDS "cr" card.value while phase2aMetrics is still loading
    if (card.id === "cr") {
      // Resolve: live RPC value → fallback constant → static sentinel (null = still loading)
      const crResolved = phase2aMetrics !== null;
      const crLive =
        crResolved &&
        !phase2aMetrics!.errors.some(e => e.fn === "cash_runway_months") &&
        phase2aMetrics!.data.cashRunwayMonths !== null &&
        phase2aMetrics!.data.cashRunwayMonths > 0
          ? phase2aMetrics!.data.cashRunwayMonths
          : null;
      const crValue = crLive ?? (crResolved ? CASH_RUNWAY : null);
      if (crValue === null) return card;  // static sentinel while still loading

      // Format: "X.X months" — one decimal place, consistent with the mock "3.4 months"
      const crDisplay = `${crValue.toFixed(1)} months`;

      // Status and change text derived from runway duration
      let crStatus: KpiStatus;
      let crChange: string;
      if (crValue >= 6.0) {
        crStatus = "positive";
        crChange = "Healthy — 6+ months headroom";
      } else if (crValue >= 3.0) {
        crStatus = "neutral";
        crChange = "Adequate runway";
      } else if (crValue >= 1.0) {
        crStatus = "warning";
        crChange = "Runway tightening";
      } else {
        crStatus = "danger";
        crChange = "Critical — under 1 month";
      }

      return {
        ...card,
        value:  crDisplay,
        change: crChange,
        status: crStatus,
      };
    }

    // ── Net Profit tile — wired to Phase 2a Supabase function ────────────────
    // @canonical METRIC.OPERATING_PROFIT_ESTIMATE / tile id "np"
    // Source (primary):  phase2aMetrics.data.operatingProfitMonthly
    //   Formula: (net_sales × contribution_margin_pct) − monthly_overhead_total('actual')
    //   Period:  current calendar month (PHASE1_DATE_FROM → PHASE1_DATE_TO)
    //   NULL:  when no store_cost_assumptions row exists → triggers fallback.
    //   Negative values are valid and must be displayed, not suppressed.
    // Source (fallback): MONTHLY_OPERATING_PROFIT constant from business-snapshot.ts (−£10,184)
    //   Used when: RPC failed (error entry in phase2aMetrics.errors) or returned null.
    //   No commerceMetrics equivalent — operating profit cannot be derived from order data alone.
    // Source (static):   KPI_CARDS "np" card.value while phase2aMetrics is still loading (null)
    if (card.id === "np") {
      const npResolved = phase2aMetrics !== null;
      // Use live RPC value when the call succeeded and returned a non-null number.
      const npLive =
        npResolved &&
        !phase2aMetrics!.errors.some(e => e.fn === "operating_profit_monthly") &&
        phase2aMetrics!.data.operatingProfitMonthly !== null
          ? phase2aMetrics!.data.operatingProfitMonthly
          : null;
      // If resolved but live is null (RPC failed or DB returned null), use snapshot fallback.
      const npValue = npLive ?? (npResolved ? MONTHLY_OPERATING_PROFIT : null);
      if (npValue === null) return card;  // static sentinel while still loading

      // Phase 2c: rolling 3m trend context for Operating Profit.
      // Narrative combines absolute MoM £ change and absolute £ delta vs 3m trend.
      // Uses absolute £ only — % is misleading when both values are negative.
      // Threshold ±£2,000 neutral zone to avoid noise on a £60–90k loss figure.
      const npTrendLine: typeof card.trendLine =
        !phase2DeltasLoading && phase2Trends != null
          ? (() => {
              const avg        = phase2Trends.operating_profit_3m_avg;
              const trendDelta = npValue - avg;
              const sentiment: "positive" | "negative" | null =
                trendDelta >  2000 ? "positive"
                : trendDelta < -2000 ? "negative"
                : null;
              // Format £ as "£X.Xk" — always one decimal place for readability.
              const fmtK = (v: number) => {
                const k = Math.abs(v) / 1000;
                return `£${k.toFixed(1)}k`;
              };
              // Gate on op_profit_delta_pct being non-null — confirms prior period had data.
              const momAbsChange =
                phase2Deltas != null && phase2Deltas.op_profit_delta_pct !== null
                  ? phase2Deltas.op_profit_cur - phase2Deltas.op_profit_prv
                  : null;
              let text: string;
              if (momAbsChange !== null) {
                // trendDelta > 0 = current month is less of a loss than the rolling avg (good).
                const trendDir = trendDelta >= 0 ? "above" : "below";
                text = momAbsChange >= 0
                  ? `Profit improved by ${fmtK(momAbsChange)} this month and is ${fmtK(trendDelta)} ${trendDir} trend`
                  : `Profit worsened by ${fmtK(momAbsChange)} this month but is ${fmtK(trendDelta)} ${trendDir} trend`;
              } else {
                const trendDir = trendDelta >= 0 ? "above" : "below";
                text = `Profit is ${fmtK(trendDelta)} ${trendDir} trend`;
              }
              return { text, sentiment };
            })()
          : undefined;

      return {
        ...card,
        value:  formatOpProfit(npValue),
        status: opProfitStatus(npValue),
        // Phase 2: live op_profit_delta_pct; "—" when prior period has no data.
        // Note: op_profit can be negative in both current and prior — a % change on a
        // negative base value is valid (e.g. loss widened = negative delta %).
        change: !phase2DeltasLoading
          ? formatDeltaPct(phase2Deltas?.op_profit_delta_pct ?? null)
          : card.change,
        changeSentiment: !phase2DeltasLoading
          ? deltaToSentiment(phase2Deltas?.op_profit_delta_pct ?? null, DELTA_POLARITY.np)
          : undefined,
        trendLine: npTrendLine,
      };
    }

    // All other tiles — unchanged, still use commerceMetrics
    if (!metrics) return card;
    return card;
  });
  const hasFullActionPlan = canAccess("dashboard_full_action_plan");
  const hasDriverDetail = canAccess("dashboard_driver_detail");
  return (
    <AppLayout>

      {/* ══ PAGE HEADER ═══════════════════════════════════════════════════════ */}
      <div className="mb-5">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Weekly CFO Briefing</h1>
        <p className="text-muted-foreground mt-1 text-sm">What changed, what to do first, and where the money is hiding.</p>
        <DataPeriodLabel
          periodLabel={activePeriodLabel}
          loading={periodLoading}
          dateFrom={activeDateFrom}
          dateTo={activeDateTo}
        />
      </div>

      {/* ══ WEEKLY CFO BRIEFING ══════════════════════════════════════════════ */}
      <section className="bg-card rounded-2xl shadow-sm border border-amber-200/60 dark:border-amber-800/25 mb-8 overflow-hidden">
        <div className="px-6 py-7 border-b border-amber-100/80 dark:border-amber-900/25">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-11 h-11 rounded-full bg-amber-400 dark:bg-amber-500 shadow-md shadow-amber-400/30 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">This week's read</p>
                  <p className="text-xl font-black text-amber-700 dark:text-amber-400 tracking-tight">Healthy, but drifting</p>
                </div>
              </div>

              <div className="space-y-3 text-sm sm:text-base text-foreground/85 leading-relaxed max-w-4xl">
                <p>
                  Demand is still there, but the business is keeping less profit from each order. Fulfilment inflation, heavier discounting and rising Meta costs are absorbing more of the revenue before it turns into cash.
                </p>
                <p>
                  This week, focus on the leaks you can control: shipping economics, repeat-customer discounts and weak paid campaigns. The current opportunity is worth around <span className="font-bold text-emerald-700 dark:text-emerald-400">{rcHeadlineStr} per month</span> if the main fixes are acted on.
                </p>
              </div>
            </div>

            <div className="lg:w-80 rounded-xl border border-amber-200/50 dark:border-amber-800/25 bg-amber-50/60 dark:bg-amber-950/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2">Why it matters</p>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200 leading-snug">
                You generated roughly £9.4k less contribution than last month. If this keeps drifting, growth will feel busy but leave less cash behind.
              </p>
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/30 bg-secondary/15">
          {[
            { label: "Business health", value: "Profitability tightening", tone: "amber", text: "Still manageable, but the trend needs attention." },
            { label: "Do first", value: "Fix the leaks", tone: "primary", text: "Fulfilment, discounting and weak paid spend." },
            { label: "Money at stake", value: `${rcHeadlineStr}/month`, tone: "emerald", text: "Estimated upside tied to this week's actions." },
          ].map(({ label, value, tone, text }) => (
            <div key={label} className="px-6 py-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
              <p className={cn(
                "text-lg font-display font-bold mb-1",
                tone === "amber" ? "text-amber-700 dark:text-amber-400"
                : tone === "emerald" ? "text-emerald-700 dark:text-emerald-400"
                : "text-foreground"
              )}>
                {value}
              </p>
              <p className="text-xs text-muted-foreground leading-snug">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ THIS WEEK'S FOCUS ═══════════════════════════════════════════════ */}
      <section className="sc-purple rounded-2xl shadow-sm mb-7 overflow-hidden">
        <div className="sc-purple-header flex flex-col sm:flex-row sm:items-center gap-2.5 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-300 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">This week's focus</span>
          </div>
          <span className="text-xs text-indigo-300/60 sm:ml-auto">Do these first</span>
        </div>
        <div className="px-6 py-6">
          <div className="max-w-3xl mb-5">
            <p className="text-sm text-foreground/85 leading-relaxed">
              The fastest path is not more reporting. It is three practical controls that protect profit this week before the drift becomes normal.
            </p>
          </div>
          <div className="divide-y divide-indigo-800/35">
            {PRIORITY_ACTIONS.map((action, i) => {
              const actionCopy = [
                {
                  title: "Review courier mix and shipping thresholds",
                  reason: "Fulfilment is the biggest drag this month. Check courier rates, free-shipping thresholds and packaging cost per order.",
                },
                {
                  title: "Reduce over-discounting on repeat customers",
                  reason: "Returning customers already know the brand. Blanket discounts here are likely giving away profit you could keep.",
                },
                {
                  title: "Pause weak-performing Meta campaigns",
                  reason: "Meta is getting more expensive. Shift budget away from campaigns that are not producing profitable orders.",
                },
              ][i];
              const locked = !hasFullActionPlan;
              const freePrimary = i === 0;

              if (locked && !freePrimary) {
                return (
                  <div key={action.title} className="py-5 first:pt-0 last:pb-0">
                    <div className="grid lg:grid-cols-[9rem_1fr_12rem] gap-3 lg:gap-6 items-start">
                      <div>
                        <span className="inline-flex items-center rounded-full border border-indigo-300/15 bg-indigo-950/20 px-2.5 py-1 text-[11px] font-semibold text-indigo-200/60">
                          Identified
                        </span>
                      </div>
                      <div>
                        <p className="text-base font-semibold text-foreground mb-1.5 leading-snug">
                          Additional recovery opportunities identified
                        </p>
                        <p className="text-sm text-foreground/70 leading-relaxed">
                          Upgrade to see the full prioritised action plan and implementation detail.
                        </p>
                      </div>
                      <div className="lg:text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300/50 mb-1">Likely impact</p>
                        <p className="text-sm font-bold text-indigo-200/60">Available on Pro</p>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={action.title}
                  className={cn(
                    "relative overflow-hidden py-5 first:pt-0 last:pb-0",
                    locked && !freePrimary && "min-h-24"
                  )}
                >
                  <div className={cn("grid lg:grid-cols-[9rem_1fr_12rem] gap-3 lg:gap-6 items-start", locked && !freePrimary && "blur-[2px] opacity-50")}>
                    <div>
                      {hasFullActionPlan ? (
                        <>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300/60 mb-2">Priority {i + 1}</p>
                          <TimingBadge timing={action.timing} />
                        </>
                      ) : freePrimary ? (
                        <span className="inline-flex items-center rounded-full border border-indigo-300/25 bg-indigo-950/25 px-2.5 py-1 text-[11px] font-semibold text-indigo-200/80">
                          Identified
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-base font-semibold text-foreground mb-1.5 leading-snug">
                        {hasFullActionPlan ? actionCopy.title : "Highest-priority recovery opportunity identified"}
                      </p>
                      <p className="text-sm text-foreground/70 leading-relaxed">
                        {hasFullActionPlan
                          ? actionCopy.reason
                          : freePrimary
                            ? "A high-confidence profit recovery action has been identified. Upgrade to see the recommendation, implementation steps and owner-ready brief."
                            : "Unlock the full prioritised action plan to see this recommendation."}
                      </p>
                    </div>
                    <div className="lg:text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300/50 mb-1">Likely impact</p>
                      <p className="text-sm font-bold text-emerald-400">
                        {action.impact}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-6 pt-5 border-t border-indigo-800/35">
            <Link href={hasFullActionPlan ? "/profit-opportunities" : "/upgrade"} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
              {hasFullActionPlan ? "View full action plan" : "Unlock full prioritised action plan"}
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link href={hasFullActionPlan ? "/scenario-lab" : "/upgrade"} className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-300 hover:text-indigo-200 transition-colors">
              {hasFullActionPlan ? "Model the impact" : "Unlock scenario modelling"} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ══ MONEY YOU CAN WIN BACK ══════════════════════════════════════════ */}
      <section className="bg-card rounded-2xl shadow-sm border border-emerald-200/50 dark:border-emerald-800/25 mb-7 overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-3 bg-emerald-50/60 dark:bg-emerald-950/15 border-b border-emerald-200/40 dark:border-emerald-800/20">
          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Money you can win back</span>
        </div>
        <div className="px-6 py-5">
          <div className="flex flex-col lg:flex-row lg:items-start gap-5">
            <div className="flex-1">
              {/*
                Live value from opportunity_breakdown() RPC — recoverableLow / recoverableHigh
                are the summed impact_low / impact_high across all non-archived opportunity rows.
                Falls back to RECOVERABLE_LOW / RECOVERABLE_HIGH (business-snapshot.ts) while
                loading or if the RPC fails.  See oppBreakdown state and rcHeadlineStr derivation.
              */}
              <p className="text-3xl font-display font-black text-emerald-700 dark:text-emerald-400 mb-1">
                {rcHeadlineStr}
                <span className="text-base font-bold text-emerald-600/70 dark:text-emerald-500/70 ml-1">/ month</span>
              </p>
              <p className="text-sm text-foreground font-medium mb-2 max-w-2xl">
                This is the estimated monthly upside from fixing the main profit leaks already highlighted above.
              </p>
              <p className="text-xs text-muted-foreground mb-2.5 leading-snug max-w-2xl">
                Most of the recovery should be reachable within 30-60 days if the actions are followed through.
              </p>
              <ConfidenceBadge
                level="Medium-High"
                helper="Based on 90-day trading data, discount history and channel performance trends."
              />
            </div>

            <div className="lg:w-80">
              {/*
                DEV-ONLY — all four projection values below are hardcoded snapshot figures.
                Primary sources (Phase 2):
                  "+£42k" contribution  → recoverableHigh from recoverable_contribution_range() RPC
                  "+£64k" cash          → Xero cash balance improvement model (not yet built)
                  "+0.8 months" runway  → computed (cash improvement / monthly_fixed_costs)
                  "+4.2pp" margin       → target_cm_pct − current contribution_margin_pct() RPC
                Do not ship these literal values to production — they will not match real store data.
              */}
              <div className="space-y-3 mb-3.5">
                {[
                  { label: "Monthly profit upside", value: "+£42k" },
                  { label: "Likely cash improvement", value: "+£64k" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-baseline justify-between gap-4 border-t border-emerald-200/40 dark:border-emerald-800/20 pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/65 dark:text-emerald-400/65">{label}</p>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{value}</p>
                  </div>
                ))}
              </div>
              <Link href={hasFullActionPlan ? "/profit-opportunities" : "/upgrade"} className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors">
                {hasFullActionPlan ? "See the full breakdown" : "Unlock the full opportunity breakdown"}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══ WHAT CHANGED ═════════════════════════════════════════════════════ */}
      <section className="mb-7">
        <div className="mb-3">
          <h3 className="font-bold text-lg text-foreground">What changed</h3>
          <p className="text-sm text-muted-foreground mt-0.5">The movements behind the briefing, in plain English.</p>
        </div>
        <div className="divide-y divide-border/35 border-y border-border/35">
          {TOP_DRIVERS.slice(0, 3).map((driver) => {
            const trendLabel =
              driver.trend === "improving" ? "Improving"
              : driver.trend === "worsening" ? "Needs attention"
              : "Stable";
            const trendClasses =
              driver.trend === "improving" ? "text-emerald-600 dark:text-emerald-400"
              : driver.trend === "worsening" ? "text-amber-700 dark:text-amber-400"
              : "text-muted-foreground";
            const content = (
              <div className="grid sm:grid-cols-[8.5rem_1fr] gap-1.5 sm:gap-4 py-3">
                <p className={cn("text-[10px] font-bold uppercase tracking-wider", trendClasses)}>{trendLabel}</p>
                <div>
                  <p className="text-sm text-foreground leading-snug">{driver.text}</p>
                  {hasDriverDetail && driver.proDetail && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{driver.proDetail}</p>
                  )}
                </div>
              </div>
            );

            return driver.href ? (
              <Link key={driver.id} href={driver.href} className="block hover:bg-secondary/25 transition-colors">
                {content}
              </Link>
            ) : (
              <div key={driver.id}>{content}</div>
            );
          })}
        </div>
      </section>

      {/* ══ KPI GRID ═════════════════════════════════════════════════════════ */}
      {/* Three diagnostic rows: health → quality → efficiency               */}
      <section className="mb-8 rounded-2xl border border-border/40 bg-card/60 p-5 shadow-sm">
        <div className="mb-5">
          <h3 className="font-bold text-lg text-foreground">Key Numbers Behind The Briefing</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Supporting evidence for the story above. Use these when you want the detail.</p>
        </div>
        <div className="space-y-5">
        {([
          { label: "Profit and cash",       ids: ["ns","cm","rc","cr"], cols: "lg:grid-cols-4" },
          { label: "Sales quality",         ids: ["mr","aov","rpr","dd"], cols: "lg:grid-cols-4" },
          { label: "Marketing and leakage", ids: ["ae","rr","np"],       cols: "lg:grid-cols-3" },
        ] as { label: string; ids: string[]; cols: string }[]).map(({ label, ids, cols }) => {
          const row = ids.map(id => liveKpiCards.find(c => c.id === id)!);
          return (
            <div key={label}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-3">{label}</p>
              <div className={cn("grid grid-cols-2 gap-3", cols)}>
                {row.map(kpi => {
                  const safeDisplay = getSafeKpiDisplay(kpi);

                  return (
                    <div
                      key={kpi.id}
                      className={cn(
                        "bg-background/60 dark:bg-slate-950/35 rounded-xl p-4 border",
                        kpi.id === "rc"
                          ? "border-emerald-300/60 dark:border-emerald-700/50"
                          : "border-border/50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={`What ${kpi.title} means`}
                              className="mt-0.5 rounded-full text-muted-foreground/45 hover:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs bg-slate-950 text-white">
                            <p className="font-semibold mb-1">{KPI_EXPLANATIONS[kpi.id]?.means}</p>
                            <p className="text-white/75">{KPI_EXPLANATIONS[kpi.id]?.matters}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className={cn(
                        "font-display font-bold mb-2",
                        safeDisplay.unavailable
                          ? "text-sm text-muted-foreground"
                          : cn("text-xl", kpi.id === "rc" ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")
                      )}>
                        {safeDisplay.value}
                      </p>
                      {!safeDisplay.unavailable && (
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold mb-2",
                          // changeSentiment takes precedence when a live delta is available.
                          // undefined  → loading / unported tile → fall back to KpiStatus colour.
                          // null       → no prior-period data ("—") → muted.
                          kpi.changeSentiment === "positive" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                          : kpi.changeSentiment === "negative" ? "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
                          : kpi.changeSentiment === "neutral" || kpi.changeSentiment === null
                            ? "bg-secondary text-muted-foreground"
                          // undefined: fall back to overall tile health colour
                          : kpi.status === "positive" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                          : kpi.status === "warning"  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                          : kpi.status === "danger"   ? "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
                          : "bg-secondary text-muted-foreground"
                        )}>
                          {/* Icon driven by sentiment when available, otherwise by status */}
                          {kpi.changeSentiment === "positive" ? <ArrowUpRight  className="w-3 h-3" />
                          : kpi.changeSentiment === "negative" ? <ArrowDownRight className="w-3 h-3" />
                          : kpi.changeSentiment === "neutral"  ? <Minus          className="w-3 h-3" />
                          : kpi.changeSentiment === null        ? null
                          // undefined: status-based fallback
                          : kpi.status === "positive" ? <ArrowUpRight  className="w-3 h-3" />
                          : kpi.status === "danger"   ? <ArrowDownRight className="w-3 h-3" />
                          : kpi.status === "warning"  ? <Minus          className="w-3 h-3" />
                          : null}
                          {kpi.change}
                        </span>
                      )}
                      {/* Phase 2c — rolling 3m trend context (AOV and Net Profit only) */}
                      {kpi.trendLine != null && !safeDisplay.unavailable && (
                        <p className="text-xs text-muted-foreground mb-2">
                          {kpi.trendLine.text}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground/80 leading-snug border-t border-border/50 pt-2">{safeDisplay.unavailable ? "Available after the next successful data sync." : kpi.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        </div>
      </section>

      {/* ══ GO DEEPER ════════════════════════════════════════════════════════ */}
      <div className="mb-8">
        <div className="mb-5">
          <h3 className="font-bold text-lg text-foreground">Go deeper</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Open a focused view when you want to investigate one area in more detail.</p>
          <div className="h-px bg-border/40 mt-3" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
          {HEALTH_MODULES.map(mod => (
            <Link
              key={mod.id}
              href={hasFullActionPlan ? mod.href : "/upgrade"}
              className="border-t border-border/40 pt-4 transition-colors group block hover:border-primary/30"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{mod.title}</p>
              <p className="text-sm font-bold text-foreground mb-1.5 leading-snug">{hasFullActionPlan ? mod.headline : FREE_HEALTH_MODULE_HEADLINES[mod.id]}</p>
              <p className="text-xs text-muted-foreground leading-snug mb-4">{mod.subtitle}</p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
                {hasFullActionPlan ? mod.cta : FREE_HEALTH_MODULE_CTAS[mod.id]} <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>

      <DataBenchmarkAssumptions
        benchmarkNote="Dashboard insights combine sales, marketing, pricing, margin and cash data."
        dataQualityNote="Accuracy improves as source data mappings improve."
        className="mb-2"
      />

    </AppLayout>
  );
}
