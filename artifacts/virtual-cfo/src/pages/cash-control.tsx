import { useState } from "react";
import {
  Sparkles, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle, Info, Zap, Activity, Shield, Lock,
  Wallet, RefreshCw, Clock, Package, ListOrdered,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { SimulatorSlider } from "@/components/SimulatorSlider";
import { cn } from "@/lib/utils";
import { TimelineSelector } from "@/components/TimelineSelector";
import { canAccess } from "@/lib/plan";
import { AiCfoAskCard } from "@/components/AiCfoAskCard";
import { PeriodImpact } from "@/components/PeriodImpact";
import { DataBenchmarkAssumptions } from "@/components/DataBenchmarkAssumptions";
import { DataPeriodLabel } from "@/components/DataPeriodLabel";
import { useLatestDataPeriod } from "@/lib/analytics/useLatestDataPeriod";
import {
  CASH_BALANCE,
  CASH_RUNWAY,
  MONTHLY_FIXED_COSTS,
  WORKING_CAPITAL_DRAG,
  INVENTORY_DAYS,
  SUPPLIER_DAYS,
  CASH_CONVERSION_CYCLE,
} from "@/lib/data/cash-snapshot";
import { ANNUAL_REVENUE } from "@/lib/data/business-snapshot";

// ─── Base data constants ──────────────────────────────────────────────────────
// Values imported from central mock data layer (src/lib/data/cash-snapshot.ts
// and src/lib/data/business-snapshot.ts). Replace those files with live
// Xero / Shopify feeds when integrations are connected.

const CASH_STORE_ID = "10000000-0000-0000-0000-000000000001";

const NET_CASH_MOVEMENT = 14_000; // unique to Cash Control — not shared elsewhere
const RUNWAY_DENOM      = Math.round(CASH_BALANCE / CASH_RUNWAY);

// ─── Cash Sensitivity Ranking data ───────────────────────────────────────────
const RANKING_DATA = [
  { label: "Inventory days",          impact: 46_000 },
  { label: "Supplier payment timing", impact: 31_000 },
  { label: "Fixed costs",             impact: 24_000 },
  { label: "Marketing spend",         impact: 18_000 },
];

// ─── Bridge waterfall data ────────────────────────────────────────────────────
const BRIDGE_DATA = [
  { name: "Opening Cash",   invisible: 0,       value: 172_000, type: "positive" },
  { name: "Trading Profit", invisible: 172_000, value: 78_000,  type: "positive" },
  { name: "Stock Build",    invisible: 204_000, value: 46_000,  type: "negative" },
  { name: "Receivables",    invisible: 204_000, value: 18_000,  type: "positive" },
  { name: "Supplier Pmts",  invisible: 191_000, value: 31_000,  type: "negative" },
  { name: "Tax / Other",    invisible: 186_000, value: 5_000,   type: "negative" },
  { name: "Closing Cash",   invisible: 0,       value: 186_000, type: "result"   },
];

const BRIDGE_COLOR: Record<string, string> = {
  positive: "#22c55e",
  negative: "#ef4444",
  result:   "#6366f1",
};

// ─── Bridge table rows ────────────────────────────────────────────────────────
const BRIDGE_TABLE = [
  { step: "Opening cash",      amount:  172_000, meaning: "Cash at start of period",                          isTotal: false, isResult: false, positive: true  },
  { step: "Trading profit",    amount:  78_000,  meaning: "Profit generated before working capital movements", isTotal: false, isResult: false, positive: true  },
  { step: "Stock build",       amount: -46_000,  meaning: "Extra stock purchased or not yet sold",             isTotal: false, isResult: false, positive: false },
  { step: "Receivables",       amount:  18_000,  meaning: "More cash collected from customers",                isTotal: false, isResult: false, positive: true  },
  { step: "Supplier payments", amount: -31_000,  meaning: "Faster payments reduced available cash",            isTotal: false, isResult: false, positive: false },
  { step: "Tax / other",       amount:  -5_000,  meaning: "Other operating outflows",                          isTotal: false, isResult: false, positive: false },
  { step: "Closing cash",      amount:  186_000, meaning: "Cash available at period end",                      isTotal: true,  isResult: true,  positive: true  },
];

// ─── Driver data  (78−46−31+18−5 = 14 ✓) ─────────────────────────────────────
const CASH_DRIVER_DATA = [
  { driver: "Trading profit",       impact:  78_000, explanation: "Profit generated cash before working capital" },
  { driver: "Stock build",          impact: -46_000, explanation: "More cash was tied up in inventory" },
  { driver: "Supplier payments",    impact: -31_000, explanation: "Suppliers were paid faster than last period" },
  { driver: "Customer receipts",    impact:  18_000, explanation: "Cash collections improved" },
  { driver: "Tax / other payments", impact:  -5_000, explanation: "Other cash outflows increased" },
];

const CASH_HEADROOM_OPPORTUNITY = {
  value: 64_000,
  confidence: "Medium",
  source: "Inventory days and supplier timing",
  components: [
    {
      id: "stock",
      label: "Inventory release",
      value: 46_000,
      explanation: "A primary contributor to the £64k headroom opportunity.",
    },
    {
      id: "supplier",
      label: "Supplier timing",
      value: 31_000,
      explanation: "A primary contributor to the £64k headroom opportunity.",
    },
  ],
} as const;

const CASH_TRAP_DRIVERS = [
  {
    label: "Inventory build",
    freeLabel: "Stock is tying up more cash than expected",
    freeExplanation: "Detailed cash impact, operating cause and recovery action available in Pro.",
    direction: "negative" as const,
    impact: -46_000,
    explanation: "Inventory is taking 82 days to convert back into cash.",
  },
  {
    label: "Supplier timing",
    freeLabel: "Cash is leaving faster than it is returning",
    freeExplanation: "Unlock the specific cash driver, timing impact and recommended action.",
    direction: "negative" as const,
    impact: -31_000,
    explanation: "Supplier payments are moving faster than cash recovery.",
  },
  {
    label: "Fixed cost pressure",
    freeLabel: "Overheads are reducing cash flexibility",
    freeExplanation: "Detailed cash impact, operating cause and recovery action available in Pro.",
    direction: "negative" as const,
    impact: -24_000,
    explanation: "Recurring costs have increased 9% versus the prior period.",
  },
] as const;

const CASH_RECOVERY_ACTIONS = [
  {
    id: "cash1",
    title: "Reduce inventory days",
    expectedImpact: "£40k-£60k",
    confidence: "High",
    effort: "Medium",
    timing: "30 days",
    why: "Inventory build is the biggest cash trap and is absorbing cash before trading profit reaches the bank.",
    start: "Review slow-moving SKUs, tighten purchase orders for low-velocity stock, and set a weekly target to bring stock days back below 70.",
    link: "/scenario-lab",
    linkLabel: "Open Profit Launchpad",
  },
  {
    id: "cash2",
    title: "Stabilise supplier payment timing",
    expectedImpact: "£20k-£35k",
    confidence: "Medium",
    effort: "Medium",
    timing: "14-30 days",
    why: "Faster supplier payments reduced available cash this period, tightening runway despite positive trading.",
    start: "Separate strategic suppliers from flexible vendors, renegotiate timing where possible, and avoid accelerating payments unless it protects supply.",
    link: "/scenario-lab",
    linkLabel: "Model supplier timing",
  },
  {
    id: "cash3",
    title: "Defer discretionary spend",
    expectedImpact: "£10k-£20k",
    confidence: "Medium",
    effort: "Low",
    timing: "7-14 days",
    why: "Fixed costs and discretionary spend reduce the buffer available while working capital is under pressure.",
    start: "Pause non-essential spend, review marketing commitments with weak cash payback, and release budget only after stock and supplier timing stabilise.",
    link: "/profit-recovery-plan",
    linkLabel: "Review profit recovery",
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  (n < 0 ? "-" : "") + "£" + Math.abs(Math.round(n)).toLocaleString("en-GB");

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
  delta: string;
  positive: boolean;
  neutral?: boolean;
  deltaLabel?: string;
  insight: string;
  helperText?: string;
  comparison?: { current: string; target: string; gap: string };
}
function KpiCard({ label, value, delta, positive, neutral, deltaLabel = "vs prior period", insight, helperText, comparison }: KpiCardProps) {
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
      {comparison && (
        <div className="mt-1 pt-1.5 border-t border-border/40 grid grid-cols-3 gap-1">
          {[
            { key: "Revenue now", val: comparison.current },
            { key: "Break-even", val: comparison.target },
            { key: "Gap",         val: comparison.gap, warn: true },
          ].map(({ key, val, warn }) => (
            <div key={key} className="flex flex-col">
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider leading-none">{key}</span>
              <span className={cn("text-[11px] font-bold tabular-nums", warn ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>{val}</span>
            </div>
          ))}
        </div>
      )}
      {helperText && (
        <p className="text-[10px] text-muted-foreground/60 leading-snug italic mt-0.5 border-t border-border/40 pt-1.5">{helperText}</p>
      )}
    </div>
  );
}

function BridgeTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = BRIDGE_DATA.find(d => d.name === label);
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

// ─── Main page component ──────────────────────────────────────────────────────
export default function CashControl() {
  const {
    dateFrom: cashDateFrom,
    dateTo: cashDateTo,
    periodLabel: cashPeriodLabel,
    loading: cashPeriodLoading,
  } = useLatestDataPeriod(CASH_STORE_ID);

  const [revChange,       setRevChange]       = useState(0);
  const [inventoryChange, setInventoryChange] = useState(0);
  const [supplierChange,  setSupplierChange]  = useState(0);
  const [fixedCostChange, setFixedCostChange] = useState(0);
  const [marketingChange, setMarketingChange] = useState(0);

  const isPro      = canAccess("cash_simulator");
  const isProRec   = canAccess("cash_recommendations");
  const isProBridge = canAccess("cash_bridge_table");
  const isProDriver = canAccess("cash_driver_table");
  const isProCost  = canAccess("cash_cost_pressure");

  // ── Simulator math ──────────────────────────────────────────────────────────
  const revenueEffect   = (revChange / 100) * ANNUAL_REVENUE * 0.38 * 0.4;
  const inventoryEffect = -inventoryChange * 900;
  const supplierEffect  = supplierChange * 500;
  const fixedCostEffect = -(MONTHLY_FIXED_COSTS * fixedCostChange / 100);
  const marketingEffect = -(Math.max(0, marketingChange) * 1_800) + (marketingChange < 0 ? Math.abs(marketingChange) * 1_200 : 0);

  const projCashDelta   = revenueEffect + inventoryEffect + supplierEffect + fixedCostEffect + marketingEffect;
  const projCashBalance = CASH_BALANCE + projCashDelta;
  const projFixedCosts  = MONTHLY_FIXED_COSTS * (1 + fixedCostChange / 100);
  const projRunwayDenom = Math.max(10_000, RUNWAY_DENOM + (projFixedCosts - MONTHLY_FIXED_COSTS));
  const projRunway      = projCashBalance / projRunwayDenom;
  const projWCDrag      = Math.max(0, WORKING_CAPITAL_DRAG - inventoryEffect + Math.max(0, -supplierEffect));
  const runwayDelta     = projRunway - CASH_RUNWAY;

  const simPrimaryText =
    projRunway < 2
      ? "This scenario creates a cash risk within 60 days. Slow spend, reduce stock build or renegotiate supplier terms."
      : runwayDelta >= 0
        ? "This scenario improves cash headroom because cash is released back into the business."
        : "This scenario reduces cash runway because working capital and fixed costs absorb cash faster than trading generates it.";

  const simSecondaryText =
    projRunway > 3
      ? "At this level, the business retains reasonable cash headroom."
      : projRunway >= 2
        ? "At this level, cash runway is becoming tight and should be monitored weekly."
        : "At this level, cash runway would fall below 2 months and require immediate action.";

  const simColor =
    projRunway < 2
      ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400"
      : runwayDelta >= 0
        ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400"
        : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400";

  const SimIcon = projRunway < 2 ? AlertTriangle : runwayDelta >= 0 ? TrendingUp : TrendingDown;

  const cashRunwayModel = (
    <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden mb-8">
      <div className="px-6 py-5 border-b border-border/50">
        <h3 className="font-semibold text-lg text-foreground">Cash Runway Model</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Test how sales, stock, supplier timing and overhead changes affect your cash runway.</p>
      </div>
      <div className="px-6 py-6">
        <div className="mb-5">
          <InlineCfoInsight text="Cash is currently most sensitive to inventory days and supplier payment timing. Use this tool before increasing marketing spend, buying stock or adding overheads." />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <SimulatorSlider label="Revenue Change" value={revChange} min={-20} max={30} step={1} unit="%" showSign onChange={setRevChange} positiveIsGood={true} description={`Cash from revenue: ${fmt(CASH_BALANCE + revenueEffect)}`} />
            <SimulatorSlider label="Inventory Days Change" value={inventoryChange} min={-20} max={30} step={1} unit=" days" showSign onChange={setInventoryChange} positiveIsGood={false} description="Extra inventory days tie up more cash" />
            <SimulatorSlider label="Supplier Payment Days Change" value={supplierChange} min={-20} max={20} step={1} unit=" days" showSign onChange={setSupplierChange} positiveIsGood={true} description="Paying later preserves cash" />
            <SimulatorSlider label="Fixed Cost Change" value={fixedCostChange} min={-20} max={20} step={1} unit="%" showSign onChange={setFixedCostChange} positiveIsGood={false} description={`Projected fixed costs: ${fmt(projFixedCosts)}`} />
            <SimulatorSlider label="Marketing Spend Change" value={marketingChange} min={-30} max={30} step={1} unit="%" showSign onChange={setMarketingChange} positiveIsGood={false} description="Higher marketing spend consumes cash" />
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Projected Outcomes</h4>
            <div className="space-y-2">
              {[
                { label: "Projected Cash Balance", value: fmt(projCashBalance), highlight: true, isPeriod: false },
                { label: "Projected Runway", value: `${projRunway.toFixed(1)} months`, highlight: true, isPeriod: false },
                { label: "Projected Working Capital Drag", value: fmt(projWCDrag), highlight: false, isPeriod: false },
                { label: "Cash Movement vs Base", value: "", highlight: true, isPeriod: true },
                { label: "Cash Risk Level", value: projRunway < 2 ? "High" : projRunway < 3 ? "Moderate" : "Low", highlight: false, isPeriod: false },
              ].map(({ label, value, highlight, isPeriod }) => (
                <div key={label} className={cn("flex items-center justify-between px-4 py-2.5 rounded-xl", highlight ? "bg-secondary/60 border border-border/50" : "bg-secondary/30")}>
                  <span className={cn("text-xs", highlight ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
                  {isPeriod ? (
                    <PeriodImpact value={projCashDelta} className="items-end" />
                  ) : (
                    <span className={cn("text-sm font-bold tabular-nums", highlight ? projCashBalance < 50_000 ? "text-red-600 dark:text-red-400" : runwayDelta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400" : "text-foreground")}>{value}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50/60 dark:bg-indigo-950/15 px-4 py-3 flex items-start gap-2.5">
              <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 mb-0.5">Fastest lever to improve runway</p>
                <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">Reducing inventory days by 10 would extend runway by approximately 0.6 months.</p>
              </div>
            </div>
            <div className={cn("rounded-xl border px-4 py-3 flex items-start gap-2.5", simColor)}>
              <SimIcon className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed font-medium">
                {simPrimaryText}{" "}
                <span className="font-normal opacity-85">{simSecondaryText}</span>
              </p>
            </div>
            {(revChange !== 0 || inventoryChange !== 0 || supplierChange !== 0 || fixedCostChange !== 0 || marketingChange !== 0) && (
              <button
                onClick={() => { setRevChange(0); setInventoryChange(0); setSupplierChange(0); setFixedCostChange(0); setMarketingChange(0); }}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline mt-1"
              >
                Reset to base case
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const cashRunwayModelTeaser = (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/70 dark:bg-indigo-950/25 shadow-sm mb-8 px-6 py-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
            <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Cash runway model available on Pro</p>
            <p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 mt-1">
              Model what happens if you change stock days, supplier timing, fixed costs or marketing spend.
            </p>
          </div>
        </div>
        <div className="shrink-0 md:text-right">
          <a href="/upgrade" className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:underline mt-1 inline-block">
            Upgrade to Pro →
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <AppLayout>
      {/* ── Page header ── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Cash Control</h1>
          <p className="text-sm text-muted-foreground mt-1">
            See where cash is coming from, where it is getting trapped, and whether growth is creating or consuming cash.
          </p>
          <DataPeriodLabel
            periodLabel={cashPeriodLabel}
            loading={cashPeriodLoading}
            dateFrom={cashDateFrom}
            dateTo={cashDateTo}
          />
        </div>
        <TimelineSelector />
      </div>

      {/* ── CFO Cash Verdict ── */}
      <div className="sc-purple rounded-2xl shadow-md mb-6 overflow-hidden">
        <div className="sc-purple-header flex items-center gap-3 px-6 py-3">
          <Sparkles className="w-4 h-4 text-indigo-300 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
            CFO Cash Verdict
          </span>
          <span className="ml-auto inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 whitespace-nowrap">
            Stable but tightening
          </span>
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-5 pb-4 border-b border-primary/15">
            <div>
              <p className="text-lg sm:text-xl font-bold text-foreground leading-snug">
                Cash is positive, but working capital is absorbing cash faster than it is being replenished.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                Runway remains acceptable at {CASH_RUNWAY.toFixed(1)} months, but inventory build and supplier timing are tightening headroom.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Runway", value: `${CASH_RUNWAY.toFixed(1)} months`, tone: "default" },
                { label: "Risk", value: "Moderate", tone: "amber" },
                { label: "Cash headroom", value: fmt(CASH_HEADROOM_OPPORTUNITY.value), tone: "default" },
                { label: "Primary pressure", value: "Inventory build", tone: "amber" },
              ].map((tile) => (
                <div
                  key={tile.label}
                  className={cn(
                    "rounded-xl border px-3 py-2.5",
                    tile.tone === "amber"
                      ? "bg-amber-50/80 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50"
                      : "bg-secondary/30 border-primary/10",
                  )}
                >
                  <p className={cn(
                    "text-[10px] font-bold uppercase tracking-wider mb-1",
                    tile.tone === "amber" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
                  )}>
                    {tile.label}
                  </p>
                  <p className={cn(
                    "text-sm font-bold",
                    tile.tone === "amber" ? "text-amber-700 dark:text-amber-300" : "text-foreground",
                  )}>
                    {tile.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex flex-wrap gap-2">
            {["Stock build absorbed cash", "Supplier timing tightened", "Fixed costs rising"].map((signal) => (
              <span key={signal} className="rounded-full bg-secondary/30 border border-primary/10 px-3 py-1.5 text-xs font-semibold text-foreground">
                {signal}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Cash Headroom Opportunity ── */}
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-950/15 shadow-sm mb-8 px-6 py-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">Cash Headroom Opportunity</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Cash can be released by improving stock conversion and protecting supplier timing before additional growth spend is added.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">Estimated cash improvement</p>
              <p className="text-4xl font-display font-bold text-emerald-700 dark:text-emerald-300 leading-none">
                {fmt(CASH_HEADROOM_OPPORTUNITY.value)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{CASH_HEADROOM_OPPORTUNITY.confidence.toLowerCase()} confidence</p>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                {isPro ? "Estimated runway extension: approx. 1.1 months" : "Estimated runway extension available in Pro"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Primary source</p>
              <p className="text-sm font-semibold text-foreground">{CASH_HEADROOM_OPPORTUNITY.source}</p>
            </div>
          </div>
        </div>

        {isPro ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 pt-5 border-t border-emerald-200/70 dark:border-emerald-800/40">
            <p className="sm:col-span-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Key areas to investigate
            </p>
            {CASH_HEADROOM_OPPORTUNITY.components.map((component) => (
              <div key={component.id} className="flex items-start gap-3 rounded-xl bg-card border border-border/50 px-4 py-3.5 shadow-sm">
                <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-snug">{component.label}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{component.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 pt-5 border-t border-emerald-200/70 dark:border-emerald-800/40">
            <div className="flex items-center gap-3 rounded-xl bg-card/70 border border-border/50 px-4 py-3.5 shadow-sm">
              <Lock className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <p className="text-sm font-semibold text-foreground">Component breakdown available in Pro</p>
            </div>
          </div>
        )}
      </div>

      {/* ── What Is Trapping Cash? ── */}
      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">What Is Trapping Cash?</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          The three commercial signals most responsible for cash pressure.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {CASH_TRAP_DRIVERS.map((driver) => (
          <div key={driver.label} className="rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex items-center justify-center w-6 h-6 rounded-full bg-destructive/10 shrink-0">
                <TrendingDown className="w-3.5 h-3.5 text-destructive" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {isPro ? driver.label : driver.freeLabel}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  {isPro ? driver.explanation : driver.freeExplanation}
                </p>
                {isPro && (
                  <p className="text-xs font-semibold mt-3 text-destructive/80 dark:text-destructive/70">
                    {fmt(driver.impact)} cash impact
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Cash Recovery Plan ── */}
      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">Cash Recovery Plan</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          The next actions to release cash and protect runway.
        </p>
      </div>

      {isProRec ? (
        <div className="space-y-4 mb-8">
          {CASH_RECOVERY_ACTIONS.map((action, i) => (
            <details
              key={action.id}
              open={i === 0}
              className={cn(
                "group rounded-2xl border bg-card shadow-sm overflow-hidden",
                i === 0
                  ? "border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/50 dark:bg-emerald-950/10 shadow-md"
                  : "border-border/60",
              )}
            >
              <summary className={cn(
                "list-none cursor-pointer px-6 py-5 transition-colors",
                i === 0 ? "hover:bg-emerald-50 dark:hover:bg-emerald-950/20" : "hover:bg-secondary/20",
              )}>
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-5 items-start">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-xs font-bold",
                      i === 0
                        ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                        : "bg-secondary text-muted-foreground",
                    )}>
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-bold text-foreground">{action.title}</p>
                        {i === 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950 uppercase tracking-wider">
                            START FIRST
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 leading-snug">{action.why}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-[auto_auto_auto_auto] gap-2 lg:justify-end">
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-700/40 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-0.5">Impact</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{action.expectedImpact}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Confidence</p>
                      <p className="text-sm font-semibold text-foreground">{action.confidence}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Effort</p>
                      <p className="text-sm font-semibold text-foreground">{action.effort}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Timing</p>
                      <p className="text-sm font-semibold text-foreground">{action.timing}</p>
                    </div>
                  </div>
                </div>
              </summary>
              <div className="px-6 pb-5 -mt-1">
                <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-4 pl-11">
                  <div className="rounded-xl bg-secondary/30 border border-border/50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Why it matters</p>
                    <p className="text-sm text-foreground leading-relaxed">{action.why}</p>
                  </div>
                  <div className="rounded-xl bg-secondary/30 border border-border/50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">How to start</p>
                    <p className="text-sm text-foreground leading-relaxed">{action.start}</p>
                    <a href={action.link} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline mt-3">
                      {action.linkLabel}
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/70 dark:bg-indigo-950/25 shadow-sm mb-8 px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
                <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Your Cash Recovery Plan</p>
                <p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 mt-1">
                  A clear route exists to improve cash headroom and extend runway. Upgrade to view the prioritised action plan, timing, expected cash impact and implementation steps.
                </p>
              </div>
            </div>
            <div className="shrink-0 md:text-right">
              <a href="/upgrade" className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:underline mt-1 inline-block">
                Upgrade to Pro →
              </a>
            </div>
          </div>
        </div>
      )}

      {isPro ? cashRunwayModel : cashRunwayModelTeaser}

      <AiCfoAskCard pageId="cash" />

      {/* ── Supporting Analysis ── */}
      <details className="group bg-card rounded-2xl shadow-sm border border-border/50 mb-8 overflow-hidden">
        <summary className="list-none cursor-pointer px-6 py-5 hover:bg-secondary/20 transition-colors">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Supporting Analysis</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Detailed cash bridge, driver movements and sensitivity analysis.
              </p>
            </div>
            <span className="text-xs font-semibold text-primary group-open:hidden">Expand</span>
            <span className="text-xs font-semibold text-primary hidden group-open:inline">Collapse</span>
          </div>
        </summary>

        <div className="px-6 pb-6">
          {isPro ? (
            <div className="space-y-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Detailed KPI Movements</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <KpiCard label="Cash Balance" value="£186,000" delta="+£22,000" positive={true} insight="Cash available today" />
                  <KpiCard label="Cash Runway" value="3.4 months" delta="-0.6 months" positive={false} insight="Months of fixed costs covered by current cash" />
                  <KpiCard label="Net Cash Movement" value="+£14,000" delta="+£38,000" positive={true} insight="Cash generated after trading and working capital" />
                  <KpiCard label="Working Capital Drag" value="£74,000" delta="+£21,000" positive={false} insight="Cash currently tied up before it returns to the bank account." />
                  <KpiCard label="Inventory Days" value="82 days" delta="+11 days" positive={false} insight="Stock is turning more slowly than last period" />
                  <KpiCard label="Supplier Cover" value="42 days" delta="-8 days" positive={false} insight="Average days before suppliers are paid" />
                  <KpiCard
                    label="Cash Break-Even Revenue"
                    value="£405,000"
                    delta="+£22,000"
                    positive={false}
                    insight="Revenue required to remain cash neutral at current working capital levels."
                    comparison={{ current: "£382k", target: "£405k", gap: "-£23k" }}
                    helperText="Cash break-even is the revenue needed to stop cash falling after working capital and fixed costs."
                  />
                  <KpiCard label="Profit to Cash Conversion" value="18%" delta="-12pp" positive={false} insight="Only 18% of profit converted into cash this month." />
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 overflow-hidden">
                <div className="px-6 py-5 border-b border-border/50">
                  <h3 className="font-semibold text-lg text-foreground">Cash Movement Detail</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Cash increased by £14k this month. Here are the main reasons.</p>
                </div>
                <div className="px-6 pt-5 pb-2">
                  <InlineCfoInsight text="Trading generated cash, but this was partly offset by stock build and faster supplier payments." />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/40 bg-secondary/40">
                          <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Driver</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cash Impact</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">What happened</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {CASH_DRIVER_DATA.map((row) => (
                          <tr key={row.driver} className="hover:bg-secondary/20 transition-colors">
                            <td className="px-6 py-3 font-medium text-foreground text-sm">{row.driver}</td>
                            <td className={cn("px-4 py-3 text-right font-semibold text-sm tabular-nums", row.impact >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                              {row.impact >= 0 ? `+£${row.impact.toLocaleString()}` : `(£${Math.abs(row.impact).toLocaleString()})`}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{row.explanation}</td>
                          </tr>
                        ))}
                        <tr className="bg-emerald-50/50 dark:bg-emerald-950/15 border-t border-emerald-200 dark:border-emerald-800/40">
                          <td className="px-6 py-3 font-semibold text-foreground text-sm">Net cash movement</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">+£14,000</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">Overall cash increased this period</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="px-6 pb-6 pt-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cash Movement by Driver</h4>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={CASH_DRIVER_DATA} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }} barSize={22}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                          <XAxis type="number" tickFormatter={(v) => `£${(Math.abs(v) / 1_000).toFixed(0)}k`} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="driver" width={130} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                          <ReferenceLine x={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                          <Tooltip content={<DriverTooltip />} />
                          <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                            {CASH_DRIVER_DATA.map((entry) => (
                              <Cell key={entry.driver} fill={entry.impact >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={0.8} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 overflow-hidden">
                <div className="px-6 py-5 border-b border-border/50">
                  <h3 className="font-semibold text-lg text-foreground">Cash Bridge</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">How profit turns into cash after stock, receivables and supplier timing.</p>
                </div>
                <div className="px-6 pt-5 pb-2">
                  <InlineCfoInsight text="Profit is not fully converting into cash because working capital is absorbing part of the month's trading benefit." />
                </div>
                <div className="px-6 pt-4 pb-2">
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={BRIDGE_DATA} margin={{ top: 4, right: 24, left: 0, bottom: 0 }} barSize={36}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v) => `£${(v / 1_000).toFixed(0)}k`} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={48} />
                        <Tooltip content={<BridgeTooltip />} />
                        <Bar dataKey="invisible" stackId="a" fill="transparent" />
                        <Bar dataKey="value" stackId="a" radius={[4, 4, 0, 0]}>
                          {BRIDGE_DATA.map((entry) => (
                            <Cell key={entry.name} fill={BRIDGE_COLOR[entry.type]} fillOpacity={0.85} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="overflow-x-auto px-0 pb-4">
                  <table className="w-full text-sm mt-2">
                    <thead>
                      <tr className="border-b border-border/40 bg-secondary/40">
                        <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Step</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">What it means</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {BRIDGE_TABLE.map((row) => (
                        <tr key={row.step} className={cn("transition-colors", row.isResult ? "bg-indigo-50/50 dark:bg-indigo-950/10 border-t-2 border-indigo-200 dark:border-indigo-800/40" : "hover:bg-secondary/20")}>
                          <td className={cn("px-6 py-3 text-sm", row.isTotal || row.isResult ? "font-semibold text-foreground" : "font-medium text-foreground")}>{row.step}</td>
                          <td className={cn("px-4 py-3 text-right font-semibold text-sm tabular-nums", row.isResult ? "text-indigo-600 dark:text-indigo-400 font-bold" : row.positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                            {row.amount >= 0 ? `£${row.amount.toLocaleString()}` : `(£${Math.abs(row.amount).toLocaleString()})`}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{row.meaning}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
                <div className="rounded-2xl border border-border/50 p-5">
                  <div className="mb-4">
                    <h3 className="font-semibold text-lg text-foreground">Efficiency Metrics</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Whether cash is being released or trapped as the business grows.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: "Inventory Days", value: `${INVENTORY_DAYS} days`, icon: Package, tone: "amber" },
                      { label: "Cash Conversion Cycle", value: `${CASH_CONVERSION_CYCLE} days`, icon: RefreshCw, tone: "indigo" },
                      { label: "Working Capital Drag", value: "£74,000", icon: Clock, tone: "red" },
                      { label: "Profit to Cash Conversion", value: "18%", icon: Activity, tone: "rose" },
                    ].map((metric) => {
                      const Icon = metric.icon;
                      return (
                        <div key={metric.label} className="bg-secondary/30 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <p className="text-sm font-semibold text-foreground">{metric.label}</p>
                          </div>
                          <p className="text-2xl font-display font-bold text-foreground">{metric.value}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/50 p-5">
                  <div className="mb-4">
                    <h3 className="font-semibold text-lg text-foreground">Sensitivity Analysis</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">The levers that affect cash most.</p>
                  </div>
                  <ol className="space-y-2">
                    {RANKING_DATA.map((item, i) => (
                      <li key={item.label} className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">{i + 1}</span>
                        <span className="text-sm text-foreground flex-1">{item.label}</span>
                        <PeriodImpact value={item.impact} className="items-end shrink-0" />
                      </li>
                    ))}
                  </ol>
                  <div className="mt-5 pt-5 border-t border-border/50">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Fixed cost pressure</p>
                    <p className="text-sm text-foreground leading-relaxed">
                      Monthly fixed cash costs are £120,000 and rising 9% vs prior period, reducing resilience if revenue slows.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-secondary/20 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Benchmark logic</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Cash runway is monitored below 4 months and becomes urgent below 2 months. Working capital is reviewed through inventory days, supplier timing, cash conversion cycle and profit-to-cash conversion.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/70 dark:bg-indigo-950/25 px-5 py-4 flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
                  <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Detailed cash diagnostics are available on Pro</p>
                  <p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 mt-1">
                    Unlock the cash bridge, driver values, sensitivity ranking, fixed cost pressure and benchmark logic.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </details>

      <DataBenchmarkAssumptions
        benchmarkNote="Cash runway is 3.4 months, within monitor range but below strong cover."
        dataQualityNote="Cash insights depend on accurate stock, supplier payment and bank transaction data."
        className="mb-2"
      />

    </AppLayout>
  );
}
