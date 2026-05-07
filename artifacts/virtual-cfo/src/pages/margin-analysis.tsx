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
  headline: "Profit margin below target — £20,400 in estimated additional contribution next month",
  /** @ai-commentary Replace with dynamically generated status: "warning" | "critical" | "healthy" */
  status: "warning" as "warning" | "critical" | "healthy",
  summary:
    "Contribution margin is currently 42.3%, below the target range of 45–55%.",
  /** @ai-commentary Sorted by magnitude descending from live driver analysis */
  primaryDrivers: [
    "Meta CAC increased £3.40 per order",
    "Shipping costs increased £2.10 per order",
    "Discount depth increased 1.8 percentage points",
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
    detail:      "Reallocate budget toward Email (CM 58.6%) and Organic (CM 52.3%)",
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
    return { label: `Watch — lower end of target (${BENCHMARK_TARGET.low}–${BENCHMARK_TARGET.high}%)`, color: "amber" as const };
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
  const { selectedLabel, periodPhrase } = useTimeline();
  const [showAllOpportunities, setShowAllOpportunities] = useState(false);

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
            : "cost pressure is running higher than your recent average — worth investigating";
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
      "At the current average decline rate of ~1.1pp/month, contribution margin could reach 40% within 2 months without corrective action.",
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
    ? "Adjust the sliders to see which margin lever creates the strongest recovery."
    : simLargestContrib
      ? `Most efficient improvement in this scenario comes from ${simLargestContrib.label}.`
      : "Most efficient improvement comes from reducing Meta CAC and improving channel mix.";

  const visibleScenarios = showAllOpportunities
    ? RECOVERY_SCENARIOS
    : RECOVERY_SCENARIOS.slice(0, VISIBLE_SCENARIO_COUNT);
  const hasMoreScenarios = RECOVERY_SCENARIOS.length > VISIBLE_SCENARIO_COUNT;

  return (
    <AppLayout>
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Margin Analysis
          </h1>
          <p className="text-muted-foreground mt-1">
            Understand current profit performance, the biggest upside opportunities, and what is driving change.
          </p>
          <DataPeriodLabel periodLabel={maPeriodLabel} loading={maPeriodLoading} />
        </div>

        <TimelineSelector />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 — CFO INSIGHT
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionHeading
        title="Profit Margin Summary"
        subtitle="March 2026 · Contribution margin target: 45–55%"
      />

      <div className="rounded-2xl border border-primary/30 shadow-md mb-10 overflow-hidden">

        {/* ── Header bar ── */}
        <div className="flex items-center gap-3 px-6 py-3 bg-primary/10 border-b border-primary/20">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            CFO Insight
          </span>
          <span className="ml-auto inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-destructive/15 text-destructive whitespace-nowrap">
            Below target — action required
          </span>
        </div>

        {/* ── Body ── */}
        <div className="bg-primary/5 px-6 pt-5 pb-6">

          {/* ── Hero metrics ── */}
          <div className="grid grid-cols-2 mb-5 pb-5 border-b border-primary/15">

            {/* 1 — Current Contribution Margin */}
            <div className="pr-6 border-r border-primary/15">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Current Contribution Margin
              </p>
              <p className="text-4xl sm:text-5xl font-display font-bold text-foreground leading-none mb-2">
                {CM_PCT}%
              </p>
              <div className="flex items-center gap-1.5 mb-1">
                {liveCmChangePp !== null ? (
                  <span className={cn(
                    "text-sm font-semibold",
                    cmSentiment === "positive" ? "text-emerald-600 dark:text-emerald-400"
                    : cmSentiment === "neutral"  ? "text-muted-foreground"
                    : "text-destructive",
                  )}>
                    {liveCmChangePp >= 0 ? "↑" : "↓"} {Math.abs(liveCmChangePp).toFixed(1)}pp
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-muted-foreground">—</span>
                )}
                <span className="text-xs text-muted-foreground">vs last month</span>
              </div>

              {/* Phase 2c — rolling trend context */}
              <p className="text-xs text-muted-foreground mb-3">
                {cmInsightText}
              </p>

              {/* @dynamic gaps recompute from CM_PCT vs BENCHMARK_TARGET */}
              <div className="pt-3 border-t border-primary/10 space-y-1.5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-muted-foreground">
                    Gap to lower bound ({BENCHMARK_TARGET.low}%)
                  </span>
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                    +{(BENCHMARK_TARGET.low - CM_PCT).toFixed(1)}pp
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-muted-foreground">
                    Gap to midpoint ({(BENCHMARK_TARGET.low + BENCHMARK_TARGET.high) / 2}%)
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                    +{((BENCHMARK_TARGET.low + BENCHMARK_TARGET.high) / 2 - CM_PCT).toFixed(1)}pp
                  </span>
                </div>
              </div>
            </div>

            {/* 2 — Estimated Additional Contribution */}
            <div className="pl-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Estimated Additional Contribution
              </p>
              <p className="text-4xl sm:text-5xl font-display font-bold text-emerald-600 dark:text-emerald-400 leading-none mb-2">
                £{RECOVERY_TOTAL_CASH.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground leading-snug max-w-[26ch]">
                Based on the 30-day trading baseline — see breakdown below
              </p>
              <p className="text-xs text-muted-foreground/60 mt-2">
                ≈ £0.85 additional contribution per order
              </p>
            </div>

          </div>

          {/* Headline */}
          <h2 className="text-lg sm:text-xl font-bold text-foreground leading-snug mb-5 pb-5 border-b border-primary/15">
            {CFO_INSIGHT.headline}
          </h2>

          {/* Time-to-risk indicator */}
          {/* @dynamic monthsToWarning = (currentCm − warningThreshold) / monthlyDeclineRate */}
          <div className="flex items-center gap-2.5 mb-5 px-3.5 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-700/40">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300 leading-snug">
              At the current trend, contribution margin could reach{" "}
              <span className="font-semibold">{RISK_MONITOR.thresholds[0].pct}%</span>
              {" "}in approximately{" "}
              <span className="font-semibold">~{RISK_MONITOR.thresholds[0].monthsAtCurrentRate} months</span>
              {" "}without corrective action.
            </p>
          </div>

          {/* Two-column detail */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            {/* Primary causes */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Primary causes
              </p>
              <ul className="space-y-2.5">
                {CFO_INSIGHT.primaryDrivers.map((driver, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0 mt-[5px]" />
                    {driver}
                  </li>
                ))}
              </ul>
            </div>

            {/* Fastest recovery lever — plan-aware */}
            <div className="rounded-xl bg-emerald-100/80 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700/60 px-4 py-4">
              {canAccess("fastest_recovery_lever") ? (
                /* ── PRO: specific action + impact figure ── */
                <>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">
                    Fastest recovery lever
                  </p>
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200 leading-relaxed">
                    Shift 18–27% of Meta spend toward Email and Organic
                  </p>
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-2">
                    Estimated impact: £9,500 next month
                  </p>
                  <p className="text-xs text-emerald-700/60 dark:text-emerald-400/60 mt-3 leading-snug">
                    See quantified opportunities below ↓
                  </p>
                </>
              ) : (
                /* ── FREE: directional only + upgrade link ── */
                <>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">
                    Fastest recovery lever identified
                  </p>
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200 leading-relaxed">
                    Shift spend from Meta toward higher-margin channels
                  </p>
                  <a
                    href="/upgrade"
                    className="block text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mt-3 leading-snug transition-colors"
                  >
                    Unlock estimated financial impact →
                  </a>
                </>
              )}
            </div>

          </div>

        </div>
      </div>

      <AiCfoAskCard pageId="margin" />

      {/* ── Margin benchmark strip ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 mb-8 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-0.5">
            Margin benchmark
          </p>
          <p className="text-sm text-amber-900 dark:text-amber-200 leading-snug">
            Typical healthy DTC contribution margin range: 45–60%. Current position: {CM_PCT}%, below target range.
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0 flex-wrap">
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Target range</p>
            <p className="text-sm font-bold text-foreground">45–55%</p>
          </div>
          <div className="w-px h-8 bg-amber-200 dark:bg-amber-700/50 hidden sm:block" />
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Top quartile</p>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">55%+</p>
          </div>
          <div className="w-px h-8 bg-amber-200 dark:bg-amber-700/50 hidden sm:block" />
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Current</p>
            <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{CM_PCT}%</p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MARGIN RECOVERY MODELLER
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionHeading
        title="Margin Recovery Modeller"
        subtitle="Adjust cost and pricing levers to model the real-time impact on contribution margin."
      />

      {isPro ? (
        <div className="rounded-2xl border border-primary/30 shadow-md mb-8 overflow-hidden bg-card">
          <div className="flex items-center gap-3 px-6 py-3 bg-primary/10 border-b border-primary/20">
            <SlidersHorizontal className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Margin Recovery Simulator
            </span>
            <span className="ml-auto text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-primary/20 text-primary uppercase tracking-wider">
              Pro
            </span>
          </div>
          <div className="bg-primary/5 px-6 py-6">

            {/* Sliders grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 mb-8">

              {/* 1 — Meta CAC */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-foreground">Meta CAC change</p>
                  <span className={cn(
                    "text-sm font-bold tabular-nums",
                    simMetaCac < 0 ? "text-emerald-600 dark:text-emerald-400"
                                   : simMetaCac > 0 ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {simMetaCac > 0 ? "+" : ""}{simMetaCac}%
                  </span>
                </div>
                <Slider
                  aria-label="Meta CAC change"
                  min={-25} max={25} step={1}
                  value={[simMetaCac]}
                  onValueChange={([v]) => setSimMetaCac(v)}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                  <span>−25% (reduce)</span><span>+25% (increase)</span>
                </div>
              </div>

              {/* 2 — Shipping */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-foreground">Shipping cost change</p>
                  <span className={cn(
                    "text-sm font-bold tabular-nums",
                    simShipping < 0 ? "text-emerald-600 dark:text-emerald-400"
                                    : simShipping > 0 ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {simShipping > 0 ? "+" : ""}{simShipping}%
                  </span>
                </div>
                <Slider
                  aria-label="Shipping cost change"
                  min={-20} max={20} step={1}
                  value={[simShipping]}
                  onValueChange={([v]) => setSimShipping(v)}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                  <span>−20% (reduce)</span><span>+20% (increase)</span>
                </div>
              </div>

              {/* 3 — Discount depth */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-foreground">Discount depth change</p>
                  <span className={cn(
                    "text-sm font-bold tabular-nums",
                    simDiscount < 0 ? "text-emerald-600 dark:text-emerald-400"
                                    : simDiscount > 0 ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {simDiscount > 0 ? "+" : ""}{simDiscount}pp
                  </span>
                </div>
                <Slider
                  aria-label="Discount depth change"
                  min={-5} max={5} step={0.5}
                  value={[simDiscount]}
                  onValueChange={([v]) => setSimDiscount(v)}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                  <span>−5pp (tighter)</span><span>+5pp (deeper)</span>
                </div>
              </div>

              {/* 4 — Returns rate */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-foreground">Returns rate change</p>
                  <span className={cn(
                    "text-sm font-bold tabular-nums",
                    simReturns < 0 ? "text-emerald-600 dark:text-emerald-400"
                                   : simReturns > 0 ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {simReturns > 0 ? "+" : ""}{simReturns}pp
                  </span>
                </div>
                <Slider
                  aria-label="Returns rate change"
                  min={-5} max={5} step={0.5}
                  value={[simReturns]}
                  onValueChange={([v]) => setSimReturns(v)}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                  <span>−5pp (fewer)</span><span>+5pp (more)</span>
                </div>
              </div>

              {/* 5 — Payment processing */}
              <div className="sm:col-span-2 sm:max-w-xs">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-foreground">Payment processing change</p>
                  <span className={cn(
                    "text-sm font-bold tabular-nums",
                    simPayment < 0 ? "text-emerald-600 dark:text-emerald-400"
                                   : simPayment > 0 ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {simPayment > 0 ? "+" : ""}{simPayment.toFixed(1)}pp
                  </span>
                </div>
                <Slider
                  aria-label="Payment processing change"
                  min={-2} max={2} step={0.1}
                  value={[simPayment]}
                  onValueChange={([v]) => setSimPayment(Math.round(v * 10) / 10)}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                  <span>−2pp (reduce)</span><span>+2pp (increase)</span>
                </div>
              </div>

            </div>

            {/* Projected output cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              <div className="bg-card rounded-xl p-4 border border-border/50">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Projected CM</p>
                <p className={cn(
                  "text-2xl font-bold font-display leading-none mb-1",
                  simProjCM >= 45 ? "text-emerald-600 dark:text-emerald-400"
                  : simProjCM >= 42 ? "text-amber-600 dark:text-amber-400"
                  : "text-destructive"
                )}>
                  {simProjCM}%
                </p>
                <p className="text-xs text-muted-foreground">Base: {CM_PCT}%</p>
              </div>
              <div className="bg-card rounded-xl p-4 border border-border/50">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Projected CP</p>
                <p className="text-2xl font-bold font-display text-foreground leading-none mb-1">
                  £{simProjCP.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Base: £{CM_VALUE.toLocaleString()}</p>
              </div>
              <div className="bg-card rounded-xl p-4 border border-border/50">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Movement</p>
                <PeriodImpact value={simTotalContrib} valueClassName="text-2xl font-display mb-1" />
              </div>
              <div className="bg-card rounded-xl p-4 border border-border/50">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Proj. CPO</p>
                <p className="text-2xl font-bold font-display text-foreground leading-none mb-1">
                  £{simProjCPO.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">Base: £{CONTRIBUTION_PER_ORDER.toFixed(2)}</p>
              </div>
            </div>

            {/* Dynamic insight sentence */}
            <p className="text-xs text-muted-foreground italic mb-4 leading-relaxed">
              {simInsight}
            </p>

            {/* Risk level bar */}
            <div className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl border text-sm",
              simRisk.color === "emerald" && "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300",
              simRisk.color === "amber"   && "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300",
              simRisk.color === "orange"  && "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/40 text-orange-800 dark:text-orange-300",
              simRisk.color === "red"     && "bg-destructive/10 border-destructive/30 text-destructive"
            )}>
              <Shield className="w-4 h-4 shrink-0" />
              <span className="font-medium"><span className="font-bold">Risk level:</span> {simRisk.label}</span>
              {simTotalContrib !== 0 && (
                <span className="ml-auto text-xs font-normal text-muted-foreground hidden sm:block">
                  {simTotalContrib > 0 ? "Improvement" : "Deterioration"} of {Math.abs(+(simProjCM - CM_PCT).toFixed(1))}pp vs base
                </span>
              )}
            </div>

            {/* Reset */}
            {(simMetaCac !== 0 || simShipping !== 0 || simDiscount !== 0 || simReturns !== 0 || simPayment !== 0) && (
              <button
                onClick={() => { setSimMetaCac(0); setSimShipping(0); setSimDiscount(0); setSimReturns(0); setSimPayment(0); }}
                className="mt-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                ↺ Reset to base assumptions
              </button>
            )}

          </div>
        </div>
      ) : (
        /* ── FREE: upgrade block ── */
        <div className="rounded-2xl border border-primary/20 bg-card shadow-sm mb-8 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-3 bg-primary/5 border-b border-primary/15">
            <SlidersHorizontal className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Margin Recovery Simulator
            </span>
          </div>
          <div className="px-6 py-8 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mb-4">
              <Lock className="w-4 h-4 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground mb-2">
              Model your margin recovery in real time
            </p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6 leading-relaxed">
              Adjust 5 cost and pricing levers — Meta CAC, shipping, discount depth, returns, and payment fees — to see projected contribution margin and risk level instantly.
            </p>
            <a
              href="/upgrade"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              Unlock Simulator →
            </a>
          </div>
        </div>
      )}

      {/* ── Margin Sensitivity Ranking ── */}
      <div className="rounded-2xl border border-border/50 shadow-sm bg-card mb-10 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary shrink-0" />
              <p className="text-sm font-semibold text-foreground">Margin Sensitivity Ranking</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Which levers move the margin needle most — ranked by estimated monthly contribution uplift.
            </p>
          </div>
          {!canAccess("margin_sensitivity_ranking") && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider whitespace-nowrap shrink-0 ml-4">
              PRO
            </span>
          )}
        </div>
        <div className="divide-y divide-border/40">
          {SENSITIVITY_RANKING.map((item) => {
            const maxImpact = SENSITIVITY_RANKING[0].impact;
            const barWidth  = `${(item.impact / maxImpact) * 100}%`;
            const isTop     = item.rank === 1;
            return (
              <div key={item.lever} className="flex items-center gap-4 px-6 py-4 hover:bg-secondary/20 transition-colors">
                <span className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full shrink-0 text-[11px] font-bold",
                  isTop ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                )}>
                  {item.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-semibold text-foreground">
                      {item.lever}
                      {isTop && (
                        <span className="ml-2 inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                          Highest impact
                        </span>
                      )}
                    </p>
                    {canAccess("margin_sensitivity_ranking") ? (
                      <PeriodImpact value={item.impact} className="ml-4 shrink-0 items-end" />
                    ) : (
                      <span className="text-sm font-bold text-foreground/20 tabular-nums ml-4 shrink-0 select-none">
                        +£ —,———
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", isTop ? "bg-primary" : "bg-primary/50")}
                      style={{ width: barWidth }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{item.basis}</p>
                </div>
              </div>
            );
          })}
        </div>
        {!canAccess("margin_sensitivity_ranking") && (
          <div className="px-6 py-4 border-t border-border/50 bg-secondary/20">
            <a
              href="/upgrade"
              className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              Unlock estimated £ impact for each lever →
            </a>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 — OPPORTUNITIES
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionHeading
        title="Top Margin Recovery Opportunities"
        subtitle="The main actions behind the estimated additional contribution opportunity."
        support="Opportunities are based on the current 30-day trading baseline and are independent of the timeframe selected above."
      />

      {/* ── Structured opportunities panel ── */}
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 shadow-sm mb-8 overflow-hidden bg-card">

        {/* ── Hero headline — single full-width block ── */}
        <div className="bg-emerald-50 dark:bg-emerald-950/25 px-8 py-6 border-b border-emerald-200 dark:border-emerald-800/40">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Estimated additional contribution available next month
            </p>
          </div>
          <p className="text-5xl font-display font-bold text-emerald-700 dark:text-emerald-300 leading-none mb-2">
            £{RECOVERY_TOTAL_CASH.toLocaleString()}
          </p>
          <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 leading-snug">
            Based on top quantified opportunities from the current 30-day trading baseline
          </p>
        </div>

        {/* ── Opportunity rows — gated by plan via inline blur pattern ── */}
        <div className="bg-card">

          {/* Column header — always visible; badge shown when locked */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Top opportunities driving this estimate
            </p>
            {canAccess("opportunity_breakdown") ? null : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider whitespace-nowrap shrink-0">
                PRO — Unlock opportunity breakdown
              </span>
            )}
          </div>

          {canAccess("opportunity_breakdown") ? (
            /* ── PRO: full rows + toggle + combined footer ── */
            <>
              <div className="divide-y divide-border/40">
                {visibleScenarios.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-6 py-4 hover:bg-secondary/20 transition-colors gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 shrink-0 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{s.shortLabel}</p>
                          <span className={cn(
                            "inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap border",
                            s.confidence === "high"
                              ? "bg-secondary text-muted-foreground border-border/60"
                              : s.confidence === "medium"
                              ? "bg-blue-50 dark:bg-blue-950/25 text-blue-600 dark:text-blue-400 border-blue-200/60 dark:border-blue-700/40"
                              : "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-700/40"
                          )}>
                            {s.confidence === "high"
                              ? "High confidence"
                              : s.confidence === "medium"
                              ? "Medium confidence"
                              : "Requires validation"}
                          </span>
                          <span className={cn(
                            "inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap",
                            s.effort === "low"
                              ? "bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400"
                              : s.effort === "medium"
                              ? "bg-orange-50 dark:bg-orange-950/20 text-orange-500 dark:text-orange-400"
                              : "bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400"
                          )}>
                            {s.effort === "low" ? "Low effort" : s.effort === "medium" ? "Medium effort" : "High effort"}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap bg-primary/8 text-primary border border-primary/15">
                            ⏱ {s.timeframe}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{s.detail}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end text-right shrink-0 ml-4 gap-0.5">
                      <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums leading-tight">
                        +£{s.cashImpact.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground/70">30-day impact</span>
                      <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                        +£{Math.round(s.cashImpact * 12).toLocaleString()} annualised
                      </span>
                      <span className="text-[10px] text-muted-foreground/50 tabular-nums mt-0.5">
                        +{s.ppGain.toFixed(1)}pp CM uplift
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* View more / fewer toggle */}
              {hasMoreScenarios && (
                <button
                  onClick={() => setShowAllOpportunities((v) => !v)}
                  className="w-full flex items-center justify-center gap-1.5 px-6 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/40 border-t border-border/40 transition-colors"
                >
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 transition-transform duration-200",
                      showAllOpportunities && "rotate-180"
                    )}
                  />
                  {showAllOpportunities
                    ? "Show fewer opportunities"
                    : `View ${RECOVERY_SCENARIOS.length - VISIBLE_SCENARIO_COUNT} more opportunities`}
                </button>
              )}

              {/* Combined impact footer */}
              <div className="flex items-center justify-between px-6 py-5 bg-emerald-50/70 dark:bg-emerald-950/15 border-t border-emerald-200 dark:border-emerald-800/40 gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Combined impact next month if implemented now
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    Across {visibleScenarios.length} {visibleScenarios.length === 1 ? "opportunity" : "opportunities"} shown
                  </p>
                </div>
                <div className="flex flex-col items-end text-right shrink-0 ml-4 gap-0.5">
                  <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums leading-tight">
                    +£{RECOVERY_TOTAL_CASH.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70">30-day impact</span>
                  <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                    +£{Math.round(RECOVERY_TOTAL_CASH * 12).toLocaleString()} annualised
                  </span>
                  <span className="text-[10px] text-muted-foreground/50 tabular-nums mt-0.5">
                    +{RECOVERY_TOTAL_PP}pp CM uplift
                  </span>
                </div>
              </div>
            </>
          ) : (
            /* ── FREE: full PRO rows blurred + gradient + indigo upgrade card ── */
            <div className="relative">

              {/* Ghost rows — softer labels, dot ratings, muted values */}
              <div className="pointer-events-none select-none" aria-hidden="true">
                <div className="divide-y divide-border/40">
                  {RECOVERY_SCENARIOS.map((s, i) => (
                    <div key={i} className="flex items-center justify-between px-6 py-4 gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Ranking bullet — muted in free mode so ordering feels less explicit */}
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-border/50 dark:bg-slate-700/30 shrink-0 text-[11px] font-medium text-foreground/30">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          {/* Soft action label — generalised vs Pro-specific wording */}
                          <p className="text-sm font-semibold text-foreground leading-snug">
                            {RECOVERY_GHOST_LABELS[s.shortLabel] ?? s.shortLabel}
                          </p>
                          {/* Dot indicators — replace explicit confidence/effort text */}
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="inline-flex items-center gap-[2px] text-[9px]">
                              <span className="text-foreground/25 mr-0.5">conf</span>
                              {[0,1,2].map(j => {
                                const f = s.confidence === "high" ? 3 : s.confidence === "medium" ? 2 : 1;
                                return <span key={j} className={j < f ? "text-foreground/40" : "text-foreground/15"}>{j < f ? "●" : "○"}</span>;
                              })}
                            </span>
                            <span className="inline-flex items-center gap-[2px] text-[9px]">
                              <span className="text-foreground/25 mr-0.5">effort</span>
                              {[0,1,2].map(j => {
                                const f = s.effort === "low" ? 1 : s.effort === "medium" ? 2 : 3;
                                return <span key={j} className={j < f ? "text-foreground/40" : "text-foreground/15"}>{j < f ? "●" : "○"}</span>;
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Value columns — deeper masking than left-side labels */}
                      <div className="flex items-start gap-5 shrink-0 ml-4">
                        <span className="text-sm font-bold whitespace-nowrap tabular-nums w-12 text-right pt-0.5 text-foreground/[0.13]">
                          +—.—pp
                        </span>
                        <div className="text-right w-20">
                          <p className="text-sm font-bold tabular-nums leading-none text-foreground/[0.13]">
                            £ —,—
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Combined footer — value more muted than label */}
                <div className="flex items-center justify-between px-6 py-4 bg-emerald-50/70 dark:bg-emerald-950/15 border-t border-emerald-200 dark:border-emerald-800/40 gap-4">
                  <p className="text-sm font-semibold text-foreground">Combined impact next month</p>
                  <span className="text-base font-bold tabular-nums text-foreground/[0.13]">
                    £ —,—
                  </span>
                </div>
              </div>

              {/* Gradient fade */}
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent rounded-b-xl pointer-events-none" />

              {/* Indigo upgrade card */}
              <div className="relative mx-6 mb-5 mt-4">
                <a
                  href="/upgrade"
                  className="flex items-center justify-between gap-4 rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/90 dark:bg-indigo-950/40 px-5 py-4 shadow-lg shadow-indigo-500/10 dark:shadow-indigo-900/30 hover:border-indigo-300 hover:bg-indigo-100/90 dark:hover:border-indigo-600 dark:hover:bg-indigo-900/45 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0 mt-0.5">
                      <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 leading-snug">
                        Unlock estimated financial impact
                      </p>
                      <p className="text-xs text-indigo-700/70 dark:text-indigo-400/70 mt-1 leading-snug">
                        See the £ uplift, confidence level, and implementation steps for each opportunity.
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap shrink-0 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                    Upgrade →
                  </span>
                </a>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 3 — ACTUAL PERFORMANCE
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionHeading
        title="Actual Performance"
        subtitle={`Key contribution margin metrics · ${selectedLabel}`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">

        {/* 1 — Contribution Margin */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Contribution Margin</p>
          <p className="text-3xl font-display font-bold text-foreground mb-2">{CM_PCT}%</p>
          <div className="space-y-0.5 mb-3">
            <VarLine
              label="vs last month"
              value={liveCmChangePp !== null ? `${liveCmChangePp >= 0 ? "↑" : "↓"} ${Math.abs(liveCmChangePp).toFixed(1)}pp` : "—"}
              favorable={cmSentiment === "positive"}
            />
            <VarLine
              label={cmVs12mLabel}
              value={`${cmVs12mAvg >= 0 ? "↑" : "↓"} ${Math.abs(cmVs12mAvg).toFixed(1)}pp`}
              favorable={cmVs12mSentiment === "positive"}
            />
          </div>
          {(() => {
            const bm = getBenchmark(CM_PCT);
            return (
              <div className={cn(
                "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg w-fit",
                bm.color === "green" && "bg-emerald-500/10 text-emerald-600",
                bm.color === "amber" && "bg-amber-500/10 text-amber-600",
                bm.color === "red"   && "bg-destructive/10 text-destructive",
              )}>
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  bm.color === "green" && "bg-emerald-500",
                  bm.color === "amber" && "bg-amber-500",
                  bm.color === "red"   && "bg-destructive",
                )} />
                {bm.label}
              </div>
            );
          })()}
        </div>

        {/* 2 — Contribution Profit */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Contribution Profit</p>
          <p className="text-3xl font-display font-bold text-foreground mb-2">{fmt(CM_VALUE)}</p>
          <div className="space-y-0.5 mb-2">
            {/* Phase 2: prior-period contribution profit from month_on_month_delta */}
            {(() => {
              const diff = CM_VALUE - liveContribPrv;
              const favorable = diff >= 0;
              return (
                <VarLine
                  label="vs last month"
                  value={`${favorable ? "+" : "↓ "}£${Math.abs(diff).toLocaleString()}`}
                  favorable={favorable}
                />
              );
            })()}
            <VarLine label="vs 12-month avg" value={`↓ £${(CM_VALUE_LY - CM_VALUE).toLocaleString()}`} favorable={false} />
          </div>
          <p className="text-xs text-muted-foreground">Revenue minus variable costs</p>
        </div>

        {/* 3 — CAC Payback (compact inline gating — full upgrade card doesn't fit 4-col grid) */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm font-medium text-muted-foreground">CAC Payback</p>
            {!canAccess("cac_payback") && (
              <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider whitespace-nowrap shrink-0 mt-0.5">
                PRO — Unlock CAC payback
              </span>
            )}
          </div>
          {canAccess("cac_payback") ? (
            <>
              <p className="text-3xl font-display font-bold text-foreground mb-2">
                {CAC_PAYBACK}<span className="text-xl font-semibold text-muted-foreground ml-1">orders</span>
              </p>
              <div className="space-y-0.5">
                <VarLine label="vs last month" value={`↑ ${(CAC_PAYBACK - CAC_PAYBACK_PREV).toFixed(1)} orders`} favorable={false} />
                <VarLine label="vs 12-month avg" value={`↑ ${(CAC_PAYBACK - CAC_PAYBACK_LY).toFixed(1)} orders`} favorable={false} />
              </div>
            </>
          ) : (
            <>
              <div className="relative">
                <div className="blur-[10px] opacity-[0.7] pointer-events-none select-none" aria-hidden="true">
                  <p className="text-3xl font-display font-bold text-foreground mb-2">
                    {CAC_PAYBACK}<span className="text-xl font-semibold text-muted-foreground ml-1">orders</span>
                  </p>
                  <div className="space-y-0.5">
                    <VarLine label="vs last month" value={`↑ ${(CAC_PAYBACK - CAC_PAYBACK_PREV).toFixed(1)} orders`} favorable={false} />
                    <VarLine label="vs 12-month avg" value={`↑ ${(CAC_PAYBACK - CAC_PAYBACK_LY).toFixed(1)} orders`} favorable={false} />
                  </div>
                </div>
                <div className="absolute inset-0 bg-white/20 dark:bg-slate-950/25 pointer-events-none rounded-lg" />
              </div>
              <a
                href="/upgrade"
                className="block text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mt-3 transition-colors"
              >
                Unlock CAC payback →
              </a>
            </>
          )}
        </div>

        {/* 4 — Contribution per Order */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Contribution per Order</p>
          <p className="text-3xl font-display font-bold text-foreground mb-2">
            £{CONTRIBUTION_PER_ORDER.toFixed(2)}
          </p>
          <div className="space-y-0.5 mb-2">
            {/* Phase 2: prior-period contribution per order from month_on_month_delta */}
            {(() => {
              const diff = CONTRIBUTION_PER_ORDER - liveContribPerOrderPrv;
              const favorable = diff >= 0;
              return (
                <VarLine
                  label="vs last month"
                  value={`${favorable ? "+" : "↓ "}£${Math.abs(diff).toFixed(2)}`}
                  favorable={favorable}
                />
              );
            })()}
            <VarLine label="vs 12-month avg" value={`↓ £${(CONTRIBUTION_PER_ORDER_LY - CONTRIBUTION_PER_ORDER).toFixed(2)}`} favorable={false} />
          </div>
          <p className="text-xs text-muted-foreground leading-snug">Contribution available after variable costs per order</p>
        </div>

      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 4 — WHAT CHANGED MARGIN
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionHeading
        title="What Changed Margin This Month?"
        subtitle={`Attributed cost and pricing changes over ${periodPhrase} — ranked by per-order margin impact.`}
      />

      {/* CFO insight strip */}
      <div className="sc-purple flex items-start gap-3 mb-4 px-5 py-3.5 rounded-xl">
        <Sparkles className="w-4 h-4 text-indigo-300 shrink-0 mt-0.5" />
        <p className="text-sm text-foreground leading-relaxed">
          <span className="font-semibold">Meta CAC is the single largest drag</span> — accounting for £3.40 of the £8.90 total per-order margin decline this month. The fastest path to margin recovery runs through channel mix and discount discipline.
        </p>
      </div>

      {/* Summary line */}
      <div className="sc-orange flex items-start justify-between mb-4 px-5 py-3.5 rounded-xl gap-6">
        <p className="text-sm font-semibold text-foreground mt-0.5">Total margin impact — {selectedLabel}</p>
        <div className="text-right shrink-0">
          <p className={cn(
            "text-lg font-bold tabular-nums leading-none",
            CHANGE_DRIVERS_TOTAL < 0 ? "text-destructive" : "text-emerald-600"
          )}>
            {CHANGE_DRIVERS_TOTAL < 0 ? "−" : "+"}£{Math.abs(CHANGE_DRIVERS_TOTAL).toFixed(2)} per order
          </p>
          <p className={cn(
            "text-xs font-medium tabular-nums mt-1.5 leading-none",
            CHANGE_DRIVERS_TOTAL < 0 ? "text-destructive/70" : "text-emerald-600/70"
          )}>
            ≈ {CHANGE_DRIVERS_MONTHLY_IMPACT < 0 ? "−" : "+"}£{Math.abs(CHANGE_DRIVERS_MONTHLY_IMPACT).toLocaleString()} estimated — {selectedLabel.toLowerCase()}
          </p>
        </div>
      </div>

      <PremiumBlurPreview
        title="Driver Attribution"
        subtitle="What changed vs last month and the per-order margin impact."
        badgeText="PRO — Unlock margin drivers"
        ctaTitle="Unlock attributed margin driver breakdown"
        ctaDescription="See exactly what changed this period and how much each factor impacted your margin per order."
        isPro={canAccess("driver_breakdown")}
        className="overflow-hidden mb-10"
        ghostContent={
          <div className="-mx-6 -mb-6">
            <div className="flex items-center justify-between px-6 py-3 border-t border-border/50 bg-secondary/20">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                What changed this period vs last month
              </p>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Margin impact / order
              </p>
            </div>
            <div className="divide-y divide-border/40">
              {[...CHANGE_DRIVERS]
                .sort((a, b) => Math.abs(b.impactPerOrder) - Math.abs(a.impactPerOrder))
                .map((row, i) => (
                  <div key={row.driver} className="flex items-center justify-between px-6 py-4 gap-6">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("w-1 self-stretch rounded-full shrink-0 min-h-[2rem]", i === 0 ? "bg-destructive" : "bg-destructive/25")} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{DRIVER_GHOST_LABELS[row.driver] ?? row.driver}</span>
                          <span className={cn(
                            "inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap",
                            row.direction === "negative" ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-600"
                          )}>
                            {row.direction === "negative" ? "↑" : "↓"}
                          </span>
                          {i === 0 && (
                            <span className="inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 whitespace-nowrap">
                              Largest driver
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-bold whitespace-nowrap shrink-0 tabular-nums text-foreground/25 dark:text-foreground/20">
                      {row.direction === "negative" ? "−" : "+"}£ —.——
                    </span>
                  </div>
                ))}
            </div>
          </div>
        }
      >
        {/* Negative-margin wrapper extends table flush to card edges */}
        <div className="-mx-6 -mb-6">

          {/* Column headers */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-border/50 bg-secondary/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              What changed this period vs last month
            </p>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Margin impact / order
            </p>
          </div>

          {/* Driver rows — sorted by absolute impact descending */}
          <div className="divide-y divide-border/40">
            {[...CHANGE_DRIVERS]
              .sort((a, b) => Math.abs(b.impactPerOrder) - Math.abs(a.impactPerOrder))
              .map((row, i) => {
                const isLargest  = i === 0;
                const isNegative = row.direction === "negative";
                const impactAbs  = Math.abs(row.impactPerOrder).toFixed(2);
                return (
                  <div
                    key={row.driver}
                    className="flex items-center justify-between px-6 py-4 gap-6 hover:bg-secondary/20 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Severity bar */}
                      <div className={cn(
                        "w-1 self-stretch rounded-full shrink-0 min-h-[2rem]",
                        isLargest ? "bg-destructive" : "bg-destructive/25"
                      )} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{row.driver}</span>
                          <span className={cn(
                            "inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap",
                            isNegative
                              ? "bg-destructive/10 text-destructive"
                              : "bg-emerald-500/10 text-emerald-600"
                          )}>
                            {isNegative ? "↑" : "↓"} {row.change}
                          </span>
                          {isLargest && (
                            <span className="inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 whitespace-nowrap">
                              Largest driver
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={cn(
                      "text-sm font-bold whitespace-nowrap shrink-0 tabular-nums",
                      isNegative ? "text-destructive" : "text-emerald-600"
                    )}>
                      {isNegative ? "−" : "+"}£{impactAbs}
                    </span>
                  </div>
                );
              })}
          </div>

        </div>
      </PremiumBlurPreview>

      {/* ══════════════════════════════════════════════════════════════════════
          MARGIN RISK OUTLOOK
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="mb-10">
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl overflow-hidden shadow-sm">

          <div className="flex items-center gap-3 px-6 py-4 border-b border-amber-200 dark:border-amber-800/50">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                Margin Risk Outlook
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-0.5 leading-snug">
                {RISK_MONITOR.trajectoryNote}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-amber-200 dark:bg-amber-800/40">
            {RISK_MONITOR.thresholds.map((t) => (
              <div key={t.pct} className="bg-amber-50 dark:bg-amber-950/20 px-6 py-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={
                      t.color === "red"
                        ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive"
                        : "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200"
                    }>
                      {t.label}
                    </span>
                    <span className="text-xs text-muted-foreground">if CM falls below</span>
                    <span className={
                      t.color === "red"
                        ? "text-base font-bold text-destructive"
                        : "text-base font-bold text-amber-700 dark:text-amber-300"
                    }>
                      {t.pct}%
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">at current rate</p>
                    <p className={
                      t.color === "red"
                        ? "text-sm font-semibold text-destructive"
                        : "text-sm font-semibold text-amber-700 dark:text-amber-300"
                    }>
                      ~{t.monthsAtCurrentRate} months
                    </p>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {t.implications.map((imp) => (
                    <li key={imp} className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
                      <span className={
                        t.color === "red"
                          ? "mt-1.5 w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0"
                          : "mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"
                      } />
                      {imp}
                    </li>
                  ))}
                </ul>
                <p className={cn(
                  "mt-3 text-xs font-semibold leading-snug",
                  t.color === "red" ? "text-destructive/80" : "text-amber-700 dark:text-amber-400"
                )}>
                  At this level, scaling paid acquisition becomes capital-destructive.
                </p>
              </div>
            ))}
          </div>

          <div className="px-6 py-4 bg-amber-100/60 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800/50">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Current margin:{" "}
                <span className="font-semibold">{RISK_MONITOR.currentCm}%</span>
                {" "}·{" "}
                <span className="font-semibold">
                  {(RISK_MONITOR.currentCm - RISK_MONITOR.thresholds[0].pct).toFixed(1)}pp
                </span>
                {" "}above the warning threshold · Updates automatically with live data.
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold sm:ml-auto whitespace-nowrap shrink-0">
                Recommended action: Reduce Meta CAC by 10–15%
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 5 — DETAILED ANALYSIS
      ══════════════════════════════════════════════════════════════════════ */}

      {/* De-emphasised heading — signals optional deeper-dive content */}
      <div className="mt-14 pt-8 border-t border-border/40 mb-6">
        <div className="flex items-center gap-3 mb-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 bg-secondary px-2.5 py-0.5 rounded-full whitespace-nowrap">
            Deeper dive
          </span>
          <div className="flex-1 h-px bg-border/40" />
        </div>
        <h2 className="text-xl font-bold text-muted-foreground">Detailed Analysis</h2>
        <p className="text-sm text-muted-foreground/60 mt-1 leading-relaxed">
          Full breakdown of cost structure, channel performance, margin trend, and unit economics.
        </p>
      </div>

      {/* Contribution Margin Bridge */}
      <PremiumBlurPreview
        title="Contribution Margin Bridge"
        subtitle={`How revenue converts into contribution margin — total and per order · ${selectedLabel}`}
        badgeText="PRO — Unlock margin bridge"
        ctaTitle="Unlock contribution margin bridge"
        ctaDescription="See exactly where margin is being lost across discounts, shipping, fulfilment, and marketing."
        isPro={canAccess("margin_bridge")}
        description="Figures sourced from Shopify orders data. Fulfilment and payment costs are estimated from 3PL invoices and Shopify Payments reports — verify against actual invoices for final accuracy."
        className="mb-8"
        ghostContent={
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 pr-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Metric</th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Total (£)</th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">% of Revenue</th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Per Order (£)</th>
                  <th className="text-right py-2.5 pl-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trend</th>
                </tr>
              </thead>
              <tbody>
                {BRIDGE_ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-border/40">
                    <td className="py-3 pr-4 font-medium text-foreground">{row.label}</td>
                    <td className="py-3 px-4 text-right tabular-nums font-semibold text-foreground/25 dark:text-foreground/20 whitespace-nowrap">
                      {row.type === "revenue" ? "£ " : "−£ "}—,———
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-foreground/25 dark:text-foreground/20 whitespace-nowrap">
                      {row.type === "revenue" ? "" : "−"}—.—%
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-foreground/25 dark:text-foreground/20 whitespace-nowrap">
                      {row.type === "revenue" ? "" : "−"}£ —.——
                    </td>
                    <td className="py-3 pl-4 text-right">
                      {row.trend === "worsening" ? (
                        <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive whitespace-nowrap">↑ cost</span>
                      ) : row.trend === "improving" ? (
                        <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 whitespace-nowrap">↓ cost</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-primary/30 bg-primary/5">
                  <td className="py-3.5 pr-4"><span className="font-bold text-foreground">Contribution Margin</span></td>
                  <td className="py-3.5 px-4 text-right tabular-nums font-bold text-foreground/25 dark:text-foreground/20 whitespace-nowrap">£ —,———</td>
                  <td className="py-3.5 px-4 text-right tabular-nums font-bold text-foreground/25 dark:text-foreground/20 whitespace-nowrap">—.—%</td>
                  <td className="py-3.5 px-4 text-right tabular-nums font-bold text-foreground/25 dark:text-foreground/20 whitespace-nowrap">£ —.——</td>
                  <td className="py-3.5 pl-4 text-right">
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive whitespace-nowrap">
                      <ArrowDownRight className="w-2.5 h-2.5" />
                      ↓ margin
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2.5 pr-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Metric
                </th>
                <th className="text-right py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  Total (£)
                </th>
                <th className="text-right py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  % of Revenue
                </th>
                <th className="text-right py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  Per Order (£)
                </th>
                <th className="text-right py-2.5 pl-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody>
              {liveBridgeRows.map((row) => {
                const revenueTotal = liveBridgeRows[0].total;
                const isRevenue   = row.type === "revenue";
                const totalStr    = isRevenue
                  ? `£${row.total.toLocaleString()}`
                  : `−£${Math.abs(row.total).toLocaleString()}`;
                const pctRaw      = (row.total / revenueTotal) * 100;
                const pctStr      = isRevenue
                  ? `${pctRaw.toFixed(1)}%`
                  : `−${Math.abs(pctRaw).toFixed(1)}%`;
                const perOrderStr = `£${Math.abs(row.perOrder).toFixed(2)}`;

                return (
                  <tr
                    key={row.label}
                    className="border-b border-border/40 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="py-3 pr-4 font-medium text-foreground">{row.label}</td>
                    <td className={cn(
                      "py-3 px-4 text-right tabular-nums font-semibold",
                      isRevenue ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {totalStr}
                    </td>
                    <td className={cn(
                      "py-3 px-4 text-right tabular-nums",
                      isRevenue ? "text-foreground font-semibold" : "text-muted-foreground"
                    )}>
                      {pctStr}
                    </td>
                    <td className={cn(
                      "py-3 px-4 text-right tabular-nums",
                      isRevenue ? "text-foreground font-semibold" : "text-muted-foreground"
                    )}>
                      {isRevenue ? "" : "−"}{perOrderStr}
                    </td>
                    <td className="py-3 pl-4 text-right">
                      {row.trend === "worsening" ? (
                        <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive whitespace-nowrap">
                          ↑ cost
                        </span>
                      ) : row.trend === "improving" ? (
                        <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                          ↓ cost
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-primary/30 bg-primary/5">
                <td className="py-3.5 pr-4">
                  <span className="font-bold text-foreground">Contribution Margin</span>
                </td>
                <td className="py-3.5 px-4 text-right tabular-nums font-bold text-foreground">
                  £{CM_VALUE.toLocaleString()}
                </td>
                <td className="py-3.5 px-4 text-right tabular-nums font-bold text-primary">
                  {CM_PCT}%
                </td>
                <td className="py-3.5 px-4 text-right tabular-nums font-bold text-foreground">
                  £{CONTRIBUTION_PER_ORDER.toFixed(2)}
                </td>
                <td className="py-3.5 pl-4 text-right">
                  {cmSentiment === "positive" ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                      <ArrowUpRight className="w-2.5 h-2.5" />
                      ↑ margin
                    </span>
                  ) : cmSentiment === "negative" ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive whitespace-nowrap">
                      <ArrowDownRight className="w-2.5 h-2.5" />
                      ↓ margin
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </PremiumBlurPreview>

      {/* Contribution Margin by Channel — gated by plan */}
      {(() => {
        const maxCm  = Math.max(...CHANNELS.map(c => c.cm));
        const minCm  = Math.min(...CHANNELS.map(c => c.cm));
        const sorted = [...CHANNELS].sort((a, b) => b.cm - a.cm);
        return (
          <PremiumBlurPreview
            title="Contribution Margin by Channel"
            subtitle={`Contribution margin % per acquisition channel · ${selectedLabel}`}
            badgeText="PRO — Unlock channel diagnostics"
            ctaTitle="Unlock channel margin diagnostics"
            ctaDescription="See which channels are creating margin and which are dragging blended profitability."
            isPro={canAccess("channel_margin_analysis")}
            className="mb-8"
            ghostContent={
              <ul className="space-y-4">
                {(() => {
                  const ghostWidths = ["80%", "72%", "58%", "46%"];
                  return sorted.map((ch, i) => {
                    const isMax = ch.cm === maxCm;
                    const isMin = ch.cm === minCm;
                    return (
                      <li key={ch.name}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{CHANNEL_GHOST_NAMES[i] ?? `Channel ${i + 1}`}</span>
                            {isMax && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">Highest</span>
                            )}
                            {isMin && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">Lowest</span>
                            )}
                          </div>
                          <span className="text-sm font-bold tabular-nums text-foreground/25 dark:text-foreground/20">—%</span>
                        </div>
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", isMax ? "bg-emerald-500/50" : isMin ? "bg-destructive/50" : "bg-primary/50")}
                            style={{ width: ghostWidths[i] }}
                          />
                        </div>
                      </li>
                    );
                  });
                })()}
                <li className="mt-1 flex items-start gap-2 p-3 rounded-xl bg-secondary/50">
                  <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground/25 dark:text-foreground/20 leading-snug">
                    Unlock Pro to see contribution margin % per channel, and understand which channels are dragging blended profitability.
                  </p>
                </li>
              </ul>
            }
          >
            <ul className="space-y-4">
              {sorted.map((ch) => {
                const isMax = ch.cm === maxCm;
                const isMin = ch.cm === minCm;
                return (
                  <li key={ch.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{ch.name}</span>
                        {isMax && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                            Highest
                          </span>
                        )}
                        {isMin && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                            Lowest
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          £{ch.revenue.toLocaleString()} revenue
                        </span>
                        <span className={cn(
                          "text-sm font-bold tabular-nums w-14 text-right",
                          isMax ? "text-emerald-600" : isMin ? "text-destructive" : "text-foreground"
                        )}>
                          {ch.cm}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          isMax ? "bg-emerald-500" : isMin ? "bg-destructive" : "bg-primary"
                        )}
                        style={{ width: `${(ch.cm / 70) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex items-start gap-2 p-3 rounded-xl bg-secondary/50">
              <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground leading-snug">
                  Meta has the widest revenue share (£41,800) but the lowest contribution margin at 34.2%. The 24pp spread between Meta and Email is the primary driver of channel mix underperformance — reflected in the estimated additional contribution quantified above.
                </p>
                <p className="text-xs text-muted-foreground/60 mt-2 leading-snug italic">
                  If Meta improved to Organic-level margin (52.3%), estimated contribution would increase materially at the current revenue mix — without increasing total spend.
                </p>
              </div>
            </div>
          </PremiumBlurPreview>
        );
      })()}

      {/* Margin Trend */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50 mb-8">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-semibold text-lg text-foreground">Margin Trend</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Contribution margin % — {selectedLabel}</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary px-2.5 py-1.5 rounded-lg">
            <span className="w-3 h-3 rounded-sm border-2 border-primary inline-block" />
            Same month, 1 year apart
          </div>
        </div>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={TREND_DATA} margin={{ top: 14, right: 14, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                dy={8}
              />
              <YAxis
                domain={[38, 52]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                formatter={(v: number) => [`${v}%`, "Contribution Margin"]}
              />
              <ReferenceLine y={CM_PCT} stroke="hsl(var(--destructive))" strokeDasharray="4 4" strokeWidth={1} />
              <Line
                type="monotone"
                dataKey="margin"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={(props: any) => {
                  const { cx, cy, index } = props;
                  const isHighlighted = index === 0 || index === TREND_DATA.length - 1;
                  if (isHighlighted) {
                    return (
                      <circle
                        key={index}
                        cx={cx}
                        cy={cy}
                        r={7}
                        stroke="hsl(var(--primary))"
                        strokeWidth={2.5}
                        fill="hsl(var(--card))"
                      />
                    );
                  }
                  return <circle key={index} cx={cx} cy={cy} r={3} fill="hsl(var(--primary))" />;
                }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-4 text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-4">
          Contribution margin has declined 5.9pp year-on-year (48.2% → 42.3%). The steepest decline occurred Jan–Mar 2026 (−2.6pp), coinciding with Meta CAC increases and deeper discount use post-Christmas. See "What Changed Margin This Month?" above for a full attributed breakdown.
        </p>
      </div>

      {/* Unit Economics — 13-Month */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h3 className="font-semibold text-lg text-foreground">Unit Economics — 13-Month View</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Revenue per order vs contribution per order · {selectedLabel}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-primary/30 inline-block" />
              Revenue per order
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-primary inline-block" />
              Contribution per order
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border-2 border-primary inline-block" />
              Same month, 1 year apart
            </span>
          </div>
        </div>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={UNIT_ECON_HISTORY} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                dy={8}
              />
              <YAxis
                domain={[0, 85]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickFormatter={(v) => `£${v}`}
              />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                formatter={(v: number, name: string) => [
                  `£${v.toFixed(2)}`,
                  name === "revenue" ? "Revenue per order" : "Contribution per order",
                ]}
              />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                {UNIT_ECON_HISTORY.map((_, index) => {
                  const isHighlighted = index === 0 || index === UNIT_ECON_HISTORY.length - 1;
                  return (
                    <Cell
                      key={index}
                      fill="hsl(var(--primary))"
                      fillOpacity={0.2}
                      stroke={isHighlighted ? "hsl(var(--primary))" : "none"}
                      strokeWidth={isHighlighted ? 2 : 0}
                    />
                  );
                })}
              </Bar>
              <Bar dataKey="contribution" radius={[4, 4, 0, 0]}>
                {UNIT_ECON_HISTORY.map((_, index) => {
                  const isHighlighted = index === 0 || index === UNIT_ECON_HISTORY.length - 1;
                  const isLast = index === UNIT_ECON_HISTORY.length - 1;
                  return (
                    <Cell
                      key={index}
                      fill={isLast ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
                      stroke={isHighlighted ? (isLast ? "hsl(var(--destructive))" : "hsl(var(--primary))") : "none"}
                      strokeWidth={isHighlighted ? 2 : 0}
                      fillOpacity={isHighlighted ? 1 : 0.85}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-4 text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-4">
          Contribution per order has fallen from £40.50 (Mar '25) to £35.00 (Mar '26), a year-on-year drop of £5.50. The widening gap between revenue and contribution signals rising variable costs per order.
        </p>
      </div>

      <DataBenchmarkAssumptions
        benchmarkNote="Typical healthy DTC contribution margin range: 45–60%. Current: 42.3%."
        dataQualityNote="Margin analysis depends on product costs, shipping, discounts and marketing spend being mapped correctly."
        className="mb-2"
      />

    </AppLayout>
  );
}
