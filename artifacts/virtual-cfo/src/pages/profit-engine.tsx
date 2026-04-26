import { useState } from "react";
import {
  Sparkles, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle, Info, Zap, Activity,
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
const CONTRIBUTION_MARGIN_PCT  = CONTRIBUTION / BASE_REVENUE;   // ≈ 38.08%
const FIXED_COST_ABSORPTION_PCT = BASE_FIXED_COSTS / CONTRIBUTION; // ≈ 60.6%
const BREAK_EVEN_REVENUE       = Math.round(BASE_FIXED_COSTS / CONTRIBUTION_MARGIN_PCT); // ≈ 315,400
const MARGIN_OF_SAFETY_PCT     = (BASE_REVENUE - BREAK_EVEN_REVENUE) / BASE_REVENUE;     // ≈ 39.3%
const EBITDA_MARGIN_PCT        = BASE_EBITDA / BASE_REVENUE;    // 15.0%

// ─── Bridge waterfall data ───────────────────────────────────────────────────
const BRIDGE_CHART_DATA = [
  { name: "Revenue",        invisible: 0,       value: 520_000, type: "positive" },
  { name: "Discounts",      invisible: 438_000,  value: 82_000,  type: "negative" },
  { name: "Returns",        invisible: 397_000,  value: 41_000,  type: "negative" },
  { name: "Net Revenue",    invisible: 0,        value: 397_000, type: "subtotal" },
  { name: "Var. Costs",     invisible: 198_000,  value: 199_000, type: "negative" },
  { name: "Contribution",   invisible: 0,        value: 198_000, type: "subtotal" },
  { name: "Fixed Costs",    invisible: 78_000,   value: 120_000, type: "negative" },
  { name: "EBITDA",         invisible: 0,        value: 78_000,  type: "result"   },
];

const BRIDGE_COLOR: Record<string, string> = {
  positive: "#22c55e",
  negative: "#ef4444",
  subtotal: "#94a3b8",
  result:   "#6366f1",
};

// ─── Bridge table rows ───────────────────────────────────────────────────────
const BRIDGE_TABLE = [
  { step: "Revenue",        amount:  520_000, pct:  100.0, commentary: "Gross sales before discounts and returns",              isTotal: false, isResult: false, positive: true  },
  { step: "Discounts",      amount: -82_000,  pct:  -15.8, commentary: "Discounting remains a significant margin drag",          isTotal: false, isResult: false, positive: false },
  { step: "Returns",        amount: -41_000,  pct:   -7.9, commentary: "Returns reduce net revenue and fulfilment efficiency",  isTotal: false, isResult: false, positive: false },
  { step: "Net Revenue",    amount:  397_000, pct:   76.3, commentary: "Revenue retained after discounts and returns",           isTotal: true,  isResult: false, positive: true  },
  { step: "Variable Costs", amount: -199_000, pct:  -38.3, commentary: "Product, fulfilment and payment costs",                 isTotal: false, isResult: false, positive: false },
  { step: "Contribution",   amount:  198_000, pct:   38.0, commentary: "Profit available to cover fixed costs",                  isTotal: true,  isResult: false, positive: true  },
  { step: "Fixed Costs",    amount: -120_000, pct:  -23.1, commentary: "Payroll, software, rent and overheads",                 isTotal: false, isResult: false, positive: false },
  { step: "EBITDA",         amount:   78_000, pct:   15.0, commentary: "Operating profit before depreciation and financing",    isTotal: true,  isResult: true,  positive: true  },
];

// ─── EBITDA driver data ──────────────────────────────────────────────────────
const DRIVER_DATA = [
  { driver: "Revenue growth",            impact:  9_000,  explanation: "Higher sales generated additional contribution" },
  { driver: "Margin improvement",        impact: 18_000,  explanation: "Better pricing and lower discounting improved profit flow-through" },
  { driver: "Returns reduction",         impact:  4_000,  explanation: "Lower returns protected net revenue" },
  { driver: "Fixed cost increase",       impact: -11_000, explanation: "Payroll and software costs increased" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number, decimals = 0) =>
  (n < 0 ? "-" : "") + "£" + Math.abs(Math.round(n)).toLocaleString("en-GB", { maximumFractionDigits: decimals });

const fmtK = (n: number) =>
  (n < 0 ? "-" : "+") + "£" + (Math.abs(n) / 1_000).toFixed(0) + "k";

const fmtPct = (n: number, decimals = 1) => (n * 100).toFixed(decimals) + "%";

// ─── Sub-components ───────────────────────────────────────────────────────────

function CfoInsightCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 shadow-sm mb-8 overflow-hidden">
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

interface KpiCardProps {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
  neutral?: boolean;
  insight: string;
}
function KpiCard({ label, value, delta, positive, neutral, insight }: KpiCardProps) {
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
        <span className="text-[11px] text-muted-foreground">vs prior period</span>
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
  // Simulator state — each value is the raw slider position
  const [revChange,      setRevChange]      = useState(0);   // -20 to +30
  const [discountChange, setDiscountChange] = useState(0);   // pp, -5 to +8
  const [returnsChange,  setReturnsChange]  = useState(0);   // pp, -5 to +5
  const [varCostChange,  setVarCostChange]  = useState(0);   // pp, -5 to +5
  const [fixedChange,    setFixedChange]    = useState(0);   // %, -20 to +20

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
    ? "This scenario pushes the business below break-even. Management should prioritise margin recovery or fixed cost control."
    : ebitdaMovement >= 0
      ? "This scenario strengthens the profit engine because contribution growth more than offsets fixed cost movement."
      : "This scenario weakens the profit engine because margin pressure or fixed cost growth absorbs too much contribution.";

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
            Understand your true profit base, break-even point and how changes in trading performance flow through to EBITDA.
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-full font-medium">
          March 2026
        </span>
      </div>

      {/* ── Top CFO Insight ── */}
      <CfoInsightCard text="Your profit engine is improving because contribution margin has strengthened, but fixed costs are still consuming a high proportion of contribution. The key opportunity is to grow revenue without allowing overheads to rise at the same rate." />

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        <KpiCard
          label="EBITDA"
          value="£78,000"
          delta="+£18,000"
          positive={true}
          insight={`EBITDA margin is ${fmtPct(EBITDA_MARGIN_PCT)}`}
        />
        <KpiCard
          label="Break-even Revenue"
          value="£316,000"
          delta="-£24,000"
          positive={true}
          insight="Lower break-even improves resilience"
        />
        <KpiCard
          label="Contribution Margin"
          value="38.0%"
          delta="+2.4pp"
          positive={true}
          insight="Every £10k revenue creates £3.8k contribution"
        />
        <KpiCard
          label="Fixed Cost Absorption"
          value="61%"
          delta="-7pp"
          positive={true}
          insight="61% of contribution is used by fixed costs"
        />
        <KpiCard
          label="Margin of Safety"
          value="39%"
          delta="+6pp"
          positive={true}
          insight="Revenue could fall 39% before EBITDA turns negative"
        />
      </div>

      {/* ── Revenue to EBITDA Bridge ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50">
          <h3 className="font-semibold text-lg text-foreground">Revenue to EBITDA Bridge</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            How gross revenue flows through to operating profit after each deduction.
          </p>
        </div>

        {/* CFO insight for bridge */}
        <div className="px-6 pt-5">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 mb-5">
            <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">CFO Insight</p>
            <p className="text-sm text-foreground leading-relaxed">
              The business is generating healthy contribution, but EBITDA remains sensitive to fixed cost growth.
              Protecting contribution margin is currently more valuable than chasing low-quality revenue.
            </p>
          </div>
        </div>

        {/* Waterfall chart */}
        <div className="px-6 pb-4">
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
                {/* Invisible base to float each bar to the correct position */}
                <Bar dataKey="invisible" stackId="bridge" fill="transparent" isAnimationActive={false} />
                {/* Visible value bar */}
                <Bar dataKey="value" stackId="bridge" radius={[4, 4, 0, 0]} isAnimationActive={true}>
                  {BRIDGE_CHART_DATA.map((entry) => (
                    <Cell key={entry.name} fill={BRIDGE_COLOR[entry.type]} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Chart legend */}
          <div className="flex items-center gap-4 mt-2 px-1">
            {[
              { color: "#22c55e", label: "Positive" },
              { color: "#ef4444", label: "Deduction" },
              { color: "#94a3b8", label: "Sub-total" },
              { color: "#6366f1", label: "EBITDA" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                <span className="text-[11px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Supporting table */}
        <div className="border-t border-border/50 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-secondary/40">
                <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Step</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">% of Revenue</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Commentary</th>
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
                    {row.commentary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Profit Engine Health ── */}
      <div className="mb-8">
        <h3 className="font-semibold text-lg text-foreground mb-4">Profit Engine Health</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Fixed Cost Absorption */}
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Fixed Cost Absorption</p>
            </div>
            <p className="text-3xl font-display font-bold text-foreground mb-3">61%</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              61% of contribution is currently being consumed by fixed costs. The business has profit upside if revenue
              grows without overheads increasing at the same pace.
            </p>
            {/* Visual bar */}
            <div className="mt-4">
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: "61%" }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0%</span>
                <span className="text-amber-600 font-semibold">61% absorbed</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Break-even */}
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Monthly Break-even Revenue</p>
            </div>
            <p className="text-3xl font-display font-bold text-foreground mb-3">£316,000</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              At the current contribution margin, the business needs £316k of monthly revenue to cover fixed costs.
            </p>
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Break-even</span>
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

          {/* Operating Leverage */}
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Operating Leverage</p>
            </div>
            <p className="text-3xl font-display font-bold text-foreground mb-3">2.4×</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              EBITDA is currently growing faster than revenue, which indicates positive operating leverage.
            </p>
            <div className="mt-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 px-3 py-2">
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-snug">
                Operating leverage improves when contribution grows faster than fixed costs.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Profit Sensitivity Simulator ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50">
          <h3 className="font-semibold text-lg text-foreground">Profit Sensitivity Simulator</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Move the sliders to model how trading changes flow through to EBITDA.
          </p>
        </div>

        {/* CFO insight */}
        <div className="px-6 pt-5">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 mb-6">
            <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">CFO Insight</p>
            <p className="text-sm text-foreground leading-relaxed">
              Small changes in discounting, returns and fixed costs can have a disproportionate impact on EBITDA.
              Use the sliders below to understand which levers matter most.
            </p>
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
                description="Change in discount rate applied to contribution margin"
                positiveIsGood={false}
              />
              <SliderRow
                label="Returns Rate Change"
                value={returnsChange}
                min={-5} max={5} step={0.5}
                unit="pp" showSign
                onChange={(v) => setReturnsChange(v)}
                description="Change in returns rate applied to contribution margin"
                positiveIsGood={false}
              />
              <SliderRow
                label="Variable Cost Change"
                value={varCostChange}
                min={-5} max={5} step={0.5}
                unit="pp" showSign
                onChange={(v) => setVarCostChange(v)}
                description="Change in variable cost rate applied to contribution margin"
                positiveIsGood={false}
              />
              <SliderRow
                label="Fixed Cost Change"
                value={fixedChange}
                min={-20} max={20} step={1}
                unit="%" showSign
                onChange={(v) => setFixedChange(v)}
                description={`Projected fixed costs: ${fmt(projFixed)}`}
                positiveIsGood={false}
              />
            </div>

            {/* Results */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Projected Outcomes</h4>
              <div className="space-y-2">
                {[
                  { label: "Projected Revenue",        value: fmt(adjRevenue),                              highlight: false },
                  { label: "Projected Contribution",   value: fmt(projContrib),                             highlight: false },
                  { label: "Projected Fixed Costs",    value: fmt(projFixed),                               highlight: false },
                  { label: "Projected EBITDA",         value: fmt(projEBITDA),                              highlight: true  },
                  { label: "EBITDA Movement vs Base",  value: (ebitdaMovement >= 0 ? "+" : "") + fmt(Math.abs(ebitdaMovement)) + (ebitdaMovement >= 0 ? "" : " ↓"), highlight: true  },
                  { label: "Projected EBITDA Margin",  value: fmtPct(projEBITDAMargin),                     highlight: false },
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

              {/* Reset button */}
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

      {/* ── What Changed Profit This Month ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50">
          <h3 className="font-semibold text-lg text-foreground">What Changed Profit This Month?</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            EBITDA improved by £18k this month, mainly due to stronger contribution margin and better revenue quality.
          </p>
        </div>

        {/* CFO insight */}
        <div className="px-6 pt-5">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 mb-5">
            <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">CFO Insight</p>
            <p className="text-sm text-foreground leading-relaxed">
              EBITDA improved by £18k this month, mainly due to stronger contribution margin and better revenue quality, partly offset by higher fixed costs.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-6">
          {/* Driver table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-secondary/40">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Driver</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">EBITDA Impact</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Explanation</th>
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
                  <td className="px-6 py-3 font-semibold text-foreground text-sm">Net EBITDA movement</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">+£20,000</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">Overall EBITDA improvement vs prior period</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Driver bar chart */}
          <div className="px-6 pb-6 pt-4 lg:pt-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">EBITDA Impact by Driver</h4>
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
                    width={110}
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

      {/* ── AI CFO Commentary ── */}
      <div className="mb-8">
        <h3 className="font-semibold text-lg text-foreground mb-4">AI CFO Commentary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <CommentaryCard
            type="positive"
            title="Positive Signal"
            text="Contribution margin improved by 2.4pp this period. At current revenue levels, this adds approximately £12k of monthly EBITDA capacity."
          />
          <CommentaryCard
            type="warning"
            title="Early Warning"
            text="Fixed costs increased by 9% versus the prior period. If this continues without matching contribution growth, EBITDA margin will compress."
          />
          <CommentaryCard
            type="info"
            title="Break-even Insight"
            text="The business is currently operating 39% above break-even revenue, giving a reasonable margin of safety."
          />
          <CommentaryCard
            type="info"
            title="Scaling Insight"
            text="If revenue grows by 10% while fixed costs remain flat, EBITDA would increase by approximately £20k — a 26% improvement on the current base."
          />
          <CommentaryCard
            type="action"
            title="CFO Recommendation"
            text="Prioritise revenue growth from profitable channels, limit blanket discounting, and monitor fixed cost creep before adding new overhead."
            className="md:col-span-2 lg:col-span-2"
          />
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

// ─── CommentaryCard sub-component ────────────────────────────────────────────
type CommentaryType = "positive" | "warning" | "info" | "action";
interface CommentaryCardProps {
  type: CommentaryType;
  title: string;
  text: string;
  className?: string;
}
function CommentaryCard({ type, title, text, className }: CommentaryCardProps) {
  const config = {
    positive: {
      icon: CheckCircle,
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      border: "border-emerald-200 dark:border-emerald-800/40",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      titleColor: "text-emerald-800 dark:text-emerald-300",
      textColor: "text-emerald-700/80 dark:text-emerald-400/80",
    },
    warning: {
      icon: AlertTriangle,
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-200 dark:border-amber-800/40",
      iconColor: "text-amber-600 dark:text-amber-400",
      titleColor: "text-amber-800 dark:text-amber-300",
      textColor: "text-amber-700/80 dark:text-amber-400/80",
    },
    info: {
      icon: Info,
      bg: "bg-blue-50 dark:bg-blue-950/20",
      border: "border-blue-200 dark:border-blue-800/40",
      iconColor: "text-blue-600 dark:text-blue-400",
      titleColor: "text-blue-800 dark:text-blue-300",
      textColor: "text-blue-700/80 dark:text-blue-400/80",
    },
    action: {
      icon: Sparkles,
      bg: "bg-indigo-50 dark:bg-indigo-950/20",
      border: "border-indigo-200 dark:border-indigo-800/40",
      iconColor: "text-indigo-600 dark:text-indigo-400",
      titleColor: "text-indigo-800 dark:text-indigo-300",
      textColor: "text-indigo-700/80 dark:text-indigo-400/80",
    },
  }[type];

  const Icon = config.icon;

  return (
    <div className={cn("rounded-2xl border p-5", config.bg, config.border, className)}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-4 h-4 shrink-0", config.iconColor)} />
        <p className={cn("text-xs font-bold uppercase tracking-wider", config.titleColor)}>{title}</p>
      </div>
      <p className={cn("text-sm leading-relaxed", config.textColor)}>{text}</p>
    </div>
  );
}
