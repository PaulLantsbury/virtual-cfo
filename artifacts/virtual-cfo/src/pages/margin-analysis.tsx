import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, TrendingDown, TrendingUp, Info, ChevronDown, ChevronRight, Sparkles, AlertTriangle } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { ActionRecommendations } from "@/components/ActionRecommendations";
import type { Recommendation } from "@/components/ActionRecommendations";
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

const BREAKDOWN = [
  { label: "Revenue",          value: 124500, pct: 100,   type: "revenue" },
  { label: "Discounts",        value:  -8715, pct:  -7.0, type: "deduction" },
  { label: "Payment fees",     value:  -2490, pct:  -2.0, type: "deduction" },
  { label: "Shipping costs",   value: -15562, pct: -12.5, type: "deduction" },
  { label: "Fulfilment costs", value: -17430, pct: -14.0, type: "deduction" },
  { label: "Marketing spend",  value: -27390, pct: -22.0, type: "deduction" },
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

/** @dynamic Derived from BRIDGE_ROWS deductions — stays in sync when data is live */
const VARIABLE_COST_PER_ORDER = +BRIDGE_ROWS
  .filter((r) => r.type === "deduction")
  .reduce((s, r) => s + Math.abs(r.perOrder), 0)
  .toFixed(2);
const VARIABLE_COST_PER_ORDER_PREV_YEAR = 29.30;

/** @ai-commentary Replace with AI-generated CFO insight when ready */
const CFO_INSIGHT = {
  summary:
    "Contribution margin declined 3.5pp month-on-month and is now below the target range (45–55%).",
  primaryDrivers: [
    "Shipping costs increased £2.10 per order",
    "Meta CAC increased £3.40 per order",
    "Discount depth increased 1.8 percentage points",
  ],
  closing:
    "Marketing now represents the largest variable cost line at £12.20 per order, suggesting channel mix optimisation is the fastest route to recovery.",
  opportunity: "+2–4pp",
};

/** @ai-commentary Replace with dynamically generated AI insight when ready */
const BRIDGE_INSIGHT =
  "Contribution per order declined £3.20 month-on-month, driven primarily by higher shipping costs (+£2.10/order) and rising Meta CAC (+£3.40/order). Marketing (blended) now accounts for £12.20 per order — the single largest variable cost line.";

const MARGIN_RECOMMENDATIONS: Recommendation[] = [
  {
    id: "m1",
    text: "Renegotiate shipping rates with your carrier — volumes qualify for a tier discount that could reduce shipping costs by 8–12%, adding ~1.0pp to contribution margin.",
    impact: "high",
  },
  {
    id: "m2",
    text: "Pause blanket discount codes and replace with targeted post-purchase offers. Reducing average discount depth from 7% to 5% would recover ~0.6pp of margin.",
    impact: "high",
  },
  {
    id: "m3",
    text: "Reallocate 15% of Meta spend toward Email — Email CM is 58.6% vs Meta at 34.2%. Shifting budget to your highest-margin channel improves blended margin immediately.",
    impact: "high",
  },
  {
    id: "m4",
    text: "Review fulfilment partner SLA and pricing — fulfilment at 14% of revenue is above the typical 10–12% benchmark for your order volume. Request a pricing review.",
    impact: "medium",
  },
  {
    id: "m5",
    text: "Set a contribution margin floor alert at 40%. You are currently at 42.3% — an early warning at 40% gives you time to act before margin falls below breakeven.",
    impact: "quick-win",
  },
];

/** @dynamic Replace with dynamically calculated recovery scenarios when ready */
const RECOVERY_SCENARIOS = [
  {
    action:    "Reduce shipping costs by 8%",
    detail:    "Renegotiate carrier rates — achievable at current volume",
    ppGain:    1.0,
    newCm:     43.3,
  },
  {
    action:    "Reduce Meta CAC by 10%",
    detail:    "Reallocate budget toward Email (CM 58.6%) and Organic (CM 52.3%)",
    ppGain:    1.4,
    newCm:     43.7,
  },
  {
    action:    "Reduce discount depth to 5%",
    detail:    "Replace blanket codes with targeted post-purchase offers",
    ppGain:    0.6,
    newCm:     42.9,
  },
];
const RECOVERY_TOTAL_PP = +RECOVERY_SCENARIOS
  .reduce((s, r) => s + r.ppGain, 0)
  .toFixed(1);
const RECOVERY_TARGET_CM = +(CM_PCT + RECOVERY_TOTAL_PP).toFixed(1);

/**
 * @dynamic Thresholds and trajectory can be computed from rolling CM data when live.
 * monthlyDeclineRate: average pp drop per month (negative = worsening)
 * monthsToThreshold: (currentCm - threshold) / monthlyDeclineRate
 */
const RISK_MONITOR = {
  /** Current CM — derived from live constant for forward-linking */
  currentCm: CM_PCT,
  /** Thresholds ordered from nearest to most severe */
  thresholds: [
    {
      pct: 40,
      label: "Warning",
      /** @dynamic Compute as Math.ceil((currentCm - pct) / monthlyDeclineRate) */
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
      /** @dynamic Compute as Math.ceil((currentCm - pct) / monthlyDeclineRate) */
      monthsAtCurrentRate: 6,
      color: "red" as const,
      implications: [
        "Business covers fixed costs but generates minimal surplus",
        "New customer investment is no longer viable",
        "Structural cost restructuring becomes necessary",
      ],
    },
  ],
  /** @dynamic Derived from rolling 3-month average CM decline in pp/month */
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

const UNIT_ECONOMICS = [
  { label: "Revenue per order",    value:  68.40, type: "revenue",   trend: "neutral" as const },
  { label: "Discounts",            value:  -8.10, type: "deduction", trend: "worsening" as const },
  { label: "Payment fees",         value:  -1.90, type: "deduction", trend: "neutral" as const },
  { label: "Shipping",             value:  -4.80, type: "deduction", trend: "worsening" as const },
  { label: "Fulfilment",           value:  -6.40, type: "deduction", trend: "neutral" as const },
  { label: "Marketing (blended)",  value: -12.20, type: "deduction", trend: "worsening" as const },
];
const CONTRIBUTION_PER_ORDER = 35.00;
const CONTRIBUTION_PER_ORDER_PREV = 38.20;

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

function fmt(n: number) {
  return `£${Math.abs(n).toLocaleString()}`;
}

export default function MarginAnalysis() {
  const [sensitivityOpen, setSensitivityOpen] = useState(false);

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Contribution Margin Analysis
          </h1>
          <p className="text-muted-foreground mt-1">
            Understanding where margin is being created — and lost
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-medium bg-secondary px-3 py-1.5 rounded-lg">
            March 2026
          </span>
        </div>
      </div>

      {/* ── CFO Insight ── */}
      <div className="rounded-2xl border border-primary/25 bg-primary/5 shadow-sm mb-8 overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-3.5 bg-primary/10 border-b border-primary/20">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            CFO Insight
          </span>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm font-medium text-foreground leading-relaxed mb-4">
            {CFO_INSIGHT.summary}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Primary drivers:
          </p>
          <ul className="space-y-1.5 mb-4">
            {CFO_INSIGHT.primaryDrivers.map((driver, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0 mt-[5px]" />
                {driver}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            {CFO_INSIGHT.closing}
          </p>
          <div className="inline-flex items-center gap-2 bg-success/10 text-success border border-success/20 px-3 py-1.5 rounded-lg text-sm font-semibold">
            <TrendingUp className="w-4 h-4 shrink-0" />
            Expected recoverable margin opportunity: {CFO_INSIGHT.opportunity}
          </div>
        </div>
      </div>

      {/* Headline KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Contribution Margin</p>
          <p className="text-4xl font-display font-bold text-foreground">{CM_PCT}%</p>
          <div className="flex items-center gap-2 mt-3 text-xs">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">
              <ArrowDownRight className="w-3 h-3" />
              {Math.abs(CM_CHANGE)}%
            </span>
            <span className="text-muted-foreground">vs prior month ({CM_PREV}%)</span>
          </div>
          {(() => {
            const bm = getBenchmark(CM_PCT);
            return (
              <div className={cn(
                "mt-3 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg w-fit",
                bm.color === "green" && "bg-emerald-500/10 text-emerald-600",
                bm.color === "amber" && "bg-amber-500/10 text-amber-600",
                bm.color === "red"   && "bg-destructive/10 text-destructive",
              )}>
                <span className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  bm.color === "green" && "bg-emerald-500",
                  bm.color === "amber" && "bg-amber-500",
                  bm.color === "red"   && "bg-destructive",
                )} />
                {bm.label}
              </div>
            );
          })()}
        </div>

        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Contribution Profit</p>
          <p className="text-4xl font-display font-bold text-foreground">{fmt(CM_VALUE)}</p>
          <p className="mt-3 text-xs text-muted-foreground">Revenue minus variable costs</p>
        </div>

        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">6-Month Trend</p>
          <p className="text-4xl font-display font-bold text-destructive">↓ 4.8pp</p>
          <p className="mt-3 text-xs text-muted-foreground">Down from 47.1% in October</p>
        </div>

        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">CAC Payback Period</p>
          <p className="text-4xl font-display font-bold text-foreground">
            {CAC_PAYBACK}<span className="text-2xl font-semibold text-muted-foreground ml-1">orders</span>
          </p>
          <div className="flex items-center gap-2 mt-3 text-xs">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-semibold">
              <ArrowUpRight className="w-3 h-3" />
              from {CAC_PAYBACK_PREV} last month
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground leading-snug">
            Marketing investment now takes longer to recover
          </p>
        </div>

        {/* Variable Cost per Order */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Variable Cost per Order</p>
          <p className="text-4xl font-display font-bold text-foreground">
            £{VARIABLE_COST_PER_ORDER.toFixed(2)}
          </p>
          <div className="flex items-center gap-2 mt-3 text-xs">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">
              <ArrowUpRight className="w-3 h-3" />
              Up £{(VARIABLE_COST_PER_ORDER - VARIABLE_COST_PER_ORDER_PREV_YEAR).toFixed(2)} vs last year
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground leading-snug">
            Sum of all variable costs per order
          </p>
        </div>
      </div>

      {/* ── Contribution Margin Bridge ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">
        <div className="mb-5">
          <h3 className="font-semibold text-lg text-foreground">Contribution Margin Bridge</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            How revenue converts into contribution margin — total and per order, March 2026
          </p>
        </div>

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
                  Per Order (£)
                </th>
                <th className="text-right py-2.5 pl-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody>
              {BRIDGE_ROWS.map((row) => {
                const isRevenue = row.type === "revenue";
                const totalStr  = isRevenue
                  ? `£${row.total.toLocaleString()}`
                  : `−£${Math.abs(row.total).toLocaleString()}`;
                const perOrderStr = `£${Math.abs(row.perOrder).toFixed(2)}`;

                return (
                  <tr
                    key={row.label}
                    className="border-b border-border/40 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="py-3 pr-4 font-medium text-foreground">
                      {row.label}
                    </td>
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
                  <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {CM_PCT}%
                  </span>
                </td>
                <td className="py-3.5 px-4 text-right tabular-nums font-bold text-foreground">
                  £{CM_VALUE.toLocaleString()}
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

        {/* Insight — structured for future AI commentary replacement */}
        <div className="mt-5 flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
          <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900 leading-snug">
            {BRIDGE_INSIGHT}
          </p>
        </div>
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
                Contribution margin % per acquisition channel — March 2026
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
                Meta margin is 24pp below Email. Consider reallocating budget toward higher-margin channels or improving Meta targeting efficiency.
              </p>
            </div>
          </div>
        );
      })()}

      {/* ── Margin Change Drivers This Month ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">
        <div className="mb-5">
          <h3 className="font-semibold text-lg text-foreground">Margin Change Drivers This Month</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Largest factors affecting contribution margin vs last month
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2.5 pr-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Driver
                </th>
                <th className="text-right py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Change
                </th>
                <th className="text-right py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  Impact per order
                </th>
                <th className="text-right py-2.5 pl-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Direction
                </th>
              </tr>
            </thead>
            <tbody>
              {CHANGE_DRIVERS.map((row) => {
                const isNegative = row.direction === "negative";
                const impactStr  = `${isNegative ? "−" : "+"}£${Math.abs(row.impactPerOrder).toFixed(2)} / order`;
                return (
                  <tr
                    key={row.driver}
                    className="border-b border-border/40 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="py-3 pr-4 font-medium text-foreground">
                      {row.driver}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={cn(
                        "inline-flex text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums",
                        isNegative
                          ? "bg-destructive/10 text-destructive"
                          : "bg-success/10 text-success"
                      )}>
                        {row.change}
                      </span>
                    </td>
                    <td className={cn(
                      "py-3 px-4 text-right tabular-nums font-semibold",
                      isNegative ? "text-destructive" : "text-success"
                    )}>
                      {impactStr}
                    </td>
                    <td className="py-3 pl-4 text-right">
                      {isNegative
                        ? <ArrowDownRight className="w-4 h-4 text-destructive ml-auto" />
                        : <ArrowUpRight   className="w-4 h-4 text-success ml-auto" />
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-secondary/40">
                <td className="py-3.5 pr-4 font-bold text-foreground" colSpan={2}>
                  Total margin impact this month
                </td>
                <td className={cn(
                  "py-3.5 px-4 text-right tabular-nums font-bold",
                  CHANGE_DRIVERS_TOTAL < 0 ? "text-destructive" : "text-success"
                )}>
                  {CHANGE_DRIVERS_TOTAL < 0 ? "−" : "+"}£{Math.abs(CHANGE_DRIVERS_TOTAL).toFixed(2)} / order
                </td>
                <td className="py-3.5 pl-4 text-right">
                  {CHANGE_DRIVERS_TOTAL < 0
                    ? <ArrowDownRight className="w-4 h-4 text-destructive ml-auto" />
                    : <ArrowUpRight   className="w-4 h-4 text-success ml-auto" />
                  }
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Margin Trend — full width */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50 mb-8">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-semibold text-lg text-foreground">Margin Trend</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Contribution margin % — Mar 2025 to Mar 2026</p>
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

      {/* Unit Economics 13-month bar chart */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h3 className="font-semibold text-lg text-foreground">Unit Economics — 13-Month View</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Revenue per order vs contribution per order (Mar 2025 – Mar 2026)
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
                {UNIT_ECON_HISTORY.map((entry, index) => {
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
                {UNIT_ECON_HISTORY.map((entry, index) => {
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

      {/* ── Margin Recovery Simulator ── */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <button
          onClick={() => setSensitivityOpen((o) => !o)}
          className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-muted/30 transition-colors"
        >
          <div>
            <p className="font-semibold text-foreground">Margin Recovery Simulator</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Estimated contribution margin improvement from realistic operational changes
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              +{RECOVERY_TOTAL_PP}pp achievable
            </span>
            {sensitivityOpen
              ? <ChevronDown className="w-5 h-5 text-muted-foreground" />
              : <ChevronRight className="w-5 h-5 text-muted-foreground" />
            }
          </div>
        </button>

        {sensitivityOpen && (
          <div className="px-6 pb-6 border-t border-border/50">
            <div className="flex flex-col gap-3 mt-5">
              {RECOVERY_SCENARIOS.map((s) => (
                <div
                  key={s.action}
                  className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3.5 gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-snug">
                      If {s.action}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      {s.detail}
                    </p>
                  </div>
                  <div className="flex flex-col items-end shrink-0 ml-2 text-right">
                    <span className="text-base font-bold text-emerald-700">
                      {s.newCm.toFixed(1)}%
                    </span>
                    <span className="text-xs font-semibold text-emerald-600">
                      +{s.ppGain.toFixed(1)}pp CM
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-600 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  Estimated achievable improvement
                </p>
                <p className="text-xs text-emerald-100 mt-0.5">
                  Combined contribution margin if all three actions are implemented
                </p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className="text-2xl font-bold text-white">
                  {RECOVERY_TARGET_CM}%
                </p>
                <p className="text-xs font-semibold text-emerald-200">
                  +{RECOVERY_TOTAL_PP}pp vs current
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-4">
              Scenarios assume revenue remains constant at £124,500. Improvements are estimated independently — combined gains may differ slightly due to cost interactions. At {RECOVERY_TARGET_CM}%, contribution margin would return to the lower bound of the target range (45–55%).
            </p>
          </div>
        )}
      </div>

      {/* ── Margin Risk Monitor ── */}
      <div className="mb-8">
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl overflow-hidden shadow-sm">
          {/* Header */}
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

          {/* Threshold cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-amber-200 dark:bg-amber-800/40">
            {RISK_MONITOR.thresholds.map((t) => (
              <div
                key={t.pct}
                className="bg-amber-50 dark:bg-amber-950/20 px-6 py-5"
              >
                {/* Threshold header row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        t.color === "red"
                          ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive"
                          : "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200"
                      }
                    >
                      {t.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      if CM falls below
                    </span>
                    <span
                      className={
                        t.color === "red"
                          ? "text-base font-bold text-destructive"
                          : "text-base font-bold text-amber-700 dark:text-amber-300"
                      }
                    >
                      {t.pct}%
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">at current rate</p>
                    <p
                      className={
                        t.color === "red"
                          ? "text-sm font-semibold text-destructive"
                          : "text-sm font-semibold text-amber-700 dark:text-amber-300"
                      }
                    >
                      ~{t.monthsAtCurrentRate} months
                    </p>
                  </div>
                </div>

                {/* Implications */}
                <ul className="space-y-1.5">
                  {t.implications.map((imp) => (
                    <li key={imp} className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
                      <span
                        className={
                          t.color === "red"
                            ? "mt-1.5 w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0"
                            : "mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"
                        }
                      />
                      {imp}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="px-6 py-3 bg-amber-100/60 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800/50">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Current contribution margin: <span className="font-semibold">{RISK_MONITOR.currentCm}%</span>
              {" "}·{" "}
              Warning threshold is{" "}
              <span className="font-semibold">
                {(RISK_MONITOR.currentCm - RISK_MONITOR.thresholds[0].pct).toFixed(1)}pp away
              </span>
              {" "}· Thresholds and time-to-breach will update automatically when live data is connected.
            </p>
          </div>
        </div>
      </div>

      {/* ── Recommended margin improvements ── */}
      <ActionRecommendations
        recommendations={MARGIN_RECOMMENDATIONS}
        title="Recommended margin improvements"
        subtitle="Suggested operational actions based on your current margin trends and benchmarks"
        defaultExpanded
      />
    </AppLayout>
  );
}
