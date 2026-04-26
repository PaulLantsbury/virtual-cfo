import { useState } from "react";
import {
  Sparkles, TrendingUp, AlertTriangle, Info, SlidersHorizontal,
  Zap, Shield, CheckCircle, ArrowUpRight, Lock,
  RefreshCw, Save, BarChart2, Layers, Target, ChevronRight,
  ChevronDown, Square,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Slider } from "@/components/ui/slider";
import { AppLayout } from "@/components/layout/AppLayout";
import { PremiumBlurPreview } from "@/components/PremiumBlurPreview";
import { canAccess } from "@/lib/plan";
import { cn } from "@/lib/utils";
import { useTimeline } from "@/lib/timeline";
import { TimelineSelector } from "@/components/TimelineSelector";
import { BenchmarkStrip } from "@/components/BenchmarkStrip";
import { DataQualityNote } from "@/components/DataQualityNote";

// ─── Base financial constants ─────────────────────────────────────────────────
const BASE_REVENUE          = 420_000;
const BASE_CONTRIBUTION     = 198_000;
const BASE_EBITDA           = 78_000;
const BASE_CASH             = 186_000;
const BASE_RUNWAY           = 3.4;
const BASE_WORKING_CAPITAL  = 74_000;
const BASE_CAC_PAYBACK      = 1.6;
const BASE_CPO              = 12.40;

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScenarioState {
  revenueChange: number;
  orderVolumeChange: number;
  aovChange: number;
  discountChange: number;
  returnsChange: number;
  shippingChange: number;
  paymentFeeChange: number;
  metaSpendChange: number;
  googleSpendChange: number;
  emailMixUplift: number;
  blendedCacChange: number;
  inventoryDaysChange: number;
  supplierPaymentDaysChange: number;
  fixedCostChange: number;
  marketingSpendChange: number;
  staffCostChange: number;
  softwareChange: number;
  fulfilmentChange: number;
}

type PlanId = "balanced" | "margin" | "cash";

// ─── Plan presets ─────────────────────────────────────────────────────────────
const BALANCED_GROWTH: ScenarioState = {
  revenueChange: 5, orderVolumeChange: 3, aovChange: 2,
  discountChange: -2, returnsChange: 0, shippingChange: 0, paymentFeeChange: 0,
  metaSpendChange: -10, googleSpendChange: 0, emailMixUplift: 10, blendedCacChange: -8,
  inventoryDaysChange: -8, supplierPaymentDaysChange: 4, fixedCostChange: 0, marketingSpendChange: -5,
  staffCostChange: 0, softwareChange: 0, fulfilmentChange: 0,
};

const MARGIN_RECOVERY: ScenarioState = {
  revenueChange: 0, orderVolumeChange: 0, aovChange: 0,
  discountChange: -3, returnsChange: 0, shippingChange: -1.5, paymentFeeChange: 0,
  metaSpendChange: -15, googleSpendChange: 0, emailMixUplift: 15, blendedCacChange: 0,
  inventoryDaysChange: 0, supplierPaymentDaysChange: 0, fixedCostChange: 0, marketingSpendChange: -5,
  staffCostChange: 0, softwareChange: 0, fulfilmentChange: 0,
};

const CASH_PROTECTION: ScenarioState = {
  revenueChange: 0, orderVolumeChange: 0, aovChange: 0,
  discountChange: 0, returnsChange: 0, shippingChange: 0, paymentFeeChange: 0,
  metaSpendChange: 0, googleSpendChange: 0, emailMixUplift: 0, blendedCacChange: 0,
  inventoryDaysChange: -12, supplierPaymentDaysChange: 6, fixedCostChange: 0, marketingSpendChange: -10,
  staffCostChange: 0, softwareChange: 0, fulfilmentChange: 0,
};

const ZERO_STATE: ScenarioState = {
  revenueChange: 0, orderVolumeChange: 0, aovChange: 0,
  discountChange: 0, returnsChange: 0, shippingChange: 0, paymentFeeChange: 0,
  metaSpendChange: 0, googleSpendChange: 0, emailMixUplift: 0, blendedCacChange: 0,
  inventoryDaysChange: 0, supplierPaymentDaysChange: 0, fixedCostChange: 0, marketingSpendChange: 0,
  staffCostChange: 0, softwareChange: 0, fulfilmentChange: 0,
};

const PLAN_LABELS: Record<PlanId, string> = {
  balanced: "Balanced Growth Plan",
  margin:   "Margin Recovery Plan",
  cash:     "Cash Protection Plan",
};

const PLAN_PRESETS: Record<PlanId, ScenarioState> = {
  balanced: BALANCED_GROWTH,
  margin:   MARGIN_RECOVERY,
  cash:     CASH_PROTECTION,
};

