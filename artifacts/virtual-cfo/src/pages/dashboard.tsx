import { getCommerceMetrics } from "@/lib/analytics/commerceMetrics";
import { getPhase1Metrics, type Phase1MetricsResponse } from "@/lib/analytics/phase1Metrics";
import { getPhase2aMetrics, type Phase2aMetricsResponse } from "@/lib/analytics/phase2aMetrics";
import { useEffect, useState } from "react";
import {
  ArrowUpRight, ArrowDownRight, Minus,
  Sparkles, TrendingUp, AlertTriangle, ArrowRight,
  ChevronRight, Lock,
} from "lucide-react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { TopDrivers, type Driver } from "@/components/TopDrivers";
import { canAccess } from "@/lib/plan";
import { DataBenchmarkAssumptions } from "@/components/DataBenchmarkAssumptions";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { TimingBadge } from "@/components/TimingBadge";
import { AiCfoAskCard } from "@/components/AiCfoAskCard";
import { AiCfoInlineButtons } from "@/components/AiCfoInlineButtons";
import { MONTHLY_CM_PCT, MONTHLY_REVENUE, MONTHLY_OPERATING_PROFIT, RECOVERABLE_LOW, RECOVERABLE_HIGH } from "@/lib/data/business-snapshot";
import { supabase } from "@/lib/supabase";
import { CASH_RUNWAY } from "@/lib/data/cash-snapshot";
import { DISCOUNT_DEP, REPEAT_RATE } from "@/lib/data/growth-metrics";

// ─── Data constants ───────────────────────────────────────────────────────────
// Live KPI overrides from Supabase-backed commerce metrics.
// Any KPI not listed here continues to use the mock snapshot value.

// ── Phase 1 metrics config ────────────────────────────────────────────────────
// DEV-ONLY — hardcoded seed store UUID.  Must be replaced with the
// authenticated session's store_id before any real merchant can use this page.
// Primary source: auth session → stores.id lookup.
// Not safe for production multi-tenant deployment.
const PHASE1_STORE_ID = "10000000-0000-0000-0000-000000000001";

// Date range: current calendar month (inclusive both ends).
// Recomputed once at module load; does not reactively update mid-session.
const _now            = new Date();
const _pad            = (n: number) => String(n).padStart(2, "0");
const PHASE1_DATE_FROM = `${_now.getFullYear()}-${_pad(_now.getMonth() + 1)}-01`;
const PHASE1_DATE_TO   = new Date(_now.getFullYear(), _now.getMonth() + 1, 0)
  .toISOString().slice(0, 10);

type KpiStatus = "warning" | "positive" | "danger" | "neutral";

const CFO_INSIGHT = {
  // Weekly action priorities — user-facing text only. Underlying upside values unchanged.
  weeklyPriorities: [
    {
      action: "Reduce discount leakage",
      // DEV-ONLY — "38%" is the DISCOUNT_DEP snapshot constant, not the live discountDependency
      // value from the Supabase discount_dependency() RPC.  Replace with an interpolated
      // live value once prior-period delta strings are computed in Phase 2.
      why: "Discount dependency is at 38% and rising, eroding contribution margin and weakening growth quality scores.",
      // DEV-ONLY FALLBACK — impact range uses RECOVERABLE_LOW/HIGH snapshot constants as
      // fallback until phase1Metrics resolves.  Will automatically reflect live RPC values
      // once the rc tile wiring propagates here; see rc wiring block in liveKpiCards.
      impact: `£${(RECOVERABLE_LOW / 1_000).toFixed(0)}k–£${(RECOVERABLE_HIGH / 1_000).toFixed(0)}k / month recoverable`,
    },
    {
      action: "Reallocate inefficient Meta spend",
      // DEV-ONLY — "14%" is a hardcoded snapshot figure.  Primary source: meta_cac_trend()
      // Supabase RPC (Phase 3, Meta Ads API integration).  Replace before production.
      why: "Meta CAC is up 14% while email and organic channels deliver significantly higher contribution margins.",
      impact: "Improves blended acquisition efficiency and reduces CAC payback period",
    },
    {
      action: "Address fulfilment cost leakage",
      why: "Variable costs are compressing contribution margin below target, reducing the value of each order shipped.",
      impact: "Largest single lever in the identified monthly opportunity",
    },
  ],
  upside: { cashLow: RECOVERABLE_LOW, cashHigh: RECOVERABLE_HIGH },
};

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

