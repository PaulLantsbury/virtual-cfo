import { useState } from "react";
import {
  Sparkles, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle, Info, Zap, Activity, Shield,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

// ─── Base data constants ─────────────────────────────────────────────────────
// @dynamic Replace with Xero-derived figures when live data is connected.

const BASE_REVENUE         = 520_000;
const DISCOUNTS            = 82_000;
const RETURNS              = 41_000;
const NET_REVENUE          = BASE_REVENUE - DISCOUNTS - RETURNS; // 397,000
const VARIABLE_COSTS       = 199_000;
const CONTRIBUTION         = NET_REVENUE - VARIABLE_COSTS;       // 198,000
const BASE_FIXED_COSTS     = 120_000;
const BASE_EBITDA          = CONTRIBUTION - BASE_FIXED_COSTS;    // 78,000

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

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number, decimals = 0) =>
  (n < 0 ? "-" : "") + "£" + Math.abs(Math.round(n)).toLocaleString("en-GB", { maximumFractionDigits: decimals });

const fmtPct = (n: number, decimals = 1) => (n * 100).toFixed(decimals) + "%";

// ─── Sub-components ───────────────────────────────────────────────────────────

function CfoInsightCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-3.5 bg-primary/10 border-b border-primary/20">
        <Sparkles className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">CFO Insight</span>
      </div>
      <div className="px-6 py-5">
        <p className="text-sm font-medium text-foreground leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function InlineCfoInsight({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
      <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">CFO Insight</p>
      <p className="text-sm text-foreground leading-relaxed">{text}</p>
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
  neutral?: boolean;
  deltaLabel?: string;
  insight: string;
}
function KpiCard({ label, value, delta, positive, neutral, deltaLabel = "vs prior period", insight }: KpiCardProps) {
  const DeltaIcon = neutral ? Zap : positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-sm px-5 py-4 flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-display font-bold text-foreground leading-none">{value}</p>
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
export default function ProfitEngine() {
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
          <h1 className="text-2xl font-display font-bold text-foreground">Profit Engine</h1>
          <p className="text-sm text-muted-foreground mt-1">
            See how your business generates and protects profit — and where it gets lost along the way.
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-full font-medium">
          March 2026
        </span>
      </div>

      {/* ── A. Profit Engine Summary ── */}
      <div className="mb-8 space-y-4">
        <CfoInsightCard text="Your business is trading profitably and is currently operating 39% above break-even. Profit quality has improved because contribution margin is stronger, but fixed costs are rising and need to be controlled before adding more overhead." />

        {/* Risk level pill */}
        <div className="flex items-start gap-4 p-5 rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Profit Risk Level</p>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-300">
                Moderate
              </span>
            </div>
            <p className="text-sm text-amber-800 dark:text-amber-300/80 leading-relaxed">
              Profitability is stable, but the business is becoming more sensitive to fixed cost increases.
            </p>
          </div>
        </div>
      </div>

      {/* ── B. Decision KPI Strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        <KpiCard
          label="Monthly Profit"
          value="£78,000"
          delta="+£18,000"
          positive={true}
          insight={`Profit margin is ${fmtPct(EBITDA_MARGIN_PCT)}`}
        />
        <KpiCard
          label="Profit Threshold"
          value="£316,000"
          delta="£24,000 lower"
          positive={true}
          insight="Revenue must stay above this level to remain profitable"
        />
        <KpiCard
          label="Safety Margin"
          value="39%"
          delta="+6pp"
          positive={true}
          insight="Revenue could fall 39% before profit turns negative"
        />
        <KpiCard
          label="Profit Per £10k Revenue"
          value="£3,800"
          delta="+£240"
          positive={true}
          insight="Each £10k of revenue creates £3.8k before overheads"
        />
        <KpiCard
          label="Overhead Load"
          value="61%"
          delta="-7pp"
          positive={true}
          insight="61% of contribution is used by fixed costs"
        />
      </div>

      {/* ── C. What Changed Profit This Month? ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50">
          <h3 className="font-semibold text-lg text-foreground">What Changed Profit This Month?</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your monthly profit improved by £18k. Here are the main reasons.
          </p>
        </div>

        <div className="px-6 pt-5 pb-2">
          <InlineCfoInsight text="Profit improved by £18k this month, mainly due to stronger margin and better revenue quality, partly offset by higher overheads." />
        </div>

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
          <InlineCfoInsight text="The business is generating healthy profit, but margins remain sensitive to overhead growth. Protecting margin is currently more valuable than chasing low-quality revenue." />
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
          <h3 className="font-semibold text-lg text-foreground">Profit Scaling Indicators</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            How efficiently the business converts revenue growth into profit growth.
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

      {/* ── F. Profit Sensitivity Simulator ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50">
          <h3 className="font-semibold text-lg text-foreground">Profit Sensitivity Simulator</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Test how changes in sales, discounting, returns and overheads affect profit.
          </p>
        </div>

        <div className="px-6 pt-5">
          <div className="mb-6">
            <InlineCfoInsight text="Small changes in discounting, returns and overheads can have a big impact on profit. Use this to see which levers matter most before making decisions." />
          </div>
        </div>

        <div className="px-6 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Sliders */}
            <div className="space-y-6">
              <SliderRow
                label="Revenue Change"
                value={revChange}
                min={-20} max={30} step={1}
                unit="%" showSign
                onChange={(v) => setRevChange(v)}
                description={`Adjusted revenue: ${fmt(adjRevenue)}`}
              />
              <SliderRow
                label="Discount Rate Change"
                value={discountChange}
                min={-5} max={8} step={0.5}
                unit="pp" showSign
                onChange={(v) => setDiscountChange(v)}
                description="Impact on margin from discounting"
                positiveIsGood={false}
              />
              <SliderRow
                label="Returns Rate Change"
                value={returnsChange}
                min={-5} max={5} step={0.5}
                unit="pp" showSign
                onChange={(v) => setReturnsChange(v)}
                description="Impact on margin from returns"
                positiveIsGood={false}
              />
              <SliderRow
                label="Variable Cost Change"
                value={varCostChange}
                min={-5} max={5} step={0.5}
                unit="pp" showSign
                onChange={(v) => setVarCostChange(v)}
                description="Impact on margin from variable costs"
                positiveIsGood={false}
              />
              <SliderRow
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
                  { label: "Projected Revenue",                     value: fmt(adjRevenue),                                                                                  highlight: false },
                  { label: "Projected Gross Profit Before Overheads", value: fmt(projContrib),                                                                                highlight: false },
                  { label: "Projected Overheads",                   value: fmt(projFixed),                                                                                   highlight: false },
                  { label: "Projected Profit",                      value: fmt(projEBITDA),                                                                                  highlight: true  },
                  { label: "Profit Movement vs Base",               value: (ebitdaMovement >= 0 ? "+" : "") + fmt(Math.abs(ebitdaMovement)) + (ebitdaMovement >= 0 ? "" : " ↓"), highlight: true },
                  { label: "Projected Profit Margin",               value: fmtPct(projEBITDAMargin),                                                                         highlight: false },
                ].map(({ label, value, highlight }) => (
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

      {/* ── G. CFO Recommendations ── */}
      <div className="mb-8">
        <h3 className="font-semibold text-lg text-foreground mb-4">CFO Recommendations</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* What Improved */}
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/20 p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">What Improved</p>
            </div>
            <p className="text-sm text-emerald-700/85 dark:text-emerald-400/85 leading-relaxed">
              Margin improved this period, adding approximately £12k of monthly profit capacity. This suggests pricing, discounting or product mix has moved in the right direction.
            </p>
          </div>

          {/* What To Watch */}
          <div className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">What To Watch</p>
            </div>
            <p className="text-sm text-amber-700/85 dark:text-amber-400/85 leading-relaxed">
              Fixed costs increased by 9%. If overheads continue rising without matching contribution growth, profit margin will start to compress.
            </p>
          </div>

          {/* Recommended Action */}
          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-950/20 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">Recommended Action</p>
            </div>
            <p className="text-sm text-indigo-700/85 dark:text-indigo-400/85 leading-relaxed">
              Prioritise profitable channel growth, limit blanket discounting and avoid adding overhead until revenue is comfortably above the profit threshold.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ─── SliderRow sub-component ──────────────────────────────────────────────────
interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  showSign?: boolean;
  description?: string;
  positiveIsGood?: boolean;
  onChange: (v: number) => void;
}
function SliderRow({ label, value, min, max, step, unit, showSign, description, positiveIsGood = true, onChange }: SliderRowProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const valueGood = positiveIsGood ? isPositive : isNegative;
  const valueBad  = positiveIsGood ? isNegative : isPositive;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <span className={cn(
          "text-sm font-bold tabular-nums px-2 py-0.5 rounded-md min-w-[4rem] text-right",
          valueGood ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20" :
          valueBad  ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20" :
                      "text-muted-foreground bg-secondary",
        )}>
          {showSign && value > 0 ? "+" : ""}{value % 1 === 0 ? value : value.toFixed(1)}{unit}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(vals) => onChange(vals[0])}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>{showSign && min > 0 ? "+" : ""}{min}{unit}</span>
        {description && <span className="text-center flex-1 px-2 text-[10px] text-muted-foreground/70 truncate">{description}</span>}
        <span>+{max}{unit}</span>
      </div>
    </div>
  );
}
