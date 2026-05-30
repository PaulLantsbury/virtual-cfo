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

      {/* ── A. Cash Control Summary ── */}
      <div className="mb-8 space-y-4">
        <CfoInsightCard text="Your business is profitable, but cash is tightening because inventory and supplier payments are absorbing more cash than expected. Reduce working capital drag before increasing growth spend — each additional £100k of inventory currently delays cash recovery by around 3 weeks." />

        <div className="flex items-start gap-3 px-5 py-4 rounded-2xl border border-[#3B82F6]/30 bg-[#13233F]">
          <Shield className="w-4 h-4 text-[#7DD3FC] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-[#7DD3FC] mb-0.5">Cash Safety Buffer</p>
            <p className="text-sm text-[#A9B8D3] leading-relaxed">
              Current cash covers 3.4 months of fixed costs.
            </p>
          </div>
        </div>

        <div className="sc-orange flex items-start gap-3 px-5 py-4 rounded-2xl">
          <Wallet className="w-4 h-4 text-[#FB923C] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-[#FB923C] mb-0.5">Cash Headroom</p>
            <p className="text-sm text-orange-300/85 leading-relaxed">
              Cash could fall by £64k before runway drops below 2 months.
            </p>
          </div>
        </div>

        {/* Cash Risk Level — updated text */}
        <div className="sc-slate flex items-start gap-4 p-5 rounded-2xl">
          <div className="w-9 h-9 rounded-xl bg-slate-700/50 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-slate-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Cash Risk Level</p>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-600/60 text-slate-200">
                Moderate
              </span>
            </div>
            <p className="text-sm text-slate-300/85 leading-relaxed">
              If inventory and supplier timing remain unchanged, available headroom is likely to tighten within the next 60 days.
            </p>
          </div>
        </div>
      </div>

      <AiCfoAskCard pageId="cash" />

      {/* ── Cash Trend bar ── */}
      <div className="sc-orange flex items-center gap-3 px-5 py-3 rounded-xl mb-4">
        <TrendingUp className="w-4 h-4 text-[#FB923C] shrink-0" />
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-[#FB923C]">Cash Trend: Stable but tightening</span>
          <span className="text-xs text-orange-300/70">Stock build absorbed 59% of this month's trading cash.</span>
        </div>
      </div>

      {/* ── Free only: Locked Runway Forecast card ── */}
      {!isPro && (
        <div className="mb-4 rounded-xl border border-border/50 bg-card shadow-sm px-5 py-4 flex items-center gap-4">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-secondary shrink-0">
            <Lock className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground mb-0.5">Runway Forecast</p>
            <p className="text-sm text-foreground">Projected runway in 60 days: <span className="font-bold text-muted-foreground">__ months</span></p>
          </div>
          <a href="/upgrade" className="shrink-0 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap">
            Upgrade to see →
          </a>
        </div>
      )}

      {/* ── B. KPI Strip (8 cards, 4-column on desktop) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <KpiCard label="Cash Balance"        value="£186,000"    delta="+£22,000"    positive={true}  insight="Cash available today" />
        <KpiCard label="Cash Runway"         value="3.4 months"  delta="-0.6 months" positive={false} insight="Months of fixed costs covered by current cash" />
        <KpiCard label="Net Cash Movement"   value="+£14,000"    delta="+£38,000"    positive={true}  insight="Cash generated after trading and working capital" />
        <KpiCard label="Working Capital Drag" value="£74,000"   delta="+£21,000"    positive={false} insight="Cash currently tied up before it returns to the bank account." />
        <KpiCard label="Inventory Days"      value="82 days"     delta="+11 days"    positive={false} insight="Stock is turning more slowly than last period" />
        <KpiCard label="Supplier Cover"      value="42 days"     delta="-8 days"     positive={false} insight="Average days before suppliers are paid" />
        <KpiCard
          label="Cash Break-Even Revenue"
          value="£405,000"
          delta="+£22,000"
          positive={false}
          insight="Revenue required to remain cash neutral at current working capital levels."
          comparison={{ current: "£382k", target: "£405k", gap: "−£23k" }}
          helperText="Cash break-even is the revenue needed to stop cash falling after working capital and fixed costs."
        />
        <KpiCard label="Profit → Cash Conversion" value="18%" delta="-12pp" positive={false} insight="Only 18% of profit converted into cash this month." />
      </div>

      {/* ── Free only: Consolidated upgrade narrative ── */}
      {!isPro && (
        <div className="mb-8 rounded-2xl border border-indigo-200 dark:border-indigo-700/50 bg-gradient-to-br from-indigo-50 to-indigo-50/30 dark:from-indigo-950/40 dark:to-indigo-950/10 shadow-sm overflow-hidden">
          <div className="px-6 py-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">Unlock your CFO action plan</p>
                <p className="text-sm text-indigo-800/80 dark:text-indigo-300/80 mt-1 leading-relaxed">
                  Upgrade to Pro to move from understanding your cash position to actively improving it.
                </p>
              </div>
            </div>
            <ul className="space-y-1.5 mb-5 pl-1">
              {[
                "Model cash runway scenarios",
                "Identify your highest-impact cash lever",
                "See what moved cash this month",
                "Get priority actions for next month",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <CheckCircle className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                  <span className="text-sm text-indigo-800 dark:text-indigo-300">{item}</span>
                </li>
              ))}
            </ul>
            <a
              href="/upgrade"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md hover:opacity-90 transition-opacity"
            >
              <Sparkles className="w-4 h-4" />
              Unlock Pro
            </a>
          </div>
        </div>
      )}

      {/* ── Pro only: Cash Stability Outlook ── */}
      {isPro && (
        <div className="mb-8 rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/10 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-amber-200/60 dark:border-amber-800/30">
            <h3 className="font-semibold text-lg text-foreground">Cash Stability Outlook</h3>
          </div>
          <div className="px-6 pt-5 pb-2">
            <InlineCfoInsight text="At current working capital trends, cash runway is expected to fall below 3 months within 2 reporting periods unless inventory levels stabilise." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 pb-6 pt-4">
            <div className="bg-card rounded-2xl border border-amber-200 dark:border-amber-800/40 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-sm font-semibold text-foreground">Projected Runway</p>
              </div>
              <p className="text-3xl font-display font-bold text-amber-600 dark:text-amber-400 mb-1">2.8 months</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Expected runway within 2 reporting periods if current trends continue.
              </p>
            </div>
            <div className="bg-card rounded-2xl border border-red-200 dark:border-red-800/40 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Package className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <p className="text-sm font-semibold text-foreground">Main Risk Driver</p>
              </div>
              <p className="text-2xl font-display font-bold text-red-600 dark:text-red-400 mb-1 leading-tight">Inventory build</p>
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                Stock build is the largest pressure on cash recovery.
              </p>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/25">
                <TrendingUp className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                  £40k–£60k cash headroom opportunity
                </p>
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-amber-200 dark:border-amber-800/40 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-sm font-semibold text-foreground">Action Window</p>
              </div>
              <p className="text-3xl font-display font-bold text-amber-600 dark:text-amber-400 mb-1">60 days</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Management has around 60 days to protect cash headroom before risk increases.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── B1. What Would Improve Cash Fastest? ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50">
          <h3 className="font-semibold text-lg text-foreground">What Would Improve Cash Fastest?</h3>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-foreground leading-relaxed">
            The fastest route to stronger cash headroom is to reduce stock days, slow non-essential spend and protect supplier terms.
          </p>
          <ul className="space-y-2">
            {[
              "Reduce inventory days by 12",
              "Delay non-essential supplier payments by 6 days",
              "Pause £10k of discretionary marketing spend",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── C. What Changed Cash This Month? ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50">
          <h3 className="font-semibold text-lg text-foreground">What Changed Cash This Month?</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Cash increased by £14k this month. Here are the main reasons.</p>
        </div>
        <div className="px-6 pt-5 pb-2">
          <InlineCfoInsight text="Trading generated cash, but this was partly offset by stock build and faster supplier payments." />
        </div>

        {isProDriver ? (
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
                      <td className={cn("px-4 py-3 text-right font-semibold text-sm tabular-nums",
                        row.impact >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                      )}>
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
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cash Impact by Driver</h4>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={CASH_DRIVER_DATA} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }} barSize={22}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `£${(Math.abs(v) / 1_000).toFixed(0)}k`}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="driver" width={130}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
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
        ) : (
          <div className="px-6 pb-6">
            <div className="blur-sm opacity-40 pointer-events-none select-none" aria-hidden>
              <table className="w-full text-sm mb-4">
                <thead>
                  <tr className="border-b border-border/40 bg-secondary/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Driver</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cash Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {CASH_DRIVER_DATA.map((row) => (
                    <tr key={row.driver}>
                      <td className="px-4 py-3 text-sm text-foreground">{row.driver}</td>
                      <td className="px-4 py-3 text-right font-semibold text-sm">████████</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <a href="/upgrade" className="mt-2 flex items-center gap-4 rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/90 dark:bg-indigo-950/40 px-5 py-4 hover:border-indigo-300 transition-colors cursor-pointer">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
                <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">See exactly what moved your cash this month</p>
                <p className="text-xs text-indigo-700/70 dark:text-indigo-400/70 mt-0.5">Unlock the cash driver breakdown to understand which movements helped and which hurt.</p>
              </div>
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap shrink-0">Upgrade →</span>
            </a>
          </div>
        )}
      </div>

      {/* ── D. Where Your Cash Gets Trapped ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50">
          <h3 className="font-semibold text-lg text-foreground">Where Your Cash Gets Trapped</h3>
          <p className="text-sm text-muted-foreground mt-0.5">See how profit turns into cash after stock, receivables and supplier timing.</p>
        </div>
        <div className="px-6 pt-5 pb-2">
          <InlineCfoInsight text="Profit is not fully converting into cash because working capital is absorbing part of the month's trading benefit." />
        </div>

        {/* Bridge waterfall chart — always visible */}
        <div className="px-6 pt-4 pb-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cash Bridge: Opening to Closing</h4>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={BRIDGE_DATA} margin={{ top: 4, right: 24, left: 0, bottom: 0 }} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `£${(v / 1_000).toFixed(0)}k`}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={48} />
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

        {/* Bridge table — Pro gated */}
        {isProBridge ? (
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
                  <tr key={row.step} className={cn(
                    "transition-colors",
                    row.isResult ? "bg-indigo-50/50 dark:bg-indigo-950/10 border-t-2 border-indigo-200 dark:border-indigo-800/40" : "hover:bg-secondary/20",
                  )}>
                    <td className={cn("px-6 py-3 text-sm", row.isTotal || row.isResult ? "font-semibold text-foreground" : "font-medium text-foreground")}>{row.step}</td>
                    <td className={cn("px-4 py-3 text-right font-semibold text-sm tabular-nums",
                      row.isResult ? "text-indigo-600 dark:text-indigo-400 font-bold" :
                      row.positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                    )}>
                      {row.amount >= 0 ? `£${row.amount.toLocaleString()}` : `(£${Math.abs(row.amount).toLocaleString()})`}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{row.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 pb-6">
            <a href="/upgrade" className="flex items-center gap-4 rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/90 dark:bg-indigo-950/40 px-5 py-4 hover:border-indigo-300 transition-colors cursor-pointer">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
                <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">See exactly where £64k of cash was absorbed this month</p>
                <p className="text-xs text-indigo-700/70 dark:text-indigo-400/70 mt-0.5">Unlock the detailed cash bridge to understand which movements reduced cash and why.</p>
              </div>
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap shrink-0">Upgrade →</span>
            </a>
          </div>
        )}

        <p className="text-xs text-muted-foreground/60 italic px-6 pb-5 mt-1">
          The goal is not just to make profit — it is to convert profit into cash.
        </p>
      </div>

      {/* ── E. How Efficiently Cash Moves (2×2 grid) ── */}
      <div className="mb-8">
        <div className="mb-4">
          <h3 className="font-semibold text-lg text-foreground">How Efficiently Cash Moves Through the Business</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Shows whether cash is being released or trapped as the business grows.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Inventory Days</p>
            </div>
            <p className="text-3xl font-display font-bold text-foreground mb-1">{INVENTORY_DAYS} days</p>
            <p className="text-xs text-muted-foreground leading-relaxed">Stock is taking 82 days to convert back into cash. Lower is usually better unless stock build is planned.</p>
          </div>
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Cash Conversion Cycle</p>
            </div>
            <p className="text-3xl font-display font-bold text-foreground mb-1">{CASH_CONVERSION_CYCLE} days</p>
            <p className="text-xs text-muted-foreground leading-relaxed">On average, cash is tied up for 47 days between paying suppliers and receiving customer cash.</p>
          </div>
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Clock className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Working Capital Drag</p>
            </div>
            <p className="text-3xl font-display font-bold text-foreground mb-1">£74,000</p>
            <p className="text-xs text-muted-foreground leading-relaxed">£74k of cash is currently tied up before it returns to the bank account.</p>
          </div>
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                <Activity className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Profit to Cash Conversion</p>
            </div>
            <p className="text-3xl font-display font-bold text-foreground mb-1">18%</p>
            <p className="text-xs text-muted-foreground leading-relaxed">Only 18% of profit converted into cash this month, with the remainder absorbed by working capital movements.</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground/70 italic">Working capital improves when stock sells faster, customers pay sooner and supplier terms are managed effectively.</p>
      </div>

      {/* ── F. Cash Cost Pressure — Free: partially visible; Pro: full ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50">
          <h3 className="font-semibold text-lg text-foreground">Cash Cost Pressure</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Shows how much recurring cost your cash balance needs to support.</p>
        </div>

        {isProCost ? (
          /* Pro: full 3 cards + insight */
          <>
            <div className="px-6 pt-5 pb-2">
              <InlineCfoInsight text="Fixed cash costs are increasing faster than operating cash generation, reducing resilience if revenue slows." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 pb-6 pt-4">
              <div className="bg-secondary/30 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Monthly Fixed Cash Costs</p>
                </div>
                <p className="text-3xl font-display font-bold text-foreground mb-1">£120,000</p>
                <p className="text-xs text-muted-foreground">Payroll, software, rent and other recurring overheads.</p>
              </div>
              <div className="bg-secondary/30 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Cash Cover</p>
                </div>
                <p className="text-3xl font-display font-bold text-foreground mb-1">3.4 months</p>
                <p className="text-xs text-muted-foreground">Current cash balance divided by monthly fixed costs.</p>
              </div>
              <div className="bg-secondary/30 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Fixed Cost Trend</p>
                </div>
                <p className="text-3xl font-display font-bold text-red-600 dark:text-red-400 mb-1">Rising</p>
                <p className="text-xs text-muted-foreground">Fixed cash costs increased 9% vs prior period.</p>
              </div>
            </div>
          </>
        ) : (
          /* Free: show Fixed Cost Trend card, lock the rest */
          <div className="px-6 py-5 space-y-4">
            <div className="bg-secondary/30 rounded-xl p-5 max-w-xs">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <p className="text-sm font-semibold text-foreground">Fixed Cost Trend</p>
              </div>
              <p className="text-3xl font-display font-bold text-red-600 dark:text-red-400 mb-1">Rising</p>
              <p className="text-xs text-muted-foreground">Fixed cash costs increased 9% vs prior period.</p>
            </div>
            <a href="/upgrade" className="flex items-center gap-4 rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/90 dark:bg-indigo-950/40 px-5 py-4 hover:border-indigo-300 transition-colors cursor-pointer">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
                <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Upgrade to see how rising overheads affect your cash runway</p>
                <p className="text-xs text-indigo-700/70 dark:text-indigo-400/70 mt-0.5">Unlock the full Cost Pressure breakdown including monthly fixed costs, cash cover and trend analysis.</p>
              </div>
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap shrink-0">Upgrade →</span>
            </a>
          </div>
        )}
      </div>

      {/* ── G0. Cash Sensitivity Ranking — Pro: full values; Free: masked ── */}
      <div className="mb-6 rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ListOrdered className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">Cash Sensitivity Ranking</p>
              <p className="text-xs text-muted-foreground mt-0.5">What affects your cash most?</p>
            </div>
          </div>
          {!isPro && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider whitespace-nowrap shrink-0">
              PRO
            </span>
          )}
        </div>
        <div className="px-5 py-4">
          {isPro ? (
            <ol className="space-y-2">
              {RANKING_DATA.map((item, i) => (
                <li key={item.label} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">{i + 1}</span>
                  <span className="text-sm text-foreground flex-1">{item.label}</span>
                  <PeriodImpact value={item.impact} className="items-end shrink-0" />
                </li>
              ))}
            </ol>
          ) : (
            <>
              <ol className="space-y-2 mb-4">
                {RANKING_DATA.map((item, i) => (
                  <li key={item.label} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[11px] font-bold text-muted-foreground shrink-0">{i + 1}</span>
                    <span className="text-sm text-foreground">{item.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground/50 tabular-nums">£—,———</span>
                  </li>
                ))}
              </ol>
              <a href="/upgrade" className="flex items-center gap-3 rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/90 dark:bg-indigo-950/40 px-4 py-3 hover:border-indigo-300 transition-colors">
                <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-xs text-indigo-800 dark:text-indigo-200 flex-1">Upgrade to see the £ impact of each cash lever.</span>
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap shrink-0">Upgrade to Pro</span>
              </a>
            </>
          )}
        </div>
      </div>

      {/* ── G. Cash Sensitivity Simulator — Pro gated ── */}
      <div className={cn("rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8", isPro ? "bg-card" : "bg-card")}>
        <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg text-foreground">Cash Sensitivity Simulator</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Test how sales, stock, supplier timing and overhead changes affect your cash runway.</p>
          </div>
          {!isPro && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider whitespace-nowrap shrink-0">PRO</span>
          )}
        </div>

        {isPro ? (
          <div className="px-6 py-6">
            <div className="mb-5">
              <InlineCfoInsight text="Cash is currently most sensitive to inventory days and supplier payment timing. Use this tool before increasing marketing spend, buying stock or adding overheads." />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <SimulatorSlider label="Revenue Change"               value={revChange}       min={-20} max={30} step={1} unit="%" showSign onChange={setRevChange}       positiveIsGood={true}  description={`Cash from revenue: ${fmt(CASH_BALANCE + revenueEffect)}`} />
                <SimulatorSlider label="Inventory Days Change"        value={inventoryChange} min={-20} max={30} step={1} unit=" days" showSign onChange={setInventoryChange} positiveIsGood={false} description="Extra inventory days tie up more cash" />
                <SimulatorSlider label="Supplier Payment Days Change" value={supplierChange}  min={-20} max={20} step={1} unit=" days" showSign onChange={setSupplierChange}  positiveIsGood={true}  description="Paying later preserves cash" />
                <SimulatorSlider label="Fixed Cost Change"            value={fixedCostChange} min={-20} max={20} step={1} unit="%" showSign onChange={setFixedCostChange} positiveIsGood={false} description={`Projected fixed costs: ${fmt(projFixedCosts)}`} />
                <SimulatorSlider label="Marketing Spend Change"       value={marketingChange} min={-30} max={30} step={1} unit="%" showSign onChange={setMarketingChange} positiveIsGood={false} description="Higher marketing spend consumes cash" />
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Projected Outcomes</h4>
                <div className="space-y-2">
                  {[
                    { label: "Projected Cash Balance",         value: fmt(projCashBalance),                                               highlight: true,  isPeriod: false },
                    { label: "Projected Runway",               value: `${projRunway.toFixed(1)} months`,                                  highlight: true,  isPeriod: false },
                    { label: "Projected Working Capital Drag", value: fmt(projWCDrag),                                                    highlight: false, isPeriod: false },
                    { label: "Cash Movement vs Base",          value: "",                                                                 highlight: true,  isPeriod: true  },
                    { label: "Cash Risk Level",                value: projRunway < 2 ? "High" : projRunway < 3 ? "Moderate" : "Low",     highlight: false, isPeriod: false },
                  ].map(({ label, value, highlight, isPeriod }) => (
                    <div key={label} className={cn("flex items-center justify-between px-4 py-2.5 rounded-xl",
                      highlight ? "bg-secondary/60 border border-border/50" : "bg-secondary/30",
                    )}>
                      <span className={cn("text-xs", highlight ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
                      {isPeriod ? (
                        <PeriodImpact value={projCashDelta} className="items-end" />
                      ) : (
                        <span className={cn("text-sm font-bold tabular-nums",
                          highlight
                            ? projCashBalance < 50_000 ? "text-red-600 dark:text-red-400"
                              : runwayDelta >= 0 ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400"
                            : "text-foreground",
                        )}>{value}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Fastest lever insight */}
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50/60 dark:bg-indigo-950/15 px-4 py-3 flex items-start gap-2.5">
                  <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 mb-0.5">Fastest lever to improve runway</p>
                    <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">Reducing inventory days by 10 would extend runway by approximately 0.6 months.</p>
                  </div>
                </div>

                {/* Primary + predictive interpretation */}
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
        ) : (
          /* Free: outcome-led CTA */
          <div className="px-6 py-6">
            <div className="blur-sm opacity-30 pointer-events-none select-none mb-4" aria-hidden>
              <div className="grid grid-cols-2 gap-3">
                {["Revenue Change", "Inventory Days", "Supplier Terms", "Fixed Costs"].map((s) => (
                  <div key={s} className="h-10 bg-secondary rounded-xl" />
                ))}
              </div>
            </div>
            <a href="/upgrade" className="flex items-center gap-4 rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/90 dark:bg-indigo-950/40 px-5 py-4 hover:border-indigo-300 transition-colors cursor-pointer">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
                <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Test how reducing inventory days would extend your runway</p>
                <p className="text-xs text-indigo-700/70 dark:text-indigo-400/70 mt-0.5">Model how stock, supplier timing, marketing spend and fixed costs affect cash before you commit.</p>
              </div>
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap shrink-0">Upgrade →</span>
            </a>
          </div>
        )}
      </div>

      {/* ── H0. Teaser — Free mode only (outcome-led wording) ── */}
      {!isProRec && (
        <div className="mb-4 flex items-center gap-2.5 px-5 py-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50/60 dark:bg-indigo-950/15">
          <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <p className="text-sm text-indigo-800 dark:text-indigo-300">
            <span className="font-semibold">One priority action could extend your runway this month.</span>{" "}
            Upgrade to Pro to see the full recommendations.
          </p>
        </div>
      )}

      {/* ── H. This Month's Cash Priorities — Pro gated ── */}
      <div className={cn("rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8", "bg-card")}>
        <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg text-foreground">This Month's Cash Priorities</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Three priority actions your CFO would give you based on this month's cash data.</p>
          </div>
          {!isProRec && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider whitespace-nowrap shrink-0">PRO</span>
          )}
        </div>

        {isProRec ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/20 p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">What Improved</p>
              </div>
              <p className="text-sm text-emerald-700/85 dark:text-emerald-400/85 leading-relaxed">Customer cash receipts improved this month, adding £18k of cash and partially offsetting stock build.</p>
            </div>
            <div className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">What To Watch</p>
              </div>
              <p className="text-sm text-amber-700/85 dark:text-amber-400/85 leading-relaxed">Inventory days increased to 82 days. If this continues, more cash will be tied up before sales convert back into cash.</p>
            </div>
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-950/20 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">Recommended Action</p>
              </div>
              <p className="text-sm text-indigo-700/85 dark:text-indigo-400/85 leading-relaxed">Prioritise stock turn, delay non-essential overhead growth and review supplier payment terms before increasing marketing spend.</p>
            </div>
          </div>
        ) : (
          <div className="px-6 py-6">
            <div className="blur-sm opacity-40 pointer-events-none select-none grid grid-cols-1 md:grid-cols-3 gap-4 mb-4" aria-hidden>
              {["What Improved", "What To Watch", "Recommended Action"].map((t) => (
                <div key={t} className="rounded-2xl border border-border/40 bg-secondary/30 p-5 h-28" />
              ))}
            </div>
            <a href="/upgrade" className="flex items-center gap-4 rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/90 dark:bg-indigo-950/40 px-5 py-4 hover:border-indigo-300 transition-colors cursor-pointer">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
                <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Upgrade to unlock This Month's Cash Priorities</p>
                <p className="text-xs text-indigo-700/70 dark:text-indigo-400/70 mt-0.5">Get three high-priority cash actions — what improved, what to watch, and what to do next.</p>
              </div>
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap shrink-0">Upgrade →</span>
            </a>
          </div>
        )}
      </div>

      <DataBenchmarkAssumptions
        benchmarkNote="Cash runway is 3.4 months, within monitor range but below strong cover."
        dataQualityNote="Cash insights depend on accurate stock, supplier payment and bank transaction data."
        className="mb-2"
      />

    </AppLayout>
  );
}
