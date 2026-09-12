import { useActiveStore } from "@/lib/auth/AuthProvider";
import { useState } from "react";
import {
  Sparkles, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle, Zap, Shield, Lock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, Line,
  ComposedChart, Legend,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { SimulatorSlider } from "@/components/SimulatorSlider";
import { cn } from "@/lib/utils";
import { TimelineSelector } from "@/components/TimelineSelector";
import { canAccess } from "@/lib/plan";
import { PeriodImpact } from "@/components/PeriodImpact";
import { DataBenchmarkAssumptions } from "@/components/DataBenchmarkAssumptions";
import {
  GROSS_REVENUE,
  DISCOUNT_COST,
  BASE_CONTRIBUTION,
  AVG_DISCOUNT_PCT,
} from "@/lib/data/pricing-metrics";
import { deltaToSentiment, DELTA_POLARITY, type DeltaSentiment } from "@/lib/analytics/deltaSentiment";
import { useLatestDataPeriod } from "@/lib/analytics/useLatestDataPeriod";

// ─── Constants ────────────────────────────────────────────────────────────────
// Imported from src/lib/data/pricing-metrics.ts — the central source of truth
// for the sample scenario layer. The simulator is anchored to these constants.
//
// IMPORTANT: Do NOT replace these with live monthly values — the simulator
// coefficients (discountEffect, convEffect, etc.) are calibrated against this
// scenario basis.  Live display values are computed separately inside the
// component and used only for the KPI strip.
//
// GROSS_REVENUE    = 420,000  (scenario basis)
// DISCOUNT_COST    = 64,000
// ORDERS           = 16,000
// BASE_CONTRIBUTION= 198,000
// AVG_DISCOUNT_PCT = 18

// ─── KPI delta values (period-on-period) ──────────────────────────────────────
// Fixed illustrative deltas, never used as source-data fallbacks.
const KPI_DELTA_AVG_DISCOUNT       =  3;
const KPI_DELTA_FULL_PRICE_RATIO   = -6;
const KPI_DELTA_CONTRIB_PER_ORDER  = -2.10;
const KPI_DELTA_RECOVERABLE_CONTRIB = 11_000;

// ─── Simulator scenario baseline — module-level so simulator can read them ─────
// These drive the simulator maths.  They are NOT live values.
const BASE_NET_REVENUE  = GROSS_REVENUE - DISCOUNT_COST;   // 356,000

// ─── Pricing movement driver data (static — no attribution RPC in Phase 1/2) ─
const PRICING_DRIVER_DATA = [
  { driver: "ASP change",             impact: -8_000,  explanation: "Average selling price fell in the current period" },
  { driver: "Discount increase",      impact: -14_000, explanation: "Higher discounting reduced retained revenue" },
  { driver: "Full-price mix",         impact: -9_000,  explanation: "Fewer orders converted at full price" },
  { driver: "Returns movement",       impact: -5_000,  explanation: "Returns increased contribution leakage" },
  { driver: "Product mix improvement",impact:  12_000, explanation: "Higher-margin products partially offset pressure" },
];

// ─── Pricing power trend data (static — no monthly-history RPC) ────────────
const TREND_DATA = [
  { period: "Jan", discount: 13, fullPrice: 58, contrib: 15.10 },
  { period: "Feb", discount: 14, fullPrice: 56, contrib: 14.80 },
  { period: "Mar", discount: 15, fullPrice: 54, contrib: 14.20 },
  { period: "Apr", discount: 16, fullPrice: 51, contrib: 13.70 },
  { period: "May", discount: 17, fullPrice: 49, contrib: 13.10 },
  { period: "Jun", discount: 18, fullPrice: 46, contrib: 12.40 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  (n < 0 ? "-" : "") + "£" + Math.abs(Math.round(n)).toLocaleString("en-GB");

// ─── Sub-components ───────────────────────────────────────────────────────────

function InlineCfoInsight({ text }: { text: string }) {
  return (
    <div className="sc-purple rounded-xl px-4 py-3">
      <p className="text-xs text-indigo-300 font-semibold uppercase tracking-wider mb-1">Sample insight</p>
      <p className="text-sm text-foreground leading-relaxed">{text}</p>
    </div>
  );
}

interface KpiCardProps {
  label: string; value: string; delta: string;
  sentiment: DeltaSentiment | null;
  deltaLabel?: string; insight: string;
}
function KpiCard({ label, value, delta, sentiment, deltaLabel = "vs sample prior period", insight }: KpiCardProps) {
  const DeltaIcon = sentiment === null || sentiment === "neutral" ? Zap : sentiment === "positive" ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-sm px-5 py-4 flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-display font-bold text-foreground leading-none">{value}</p>
      <div className="flex items-center gap-1.5">
        <span className={cn(
          "inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full",
          sentiment === "positive" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" :
          sentiment === "negative" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" :
                                     "bg-secondary text-muted-foreground",
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

function UpgradeCta({ title, description }: { title: string; description: string }) {
  return (
    <a href="/upgrade" className="flex items-center gap-4 rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/90 dark:bg-indigo-950/40 px-5 py-4 hover:border-indigo-300 transition-colors cursor-pointer">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
        <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">{title}</p>
        <p className="text-xs text-indigo-700/70 dark:text-indigo-400/70 mt-0.5">{description}</p>
      </div>
      <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap shrink-0">Upgrade →</span>
    </a>
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
export default function PricingOptimisation() {
  const PO_STORE_ID = useActiveStore();
  // ── Unverified source data for the resolved reporting period ──────────────
  // Uses the existing timeline and order-based lookback; this does not prove completeness.
  const { status: reportingStatus,
    phase1:      pricingPhase1,
    dateFrom:    pricingDateFrom,
    dateTo:      pricingDateTo,
    periodLabel: pricingPeriodLabel,
    loading:     pricingPeriodLoading,
  } = useLatestDataPeriod(PO_STORE_ID);

  // Keep the legacy source ratio separate from the fixed pricing examples.
  const sourceDiscount = pricingPhase1?.data.discountDependency;
  const sourceValue = typeof sourceDiscount === "number" && Number.isFinite(sourceDiscount)
    ? `${(sourceDiscount * 100).toFixed(2)}%` : "Unavailable";
  const sourceStatus = reportingStatus === "loading" ? "Source figures loading"
    : reportingStatus === "error" ? "Source figures unavailable"
    : reportingStatus === "empty" ? "No source orders found in the reporting search"
    : reportingStatus === "stale" ? "Unverified source figures: historical period"
    : "Unverified source figures: latest completed period";

  // ── Simulator state ───────────────────────────────────────────────────────
  // !! SIMULATOR GUARD: The five slider states and all maths below reference
  // the imported static constants (BASE_CONTRIBUTION, BASE_NET_REVENUE,
  // GROSS_REVENUE) from pricing-metrics.ts — NOT the live display values above.
  // The scenario model is intentionally anchored to the static scenario basis.
  const [discountChange,  setDiscountChange]  = useState(0);
  const [fullPriceChange, setFullPriceChange] = useState(0);
  const [convChange,      setConvChange]      = useState(0);
  const [returnsChange,   setReturnsChange]   = useState(0);
  const [shippingChange,  setShippingChange]  = useState(0);

  const isPro    = canAccess("pricing_simulator");
  const isProRec = canAccess("pricing_recommendations");

  // ── Simulator math (uses static scenario constants — unchanged) ─────────────
  const discountEffect  = -discountChange * 12_500;
  const fullPriceEffect = fullPriceChange * 1_300;
  const convEffect      = (convChange / 100) * BASE_NET_REVENUE * 0.38;
  const returnsEffect   = -returnsChange * 3_600;
  const shippingEffect  = -shippingChange * 367;

  const projContribution = BASE_CONTRIBUTION + discountEffect + fullPriceEffect + convEffect + returnsEffect + shippingEffect;
  const projRevenue      = BASE_NET_REVENUE - (discountChange / 100) * GROSS_REVENUE + (convChange / 100) * BASE_NET_REVENUE;
  const projContribMargin = projRevenue > 0 ? ((projContribution / projRevenue) * 100) : 0;
  const contribDelta     = projContribution - BASE_CONTRIBUTION;
  // Risk thresholds calibrated to the 420k scenario basis — do not change.
  const pricingRisk      = projContribution < 150_000 ? "High" : projContribution < 198_000 ? "Moderate" : "Low";

  const simText =
    projContribution < 150_000
      ? "This sample falls below the illustrative risk threshold. Actual customer response and pricing risk are unknown."
      : contribDelta >= 0
        ? "This sample increases contribution under fixed assumptions; this is not a recommendation."
        : "This sample reduces contribution under fixed assumptions; this is not a recommendation.";

  const simColor =
    projContribution < 150_000
      ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400"
      : contribDelta >= 0
        ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400"
        : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400";

  const SimIcon = projContribution < 150_000 ? AlertTriangle : contribDelta >= 0 ? TrendingUp : TrendingDown;

  const slidersActive = discountChange !== 0 || fullPriceChange !== 0 || convChange !== 0 || returnsChange !== 0 || shippingChange !== 0;

  const pricingScenarioModel = (
    <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
      <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-lg text-foreground">Sample Pricing Scenario Model</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Explore a fixed example. Outputs are not predictions or pricing advice.</p>
        </div>
        {!isPro && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider whitespace-nowrap shrink-0">PRO</span>}
      </div>

      {isPro ? (
        <div className="px-6 py-6">
          <div className="mb-5">
            <InlineCfoInsight text="In this sample model, discount depth and full-price order mix change the output. Actual customer response is not modelled." />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <SimulatorSlider label="Average Discount Change"      value={discountChange}  min={-8}  max={8}  step={0.5} unit="pp"  showSign onChange={setDiscountChange}  positiveIsGood={false} description="Reducing discount improves retained revenue" />
              <SimulatorSlider label="Full-Price Order Ratio Change" value={fullPriceChange} min={-15} max={20} step={1}   unit="pp"  showSign onChange={setFullPriceChange} positiveIsGood={true}  description="More full-price orders improve contribution" />
              <SimulatorSlider label="Conversion Rate Impact"       value={convChange}      min={-15} max={10} step={0.5} unit="%"   showSign onChange={setConvChange}      positiveIsGood={true}  description="Conversion change affects revenue and contribution" />
              <SimulatorSlider label="Returns Rate Change"          value={returnsChange}   min={-5}  max={5}  step={0.5} unit="pp"  showSign onChange={setReturnsChange}   positiveIsGood={false} description="Lower returns preserve contribution" />
              <SimulatorSlider label="Shipping Subsidy Change"      value={shippingChange}  min={-30} max={30} step={1}   unit="%"   showSign onChange={setShippingChange}  positiveIsGood={false} description="Higher subsidy reduces contribution" />
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Sample Scenario Outputs</h4>
              <div className="space-y-2">
                {[
                  { label: "Scenario Revenue",              value: `£${Math.round(projRevenue).toLocaleString()}`, highlight: true,  isPeriod: false },
                  { label: "Scenario Contribution",         value: fmt(projContribution),                           highlight: true,  isPeriod: false },
                  { label: "Contribution vs Base",          value: "",                                              highlight: true,  isPeriod: true  },
                  { label: "Scenario Contribution Margin",  value: `${projContribMargin.toFixed(1)}%`,              highlight: false, isPeriod: false },
                  { label: "Illustrative Risk Level",           value: pricingRisk,                                     highlight: false, isPeriod: false },
                ].map(({ label, value, highlight, isPeriod }) => (
                  <div key={label} className={cn("flex items-center justify-between px-4 py-2.5 rounded-xl",
                    highlight ? "bg-secondary/60 border border-border/50" : "bg-secondary/30",
                  )}>
                    <span className={cn("text-xs", highlight ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
                    {isPeriod ? (
                      <PeriodImpact value={contribDelta} className="items-end" />
                    ) : (
                      <span className={cn("text-sm font-bold tabular-nums",
                        highlight
                          ? projContribution < 150_000 ? "text-red-600 dark:text-red-400"
                            : contribDelta >= 0 ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
                          : "text-foreground",
                      )}>{value}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50/60 dark:bg-indigo-950/15 px-4 py-3 flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 mb-0.5">Example discount assumption</p>
                  <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">Reducing average discount by 3pp is modelled to improve contribution by approximately £38k.</p>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/15 px-4 py-3 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-0.5">Example shipping assumption</p>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">The sample shipping coefficient changes contribution when subsidy changes. It does not estimate conversion risk or establish a safest action.</p>
                </div>
              </div>

              <div className={cn("rounded-xl border px-4 py-3 flex items-start gap-2.5", simColor)}>
                <SimIcon className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed font-medium">{simText}</p>
              </div>

              {slidersActive && (
                <button
                  onClick={() => { setDiscountChange(0); setFullPriceChange(0); setConvChange(0); setReturnsChange(0); setShippingChange(0); }}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline mt-1"
                >
                  Reset sample scenario
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-6 py-6">
          <div className="blur-sm opacity-30 pointer-events-none select-none space-y-3 mb-4" aria-hidden>
            <div className="grid grid-cols-2 gap-3">
              {["Average Discount", "Full-Price Orders", "Conversion Rate", "Returns Rate"].map((s) => (
                <div key={s} className="h-10 bg-secondary rounded-xl" />
              ))}
            </div>
            <div className="rounded-xl border border-indigo-200 px-4 py-3 flex items-center gap-2.5 bg-indigo-50/60">
              <div className="w-4 h-4 rounded bg-indigo-200 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="h-2.5 bg-indigo-200 rounded w-40" />
                <div className="h-2 bg-indigo-100 rounded w-56" />
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 px-4 py-3 flex items-center gap-2.5 bg-emerald-50/60">
              <div className="w-4 h-4 rounded bg-emerald-200 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="h-2.5 bg-emerald-200 rounded w-36" />
                <div className="h-2 bg-emerald-100 rounded w-52" />
              </div>
            </div>
          </div>
          <UpgradeCta
            title="Model pricing and discount scenarios"
            description="Pro opens this illustrative simulator; it does not connect actual pricing analysis."
          />
        </div>
      )}
    </div>
  );

  return (
    <AppLayout showMonitoring={false}>
      {/* ── Page header ── */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Pricing & Discount Optimisation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Explore a sample pricing model alongside a separate unverified source ratio.
          </p>

        </div>
        <TimelineSelector />
      </div>

      <section aria-label="Pricing reporting status" className="rounded-2xl border border-border bg-card p-5 mb-6">
        <h2 className="font-semibold text-lg">Actual pricing analysis: unavailable</h2>
        <p className="text-sm text-muted-foreground mt-2">Source figures have not been validated against the agreed financial definitions. They do not establish pricing power, recoverable contribution or recommended actions.</p>
        <p role="status" className="text-sm mt-3">{sourceStatus}</p>
        {!pricingPeriodLoading && (reportingStatus === "ready" || reportingStatus === "stale") && <p className="text-xs text-muted-foreground">{pricingPeriodLabel}: {pricingDateFrom} to {pricingDateTo}</p>}
        <p className="text-sm mt-3">Source discount dependency (unverified)</p>
        <p className="font-bold text-xl">{sourceValue}</p>
        <p className="text-xs text-muted-foreground mt-2">This is the existing source ratio, not a verified average discount per order.</p>
      </section>
      <section aria-label="Sample pricing model notice" className="rounded-2xl border border-amber-300/40 bg-amber-50/10 p-5 mb-6">
        <h2 className="font-semibold">Illustrative pricing model — sample data</h2>
        <p className="text-sm mt-2">All verdicts, amounts, trends, risk and confidence labels, actions and simulator outputs below use fixed sample inputs, not results or recommendations for your business. Sample currency is GBP; it does not establish your store currency. Source figures and selected dates do not change these examples.</p>
        <p className="text-sm mt-2">The model is not validated against the agreed financial definitions. Supporting examples are separate illustrations and do not reconcile to one financial report. Annualised amounts are simple extrapolations, not forecasts.</p>
        <p className="text-sm mt-2">Monitoring not active. Upgrading does not validate or connect actual pricing analysis.</p>
      </section>

      {/* ── Sample Pricing Verdict ── */}
      <div className="sc-purple rounded-2xl shadow-md mb-6 overflow-hidden">
        <div className="sc-purple-header flex items-center gap-3 px-6 py-3">
          <Sparkles className="w-4 h-4 text-indigo-300 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
            Sample Pricing Verdict
          </span>
          <span className="ml-auto inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 whitespace-nowrap">
            Example only
          </span>
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-5 pb-4 border-b border-primary/15">
            <div>
              <p className="text-lg sm:text-xl font-bold text-foreground leading-snug">
                Example: heavy discounting reduces contribution.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                This fictional example illustrates promotions, weaker full-price sales and returns reducing contribution. It is not a finding about your store.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded-xl bg-secondary/30 border border-primary/10 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Sample recovery estimate</p>
                <p className="text-2xl font-display font-bold text-foreground leading-none">£52,000</p>
                <p className="text-xs text-muted-foreground leading-snug mt-1.5">illustrative contribution recovery, not measured profit available.</p>
              </div>
              <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">Example action</p>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Reduce blanket discounts</p>
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-wrap gap-2">
            {["Discount dependency", "Full-price weakness", "Returns leakage"].map((signal) => (
              <span key={signal} className="rounded-full bg-secondary/30 border border-primary/10 px-3 py-1.5 text-xs font-semibold text-foreground">
                {signal}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sample Pricing Opportunities ── */}
      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">Sample Pricing Opportunities</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Illustrative possibilities, not identified opportunities for your store.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/15 px-5 py-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Sample confidence label</p>
                {isProRec ? (
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">£38,000</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50">
                    <Lock className="w-3 h-3" />
                    PRO
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-foreground leading-relaxed">Reduce discount dependency</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                {isProRec
                  ? "Tighten broad discounting before changing prices across the store."
                  : "Pro opens this sample estimate"}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-950/15 px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Additional sample opportunity</p>
                {isProRec ? (
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-300">£14,000</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">
                    <Lock className="w-3 h-3" />
                    PRO
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-foreground leading-relaxed">Improve targeted offers, shipping subsidies and returns</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                {isProRec
                  ? "Improve targeted offers, shipping subsidies and returns on discounted sales."
                  : "Pro opens this sample estimate"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sample Pricing Recovery Plan ── */}
      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">Sample Pricing Recovery Plan</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Example actions and assumed impact, timing and confidence; not a prioritised plan for your business.
        </p>
      </div>

      {isProRec ? (
        <div className="space-y-4 mb-8">
          {[
            {
              title: "Reduce blanket discounting",
              impact: "£38,000",
              confidence: "High",
              effort: "Medium",
              timing: "30 days",
              why: "Average discount increased to 18%, so retained contribution is being lost before fulfilment and overheads.",
              start: "Tighten broad promo codes, preserve offers for targeted segments, and test a 3pp discount reduction before widening the change.",
            },
            {
              title: "Protect full-price conversion",
              impact: "£26,000",
              confidence: "Medium",
              effort: "Medium",
              timing: "30-45 days",
              why: "Full-price order ratio fell to 46%, which points to weaker pricing resilience.",
              start: "Audit products that only convert under promotion and improve merchandising, bundles, or value messaging before adding new discounts.",
            },
            {
              title: "Reduce returns on discounted orders",
              impact: "£14,000",
              confidence: "Medium",
              effort: "Low",
              timing: "14-30 days",
              why: "Returns are adding leakage on top of discounts, reducing the amount of revenue retained from each sale.",
              start: "Review discounted SKUs with high return rates and tighten size, fit, quality or offer rules where returns are concentrated.",
            },
          ].map((action, i) => (
            <details
              key={action.title}
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
                            SAMPLE PRIORITY
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 leading-snug">{action.why}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-[auto_auto_auto_auto] gap-2 lg:justify-end">
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-700/40 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-0.5">Impact</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{action.impact}</p>
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
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/70 dark:bg-indigo-950/25 shadow-sm mb-8 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
              <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Sample Pricing Recovery Plan</p>
              <p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 mt-1">
                Pro opens an illustrative action plan with sample amounts and assumptions. No recovery opportunity has been verified for your store.
              </p>
            </div>
          </div>
        </div>
      )}

      {pricingScenarioModel}

      <p className="text-sm text-muted-foreground mb-8">Personalised pricing advice is unavailable until validated inputs and analysis are connected.</p>

      {/* ── Supporting Sample Analysis ── */}
      <details className="group bg-card rounded-2xl shadow-sm border border-border/50 mb-8 overflow-hidden">
        <summary className="list-none cursor-pointer px-6 py-5 hover:bg-secondary/20 transition-colors">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Supporting Sample Analysis</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Fictional pricing KPIs, contribution movement and trends; not source evidence.
              </p>
            </div>
            <span className="text-xs font-semibold text-primary group-open:hidden">Expand</span>
            <span className="text-xs font-semibold text-primary hidden group-open:inline">Collapse</span>
          </div>
        </summary>
        <div className="px-6 pb-6 pt-2">

      {/* ── Sample KPI Summary ── */}
      <div className="mb-4">
        <h3 className="font-semibold text-lg text-foreground">Sample KPI Summary</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Fixed illustrative values, separate from the source ratio above.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <KpiCard
          label="Discount %"
          value={`${AVG_DISCOUNT_PCT}%`}
          delta="+3pp"
          sentiment={deltaToSentiment(KPI_DELTA_AVG_DISCOUNT, DELTA_POLARITY.avgDiscount)}
          insight="Average discount given across orders."
        />
        <KpiCard
          label="Full-Price Order Ratio"
          value="46%"
          delta="-6pp"
          sentiment={deltaToSentiment(KPI_DELTA_FULL_PRICE_RATIO, DELTA_POLARITY.fullPriceRatio)}
          insight="Orders completed without discount."
        />
        <KpiCard
          label="Contribution per Order"
          value="£12.40"
          delta="-£2.10"
          sentiment={deltaToSentiment(KPI_DELTA_CONTRIB_PER_ORDER, DELTA_POLARITY.cpPerOrder)}
          insight="Profit before overheads generated per order."
        />
        <KpiCard
          label="Recoverable Contribution"
          value="£52,000"
          delta="+£11,000"
          sentiment={deltaToSentiment(KPI_DELTA_RECOVERABLE_CONTRIB, DELTA_POLARITY.recoverableContrib)}
          insight="Modelled contribution recoverable through pricing improvements."
        />
      </div>

      {/* ── Sample Contribution Drivers — Pro gated ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg text-foreground">Sample Contribution Drivers</h3>
            <p className="text-sm text-muted-foreground mt-0.5">This example shows a £24k contribution decrease and fictional pricing drivers.</p>
          </div>
          {!canAccess("pricing_driver_table") && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider whitespace-nowrap shrink-0">PRO</span>}
        </div>
        <div className="px-6 pt-5 pb-2">
          <InlineCfoInsight text="Contribution fell primarily due to increased discounting and weaker full-price sales, partly offset by improved product mix." />
        </div>

        {canAccess("pricing_driver_table") ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-secondary/40">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Driver</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contribution Impact</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">What happened</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {PRICING_DRIVER_DATA.map((row) => (
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
                  <tr className="bg-red-50/50 dark:bg-red-950/15 border-t border-red-200 dark:border-red-800/40">
                    <td className="px-6 py-3 font-semibold text-foreground text-sm">Net contribution movement</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600 dark:text-red-400 text-sm tabular-nums">(£24,000)</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">Overall contribution decreased this period</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-6 pt-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contribution Impact by Driver</h4>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={PRICING_DRIVER_DATA} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }} barSize={22}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `£${(Math.abs(v) / 1_000).toFixed(0)}k`}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="driver" width={150}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <ReferenceLine x={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                    <Tooltip content={<DriverTooltip />} />
                    <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                      {PRICING_DRIVER_DATA.map((entry) => (
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
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {PRICING_DRIVER_DATA.map((row) => (
                    <tr key={row.driver}>
                      <td className="px-4 py-3 text-sm text-foreground">{row.driver}</td>
                      <td className="px-4 py-3 text-right font-semibold text-sm">████████</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <UpgradeCta
              title="View sample contribution drivers on Pro"
              description="Explore fictional driver amounts and explanations; actual attribution is unavailable."
            />
          </div>
        )}
      </div>

      {/* ── Sample Pricing Trend ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg text-foreground">Sample Pricing Trend</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Fictional trend showing an example of increased discount dependency.</p>
          </div>
          {!canAccess("pricing_trend_chart") && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider whitespace-nowrap shrink-0">PRO</span>}
        </div>

        {canAccess("pricing_trend_chart") ? (
          <div className="px-6 py-5">
            <InlineCfoInsight text="Pricing power is weakening as discounting rises while full-price mix and contribution per order fall." />
            <div className="mt-5 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={TREND_DATA} margin={{ top: 4, right: 48, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="pct" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${v}%`} domain={[0, 75]} />
                  <YAxis yAxisId="gbp" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `£${v}`} domain={[10, 17]} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: 12 }}
                    formatter={(val: number, name: string) =>
                      name === "contrib" ? [`£${val}`, "Contribution/Order"] :
                      name === "discount" ? [`${val}%`, "Avg Discount"] :
                      [`${val}%`, "Full-Price Ratio"]
                    }
                  />
                  <Legend formatter={(v) =>
                    v === "discount" ? "Avg Discount %" :
                    v === "fullPrice" ? "Full-Price Order Ratio %" :
                    "Contribution per Order (£)"
                  } wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="pct" type="monotone" dataKey="discount"  stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="discount" />
                  <Line yAxisId="pct" type="monotone" dataKey="fullPrice" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="fullPrice" />
                  <Line yAxisId="gbp" type="monotone" dataKey="contrib"   stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="contrib" />
                  <ReferenceLine yAxisId="pct" x="Mar" stroke="#f97316" strokeDasharray="4 2" strokeWidth={1.5}
                    label={{ value: "Promo ↑", position: "insideTopLeft", fill: "#f97316", fontSize: 9, fontWeight: 700 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-orange-200 dark:border-orange-800/40 bg-orange-50/60 dark:bg-orange-950/15 px-4 py-3">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-orange-800 dark:text-orange-300 mb-0.5">Sample promotion increase (Mar–Apr)</p>
                <p className="text-xs text-orange-700/80 dark:text-orange-400/75 leading-relaxed">Discounting began rising faster after promotional activity increased.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-950/15">
              <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              <span className="text-sm font-bold text-red-800 dark:text-red-300">Sample Pricing Trend: Weakening</span>
            </div>
            <UpgradeCta
              title="View sample pricing trends on Pro"
              description="Explore six fictional periods; actual pricing trends are unavailable."
            />
          </div>
        )}
      </div>

        </div>
      </details>

      <DataBenchmarkAssumptions
        benchmarkNote="Risk thresholds, confidence labels and simulator coefficients are illustrative assumptions, not verified benchmarks or recommendations for your business."
        dataQualityNote="Actual pricing analysis is unavailable. The source ratio is unverified; all supporting analysis, recovery estimates and simulator outputs use separate sample inputs."
        className="mb-2"
      />

    </AppLayout>
  );
}
