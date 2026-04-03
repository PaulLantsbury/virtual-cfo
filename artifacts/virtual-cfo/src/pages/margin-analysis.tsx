import { useState } from "react";
import { ArrowDownRight, TrendingUp, Info, Sparkles, AlertTriangle, ChevronDown } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { UpgradePreviewCard } from "@/components/UpgradePreviewCard";
import { isProUser } from "@/lib/plan";
import { cn } from "@/lib/utils";

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

const CM_VALUE = 52913;
const CM_PCT   = 42.3;
const CM_PREV  = 45.8;
const CM_CHANGE = +(CM_PCT - CM_PREV).toFixed(1);

const CAC_PAYBACK        = 1.4;
const CAC_PAYBACK_PREV   = 1.1;

const BENCHMARK_TARGET = { low: 45, high: 55 };

const BRIDGE_ROWS = [
  { label: "Revenue",          total: 124500, perOrder: 68.40, type: "revenue",   trend: "stable"    },
  { label: "Discounts",        total:  -8715, perOrder: -8.10, type: "deduction", trend: "worsening" },
  { label: "Payment fees",     total:  -2490, perOrder: -1.90, type: "deduction", trend: "stable"    },
  { label: "Shipping costs",   total: -15562, perOrder: -4.80, type: "deduction", trend: "worsening" },
  { label: "Fulfilment costs", total: -17430, perOrder: -6.40, type: "deduction", trend: "stable"    },
  { label: "Marketing spend",  total: -27390, perOrder:-12.20, type: "deduction", trend: "worsening" },
] as const;

// ─── KPI metrics & variance data ─────────────────────────────────────────────
// @dynamic All values replace with live-computed deltas (current − period_value)

/** Contribution per order */
const CONTRIBUTION_PER_ORDER         = 35.00;
const CONTRIBUTION_PER_ORDER_PREV_M  = 38.20;  // last month
const CONTRIBUTION_PER_ORDER_LY      = 40.50;  // same month last year (UNIT_ECON_HISTORY[0])

/** Contribution Margin — YoY baseline from TREND_DATA[0] */
const CM_LY = 48.2;

/** Contribution Profit — prior periods (estimated from historical CM × revenue) */
const CM_VALUE_PREV_M = 57_125;  // 45.8% of prior month revenue
const CM_VALUE_LY     = 56_972;  // 48.2% of last-year revenue

/** CAC Payback — year-ago baseline */
const CAC_PAYBACK_LY = 0.9;

/** Average Discount % — @dynamic computed from Shopify order discount data */
const AVG_DISCOUNT_PCT    = 7.0;
const AVG_DISCOUNT_PREV_M = 5.2;
const AVG_DISCOUNT_LY     = 4.8;

/** Returns % — @dynamic computed from Shopify returns data */
const RETURNS_PCT    = 2.1;
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
  headline: "Profit margin below target — £20,400 recoverable next month",
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
  },
];

/** Number of scenarios shown by default; extras revealed via "View more" */
const VISIBLE_SCENARIO_COUNT = 3;
const RECOVERY_TOTAL_PP   = +RECOVERY_SCENARIOS.reduce((s, r) => s + r.ppGain,    0).toFixed(1);
const RECOVERY_TOTAL_CASH =  RECOVERY_SCENARIOS.reduce((s, r) => s + r.cashImpact, 0);
const RECOVERY_TARGET_CM  = +(CM_PCT + RECOVERY_TOTAL_PP).toFixed(1);

/**
 * @dynamic Thresholds and trajectory can be computed from rolling CM data when live.
 */
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
} as const;

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

const CHANNELS = [
  { name: "Meta",             cm: 34.2, revenue: 41800 },
  { name: "Google Shopping",  cm: 40.1, revenue: 28600 },
  { name: "Email",            cm: 58.6, revenue: 22100 },
  { name: "Organic",          cm: 52.3, revenue: 32000 },
];

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

/** @dynamic Derived from Shopify order count for the period (≈ revenue ÷ AOV) */
const MONTHLY_ORDER_VOLUME = 2000;

