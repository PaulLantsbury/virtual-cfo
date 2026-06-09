import { useState, useEffect } from "react";
import {
  Sparkles, TrendingUp, AlertTriangle,
  Zap, CheckCircle,
  RefreshCw, Save, Layers, Target, ChevronRight,
  FlaskConical, X,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { AppLayout } from "@/components/layout/AppLayout";
import { PremiumBlurPreview } from "@/components/PremiumBlurPreview";
import { canAccess } from "@/lib/plan";
import { cn } from "@/lib/utils";
import { AiCfoAskCard } from "@/components/AiCfoAskCard";
import { GROSS_REVENUE as BASE_REVENUE, BASE_CONTRIBUTION, CONTRIBUTION_PER_ORDER as BASE_CPO } from "@/lib/data/pricing-metrics";
import { BASE_EBITDA } from "@/lib/data/business-snapshot";
import { CASH_BALANCE as BASE_CASH, CASH_RUNWAY as BASE_RUNWAY, WORKING_CAPITAL_DRAG as BASE_WORKING_CAPITAL } from "@/lib/data/cash-snapshot";

// ─── Base financial constants ─────────────────────────────────────────────────
// Imported from central mock data layer — replace those files with live feeds
// when Shopify / Xero integrations are connected.
//
// BASE_REVENUE         = 420,000  (GROSS_REVENUE from pricing-metrics)
// BASE_CONTRIBUTION    = 198,000  (from pricing-metrics — same value as business-snapshot CONTRIBUTION)
// BASE_EBITDA          = 78,000   (from business-snapshot)
// BASE_CASH            = 186,000  (CASH_BALANCE from cash-snapshot)
// BASE_RUNWAY          = 3.4      (CASH_RUNWAY from cash-snapshot)
// BASE_WORKING_CAPITAL = 74,000   (WORKING_CAPITAL_DRAG from cash-snapshot)
// BASE_CPO             = 12.40    (CONTRIBUTION_PER_ORDER from pricing-metrics)

// Scenario-lab specific: BASE_CAC_PAYBACK uses 1.6 as a scenario modelling starting
// point (intentionally higher than the shared CAC_PAYBACK = 1.4 in growth-metrics.ts,
// which reflects the current actual payback — 1.6 is the conservative scenario base).
const BASE_CAC_PAYBACK = 1.6;

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

type PlanId = "balanced" | "margin" | "cash" | "custom";

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
  custom:   "Custom",
};

const PLAN_PRESETS: Record<PlanId, ScenarioState> = {
  balanced: BALANCED_GROWTH,
  margin:   MARGIN_RECOVERY,
  cash:     CASH_PROTECTION,
  custom:   ZERO_STATE,
};

// ─── Opportunity presets (from Profit Opportunities page) ─────────────────────
// Each preset loads when the user clicks "Model this scenario" on an opportunity
// card. Values start from ZERO_STATE so only relevant levers are set, making
// the connection between the recommendation and the slider change explicit.
interface OpportunityPreset {
  label: string;
  state: ScenarioState;
  focusTab: "growth" | "margin" | "marketing" | "cash" | "overheads";
}

