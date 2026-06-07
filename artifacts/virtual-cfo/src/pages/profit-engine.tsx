import { useState } from "react";
import {
  Sparkles, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle, Info, Zap, Activity, Shield, Users, Lock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
  LineChart, Line, Dot,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { SimulatorSlider } from "@/components/SimulatorSlider";
import { cn } from "@/lib/utils";
import { TimelineSelector } from "@/components/TimelineSelector";
import { canAccess } from "@/lib/plan";
import { AiCfoAskCard } from "@/components/AiCfoAskCard";
import { PeriodImpact } from "@/components/PeriodImpact";
import { PremiumBlurPreview } from "@/components/PremiumBlurPreview";
import { DataBenchmarkAssumptions } from "@/components/DataBenchmarkAssumptions";
import {
  ANNUAL_REVENUE as BASE_REVENUE,
  ANNUAL_DISCOUNTS as DISCOUNTS,
  ANNUAL_RETURNS as RETURNS,
  ANNUAL_NET_REVENUE as NET_REVENUE,
  ANNUAL_VARIABLE_COSTS as VARIABLE_COSTS,
  CONTRIBUTION,
  BASE_EBITDA,
} from "@/lib/data/business-snapshot";
import { MONTHLY_FIXED_COSTS as BASE_FIXED_COSTS } from "@/lib/data/cash-snapshot";

// ─── Base data constants ─────────────────────────────────────────────────────
// Values imported from central mock data layer (src/lib/data/business-snapshot.ts
// and src/lib/data/cash-snapshot.ts). Replace those files with live Xero/Shopify
// feeds when integrations are connected.
//
// BASE_REVENUE     = 520,000  (ANNUAL_REVENUE)
// DISCOUNTS        = 82,000   (ANNUAL_DISCOUNTS)
// RETURNS          = 41,000   (ANNUAL_RETURNS)
// NET_REVENUE      = 397,000  (ANNUAL_NET_REVENUE — derived)
// VARIABLE_COSTS   = 199,000  (ANNUAL_VARIABLE_COSTS)
// CONTRIBUTION     = 198,000  (derived: NET_REVENUE − VARIABLE_COSTS)
// BASE_FIXED_COSTS = 120,000  (MONTHLY_FIXED_COSTS from cash-snapshot)
// BASE_EBITDA      = 78,000   (derived: CONTRIBUTION − BASE_FIXED_COSTS)

// Derived percentages
const CONTRIBUTION_MARGIN_PCT   = CONTRIBUTION / BASE_REVENUE;                          // ≈ 38.08%
const FIXED_COST_ABSORPTION_PCT = BASE_FIXED_COSTS / CONTRIBUTION;                      // ≈ 60.6%
const BREAK_EVEN_REVENUE        = Math.round(BASE_FIXED_COSTS / CONTRIBUTION_MARGIN_PCT); // ≈ 315,400
const MARGIN_OF_SAFETY_PCT      = (BASE_REVENUE - BREAK_EVEN_REVENUE) / BASE_REVENUE;   // ≈ 39.3%
const EBITDA_MARGIN_PCT         = BASE_EBITDA / BASE_REVENUE;                           // 15.0%

// ─── Bridge waterfall data ───────────────────────────────────────────────────
const BRIDGE_CHART_DATA = [
  { name: "Revenue",      invisible: 0,       value: 520_000, type: "positive" },
  { name: "Discounts",    invisible: 438_000,  value: 82_000,  type: "negative" },
  { name: "Returns",      invisible: 397_000,  value: 41_000,  type: "negative" },
  { name: "Net Revenue",  invisible: 0,        value: 397_000, type: "subtotal" },
  { name: "Var. Costs",   invisible: 198_000,  value: 199_000, type: "negative" },
  { name: "Contribution", invisible: 0,        value: 198_000, type: "subtotal" },
  { name: "Fixed Costs",  invisible: 78_000,   value: 120_000, type: "negative" },
  { name: "Profit",       invisible: 0,        value: 78_000,  type: "result"   },
];

const BRIDGE_COLOR: Record<string, string> = {
  positive: "#22c55e",
  negative: "#ef4444",
  subtotal: "#94a3b8",
  result:   "#6366f1",
};

// ─── Bridge table rows ───────────────────────────────────────────────────────
const BRIDGE_TABLE = [
  { step: "Revenue",        amount:  520_000, pct:  100.0, meaning: "Gross sales before discounts and returns",              isTotal: false, isResult: false, positive: true  },
  { step: "Discounts",      amount: -82_000,  pct:  -15.8, meaning: "Discounting takes 15.8% off the top line",              isTotal: false, isResult: false, positive: false },
  { step: "Returns",        amount: -41_000,  pct:   -7.9, meaning: "Returned orders reduce revenue and add fulfilment cost", isTotal: false, isResult: false, positive: false },
  { step: "Net Revenue",    amount:  397_000, pct:   76.3, meaning: "Revenue remaining after discounts and returns",          isTotal: true,  isResult: false, positive: true  },
  { step: "Variable Costs", amount: -199_000, pct:  -38.3, meaning: "Product, fulfilment and payment processing costs",      isTotal: false, isResult: false, positive: false },
  { step: "Contribution",   amount:  198_000, pct:   38.0, meaning: "What remains to pay overheads and create profit",       isTotal: true,  isResult: false, positive: true  },
  { step: "Fixed Costs",    amount: -120_000, pct:  -23.1, meaning: "Payroll, software, rent and other overheads",           isTotal: false, isResult: false, positive: false },
  { step: "Profit",         amount:   78_000, pct:   15.0, meaning: "Operating profit (EBITDA) after all costs",             isTotal: true,  isResult: true,  positive: true  },
];

// ─── Driver data — corrected to net +£18,000 ────────────────────────────────
// Revenue growth (+9) + Better margin (+18) + Lower returns (+4) + Higher overheads (-13) = +18
const DRIVER_DATA = [
  { driver: "Revenue growth",   impact:  9_000,  explanation: "Sales growth added more contribution" },
  { driver: "Better margin",    impact: 18_000,  explanation: "Pricing, discounting and product mix improved" },
  { driver: "Lower returns",    impact:  4_000,  explanation: "Fewer returns protected net revenue" },
  { driver: "Higher overheads", impact: -13_000, explanation: "Payroll and software costs increased" },
];

const PROFIT_LOSS_AREAS = [
  {
    title: "Revenue Quality",
    explanation: "Revenue is not converting into profit as efficiently as it could.",
    value: 6_000,
  },
  {
    title: "Overhead Growth",
    explanation: "Fixed costs are rising faster than profit capacity.",
    value: 4_000,
  },
  {
    title: "Discount Leakage",
    explanation: "Promotions are reducing retained profit.",
    value: 8_000,
  },
];

const PROFIT_GROWTH_ACTIONS = [
  {
    title: "Reduce discount dependency",
    impact: 18_000,
    confidence: "High",
    effort: "Low",
    timing: "Immediate",
    why: "Discounting is still reducing retained profit and weakening the quality of revenue growth.",
    start: "Set a tighter discount ceiling, remove blanket codes first, and monitor profit per order daily before widening the change.",
  },
  {
    title: "Improve contribution margin",
    impact: 12_000,
    confidence: "Medium",
    effort: "Medium",
    timing: "2-4 weeks",
    why: "More revenue needs to survive product, fulfilment and payment costs before it can become profit.",
    start: "Review the lowest-margin SKU and channel combinations, then shift spend toward products with stronger contribution per order.",
  },
  {
    title: "Slow overhead growth",
    impact: 13_000,
    confidence: "Medium",
    effort: "Low",
    timing: "1-2 weeks",
    why: "Rising fixed costs reduce operating leverage and make profit more sensitive to revenue slowdowns.",
    start: "Pause discretionary hiring and software additions, then review the two fastest-growing overhead lines for deferral or renegotiation.",
  },
  {
    title: "Improve returns performance",
    impact: 4_000,
    confidence: "Medium",
    effort: "Medium",
    timing: "3-6 weeks",
    why: "Returns reduce net revenue and add operational cost after the sale has already been made.",
    start: "Identify the highest-return SKUs, update sizing and product guidance, and route repeat return issues into merchandising review.",
  },
];

// ─── Staff cost efficiency trend data ────────────────────────────────────────
const STAFF_COST_TREND = [
  { month: "Jan", efficiency: 2.10 },
  { month: "Feb", efficiency: 2.25 },
  { month: "Mar", efficiency: 2.45 },
  { month: "Apr", efficiency: 2.55 },
  { month: "May", efficiency: 2.70 },
  { month: "Jun", efficiency: 2.80 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number, decimals = 0) =>
  (n < 0 ? "-" : "") + "£" + Math.abs(Math.round(n)).toLocaleString("en-GB", { maximumFractionDigits: decimals });

const fmtPct = (n: number, decimals = 1) => (n * 100).toFixed(decimals) + "%";

// ─── Sub-components ───────────────────────────────────────────────────────────

function CfoInsightCard({ text }: { text: string }) {
  return (
    <div className="sc-purple rounded-2xl shadow-sm overflow-hidden">
      <div className="sc-purple-header flex items-center gap-2.5 px-6 py-3.5">
        <Sparkles className="w-4 h-4 text-indigo-300 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">CFO Insight</span>
      </div>
      <div className="px-6 py-5">
        <p className="text-sm font-medium text-foreground leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function InlineCfoInsight({ text }: { text: string }) {
  return (
    <div className="sc-purple rounded-xl px-4 py-3">
      <p className="text-xs text-indigo-300 font-semibold uppercase tracking-wider mb-1">CFO Insight</p>
      <p className="text-sm text-foreground leading-relaxed">{text}</p>
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  subValue?: string;
  delta: string;
  positive: boolean;
  neutral?: boolean;
  deltaLabel?: string;
  insight: string;
}
function KpiCard({ label, value, subValue, delta, positive, neutral, deltaLabel = "vs prior period", insight }: KpiCardProps) {
  const DeltaIcon = neutral ? Zap : positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-sm px-5 py-4 flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-display font-bold text-foreground leading-none">{value}</p>
      {subValue && (
        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 -mt-0.5">{subValue}</p>
      )}
      <div className="flex items-center gap-1.5">
        <span className={cn(
          "inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full",
          neutral
            ? "bg-secondary text-muted-foreground"
            : positive
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
              : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
        )}>
          <DeltaIcon className="w-3 h-3" />
          {delta}
        </span>
        <span className="text-[11px] text-muted-foreground">{deltaLabel}</span>
      </div>
      <p className="text-[11px] text-muted-foreground/80 leading-snug mt-0.5">{insight}</p>
    </div>
  );
}

// Custom tooltip for bridge chart
function BridgeTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = BRIDGE_CHART_DATA.find(d => d.name === label);
  if (!row) return null;
  const isNeg = row.type === "negative";
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2.5 text-sm">
      <p className="font-semibold text-foreground mb-0.5">{label}</p>
      <p className={cn("font-bold", isNeg ? "text-red-500" : "text-emerald-600")}>
        {isNeg ? "-" : ""}£{Math.abs(row.value).toLocaleString()}
      </p>
    </div>
  );
}

// Custom tooltip for drivers chart
function DriverTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2.5 text-sm max-w-48">
      <p className="font-semibold text-foreground mb-0.5">{label}</p>
      <p className={cn("font-bold", val >= 0 ? "text-emerald-600" : "text-red-500")}>
        {val >= 0 ? "+" : ""}£{Math.abs(val).toLocaleString()}
      </p>
    </div>
  );
}

