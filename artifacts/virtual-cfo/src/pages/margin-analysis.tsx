import { ArrowDownRight, ArrowUpRight, TrendingDown, TrendingUp, Info } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
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

const LEAKAGE = [
  { text: "Shipping costs increased £2.10 per order",       impact: "−£2.10 / order" },
  { text: "Discount depth increased 1.8 percentage points", impact: "−1.8pp"         },
  { text: "Meta CAC increased £3.40 per order",             impact: "−£3.40 / order" },
  { text: "Payment processing rate up 0.3%",                impact: "−£0.20 / order" },
  { text: "Returns rate increased 2.1%",                    impact: "−£1.40 / order" },
];

const DRIVERS = [
  { text: "Shipping costs increased 8%",  trend: "worsening" },
  { text: "Discount usage increased 11%", trend: "worsening" },
  { text: "Meta CAC increased 14%",       trend: "worsening" },
  { text: "Payment fee rate unchanged",   trend: "neutral"   },
  { text: "Fulfilment costs stable",      trend: "neutral"   },
];

function fmt(n: number) {
  return `£${Math.abs(n).toLocaleString()}`;
}

export default function MarginAnalysis() {
  return (
    <AppLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Contribution Margin Analysis
          </h1>
          <p className="text-muted-foreground mt-1">
            Understanding what's driving your true profitability
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-medium bg-secondary px-3 py-1.5 rounded-lg">
            March 2026
          </span>
        </div>
      </div>

      {/* Headline KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
      </div>

      {/* Margin Breakdown + Unit Economics side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        {/* Margin breakdown */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <div className="mb-5">
            <h3 className="font-semibold text-lg text-foreground">Margin Breakdown</h3>
            <p className="text-sm text-muted-foreground mt-0.5">This month</p>
          </div>

          <ul className="space-y-1">
            {BREAKDOWN.map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0 group"
              >
                <span className="text-sm text-foreground">{row.label}</span>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <span className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded-full",
                    row.type === "revenue"
                      ? "bg-success/10 text-success"
                      : "bg-destructive/10 text-destructive"
                  )}>
                    {row.pct > 0 ? "+" : ""}{row.pct}%
                  </span>
                  <span className="text-sm font-semibold text-foreground tabular-nums w-20 text-right">
                    {row.type === "revenue" ? fmt(row.value) : `−${fmt(row.value)}`}
                  </span>
                </div>
              </li>
            ))}

            {/* CM result row */}
            <li className="flex items-center justify-between pt-3 mt-1">
              <span className="text-sm font-bold text-foreground">Contribution Margin</span>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {CM_PCT}%
                </span>
                <span className="text-sm font-bold text-foreground tabular-nums w-20 text-right">
                  {fmt(CM_VALUE)}
                </span>
              </div>
            </li>
          </ul>

          <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-secondary/50">
            <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-snug">
              Contribution margin excludes fixed overheads. It reflects profit available to cover fixed costs and drive net profit.
            </p>
          </div>
        </div>

        {/* Unit Economics */}
        <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6">
          <div className="mb-6">
            <h3 className="font-semibold text-lg text-foreground">Unit Economics (Per Order)</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Contribution margin calculated on a per-order basis
            </p>
          </div>

          <ul className="space-y-0">
            {UNIT_ECONOMICS.map((row, i) => (
              <li
                key={row.label}
                className={cn(
                  "flex items-center justify-between py-3 border-b border-border/40",
                  i === 0 && "border-t border-border/40"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-4 shrink-0 font-medium">
                    {row.type === "deduction" ? "−" : ""}
                  </span>
                  <span className="text-sm text-foreground">{row.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                    row.trend === "worsening"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-secondary text-muted-foreground"
                  )}>
                    {row.trend === "worsening" ? "↑ cost" : "—"}
                  </span>
                  <span className={cn(
                    "text-sm font-semibold tabular-nums w-16 text-right",
                    row.type === "revenue" ? "text-foreground" : "text-muted-foreground"
                  )}>
                    £{Math.abs(row.value).toFixed(2)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {/* Contribution per order result */}
          <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/10 border border-primary/20 px-4 py-4">
            <div>
              <p className="text-sm font-bold text-foreground">Contribution per order</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Down from £{CONTRIBUTION_PER_ORDER_PREV.toFixed(2)} last month
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-display font-bold text-foreground">
                £{CONTRIBUTION_PER_ORDER.toFixed(2)}
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
                <ArrowDownRight className="w-3 h-3" />
                £{(CONTRIBUTION_PER_ORDER_PREV - CONTRIBUTION_PER_ORDER).toFixed(2)} vs last month
              </span>
            </div>
          </div>
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

      {/* Margin leakage */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">
        <div className="mb-5">
          <h3 className="font-semibold text-lg text-foreground">Margin leakage this month</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Largest negative contributors to margin change vs prior month
          </p>
        </div>
        <ul className="space-y-1">
          {LEAKAGE.map((item, i) => (
            <li key={i} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0 bg-destructive/10">
                  <ArrowUpRight className="w-4 h-4 text-destructive" />
                </span>
                <span className="text-sm text-foreground">{item.text}</span>
              </div>
              <span className="text-xs font-semibold tabular-nums text-destructive bg-destructive/10 px-2 py-0.5 rounded-full shrink-0 ml-4">
                {item.impact}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Key margin drivers — above trend chart */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">
        <div className="mb-5">
          <h3 className="font-semibold text-lg text-foreground">Key margin drivers this period</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Factors with the largest impact on contribution margin this month
          </p>
        </div>
        <ul className="space-y-3">
          {DRIVERS.map((d, i) => {
            const isWorsening = d.trend === "worsening";
            const isImproving = d.trend === "improving";
            return (
              <li key={i} className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
                <span className={cn(
                  "inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0",
                  isWorsening ? "bg-destructive/10" : isImproving ? "bg-success/10" : "bg-secondary"
                )}>
                  {isWorsening && <TrendingDown className="w-4 h-4 text-destructive" />}
                  {isImproving && <TrendingUp className="w-4 h-4 text-success" />}
                  {d.trend === "neutral" && <span className="text-muted-foreground text-xs font-bold">—</span>}
                </span>
                <span className="text-sm text-foreground">{d.text}</span>
              </li>
            );
          })}
        </ul>
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
    </AppLayout>
  );
}