const OPPORTUNITY_PRESETS: Record<string, OpportunityPreset> = {
  "reduce-discount-depth": {
    label:    "Reduce average discount depth",
    focusTab: "margin",
    state: {
      ...ZERO_STATE,
      discountChange: -4,
      aovChange:       2,
      returnsChange:  -1,
    },
  },
  "reallocate-meta-spend": {
    label:    "Reallocate inefficient Meta spend",
    focusTab: "marketing",
    state: {
      ...ZERO_STATE,
      metaSpendChange:     -15,
      emailMixUplift:       12,
      blendedCacChange:    -10,
      marketingSpendChange: -8,
    },
  },
  "improve-fullprice-ratio": {
    label:    "Improve full-price order ratio",
    focusTab: "margin",
    state: {
      ...ZERO_STATE,
      discountChange: -3,
      aovChange:       3,
      revenueChange:   2,
    },
  },
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ScenarioLab() {
  const isPro       = canAccess("scenario_lab_builder");
  const isProPlans  = canAccess("scenario_lab_plans");

  const [scenario,    setScenario]    = useState<ScenarioState>(BALANCED_GROWTH);
  const [activeTab,   setActiveTab]   = useState<"growth"|"margin"|"marketing"|"cash"|"overheads">("growth");
  const [activePlan,  setActivePlan]  = useState<PlanId>("balanced");
  const [loadedPresetLabel, setLoadedPresetLabel] = useState<string | null>(null);

  // Detect ?preset= param on first mount only — applies the opportunity preset,
  // switches to the relevant slider tab, then strips the param from the URL so
  // a page refresh does not re-apply it. Empty dep array guarantees one execution.
  useEffect(() => {
    const params   = new URLSearchParams(window.location.search);
    const presetId = params.get("preset");
    if (presetId && presetId in OPPORTUNITY_PRESETS) {
      const { label, state, focusTab } = OPPORTUNITY_PRESETS[presetId];
      setScenario(state);
      setActivePlan("custom");
      setActiveTab(focusTab);
      setLoadedPresetLabel(label);
      const url = new URL(window.location.href);
      url.searchParams.delete("preset");
      window.history.replaceState({}, "", url.toString());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const out = computeOutputs(scenario);

  function set(key: keyof ScenarioState) {
    return (v: number) => setScenario(prev => ({ ...prev, [key]: v }));
  }

  function applyPlan(plan: PlanId) {
    setActivePlan(plan);
    setScenario(PLAN_PRESETS[plan]);
  }

  const TABS = [
    { id: "growth",     label: "Growth"    },
    { id: "margin",     label: "Margin"    },
    { id: "marketing",  label: "Marketing" },
    { id: "cash",       label: "Cash"      },
    { id: "overheads",  label: "Overheads" },
  ] as const;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">

        {/* ══ 1. PAGE HEADER ══════════════════════════════════════════════════ */}
        <div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">
              Profit Launchpad
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed max-w-xl">
              Night Scout’s recommended route to higher profit and stronger cashflow.
            </p>
          </div>
        </div>

        {/* ══ OPPORTUNITY PRESET BANNER ════════════════════════════════════════ */}
        {loadedPresetLabel && (
          <div className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-700/50">
            <div className="flex items-center gap-3 min-w-0">
              <FlaskConical className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200 leading-snug">
                Recommended plan loaded from Opportunities:{" "}
                <span className="font-semibold">"{loadedPresetLabel}"</span>
                <span className="ml-2 text-indigo-600/70 dark:text-indigo-400/70 font-normal text-xs">
                  · Relevant sliders pre-populated below
                </span>
              </p>
            </div>
            <button
              onClick={() => setLoadedPresetLabel(null)}
              aria-label="Dismiss"
              className="shrink-0 p-1 rounded-lg text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ══ 2. CFO INSIGHT CARD ═════════════════════════════════════════════ */}
        <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Scout Verdict</p>
              <p className="text-sm text-foreground leading-relaxed">
                Night Scout recommends a Balanced Growth Plan: reduce discounting, improve marketing efficiency and protect cash
                before adding more growth spend.
              </p>
            </div>
          </div>
        </div>

        {/* ── Board-level summary strip ────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/30">
          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            This plan increases contribution by approximately 21% without relying on more paid acquisition.
          </p>
        </div>

        {/* ══ 3. RECOMMENDED LAUNCH PLAN SUMMARY ══════════════════════════════ */}
        <SectionHeading
          title="Recommended Route To Higher Profit"
          subtitle="Night Scout recommends the Balanced Growth Plan."
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
          <div className={cn("grid gap-3", isPro ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4")}>
            {[
              {
                label: "Profit impact",
                value: "+£42,000",
                freeValue: "Meaningful profit improvement identified",
                subLabel: "30-day impact",
                annualised: "+£504,000 (annualised)",
                color: "emerald",
              },
              {
                label: "Cash impact",
                value: "+£64,000",
                freeValue: "Meaningful cash improvement identified",
                subLabel: "30-day impact",
                annualised: "+£768,000 (annualised)",
                color: "emerald",
              },
              {
                label: "Runway impact",
                value: "+0.8 months",
                freeValue: "Improved runway resilience identified",
                subLabel: undefined,
                annualised: undefined,
                color: "emerald",
              },
              {
                label: "Margin impact",
                value: "+4.2pp",
                freeValue: "Margin improvement opportunity identified",
                subLabel: undefined,
                annualised: undefined,
                color: "emerald",
              },
              ...(isPro ? [{
                label: "Plan quality",
                value: "Strong",
                freeValue: "",
                subLabel: undefined,
                annualised: undefined,
                color: "indigo",
              }] : []),
            ].map(({ label, value, freeValue, subLabel, annualised, color }) => (
              <div key={label} className="flex flex-col items-center text-center bg-secondary/40 rounded-xl p-4 gap-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className={cn(
                  isPro ? "text-lg font-bold leading-tight" : "text-sm font-bold leading-snug",
                  color === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-primary"
                )}>
                  {isPro ? value : freeValue}
                </p>
                {isPro && subLabel   && <p className="text-[10px] text-muted-foreground/70">{subLabel}</p>}
                {isPro && annualised && <p className="text-[10px] text-muted-foreground/60 tabular-nums">{annualised}</p>}
                {!isPro && <p className="text-[10px] text-muted-foreground/70 mt-1">Upgrade to see expected impact.</p>}
              </div>
            ))}
          </div>
        </div>

        {/* ══ 4. SCOUT RECOMMENDATION ════════════════════════════════════════ */}
        {isPro && (
          <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Scout Recommendation</p>
                <p className="text-sm text-foreground leading-relaxed">
                  Start with the Balanced Growth Plan. It delivers meaningful contribution uplift while protecting cash runway and
                  avoiding over-reliance on new paid acquisition. Prioritise discount discipline, Meta budget reallocation and
                  inventory control before increasing growth spend.
                </p>
              </div>
            </div>
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
          </div>
        )}

        {/* ══ 5. WHY NIGHT SCOUT CHOSE THIS ══════════════════════════════════ */}
        <SectionHeading title="Why Night Scout Chose This" />

        <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 space-y-5">
          {isPro ? (
            <>
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
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-foreground leading-relaxed">
                Night Scout has identified three signals influencing this recommendation.
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  "Margin pressure",
                  "Marketing efficiency opportunity",
                  "Cash protection opportunity",
                ].map(signal => (
                  <div key={signal} className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">{signal}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ══ 6. OTHER ROUTES ════════════════════════════════════════════════ */}
        <SectionHeading
          title="Other Routes You Could Take"
          subtitle="Night Scout recommends the Balanced Growth Plan, but you can choose a more profit-focused or cash-focused route if priorities change."
        />

        <div>
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
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1">
                  {isPro ? "+£42k contribution / month" : "Upgrade to compare expected impact."}
                </p>
              </div>
              <ul className="space-y-1.5">
                {["Reduce average discount by 3pp","Reallocate 15% of Meta spend to Email and Organic","Reduce shipping cost per order by £1.50","Pause low-margin acquisition campaigns"].map(a => (
                  <li key={a} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500 shrink-0" />{a}
                  </li>
                ))}
              </ul>
              <button disabled={!isProPlans} onClick={() => applyPlan("margin")} className={cn(
                "w-full mt-auto text-xs font-semibold px-4 py-2 rounded-xl border transition-colors",
                isProPlans
                  ? "border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                  : "border-border/40 text-muted-foreground/60 bg-secondary/30 cursor-not-allowed"
              )}>
                {isProPlans ? "Apply this plan" : "View Route"}
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
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">
                  {isPro ? "+£64k cash headroom" : "Upgrade to compare expected impact."}
                </p>
              </div>
              <ul className="space-y-1.5">
                {["Reduce inventory days by 12","Delay non-essential supplier payments by 6 days","Hold fixed costs flat","Pause discretionary marketing spend"].map(a => (
                  <li key={a} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />{a}
                  </li>
                ))}
              </ul>
              <button disabled={!isProPlans} onClick={() => applyPlan("cash")} className={cn(
                "w-full mt-auto text-xs font-semibold px-4 py-2 rounded-xl border transition-colors",
                isProPlans
                  ? "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-700/30"
                  : "border-border/40 text-muted-foreground/60 bg-secondary/30 cursor-not-allowed"
              )}>
                {isProPlans ? "Apply this plan" : "View Route"}
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
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                  {isPro ? "+£28k contribution / +0.5 months runway" : "Upgrade to compare expected impact."}
                </p>
              </div>
              <ul className="space-y-1.5">
                {["Reduce blanket discounts by 2pp","Shift 10% of Meta spend to Email","Improve full-price order mix","Keep Google Shopping spend stable"].map(a => (
                  <li key={a} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />{a}
                  </li>
                ))}
              </ul>
              <button disabled={!isProPlans} onClick={() => applyPlan("balanced")} className={cn(
                "w-full mt-auto text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm",
                isProPlans
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
                  : "bg-secondary text-muted-foreground/60 cursor-not-allowed"
              )}>
                {isProPlans ? "Apply this plan" : "View Route"}
              </button>
            </div>
          </div>
        </div>

        {!isPro && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-6 py-5 rounded-2xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/80 dark:bg-indigo-950/30">
            <div className="flex-1">
              <p className="text-base font-bold text-indigo-900 dark:text-indigo-100 mb-1">Unlock Your Launch Plan</p>
              <p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 leading-relaxed">
                See exactly how much profit is available, which route delivers the strongest outcome and the step-by-step implementation plan.
              </p>
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

        {isPro && (
          <>

        {/* ══ 7. PROFIT LAUNCHPAD SIMULATOR ══════════════════════════════════ */}
        <SectionHeading
          title="Profit Launchpad Simulator"
          subtitle="Model revenue, margin, marketing, cash and overhead changes before committing resources."
        />

        {/* Active plan banner */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 rounded-2xl bg-secondary/60 border border-border/50">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Active plan</p>
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
              <Save className="w-3 h-3" /> Save as new plan
            </button>
          </div>
        </div>

        <PremiumBlurPreview
          title="Profit Launchpad Simulator"
          subtitle="18 levers across Growth, Margin, Marketing, Cash and Overheads."
          isPro={isPro}
          ctaTitle="Unlock the Profit Launchpad Simulator"
          ctaDescription="Test any combination of levers and see the combined financial impact in real time."
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
              <RefreshCw className="w-3.5 h-3.5" /> Reset plan
            </button>
            <button className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
              <Save className="w-3.5 h-3.5" /> Save plan
            </button>
            <button className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
              <Layers className="w-3.5 h-3.5" /> Compare plans
            </button>
          </div>
        </PremiumBlurPreview>

        <AiCfoAskCard pageId="scenario" />

        {/* ══ 8. SUPPORTING ANALYSIS ═════════════════════════════════════════ */}
        <details className="group bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden">
          <summary className="list-none cursor-pointer px-6 py-5 hover:bg-secondary/20 transition-colors">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">Supporting Analysis</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Compact evidence behind the recommended launch plan.
                </p>
              </div>
              <span className="text-xs font-semibold text-primary group-open:hidden">Expand</span>
              <span className="text-xs font-semibold text-primary hidden group-open:inline">Collapse</span>
            </div>
          </summary>
          <div className="px-6 pb-6 pt-2 grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border/60 bg-secondary/20 px-4 py-3">
              <h3 className="text-sm font-bold text-foreground">Plan Impact Summary</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-3">Current position compared with the active plan.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/40 text-muted-foreground">
                      <th className="text-left font-semibold py-2 pr-3">Metric</th>
                      <th className="text-right font-semibold py-2 px-3">Current</th>
                      <th className="text-right font-semibold py-2 pl-3">Plan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {[
                      { label: "Contribution", current: fmtK(BASE_CONTRIBUTION), plan: fmtK(out.contribution) },
                      { label: "EBITDA", current: fmtK(BASE_EBITDA), plan: fmtK(out.ebitda) },
                      { label: "Cash Balance", current: fmtK(BASE_CASH), plan: fmtK(out.cash) },
                    ].map(row => (
                      <tr key={row.label}>
                        <td className="py-2 pr-3 font-medium text-foreground">{row.label}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground tabular-nums">{row.current}</td>
                        <td className="py-2 pl-3 text-right font-semibold text-foreground tabular-nums">{row.plan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-secondary/20 px-4 py-3">
              <h3 className="text-sm font-bold text-foreground">Key Drivers</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-3">The three changes doing most of the work.</p>
              <div className="space-y-3">
                {[
                  { title: "Discount reduction", text: "Tighter discounting protects contribution without needing more traffic." },
                  { title: "Marketing reallocation", text: "Spend shifts away from weaker paid acquisition into higher-efficiency channels." },
                  { title: "Inventory reduction", text: "Lower stock days release cash and improve short-term headroom." },
                ].map(driver => (
                  <div key={driver.title} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">{driver.title}</p>
                      <p className="text-xs text-muted-foreground leading-snug mt-0.5">{driver.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-secondary/20 px-4 py-3">
              <h3 className="text-sm font-bold text-foreground">Why Night Scout Has Confidence</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-3">The recommendation is grounded in stable operating signals.</p>
              <ul className="space-y-2">
                {[
                  "CAC trends stable",
                  "Discount behaviour predictable",
                  "Inventory reduction already underway",
                ].map(item => (
                  <li key={item} className="flex items-start gap-2 text-xs text-foreground">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </details>

          </>
        )}
      </div>

    </AppLayout>
  );
}