/** Status derived from sign of an operating profit value. */
function opProfitStatus(v: number): KpiStatus {
  if (v < 0) return "danger";
  if (v > 0) return "positive";
  return "neutral";
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
const KPI_CARDS: { id: string; title: string; value: string; change: string; status: KpiStatus; text: string }[] = [
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
    title: "Recoverable Contribution",
    value: RECOVERABLE_TILE_VALUE,
    change: RECOVERABLE_TILE_CHANGE,
    status: RECOVERABLE_LOW > 0 || RECOVERABLE_HIGH > 0 ? "positive" : "neutral",
    text: "Immediate margin recovery available from pricing, marketing and fulfilment improvements.",
  },
  {
    // DEV-ONLY — NO LIVE WIRING.  value and change are fully mock (Phase 1 only).
    // value:  CASH_RUNWAY = 3.4 from cash-snapshot.ts.
    //         Primary source: cash_runway_months() Supabase RPC (Phase 2, requires Xero
    //         cash balance + monthly fixed costs).  Do not ship to production without Xero.
    // change: "Moderate" is a static qualitative label.
    //         Replace with computed "±X.X months vs last month" once Xero is connected.
    id: "cr",   title: "Cash Runway",              value: `${CASH_RUNWAY} months`,        change: "Moderate",                            status: "warning",
    text: "Cash remains positive, but runway is tightening.",
  },
  {
    // value: Tier 3 loading sentinel (DISCOUNT_DEP snapshot = 38%) until liveKpiCards
    //        wiring block resolves discount_dependency() RPC (Tier 1) or
    //        commerceMetrics.discountRate (Tier 2 DEV-ONLY fallback).
    // change: DEV-ONLY static string — no prior-period discount_dependency() RPC yet.
    //         Replace with computed "±X% vs last month" in Phase 2.
    id: "dd",   title: "Discount Dependency",      value: `${DISCOUNT_DEP}%`,             change: "↑ 11% vs last month",                status: "danger",
    text: "High reliance on promotions to sustain growth.",
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
    text: "Meta CAC is rising faster than contribution per order.",
  },
  {
    // value: Tier 3 loading sentinel (REPEAT_RATE snapshot = 28%) until liveKpiCards
    //        wiring block resolves repeat_purchase_rate() RPC (Tier 1) or
    //        commerceMetrics.repeatPurchaseRate (Tier 2 DEV-ONLY fallback).
    // change: DEV-ONLY static string — no prior-period repeat_purchase_rate() RPC yet.
    //         Replace with computed "±X.X% vs last month" in Phase 2.
    id: "rpr",  title: "Repeat Purchase Rate",     value: `${REPEAT_RATE}%`,              change: "↑ 4.2% vs last month",               status: "positive",
    text: "Retention is strengthening as more customers place second orders.",
  },
  {
    // value: Tier 3 loading sentinel (MONTHLY_REVENUE snapshot = £124,500) until
    //        liveKpiCards wiring block resolves gross_revenue() RPC (Tier 1) or
    //        commerceMetrics.totalRevenue (Tier 2 DEV-ONLY fallback).
    // change: DEV-ONLY static string — no prior-period gross_revenue() RPC yet.
    //         Replace with computed "±X.X% vs last month" in Phase 2.
    id: "mr",   title: "Monthly Revenue",          value: `£${MONTHLY_REVENUE.toLocaleString("en-GB")}`, change: "↑ 12.4% vs last month", status: "positive",
    text: "Revenue is growing, but margin quality is weakening.",
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
    text: "Operating profit after fixed overheads.",
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
    text: "Average revenue generated per order.",
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
    text: "Share of gross sales refunded to customers.",
  },
];

const TOP_DRIVERS: Driver[] = [
  {
    id: "1",
    text: "Margin down due to increased shipping and fulfilment costs",
    proDetail: "Fulfilment cost rose 12% per order. Estimated contribution impact: –£3.2k vs prior period.",
    trend: "worsening",
    href: "/margin-analysis",
  },
  {
    id: "2",
    text: "Repeat purchase rate improving month-on-month",
    trend: "improving",
    href: "/growth-quality",
  },
  {
    id: "3",
    text: "Ad spend efficiency declining — higher CAC with lower ROAS",
    proDetail: "Meta CAC up 14% MoM — now £28 per customer vs £24. ROAS fell from 3.1x to 2.7x.",
    trend: "worsening",
    href: "/marketing-efficiency",
  },
  {
    id: "4",
    text: "Discount usage rising faster than revenue growth",
    proDetail: "Discount-attached orders grew 8%; total revenue grew 5.2%. Estimated margin drag: –£4.2k per month.",
    trend: "worsening",
    href: "/margin-analysis",
  },
  {
    id: "5",
    text: "Average order value holding steady",
    trend: "neutral",
  },
];

