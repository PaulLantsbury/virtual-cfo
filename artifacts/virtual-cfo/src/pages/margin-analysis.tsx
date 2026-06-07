import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, TrendingUp, Info, Sparkles, AlertTriangle, ChevronDown, Lock, SlidersHorizontal, Shield, Zap } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { PremiumBlurPreview } from "@/components/PremiumBlurPreview";
import { canAccess } from "@/lib/plan";
import { cn } from "@/lib/utils";
import { useTimeline } from "@/lib/timeline";
import { TimelineSelector } from "@/components/TimelineSelector";
import { DataBenchmarkAssumptions } from "@/components/DataBenchmarkAssumptions";
import { AiCfoAskCard } from "@/components/AiCfoAskCard";
import { PeriodImpact } from "@/components/PeriodImpact";
import { MONTHLY_CM_PCT } from "@/lib/data/business-snapshot";
import { CAC_PAYBACK, CAC_PAYBACK_PREV } from "@/lib/data/growth-metrics";
import { CHANNEL_CM_PCT } from "@/lib/data/channel-metrics";
import { useLatestDataPeriod } from "@/lib/analytics/useLatestDataPeriod";
import { DataPeriodLabel } from "@/components/DataPeriodLabel";
import { usePhase2Deltas } from "@/lib/analytics/usePhase2Deltas";
import { deltaToSentiment, DELTA_POLARITY } from "@/lib/analytics/deltaSentiment";

// ── Phase 1 metrics config ────────────────────────────────────────────────────
// DEV-ONLY — hardcoded seed store UUID. Matches dashboard.tsx.
// Must be replaced with the authenticated session's store_id before multi-tenant use.
// Date range is resolved dynamically by useLatestDataPeriod() inside the component.
const MA_STORE_ID = "10000000-0000-0000-0000-000000000001";

const TREND_DATA = [
  { month: "Mar '25", margin: 48.2, highlighted: true  },
  { month: "Apr",     margin: 47.8                     },
  { month: "May",     margin: 48.0                     },
  { month: "Jun",     margin: 47.5                     },
  { month: "Jul",     margin: 48.1                     },
  { month: "Aug",     margin: 47.9                     },
  { month: "Sep",     margin: 47.4                     },
  { month: "Oct",     margin: 47.1                     },
  { month: "Nov",     margin: 46.3                     },
  { month: "Dec",     margin: 45.8                     },
  { month: "Jan",     margin: 44.9                     },
  { month: "Feb",     margin: 43.7                     },
  { month: "Mar '26", margin: 42.3, highlighted: true  },
];

// CM_VALUE, CM_PCT, CM_CHANGE — moved inside component; computed from Phase 1 RPC
// with fallback to static snapshot values. See MarginAnalysis() component body.
const CM_PREV = 45.8; // prior-month snapshot — no live prior-period RPC yet

// CAC_PAYBACK and CAC_PAYBACK_PREV imported from growth-metrics (1.4, 1.1)

const BENCHMARK_TARGET = { low: 45, high: 55 };

const BRIDGE_ROWS: Array<{ label: string; total: number; perOrder: number; type: "revenue" | "deduction"; trend: "stable" | "worsening" | "improving" }> = [
  { label: "Revenue",          total: 124500, perOrder: 68.40, type: "revenue",   trend: "stable"    },
  { label: "Discounts",        total:  -8715, perOrder: -8.10, type: "deduction", trend: "worsening" },
  { label: "Payment fees",     total:  -2490, perOrder: -1.90, type: "deduction", trend: "stable"    },
  { label: "Shipping costs",   total: -15562, perOrder: -4.80, type: "deduction", trend: "worsening" },
  { label: "Fulfilment costs", total: -17430, perOrder: -6.40, type: "deduction", trend: "stable"    },
  { label: "Marketing spend",  total: -27390, perOrder:-12.20, type: "deduction", trend: "worsening" },
];

// ─── KPI metrics & variance data ─────────────────────────────────────────────
// @dynamic All values replace with live-computed deltas (current − period_value)

// CONTRIBUTION_PER_ORDER — moved inside component; derived from live CM_VALUE / order count.
// Prior-period variants remain static (no live prior-period RPCs exist yet).
const CONTRIBUTION_PER_ORDER_PREV_M  = 38.20;  // last month — static snapshot
const CONTRIBUTION_PER_ORDER_LY      = 40.50;  // same month last year — static snapshot

/**
 * Trailing 12-month average CM% — derived from TREND_DATA as a static fallback.
 * Used only when the trailing_12m_cm_avg() Supabase RPC is unavailable (loading,
 * network failure, or no live months in the DB window).  When the RPC resolves
 * successfully the live value replaces this.  Not used as a primary data source.
 */
const CM_12M_AVG_FALLBACK = +(
  TREND_DATA.slice(0, -1).reduce((sum, d) => sum + d.margin, 0) /
  (TREND_DATA.length - 1)
).toFixed(1);

/** Contribution Profit — prior periods (estimated from historical CM × revenue) */
const CM_VALUE_PREV_M = 57_125;  // 45.8% of prior month revenue — static snapshot
const CM_VALUE_LY     = 56_972;  // 48.2% of last-year revenue — static snapshot

/** CAC Payback — year-ago baseline */
const CAC_PAYBACK_LY = 0.9;

// AVG_DISCOUNT_PCT — moved inside component; live from discount_dependency() RPC × 100.
// Prior-period variants remain static (no live prior-period RPCs exist yet).
const AVG_DISCOUNT_PREV_M = 5.2;
const AVG_DISCOUNT_LY     = 4.8;

// RETURNS_PCT — moved inside component; live from refund_rate() RPC × 100.
// Prior-period variants remain static (no live prior-period RPCs exist yet).
const RETURNS_PREV_M = 1.8;
const RETURNS_LY     = 1.4;

/**
 * @ai-commentary Replace with AI-generated CFO insight when ready.
 * recovery.cashLow / cashHigh are forward projections:
 *   @dynamic cashLow  = Math.round(nextMonthOrderVolume * (ppLow  / 100) * revenuePerOrder * 12)
 *   @dynamic cashHigh = Math.round(nextMonthOrderVolume * (ppHigh / 100) * revenuePerOrder * 12)
 */
