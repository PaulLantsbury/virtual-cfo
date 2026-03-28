import { Sparkles, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { ActionRecommendations } from "@/components/ActionRecommendations";
import type { Recommendation } from "@/components/ActionRecommendations";
import { cn } from "@/lib/utils";

// ─── Data constants ───────────────────────────────────────────────────────────

/** @dynamic */
const BLENDED_CAC        = 12.20;
const BLENDED_CAC_PREV   = 9.80;
const BLENDED_CAC_CHANGE = +(BLENDED_CAC - BLENDED_CAC_PREV).toFixed(2);

/** @dynamic */
const BLENDED_ROAS       = 2.8;
const BLENDED_ROAS_PREV  = 3.4;

/** @dynamic */
const CAC_PAYBACK        = 1.4;
const CAC_PAYBACK_PREV   = 1.1;

/** @dynamic */
const MKT_CM             = 38.6;
const MKT_CM_PREV        = 41.8;
const MKT_CM_CHANGE      = +(MKT_CM - MKT_CM_PREV).toFixed(1);

/**
 * @ai-commentary Replace with live-generated insight.
 * cashLow / cashHigh:
 *   @dynamic Math.round(orderVolume * (ppGain / 100) * revenuePerOrder)
 */
const CFO_INSIGHT = {
  body: "Marketing efficiency has weakened this month due to rising Meta CAC and increased reliance on discounted acquisition.",
  detail: "Blended CAC increased by £3.40 per order, reducing contribution margin across paid channels.",
  upside: { cashLow: 14_000, cashHigh: 32_000 },
  recommendations: [
    "Reduce spend on lowest-margin paid channels",
    "Increase lifecycle email conversion",
    "Prioritise acquisition of repeat-purchase customers",
  ],
} as const;

/** @dynamic Replace with live channel-level margin data from Shopify + ad platforms */
const CHANNEL_CM = [
  { channel: "Email",           cm: 58.6, revenue: 18_200 },
  { channel: "Organic",         cm: 52.3, revenue: 24_800 },
  { channel: "Google Shopping", cm: 40.1, revenue: 42_600 },
  { channel: "Meta",            cm: 34.2, revenue: 38_900 },
];

type EfficiencyRating = "strong" | "watch" | "weak";

/** @dynamic Replace with live CAC per channel from ad platform APIs */
const CAC_BY_CHANNEL: {
  channel: string;
  cac: number;
  change: number | null;
  changeLabel: string;
  efficiency: EfficiencyRating;
}[] = [
  { channel: "Meta",            cac: 18.40, change: 14,   changeLabel: "+14%",   efficiency: "weak"   },
  { channel: "Google Shopping", cac: 11.20, change: 6,    changeLabel: "+6%",    efficiency: "watch"  },
  { channel: "Email",           cac:  4.80, change: -2,   changeLabel: "−2%",    efficiency: "strong" },
  { channel: "Organic",         cac:  2.10, change: null, changeLabel: "Stable", efficiency: "strong" },
];

/** @dynamic */
const PAYBACK_THRESHOLD = 1.5;

/** @dynamic Replace with live payback data */
const PAYBACK_BY_CHANNEL = [
  { channel: "Email",           payback: 0.6 },
  { channel: "Organic",         payback: 0.8 },
  { channel: "Google Shopping", payback: 1.3 },
  { channel: "Meta",            payback: 2.1 },
];

/** @dynamic Replace with live monthly efficiency data */
const TREND_DATA = [
  { month: "Apr", cac:  8.2, roas: 4.1 },
  { month: "May", cac:  8.8, roas: 3.9 },
  { month: "Jun", cac:  9.1, roas: 3.7 },
  { month: "Jul", cac:  9.4, roas: 3.5 },
  { month: "Aug", cac:  9.8, roas: 3.6 },
  { month: "Sep", cac:  9.2, roas: 3.8 },
  { month: "Oct", cac:  8.9, roas: 3.9 },
  { month: "Nov", cac:  9.6, roas: 3.5 },
  { month: "Dec", cac: 10.2, roas: 3.2 },
  { month: "Jan", cac: 10.8, roas: 3.0 },
  { month: "Feb", cac: 11.4, roas: 2.9 },
  { month: "Mar", cac: 12.2, roas: 2.8 },
];

/**
 * @dynamic Compute from: orderVolume × (ppGain / 100) × revenuePerOrder
 */
const REALLOCATION = {
  metaShiftPct: 15,
  cmGainLow: 1,
  cmGainHigh: 3,
  cashLow: 10_000,
  cashHigh: 25_000,
} as const;

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: "me1",
    text: "Reduce spend on lowest-margin paid channels — reallocate 15–20% of Meta budget to email and organic.",
    impact: "high",
  },
  {
    id: "me2",
    text: "Increase lifecycle email automation coverage to improve LTV and reduce blended CAC.",
    impact: "high",
  },
  {
    id: "me3",
    text: "Improve Meta campaign targeting by narrowing audiences to high-value, repeat-purchase segments.",
    impact: "medium",
  },
  {
    id: "me4",
    text: "Focus paid acquisition on products with the highest contribution margin.",
    impact: "medium",
  },
  {
    id: "me5",
    text: "Set up channel-level contribution margin tracking to automate future reallocation decisions.",
    impact: "quick-win",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EFFICIENCY_CONFIG: Record<EfficiencyRating, { label: string; badge: string; dot: string }> = {
  strong: {
    label: "Strong",
    badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  watch: {
    label: "Watch",
    badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-400",
  },
  weak: {
    label: "Weak",
    badge: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

const maxCm = Math.max(...CHANNEL_CM.map((c) => c.cm));
const minCm = Math.min(...CHANNEL_CM.map((c) => c.cm));

// ─── Component ────────────────────────────────────────────────────────────────

export default function MarketingEfficiency() {
  return (
    <AppLayout>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Marketing Efficiency
          </h1>
          <p className="text-muted-foreground mt-1">
            Understand which acquisition channels create profitable customers and where budget should be reallocated.
          </p>
        </div>
        <span className="text-sm text-muted-foreground font-medium bg-secondary px-3 py-1.5 rounded-lg">
          March 2026
        </span>
      </div>

      {/* ── CFO Insight ── */}
      <div className="rounded-2xl border border-primary/25 bg-primary/5 shadow-sm mb-8 overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-3.5 bg-primary/10 border-b border-primary/20">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">CFO Insight</span>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground leading-relaxed mb-1">{CFO_INSIGHT.body}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{CFO_INSIGHT.detail}</p>
          </div>

          {/* Upside callout */}
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/25 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 shrink-0 mt-0.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm text-emerald-900 dark:text-emerald-200 leading-relaxed">
                If spend is partially reallocated toward higher-margin channels such as Email and Organic,
                contribution profit could improve by approximately{" "}
                <span className="font-bold text-emerald-700 dark:text-emerald-300 text-base">
                  £{CFO_INSIGHT.upside.cashLow.toLocaleString()}–£{CFO_INSIGHT.upside.cashHigh.toLocaleString()}
                </span>{" "}
                next month at current sales volume.
              </p>
            </div>
          </div>

          {/* Recommended focus */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Recommended focus:
            </p>
            <ul className="space-y-1.5">
              {CFO_INSIGHT.recommendations.map((rec) => (
                <li key={rec} className="flex items-start gap-2.5 text-sm text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-[5px]" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>

          {/* Summary tag */}
          <div className="flex flex-wrap gap-3 pt-1 border-t border-primary/15">
            <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 px-3 py-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs text-emerald-800 dark:text-emerald-300">
                Potential upside next month:{" "}
                <span className="font-bold">
                  £{(CFO_INSIGHT.upside.cashLow / 1000).toFixed(0)}k–£{(CFO_INSIGHT.upside.cashHigh / 1000).toFixed(0)}k
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Blended CAC */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Blended CAC</p>
          <p className="text-4xl font-display font-bold text-foreground">£{BLENDED_CAC.toFixed(2)}</p>
          <div className="flex items-center gap-2 mt-3 text-xs">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">
              <ArrowUpRight className="w-3 h-3" />
              Up £{BLENDED_CAC_CHANGE.toFixed(2)} vs last month
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground leading-snug">
            Average cost to acquire one customer across all channels
          </p>
        </div>

        {/* Blended ROAS */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Blended ROAS</p>
          <p className="text-4xl font-display font-bold text-foreground">{BLENDED_ROAS}x</p>
          <div className="flex items-center gap-2 mt-3 text-xs">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">
              <ArrowDownRight className="w-3 h-3" />
              Down from {BLENDED_ROAS_PREV}x last month
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground leading-snug">
            Revenue returned per £1 of blended marketing spend
          </p>
        </div>

        {/* CAC Payback */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">CAC Payback Period</p>
          <p className="text-4xl font-display font-bold text-foreground">
            {CAC_PAYBACK}{" "}
            <span className="text-lg font-medium text-muted-foreground">orders</span>
          </p>
          <div className="flex items-center gap-2 mt-3 text-xs">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">
              <ArrowUpRight className="w-3 h-3" />
              Up from {CAC_PAYBACK_PREV} last month
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground leading-snug">
            Orders needed to recover the cost of acquiring each new customer
          </p>
        </div>

        {/* Marketing CM */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Marketing Contribution Margin</p>
          <p className="text-4xl font-display font-bold text-foreground">{MKT_CM}%</p>
          <div className="flex items-center gap-2 mt-3 text-xs">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">
              <ArrowDownRight className="w-3 h-3" />
              {Math.abs(MKT_CM_CHANGE)}pp vs prior period
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground leading-snug">
            Blended contribution margin after all marketing costs
          </p>
        </div>
      </div>

      {/* ── Contribution Margin by Channel ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">
        <div className="mb-5">
          <h3 className="font-semibold text-lg text-foreground">Contribution Margin by Channel</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Margin earned per pound of revenue after channel-specific acquisition and fulfilment costs.
          </p>
        </div>

        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[...CHANNEL_CM].sort((a, b) => b.cm - a.cm)}
              layout="vertical"
              margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                domain={[0, 70]}
                tickFormatter={(v: number) => `${v}%`}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="channel"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                width={120}
              />
              <Tooltip
                formatter={(v: number) => [`${v}%`, "Contribution Margin"]}
                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgb(0 0 0 / .1)" }}
              />
              <Bar dataKey="cm" radius={[0, 6, 6, 0]} maxBarSize={32} label={{ position: "right", formatter: (v: number) => `${v}%`, fill: "hsl(var(--muted-foreground))", fontSize: 12 }}>
                {[...CHANNEL_CM].sort((a, b) => b.cm - a.cm).map((entry) => (
                  <Cell
                    key={entry.channel}
                    fill={
                      entry.cm === maxCm
                        ? "#22c55e"
                        : entry.cm === minCm
                        ? "#ef4444"
                        : "hsl(var(--primary))"
                    }
                    opacity={entry.cm === maxCm || entry.cm === minCm ? 1 : 0.65}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-start gap-2 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-snug">
            Reallocating {REALLOCATION.metaShiftPct}% of Meta spend toward Email could increase blended contribution
            margin by approximately{" "}
            <span className="font-semibold">1.2pp</span> next month.
          </p>
        </div>
      </div>

      {/* ── CAC by Channel ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">
        <div className="mb-5">
          <h3 className="font-semibold text-lg text-foreground">Customer Acquisition Cost by Channel</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cost per acquired customer and month-on-month efficiency movement.
          </p>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-4 gap-4 px-3 pb-2 border-b border-border/50">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Channel</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">CAC</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">vs Last Month</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Efficiency</span>
        </div>

        <div className="divide-y divide-border/40">
          {CAC_BY_CHANNEL.map((row) => {
            const cfg = EFFICIENCY_CONFIG[row.efficiency];
            return (
              <div key={row.channel} className="grid grid-cols-4 gap-4 px-3 py-3.5 items-center hover:bg-secondary/30 rounded-xl transition-colors">
                <div className="flex items-center gap-2">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.dot)} />
                  <span className="text-sm font-medium text-foreground">{row.channel}</span>
                </div>
                <span className="text-sm font-bold text-foreground text-right">£{row.cac.toFixed(2)}</span>
                <span
                  className={cn(
                    "text-sm font-medium text-right",
                    row.change === null ? "text-muted-foreground" :
                    row.change > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {row.changeLabel}
                </span>
                <div className="flex justify-end">
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold", cfg.badge)}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Payback by Channel ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">
        <div className="mb-5">
          <h3 className="font-semibold text-lg text-foreground">CAC Payback by Channel</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Number of orders required to recover the acquisition cost for each channel.
          </p>
        </div>

        <div className="space-y-4">
          {[...PAYBACK_BY_CHANNEL].sort((a, b) => a.payback - b.payback).map((row) => {
            const overThreshold = row.payback > PAYBACK_THRESHOLD;
            const barPct = Math.min((row.payback / 3) * 100, 100);
            return (
              <div key={row.channel}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-foreground">{row.channel}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-bold",
                        overThreshold ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {row.payback} orders
                    </span>
                    {overThreshold && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                        Above target
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-full h-2 bg-secondary rounded-full">
                  <div
                    className={cn("h-2 rounded-full transition-all", overThreshold ? "bg-destructive" : "bg-emerald-500")}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Reference line annotation */}
        <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <span className="inline-block w-6 border-t border-dashed border-destructive/60 mt-2 shrink-0" />
          <span>
            Target threshold: <span className="font-semibold">{PAYBACK_THRESHOLD} orders</span>. Channels above this
            reduce short-term cash efficiency and increase growth risk.
          </span>
        </div>
      </div>

      {/* ── Marketing Efficiency Trend ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">
        <div className="mb-5">
          <h3 className="font-semibold text-lg text-foreground">Marketing Efficiency Trend</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Blended CAC and ROAS over the past 12 months.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-destructive inline-block rounded" />
            <span className="text-xs text-muted-foreground">Blended CAC (£)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-primary inline-block rounded" />
            <span className="text-xs text-muted-foreground">Blended ROAS (×)</span>
          </div>
        </div>

        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={TREND_DATA} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                dy={8}
              />
              {/* Left Y-axis: CAC */}
              <YAxis
                yAxisId="cac"
                orientation="left"
                domain={[6, 14]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickFormatter={(v: number) => `£${v}`}
              />
              {/* Right Y-axis: ROAS */}
              <YAxis
                yAxisId="roas"
                orientation="right"
                domain={[2, 5]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickFormatter={(v: number) => `${v}×`}
              />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgb(0 0 0 / .1)" }}
                formatter={(value: number, name: string) =>
                  name === "cac" ? [`£${value.toFixed(2)}`, "Blended CAC"] : [`${value}×`, "Blended ROAS"]
                }
              />
              <Line yAxisId="cac" type="monotone" dataKey="cac" stroke="#ef4444" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              <Line yAxisId="roas" type="monotone" dataKey="roas" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-muted-foreground mt-3 leading-snug">
          Marketing efficiency has declined over the last 3 months due to rising paid acquisition costs.
          CAC increased from £9.20 in September to £12.20 in March — a 33% increase in 6 months.
        </p>
      </div>

      {/* ── Budget Reallocation Opportunity ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">
        <div className="mb-5">
          <h3 className="font-semibold text-lg text-foreground">Budget Reallocation Opportunity</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Estimated impact of shifting spend toward higher-contribution channels.
          </p>
        </div>

        <p className="text-sm text-foreground leading-relaxed mb-6">
          Shifting {REALLOCATION.metaShiftPct}% of Meta spend toward Email and Organic channels could increase
          contribution margin by <span className="font-semibold">{REALLOCATION.cmGainLow}–{REALLOCATION.cmGainHigh}pp</span>{" "}
          next month without reducing overall revenue.
        </p>

        {/* Uplift callout */}
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/25 px-5 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 shrink-0">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-0.5">
                  Estimated contribution uplift
                </p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  +£{(REALLOCATION.cashLow / 1000).toFixed(0)}k–£{(REALLOCATION.cashHigh / 1000).toFixed(0)}k
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">next month at current sales volume</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Margin improvement</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                +{REALLOCATION.cmGainLow}–{REALLOCATION.cmGainHigh}pp
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recommended Actions ── */}
      <ActionRecommendations
        recommendations={RECOMMENDATIONS}
        title="What to do next"
        subtitle="Practical actions to improve marketing efficiency and contribution margin"
        defaultExpanded
      />
    </AppLayout>
  );
}