const PRIORITY_ACTIONS = [
  {
    title:  "Reduce fulfilment cost leakage",
    impact: "+£6.8k contribution",
    reason: "Fulfilment and shipping costs are the largest margin drag this month.",
    badge:  "High impact",
    color:  "red",
    timing: "2–4 weeks" as const,
  },
  {
    title:  "Tighten discount exposure",
    impact: "+£4.2k contribution",
    reason: "Discount usage is rising faster than revenue growth.",
    badge:  "High impact",
    color:  "red",
    timing: "Immediate" as const,
  },
  {
    title:  "Reallocate inefficient Meta spend",
    impact: "+£3.1k contribution",
    reason: "Meta CAC has increased while ROAS has weakened.",
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
    subtitle: "See where contribution margin is being eroded and how to recover it.",
    cta:      "Analyse margin",
    href:     "/margin-analysis",
  },
  {
    id:       "pricing",
    title:    "Pricing Optimisation",
    headline: "£52k recoverable contribution",
    subtitle: "Identify discount leakage and pricing opportunities.",
    cta:      "Improve pricing",
    href:     "/pricing-optimisation",
  },
  {
    id:       "growth",
    title:    "Growth Quality",
    headline: "38% discount dependency",
    subtitle: "Understand whether growth is healthy or reliant on promotions and paid spend.",
    cta:      "Analyse growth",
    href:     "/growth-quality",
  },
  {
    id:       "acquisition",
    title:    "Marketing / Acquisition Efficiency",
    headline: "Meta CAC +14%",
    subtitle: "Diagnose which channels are creating profitable customers.",
    cta:      "Diagnose acquisition",
    href:     "/marketing-efficiency",
  },
  {
    id:       "cash",
    title:    "Cash Control",
    headline: "£64k cash headroom opportunity",
    subtitle: "See where cash is trapped, how much runway you have, and what actions protect liquidity.",
    cta:      "Review cash position",
    href:     "/cash-control",
  },
  {
    id:       "scenario",
    title:    "Scenario Lab / Opportunities",
    headline: "£18k–£42k contribution upside",
    subtitle: "See the highest-impact improvement actions and model the combined impact.",
    cta:      "Model opportunity",
    href:     "/scenario-lab",
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [metrics, setMetrics] = useState<any>(null);

  // ── Phase 1 metrics: Net Sales tile (METRIC.NET_SALES / tile id "ns") ────────
  // Fetches the canonical net_sales() Supabase function result for the current
  // calendar month.  Loaded independently of the main commerceMetrics query so
  // that a failure in either source does not block the other.
  const [phase1Metrics, setPhase1Metrics] = useState<Phase1MetricsResponse | null>(null);

  useEffect(() => {
    getCommerceMetrics().then(setMetrics);
  }, []);

  useEffect(() => {
    getPhase1Metrics(PHASE1_STORE_ID, PHASE1_DATE_FROM, PHASE1_DATE_TO)
      .then(setPhase1Metrics)
      .catch(() => {
        // Network or RPC error: leave phase1Metrics null so the tile falls
        // back to the commerceMetrics value rather than breaking.
      });
  }, []);

  // ── Phase 2a metrics: Cash Runway tile (METRIC.CASH_RUNWAY_MONTHS / tile id "cr") ──
  // Fetches cash_runway_months() and operating_profit_monthly() independently of
  // Phase 1.  A failure here leaves phase2aMetrics null and the affected tiles fall
  // back to their snapshot constants.  Phase 1 tiles are completely unaffected.
  const [phase2aMetrics, setPhase2aMetrics] = useState<Phase2aMetricsResponse | null>(null);

  useEffect(() => {
    getPhase2aMetrics(PHASE1_STORE_ID, PHASE1_DATE_FROM, PHASE1_DATE_TO)
      .then(setPhase2aMetrics)
      .catch(() => {
        // Network or RPC error: leave phase2aMetrics null so affected tiles
        // fall back to their snapshot constants rather than breaking.
      });
  }, []);

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
        value: `£${Math.round(nsValue).toLocaleString("en-GB")}`,
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
        phase1Metrics !== null && !phase1Metrics.errors.some(e => e.fn === "gross_revenue")
          ? phase1Metrics.data.grossRevenue   // canonical — phase1 SQL function
          : metrics?.totalRevenue;             // DEV-ONLY fallback — commerceMetrics all-time, no date filter
      if (mrValue == null) return card;        // static fallback while both loading
      return {
        ...card,
        value: `£${Math.round(mrValue).toLocaleString("en-GB")}`,
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
        phase1Metrics !== null && !phase1Metrics.errors.some(e => e.fn === "average_order_value")
          ? phase1Metrics.data.averageOrderValue   // canonical — phase1 SQL function
          : metrics?.averageOrderValue;             // DEV-ONLY fallback — commerceMetrics all-time; formula differs (see data dict §A.6)
      if (aovValue == null) return card;            // static fallback while both loading
      return {
        ...card,
        value: `£${aovValue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
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
        value: `${Math.round(rrValue * 100)}%`,
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
        value: `${Math.round(ddValue * 100)}%`,
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
        value: `${Math.round(rprValue * 100)}%`,
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
        value: `${Math.round(cmValue * 100)}%`,
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

      return {
        ...card,
        value:  formatOpProfit(npValue),
        status: opProfitStatus(npValue),
        // change: intentionally empty — no prior-period operating_profit_monthly() delta yet (Phase 2).
        change: "",
      };
    }

    // All other tiles — unchanged, still use commerceMetrics
    if (!metrics) return card;
    return card;
  });
  const isPro           = canAccess("dashboard_recovery_upside");
  const hasDriverDetail = canAccess("dashboard_driver_detail");
  return (
    <AppLayout>

      {/* ══ PAGE HEADER ═══════════════════════════════════════════════════════ */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Business Control Centre</h1>
        <p className="text-muted-foreground mt-1 text-sm">See what is happening, how much profit and cash is at risk, and where to act first.</p>
      </div>

      {/* ══ BUSINESS HEALTH VERDICT HERO ════════════════════════════════════ */}
      <div className="bg-card rounded-2xl shadow-sm border border-amber-200/70 dark:border-amber-800/30 mb-5 overflow-hidden">
        {/* Overall verdict row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 pt-5 pb-4 border-b border-amber-100 dark:border-amber-900/30">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center justify-center w-11 h-11 rounded-full bg-amber-400 dark:bg-amber-500 shadow-md shadow-amber-400/30 shrink-0">
              <span className="text-white font-black text-sm">!</span>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Overall Business Health</p>
              <p className="text-xl font-black text-amber-700 dark:text-amber-400 tracking-tight">AMBER — Moderate Risk</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed sm:max-w-sm">
            The business is profitable, but margin quality, acquisition efficiency and cash runway are weakening.
          </p>
        </div>

        {/* Inline £9.4k context strip */}
        <div className="flex items-start gap-2.5 px-6 py-3 bg-amber-50/70 dark:bg-amber-950/15 border-b border-amber-100 dark:border-amber-900/20">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300 leading-relaxed">
            This month's performance reduced contribution by approximately £9.4k vs last month, driven by fulfilment cost inflation, Meta CAC deterioration and increased discounting.
          </p>
        </div>

        {/* Free-only upgrade hint */}
        {!isPro && (
          <div className="px-6 py-2.5 bg-amber-50/40 dark:bg-amber-950/10 border-b border-amber-100/60 dark:border-amber-900/15">
            <p className="text-xs text-amber-700/70 dark:text-amber-400/60 leading-relaxed">
              We've identified {rcHeadlineStr} monthly improvement potential. Unlock the full recovery roadmap below.
            </p>
          </div>
        )}

        {/* Traffic-light scorecard */}
        <div className="px-6 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-5">
            {[
              { area: "Profitability",          label: "Healthy",               text: "Profit remains positive.",                         style: "green" },
              { area: "Margin Quality",          label: "Weakening",             text: "Contribution margin is below target and falling.",  style: "amber" },
              { area: "Cash Runway",             label: "Runway tightening",     text: "Cash remains positive, but runway is tightening.",  style: "amber" },
              { area: "Acquisition Efficiency",  label: "At risk",               text: "Meta CAC is rising and ROAS is weakening.",         style: "red"   },
              { area: "Retention",               label: "Retention strengthening", text: "Repeat purchase rate is improving.",              style: "green" },
            ].map(({ area, label, text, style }) => (
              <div key={area} className={cn(
                "rounded-xl p-3 border flex flex-col gap-1.5",
                style === "green" ? "bg-emerald-50 dark:bg-emerald-950/15 border-emerald-200/60 dark:border-emerald-800/30"
                : style === "amber" ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-700/30"
                : "bg-rose-50 dark:bg-rose-950/15 border-rose-200/60 dark:border-rose-700/30"
              )}>
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    style === "green" ? "bg-emerald-500"
                    : style === "amber" ? "bg-amber-400"
                    : "bg-rose-500"
                  )} />
                  <span className={cn(
                    "text-[11px] font-bold",
                    style === "green" ? "text-emerald-700 dark:text-emerald-400"
                    : style === "amber" ? "text-amber-700 dark:text-amber-400"
                    : "text-rose-700 dark:text-rose-400"
                  )}>{label}</span>
                </div>
                <p className="text-[10px] font-semibold text-muted-foreground">{area}</p>
                <p className="text-[10px] text-muted-foreground/70 leading-tight">{text}</p>
              </div>
            ))}
          </div>

          {/* Health position bar */}
          <div className="flex items-center gap-0 rounded-xl overflow-hidden border border-border/40">
            {[
              { pos: "Strong",        active: false, done: true  },
              { pos: "Stable",        active: false, done: true  },
              { pos: "Moderate Risk", active: true,  done: false },
              { pos: "High Risk",     active: false, done: false },
              { pos: "Critical",      active: false, done: false },
            ].map(({ pos, active, done }) => (
              <div key={pos} className={cn(
                "flex-1 text-center py-2 text-[10px] font-bold border-r border-border/30 last:border-0 transition-colors",
                active  ? "bg-amber-400 dark:bg-amber-500 text-white"
                : done  ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-500"
                : "bg-secondary/40 text-muted-foreground/50"
              )}>
                {pos}
              </div>
            ))}
          </div>

          {/* AI CFO inline actions */}
          <div className="mt-4 pt-3 border-t border-border/30 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Ask your AI CFO:</span>
            <AiCfoInlineButtons pageId="dashboard" />
          </div>
        </div>
      </div>

      <AiCfoAskCard pageId="dashboard" />

      {/* ══ RECOVERABLE CONTRIBUTION OPPORTUNITY ════════════════════════════ */}
      <div className="bg-card rounded-2xl shadow-sm border border-emerald-200/70 dark:border-emerald-800/40 mb-5 overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-3 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200/60 dark:border-emerald-800/30">
          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            {isPro ? "Recoverable contribution available immediately" : "Recoverable contribution identified"}
          </span>
        </div>
        <div className="px-6 py-5">
          {isPro ? (
            /* ── Pro layout ─────────────────────────────────────────────────── */
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex-1">
                {/*
                  Live value from opportunity_breakdown() RPC — recoverableLow / recoverableHigh
                  are the summed impact_low / impact_high across all non-archived opportunity rows.
                  Falls back to RECOVERABLE_LOW / RECOVERABLE_HIGH (business-snapshot.ts) while
                  loading or if the RPC fails.  See oppBreakdown state and rcHeadlineStr derivation.
                */}
                <p className="text-4xl font-display font-black text-emerald-700 dark:text-emerald-400 mb-1">
                  {rcHeadlineStr}
                  <span className="text-lg font-bold text-emerald-600/70 dark:text-emerald-500/70 ml-1">/ month</span>
                </p>
                <p className="text-sm text-foreground font-medium mb-1">
                  The data has identified a recoverable contribution opportunity in your current margin, marketing and fulfilment performance.
                </p>
                <p className="text-xs text-muted-foreground mb-3 leading-snug">Most recoverable within 30–60 days.</p>
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  {/*
                    DEV-ONLY — "£12k within 30 days" and "£30k within 90 days" are
                    hardcoded horizon sub-ranges from the opportunity-engine snapshot.
                    Replace with computed values once the opportunities table tracks a
                    horizon or deadline field per opportunity row.
                  */}
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-700/30">
                    £12k within 30 days
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-500 border border-emerald-200/40 dark:border-emerald-800/30">
                    £30k within 90 days
                  </span>
                </div>
                <ConfidenceBadge
                  level="Medium-High"
                  helper="Based on 90-day trading data, discount history and channel performance trends."
                />
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <AiCfoInlineButtons pageId="dashboard" />
                </div>
              </div>
              <div className="shrink-0 sm:pt-2">
                <Link href="/profit-opportunities" className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors">
                  See action plan <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            /* ── Free layout: show headline value, gate the detail ─────────── */
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex-1">
                {/*
                  Live value from opportunity_breakdown() RPC — same rcHeadlineStr as Pro layout.
                  Falls back to RECOVERABLE_LOW / RECOVERABLE_HIGH (business-snapshot.ts) while
                  loading or if the RPC fails.  See oppBreakdown state and rcHeadlineStr derivation.
                */}
                <p className="text-4xl font-display font-black text-emerald-700 dark:text-emerald-400 mb-1">
                  {rcHeadlineStr}
                  <span className="text-lg font-bold text-emerald-600/70 dark:text-emerald-500/70 ml-1">/ month</span>
                </p>
                <p className="text-sm text-foreground font-medium mb-1">
                  The data has identified a recoverable contribution opportunity in your current margin, marketing and fulfilment performance.
                </p>
                <p className="text-xs text-muted-foreground mb-3 leading-snug">Most recoverable within 30–60 days.</p>
                <div className="flex items-center gap-3 flex-wrap mb-4">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-secondary text-muted-foreground/40 border border-border/40 blur-[2px] select-none pointer-events-none">
                    <Lock className="w-3 h-3" /> £12k within 30 days
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-secondary text-muted-foreground/40 border border-border/40 blur-[2px] select-none pointer-events-none">
                    <Lock className="w-3 h-3" /> £30k within 90 days
                  </span>
                </div>
                <div className="mb-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Opportunity sources identified</p>
                  <ul className="space-y-1.5">
                    {[
                      "Fulfilment cost optimisation",
                      "Discount discipline improvements",
                      "Channel reallocation potential",
                      "Pricing leakage recovery",
                    ].map(src => (
                      <li key={src} className="flex items-center gap-2 text-xs text-muted-foreground/50 select-none">
                        <Lock className="w-3 h-3 shrink-0 text-muted-foreground/30" />
                        <span className="blur-[2px]">{src}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="shrink-0 sm:pt-2">
                <a href="/upgrade" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
                  <Lock className="w-3.5 h-3.5" /> Unlock the full opportunity breakdown
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ WHAT TO FOCUS ON THIS WEEK ══════════════════════════════════════ */}
      <div className="sc-purple rounded-2xl shadow-sm mb-5 overflow-hidden">
        <div className="sc-purple-header flex items-center gap-2.5 px-6 py-3.5">
          <Sparkles className="w-4 h-4 text-indigo-300 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">What to focus on this week</span>
        </div>
        <div className="px-6 py-5">
          {isPro ? (
            <div className="space-y-4">
              <p className="text-xs text-indigo-300/70 leading-snug mb-1">
                These are the key drivers behind the {rcHeadlineStr} opportunity identified above. Address them in order for the fastest contribution recovery.
              </p>
              {CFO_INSIGHT.weeklyPriorities.map((priority, i) => (
                <div
                  key={i}
                  className="grid sm:grid-cols-[1fr_1.5fr_1fr] gap-x-6 gap-y-1.5 border-b border-indigo-800/30 last:border-0 pb-4 last:pb-0"
                >
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400/60 mb-1">Action</p>
                    <p className="text-sm font-semibold text-foreground leading-snug">{priority.action}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400/60 mb-1">Why it matters</p>
                    <p className="text-sm text-foreground/80 leading-snug">{priority.why}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400/60 mb-1">Estimated impact</p>
                    <p className="text-sm font-medium text-emerald-400 leading-snug">{priority.impact}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-foreground leading-relaxed mb-3">
                Your three highest-impact actions for this week have been identified.
              </p>
              <a href="/upgrade" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
                <Lock className="w-3.5 h-3.5" /> Unlock this week's action plan <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ══ EXPECTED IMPACT IF IMPLEMENTED ══════════════════════════════════ */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 mb-8 overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-3.5 bg-secondary/60 border-b border-border/40">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Expected impact if implemented</span>
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
            <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary text-muted-foreground border border-border/50">
              Expected within 60–90 days
            </span>
            <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary text-muted-foreground border border-border/50">
              Confidence: Medium-High
            </span>
            <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-700/40">
              Balanced Growth Plan
            </span>
          </div>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-foreground leading-relaxed mb-5">
            If the recommended priorities are implemented, the model indicates a 60–90 day improvement across contribution, cash and margin.
          </p>
          {/*
            DEV-ONLY — all four projection values below are hardcoded snapshot figures.
            Primary sources (Phase 2):
              "+£42k" contribution  → recoverableHigh from recoverable_contribution_range() RPC
              "+£64k" cash          → Xero cash balance improvement model (not yet built)
              "+0.8 months" runway  → computed (cash improvement / monthly_fixed_costs)
              "+4.2pp" margin       → target_cm_pct − current contribution_margin_pct() RPC
            Do not ship these literal values to production — they will not match real store data.
          */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Contribution / month", value: "+£42k",       color: "emerald" },
              { label: "Cash improvement",     value: "+£64k",       color: "emerald" },
              { label: "Runway extension",     value: "+0.8 months", color: "emerald" },
              { label: "Margin improvement",   value: "+4.2pp",      color: "emerald" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-secondary/40 rounded-xl p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                <p className={cn("text-base font-bold", color === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-primary")}>
                  {value}
                </p>
              </div>
            ))}
          </div>
          <Link href="/scenario-lab" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
            Model this plan <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* ══ KPI GRID ═════════════════════════════════════════════════════════ */}
      {/* Three diagnostic rows: health → quality → efficiency               */}
      <div className="mb-8 space-y-6">
        {([
          { label: "Business health summary",            ids: ["ns","cm","rc","cr"], cols: "lg:grid-cols-4" },
          { label: "Revenue quality diagnostics",         ids: ["mr","aov","rpr","dd"], cols: "lg:grid-cols-4" },
          { label: "Efficiency and profit leakage",       ids: ["ae","rr","np"],       cols: "lg:grid-cols-3" },
        ] as { label: string; ids: string[]; cols: string }[]).map(({ label, ids, cols }) => {
          const row = ids.map(id => liveKpiCards.find(c => c.id === id)!);
          return (
            <div key={label}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-3">{label}</p>
              <div className={cn("grid grid-cols-2 gap-4", cols)}>
                {row.map(kpi => (
                  <div
                    key={kpi.id}
                    className={cn(
                      "bg-card rounded-2xl p-5 shadow-sm border",
                      kpi.id === "rc"
                        ? "border-emerald-300/60 dark:border-emerald-700/50"
                        : "border-border/50"
                    )}
                  >
                    <p className="text-sm font-medium text-muted-foreground mb-1">{kpi.title}</p>
                    <p className={cn(
                      "text-2xl font-display font-bold mb-2",
                      kpi.id === "rc" ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
                    )}>
                      {kpi.value}
                    </p>
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold mb-2",
                      kpi.status === "positive" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                      : kpi.status === "warning"  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                      : kpi.status === "danger"   ? "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
                      : "bg-secondary text-muted-foreground"
                    )}>
                      {kpi.status === "positive" && <ArrowUpRight className="w-3 h-3" />}
                      {kpi.status === "danger"   && <ArrowDownRight className="w-3 h-3" />}
                      {kpi.status === "warning"  && <Minus className="w-3 h-3" />}
                      {kpi.change}
                    </span>
                    <p className="text-xs text-muted-foreground/80 leading-snug border-t border-border/50 pt-2">{kpi.text}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ══ PRIORITY ACTIONS THIS MONTH ══════════════════════════════════════ */}
      <div className="mb-8">
        <div className="mb-5">
          <h3 className="font-bold text-xl text-foreground">Priority actions this month</h3>
          <p className="text-sm text-muted-foreground mt-0.5">The highest-impact actions your CFO would focus on first.</p>
          <div className="h-px bg-border/60 mt-3" />
        </div>

        {isPro ? (
          /* ── Pro: all 3 actions, fully unlocked ─────────────────────────── */
          <>
            <div className="grid sm:grid-cols-3 gap-4 mb-4">
              {PRIORITY_ACTIONS.map(action => (
                <div key={action.title} className={cn(
                  "bg-card rounded-2xl p-5 shadow-sm border",
                  action.color === "red"    ? "border-rose-200/60 dark:border-rose-800/30"
                  : action.color === "orange" ? "border-orange-200/60 dark:border-orange-800/30"
                  : "border-border/50"
                )}>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={cn(
                      "text-[11px] font-bold px-2.5 py-1 rounded-full",
                      action.color === "red"    ? "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
                      : action.color === "orange" ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                      : "bg-secondary text-muted-foreground"
                    )}>
                      {action.badge}
                    </span>
                    <TimingBadge timing={action.timing} />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1.5 leading-snug">{action.title}</p>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2">{action.impact}</p>
                  <p className="text-xs text-muted-foreground leading-snug mb-4">{action.reason}</p>
                  <div className="flex items-center gap-3 pt-3 border-t border-border/40">
                    <Link href="/scenario-lab" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                      Model impact <ArrowRight className="w-3 h-3" />
                    </Link>
                    <span className="inline-flex items-center text-xs font-medium text-muted-foreground/50 cursor-default select-none border border-border/40 rounded-md px-2 py-0.5">
                      Mark as done
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/profit-opportunities" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
              View full action plan <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        ) : (
          /* ── Free: action 1 visible, actions 2+3 locked ─────────────────── */
          <>
            <div className="grid sm:grid-cols-3 gap-4 mb-4">
              {/* Action 1 — fully visible */}
              {(() => {
                const action = PRIORITY_ACTIONS[0];
                return (
                  <div className="bg-card rounded-2xl p-5 shadow-sm border border-rose-200/60 dark:border-rose-800/30">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400">
                        {action.badge}
                      </span>
                      <TimingBadge timing={action.timing} />
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1.5 leading-snug">{action.title}</p>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2">{action.impact}</p>
                    <p className="text-xs text-muted-foreground leading-snug mb-4">{action.reason}</p>
                    <div className="flex items-center gap-3 pt-3 border-t border-border/40">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary/50 cursor-default select-none">
                        Model impact <ArrowRight className="w-3 h-3" />
                      </span>
                      <span className="inline-flex items-center text-xs font-medium text-muted-foreground/50 cursor-default select-none border border-border/40 rounded-md px-2 py-0.5">
                        Mark as done
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Actions 2 & 3 — blurred/locked */}
              {PRIORITY_ACTIONS.slice(1).map(action => (
                <div key={action.title} className={cn(
                  "bg-card rounded-2xl p-5 shadow-sm border relative select-none pointer-events-none",
                  action.color === "red"    ? "border-rose-200/30 dark:border-rose-800/15"
                  : "border-orange-200/30 dark:border-orange-800/15"
                )}>
                  <div className="absolute inset-0 rounded-2xl bg-card/60 backdrop-blur-[3px] z-10 flex items-center justify-center">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/80 border border-border/50">
                      <Lock className="w-3 h-3 text-muted-foreground/60" />
                      <span className="text-[11px] font-semibold text-muted-foreground/60">Pro only</span>
                    </div>
                  </div>
                  <div className="blur-[3px] opacity-50">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={cn(
                        "text-[11px] font-bold px-2.5 py-1 rounded-full",
                        action.color === "red"    ? "bg-rose-100 text-rose-700"
                        : "bg-orange-100 text-orange-600"
                      )}>
                        {action.badge}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1.5 leading-snug">{action.title}</p>
                    <p className="text-xs font-bold text-emerald-600 mb-2">{action.impact}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{action.reason}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="text-sm text-muted-foreground">
                2 more priority actions available on Pro.
              </p>
              <a href="/upgrade" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors whitespace-nowrap">
                <Lock className="w-3.5 h-3.5" /> Unlock full prioritised action plan <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </>
        )}
      </div>

      {/* ══ WHAT CHANGED AND WHY IT MATTERS ══════════════════════════════════ */}
      <TopDrivers
        drivers={TOP_DRIVERS}
        isPro={hasDriverDetail}
        title="What changed and why it matters"
        subtitle="The biggest movements behind this month's financial performance."
      />

      {/* ══ FREE UPGRADE PROMPT ═══════════════════════════════════════════════ */}
      {!isPro && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-5 rounded-2xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/80 dark:bg-indigo-950/30 mb-8">
          <div className="flex-1">
            <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200 mb-1">Upgrade to Pro to unlock the full CFO action plan</p>
            <p className="text-xs text-indigo-700/80 dark:text-indigo-400/80 leading-snug">
              Unlock scenario modelling, detailed opportunity breakdown, quantified action impact and monthly CFO report.
            </p>
          </div>
          <a href="/upgrade" className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors shadow-md shadow-indigo-500/20">
            Upgrade to Pro <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* ══ EXPLORE THE DETAILED ENGINES ═════════════════════════════════════ */}
      <div className="mb-8">
        <div className="mb-5">
          <h3 className="font-bold text-xl text-foreground">Explore the detailed engines</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Go deeper on the areas driving profit, cash and growth quality.</p>
          <div className="h-px bg-border/60 mt-3" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {HEALTH_MODULES.map(mod => (
            <Link
              key={mod.id}
              href={mod.href}
              className="bg-card rounded-2xl p-5 border border-border/50 hover:border-primary/30 hover:shadow-md transition-all group block"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{mod.title}</p>
              <p className="text-base font-bold text-foreground mb-1.5 leading-snug">{mod.headline}</p>
              <p className="text-xs text-muted-foreground leading-snug mb-4">{mod.subtitle}</p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
                {mod.cta} <ArrowRight className="w-3.5 h-3.5" />
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
