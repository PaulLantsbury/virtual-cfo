import { ArrowDownRight, TrendingDown, TrendingUp, Info } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";

const TREND_DATA = [
  { month: "Oct", margin: 47.1 },
  { month: "Nov", margin: 46.3 },
  { month: "Dec", margin: 45.8 },
  { month: "Jan", margin: 44.9 },
  { month: "Feb", margin: 43.7 },
  { month: "Mar", margin: 42.3 },
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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
      </div>

      {/* Unit Economics */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="font-semibold text-lg text-foreground">Unit Economics (Per Order)</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Contribution margin calculated on a per-order basis
            </p>
          </div>
          <span className="text-xs text-muted-foreground font-medium bg-secondary px-3 py-1.5 rounded-lg self-start sm:self-auto">
            March 2026
          </span>
        </div>

        <div className="max-w-md">
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
                  {/* Trend indicator placeholder — ready for live data */}
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

      {/* Trend chart + Breakdown side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">

        {/* Trend line */}
        <div className="lg:col-span-3 bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <div className="mb-5">
            <h3 className="font-semibold text-lg text-foreground">Margin Trend</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Contribution margin % — last 6 months</p>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={TREND_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  dy={8}
                />
                <YAxis
                  domain={[38, 52]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
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
                  strokeWidth={3}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-4 text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-4">
            Margin has declined 4.8 percentage points since October, driven primarily by higher shipping and fulfilment costs alongside increased discount usage.
          </p>
        </div>

        {/* Margin breakdown waterfall */}
        <div className="lg:col-span-2 bg-card rounded-2xl p-6 shadow-sm border border-border/50">
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
      </div>

      {/* Key margin drivers */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6">
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
    </AppLayout>
  );
}