/** @dynamic = CHANGE_DRIVERS_TOTAL × MONTHLY_ORDER_VOLUME, rounded to nearest £100 */
const CHANGE_DRIVERS_MONTHLY_IMPACT =
  Math.round((CHANGE_DRIVERS_TOTAL * MONTHLY_ORDER_VOLUME) / 100) * 100;

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

// ─── Timeframe options ────────────────────────────────────────────────────────

const TIMEFRAME_OPTIONS = [
  { value: "7d",     label: "Last 7 days"    },
  { value: "30d",    label: "Last 30 days"   },
  { value: "90d",    label: "Last 90 days"   },
  { value: "12m",    label: "Last 12 months" },
  { value: "custom", label: "Custom"         },
] as const;

type TimeframeValue = typeof TIMEFRAME_OPTIONS[number]["value"];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MarginAnalysis() {
  const [timeframe, setTimeframe] = useState<TimeframeValue>("30d");
  const [showAllOpportunities, setShowAllOpportunities] = useState(false);

  const visibleScenarios = showAllOpportunities
    ? RECOVERY_SCENARIOS
    : RECOVERY_SCENARIOS.slice(0, VISIBLE_SCENARIO_COUNT);
  const hasMoreScenarios = RECOVERY_SCENARIOS.length > VISIBLE_SCENARIO_COUNT;

  const selectedLabel = TIMEFRAME_OPTIONS.find((o) => o.value === timeframe)!.label;

  // Human-readable period phrase used inline in section subtitles and labels
  const periodPhrase: Record<TimeframeValue, string> = {
    "7d":     "the last 7 days",
    "30d":    "the last 30 days",
    "90d":    "the last 90 days",
    "12m":    "the last 12 months",
    "custom": "the selected period",
  };

  return (
    <AppLayout>
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Profit Margin Analysis
          </h1>
          <p className="text-muted-foreground mt-1">
            Understand current profit performance, the biggest upside opportunities, and what is driving change.
          </p>
        </div>

        {/* Controls: timeframe selector + period badge */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Timeframe selector */}
          <div className="relative">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as TimeframeValue)}
              className="appearance-none bg-secondary text-sm font-medium text-foreground pl-3 pr-8 py-1.5 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 border border-border/40"
              aria-label="Select timeframe for performance views"
            >
              {TIMEFRAME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <span className="text-sm text-muted-foreground font-medium bg-secondary px-3 py-1.5 rounded-lg border border-border/40 whitespace-nowrap">
            March 2026
          </span>
        </div>
      </div>

      {/* Custom range informational note */}
      {timeframe === "custom" && (
        <div className="flex items-center gap-2.5 mb-8 px-4 py-3 rounded-xl bg-secondary border border-border/50">
          <Info className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            Custom date range picker coming soon — performance views are currently showing Last 30 days data.
          </p>
        </div>
      )}

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
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-sm font-semibold text-destructive">
                  ↓ {Math.abs(CM_CHANGE)}pp
                </span>
                <span className="text-xs text-muted-foreground">vs last month</span>
              </div>

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

            {/* 2 — Recoverable Next Month */}
            <div className="pl-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Recoverable Next Month
              </p>
              <p className="text-4xl sm:text-5xl font-display font-bold text-emerald-600 dark:text-emerald-400 leading-none mb-2">
                £{RECOVERY_TOTAL_CASH.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground leading-snug max-w-[26ch]">
                Sum of quantified opportunities — see breakdown below
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

            {/* Fastest recovery lever */}
            <div className="rounded-xl bg-emerald-100/80 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700/60 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">
                Fastest recovery lever
              </p>
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200 leading-relaxed">
                {CFO_INSIGHT.fastestLever}
              </p>
              <p className="text-xs text-emerald-700/60 dark:text-emerald-400/60 mt-3 leading-snug">
                See quantified opportunities below ↓
              </p>
            </div>

          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 — OPPORTUNITIES
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionHeading
        title="Opportunities"
        subtitle="Top profit improvement opportunities ranked by expected contribution uplift next month."
        support="Based on the current 30-day trading baseline and prioritised by financial impact."
      />

      {/* ── Structured opportunities panel ── */}
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 shadow-sm mb-8 overflow-hidden">

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

        {/* ── Opportunity rows — gated by plan ── */}
        {isProUser() ? (
          /* ── PRO: full breakdown ── */
          <div className="bg-card">

            {/* Column header row */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Top opportunities driving this estimate
              </p>
              <div className="flex items-center gap-5 shrink-0 ml-4 text-right">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-12 text-right">
                  CM gain
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-20 text-right">
                  £ next month
                </span>
              </div>
            </div>

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
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{s.detail}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-5 shrink-0 ml-4">
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap tabular-nums w-12 text-right pt-0.5">
                      +{s.ppGain.toFixed(1)}pp
                    </span>
                    <div className="text-right w-20">
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 tabular-nums leading-none">
                        £{s.cashImpact.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/50 mt-1 leading-none">
                        next month
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* View more / fewer toggle — only renders when there are hidden scenarios */}
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
            <div className="flex items-center justify-between px-6 py-4 bg-emerald-50/70 dark:bg-emerald-950/15 border-t border-emerald-200 dark:border-emerald-800/40 gap-4">
              <p className="text-sm font-semibold text-foreground">
                Combined impact — if all {RECOVERY_SCENARIOS.length} changes are implemented
              </p>
              <div className="flex items-start gap-5 shrink-0 ml-4">
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap tabular-nums w-12 text-right pt-0.5">
                  +{RECOVERY_TOTAL_PP}pp
                </span>
                <div className="text-right w-20">
                  <p className="text-base font-bold text-emerald-700 dark:text-emerald-300 tabular-nums leading-none">
                    ≈ £{RECOVERY_TOTAL_CASH.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/50 mt-1 leading-none">
                    next month
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ── FREE: names only + upgrade card ── */
          <div className="bg-card">
            <div className="px-6 py-3 border-b border-border/50">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Top opportunities identified
              </p>
            </div>
            <div className="divide-y divide-border/40">
              {RECOVERY_SCENARIOS.map((s, i) => (
                <div key={i} className="flex items-center gap-3 px-6 py-4">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 shrink-0 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    {i + 1}
                  </span>
                  <p className="text-sm font-semibold text-foreground">{s.shortLabel}</p>
                </div>
              ))}
            </div>

            {/* Upgrade preview card */}
            <UpgradePreviewCard
              title="Unlock estimated financial impact and implementation steps"
              className="mx-6 my-5"
            />
          </div>
        )}
      </div>

      {/* Margin Risk Monitor */}
      <div className="mb-10">
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-amber-200 dark:border-amber-800/50">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                Margin Risk Monitor
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
              </div>
            ))}
          </div>

          <div className="px-6 py-3 bg-amber-100/60 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800/50">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Current margin:{" "}
              <span className="font-semibold">{RISK_MONITOR.currentCm}%</span>
              {" "}·{" "}
              <span className="font-semibold">
                {(RISK_MONITOR.currentCm - RISK_MONITOR.thresholds[0].pct).toFixed(1)}pp
              </span>
              {" "}above the warning threshold · Updates automatically with live data.
            </p>
          </div>
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
            <VarLine label="vs last month" value={`↓ ${Math.abs(CM_CHANGE)}pp`} favorable={false} />
            <VarLine label="vs last 12 months" value={`↓ ${Math.abs(CM_PCT - CM_LY).toFixed(1)}pp`} favorable={false} />
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
            <VarLine label="vs last month" value={`↓ £${(CM_VALUE_PREV_M - CM_VALUE).toLocaleString()}`} favorable={false} />
            <VarLine label="vs last 12 months" value={`↓ £${(CM_VALUE_LY - CM_VALUE).toLocaleString()}`} favorable={false} />
          </div>
          <p className="text-xs text-muted-foreground">Revenue minus variable costs</p>
        </div>

        {/* 3 — CAC Payback */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
          {isProUser() ? (
            /* ── PRO: full card ── */
            <>
              <p className="text-sm font-medium text-muted-foreground mb-1">CAC Payback Period</p>
              <p className="text-3xl font-display font-bold text-foreground mb-2">
                {CAC_PAYBACK}<span className="text-xl font-semibold text-muted-foreground ml-1">orders</span>
              </p>
              <div className="space-y-0.5 mb-2">
                <VarLine label="vs last month" value={`↑ ${(CAC_PAYBACK - CAC_PAYBACK_PREV).toFixed(1)} orders`} favorable={false} />
                <VarLine label="vs last 12 months" value={`↑ ${(CAC_PAYBACK - CAC_PAYBACK_LY).toFixed(1)} orders`} favorable={false} />
              </div>
              <p className="text-xs text-muted-foreground leading-snug">Orders needed to recover acquisition cost</p>
            </>
          ) : (
            /* ── FREE: teaser only ── */
            <>
              <p className="text-sm font-medium text-muted-foreground mb-3">CAC Payback Period</p>
              <UpgradePreviewCard
                title="Unlock detailed acquisition efficiency diagnostics"
              />
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
            <VarLine label="vs last month" value={`↓ £${(CONTRIBUTION_PER_ORDER_PREV_M - CONTRIBUTION_PER_ORDER).toFixed(2)}`} favorable={false} />
            <VarLine label="vs last 12 months" value={`↓ £${(CONTRIBUTION_PER_ORDER_LY - CONTRIBUTION_PER_ORDER).toFixed(2)}`} favorable={false} />
          </div>
          <p className="text-xs text-muted-foreground leading-snug">Contribution available after variable costs per order</p>
        </div>

      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 4 — KEY DRIVERS
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionHeading
        title="Key Drivers"
        subtitle={`What changed over ${periodPhrase[timeframe]} and the financial impact per order on contribution margin.`}
      />

      {/* Summary line */}
      <div className="flex items-start justify-between mb-4 px-5 py-3.5 rounded-xl bg-destructive/5 border border-destructive/15 gap-6">
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

      {isProUser() ? (
        /* ── PRO: full driver attribution table ── */
        <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-10">
          {/* Column headers */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border/50 bg-secondary/20">
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
      ) : (
        /* ── FREE: upgrade prompt ── */
        <UpgradePreviewCard
          title="Unlock driver-level breakdown showing exactly what changed"
          className="mb-10"
        />
      )}

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
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">
        <div className="mb-5">
          <h3 className="font-semibold text-lg text-foreground">Contribution Margin Bridge</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            How revenue converts into contribution margin — total and per order · {selectedLabel}
          </p>
        </div>

        {isProUser() ? (
          /* ── PRO: full bridge table ── */
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
                {BRIDGE_ROWS.map((row) => {
                  const revenueTotal = BRIDGE_ROWS[0].total;
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
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive whitespace-nowrap">
                      <ArrowDownRight className="w-2.5 h-2.5" />
                      ↓ margin
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          /* ── FREE: upgrade card ── */
          <UpgradePreviewCard
            title="Unlock contribution margin bridge analysis"
            description="See exactly where margin is being lost across discounts, shipping, fulfilment, and marketing →"
          />
        )}

      </div>

      {/* Contribution Margin by Channel */}
      {(() => {
        const maxCm = Math.max(...CHANNELS.map(c => c.cm));
        const minCm = Math.min(...CHANNELS.map(c => c.cm));
        const sorted = [...CHANNELS].sort((a, b) => b.cm - a.cm);
        return (
          <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">
            <div className="mb-5">
              <h3 className="font-semibold text-lg text-foreground">Contribution Margin by Channel</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Contribution margin % per acquisition channel · {selectedLabel}
              </p>
            </div>
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
              <p className="text-xs text-muted-foreground leading-snug">
                Meta has the widest revenue share (£41,800) but the lowest contribution margin at 34.2%. The 24pp spread between Meta and Email is the primary driver of channel mix underperformance — the data behind the opportunity quantified above.
              </p>
            </div>
          </div>
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
          Margin has declined 5.9pp vs the same month last year (48.2% → 42.3%), driven by higher shipping, fulfilment, and marketing costs.
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

    </AppLayout>
  );
}
