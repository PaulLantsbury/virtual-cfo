import { useState } from "react";
import {
  Sparkles, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle, Info, Zap, Shield, Lock,
  Target, ListOrdered,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, LineChart, Line,
  ComposedChart, Legend,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { SimulatorSlider } from "@/components/SimulatorSlider";
import { cn } from "@/lib/utils";
import { TimelineSelector } from "@/components/TimelineSelector";
import { canAccess } from "@/lib/plan";
import { AiCfoAskCard } from "@/components/AiCfoAskCard";
import { PeriodImpact } from "@/components/PeriodImpact";
import { DataBenchmarkAssumptions } from "@/components/DataBenchmarkAssumptions";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { DataPeriodLabel } from "@/components/DataPeriodLabel";
import {
  GROSS_REVENUE,
  DISCOUNT_COST,
  RETURNS_IMPACT,
  ORDERS,
  BASE_CONTRIBUTION,
  AVG_DISCOUNT_PCT,
} from "@/lib/data/pricing-metrics";
import { deltaToSentiment, DELTA_POLARITY, type DeltaSentiment } from "@/lib/analytics/deltaSentiment";
import { useLatestDataPeriod } from "@/lib/analytics/useLatestDataPeriod";
import { usePhase2Deltas } from "@/lib/analytics/usePhase2Deltas";

// ─── Data period config ────────────────────────────────────────────────────────
// DEV-ONLY: hardcoded seed store UUID — matches dashboard.tsx, margin-analysis.tsx, etc.
// Replace with authenticated session store_id before multi-tenant use.
const PO_STORE_ID = "10000000-0000-0000-0000-000000000001";

// ─── Constants ────────────────────────────────────────────────────────────────
// Imported from src/lib/data/pricing-metrics.ts — the central source of truth
// for the scenario/model layer.  The simulator is anchored to these constants.
//
// IMPORTANT: Do NOT replace these with live monthly values — the simulator
// coefficients (discountEffect, convEffect, etc.) are calibrated against this
// scenario basis.  Live display values (liveGrossRevenue, liveDiscountCost, …)
// are computed separately inside the component and used only for the KPI strip,
// revenue bridge and leakage chart.
//
// GROSS_REVENUE    = 420,000  (scenario basis)
// DISCOUNT_COST    = 64,000
// RETURNS_IMPACT   = 18,000
// ORDERS           = 16,000
// BASE_CONTRIBUTION= 198,000
// AVG_DISCOUNT_PCT = 18

// ─── KPI delta values (period-on-period) ──────────────────────────────────────
// Static fallbacks — shown when Phase 2 delta RPC has not yet resolved or
// when prior period has no data.
// @dynamic Replace with live period-over-period differences from Shopify data.
const KPI_DELTA_ASP                = -1.20;
const KPI_DELTA_AVG_DISCOUNT       =  3;
const KPI_DELTA_FULL_PRICE_RATIO   = -6;
const KPI_DELTA_CONTRIB_PER_ORDER  = -2.10;
const KPI_DELTA_DISCOUNT_COST      = 14_000;
const KPI_DELTA_RETURNS_IMPACT     =  5_000;
const KPI_DELTA_RECOVERABLE_CONTRIB = 11_000;

// ─── Simulator scenario baseline — module-level so simulator can read them ─────
// These drive the simulator maths.  They are NOT live values.
const BASE_NET_REVENUE  = GROSS_REVENUE - DISCOUNT_COST;   // 356,000
const BASE_NET_RETAINED = BASE_NET_REVENUE - RETURNS_IMPACT; // 338,000

// ─── Revenue bridge colour map ─────────────────────────────────────────────────
const REV_BRIDGE_COLOR: Record<string, string> = {
  base: "#6366f1", negative: "#ef4444", result: "#6366f1",
};

// ─── Contribution leakage colours ─────────────────────────────────────────────
const LEAKAGE_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#84cc16"];

// ─── Pricing movement driver data (static — no attribution RPC in Phase 1/2) ─
const PRICING_DRIVER_DATA = [
  { driver: "ASP change",             impact: -8_000,  explanation: "Average selling price fell this month" },
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
  label: string; value: string; delta: string;
  sentiment: DeltaSentiment | null;
  deltaLabel?: string; insight: string;
}
function KpiCard({ label, value, delta, sentiment, deltaLabel = "vs prior period", insight }: KpiCardProps) {
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

// RevBridgeTooltip reads type/value from payload[0].payload (the data row
// passed by Recharts) rather than looking up the module-level REV_BRIDGE array,
// so it works correctly now that the bridge is computed inside the component.
function RevBridgeTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { name: string; type: string; value: number } | undefined;
  if (!row) return null;
  const isNeg = row.type === "negative";
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2.5 text-sm">
      <p className="font-semibold text-foreground mb-0.5">{label}</p>
      <p className={cn("font-bold", isNeg ? "text-red-500" : "text-indigo-600")}>
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

function LeakageTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2.5 text-sm">
      <p className="font-semibold text-foreground mb-0.5">{label}</p>
      <p className="font-bold text-red-600">£{payload[0].value.toLocaleString()}</p>
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────
export default function PricingOptimisation() {
  // ── Phase 1 live data (current calendar month) ────────────────────────────
  // Resolves to the most recent month with order data.
  const {
    phase1:      pricingPhase1,
    dateFrom:    pricingDateFrom,
    dateTo:      pricingDateTo,
    periodLabel: pricingPeriodLabel,
    loading:     pricingPeriodLoading,
  } = useLatestDataPeriod(PO_STORE_ID);

  // ── Phase 2 MoM deltas ────────────────────────────────────────────────────
  const {
    deltas:  phase2Deltas,
    loading: phase2DeltasLoading,
  } = usePhase2Deltas(PO_STORE_ID, pricingDateFrom, pricingDateTo);

  // ── Live display values — DISPLAY ONLY, never fed into simulator math ─────
  //
  // Naming convention: live* = current-month value from Phase 1/2 RPCs.
  // The simulator block below uses the imported static constants (GROSS_REVENUE,
  // BASE_CONTRIBUTION, BASE_NET_REVENUE) which remain on a different scenario
  // basis.  Do not replace those with these live* variables.

  // Phase 1 raw fields (ratios are [0,1])
  const liveGrossRevenue    = (pricingPhase1 !== null && !pricingPhase1.errors.some(e => e.fn === "gross_revenue")      && pricingPhase1.data.grossRevenue > 0)
    ? pricingPhase1.data.grossRevenue      : null;
  const liveDiscountDepRatio = (pricingPhase1 !== null && !pricingPhase1.errors.some(e => e.fn === "discount_dependency"))
    ? pricingPhase1.data.discountDependency : null;
  const liveRefundRateRatio  = (pricingPhase1 !== null && !pricingPhase1.errors.some(e => e.fn === "refund_rate"))
    ? pricingPhase1.data.refundRate         : null;
  const liveCmPctRatio       = (pricingPhase1 !== null && !pricingPhase1.errors.some(e => e.fn === "contribution_margin_pct") && pricingPhase1.data.contributionMarginPct !== null)
    ? pricingPhase1.data.contributionMarginPct : null;
  const liveNetSales         = (pricingPhase1 !== null && !pricingPhase1.errors.some(e => e.fn === "net_sales"))
    ? pricingPhase1.data.netSales : null;

  // Derived live display values (with static fallbacks for pre-load / RPC error)
  const liveGrossRevenueDisplay  = liveGrossRevenue    ?? GROSS_REVENUE;
  const liveDiscountCostDisplay  = (liveDiscountDepRatio !== null && liveGrossRevenue !== null)
    ? liveDiscountDepRatio * liveGrossRevenue : DISCOUNT_COST;
  const liveReturnsImpactDisplay = (liveRefundRateRatio !== null && liveGrossRevenue !== null)
    ? liveRefundRateRatio  * liveGrossRevenue : RETURNS_IMPACT;
  const liveNetRevenueDisplay    = liveGrossRevenueDisplay - liveDiscountCostDisplay;
  const liveNetRetainedDisplay   = liveNetRevenueDisplay  - liveReturnsImpactDisplay;
  const liveAvgDiscountPctDisplay = liveDiscountDepRatio !== null
    ? liveDiscountDepRatio * 100 : AVG_DISCOUNT_PCT;

  // Live base contribution — display only (KPI context, NOT simulator)
  // Formula: cm_pct × net_sales  (same as Phase 1 cost model output)
  const liveBaseContributionDisplay = (liveCmPctRatio !== null && liveNetSales !== null && liveNetSales > 0)
    ? liveCmPctRatio * liveNetSales : null;

  // ── Phase 2 delta-derived live badge values ───────────────────────────────
  //
  // Badge format matches existing pricing page style: "+3pp", "+£14,000".
  // Local helpers avoid "↑ X.Xpp vs last month" suffix (that's in deltaLabel).

  const fmtPp = (v: number | null, fallback: string): string => {
    if (v === null || !Number.isFinite(v)) return fallback;
    return `${v >= 0 ? "+" : ""}${Math.abs(v).toFixed(1)}pp`;
  };
  const fmtGbp = (v: number | null, fallback: string): string => {
    if (v === null || !Number.isFinite(v)) return fallback;
    return `${v >= 0 ? "+" : "−"}£${Math.round(Math.abs(v)).toLocaleString("en-GB")}`;
  };

  // Avg Discount % — direct from discount_dep_delta_pp
  const liveAvgDiscountDeltaStr = !phase2DeltasLoading
    ? fmtPp(phase2Deltas?.discount_dep_delta_pp ?? null, `+${KPI_DELTA_AVG_DISCOUNT}pp`)
    : `+${KPI_DELTA_AVG_DISCOUNT}pp`;
  const liveAvgDiscountSentiment = !phase2DeltasLoading
    ? deltaToSentiment(phase2Deltas?.discount_dep_delta_pp ?? null, DELTA_POLARITY.avgDiscount)
    : deltaToSentiment(KPI_DELTA_AVG_DISCOUNT, DELTA_POLARITY.avgDiscount);

  // Discount Cost £ — derived from _cur/_prv raw fields in Phase2DeltaRow
  // formula: (discount_dep_cur × gross_revenue_cur) − (discount_dep_prv × gross_revenue_prv)
  const liveDiscountCostDeltaNum: number | null = (() => {
    if (phase2DeltasLoading || phase2Deltas === null) return null;
    const cur = phase2Deltas.discount_dep_cur * phase2Deltas.gross_revenue_cur;
    const prv = phase2Deltas.discount_dep_prv * phase2Deltas.gross_revenue_prv;
    const delta = cur - prv;
    // Treat as null when prior period had no revenue (prv = 0) to avoid spurious +100%
    return phase2Deltas.gross_revenue_prv > 0 ? delta : null;
  })();
  const liveDiscountCostDeltaStr = !phase2DeltasLoading
    ? fmtGbp(liveDiscountCostDeltaNum, `+£${KPI_DELTA_DISCOUNT_COST.toLocaleString("en-GB")}`)
    : `+£${KPI_DELTA_DISCOUNT_COST.toLocaleString("en-GB")}`;
  const liveDiscountCostSentiment = !phase2DeltasLoading
    ? deltaToSentiment(liveDiscountCostDeltaNum, DELTA_POLARITY.discountCost)
    : deltaToSentiment(KPI_DELTA_DISCOUNT_COST, DELTA_POLARITY.discountCost);

  // Returns Impact £ — derived from _cur/_prv raw fields
  // formula: (refund_rate_cur × gross_revenue_cur) − (refund_rate_prv × gross_revenue_prv)
  const liveReturnsImpactDeltaNum: number | null = (() => {
    if (phase2DeltasLoading || phase2Deltas === null) return null;
    const cur = phase2Deltas.refund_rate_cur * phase2Deltas.gross_revenue_cur;
    const prv = phase2Deltas.refund_rate_prv * phase2Deltas.gross_revenue_prv;
    const delta = cur - prv;
    return phase2Deltas.gross_revenue_prv > 0 ? delta : null;
  })();
  const liveReturnsImpactDeltaStr = !phase2DeltasLoading
    ? fmtGbp(liveReturnsImpactDeltaNum, `+£${KPI_DELTA_RETURNS_IMPACT.toLocaleString("en-GB")}`)
    : `+£${KPI_DELTA_RETURNS_IMPACT.toLocaleString("en-GB")}`;
  const liveReturnsImpactSentiment = !phase2DeltasLoading
    ? deltaToSentiment(liveReturnsImpactDeltaNum, DELTA_POLARITY.returnsImpact)
    : deltaToSentiment(KPI_DELTA_RETURNS_IMPACT, DELTA_POLARITY.returnsImpact);

  // Margin lost to discount increase (micro-card) — same delta as Discount Cost
  const liveDiscountIncrease = liveDiscountCostDeltaNum !== null
    ? Math.abs(Math.round(liveDiscountCostDeltaNum))
    : KPI_DELTA_DISCOUNT_COST;

  // ── Live Revenue Bridge (display layer — replaces module-level static array) ─
  // These are used by the bridge chart and table only.  The simulator reads
  // BASE_NET_REVENUE / BASE_NET_RETAINED from the module-level constants above.
  const liveRevBridge = [
    { name: "Gross Revenue", invisible: 0,                          value: Math.round(liveGrossRevenueDisplay),  type: "base"     },
    { name: "Discounts",     invisible: Math.round(liveNetRevenueDisplay),  value: Math.round(liveDiscountCostDisplay),  type: "negative" },
    { name: "Net Revenue",   invisible: 0,                          value: Math.round(liveNetRevenueDisplay),   type: "result"   },
    { name: "Returns",       invisible: Math.round(liveNetRetainedDisplay), value: Math.round(liveReturnsImpactDisplay), type: "negative" },
    { name: "Net Retained",  invisible: 0,                          value: Math.round(liveNetRetainedDisplay),  type: "result"   },
  ];

  const liveRevBridgeTable = [
    { step: "Gross revenue",        amount:  Math.round(liveGrossRevenueDisplay),  meaning: "Sales before discounts and returns",                       positive: true,  isResult: false },
    { step: "Discounts applied",    amount: -Math.round(liveDiscountCostDisplay),  meaning: "Revenue given away through promotions and discount codes", positive: false, isResult: false },
    { step: "Net realised revenue", amount:  Math.round(liveNetRevenueDisplay),    meaning: "Revenue retained after discounts",                        positive: true,  isResult: true  },
    { step: "Returns impact",       amount: -Math.round(liveReturnsImpactDisplay), meaning: "Revenue and contribution lost through returned orders",    positive: false, isResult: false },
    { step: "Net retained revenue", amount:  Math.round(liveNetRetainedDisplay),   meaning: "Revenue retained after discounts and returns",            positive: true,  isResult: true  },
  ];

  // ── Live Leakage Data (display layer) ─────────────────────────────────────
  // Discounts and Returns rows are live; Shipping subsidy and Payment fees
  // remain static (no RPC for these cost lines in Phase 1/2).
  const liveLeakageData = [
    { name: "Discounts",        value: Math.round(liveDiscountCostDisplay)  },
    { name: "Returns",          value: Math.round(liveReturnsImpactDisplay) },
    { name: "Shipping subsidy", value: 11_000 },
    { name: "Payment fees",     value: 9_000  },
  ];

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
      ? "This scenario creates pricing risk. Discounting or conversion pressure is likely to reduce contribution materially."
      : contribDelta >= 0
        ? "This scenario strengthens contribution because improved pricing more than offsets any volume impact."
        : "This scenario weakens contribution because volume loss, returns or discounting absorb margin.";

  const simColor =
    projContribution < 150_000
      ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400"
      : contribDelta >= 0
        ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400"
        : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400";

  const SimIcon = projContribution < 150_000 ? AlertTriangle : contribDelta >= 0 ? TrendingUp : TrendingDown;

  const slidersActive = discountChange !== 0 || fullPriceChange !== 0 || convChange !== 0 || returnsChange !== 0 || shippingChange !== 0;

  const rankingItems = [
    {
      label:    "Average discount",
      impact:   discountChange  !== 0 ? Math.abs(discountEffect)   : 38_000,
      positive: discountChange  === 0 ? true : discountEffect  >= 0,
    },
    {
      label:    "Full-price order ratio",
      impact:   fullPriceChange !== 0 ? Math.abs(fullPriceEffect)  : 26_000,
      positive: fullPriceChange === 0 ? true : fullPriceEffect >= 0,
    },
    {
      label:    "Returns rate",
      impact:   returnsChange   !== 0 ? Math.abs(returnsEffect)    : 18_000,
      positive: returnsChange   === 0 ? true : returnsEffect   >= 0,
    },
    {
      label:    "Conversion rate",
      impact:   convChange      !== 0 ? Math.abs(convEffect)        : 14_000,
      positive: convChange      === 0 ? true : convEffect       >= 0,
    },
    {
      label:    "Shipping subsidy",
      impact:   shippingChange  !== 0 ? Math.abs(shippingEffect)   : 11_000,
      positive: shippingChange  === 0 ? true : shippingEffect  >= 0,
    },
  ].sort((a, b) => b.impact - a.impact);

  return (
    <AppLayout>
      {/* ── Page header ── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Pricing & Discount Optimisation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            See how pricing, discounting and returns affect contribution — and how much profit you could recover without increasing traffic.
          </p>
          <DataPeriodLabel periodLabel={pricingPeriodLabel} loading={pricingPeriodLoading} />
        </div>
        <TimelineSelector />
      </div>

      {/* ── 1. Top CFO Insight ── */}
      {/* @dynamic Narrative text is static — update when live driver attribution is available */}
      <div className="mb-6">
        <CfoInsightCard text="Discounting is currently the largest drag on margin. Reducing the average discount by 3pp would increase contribution by approximately £38k per month without requiring additional traffic." />
      </div>

      <AiCfoAskCard pageId="pricing" />

      {/* ── 2. Pricing Power Risk Level ── */}
      <div className="flex items-start gap-4 p-5 rounded-2xl border border-[#F59E0B]/30 bg-[#182A4A] mb-4">
        <div className="w-9 h-9 rounded-xl bg-[#F59E0B]/15 flex items-center justify-center shrink-0">
          <Shield className="w-4 h-4 text-[#F59E0B]" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#F59E0B]">Pricing Power Level</p>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#F59E0B]/20 text-[#F59E0B]">
              Moderate
            </span>
          </div>
          <p className="text-sm text-[#A9B8D3] leading-relaxed">
            Pricing power is stable, but promotional reliance is increasing and could weaken margin if it continues.
          </p>
        </div>
      </div>

      {/* ── 3. Contribution Recovery Opportunity ── */}
      <div className="sc-teal flex items-start gap-3 px-5 py-4 rounded-2xl mb-4">
        <Target className="w-4 h-4 text-[#22D3EE] shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-[#22D3EE] mb-0.5">Recoverable Contribution Opportunity</p>
          <p className="text-sm text-cyan-300/80 leading-relaxed">
            Approximately £52k of monthly contribution could be recovered through better discount control, improved full-price sales and lower returns.
          </p>
        </div>
      </div>

      {/* ── 3b. Recovery Confidence Band ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="sc-green flex items-start gap-3 px-5 py-4 rounded-2xl">
          <CheckCircle className="w-4 h-4 text-[#34D399] shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[#34D399]">High confidence</p>
                <span className="text-sm font-bold text-[#34D399]">£38,000</span>
              </div>
              <ConfidenceBadge level="High" helper="Based on direct Shopify and cost data." />
            </div>
            <p className="text-xs text-emerald-300/80 leading-relaxed">Recoverable by reducing average discount by 3pp with limited conversion risk.</p>
          </div>
        </div>
        <div className="sc-amber flex items-start gap-3 px-5 py-4 rounded-2xl">
          <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-bold uppercase tracking-wider text-[#F59E0B]">Test carefully</p>
              <span className="text-sm font-bold text-[#F59E0B]">£14,000</span>
            </div>
            <p className="text-xs text-amber-300/80 leading-relaxed">Additional opportunity from targeted offers, shipping subsidy and returns improvements.</p>
          </div>
        </div>
      </div>

      {/* ── 4. Pricing Trend bar ── */}
      <div className="sc-orange flex items-center gap-3 px-5 py-3 rounded-xl mb-4">
        <TrendingDown className="w-4 h-4 text-[#FB923C] shrink-0" />
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-[#FB923C]">Pricing Trend: Margin under pressure</span>
          <span className="text-xs text-orange-300/70">Average discount increased by 3pp and full-price orders fell from 52% to 46%.</span>
        </div>
      </div>

      {/* ── 5. KPI Strip (8 cards, 4-column) ── */}
      {/*
        Cards with live data (Phase 1 + Phase 2 delta RPC):
          • Average Discount   — value: discount_dependency() × 100
                                 delta: discount_dep_delta_pp
          • Discount Cost      — value: discount_dependency × gross_revenue
                                 delta: derived from _cur/_prv raw fields
          • Returns Impact     — value: refund_rate × gross_revenue
                                 delta: derived from _cur/_prv raw fields
        Cards that remain static (SF):
          • Average Selling Price  — AOV ≠ ASP; substitution would mislabel metric
          • Full-Price Order Ratio — no RPC
          • Contribution per Order — depends on order count (no reliable count RPC)
          • Pricing Power Index    — qualitative composite
          • Recoverable Contrib    — scenario aggregate, different concept from
                                     recoverable_contribution_range() RPC
      */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {/* SF — ASP: AOV ≠ ASP, substitution would mislabel */}
        <KpiCard
          label="Average Selling Price"
          value="£42.60"
          delta="-£1.20"
          sentiment={deltaToSentiment(KPI_DELTA_ASP, DELTA_POLARITY.asp)}
          insight="Average realised price per order after discounts."
        />
        {/* LIVE — Avg Discount % from discount_dependency() RPC */}
        <KpiCard
          label="Average Discount"
          value={`${Math.round(liveAvgDiscountPctDisplay)}%`}
          delta={liveAvgDiscountDeltaStr}
          sentiment={liveAvgDiscountSentiment}
          insight="Average discount given across orders."
        />
        {/* SF — Full-Price Ratio: no RPC */}
        <KpiCard
          label="Full-Price Order Ratio"
          value="46%"
          delta="-6pp"
          sentiment={deltaToSentiment(KPI_DELTA_FULL_PRICE_RATIO, DELTA_POLARITY.fullPriceRatio)}
          insight="Orders completed without discount."
        />
        {/* SF — CPO: depends on order count (no reliable RPC) */}
        <KpiCard
          label="Contribution per Order"
          value="£12.40"
          delta="-£2.10"
          sentiment={deltaToSentiment(KPI_DELTA_CONTRIB_PER_ORDER, DELTA_POLARITY.cpPerOrder)}
          insight="Profit before overheads generated per order."
        />
        {/* LIVE — Discount Cost from discount_dependency × gross_revenue */}
        <KpiCard
          label="Discount Cost"
          value={`£${Math.round(liveDiscountCostDisplay).toLocaleString("en-GB")}`}
          delta={liveDiscountCostDeltaStr}
          sentiment={liveDiscountCostSentiment}
          insight="Revenue given away through promotions and discount codes."
        />
        {/* LIVE — Returns Impact from refund_rate × gross_revenue */}
        <KpiCard
          label="Returns Impact"
          value={`£${Math.round(liveReturnsImpactDisplay).toLocaleString("en-GB")}`}
          delta={liveReturnsImpactDeltaStr}
          sentiment={liveReturnsImpactSentiment}
          insight="Contribution lost through returned orders."
        />
        {/* SF — Pricing Power Index: qualitative composite */}
        <KpiCard
          label="Pricing Power Index"
          value="Moderate"
          delta="Stable"
          sentiment="neutral"
          insight="Based on discount reliance, full-price mix and contribution stability."
        />
        {/* SF — Recoverable Contribution: scenario aggregate, not opportunity-engine RPC */}
        <KpiCard
          label="Recoverable Contribution"
          value="£52,000"
          delta="+£11,000"
          sentiment={deltaToSentiment(KPI_DELTA_RECOVERABLE_CONTRIB, DELTA_POLARITY.recoverableContrib)}
          insight="Estimated monthly contribution recoverable through pricing improvements."
        />
      </div>

      {/* ── 5b. Discount Increase Impact micro-card ── */}
      {/* LIVE — uses same derived delta as Discount Cost KPI card */}
      <div className="sc-orange flex items-start gap-3 px-5 py-4 rounded-2xl mb-6">
        <AlertTriangle className="w-4 h-4 text-[#FB923C] shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <p className="text-xs font-bold uppercase tracking-wider text-[#FB923C]">Margin lost to discount increase</p>
            <span className="text-lg font-display font-bold text-[#FB923C]">
              £{liveDiscountIncrease.toLocaleString("en-GB")}
            </span>
          </div>
          <p className="text-xs text-orange-300/80 leading-relaxed">The increase in discounting vs the prior period reduced contribution by approximately £{Math.round(liveDiscountIncrease / 1_000)}k this month.</p>
        </div>
      </div>

      {/* ── Free only: upgrade narrative ── */}
      {!isPro && (
        <div className="mb-8 rounded-2xl border border-indigo-200 dark:border-indigo-700/50 bg-gradient-to-br from-indigo-50 to-indigo-50/30 dark:from-indigo-950/40 dark:to-indigo-950/10 shadow-sm overflow-hidden">
          <div className="px-6 py-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">Unlock your pricing action plan</p>
                <p className="text-sm text-indigo-800/80 dark:text-indigo-300/80 mt-1 leading-relaxed">
                  Upgrade to Pro to move from seeing margin leakage to actively improving contribution.
                </p>
              </div>
            </div>
            <ul className="space-y-1.5 mb-5 pl-1">
              {[
                "Model pricing and discount scenarios",
                "See which pricing lever has the biggest £ impact",
                "Understand what moved contribution this month",
                "Get priority pricing actions",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <CheckCircle className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                  <span className="text-sm text-indigo-800 dark:text-indigo-300">{item}</span>
                </li>
              ))}
            </ul>
            <a href="/upgrade" className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md hover:opacity-90 transition-opacity">
              <Sparkles className="w-4 h-4" />
              Unlock Pro
            </a>
          </div>
        </div>
      )}

      {/* ── 6. What Would Improve Margin Fastest? ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50">
          <h3 className="font-semibold text-lg text-foreground">What Would Improve Margin Fastest?</h3>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-foreground leading-relaxed">
            The fastest route to higher contribution is to reduce discount depth, increase full-price orders and reduce returns on discounted sales.
          </p>
          <ul className="space-y-2">
            {[
              "Reduce average discount from 18% to 15%",
              "Increase full-price order ratio by 6pp",
              "Reduce returns on discounted orders by 2pp",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-foreground font-medium">
            Together, these changes could increase contribution by approximately £42k per month.
          </p>
        </div>
      </div>

      {/* ── 7. Discount Impact Analysis ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50">
          <h3 className="font-semibold text-lg text-foreground">Discount Impact Analysis</h3>
          <p className="text-sm text-muted-foreground mt-0.5">See how gross sales reduce through discounts and returns before becoming realised revenue.</p>
        </div>
        <div className="px-6 pt-5 pb-2">
          {/* @dynamic: "15%" is static — update when live ratio is templated into narrative */}
          <InlineCfoInsight text="Discounts reduced realised revenue by 15% this month. This is the largest single pricing-related margin leakage." />
        </div>

        {/* Data quality note */}
        <div className="px-6 pb-2">
          <div className="flex items-start gap-2.5 rounded-xl border border-border/40 bg-secondary/30 px-4 py-3">
            <Info className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Data quality note</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This analysis assumes discounts are recorded using Shopify discount codes or compare-at pricing. If product list prices are manually reduced instead, discount impact may be understated.
              </p>
              <p className="text-xs text-muted-foreground/70 leading-relaxed mt-1">
                If your store frequently adjusts list prices instead of applying discounts, some pricing insights may be conservative.
              </p>
            </div>
          </div>
        </div>

        {/* Bridge waterfall chart — LIVE (liveRevBridge computed from Phase 1 RPCs) */}
        <div className="px-6 pt-4 pb-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Revenue Bridge: Gross to Net Retained</h4>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={liveRevBridge} margin={{ top: 4, right: 24, left: 0, bottom: 0 }} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `£${(v / 1_000).toFixed(0)}k`}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<RevBridgeTooltip />} />
                <Bar dataKey="invisible" stackId="a" fill="transparent" />
                <Bar dataKey="value" stackId="a" radius={[4, 4, 0, 0]}>
                  {liveRevBridge.map((entry) => (
                    <Cell key={entry.name} fill={REV_BRIDGE_COLOR[entry.type]} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bridge table — LIVE */}
        <div className="overflow-x-auto px-0 pb-4 mt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-secondary/40">
                <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Step</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">What it means</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {liveRevBridgeTable.map((row) => (
                <tr key={row.step} className={cn(
                  "transition-colors",
                  row.isResult
                    ? "bg-indigo-50/50 dark:bg-indigo-950/10 border-t border-indigo-200/60 dark:border-indigo-800/30"
                    : "hover:bg-secondary/20",
                )}>
                  <td className={cn("px-6 py-3 text-sm", row.isResult ? "font-semibold text-foreground" : "font-medium text-foreground")}>{row.step}</td>
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
        <p className="text-xs text-muted-foreground/60 italic px-6 pb-5">
          The goal is not just to increase sales — it is to retain more value from each sale.
        </p>
      </div>

      {/* ── 8. Contribution Leakage Detector ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50">
          <h3 className="font-semibold text-lg text-foreground">Contribution Leakage Detector</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Shows where contribution is disappearing before it reaches profit.</p>
        </div>
        <div className="px-6 pt-5 pb-2">
          <InlineCfoInsight text="Discounting accounts for 71% of contribution leakage this month, making it the highest-priority margin lever." />
        </div>
        {/* Leakage inline tiles — Discounts and Returns are LIVE */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 pt-4 pb-2">
          {[
            {
              label: "Discount Leakage",
              value: `£${Math.round(liveDiscountCostDisplay).toLocaleString("en-GB")}`,
              text: "Largest contributor to margin leakage this month.",
              color: "red",
            },
            {
              label: "Returns Leakage",
              value: `£${Math.round(liveReturnsImpactDisplay).toLocaleString("en-GB")}`,
              text: "Returned orders reduced net retained revenue and contribution.",
              color: "orange",
            },
            {
              label: "Shipping Subsidy",
              value: "£11,000",
              text: "Free or subsidised shipping reduced contribution.",
              color: "amber",
            },
            {
              label: "Payment Fee Leakage",
              value: "£9,000",
              text: "Payment processing costs reduced contribution.",
              color: "yellow",
            },
          ].map(({ label, value, text, color }) => (
            <div key={label} className={cn(
              "rounded-2xl border p-4",
              color === "red"    ? "border-red-200 dark:border-red-800/40 bg-red-50/60 dark:bg-red-950/15" :
              color === "orange" ? "border-orange-200 dark:border-orange-800/40 bg-orange-50/60 dark:bg-orange-950/15" :
              color === "amber"  ? "border-amber-200 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-950/15" :
                                   "border-yellow-200 dark:border-yellow-800/40 bg-yellow-50/60 dark:bg-yellow-950/15",
            )}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
              <p className="text-2xl font-display font-bold text-foreground mb-1">{value}</p>
              <p className="text-[11px] text-muted-foreground leading-snug">{text}</p>
            </div>
          ))}
        </div>
        {/* Leakage bar chart — Discounts/Returns rows are LIVE; Shipping/Payment are SF */}
        <div className="px-6 pb-6 pt-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Leakage by Category</h4>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={liveLeakageData} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `£${(v / 1_000).toFixed(0)}k`}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={120}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip content={<LeakageTooltip />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {liveLeakageData.map((_, i) => (
                    <Cell key={i} fill={LEAKAGE_COLORS[i]} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── 9. Discount Dependence Risk ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50">
          <h3 className="font-semibold text-lg text-foreground">Discount Dependence Risk</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Shows how reliant the business is on promotions to generate sales.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 py-5">
          {[
            {
              label: "Discount Dependence Level",
              value: "Moderate",
              text: "41% of orders currently use a discount code or promotion.",
              color: "amber",
            },
            {
              label: "Promotion Frequency",
              value: "High",
              text: "Promotions were active on 19 days this month.",
              color: "red",
            },
            {
              label: "Full-Price Resilience",
              value: "Weakening",
              text: "Full-price order ratio fell from 52% to 46%.",
              color: "red",
            },
          ].map(({ label, value, text, color }) => (
            <div key={label} className={cn(
              "rounded-2xl border p-5",
              color === "amber"
                ? "border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/10"
                : "border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-950/10",
            )}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
              <p className={cn(
                "text-2xl font-display font-bold mb-1",
                color === "amber" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400",
              )}>{value}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
        <div className="px-6 pb-5">
          <InlineCfoInsight text="Discount reliance is increasing. If this continues, customers may be trained to wait for promotions, making future full-price conversion harder." />
        </div>
      </div>

      {/* ── 10. Price vs Volume Trade-off Analysis — Pro gated ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg text-foreground">Price vs Volume Trade-off</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Estimate whether reducing discounts improves contribution even if sales volume falls.</p>
          </div>
          {!isPro && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider whitespace-nowrap shrink-0">PRO</span>}
        </div>
        {canAccess("pricing_trade_off") ? (
          <div className="px-6 py-5">
            <div className="mb-5">
              <InlineCfoInsight text="Reducing average discount by 3pp is expected to improve contribution even after allowing for a small fall in conversion." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Scenario",          value: "Reduce discount 3pp", color: "indigo",  highlight: false, sub: undefined,    annualised: undefined           },
                { label: "Contribution Gain", value: "+£38,000",            color: "emerald", highlight: true,  sub: "(30 days)",  annualised: "+£456,000 (annualised)" },
                { label: "Revenue Risk",      value: "(£12,000)",           color: "red",     highlight: true,  sub: "(30 days)",  annualised: undefined           },
                { label: "Net Improvement",   value: "+£26,000",            color: "emerald", highlight: true,  sub: "(30 days)",  annualised: undefined           },
              ].map(({ label, value, color, highlight, sub, annualised }) => (
                <div key={label} className={cn(
                  "rounded-2xl border p-5",
                  highlight && color === "emerald" ? "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/15" :
                  highlight && color === "red"     ? "border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-950/15" :
                                                    "border-border/50 bg-secondary/20",
                )}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
                  <p className={cn(
                    "text-xl font-display font-bold leading-none",
                    color === "emerald" ? "text-emerald-600 dark:text-emerald-400" :
                    color === "red"     ? "text-red-600 dark:text-red-400" :
                                          "text-foreground",
                  )}>{value}</p>
                  {sub       && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
                  {annualised && <p className="text-[10px] text-muted-foreground/70 tabular-nums mt-0.5">{annualised}</p>}
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-4 italic">
              Contribution improves because the margin gained from lower discounting outweighs the expected volume risk.
            </p>
          </div>
        ) : (
          <div className="px-6 py-5">
            <div className="blur-sm opacity-30 pointer-events-none select-none grid grid-cols-4 gap-4 mb-4" aria-hidden>
              {["Scenario", "Contribution Gain", "Revenue Risk", "Net Improvement"].map((l) => (
                <div key={l} className="h-20 bg-secondary rounded-2xl" />
              ))}
            </div>
            <UpgradeCta
              title="Upgrade to Pro to estimate how conversion would change if discounts fall"
              description="See whether reducing discounts improves contribution even after accounting for volume impact."
            />
          </div>
        )}
      </div>

      {/* ── 11. Pricing Sensitivity Simulator — Pro gated ── */}
      {/*
        SIMULATOR GUARD: All projected values below (projContribution, projRevenue,
        projContribMargin, pricingRisk) are computed from the static scenario constants
        (BASE_CONTRIBUTION = 198k, BASE_NET_REVENUE = 356k, GROSS_REVENUE = 420k).
        The simulator is intentionally NOT connected to the live monthly data shown
        in the KPI strip above — it operates as a modelling tool on a reference
        scenario basis.  Do not pass live* values into the simulator maths.
      */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg text-foreground">Pricing Sensitivity Simulator</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Test how changes in discounts, full-price orders and returns affect contribution.</p>
          </div>
          {!isPro && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider whitespace-nowrap shrink-0">PRO</span>}
        </div>

        {isPro ? (
          <div className="px-6 py-6">
            <div className="mb-5">
              <InlineCfoInsight text="Contribution is currently most sensitive to discount depth and full-price order mix. Use this tool before changing promotional strategy." />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Sliders */}
              <div className="space-y-6">
                <SimulatorSlider label="Average Discount Change"      value={discountChange}  min={-8}  max={8}  step={0.5} unit="pp"  showSign onChange={setDiscountChange}  positiveIsGood={false} description="Reducing discount improves retained revenue" />
                <SimulatorSlider label="Full-Price Order Ratio Change" value={fullPriceChange} min={-15} max={20} step={1}   unit="pp"  showSign onChange={setFullPriceChange} positiveIsGood={true}  description="More full-price orders improve contribution" />
                <SimulatorSlider label="Conversion Rate Impact"       value={convChange}      min={-15} max={10} step={0.5} unit="%"   showSign onChange={setConvChange}      positiveIsGood={true}  description="Conversion change affects revenue and contribution" />
                <SimulatorSlider label="Returns Rate Change"          value={returnsChange}   min={-5}  max={5}  step={0.5} unit="pp"  showSign onChange={setReturnsChange}   positiveIsGood={false} description="Lower returns preserve contribution" />
                <SimulatorSlider label="Shipping Subsidy Change"      value={shippingChange}  min={-30} max={30} step={1}   unit="%"   showSign onChange={setShippingChange}  positiveIsGood={false} description="Higher subsidy reduces contribution" />
              </div>

              {/* Outputs */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Projected Outcomes</h4>
                <div className="space-y-2">
                  {[
                    { label: "Projected Revenue",             value: `£${Math.round(projRevenue).toLocaleString()}`, highlight: true,  isPeriod: false },
                    { label: "Projected Contribution",        value: fmt(projContribution),                           highlight: true,  isPeriod: false },
                    { label: "Contribution Movement vs Base", value: "",                                              highlight: true,  isPeriod: true  },
                    { label: "Projected Contribution Margin", value: `${projContribMargin.toFixed(1)}%`,              highlight: false, isPeriod: false },
                    { label: "Pricing Risk Level",            value: pricingRisk,                                     highlight: false, isPeriod: false },
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

                {/* Fastest lever */}
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50/60 dark:bg-indigo-950/15 px-4 py-3 flex items-start gap-2.5">
                  <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 mb-0.5">Fastest lever to improve contribution</p>
                    <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">Reducing average discount by 3pp would increase contribution by approximately £38k.</p>
                  </div>
                </div>

                {/* Safest lever */}
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/15 px-4 py-3 flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-0.5">Safest lever to improve contribution</p>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">Reducing shipping subsidy by 10% improves contribution with lower conversion risk than changing headline discounts.</p>
                  </div>
                </div>

                {/* Dynamic interpretation */}
                <div className={cn("rounded-xl border px-4 py-3 flex items-start gap-2.5", simColor)}>
                  <SimIcon className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed font-medium">{simText}</p>
                </div>

                {(discountChange !== 0 || fullPriceChange !== 0 || convChange !== 0 || returnsChange !== 0 || shippingChange !== 0) && (
                  <button
                    onClick={() => { setDiscountChange(0); setFullPriceChange(0); setConvChange(0); setReturnsChange(0); setShippingChange(0); }}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline mt-1"
                  >
                    Reset to base case
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
              title="Model pricing and discount scenarios to find your fastest margin lever"
              description="Test how changes to discounts, full-price mix, conversion and shipping subsidy affect contribution before you commit."
            />
          </div>
        )}
      </div>

      {/* ── 12. Pricing Sensitivity Ranking — Pro gated ── */}
      <div className="mb-6 rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ListOrdered className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">Pricing Sensitivity Ranking</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {canAccess("pricing_sensitivity_ranking") && slidersActive
                  ? "Ranked by current simulator impact — re-sorted as sliders move."
                  : "What affects your contribution most?"}
              </p>
            </div>
          </div>
          {!canAccess("pricing_sensitivity_ranking") && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider whitespace-nowrap shrink-0">PRO</span>
          )}
        </div>

        {canAccess("pricing_sensitivity_ranking") ? (
          /* ── Pro: live ranked list ── */
          <div className="px-5 py-4">
            <ol className="space-y-3">
              {rankingItems.map((item, i) => (
                <li key={item.label} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm text-foreground flex-1">{item.label}</span>
                  <PeriodImpact
                    value={item.impact}
                    positive={item.positive}
                    className="items-end shrink-0"
                  />
                </li>
              ))}
            </ol>
            <p className="text-[11px] text-muted-foreground/60 mt-3 leading-snug">
              {slidersActive
                ? "Showing impact of current simulator settings. Positive = contribution improves."
                : "Showing maximum recoverable contribution per lever at baseline."}
            </p>
          </div>
        ) : (
          /* ── Free: blurred preview + upgrade CTA ── */
          <div className="px-5 py-4">
            <div className="relative mb-4">
              <ol className="space-y-3 blur-[3px] opacity-40 pointer-events-none select-none" aria-hidden>
                {[
                  { label: "Average discount",       v1: "+£38,000", v2: "+£456,000" },
                  { label: "Full-price order ratio",  v1: "+£26,000", v2: "+£312,000" },
                  { label: "Returns rate",            v1: "+£18,000", v2: "+£216,000" },
                  { label: "Conversion rate",         v1: "+£14,000", v2: "+£168,000" },
                  { label: "Shipping subsidy",        v1: "+£11,000", v2: "+£132,000" },
                ].map((item, i) => (
                  <li key={item.label} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">{i + 1}</span>
                    <span className="text-sm text-foreground flex-1">{item.label}</span>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-bold text-sm text-emerald-600">{item.v1} <span className="font-normal text-[11px] text-muted-foreground">(30 days)</span></span>
                      <span className="text-[10px] text-muted-foreground/80">{item.v2} (annualised)</span>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent rounded-b-xl" />
            </div>
            <a href="/upgrade" className="flex items-center gap-3 rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/90 dark:bg-indigo-950/40 px-4 py-3 hover:border-indigo-300 transition-colors">
              <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="text-xs text-indigo-800 dark:text-indigo-200 flex-1">Upgrade to Pro to see which pricing lever creates the biggest £ impact — updates live as you move sliders.</span>
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap shrink-0">Upgrade →</span>
            </a>
          </div>
        )}
      </div>

      {/* ── 13. What Changed Contribution This Month? — Pro gated ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg text-foreground">What Changed Contribution This Month?</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Contribution fell by £24k this month. Here are the main pricing drivers.</p>
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
              title="Upgrade to Pro to see exactly what moved contribution this month"
              description="See every pricing driver with £ impact and a plain-English explanation of what happened."
            />
          </div>
        )}
      </div>

      {/* ── 14. Pricing Power Trend ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg text-foreground">Pricing Power Trend</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Shows whether the business is becoming more or less reliant on discounting.</p>
          </div>
          {!canAccess("pricing_trend_chart") && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider whitespace-nowrap shrink-0">PRO</span>}
        </div>

        {canAccess("pricing_trend_chart") ? (
          <div className="px-6 py-5">
            <InlineCfoInsight text="Pricing power is weakening because discounting is rising while full-price order ratio and contribution per order are falling." />
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
                <p className="text-xs font-bold text-orange-800 dark:text-orange-300 mb-0.5">Promotion frequency increased (Mar–Apr)</p>
                <p className="text-xs text-orange-700/80 dark:text-orange-400/75 leading-relaxed">Discounting began rising faster after promotional activity increased.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-950/15">
              <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              <span className="text-sm font-bold text-red-800 dark:text-red-300">Pricing Power Trend: Weakening</span>
            </div>
            <UpgradeCta
              title="Upgrade to Pro to see pricing power trends over time"
              description="Track average discount, full-price order ratio and contribution per order across 6 reporting periods."
            />
          </div>
        )}
      </div>

      {/* ── 15. Free teaser ── */}
      {!isProRec && (
        <div className="mb-4 flex items-center gap-2.5 px-5 py-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50/60 dark:bg-indigo-950/15">
          <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <p className="text-sm text-indigo-800 dark:text-indigo-300">
            <span className="font-semibold">One pricing action could increase contribution this month.</span>{" "}
            Upgrade to Pro to see the full recommendations.
          </p>
        </div>
      )}

      {/* ── 16. This Month's Pricing Priorities — Pro gated ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg text-foreground">This Month's Pricing Priorities</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Three priority actions your CFO would give you based on this month's pricing data.</p>
          </div>
          {!isProRec && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider whitespace-nowrap shrink-0">PRO</span>}
        </div>

        {isProRec ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/20 p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">What Improved</p>
              </div>
              <p className="text-sm text-emerald-700/85 dark:text-emerald-400/85 leading-relaxed">
                Product mix improved this month, adding £12k of contribution and partly offsetting discount pressure.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">What To Watch</p>
              </div>
              <p className="text-sm text-amber-700/85 dark:text-amber-400/85 leading-relaxed">
                Average discount increased to 18%, while full-price orders fell to 46%. This indicates rising promotional dependence.
              </p>
            </div>
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-950/20 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">Recommended Action</p>
              </div>
              <p className="text-sm text-indigo-700/85 dark:text-indigo-400/85 leading-relaxed">
                Reduce blanket discounting, test smaller targeted offers and protect full-price conversion before increasing promotional frequency.
              </p>
            </div>
          </div>
        ) : (
          <div className="px-6 py-6">
            <div className="blur-sm opacity-40 pointer-events-none select-none grid grid-cols-1 md:grid-cols-3 gap-4 mb-4" aria-hidden>
              {["What Improved", "What To Watch", "Recommended Action"].map((t) => (
                <div key={t} className="rounded-2xl border border-border/40 bg-secondary/30 p-5 h-28" />
              ))}
            </div>
            <UpgradeCta
              title="Unlock this month's Pricing Priorities"
              description="Get three high-priority pricing actions — what improved, what to watch, and what to do next."
            />
          </div>
        )}
      </div>

      <DataBenchmarkAssumptions
        benchmarkNote="Discount dependency is measured as total discount value divided by gross revenue (value-based ratio). Shipping subsidy and payment fee leakage figures are static estimates — not yet connected to live cost data."
        dataQualityNote="Discount analysis assumes discounts are recorded using Shopify discount codes or compare-at pricing. Manual price changes may understate discount impact. Returns Impact shows revenue refunded via Shopify; fulfilment cost on returns is not included in the live figure."
        className="mb-2"
      />

    </AppLayout>
  );
}