// ─── Calculation engine ───────────────────────────────────────────────────────
function computeOutputs(s: ScenarioState) {
  const scenarioRevenue = Math.round(BASE_REVENUE * (1 + s.revenueChange / 100));

  const contribDelta = Math.round(
    (s.revenueChange / 100) * BASE_CONTRIBUTION * 0.8 +
    (s.orderVolumeChange / 100) * BASE_CONTRIBUTION * 0.25 +
    (s.aovChange / 100) * BASE_CONTRIBUTION * 0.25 +
    (-s.discountChange) * 5000 +
    (-s.returnsChange) * 1800 +
    (-s.shippingChange) * 5000 +
    (s.emailMixUplift) * 1000 +
    (-s.blendedCacChange / 100) * 40000
  );

  const scenarioContribution = Math.round(BASE_CONTRIBUTION + contribDelta);

  const fixedCostDelta = Math.round(
    (s.fixedCostChange / 100) * 120_000 +
    (s.staffCostChange / 100) * 55_000 +
    (s.softwareChange / 100) * 15_000 +
    (s.fulfilmentChange / 100) * 20_000 +
    (s.marketingSpendChange / 100) * 27_000 * 0.5
  );

  const scenarioEBITDA = Math.round(BASE_EBITDA + contribDelta - fixedCostDelta);

  const inventoryCashChange  = Math.round(-s.inventoryDaysChange * 2_500);
  const supplierCashChange   = Math.round(s.supplierPaymentDaysChange * 3_000);
  const ebitdaCashConversion = Math.round((scenarioEBITDA - BASE_EBITDA) * 0.8);
  const scenarioCash         = Math.round(BASE_CASH + inventoryCashChange + supplierCashChange + ebitdaCashConversion);

  const scenarioWorkingCapital = Math.max(0, Math.round(
    BASE_WORKING_CAPITAL + (s.inventoryDaysChange * 2_500) - (s.supplierPaymentDaysChange * 3_000)
  ));

  const cashDelta       = scenarioCash - BASE_CASH;
  const scenarioRunway  = Math.round(Math.max(0, BASE_RUNWAY + cashDelta / 80_000) * 10) / 10;

  const cpoDelta = Math.round((
    (-s.discountChange) * 0.35 +
    (-s.returnsChange)  * 0.20 +
    (-s.shippingChange) * 0.85 +
    (s.emailMixUplift)  * 0.025 +
    (-s.blendedCacChange) * 0.05
  ) * 100) / 100;
  const scenarioCPO = Math.max(0, Math.round((BASE_CPO + cpoDelta) * 100) / 100);

  const cacFactor          = 1 + s.blendedCacChange / 100;
  const cpoPctChange       = scenarioCPO / BASE_CPO;
  const scenarioCACPayback = Math.round(Math.max(0.5, BASE_CAC_PAYBACK * cacFactor / cpoPctChange) * 10) / 10;

  return {
    revenue:             scenarioRevenue,
    contribution:        scenarioContribution,
    ebitda:              scenarioEBITDA,
    cash:                scenarioCash,
    workingCapital:      scenarioWorkingCapital,
    runway:              scenarioRunway,
    cpo:                 scenarioCPO,
    cacPayback:          scenarioCACPayback,
    revenueDelta:        scenarioRevenue      - BASE_REVENUE,
    contributionDelta:   scenarioContribution - BASE_CONTRIBUTION,
    ebitdaDelta:         scenarioEBITDA       - BASE_EBITDA,
    cashDelta:           scenarioCash         - BASE_CASH,
    wcDelta:             scenarioWorkingCapital - BASE_WORKING_CAPITAL,
    runwayDelta:         Math.round((scenarioRunway  - BASE_RUNWAY)        * 10) / 10,
    cpoDelta:            Math.round((scenarioCPO     - BASE_CPO)           * 100) / 100,
    cacPaybackDelta:     Math.round((scenarioCACPayback - BASE_CAC_PAYBACK) * 10) / 10,
  };
}

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmtK(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1000) return `£${(abs / 1000).toFixed(0)}k`;
  return `£${abs.toFixed(0)}`;
}

function fmtDelta(n: number) {
  const sign  = n >= 0 ? "+" : "−";
  const abs   = Math.abs(n);
  const value = abs >= 1000 ? `${(abs / 1000).toFixed(0)}k` : `${abs}`;
  return `${sign}£${value}`;
}