const CFO_INSIGHT = {
  /** @ai-commentary Replace with AI-generated headline based on live margin data */
  headline: "Margin is 2.7pp below target — £20,400 recoverable next month across three levers",
  /** @ai-commentary Replace with dynamically generated status: "warning" | "critical" | "healthy" */
  status: "warning" as "warning" | "critical" | "healthy",
  summary:
    "Contribution margin is currently 42.3%, below the target range of 45–55%.",
  /** @ai-commentary Sorted by magnitude descending from live driver analysis */
  primaryDrivers: [
    "Meta CAC up £3.40/order — paid acquisition eroding blended margin",
    "Shipping up £2.10/order — carrier costs worsening month-on-month",
    "Discount depth +1.8pp — compounding margin drag across all channels",
  ],
  /** @ai-commentary Single clearest action to move the margin needle fastest */
  fastestLever:
    "Channel mix has the highest recovery potential this month. Shifting even a portion of Meta budget toward Email and Organic improves blended margin without adding to total spend.",
  /** @ai-commentary Generated from trajectory model: currentCm, declineRatePerMonth, warningThreshold */
  riskNote:
    "At the current decline rate, contribution margin could reach 40% in approximately 2 months.",
  closing:
    "Marketing is now the largest variable cost line at £12.20 per order, indicating channel mix optimisation is the fastest route to recovery.",
  opportunity: "+2–4pp",
  /**
   * @dynamic Derived from RECOVERY_SCENARIOS totals — keep in sync with RECOVERY_TOTAL_CASH / RECOVERY_TOTAL_PP.
   * ppGain = sum of scenario ppGain values; cashTotal = sum of scenario cashImpact values.
   */
  recovery: {
    ppGain: 3.0,
    cashTotal: 20_400,
  },
} as const;


/**
 * @dynamic Replace with dynamically calculated recovery scenarios when ready.
 * cashImpact = ppGain × monthly revenue × 0.01, rounded.
 * At current volume (2000 orders/month × £68.40/order = £136,800/month):
 *   1pp ≈ £1,368 direct; figures below account for blended AOV uplift.
 */
/** @dynamic Sorted by cashImpact descending — highest £ contribution uplift first */
const RECOVERY_SCENARIOS = [
  {
    shortLabel:  "Reallocate Meta spend",
    action:      "Reduce Meta CAC by 10%",
    detail:      "Shift budget toward Email and Organic — both generate materially higher contribution per order",
    ppGain:      1.4,
    newCm:       43.7,
    /** @dynamic cashImpact = round(ppGain × monthlyRevenue / 100) */
    cashImpact:  9_500,
    /** @dynamic confidence = "high" | "medium" | "requires-validation" */
    confidence:  "medium" as const,
    /** @dynamic effort = "low" | "medium" | "high" */
    effort:      "low" as const,
    timeframe:   "1–2 weeks",
  },
  {
    shortLabel:  "Reduce shipping costs",
    action:      "Reduce shipping costs by 8%",
    detail:      "Renegotiate carrier rates — achievable at current volume",
    ppGain:      1.0,
    newCm:       43.3,
    cashImpact:  6_800,
    confidence:  "high" as const,
    effort:      "medium" as const,
    timeframe:   "2–4 weeks",
  },
  {
    shortLabel:  "Lower discount depth",
    action:      "Reduce discount depth to 5%",
    detail:      "Replace blanket codes with targeted post-purchase offers",
    ppGain:      0.6,
    newCm:       42.9,
    cashImpact:  4_100,
    confidence:  "high" as const,
    effort:      "low" as const,
    timeframe:   "Immediate",
  },
];

/**
 * Softer action labels shown in the FREE ghost preview only.
 * Pro users see the precise shortLabel from RECOVERY_SCENARIOS.
 */
const RECOVERY_GHOST_LABELS: Record<string, string> = {
  "Reallocate Meta spend":  "Reallocate paid spend",
  "Reduce shipping costs":  "Optimise fulfilment costs",
  "Lower discount depth":   "Improve pricing strategy",
};

/** Number of scenarios shown by default; extras revealed via "View more" */
const VISIBLE_SCENARIO_COUNT = 3;
const RECOVERY_TOTAL_PP   = +RECOVERY_SCENARIOS.reduce((s, r) => s + r.ppGain,    0).toFixed(1);
const RECOVERY_TOTAL_CASH =  RECOVERY_SCENARIOS.reduce((s, r) => s + r.cashImpact, 0);
// RECOVERY_TARGET_CM and RISK_MONITOR moved inside component — both reference live CM_PCT.

function getBenchmark(pct: number) {
  if (pct >= BENCHMARK_TARGET.low) {
    if (pct >= 50) return { label: "Healthy — within target range", color: "green" as const };
    return { label: "On target — low end of range", color: "amber" as const };
  }
  return { label: `Below target range (${BENCHMARK_TARGET.low}–${BENCHMARK_TARGET.high}%)`, color: "red" as const };
}

const UNIT_ECON_HISTORY = [
  { month: "Mar '25", revenue: 71.80, contribution: 40.50, highlighted: true  },
  { month: "Apr",     revenue: 71.20, contribution: 39.10                     },
  { month: "May",     revenue: 70.80, contribution: 38.60                     },
  { month: "Jun",     revenue: 69.50, contribution: 38.00                     },
  { month: "Jul",     revenue: 72.10, contribution: 40.20                     },
  { month: "Aug",     revenue: 73.40, contribution: 41.50                     },
  { month: "Sep",     revenue: 71.90, contribution: 40.80                     },
  { month: "Oct",     revenue: 70.60, contribution: 39.40                     },
  { month: "Nov",     revenue: 69.80, contribution: 38.90                     },
  { month: "Dec",     revenue: 71.30, contribution: 38.20                     },
  { month: "Jan",     revenue: 69.10, contribution: 37.00                     },
  { month: "Feb",     revenue: 68.70, contribution: 36.10                     },
  { month: "Mar '26", revenue: 68.40, contribution: 35.00, highlighted: true  },
];

// Channel CM percentages imported from channel-metrics (shared with marketing-efficiency).
// Revenue figures remain local — they reflect the margin-analysis period basis.
const CHANNELS = [
  { name: "Meta",            cm: CHANNEL_CM_PCT.meta,           revenue: 41800 },
  { name: "Google Shopping", cm: CHANNEL_CM_PCT.googleShopping, revenue: 28600 },
  { name: "Email",           cm: CHANNEL_CM_PCT.email,          revenue: 22100 },
  { name: "Organic",         cm: CHANNEL_CM_PCT.organic,        revenue: 32000 },
];