// ─── Main page component ─────────────────────────────────────────────────────
export default function ProfitGrowth() {
  // Simulator state
  const [revChange,      setRevChange]      = useState(0);
  const [discountChange, setDiscountChange] = useState(0);
  const [returnsChange,  setReturnsChange]  = useState(0);
  const [varCostChange,  setVarCostChange]  = useState(0);
  const [fixedChange,    setFixedChange]    = useState(0);

  // Simulator calculations
  const adjRevenue       = BASE_REVENUE * (1 + revChange / 100);
  const adjContribMargin = CONTRIBUTION_MARGIN_PCT
                           - discountChange / 100
                           - returnsChange / 100
                           - varCostChange / 100;
  const projContrib      = adjRevenue * adjContribMargin;
  const projFixed        = BASE_FIXED_COSTS * (1 + fixedChange / 100);
  const projEBITDA       = projContrib - projFixed;
  const projEBITDAMargin = adjRevenue > 0 ? projEBITDA / adjRevenue : 0;
  const ebitdaMovement   = projEBITDA - BASE_EBITDA;

  const simInterpretation = projEBITDA < 0
    ? "This scenario pushes the business below break-even. Focus on margin recovery or reducing overheads before growing further."
    : ebitdaMovement >= 0
      ? "This scenario strengthens profit because contribution growth more than offsets any overhead movement."
      : "This scenario weakens profit because margin pressure or rising overheads absorbs too much contribution.";

  const simColor = projEBITDA < 0
    ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400"
    : ebitdaMovement >= 0
      ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400"
      : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400";

  const SimIcon = projEBITDA < 0 ? AlertTriangle : ebitdaMovement >= 0 ? TrendingUp : TrendingDown;

  return (
    <AppLayout>
      {/* ── Page header ── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Profit Growth</h1>
          <p className="text-sm text-muted-foreground mt-1">
            See how much profit is available, where it is leaking, and what to fix first.
          </p>
        </div>
        <TimelineSelector />
      </div>

      {/* ── 1. CFO Profit Verdict ── */}
      <div className="sc-purple rounded-2xl shadow-md mb-5 overflow-hidden">
        <div className="sc-purple-header flex items-center gap-3 px-6 py-3">
          <Sparkles className="w-4 h-4 text-indigo-300 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">CFO Profit Verdict</span>
          <span className="ml-auto inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 whitespace-nowrap">Action required</span>
        </div>
        <div className="px-6 py-4">
          <p className="text-lg sm:text-xl font-bold text-foreground leading-snug">£18,000 of additional monthly profit appears available.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3 pb-3 border-b border-primary/15">
            <div className="rounded-xl bg-secondary/30 border border-primary/10 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Current Profit</p>
              <p className="text-xl font-display font-bold text-foreground leading-none">£{BASE_EBITDA.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground leading-snug mt-1">15% of revenue.</p>
            </div>
            <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">Profit Available</p>
              <p className="text-3xl font-display font-bold text-emerald-700 dark:text-emerald-300 leading-none">£18,000</p>
              <p className="text-xs text-emerald-700/75 dark:text-emerald-300/75 leading-snug mt-1">additional monthly profit identified.</p>
            </div>
            <div className="rounded-xl bg-secondary/30 border border-primary/10 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Do First</p>
              {canAccess("profit_recommendations") ? (
                <p className="text-sm font-bold text-foreground leading-snug">Reduce discount dependency before adding more overhead.</p>
              ) : (
                <p className="text-sm font-bold text-foreground leading-snug">Upgrade to Pro to view the prioritised profit growth plan.</p>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mt-3">Profit is improving, but discounting, overhead growth and revenue quality are still reducing how much revenue converts into profit.</p>
          <div className="pt-3 flex flex-wrap gap-2">
            {["Discount leakage", "Overhead pressure", "Revenue quality"].map((signal) => (
              <span key={signal} className="rounded-full bg-secondary/30 border border-primary/10 px-3 py-1.5 text-xs font-semibold text-foreground">{signal}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. Where Profit Is Being Lost ── */}
      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">Where Profit Is Being Lost</h2>
        <p className="text-sm text-muted-foreground mt-0.5">The main areas where profit can be recovered without relying on more revenue.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {PROFIT_LOSS_AREAS.map((area) => (
          <div key={area.title} className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Profit leak</p>
                <p className="text-sm font-semibold text-foreground leading-snug">{area.title}</p>
              </div>
              {canAccess("profit_recommendations") ? (
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">£{area.value.toLocaleString()}</p>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"><Lock className="w-3 h-3" /> PRO</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{area.explanation}</p>
            {!canAccess("profit_recommendations") && (
              <p className="text-xs text-primary font-semibold mt-2">Upgrade to Pro to see the value of this lever</p>
            )}
          </div>
        ))}
      </div>

      {/* ── 3. Profit Growth Plan ── */}
      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">Profit Growth Plan</h2>
        <p className="text-sm text-muted-foreground mt-0.5">The priority actions to increase profit and protect scalability.</p>
      </div>
      {canAccess("profit_recommendations") ? (
        <div className="space-y-4 mb-8">
          {PROFIT_GROWTH_ACTIONS.map((action, i) => (
            <details key={action.title} open={i === 0} className={cn("group rounded-2xl border bg-card shadow-sm overflow-hidden", i === 0 ? "border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/50 dark:bg-emerald-950/10" : "border-border/60")}>
              <summary className={cn("list-none cursor-pointer px-6 py-5 transition-colors", i === 0 ? "hover:bg-emerald-50 dark:hover:bg-emerald-950/20" : "hover:bg-secondary/20")}>
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-5 items-start">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={cn("flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-xs font-bold", i === 0 ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300" : "bg-secondary text-muted-foreground")}>{i + 1}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-bold text-foreground">{action.title}</p>
                        {i === 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950 uppercase tracking-wider">START FIRST</span>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 leading-snug">{action.why}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-[auto_auto_auto_auto] gap-2 lg:justify-end">
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-700/40 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-0.5">Impact</p><p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">£{action.impact.toLocaleString()}</p></div>
                    <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Confidence</p><p className="text-sm font-semibold text-foreground">{action.confidence}</p></div>
                    <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Effort</p><p className="text-sm font-semibold text-foreground">{action.effort}</p></div>
                    <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Timing</p><p className="text-sm font-semibold text-foreground">{action.timing}</p></div>
                  </div>
                </div>
              </summary>
              <div className="px-6 pb-5 -mt-1"><div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-4 pl-11"><div className="rounded-xl bg-secondary/30 border border-border/50 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Why it matters</p><p className="text-sm text-foreground leading-relaxed">{action.why}</p></div><div className="rounded-xl bg-secondary/30 border border-border/50 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">How to start</p><p className="text-sm text-foreground leading-relaxed">{action.start}</p></div></div></div>
            </details>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/70 dark:bg-indigo-950/25 shadow-sm mb-8 px-6 py-5"><div className="flex items-start gap-3"><div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0"><Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /></div><div><p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Your Profit Growth Plan</p><p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 mt-1">A clear route exists to increase profit through revenue quality, margin improvement and overhead discipline. Upgrade to view priorities, timing, impact and implementation steps.</p></div></div></div>
      )}

      {/* ── 4. Profit Growth Simulator ── */}
      <div className="mb-2"><h2 className="text-xl font-bold text-foreground">Profit Growth Simulator</h2><p className="text-sm text-muted-foreground mt-0.5">See exactly how much additional profit you could create before making a single operational change.</p></div>
      {canAccess("profit_simulator") ? (
        <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">

        <div className="mb-5">
          <InlineCfoInsight text="Profit is currently most sensitive to discounting and overhead changes. Use this tool before making pricing, marketing or hiring decisions." />
        </div>

        <div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Sliders */}
            <div className="space-y-6">
              <SimulatorSlider
                label="Revenue Change"
                value={revChange}
                min={-20} max={30} step={1}
                unit="%" showSign
                onChange={(v) => setRevChange(v)}
                description={`Adjusted revenue: ${fmt(adjRevenue)}`}
              />
              <SimulatorSlider
                label="Discount Rate Change"
                value={discountChange}
                min={-5} max={8} step={0.5}
                unit="pp" showSign
                onChange={(v) => setDiscountChange(v)}
                description="Impact on margin from discounting"
                positiveIsGood={false}
              />
              <SimulatorSlider
                label="Returns Rate Change"
                value={returnsChange}
                min={-5} max={5} step={0.5}
                unit="pp" showSign
                onChange={(v) => setReturnsChange(v)}
                description="Impact on margin from returns"
                positiveIsGood={false}
              />
              <SimulatorSlider
                label="Variable Cost Change"
                value={varCostChange}
                min={-5} max={5} step={0.5}
                unit="pp" showSign
                onChange={(v) => setVarCostChange(v)}
                description="Impact on margin from variable costs"
                positiveIsGood={false}
              />
              <SimulatorSlider
                label="Overhead Change"
                value={fixedChange}
                min={-20} max={20} step={1}
                unit="%" showSign
                onChange={(v) => setFixedChange(v)}
                description={`Projected overheads: ${fmt(projFixed)}`}
                positiveIsGood={false}
              />
            </div>

            {/* Results */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Projected Outcomes</h4>
              <div className="space-y-2">
                {[
                  { label: "Projected Revenue",                      value: fmt(adjRevenue),          highlight: false, isPeriod: false },
                  { label: "Projected Gross Profit Before Overheads", value: fmt(projContrib),         highlight: false, isPeriod: false },
                  { label: "Projected Overheads",                    value: fmt(projFixed),            highlight: false, isPeriod: false },
                  { label: "Projected Profit",                       value: fmt(projEBITDA),           highlight: true,  isPeriod: false },
                  { label: "Profit Movement vs Base",                value: "",                        highlight: true,  isPeriod: true  },
                  { label: "Projected Profit Margin",                value: fmtPct(projEBITDAMargin),  highlight: false, isPeriod: false },
                ].map(({ label, value, highlight, isPeriod }) => (
                  <div
                    key={label}
                    className={cn(
                      "flex items-center justify-between px-4 py-2.5 rounded-xl",
                      highlight ? "bg-secondary/60 border border-border/50" : "bg-secondary/30",
                    )}
                  >
                    <span className={cn("text-xs", highlight ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {label}
                    </span>
                    {isPeriod ? (
                      <PeriodImpact value={ebitdaMovement} className="items-end" />
                    ) : (
                      <span className={cn(
                        "text-sm font-bold tabular-nums",
                        highlight
                          ? projEBITDA < 0
                            ? "text-red-600 dark:text-red-400"
                            : ebitdaMovement >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400"
                          : "text-foreground",
                      )}>
                        {value}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Interpretation */}
              <div className={cn("rounded-xl border px-4 py-3 mt-2 flex items-start gap-2.5", simColor)}>
                <SimIcon className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed font-medium">{simInterpretation}</p>
              </div>

              {/* Reset */}
              {(revChange !== 0 || discountChange !== 0 || returnsChange !== 0 || varCostChange !== 0 || fixedChange !== 0) && (
                <button
                  onClick={() => {
                    setRevChange(0);
                    setDiscountChange(0);
                    setReturnsChange(0);
                    setVarCostChange(0);
                    setFixedChange(0);
                  }}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline mt-1"
                >
                  Reset to base case
                </button>
              )}
            </div>
          </div>
        </div>

        </div>
      ) : (
        <div className="rounded-2xl border border-primary/20 bg-card shadow-sm mb-8 overflow-hidden"><div className="px-6 py-8 text-center"><div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mb-4"><Lock className="w-4 h-4 text-primary" /></div><p className="text-base font-semibold text-foreground mb-2">Unlock the Profit Growth Simulator</p><p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6 leading-relaxed">Model revenue, discounting, returns, variable costs and overhead changes before committing resources.</p><a href="/upgrade" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">Unlock Simulator</a></div></div>
      )}

      <AiCfoAskCard pageId="profit" />

      {/* ── 6. Supporting Analysis ── */}
      <details className="group bg-card rounded-2xl shadow-sm border border-border/50 mb-8 overflow-hidden">
        <summary className="list-none cursor-pointer px-6 py-5 hover:bg-secondary/20 transition-colors">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Supporting Analysis</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Profit bridge, sensitivity, overheads, staff efficiency and trend evidence.</p>
            </div>
            <span className="text-xs font-semibold text-primary group-open:hidden">Expand</span>
            <span className="text-xs font-semibold text-primary hidden group-open:inline">Collapse</span>
          </div>
        </summary>
        <div className="px-6 pb-6 pt-2">
          {canAccess("profit_driver_table") ? (
            <div className="space-y-8">
      {/* ── Profit Trend micro-summary ── */}
      <div className="sc-teal flex items-center gap-3 px-5 py-3 rounded-xl mb-4">
        <TrendingUp className="w-4 h-4 text-[#22D3EE] shrink-0" />
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-[#22D3EE]">Profit Trend: Improving</span>
          <span className="text-xs text-cyan-300/70">Profit increased by £18k this period, driven by margin expansion and stronger contribution.</span>
        </div>
      </div>

      {/* ── B. Decision KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <KpiCard
          label="Monthly Profit"
          value="£78,000"
          subValue="15% of revenue"
          delta="+£18,000"
          positive={true}
          insight="Profit margin improved from 12.6% last month"
        />
        <KpiCard
          label="Profit Threshold"
          value="£316,000"
          delta="£24,000 lower"
          positive={true}
          insight="If monthly revenue falls below this level, profit turns negative."
        />
        <KpiCard
          label="Safety Margin"
          value="39%"
          delta="+6pp"
          positive={true}
          insight="Revenue could fall 39% before profit turns negative"
        />
        <KpiCard
          label="Contribution Margin"
          value="38.0%"
          delta="+2.4pp"
          positive={true}
          insight="Revenue available to pay overheads and generate profit."
        />
        <KpiCard
          label="Profit Conversion"
          value="£3,800"
          delta="+£240"
          positive={true}
          insight="Every £10k of sales creates £3.8k before overheads."
        />
        <KpiCard
          label="Overhead Load"
          value="61%"
          delta="-7pp"
          positive={true}
          insight="61% of contribution is used by fixed costs"
        />
      </div>

      {/* ── B2. What would improve profit fastest? — free ── */}
      <div className="mb-8 rounded-2xl border border-border/50 bg-card shadow-sm p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">What would improve profit fastest?</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              The fastest route to higher profit is to protect margin, reduce discounting and grow revenue without adding overheads.
            </p>
          </div>
        </div>
        <ul className="space-y-2">
          {[
            "Reduce discounting by 3pp",
            "Increase contribution margin by 2pp",
            "Grow revenue by £60k without increasing overheads",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 shrink-0" />
              <span className="text-sm text-foreground/80">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── C. Staff Cost Efficiency ── */}
      <div className="mb-8">
        <div className="mb-4">
          <h3 className="font-semibold text-lg text-foreground">Staff Cost Efficiency</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Shows how effectively team costs are converting into profit before overheads.
          </p>
        </div>

        <div className="mb-4">
          <InlineCfoInsight text="Staff cost efficiency is improving. Each £1 spent on staff now generates £2.80 of profit before overheads, up from £2.45 last period." />
        </div>

        {/* 3 summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Card A */}
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Staff Cost Efficiency</p>
            </div>
            <p className="text-3xl font-display font-bold text-foreground mb-1">£2.80</p>
            <p className="text-xs text-muted-foreground mb-3">profit before overheads per £1 staff cost</p>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                <ArrowUpRight className="w-3 h-3" />+£0.35
              </span>
              <span className="text-[11px] text-muted-foreground">vs prior period</span>
            </div>
          </div>

          {/* Card B */}
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Staff Cost Ratio</p>
            </div>
            <p className="text-3xl font-display font-bold text-foreground mb-1">18.5%</p>
            <p className="text-xs text-muted-foreground mb-3">staff costs as a % of revenue</p>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                <ArrowUpRight className="w-3 h-3" />-1.2pp
              </span>
              <span className="text-[11px] text-muted-foreground">vs prior period</span>
            </div>
          </div>

          {/* Card C */}
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Staff Cost Trend</p>
            </div>
            <p className="text-3xl font-display font-bold text-emerald-600 dark:text-emerald-400 mb-1">Improving</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Efficiency has improved for 4 consecutive periods
            </p>
          </div>
        </div>

        {/* 6-period trend chart — Pro gated */}
        <PremiumBlurPreview
          title="6-Month Efficiency Trend"
          subtitle="Staff cost efficiency over the last 6 months (£ profit before overheads per £1 staff cost)."
          isPro={canAccess("profit_staff_cost_trend")}
          ctaTitle="Upgrade to Pro to unlock staff cost trend analysis"
          ctaDescription="See how efficiently your team costs are converting into profit over time."
          ctaText="Upgrade →"
          className="mb-3"
        >
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={STAFF_COST_TREND} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[1.8, 3.0]}
                  tickFormatter={(v) => `£${v.toFixed(2)}`}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  formatter={(v: number) => [`£${v.toFixed(2)}`, "Efficiency"]}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="efficiency"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#22c55e", strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </PremiumBlurPreview>

        {/* Helper text */}
        <p className="text-xs text-muted-foreground/70 italic">
          The higher this number, the more contribution the business generates for every £1 spent on people.
        </p>
      </div>

      {/* ── D. What Changed Profit This Period? ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50">
          <h3 className="font-semibold text-lg text-foreground">What Changed Profit This Period?</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your monthly profit improved by £18k. Here are the main reasons.
          </p>
        </div>

        <div className="px-6 pt-5 pb-2">
          <InlineCfoInsight text="Profit improved by £18k this period, mainly due to stronger margin and better revenue quality, partly offset by higher overheads." />
        </div>

        {canAccess("profit_driver_table") ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-6">
            {/* Driver table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-secondary/40">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Driver</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Profit Impact</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">What happened</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {DRIVER_DATA.map((row) => (
                    <tr key={row.driver} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-3 font-medium text-foreground text-sm">{row.driver}</td>
                      <td className={cn(
                        "px-4 py-3 text-right font-semibold text-sm tabular-nums",
                        row.impact >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                      )}>
                        {row.impact >= 0 ? `+£${row.impact.toLocaleString()}` : `(£${Math.abs(row.impact).toLocaleString()})`}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{row.explanation}</td>
                    </tr>
                  ))}
                  {/* Net row */}
                  <tr className="bg-emerald-50/50 dark:bg-emerald-950/15 border-t border-emerald-200 dark:border-emerald-800/40">
                    <td className="px-6 py-3 font-semibold text-foreground text-sm">Net profit movement</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">+£18,000</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">Overall profit improvement vs prior period</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Driver bar chart */}
            <div className="px-6 pb-6 pt-4 lg:pt-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Profit Impact by Driver</h4>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={DRIVER_DATA}
                    layout="vertical"
                    margin={{ top: 0, right: 48, left: 0, bottom: 0 }}
                    barSize={22}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => `£${(Math.abs(v) / 1_000).toFixed(0)}k`}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="driver"
                      width={115}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ReferenceLine x={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                    <Tooltip content={<DriverTooltip />} />
                    <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                      {DRIVER_DATA.map((entry) => (
                        <Cell
                          key={entry.driver}
                          fill={entry.impact >= 0 ? "#22c55e" : "#ef4444"}
                          fillOpacity={0.8}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 pb-6">
            {/* Ghost table — blurred */}
            <div className="blur-sm opacity-40 pointer-events-none select-none" aria-hidden>
              <table className="w-full text-sm mb-4">
                <thead>
                  <tr className="border-b border-border/40 bg-secondary/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Driver</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Profit Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {DRIVER_DATA.map((row) => (
                    <tr key={row.driver}>
                      <td className="px-4 py-3 text-sm text-foreground">{row.driver}</td>
                      <td className="px-4 py-3 text-right font-semibold text-sm">████████</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Upgrade prompt */}
            <a href="/upgrade" className="mt-2 flex items-center gap-4 rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/90 dark:bg-indigo-950/40 px-5 py-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors cursor-pointer">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
                <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Upgrade to Pro to unlock the profit driver breakdown</p>
                <p className="text-xs text-indigo-700/70 dark:text-indigo-400/70 mt-0.5">See exactly what moved profit this period — by driver, amount and explanation.</p>
              </div>
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap shrink-0">Upgrade →</span>
            </a>
          </div>
        )}
      </div>

      {/* ── D. Where Your Revenue Turns Into Profit ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50">
          <h3 className="font-semibold text-lg text-foreground">Where Your Revenue Turns Into Profit</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            See how gross sales reduce through discounts, returns, variable costs and overheads before becoming profit.
          </p>
        </div>

        <div className="px-6 pt-5">
          <InlineCfoInsight text="Increasing revenue through discounting would weaken profit. Margin improvements currently deliver more value than low-quality volume growth." />
        </div>

        {/* Waterfall chart */}
        <div className="px-6 pb-2 pt-5">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={BRIDGE_CHART_DATA} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barSize={42}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip content={<BridgeTooltip />} />
                <Bar dataKey="invisible" stackId="bridge" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="value" stackId="bridge" radius={[4, 4, 0, 0]} isAnimationActive={true}>
                  {BRIDGE_CHART_DATA.map((entry) => (
                    <Cell key={entry.name} fill={BRIDGE_COLOR[entry.type]} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Chart legend */}
          <div className="flex items-center gap-4 mt-1 px-1">
            {[
              { color: "#22c55e", label: "Positive" },
              { color: "#ef4444", label: "Deduction" },
              { color: "#94a3b8", label: "Sub-total" },
              { color: "#6366f1", label: "Profit" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                <span className="text-[11px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
          {/* Helper note */}
          <p className="text-xs text-muted-foreground/70 italic mt-3 pb-2">
            The goal is not just to grow revenue — it is to increase the amount of revenue that survives through to profit.
          </p>
        </div>

        {/* Supporting table */}
        <div className="border-t border-border/50 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-secondary/40">
                <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Step</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">% of Sales</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">What it means</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {BRIDGE_TABLE.map((row) => (
                <tr
                  key={row.step}
                  className={cn(
                    "transition-colors hover:bg-secondary/20",
                    row.isResult && "bg-indigo-50/50 dark:bg-indigo-950/15",
                    row.isTotal && !row.isResult && "bg-secondary/30",
                  )}
                >
                  <td className={cn(
                    "px-6 py-3 font-medium",
                    row.isResult ? "text-indigo-700 dark:text-indigo-300 font-semibold" :
                    row.isTotal  ? "text-foreground font-semibold" :
                                   "text-muted-foreground pl-10",
                  )}>
                    {row.step}
                  </td>
                  <td className={cn(
                    "px-4 py-3 text-right font-semibold tabular-nums",
                    row.positive
                      ? row.isResult
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-foreground"
                      : "text-red-600 dark:text-red-400",
                  )}>
                    {row.amount < 0
                      ? `(£${Math.abs(row.amount).toLocaleString()})`
                      : `£${row.amount.toLocaleString()}`}
                  </td>
                  <td className={cn(
                    "px-4 py-3 text-right tabular-nums text-xs",
                    row.pct < 0 ? "text-red-500" : "text-muted-foreground",
                  )}>
                    {row.pct < 0 ? `(${Math.abs(row.pct).toFixed(1)}%)` : `${row.pct.toFixed(1)}%`}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                    {row.meaning}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── E. Profit Scaling Indicators ── */}
      <div className="mb-8">
        <div className="mb-4">
          <h3 className="font-semibold text-lg text-foreground">How Easily Profit Scales</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Shows whether growth is likely to create more profit or be absorbed by overheads.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Overhead Load */}
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Overhead Load</p>
            </div>
            <p className="text-3xl font-display font-bold text-foreground mb-3">61%</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              61% of contribution is currently being used by fixed costs. Lower is better, because more profit drops through as revenue grows.
            </p>
            <div className="mt-4">
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: "61%" }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0%</span>
                <span className="text-amber-600 font-semibold">61% used by overheads</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Profit Threshold */}
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Profit Threshold</p>
            </div>
            <p className="text-3xl font-display font-bold text-foreground mb-3">£316,000</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              At the current margin, the business needs £316k of monthly revenue to cover overheads and break even.
            </p>
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Profit threshold</span>
                <span className="font-semibold text-foreground">£316,000</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Current revenue</span>
                <span className="font-semibold text-emerald-600">£520,000</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Revenue headroom</span>
                <span className="font-semibold text-emerald-600">+£204,000</span>
              </div>
            </div>
          </div>

          {/* Profit Scaling Power */}
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Profit Scaling Power</p>
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <p className="text-3xl font-display font-bold text-foreground">Strong</p>
              <p className="text-base font-semibold text-muted-foreground">2.4×</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Profit is currently growing faster than revenue, which means the business is starting to scale efficiently.
            </p>
            <div className="mt-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 px-3 py-2">
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-snug">
                Profit scaling improves when revenue and margin grow faster than overheads.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Profit Sensitivity Ranking ── */}
      <div className="mb-6 rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Profit Sensitivity Ranking</p>
            <p className="text-xs text-muted-foreground mt-0.5">What affects your profit most?</p>
          </div>
        </div>
        <div className="px-5 py-4">
          <ol className="space-y-2">
            {PROFIT_GROWTH_ACTIONS.map((item, i) => (
              <li key={item.title} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[11px] font-bold text-muted-foreground shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground">{item.title}</span>
                <span className="ml-auto text-xs font-semibold text-foreground tabular-nums">£{item.impact.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>


            </div>
          ) : (
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/70 dark:bg-indigo-950/25 px-5 py-4"><div className="flex items-start gap-3"><Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" /><div><p className="text-sm font-semibold text-indigo-950 dark:text-indigo-100">Supporting analysis available on Pro</p><p className="text-xs text-indigo-800/80 dark:text-indigo-200/80 mt-1">Unlock profit bridge, sensitivity, overheads, staff efficiency and trend evidence.</p></div></div></div>
          )}
        </div>
      </details>

      <DataBenchmarkAssumptions
        benchmarkNote="Profit health is assessed using contribution margin, overhead load and break-even distance."
        dataQualityNote="Profit analysis depends on accurate fixed cost, contribution and overhead mapping."
        className="mb-2"
      />

    </AppLayout>
  );
}