function fmtDeltaRaw(n: number, decimals = 0) {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${Math.abs(n).toFixed(decimals)}`;
}

// ─── Local components ─────────────────────────────────────────────────────────
function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground mt-1 leading-snug">{subtitle}</p>}
      <div className="h-px bg-border/60 mt-3" />
    </div>
  );
}

function SliderRow({
  label, value, min, max, step = 1, unit = "%", prefix = "", onChange,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; prefix?: string;
  onChange: (v: number) => void;
}) {
  const display = value === 0 ? "0" : value > 0
    ? `+${prefix}${value}${unit}`
    : `−${prefix}${Math.abs(value)}${unit}`;
  return (
    <div className="flex items-center gap-4 py-3 border-b border-border/40 last:border-0">
      <p className="text-sm font-medium text-foreground flex-1 min-w-0">{label}</p>
      <div className="flex items-center gap-3 shrink-0 w-60 sm:w-72">
        <Slider
          value={[value]} min={min} max={max} step={step}
          onValueChange={([v]) => onChange(v)}
          className="flex-1"
        />
        <span className={cn(
          "text-sm font-semibold tabular-nums min-w-[64px] text-right",
          value > 0 ? "text-emerald-600 dark:text-emerald-400"
            : value < 0 ? "text-amber-600 dark:text-amber-400"
            : "text-muted-foreground"
        )}>
          {display}
        </span>
      </div>
    </div>
  );
}

function OutputCard({
  label, base, scenario, delta, positive, note,
}: {
  label: string; base: string; scenario: string;
  delta: string; positive: boolean; note?: string;
}) {
  return (
    <div className="bg-secondary/40 rounded-xl p-4 flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground mb-0.5">Base</p>
          <p className="text-sm font-semibold text-foreground">{base}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground mb-0.5">Scenario</p>
          <p className="text-sm font-bold text-foreground">{scenario}</p>
        </div>
      </div>
      <div className={cn(
        "flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold",
        positive
          ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
          : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400"
      )}>
        {positive ? <ArrowUpRight className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
        {delta}
      </div>
      {note && <p className="text-[10px] text-muted-foreground/60 text-center leading-snug">{note}</p>}
    </div>
  );
}

// ─── Bridge chart data ────────────────────────────────────────────────────────
const BRIDGE_DATA = [
  { name: "Base\ncontrib", invis: 0,       value: 198_000, type: "base"     },
  { name: "Pricing",       invis: 198_000, value: 18_000,  type: "positive" },
  { name: "Marketing",     invis: 216_000, value: 9_500,   type: "positive" },
  { name: "Shipping",      invis: 225_500, value: 6_800,   type: "positive" },
  { name: "Returns",       invis: 232_300, value: 2_700,   type: "positive" },
  { name: "Overheads",     invis: 235_000, value: 5_000,   type: "positive" },
  { name: "Scenario\ncontrib", invis: 0,  value: 240_000, type: "result"   },
];

const BRIDGE_COLORS: Record<string, string> = {
  base:     "#6366f1",
  positive: "#22c55e",
  negative: "#ef4444",
  result:   "#6366f1",
};

// ─── Implementation actions ───────────────────────────────────────────────────
const IMPL_ACTIONS = [
  { action: "Reduce discounting by 3pp",    impact: "+£38k contribution",  conf: "High",   effort: "Low",    timing: "Immediate"  },
  { action: "Reallocate Meta spend",        impact: "+£9.5k contribution",  conf: "Medium", effort: "Low",    timing: "1–2 weeks"  },
  { action: "Reduce inventory days",        impact: "+£46k cash",           conf: "Medium", effort: "Medium", timing: "4–8 weeks"  },
  { action: "Renegotiate shipping",         impact: "+£6.8k contribution",  conf: "High",   effort: "Medium", timing: "2–4 weeks"  },
  { action: "Hold fixed costs flat",        impact: "+£12k cash protection", conf: "High",  effort: "Low",    timing: "Immediate"  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ScenarioLab() {
  const { label: timelineLabel, compare: timelineCompare } = useTimeline();

  const isPro       = canAccess("scenario_lab_builder");
  const isProPlans  = canAccess("scenario_lab_plans");
  const isProBridge = canAccess("scenario_lab_bridge");
  const isProImpl   = canAccess("scenario_lab_implementation");

  const [scenario,    setScenario]    = useState<ScenarioState>(BALANCED_GROWTH);
  const [activeTab,   setActiveTab]   = useState<"growth"|"margin"|"marketing"|"cash"|"overheads">("growth");
  const [activePlan,  setActivePlan]  = useState<PlanId>("balanced");
  const [importedOpen, setImportedOpen] = useState(false);
  const [checkedActions, setCheckedActions] = useState<Set<number>>(new Set());

  const out = computeOutputs(scenario);

  function set(key: keyof ScenarioState) {
    return (v: number) => setScenario(prev => ({ ...prev, [key]: v }));
  }

  function applyPlan(plan: PlanId) {
    setActivePlan(plan);
    setScenario(PLAN_PRESETS[plan]);
  }

  function toggleAction(i: number) {
    setCheckedActions(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  const TABS = [
    { id: "growth",     label: "Growth"    },
    { id: "margin",     label: "Margin"    },
    { id: "marketing",  label: "Marketing" },
    { id: "cash",       label: "Cash"      },
    { id: "overheads",  label: "Overheads" },
  ] as const;

  return (
    <AppLayout
      headerRight={
        <div className="flex items-center gap-3">
          <TimelineSelector />
        </div>
      }
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">

        {/* ══ 1. PAGE HEADER ══════════════════════════════════════════════════ */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">
              Scenario Lab
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed max-w-xl">
              Build a joined-up forecast across profit, cash, pricing and marketing before making decisions.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0 text-right">
            <span className="text-sm font-semibold text-foreground">{timelineLabel}</span>
            <span className="text-xs text-muted-foreground">Compare to: {timelineCompare}</span>
          </div>
        </div>

        <BenchmarkStrip
          message="Scenario quality is assessed against margin, cash runway and CAC payback benchmarks."
          status="in"
        />

        <DataQualityNote note="Scenario outputs are directional estimates based on connected sales, marketing, cost and cash data." />

        {/* ══ 2. CFO INSIGHT CARD ═════════════════════════════════════════════ */}
        <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">CFO Insight</p>
              <p className="text-sm text-foreground leading-relaxed">
                Your current performance suggests the best near-term opportunity is a balanced recovery plan: reduce discounting,
                improve marketing efficiency and protect cash by controlling stock and overhead growth.
              </p>
            </div>
          </div>
        </div>

        {/* ── Board-level summary strip ────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/30">
          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            This scenario increases contribution by approximately 21% without requiring additional customer acquisition.
          </p>
        </div>

        {/* ── Free upgrade card ────────────────────────────────────────────── */}
        {!isPro && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-6 py-5 rounded-2xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/80 dark:bg-indigo-950/30">
            <div className="flex-1">
              <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200 mb-1">Unlock your CFO scenario plan</p>
              <p className="text-xs text-indigo-700/80 dark:text-indigo-400/80 leading-snug mb-3">
                Upgrade to Pro to build joined-up profit, cash, pricing and marketing scenarios.
              </p>
              <ul className="space-y-1">
                {[
                  "Apply CFO-suggested plans",
                  "Model combined profit and cash impact",
                  "Compare scenarios side by side",
                  "Build an implementation plan",
                ].map(b => (
                  <li key={b} className="flex items-center gap-2 text-xs text-indigo-800 dark:text-indigo-300">
                    <CheckCircle className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <a
              href="/upgrade"
              className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors shadow-md shadow-indigo-500/20"
            >
              Unlock Pro
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* ══ 3. RECOMMENDED SCENARIO SUMMARY ═════════════════════════════════ */}
        <SectionHeading
          title="Recommended Scenario: Balanced Growth Plan"
          subtitle="This plan offers the best balance of profit uplift, cash protection and implementation risk."
        />

        <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6">
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/40">
              <Sparkles className="w-3 h-3" /> Recommended
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-secondary text-muted-foreground border border-border/60">
              Risk: Lower
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-secondary text-muted-foreground border border-border/60">
              Confidence: Medium–High
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: "Profit impact",    value: "+£42,000/mo", color: "emerald" },
              { label: "Cash impact",      value: "+£64,000",    color: "emerald" },
              { label: "Runway impact",    value: "+0.8 months", color: "emerald" },
              { label: "Margin impact",    value: "+4.2pp",      color: "emerald" },
              { label: "Scenario quality", value: "Strong",      color: "indigo"  },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex flex-col items-center text-center bg-secondary/40 rounded-xl p-4 gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className={cn(
                  "text-lg font-bold",
                  color === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-primary"
                )}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ══ 4. AI CFO RECOMMENDATION (moved up) ══════════════════════════════ */}
        <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">AI CFO Recommendation</p>
              <p className="text-sm text-foreground leading-relaxed">
                Start with the Balanced Growth Plan. It delivers meaningful contribution uplift while protecting cash runway and
                avoiding over-reliance on new paid acquisition. Prioritise discount discipline, Meta budget reallocation and
                inventory control before increasing growth spend.
              </p>
            </div>
          </div>
          {isPro ? (
            <ul className="space-y-2">
              {[
                "Apply the Balanced Growth Plan this month",
                "Review Meta and Google performance weekly",
                "Reassess inventory and cash runway after 30 days",
              ].map(bullet => (
                <li key={bullet} className="flex items-start gap-3 px-4 py-2.5 rounded-xl bg-secondary/50">
                  <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-sm font-medium text-foreground">{bullet}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2">
              {[
                "Apply the Balanced Growth Plan this month",
                "Review Meta and Google performance weekly",
                "Reassess inventory and cash runway after 30 days",
              ].map(bullet => (
                <div key={bullet} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-secondary/40 blur-[3px] select-none pointer-events-none" aria-hidden="true">
                  <CheckCircle className="w-4 h-4 text-emerald-500/40 shrink-0" />
                  <span className="text-sm font-medium text-foreground/50">{bullet}</span>
                </div>
              ))}
              <a href="/upgrade" className="flex items-center justify-center gap-2 mt-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                <Lock className="w-3 h-3" /> Unlock action plan with Pro
              </a>
            </div>
          )}
        </div>

        {/* ══ 5. SCENARIO IMPACT ══════════════════════════════════════════════ */}
        <SectionHeading title="Scenario Impact" />

        {/* Row 1 — always visible */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <OutputCard label="Revenue"      base={fmtK(BASE_REVENUE)}      scenario={fmtK(out.revenue)}      delta={fmtDelta(out.revenueDelta)}      positive={out.revenueDelta >= 0}      />
          <OutputCard label="Contribution" base={fmtK(BASE_CONTRIBUTION)}  scenario={fmtK(out.contribution)}  delta={fmtDelta(out.contributionDelta)}  positive={out.contributionDelta >= 0} />
          <OutputCard label="EBITDA"       base={fmtK(BASE_EBITDA)}        scenario={fmtK(out.ebitda)}        delta={fmtDelta(out.ebitdaDelta)}        positive={out.ebitdaDelta >= 0}       />
          <OutputCard label="Cash Balance" base={fmtK(BASE_CASH)}          scenario={fmtK(out.cash)}          delta={fmtDelta(out.cashDelta)}          positive={out.cashDelta >= 0}         />
        </div>

        {/* Row 2 — Pro */}
        <PremiumBlurPreview
          title="Detailed outputs"
          isPro={isPro}
          ctaTitle="Unlock detailed scenario outputs"
          ctaDescription="See how the scenario affects cash runway, working capital drag and unit economics."
          ghostContent={
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {["Cash Runway", "Working Capital Drag", "CAC Payback", "Contribution / Order"].map(l => (
                <div key={l} className="bg-secondary/40 rounded-xl p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{l}</p>
                  <div className="flex justify-between mb-2"><span className="text-sm text-foreground">— —</span></div>
                  <div className="h-6 rounded-lg bg-border/40" />
                </div>
              ))}
            </div>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <OutputCard
              label="Cash Runway"
              base={`${BASE_RUNWAY} mo`}
              scenario={`${out.runway} mo`}
              delta={`${fmtDeltaRaw(out.runwayDelta, 1)} months`}
              positive={out.runwayDelta >= 0}
            />
            <OutputCard
              label="Working Capital Drag"
              base={fmtK(BASE_WORKING_CAPITAL)}
              scenario={fmtK(out.workingCapital)}
              delta={fmtDelta(out.wcDelta)}
              positive={out.wcDelta <= 0}
            />
            <OutputCard
              label="CAC Payback"
              base={`${BASE_CAC_PAYBACK} orders`}
              scenario={`${out.cacPayback} orders`}
              delta={out.cacPaybackDelta <= 0 ? "Improved" : "Worsened"}
              positive={out.cacPaybackDelta <= 0}
            />
            <OutputCard
              label="Contribution / Order"
              base={`£${BASE_CPO.toFixed(2)}`}
              scenario={`£${out.cpo.toFixed(2)}`}
              delta={`${fmtDeltaRaw(out.cpoDelta, 2)} per order`}
              positive={out.cpoDelta >= 0}
            />
          </div>
        </PremiumBlurPreview>

        {/* ══ 6. SCENARIO QUALITY SCORE (moved earlier) ════════════════════════ */}
        <PremiumBlurPreview
          title="Scenario Quality Score"
          isPro={isProBridge}
          ctaTitle="Unlock scenario quality scoring"
          ctaDescription="See a structured quality assessment across profit, cash, risk and payback."
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-5">
            <div className="flex items-center justify-center w-24 h-24 rounded-full border-4 border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 shrink-0">
              <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">Strong</p>
            </div>
            <div className="flex-1 space-y-2">
              {[
                { factor: "Profit uplift",       score: "Strong",      color: "emerald" },
                { factor: "Cash impact",          score: "Strong",      color: "emerald" },
                { factor: "Implementation risk",  score: "Moderate",    color: "amber"   },
                { factor: "Confidence level",     score: "Medium–High", color: "blue"    },
                { factor: "Payback period",       score: "Fast",        color: "emerald" },
              ].map(({ factor, score, color }) => (
                <div key={factor} className="flex items-center justify-between gap-4">
                  <p className="text-xs text-muted-foreground">{factor}</p>
                  <span className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded-full",
                    color === "emerald" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                    : color === "amber"  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                    : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400"
                  )}>
                    {score}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/50">
            <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-snug">
              Confidence reflects stability of CAC trends, discount behaviour and shipping cost variance over the last 90 days.
            </p>
          </div>
        </PremiumBlurPreview>

        {/* ══ 7. WHY THIS PLAN? ═══════════════════════════════════════════════ */}
        <SectionHeading title="Why this plan?" />

        <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              This plan is recommended because Meta CAC is reducing contribution by £3.40 per order, discounting has increased by 1.8pp,
              and inventory build is tightening cash runway within 60 days. It improves contribution without requiring additional stock investment.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                icon: AlertTriangle, color: "amber",
                title: "Margin pressure",
                text:  "Contribution margin is 42.3%, below the healthy 45–60% benchmark range.",
              },
              {
                icon: Target, color: "orange",
                title: "Marketing inefficiency",
                text:  "Meta is generating materially lower contribution per order than Email and Organic.",
              },
              {
                icon: Zap, color: "red",
                title: "Cash tightening",
                text:  "Inventory build and supplier timing are reducing cash headroom over the next 60 days.",
              },
            ].map(({ icon: Icon, color, title, text }) => (
              <div key={title} className={cn(
                "rounded-xl border p-4",
                color === "amber"  ? "bg-amber-50/60 dark:bg-amber-950/15 border-amber-200/60 dark:border-amber-700/30"
                : color === "orange" ? "bg-orange-50/60 dark:bg-orange-950/15 border-orange-200/60 dark:border-orange-700/30"
                : "bg-rose-50/60 dark:bg-rose-950/15 border-rose-200/60 dark:border-rose-700/30"
              )}>
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center mb-2",
                  color === "amber"  ? "bg-amber-100 dark:bg-amber-900/40"
                  : color === "orange" ? "bg-orange-100 dark:bg-orange-900/40"
                  : "bg-rose-100 dark:bg-rose-900/40"
                )}>
                  <Icon className={cn(
                    "w-4 h-4",
                    color === "amber"  ? "text-amber-600 dark:text-amber-400"
                    : color === "orange" ? "text-orange-600 dark:text-orange-400"
                    : "text-rose-600 dark:text-rose-400"
                  )} />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
                <p className="text-xs text-muted-foreground leading-snug">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ══ 8. CHOOSE OR ADJUST YOUR PLAN ═══════════════════════════════════ */}
        <SectionHeading
          title="Choose or adjust your plan"
          subtitle="Start with the recommended plan, or switch to a more profit-focused or cash-focused scenario."
        />

        <PremiumBlurPreview
          title="Plan selector"
          isPro={isProPlans}
          ctaTitle="Unlock CFO-suggested plans"
          ctaDescription="Upgrade to Pro to apply pre-built plans and see their combined financial impact."
          ghostContent={
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { name: "Margin Recovery Plan",  badge: "Profit Focus", color: "bg-blue-50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-700/40",     badgeColor: "text-blue-600 dark:text-blue-400 bg-blue-100/80 dark:bg-blue-900/40" },
                { name: "Cash Protection Plan",  badge: "Cash Focus",   color: "bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/40",  badgeColor: "text-slate-600 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/40" },
                { name: "Balanced Growth Plan",  badge: "Recommended",  color: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-700/40", badgeColor: "text-emerald-600 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-900/40" },
              ].map(p => (
                <div key={p.name} className={cn("rounded-xl border p-4", p.color)}>
                  <span className={cn("inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-2", p.badgeColor)}>{p.badge}</span>
                  <p className="text-sm font-semibold text-foreground mb-2">{p.name}</p>
                  <p className="text-xs text-muted-foreground">Expected impact: — —</p>
                </div>
              ))}
            </div>
          }
        >
          <div className="grid sm:grid-cols-3 gap-4">
            {/* Margin Recovery Plan */}
            <div className={cn(
              "rounded-2xl border-2 p-5 flex flex-col gap-3 transition-all",
              activePlan === "margin"
                ? "border-blue-400 dark:border-blue-600 bg-blue-50/60 dark:bg-blue-950/20"
                : "border-border/50 bg-secondary/20 hover:border-border"
            )}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                  Profit Focus
                </span>
                {activePlan === "margin" && <CheckCircle className="w-4 h-4 text-blue-500 dark:text-blue-400" />}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Margin Recovery Plan</p>
                <p className="text-xs text-muted-foreground mt-0.5">Best for: Immediate contribution improvement</p>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1">+£42k contribution / month</p>
              </div>
              <ul className="space-y-1.5">
                {["Reduce average discount by 3pp","Reallocate 15% of Meta spend to Email and Organic","Reduce shipping cost per order by £1.50","Pause low-margin acquisition campaigns"].map(a => (
                  <li key={a} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500 shrink-0" />{a}
                  </li>
                ))}
              </ul>
              <button onClick={() => applyPlan("margin")} className="w-full mt-auto text-xs font-semibold px-4 py-2 rounded-xl border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                Apply this plan
              </button>
            </div>

            {/* Cash Protection Plan */}
            <div className={cn(
              "rounded-2xl border-2 p-5 flex flex-col gap-3 transition-all",
              activePlan === "cash"
                ? "border-slate-400 dark:border-slate-500 bg-slate-50/60 dark:bg-slate-800/30"
                : "border-border/50 bg-secondary/20 hover:border-border"
            )}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Cash Focus
                </span>
                {activePlan === "cash" && <CheckCircle className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Cash Protection Plan</p>
                <p className="text-xs text-muted-foreground mt-0.5">Best for: Protecting runway and reducing cash pressure</p>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">+£64k cash headroom</p>
              </div>
              <ul className="space-y-1.5">
                {["Reduce inventory days by 12","Delay non-essential supplier payments by 6 days","Hold fixed costs flat","Pause discretionary marketing spend"].map(a => (
                  <li key={a} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />{a}
                  </li>
                ))}
              </ul>
              <button onClick={() => applyPlan("cash")} className="w-full mt-auto text-xs font-semibold px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors">
                Apply this plan
              </button>
            </div>

            {/* Balanced Growth Plan — highlighted */}
            <div className={cn(
              "rounded-2xl border-2 p-5 flex flex-col gap-3 transition-all ring-1 ring-emerald-300/40 dark:ring-emerald-700/30",
              activePlan === "balanced"
                ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/20"
                : "border-emerald-200 dark:border-emerald-700/50 bg-emerald-50/30 dark:bg-emerald-950/10 hover:border-emerald-300"
            )}>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400">
                  <Sparkles className="w-3 h-3" /> Recommended
                </span>
                {activePlan === "balanced" && <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Balanced Growth Plan</p>
                <p className="text-xs text-muted-foreground mt-0.5">Best for: Improving profit without choking growth</p>
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">+£28k contribution / +0.5 months runway</p>
              </div>
              <ul className="space-y-1.5">
                {["Reduce blanket discounts by 2pp","Shift 10% of Meta spend to Email","Improve full-price order mix","Keep Google Shopping spend stable"].map(a => (
                  <li key={a} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />{a}
                  </li>
                ))}
              </ul>
              <button onClick={() => applyPlan("balanced")} className="w-full mt-auto text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm shadow-emerald-500/20">
                Apply this plan
              </button>
            </div>
          </div>
        </PremiumBlurPreview>

        {/* ══ 9. SCENARIO BUILDER ═════════════════════════════════════════════ */}
        <SectionHeading
          title="Scenario Builder"
          subtitle="Adjust the assumptions to see the combined impact across profit, cash, pricing and marketing."
        />

        {/* Active scenario banner */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 rounded-2xl bg-secondary/60 border border-border/50">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Active scenario</p>
            <p className="text-sm font-bold text-foreground">{PLAN_LABELS[activePlan]}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
              These assumptions are loaded from the recommended plan and can be adjusted below.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={() => applyPlan(activePlan)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Reapply plan
            </button>
            <button
              onClick={() => setScenario(ZERO_STATE)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Reset
            </button>
            <button className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
              <Save className="w-3 h-3" /> Save as new scenario
            </button>
          </div>
        </div>

        <PremiumBlurPreview
          title="Full Scenario Builder"
          subtitle="18 levers across Growth, Margin, Marketing, Cash and Overheads."
          isPro={isPro}
          ctaTitle="Unlock the full Scenario Builder"
          ctaDescription="Model any combination of levers and see the combined financial impact in real time."
          ghostContent={
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {["Growth","Margin","Marketing","Cash","Overheads"].map(t => (
                  <span key={t} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground border border-border/60">{t}</span>
                ))}
              </div>
              {["Revenue Change","Discount Rate Change","Meta Spend Change","Inventory Days Change"].map(l => (
                <div key={l} className="flex items-center gap-4 py-2.5 border-b border-border/40 last:border-0">
                  <p className="text-sm font-medium text-foreground flex-1">{l}</p>
                  <div className="w-48 h-1.5 rounded-full bg-border/60" />
                  <span className="text-sm font-semibold text-muted-foreground/40 tabular-nums w-16 text-right">—</span>
                </div>
              ))}
            </div>
          }
        >
          {/* Tab bar */}
          <div className="flex gap-1 flex-wrap mb-6 p-1 bg-secondary/60 rounded-xl">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "flex-1 min-w-fit px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                  activeTab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === "growth" && (
            <div>
              <SliderRow label="Revenue Change"              value={scenario.revenueChange}       min={-20} max={30}  onChange={set("revenueChange")} />
              <SliderRow label="Order Volume Change"         value={scenario.orderVolumeChange}   min={-20} max={30}  onChange={set("orderVolumeChange")} />
              <SliderRow label="Average Order Value Change"  value={scenario.aovChange}           min={-10} max={15}  onChange={set("aovChange")} />
            </div>
          )}
          {activeTab === "margin" && (
            <div>
              <SliderRow label="Discount Rate Change"          value={scenario.discountChange}    min={-8}  max={8}   unit="pp"  onChange={set("discountChange")} />
              <SliderRow label="Returns Rate Change"           value={scenario.returnsChange}     min={-5}  max={5}   unit="pp"  onChange={set("returnsChange")} />
              <SliderRow label="Shipping Cost per Order Change" value={scenario.shippingChange}   min={-3}  max={3}   step={0.5} unit="" prefix="£" onChange={set("shippingChange")} />
              <SliderRow label="Payment Fee Rate Change"       value={scenario.paymentFeeChange}  min={-2}  max={2}   unit="pp"  onChange={set("paymentFeeChange")} />
            </div>
          )}
          {activeTab === "marketing" && (
            <div>
              <SliderRow label="Meta Spend Change"           value={scenario.metaSpendChange}    min={-30} max={30}  onChange={set("metaSpendChange")} />
              <SliderRow label="Google Spend Change"         value={scenario.googleSpendChange}  min={-30} max={30}  onChange={set("googleSpendChange")} />
              <SliderRow label="Email / Organic Mix Uplift"  value={scenario.emailMixUplift}     min={0}   max={30}  onChange={set("emailMixUplift")} />
              <SliderRow label="Blended CAC Change"          value={scenario.blendedCacChange}   min={-25} max={25}  onChange={set("blendedCacChange")} />
            </div>
          )}
          {activeTab === "cash" && (
            <div>
              <SliderRow label="Inventory Days Change"          value={scenario.inventoryDaysChange}       min={-20} max={30}  unit=" days" onChange={set("inventoryDaysChange")} />
              <SliderRow label="Supplier Payment Days Change"   value={scenario.supplierPaymentDaysChange} min={-20} max={20}  unit=" days" onChange={set("supplierPaymentDaysChange")} />
              <SliderRow label="Fixed Cost Change"              value={scenario.fixedCostChange}           min={-20} max={20}  onChange={set("fixedCostChange")} />
              <SliderRow label="Marketing Spend Change"         value={scenario.marketingSpendChange}      min={-30} max={30}  onChange={set("marketingSpendChange")} />
            </div>
          )}
          {activeTab === "overheads" && (
            <div>
              <SliderRow label="Staff Cost Change"            value={scenario.staffCostChange}  min={-15} max={20}  onChange={set("staffCostChange")} />
              <SliderRow label="Software / Overhead Change"   value={scenario.softwareChange}   min={-20} max={20}  onChange={set("softwareChange")} />
              <SliderRow label="Fulfilment Cost Change"       value={scenario.fulfilmentChange} min={-20} max={20}  onChange={set("fulfilmentChange")} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-6 pt-5 border-t border-border/40">
            <button onClick={() => { setScenario(BALANCED_GROWTH); setActivePlan("balanced"); }} className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Reset scenario
            </button>
            <button className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
              <Save className="w-3.5 h-3.5" /> Save scenario
            </button>
            <button className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
              <Layers className="w-3.5 h-3.5" /> Compare scenario
            </button>
          </div>
        </PremiumBlurPreview>

        {/* ══ 10. IMPORTED ASSUMPTIONS (collapsible) ═══════════════════════════ */}
        <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden">
          <button
            onClick={() => setImportedOpen(o => !o)}
            className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-secondary/30 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Imported assumptions from other scenario tools</p>
              {!importedOpen && (
                <p className="text-xs text-muted-foreground mt-0.5">Show assumptions pulled from page-level what-if sliders.</p>
              )}
            </div>
            <ChevronDown className={cn(
              "w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-200",
              importedOpen && "rotate-180"
            )} />
          </button>

          {importedOpen && (
            <div className="px-6 pb-5 border-t border-border/40 pt-4">
              {!isPro && (
                <p className="text-xs text-muted-foreground/70 mb-3 flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> Upgrade to Pro to apply imported assumptions.
                </p>
              )}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  "Pricing Optimisation: discount reduced by 3pp",
                  "Marketing Efficiency: 15% Meta spend reallocated",
                  "Cash Control: inventory days reduced by 12",
                  "Profit Margin: shipping cost reduced by £1.50/order",
                  "Profit Engine: fixed costs held flat",
                ].map(chip => (
                  <span key={chip} className={cn(
                    "inline-flex items-center text-xs px-3 py-1.5 rounded-full border font-medium",
                    isPro
                      ? "bg-secondary text-foreground border-border/60"
                      : "bg-secondary/50 text-muted-foreground/60 border-border/30 blur-[2px] select-none"
                  )}>
                    {chip}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <button disabled={!isPro} className={cn(
                  "text-xs font-semibold px-4 py-2 rounded-xl transition-colors border",
                  isPro ? "border-primary/30 text-primary bg-primary/5 hover:bg-primary/10" : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                )}>
                  Apply current page assumptions
                </button>
                <button disabled={!isPro} className={cn(
                  "text-xs font-semibold px-4 py-2 rounded-xl transition-colors border",
                  isPro ? "border-border text-muted-foreground hover:text-foreground" : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                )}>
                  Clear imported assumptions
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ══ 11. SCENARIO CONTRIBUTION BRIDGE ════════════════════════════════ */}
        <PremiumBlurPreview
          title="Scenario Contribution Bridge"
          subtitle="Shows how the plan moves contribution from today's position to the scenario result."
          isPro={isProBridge}
          ctaTitle="Unlock the contribution bridge"
          ctaDescription="See exactly which levers drive the contribution improvement — and by how much."
          ghostContent={
            <div className="space-y-3">
              {["Base contribution","Pricing improvement","Marketing reallocation","Shipping reduction","Scenario contribution"].map((l, i) => (
                <div key={l} className="flex items-center gap-3 py-1.5 border-b border-border/30 last:border-0">
                  <p className="text-sm text-foreground flex-1">{l}</p>
                  <div className={cn("h-2 rounded-full bg-border/50", i === 0 || i === 4 ? "w-24" : "w-14")} />
                  <span className="text-sm font-semibold text-muted-foreground/40 w-20 text-right">£ —,———</span>
                </div>
              ))}
            </div>
          }
        >
          <div className="h-56 w-full mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={BRIDGE_DATA} barCategoryGap="30%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `£${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => [`£${(v/1000).toFixed(0)}k`, ""]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }} />
                <Bar dataKey="invis" stackId="a" fill="transparent" />
                <Bar dataKey="value" stackId="a" radius={[4,4,0,0]}>
                  {BRIDGE_DATA.map(entry => <Cell key={entry.name} fill={BRIDGE_COLORS[entry.type]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 mb-5">
            {[
              { label: "Base contribution",        value: 198_000, type: "base"    },
              { label: "Pricing improvement",      value:  18_000, type: "gain"    },
              { label: "Marketing reallocation",   value:   9_500, type: "gain"    },
              { label: "Shipping cost reduction",  value:   6_800, type: "gain"    },
              { label: "Returns reduction",        value:   2_700, type: "gain"    },
              { label: "Fixed cost / overhead",    value:   5_000, type: "gain"    },
              { label: "Scenario contribution",    value: 240_000, type: "result"  },
            ].map(({ label, value, type }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                <span className="text-sm text-foreground">{label}</span>
                <span className={cn(
                  "text-sm font-semibold tabular-nums",
                  type === "result" ? "text-primary font-bold"
                  : type === "gain"  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground"
                )}>
                  {type === "gain" ? `+£${(value/1000).toFixed(1)}k` : `£${(value/1000).toFixed(0)}k`}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/50">
            <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-snug">
              Most of the contribution uplift comes from reducing discounting and reallocating inefficient paid spend rather than relying on new customer growth.
            </p>
          </div>
        </PremiumBlurPreview>

        {/* ══ 12. CASH AND PROFIT CONSEQUENCE (simplified) ════════════════════ */}
        <PremiumBlurPreview
          title="Cash and Profit Consequence"
          subtitle="Shows whether the scenario improves both profitability and cash resilience."
          isPro={isProBridge}
          ctaTitle="Unlock cash and profit consequence"
          ctaDescription="Understand how the scenario affects both P&L and cash simultaneously."
        >
          <div className="flex items-start gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              Cash improves because inventory reduction releases working capital as well as improving operating performance.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: TrendingUp,   color: "emerald", label: "Profit uplift",    value: "+£42,000/month", text: "Contribution improves through better margin and marketing efficiency." },
              { icon: Shield,       color: "blue",    label: "Cash uplift",      value: "+£64,000",       text: "Cash improves because working capital drag reduces." },
              { icon: Zap,          color: "indigo",  label: "Runway extension", value: "+0.8 months",    text: "Cash cover improves from 3.4 to 4.2 months." },
              { icon: CheckCircle,  color: "green",   label: "Risk movement",    value: "Lower",          text: "Scenario reduces both margin risk and cash risk." },
            ].map(({ icon: Icon, color, label, value, text }) => (
              <div key={label} className="bg-secondary/40 rounded-xl p-4 space-y-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  color === "emerald" ? "bg-emerald-100 dark:bg-emerald-900/40"
                  : color === "blue"   ? "bg-blue-100 dark:bg-blue-900/40"
                  : color === "indigo" ? "bg-primary/10"
                  : "bg-green-100 dark:bg-green-900/40"
                )}>
                  <Icon className={cn(
                    "w-4 h-4",
                    color === "emerald" ? "text-emerald-600 dark:text-emerald-400"
                    : color === "blue"   ? "text-blue-600 dark:text-blue-400"
                    : color === "indigo" ? "text-primary"
                    : "text-green-600 dark:text-green-400"
                  )} />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="text-base font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground leading-snug">{text}</p>
              </div>
            ))}
          </div>
        </PremiumBlurPreview>

        {/* ══ 13. IMPLEMENTATION PLAN (with checkboxes) ════════════════════════ */}
        <PremiumBlurPreview
          title="Implementation Plan"
          subtitle="The practical actions required to deliver this scenario."
          isPro={isProImpl}
          ctaTitle="Unlock the implementation plan"
          ctaDescription="Get a step-by-step action plan with timing, effort and expected impact for each lever."
          ghostContent={
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border/40">
                {["", "Action", "Impact", "Confidence", "Timing"].map(h => <span key={h}>{h}</span>)}
              </div>
              {IMPL_ACTIONS.map(row => (
                <div key={row.action} className="grid grid-cols-5 gap-3 items-center py-2 border-b border-border/30 last:border-0">
                  <div className="w-4 h-4 rounded border border-border/50 bg-secondary/40" />
                  <p className="text-sm text-foreground">{row.action}</p>
                  <p className="text-xs text-muted-foreground/40">— —</p>
                  <span className="text-xs text-muted-foreground/40">—</span>
                  <span className="text-xs text-muted-foreground/40">—</span>
                </div>
              ))}
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="w-8 pb-3" />
                  {["Action","Impact","Confidence","Effort","Timing"].map(h => (
                    <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {IMPL_ACTIONS.map((row, i) => (
                  <tr key={row.action} className={cn("border-b border-border/30 last:border-0 group", checkedActions.has(i) && "opacity-60")}>
                    <td className="py-3 pr-3 align-middle">
                      <button
                        onClick={() => toggleAction(i)}
                        className={cn(
                          "w-5 h-5 rounded flex items-center justify-center border-2 transition-all",
                          checkedActions.has(i)
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-border hover:border-primary/50 bg-background"
                        )}
                      >
                        {checkedActions.has(i) && <CheckCircle className="w-3 h-3" />}
                      </button>
                    </td>
                    <td className={cn("py-3 pr-4 font-medium text-foreground", checkedActions.has(i) && "line-through text-muted-foreground")}>{row.action}</td>
                    <td className="py-3 pr-4 text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">{row.impact}</td>
                    <td className="py-3 pr-4">
                      <span className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                        row.conf === "High"
                          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                      )}>{row.conf}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                        row.effort === "Low"
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          : "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                      )}>{row.effort}</span>
                    </td>
                    <td className="py-3 text-xs text-muted-foreground whitespace-nowrap">{row.timing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PremiumBlurPreview>

        {/* ══ 14. DATA QUALITY NOTE ════════════════════════════════════════════ */}
        <div className="bg-secondary/40 rounded-2xl border border-border/40 px-5 py-4">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Data quality note</p>
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            Scenario outputs are based on the quality of connected sales, marketing, cost and cash data. Forecasts should be treated
            as directional estimates rather than guaranteed outcomes.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1.5 leading-relaxed">
            Accuracy improves when Shopify, Xero, Google Ads, Meta and cost mappings are kept up to date.
          </p>
        </div>

      </div>
    </AppLayout>
  );
}