/**
 * Generic channel labels for the FREE ghost preview.
 * Ordered to match the channel list sorted by CM descending:
 *   Email → Organic → Google Shopping → Meta
 */
const CHANNEL_GHOST_NAMES = ["Channel A", "Channel B", "Channel C", "Channel D"] as const;

/**
 * Maps channel-specific driver names to generic equivalents for the FREE ghost preview.
 * Non-channel drivers (Shipping costs, Discount depth, etc.) are shown as-is.
 */
const DRIVER_GHOST_LABELS: Record<string, string> = {
  "Meta CAC": "Paid channel CAC",
};

/** @dynamic Replace rows and total with API/AI-generated values when ready */
const CHANGE_DRIVERS = [
  { driver: "Shipping costs",          change: "+8%",    impactPerOrder: -2.10, direction: "negative" as const },
  { driver: "Discount depth",          change: "+1.8pp", impactPerOrder: -1.80, direction: "negative" as const },
  { driver: "Meta CAC",                change: "+14%",   impactPerOrder: -3.40, direction: "negative" as const },
  { driver: "Payment processing rate", change: "+0.3%",  impactPerOrder: -0.20, direction: "negative" as const },
  { driver: "Returns rate",            change: "+2.1%",  impactPerOrder: -1.40, direction: "negative" as const },
];
const CHANGE_DRIVERS_TOTAL = +CHANGE_DRIVERS
  .reduce((s, d) => s + d.impactPerOrder, 0)
  .toFixed(2);

// MONTHLY_ORDER_VOLUME — moved inside component; derived from live grossRevenue / averageOrderValue.
// CHANGE_DRIVERS_MONTHLY_IMPACT — moved inside component; references live MONTHLY_ORDER_VOLUME.

// ─── Simulator & Sensitivity ─────────────────────────────────────────────────

// SIM_REVENUE — moved inside component; uses live gross revenue.
const SIM_ORDERS = 1_512;

/**
 * @dynamic Each lever's impact is derived from the real cost share:
 *   metaContrib / 1% = marketingSpend × metaShareOfMarketing × 0.01 / revenue × orders
 * Simplified to a per-% multiplier for the static mock.
 */
const SIM_MULTIPLIERS = {
  metaPerPct:     633,   // −1% Meta CAC → +£633 contribution
  shippingPerPct: 340,   // −1% shipping → +£340 contribution
  discountPerPp:  820,   // −1pp discount depth → +£820 contribution
  returnsPerPp:   540,   // −1pp returns rate → +£540 contribution
  paymentPerPp:   450,   // −1pp payment rate → +£450 contribution
} as const;

/**
 * @dynamic Sensitivity ranked by maximum achievable £ uplift at realistic lever change.
 * All impacts use same 30-day baseline as Recovery Scenarios.
 */
const SENSITIVITY_RANKING = [
  { rank: 1, lever: "Meta CAC",            basis: "−15% Meta CAC",          impact:  9_500 },
  { rank: 2, lever: "Shipping costs",      basis: "−8% carrier rates",       impact:  6_800 },
  { rank: 3, lever: "Discount depth",      basis: "−2pp discount depth",     impact:  4_100 },
  { rank: 4, lever: "Returns rate",        basis: "−2pp returns rate",       impact:  2_700 },
  { rank: 5, lever: "Payment processing",  basis: "−1pp processing rate",    impact:    900 },
] as const;

function fmt(n: number) {
  return `£${Math.abs(n).toLocaleString()}`;
}

/** Renders a small coloured variance line: green if favourable, red if not. */
function VarLine({ label, value, favorable }: { label: string; value: string; favorable: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-1 text-xs leading-none",
      favorable ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
    )}>
      <span className="font-semibold">{value}</span>
      <span className="text-muted-foreground font-normal">{label}</span>
    </div>
  );
}

// ─── Section heading helper ───────────────────────────────────────────────────

function SectionHeading({ title, subtitle, support }: { title: string; subtitle?: string; support?: string }) {
  return (
    <div className="mt-4 mb-6">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold text-foreground whitespace-nowrap">{title}</h2>
        <div className="flex-1 h-px bg-border/60" />
      </div>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>
      )}
      {support && (
        <p className="text-xs text-muted-foreground/70 mt-0.5">{support}</p>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MarginAnalysis() {
  const { selectedLabel } = useTimeline();

  // ── Phase 1 data fetch ────────────────────────────────────────────────────
  // Walks back from the current month to find the most recent month with data.
  // A network failure leaves phase1 null; all derived values fall back to
  // the static snapshot constants below.
  const { phase1, dateFrom: maDateFrom, dateTo: maDateTo, periodLabel: maPeriodLabel, loading: maPeriodLoading } = useLatestDataPeriod(MA_STORE_ID);

  // ── Phase 2: month-on-month deltas + rolling 3m averages + trailing 12m avg
  // All three RPCs fire in parallel inside the hook. Used for:
  //   - CM% change vs last month (replaces static CM_PREV comparison) [deltas]
  //   - Contribution profit prior-period value (replaces CM_VALUE_PREV_M) [deltas]
  //   - Contribution per order prior-period value (replaces CONTRIBUTION_PER_ORDER_PREV_M) [deltas]
  //   - 3-month rolling average CM% for trend context line [trends]
  //   - Trailing 12-month average CM% for "vs 12-month avg" VarLine [trailing12m]
  // A failure leaves maDeltas / maTrends / maTrailing12m null; affected rows
  // fall back to static snapshots or TREND_DATA-derived values.
  const { deltas: maDeltas, trends: maTrends, trailing12m: maTrailing12m } = usePhase2Deltas(MA_STORE_ID, maDateFrom, maDateTo);

  // ── Live-derived metric values (Phase 1 → fallback to static snapshots) ────
  // DEV-ONLY FALLBACK — static March 2026 snapshot values are used while phase1
  // is null (loading) or if an individual RPC call fails. Pattern mirrors dashboard.tsx.

  // Gross revenue — primary: gross_revenue() RPC; fallback: March 2026 snapshot.
  // Uses || (not ??) so that a 0 returned by the RPC (no orders in the period)
  // also triggers the static fallback — prevents the bridge table showing £0 revenue.
  const liveGrossRevenue = phase1?.data.grossRevenue || 124_500;

  // Average order value — primary: average_order_value() RPC; fallback: March 2026 snapshot.
  // Same 0-guard rationale as liveGrossRevenue.
  const liveAov = phase1?.data.averageOrderValue || 68.40;

  // Contribution margin % — primary: contribution_margin_pct() RPC [0,1] × 100
  // fallback: MONTHLY_CM_PCT (42.3 from business-snapshot.ts)
  const CM_PCT = phase1?.data.contributionMarginPct != null
    ? +(phase1.data.contributionMarginPct * 100).toFixed(1)
    : MONTHLY_CM_PCT;

  // Discount dependency % — primary: discount_dependency() RPC [0,1] × 100
  // fallback: 7.0 (March 2026 snapshot)
  const AVG_DISCOUNT_PCT = phase1?.data.discountDependency != null
    ? +(phase1.data.discountDependency * 100).toFixed(1)
    : 7.0;

  // Refund rate % — primary: refund_rate() RPC [0,1] × 100
  // fallback: 2.1 (March 2026 snapshot)
  const RETURNS_PCT = phase1?.data.refundRate != null
    ? +(phase1.data.refundRate * 100).toFixed(1)
    : 2.1;

  // Derived: contribution profit £ — grossRevenue × contributionMarginPct
  // fallback: 52,913 (March 2026 snapshot)
  const CM_VALUE = phase1?.data.contributionMarginPct != null
    ? Math.round(liveGrossRevenue * phase1.data.contributionMarginPct)
    : 52_913;

  // Derived: order count — grossRevenue / averageOrderValue (rounded)
  // fallback: 2,000 (March 2026 snapshot)
  const MONTHLY_ORDER_VOLUME = liveAov > 0
    ? Math.round(liveGrossRevenue / liveAov)
    : 2_000;

  // Derived: contribution per order — CM_VALUE / order count
  // fallback: 35.00 (March 2026 snapshot)
  const CONTRIBUTION_PER_ORDER = MONTHLY_ORDER_VOLUME > 0
    ? +(CM_VALUE / MONTHLY_ORDER_VOLUME).toFixed(2)
    : 35.00;

  // CM% delta vs last month — live from Phase 2 RPC; falls back to static comparison.
  // null = RPC succeeded but prior period had no data ("—" shown in UI).
  // non-null during loading = static snapshot used as sentinel (CM_PCT − CM_PREV).
  const liveCmChangePp: number | null = maDeltas
    ? (maDeltas.cm_pct_delta_pp ?? null)
    : +(CM_PCT - CM_PREV).toFixed(1);

  // Keep CM_CHANGE for any remaining static references (RISK_MONITOR, etc.)
  const CM_CHANGE = +(CM_PCT - CM_PREV).toFixed(1);

  // ── Rolling 3m trend context (Phase 2c) ─────────────────────────────────
  // cm_pct_3m_avg is [0,1] — multiply × 100 to get display %.
  // null until maTrends resolves; also null if the RPC fails or returns no rows.
  const cmTrendAvgPct: number | null =
    maTrends != null && maTrends.cm_pct_3m_avg > 0
      ? +(maTrends.cm_pct_3m_avg * 100).toFixed(1)
      : null;
  // vsTrend in pp: positive = current CM above the rolling avg (good).
  const cmVsTrend: number | null =
    cmTrendAvgPct !== null
      ? +(CM_PCT - cmTrendAvgPct).toFixed(1)
      : null;
  // How many non-zero-revenue months are in the average (1, 2, or 3).
  // 0 when maTrends is null / RPC did not return the field.
  const cmTrendMonths: number = maTrends?.months_included ?? 0;

  // Narrative insight: combines MoM pp change with rolling 3m trend comparison.
  // "—" while trends are loading or when there is insufficient history.
  const cmInsightText: string =
    cmVsTrend !== null && cmTrendMonths > 0 && liveCmChangePp !== null
      ? (() => {
          const trendAbs = Math.abs(cmVsTrend).toFixed(1);
          const trendDir = cmVsTrend >= 0 ? "above" : "below";
          // So-what: what does the trend position mean for the business?
          const soWhat = cmVsTrend >= 0
            ? "costs are being managed well relative to your recent run rate"
            : "cost pressure is running above your recent average — this needs attention";
          return liveCmChangePp < 0
            ? `Contribution margin fell ${Math.abs(liveCmChangePp).toFixed(1)}pp this month but remains ${trendAbs}pp ${trendDir} your recent average — ${soWhat}`
            : `Contribution margin rose ${Math.abs(liveCmChangePp).toFixed(1)}pp this month and remains ${trendAbs}pp ${trendDir} your recent average — ${soWhat}`;
        })()
      : "—";

  // Live trailing 12-month CM% average — from trailing_12m_cm_avg() RPC.
  // cm_pct_12m_avg is [0,1] — multiply × 100 for display %.
  // Priority:
  //   1. Live RPC with ≥ 1 non-zero month       → use live average
  //   2. RPC pending (maTrailing12m === null)    → use CM_12M_AVG_FALLBACK (TREND_DATA)
  //   3. RPC settled, 0 live months found        → use CM_12M_AVG_FALLBACK (TREND_DATA)
  //   4. RPC settled, cm_pct_12m_avg is null     → use CM_12M_AVG_FALLBACK (TREND_DATA)
  const liveTrailing12mPct: number =
    maTrailing12m != null &&
    maTrailing12m.cm_pct_12m_avg != null &&
    maTrailing12m.months_included > 0
      ? +(maTrailing12m.cm_pct_12m_avg * 100).toFixed(1)
      : CM_12M_AVG_FALLBACK;

  // CM% gap vs trailing average — positive = above avg (favourable).
  const cmVs12mAvg: number = +(CM_PCT - liveTrailing12mPct).toFixed(1);
  const cmVs12mSentiment = deltaToSentiment(cmVs12mAvg, DELTA_POLARITY.cm);

  // Label reflects how many months are actually in the average so the UI is
  // never misleading: "vs 2-month avg" when only 2 months exist in the DB,
  // "vs 12-month avg" when fully populated. Falls back to "12" when the RPC
  // has not yet resolved (null) — matches the CM_12M_AVG_FALLBACK window.
  const cmTrailing12mMonths: number =
    maTrailing12m != null && maTrailing12m.months_included > 0
      ? maTrailing12m.months_included
      : TREND_DATA.slice(0, -1).length;
  const cmVs12mLabel = `vs ${cmTrailing12mMonths}-month avg`;

  // Contribution Profit prior-month value — live from Phase 2, fallback to snapshot.
  // Formula: gross_revenue_prv × cm_pct_prv ≈ contribution_profit_prv
  const liveContribPrv = maDeltas && maDeltas.gross_revenue_prv > 0
    ? Math.round(maDeltas.gross_revenue_prv * maDeltas.cm_pct_prv)
    : CM_VALUE_PREV_M;

  // Contribution per Order prior-month value — live from Phase 2, fallback to snapshot.
  // Formula: gross_revenue_prv × cm_pct_prv / (gross_revenue_prv / aov_prv)
  //        = contribution_profit_prv / order_count_prv
  const liveContribPerOrderPrv = maDeltas && maDeltas.gross_revenue_prv > 0 && maDeltas.aov_prv > 0
    ? (maDeltas.gross_revenue_prv * maDeltas.cm_pct_prv) /
      (maDeltas.gross_revenue_prv / maDeltas.aov_prv)
    : CONTRIBUTION_PER_ORDER_PREV_M;

  // Discount dependency delta pp — live from Phase 2, fallback to static snapshot comparison.
  // down-is-good: a negative value means dependency fell (favourable).
  const liveDiscDepChangePp: number | null = maDeltas
    ? (maDeltas.discount_dep_delta_pp ?? null)
    : +(AVG_DISCOUNT_PCT - AVG_DISCOUNT_PREV_M).toFixed(1);

  // Pre-computed sentiments — avoids repeated inline deltaToSentiment calls in JSX.
  const cmSentiment   = deltaToSentiment(liveCmChangePp,   DELTA_POLARITY.cm);

  // Simulator baseline revenue — live gross revenue (fallback: 124,500 via liveGrossRevenue)
  const SIM_REVENUE = liveGrossRevenue;

  // Bridge rows — rows 0 (Revenue) and 1 (Discounts) use live Phase 1 values;
  // rows 2–5 stay static (no RPCs cover payment fees, shipping, fulfilment, or marketing).
  const _discountDep = phase1?.data.discountDependency ?? 0.07;
  // Discounts row trend — derived from live discount dep delta (down-is-good: falling dep = improving).
  // null data = no prior period to compare → neutral/stable (not worsening).
  const _discountTrend: "stable" | "worsening" | "improving" =
    liveDiscDepChangePp === null ? "stable"
    : deltaToSentiment(liveDiscDepChangePp, DELTA_POLARITY.dd) === "positive" ? "improving"
    : deltaToSentiment(liveDiscDepChangePp, DELTA_POLARITY.dd) === "negative" ? "worsening"
    : "stable";
  const liveBridgeRows = [
    { label: "Revenue",          total: Math.round(liveGrossRevenue),                       perOrder: +liveAov.toFixed(2),                         type: "revenue"   as const, trend: "stable"       as const },
    { label: "Discounts",        total: -Math.round(liveGrossRevenue * _discountDep),        perOrder: -(+(liveAov * _discountDep).toFixed(2)),      type: "deduction" as const, trend: _discountTrend },
    { label: "Payment fees",     total:  -2490, perOrder: -1.90, type: "deduction" as const, trend: "stable"       as const },
    { label: "Shipping costs",   total: -15562, perOrder: -4.80, type: "deduction" as const, trend: "worsening"    as const },
    { label: "Fulfilment costs", total: -17430, perOrder: -6.40, type: "deduction" as const, trend: "stable"       as const },
    { label: "Marketing spend",  total: -27390, perOrder:-12.20, type: "deduction" as const, trend: "worsening"    as const },
  ];

  // Monthly impact for change drivers (order volume × per-order impact)
  const CHANGE_DRIVERS_MONTHLY_IMPACT =
    Math.round((CHANGE_DRIVERS_TOTAL * MONTHLY_ORDER_VOLUME) / 100) * 100;

  // Target CM after all recovery scenarios applied
  const RECOVERY_TARGET_CM = +(CM_PCT + RECOVERY_TOTAL_PP).toFixed(1);

  // Risk monitor — currentCm uses live CM_PCT; thresholds and narrative stay static
  const RISK_MONITOR = {
    currentCm: CM_PCT,
    thresholds: [
      {
        pct: 40,
        label: "Warning",
        monthsAtCurrentRate: 2,
        color: "amber" as const,
        implications: [
          "Paid acquisition becomes unprofitable on current channel mix",
          "CAC payback period would exceed 2 orders",
          "Growth efficiency declines — scaling costs outpace contribution",
        ],
      },
      {
        pct: 35,
        label: "Critical",
        monthsAtCurrentRate: 6,
        color: "red" as const,
        implications: [
          "Business covers fixed costs but generates minimal surplus",
          "New customer investment is no longer viable",
          "Structural cost restructuring becomes necessary",
        ],
      },
    ],
    monthlyDeclineRate: 1.1,
    trajectoryNote:
      "Margin declining ~1.1pp/month. At this rate, the 40% warning threshold is approximately 2 months away.",
  };

  // ── Simulator state ──────────────────────────────────────────────────────
  const [simMetaCac,  setSimMetaCac]  = useState(0);
  const [simShipping, setSimShipping] = useState(0);
  const [simDiscount, setSimDiscount] = useState(0);
  const [simReturns,  setSimReturns]  = useState(0);
  const [simPayment,  setSimPayment]  = useState(0);

  const simMetaContrib  = Math.round(-simMetaCac  * SIM_MULTIPLIERS.metaPerPct);
  const simShipContrib  = Math.round(-simShipping * SIM_MULTIPLIERS.shippingPerPct);
  const simDiscContrib  = Math.round(-simDiscount * SIM_MULTIPLIERS.discountPerPp);
  const simRetContrib   = Math.round(-simReturns  * SIM_MULTIPLIERS.returnsPerPp);
  const simPayContrib   = Math.round(-simPayment  * SIM_MULTIPLIERS.paymentPerPp);
  const simTotalContrib = simMetaContrib + simShipContrib + simDiscContrib + simRetContrib + simPayContrib;
  const simProjCP       = CM_VALUE + simTotalContrib;
  const simProjCM       = +((simProjCP / SIM_REVENUE) * 100).toFixed(1);
  const simProjCPO      = +(simProjCP / SIM_ORDERS).toFixed(2);

  const getSimRiskLevel = (cm: number) => {
    if (cm >= 45) return { label: "Strong — within target",          color: "emerald" as const };
    if (cm >= 42) return { label: "Below target — monitor closely",  color: "amber"   as const };
    if (cm >= 40) return { label: "Warning — approaching threshold", color: "orange"  as const };
    return               { label: "Critical — immediate action",      color: "red"     as const };
  };
  const simRisk = getSimRiskLevel(simProjCM);
  const isPro   = canAccess("margin_simulator");

  // Dynamic simulator insight: label the largest positive contributor
  const simLargestContrib = [
    { value: simMetaContrib,  label: "reducing Meta CAC" },
    { value: simShipContrib,  label: "reducing shipping cost per order" },
    { value: simDiscContrib,  label: "reducing discount depth" },
    { value: simRetContrib,   label: "reducing returns" },
    { value: simPayContrib,   label: "reducing payment processing fees" },
  ].filter(c => c.value > 0).sort((a, b) => b.value - a.value)[0];

  const simInsight = simTotalContrib <= 0
    ? "Move any slider to model your margin recovery in real time."
    : simLargestContrib
      ? `${simLargestContrib.label.charAt(0).toUpperCase() + simLargestContrib.label.slice(1)} drives the biggest gain in this scenario — prioritise this lever.`
      : "Reducing Meta CAC and rebalancing channel mix drives the strongest recovery here.";

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Margin Analysis</h1>
          <p className="text-muted-foreground mt-1">Where contribution is leaking, how much can be recovered, and what to fix first.</p>
          <DataPeriodLabel periodLabel={maPeriodLabel} loading={maPeriodLoading} dateFrom={maDateFrom} dateTo={maDateTo} />
        </div>
        <TimelineSelector />
      </div>

      <div className="sc-purple rounded-2xl shadow-md mb-5 overflow-hidden">
        <div className="sc-purple-header flex items-center gap-3 px-6 py-3">
          <Sparkles className="w-4 h-4 text-indigo-300 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">CFO Margin Verdict</span>
          <span className="ml-auto inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 whitespace-nowrap">Action required</span>
        </div>
        <div className="px-6 py-4">
          <p className="text-lg sm:text-xl font-bold text-foreground leading-snug">Profit is leaking through acquisition and fulfilment costs.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3 pb-3 border-b border-primary/15">
            <div className="rounded-xl bg-secondary/30 border border-primary/10 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Current margin</p>
              <p className="text-xl font-display font-bold text-foreground leading-none">{CM_PCT}%</p>
              <p className="text-[11px] text-muted-foreground leading-snug mt-1">Healthy 45-60%; warning 40%.</p>
            </div>
            <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">Recoverable contribution</p>
              <p className="text-3xl font-display font-bold text-emerald-700 dark:text-emerald-300 leading-none">£{RECOVERY_TOTAL_CASH.toLocaleString()}</p>
              <p className="text-xs text-emerald-700/75 dark:text-emerald-300/75 leading-snug mt-1">recoverable over the selected completed period.</p>
            </div>
            <div className="rounded-xl bg-secondary/30 border border-primary/10 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Do first</p>
              {canAccess("opportunity_breakdown") ? (
                <p className="text-sm font-bold text-foreground leading-snug">Reduce Meta acquisition costs and rebalance spend toward higher-margin channels.</p>
              ) : (
                <div>
                  <p className="text-sm font-bold text-foreground leading-snug">Primary recommendation identified</p>
                  <p className="text-xs text-muted-foreground leading-snug mt-1">Upgrade to Pro to view the recovery plan.</p>
                </div>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mt-3">Contribution margin has fallen below the healthy range and is now approaching the warning threshold.</p>
          <div className="pt-3 flex flex-wrap gap-2">
            {["Meta CAC drag", "Shipping cost pressure", "Discount depth"].map((signal) => (
              <span key={signal} className="rounded-full bg-secondary/30 border border-primary/10 px-3 py-1.5 text-xs font-semibold text-foreground">{signal}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">Where Profit Is Leaking</h2>
        <p className="text-sm text-muted-foreground mt-0.5">The biggest places to recover margin without needing more revenue.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {RECOVERY_SCENARIOS.map((s) => (
          <div key={s.shortLabel} className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  {s.shortLabel === "Reallocate Meta spend" ? "Customer acquisition" : s.shortLabel === "Reduce shipping costs" ? "Shipping costs" : "Discount depth"}
                </p>
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {s.shortLabel === "Reallocate Meta spend" ? "Customer acquisition" : s.shortLabel === "Reduce shipping costs" ? "Shipping costs" : "Discount depth"}
                </p>
              </div>
              {canAccess("opportunity_breakdown") ? (
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">£{s.cashImpact.toLocaleString()}</p>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"><Lock className="w-3 h-3" /> PRO</span>
              )}
            </div>
            {canAccess("opportunity_breakdown") ? (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground leading-relaxed">{s.detail}</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{s.confidence === "high" ? "High" : "Medium"} confidence</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{s.effort} effort</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{s.timeframe}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">Upgrade to Pro to see the value of this lever</p>
            )}
          </div>
        ))}
      </div>

      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">Margin Recovery Plan</h2>
        <p className="text-sm text-muted-foreground mt-0.5">The priority actions to recover contribution and protect margin.</p>
      </div>
      {canAccess("opportunity_breakdown") ? (
        <div className="space-y-4 mb-8">
          {RECOVERY_SCENARIOS.map((s, i) => (
            <details key={s.shortLabel} open={i === 0} className={cn("group rounded-2xl border bg-card shadow-sm overflow-hidden", i === 0 ? "border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/50 dark:bg-emerald-950/10" : "border-border/60")}>
              <summary className={cn("list-none cursor-pointer px-6 py-5 transition-colors", i === 0 ? "hover:bg-emerald-50 dark:hover:bg-emerald-950/20" : "hover:bg-secondary/20")}>
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-5 items-start">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={cn("flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-xs font-bold", i === 0 ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300" : "bg-secondary text-muted-foreground")}>{i + 1}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-bold text-foreground">{i === 0 ? "Reduce Meta CAC / reallocate paid spend" : i === 1 ? "Reduce shipping costs" : "Lower discount depth"}</p>
                        {i === 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950 uppercase tracking-wider">START FIRST</span>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 leading-snug">{s.detail}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-[auto_auto_auto_auto] gap-2 lg:justify-end">
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-700/40 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-0.5">Impact</p><p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">£{s.cashImpact.toLocaleString()}</p></div>
                    <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Confidence</p><p className="text-sm font-semibold text-foreground capitalize">{s.confidence}</p></div>
                    <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Effort</p><p className="text-sm font-semibold text-foreground capitalize">{s.effort}</p></div>
                    <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Timing</p><p className="text-sm font-semibold text-foreground">{s.timeframe}</p></div>
                  </div>
                </div>
              </summary>
              <div className="px-6 pb-5 -mt-1"><div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-4 pl-11"><div className="rounded-xl bg-secondary/30 border border-border/50 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Why it matters</p><p className="text-sm text-foreground leading-relaxed">{s.detail}</p></div><div className="rounded-xl bg-secondary/30 border border-border/50 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">How to start</p><p className="text-sm text-foreground leading-relaxed">{s.action}. Start with a controlled change, monitor contribution per order, and widen the change only if margin improves without unacceptable volume loss.</p></div></div></div>
            </details>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/70 dark:bg-indigo-950/25 shadow-sm mb-8 px-6 py-5"><div className="flex items-start gap-3"><div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0"><Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /></div><div><p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Your Margin Recovery Plan</p><p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 mt-1">A clear route exists to recover margin across acquisition, fulfilment and pricing controls. Upgrade to view values, timing and implementation steps.</p></div></div></div>
      )}

      <div className="mb-2"><h2 className="text-xl font-bold text-foreground">Margin Recovery Simulator</h2><p className="text-sm text-muted-foreground mt-0.5">See how much profit you could recover before making a single operational change.</p></div>
      {isPro ? (
        <div className="rounded-2xl border border-primary/30 shadow-md mb-8 overflow-hidden bg-card"><div className="flex items-center gap-3 px-6 py-3 bg-primary/10 border-b border-primary/20"><SlidersHorizontal className="w-4 h-4 text-primary shrink-0" /><span className="text-xs font-semibold uppercase tracking-wider text-primary">Margin Recovery Simulator</span><span className="ml-auto text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-primary/20 text-primary uppercase tracking-wider">Pro</span></div><div className="bg-primary/5 px-6 py-6"><div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 mb-8">
          {[
            { label: "Meta CAC change", value: simMetaCac, min: -25, max: 25, step: 1, setter: setSimMetaCac, suffix: "%", low: "−25% (reduce)", high: "+25% (increase)" },
            { label: "Shipping cost change", value: simShipping, min: -20, max: 20, step: 1, setter: setSimShipping, suffix: "%", low: "−20% (reduce)", high: "+20% (increase)" },
            { label: "Discount depth change", value: simDiscount, min: -5, max: 5, step: 0.5, setter: setSimDiscount, suffix: "pp", low: "−5pp (tighter)", high: "+5pp (deeper)" },
            { label: "Returns rate change", value: simReturns, min: -5, max: 5, step: 0.5, setter: setSimReturns, suffix: "pp", low: "−5pp (fewer)", high: "+5pp (more)" },
          ].map((slider) => (<div key={slider.label}><div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold text-foreground">{slider.label}</p><span className={cn("text-sm font-bold tabular-nums", slider.value < 0 ? "text-emerald-600 dark:text-emerald-400" : slider.value > 0 ? "text-destructive" : "text-muted-foreground")}>{slider.value > 0 ? "+" : ""}{slider.value}{slider.suffix}</span></div><Slider aria-label={slider.label} min={slider.min} max={slider.max} step={slider.step} value={[slider.value]} onValueChange={([v]) => slider.setter(v)} /><div className="flex justify-between text-[10px] text-muted-foreground mt-1.5"><span>{slider.low}</span><span>{slider.high}</span></div></div>))}
          <div className="sm:col-span-2 sm:max-w-xs"><div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold text-foreground">Payment processing change</p><span className={cn("text-sm font-bold tabular-nums", simPayment < 0 ? "text-emerald-600 dark:text-emerald-400" : simPayment > 0 ? "text-destructive" : "text-muted-foreground")}>{simPayment > 0 ? "+" : ""}{simPayment.toFixed(1)}pp</span></div><Slider aria-label="Payment processing change" min={-2} max={2} step={0.1} value={[simPayment]} onValueChange={([v]) => setSimPayment(Math.round(v * 10) / 10)} /><div className="flex justify-between text-[10px] text-muted-foreground mt-1.5"><span>−2pp (reduce)</span><span>+2pp (increase)</span></div></div>
        </div><div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5"><div className="bg-card rounded-xl p-4 border border-border/50"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Projected CM</p><p className={cn("text-2xl font-bold font-display leading-none mb-1", simProjCM >= 45 ? "text-emerald-600 dark:text-emerald-400" : simProjCM >= 42 ? "text-amber-600 dark:text-amber-400" : "text-destructive")}>{simProjCM}%</p><p className="text-xs text-muted-foreground">Base: {CM_PCT}%</p></div><div className="bg-card rounded-xl p-4 border border-border/50"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Projected CP</p><p className="text-2xl font-bold font-display text-foreground leading-none mb-1">£{simProjCP.toLocaleString()}</p><p className="text-xs text-muted-foreground">Base: £{CM_VALUE.toLocaleString()}</p></div><div className="bg-card rounded-xl p-4 border border-border/50"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Movement</p><PeriodImpact value={simTotalContrib} valueClassName="text-2xl font-display mb-1" /></div><div className="bg-card rounded-xl p-4 border border-border/50"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Proj. CPO</p><p className="text-2xl font-bold font-display text-foreground leading-none mb-1">£{simProjCPO.toFixed(2)}</p><p className="text-xs text-muted-foreground">Base: £{CONTRIBUTION_PER_ORDER.toFixed(2)}</p></div></div><p className="text-xs text-muted-foreground italic mb-4 leading-relaxed">{simInsight}</p><div className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border text-sm", simRisk.color === "emerald" && "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300", simRisk.color === "amber" && "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300", simRisk.color === "orange" && "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/40 text-orange-800 dark:text-orange-300", simRisk.color === "red" && "bg-destructive/10 border-destructive/30 text-destructive")}><Shield className="w-4 h-4 shrink-0" /><span className="font-medium"><span className="font-bold">Risk level:</span> {simRisk.label}</span></div>{(simMetaCac !== 0 || simShipping !== 0 || simDiscount !== 0 || simReturns !== 0 || simPayment !== 0) && (<button onClick={() => { setSimMetaCac(0); setSimShipping(0); setSimDiscount(0); setSimReturns(0); setSimPayment(0); }} className="mt-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">Reset to base assumptions</button>)}</div></div>
      ) : (
        <div className="rounded-2xl border border-primary/20 bg-card shadow-sm mb-8 overflow-hidden"><div className="px-6 py-8 text-center"><div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mb-4"><Lock className="w-4 h-4 text-primary" /></div><p className="text-base font-semibold text-foreground mb-2">See how much profit you could recover before making a single operational change.</p><p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6 leading-relaxed">Unlock simulator controls to test acquisition, shipping, discount depth, returns and payment fees before changing cost structure.</p><a href="/upgrade" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">Unlock Simulator</a></div></div>
      )}

      <AiCfoAskCard pageId="margin" />

      <details className="group bg-card rounded-2xl shadow-sm border border-border/50 mb-8 overflow-hidden"><summary className="list-none cursor-pointer px-6 py-5 hover:bg-secondary/20 transition-colors"><div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-bold text-foreground">Supporting Analysis</h2><p className="text-sm text-muted-foreground mt-0.5">Margin drivers, bridge, channel diagnostics, trend and unit economics.</p></div><span className="text-xs font-semibold text-primary group-open:hidden">Expand</span><span className="text-xs font-semibold text-primary hidden group-open:inline">Collapse</span></div></summary><div className="px-6 pb-6 pt-2">
        {canAccess("driver_breakdown") ? (<div className="space-y-8"><div><h3 className="font-semibold text-lg text-foreground mb-2">What Changed Margin This Period</h3><div className="rounded-xl border border-border/50 overflow-hidden"><div className="divide-y divide-border/40">{[...CHANGE_DRIVERS].sort((a, b) => Math.abs(b.impactPerOrder) - Math.abs(a.impactPerOrder)).map((row) => (<div key={row.driver} className="flex items-center justify-between px-4 py-3 gap-4"><div><p className="text-sm font-semibold text-foreground">{row.driver}</p><p className="text-xs text-muted-foreground">{row.change}</p></div><span className="text-sm font-bold text-destructive tabular-nums">−£{Math.abs(row.impactPerOrder).toFixed(2)} / order</span></div>))}</div></div></div><div><h3 className="font-semibold text-lg text-foreground mb-2">Contribution Margin Bridge</h3><div className="overflow-x-auto rounded-xl border border-border/50"><table className="w-full text-sm"><thead><tr className="border-b border-border bg-secondary/30"><th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Metric</th><th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total</th><th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Per order</th></tr></thead><tbody>{liveBridgeRows.map((row) => (<tr key={row.label} className="border-b border-border/40"><td className="px-4 py-3 font-medium text-foreground">{row.label}</td><td className="px-4 py-3 text-right tabular-nums">{row.type === "revenue" ? "£" : "−£"}{Math.abs(row.total).toLocaleString()}</td><td className="px-4 py-3 text-right tabular-nums">{row.type === "revenue" ? "£" : "−£"}{Math.abs(row.perOrder).toFixed(2)}</td></tr>))}</tbody><tfoot><tr className="bg-primary/5"><td className="px-4 py-3 font-bold text-foreground">Contribution Margin</td><td className="px-4 py-3 text-right font-bold">£{CM_VALUE.toLocaleString()}</td><td className="px-4 py-3 text-right font-bold">£{CONTRIBUTION_PER_ORDER.toFixed(2)}</td></tr></tfoot></table></div></div>{canAccess("channel_margin_analysis") && (<div><h3 className="font-semibold text-lg text-foreground mb-2">Contribution Margin by Channel</h3><div className="space-y-3">{[...CHANNELS].sort((a, b) => b.cm - a.cm).map((ch) => (<div key={ch.name}><div className="flex items-center justify-between mb-1"><span className="text-sm font-medium text-foreground">{ch.name}</span><span className="text-sm font-bold tabular-nums">{ch.cm}%</span></div><div className="h-2 w-full bg-secondary rounded-full overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${(ch.cm / 70) * 100}%` }} /></div></div>))}</div></div>)}<div className="grid grid-cols-1 xl:grid-cols-2 gap-8"><div><h3 className="font-semibold text-lg text-foreground mb-2">Margin Trend</h3><div className="h-[220px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={TREND_DATA} margin={{ top: 14, right: 14, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} dy={8} /><YAxis domain={[38, 52]} axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => `${v}%`} /><Tooltip formatter={(v: number) => [`${v}%`, "Contribution Margin"]} /><ReferenceLine y={CM_PCT} stroke="hsl(var(--destructive))" strokeDasharray="4 4" strokeWidth={1} /><Line type="monotone" dataKey="margin" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></div></div><div><h3 className="font-semibold text-lg text-foreground mb-2">Unit Economics</h3><div className="h-[220px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={UNIT_ECON_HISTORY} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} dy={8} /><YAxis domain={[0, 85]} axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => `£${v}`} /><Tooltip formatter={(v: number, name: string) => [`£${v.toFixed(2)}`, name === "revenue" ? "Revenue per order" : "Contribution per order"]} /><Bar dataKey="revenue" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" fillOpacity={0.25} /><Bar dataKey="contribution" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" /></BarChart></ResponsiveContainer></div></div></div></div>) : (<div className="rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/70 dark:bg-indigo-950/25 px-5 py-4"><div className="flex items-start gap-3"><Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" /><div><p className="text-sm font-semibold text-indigo-950 dark:text-indigo-100">Supporting analysis available on Pro</p><p className="text-xs text-indigo-800/80 dark:text-indigo-200/80 mt-1">Unlock margin drivers, bridge, channel diagnostics, trend evidence and unit economics.</p></div></div></div>)}
      </div></details>

      <DataBenchmarkAssumptions benchmarkNote="Typical healthy DTC contribution margin range: 45–60%. Current: 42.3%." dataQualityNote="Margin analysis depends on product costs, shipping, discounts and marketing spend being mapped correctly." className="mb-2" />
    </AppLayout>
  );
}
