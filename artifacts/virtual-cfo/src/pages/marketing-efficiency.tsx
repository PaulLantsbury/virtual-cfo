import { useState, useEffect } from "react";
import { Sparkles, Lock, SlidersHorizontal, Info, Zap, Shield } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { AppLayout } from "@/components/layout/AppLayout";
import { canAccess } from "@/lib/plan";
import { useTimeline } from "@/lib/timeline";
import { TimelineSelector } from "@/components/TimelineSelector";
import { cn } from "@/lib/utils";
import { DataBenchmarkAssumptions } from "@/components/DataBenchmarkAssumptions";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { AiCfoAskCard } from "@/components/AiCfoAskCard";
import { PeriodImpact } from "@/components/PeriodImpact";
import {
  BLENDED_CAC,
  BLENDED_CAC_PREV,
  BLENDED_CAC_LY,
  BLENDED_ROAS,
  BLENDED_ROAS_PREV,
  BLENDED_ROAS_LY,
  CHANNEL_CM_PCT,
  CAC_BY_CHANNEL,
  PAYBACK_BY_CHANNEL,
} from "@/lib/data/channel-metrics";
import {
  getMarketingChannelMetrics,
  findChannel,
  getCacTrendForChannel,
  totalOpportunityUplift,
  type ChannelMonthlyMetrics,
  type BlendedMarketingPerformance,
  type ChannelOpportunity,
  type CacTrendPoint,
} from "@/lib/analytics/marketingChannelMetrics";
import { CAC_PAYBACK, CAC_PAYBACK_PREV, DISCOUNT_DEP, REPEAT_RATE } from "@/lib/data/growth-metrics";
import { useLatestDataPeriod } from "@/lib/analytics/useLatestDataPeriod";
import { DataPeriodLabel } from "@/components/DataPeriodLabel";
import { deltaToSentiment, DELTA_POLARITY, type DeltaSentiment } from "@/lib/analytics/deltaSentiment";

// ── Phase 1 metrics config ────────────────────────────────────────────────────
// DEV-ONLY — hardcoded seed store UUID. Matches dashboard.tsx and margin-analysis.tsx.
// Must be replaced with the authenticated session's store_id before multi-tenant use.
// Date range is resolved dynamically by useLatestDataPeriod() inside the component.
const ME_STORE_ID = "10000000-0000-0000-0000-000000000001";

// ─── Data constants ───────────────────────────────────────────────────────────
// BLENDED_CAC, BLENDED_ROAS, CAC_BY_CHANNEL, PAYBACK_BY_CHANNEL, CHANNEL_CM_PCT
//   imported from src/lib/data/channel-metrics.ts
// CAC_PAYBACK, CAC_PAYBACK_PREV
//   imported from src/lib/data/growth-metrics.ts

const BLENDED_ROAS_CHANGE_MOM = +(BLENDED_ROAS - BLENDED_ROAS_PREV).toFixed(1);
const BLENDED_ROAS_CHANGE_LY  = +(BLENDED_ROAS - BLENDED_ROAS_LY).toFixed(1);

const CAC_PAYBACK_LY = 1.0;    // 12-month average — page-specific, not shared

/**
 * Total contribution profit after all marketing costs for the selected period.
 * @dynamic revenueTotal minus attributed marketing costs
 */
const MKT_CP             = 38_400;
const MKT_CP_PREV        = 41_200;  // last month
const MKT_CP_LY          = 35_400;  // last 12-month average
const MKT_CP_CHANGE_MOM  = MKT_CP - MKT_CP_PREV;   // -2_800 (unfavourable)
const MKT_CP_CHANGE_LY   = MKT_CP - MKT_CP_LY;     // +3_000 (favourable)

/**
 * Recoverable contribution available if spend is reallocated toward higher-margin channels.
 * @dynamic Math.round(orderVolume × (cmGainPp / 100) × revenuePerOrder)
 */
const ESTIMATED_CONTRIBUTION = 18_200;
// Channel CM percentages imported from channel-metrics (shared with margin-analysis).
// Revenue figures remain local — they reflect the marketing-efficiency period basis.
/** @dynamic Replace with live channel-level margin data from Shopify + ad platforms */
const CHANNEL_CM = [
  { channel: "Email",           cm: CHANNEL_CM_PCT.email,          revenue: 18_200 },
  { channel: "Organic",         cm: CHANNEL_CM_PCT.organic,        revenue: 24_800 },
  { channel: "Google Shopping", cm: CHANNEL_CM_PCT.googleShopping, revenue: 42_600 },
  { channel: "Meta",            cm: CHANNEL_CM_PCT.meta,           revenue: 38_900 },
];

/**
 * Contribution profit (£) per acquisition channel for the current period.
 * @dynamic channel_revenue × (channel_cm / 100) — after channel-specific acquisition cost
 */
const CHANNEL_CP = [
  { channel: "Email",           cp: 12_400 },
  { channel: "Organic",        cp:  9_800 },
  { channel: "Google Shopping", cp:  6_200 },
  { channel: "Meta",            cp:  2_100 },
];

/**
 * Contribution profit generated per order by acquisition channel after marketing cost.
 * @dynamic channel_total_contribution / channel_order_count — per channel
 */
const CHANNEL_CPO = [
  { channel: "Email",           cpo: 14.20 },
  { channel: "Organic",         cpo: 12.10 },
  { channel: "Google Shopping", cpo:  6.80 },
  { channel: "Meta",            cpo:  2.30 },
];
const maxCpo = Math.max(...CHANNEL_CPO.map((c) => c.cpo));
const minCpo = Math.min(...CHANNEL_CPO.map((c) => c.cpo));

type EfficiencyRating = "strong" | "watch" | "weak";

// CAC_BY_CHANNEL and PAYBACK_BY_CHANNEL imported from channel-metrics.ts above.
// EfficiencyRating type kept local for JSX compatibility.

/**
 * @dynamic Compute from: orderVolume × (ppGain / 100) × revenuePerOrder
 * Reserved for reallocation scenario modelling.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const REALLOCATION = {
  metaShiftPct: 15,
  cmGainLow: 1,
  cmGainHigh: 3,
  cashLow: 10_000,
  cashHigh: 25_000,
} as const;

type Confidence = "high" | "medium" | "low";
type Effort     = "low" | "medium" | "high";

/**
 * Structured opportunity scenarios for the Marketing Efficiency page.
 * Each entry supports Free (name only) and Pro (full breakdown) display.
 * @dynamic Replace with live-computed values from ad platform + Shopify data.
 */
const ME_OPPORTUNITIES: {
  shortLabel: string;
  detail: string;
  ppGain: number;
  cashImpact: number;
  confidence: Confidence;
  effort: Effort;
}[] = [
  {
    shortLabel: "Reallocate Meta spend",
    detail: "Shift 15% of Meta budget toward Email and Organic to improve blended CAC and contribution margin.",
    ppGain: 1.4,
    cashImpact: 9_800,
    confidence: "high",
    effort: "low",
  },
  {
    shortLabel: "Increase lifecycle email conversion",
    detail: "Improve email automation coverage to convert more existing contacts into repeat buyers.",
    ppGain: 0.9,
    cashImpact: 5_600,
    confidence: "medium",
    effort: "medium",
  },
  {
    shortLabel: "Improve paid acquisition mix toward higher-contribution products",
    detail: "Focus Google Shopping campaigns on SKUs with above-average contribution margin to improve channel ROI.",
    ppGain: 0.7,
    cashImpact: 2_800,
    confidence: "medium",
    effort: "medium",
  },
];

/** @dynamic Sum of ppGain across ME_OPPORTUNITIES */
const ME_TOTAL_PP = +ME_OPPORTUNITIES.reduce((s, o) => s + o.ppGain, 0).toFixed(1);

const ACTION_GUIDANCE = [
  {
    why: "Meta CAC is now above the blended average, while Email and Organic generate stronger contribution per order.",
    steps: [
      "Pause the weakest Meta ad sets",
      "Protect campaigns with clear repeat-purchase intent",
      "Move 15% of Meta spend toward Email and Organic",
      "Review CAC payback weekly",
    ],
  },
  {
    why: "Existing customers are already warm, so lifecycle activity can recover contribution without relying on more paid acquisition.",
    steps: [
      "Prioritise abandoned browse, post-purchase and win-back flows",
      "Segment repeat customers from first-time buyer campaigns",
      "Measure repeat purchase contribution, not email revenue alone",
    ],
  },
  {
    why: "Some paid revenue is growing with weak contribution, so budget should follow products and campaigns with stronger margin quality.",
    steps: [
      "Identify SKUs with above-average contribution margin",
      "Shift paid acquisition toward those SKUs and campaigns",
      "Reduce spend where revenue grows but contribution per order stays weak",
    ],
  },
] as const;

/**
 * Attribution of the last-30-day change in marketing contribution profit.
 * @dynamic Generated from period-over-period channel and cost analysis.
 * Sorted by absolute £ impact descending.
 */
const ME_DRIVERS = [
  {
    driver:    "Meta CAC increase",
    cause:     "Blended CAC rose due to Meta audience saturation and higher auction competition",
    impact:    -6_400,
    direction: "negative" as const,
    category:  "acquisition-cost" as const,
  },
  {
    driver:    "Higher CPC across paid channels",
    cause:     "Cost-per-click rose across Google Shopping and Meta, compressing margin on paid orders",
    impact:    -900,
    direction: "negative" as const,
    category:  "acquisition-cost" as const,
  },
  {
    driver:    "Discount-led traffic mix",
    cause:     "Higher discount depth shifted order mix toward low-margin SKUs",
    impact:    -3_100,
    direction: "negative" as const,
    category:  "mix" as const,
  },
  {
    driver:    "Lower repeat-customer share",
    cause:     "Repeat purchase rate declined, increasing reliance on expensive new customer acquisition",
    impact:    -2_200,
    direction: "negative" as const,
    category:  "structural" as const,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function VarLine({ label, value, sentiment }: { label: string; value: string; sentiment: DeltaSentiment | null }) {
  return (
    <div className={cn(
      "flex items-center gap-1 text-xs leading-none",
      sentiment === "positive" ? "text-emerald-600 dark:text-emerald-400" :
      sentiment === "negative" ? "text-destructive" :
      "text-muted-foreground",
    )}>
      <span className="font-semibold">{value}</span>
      <span className="text-muted-foreground font-normal">{label}</span>
    </div>
  );
}

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

/**
 * Three-band CAC payback classification used for channel badges and colouring.
 * Thresholds: Safe < 1.2 orders · Monitor 1.2–1.6 · Risk > 1.6
 */
function getPaybackBand(payback: number): {
  label: "Safe" | "Monitor" | "Risk";
  badgeCls: string;
  dotCls: string;
} {
  if (payback < 1.2) return {
    label: "Safe",
    badgeCls: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
    dotCls:   "bg-emerald-500",
  };
  if (payback <= 1.6) return {
    label: "Monitor",
    badgeCls: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
    dotCls:   "bg-amber-400",
  };
  return {
    label: "Risk",
    badgeCls: "bg-destructive/10 text-destructive",
    dotCls:   "bg-destructive",
  };
}

// ─── Timeline framing ─────────────────────────────────────────────────────────

const TIMELINE_FRAMING: Record<string, {
  upliftPhrase:  string;
  baselineNote:  string;
  rowLabel:      string;
  combinedLabel: string;
  /** Concise per-row sub-label shown beneath each £ impact figure */
  impactBasis:   string;
}> = {
  "7d":  {
    upliftPhrase:  "next month at current 7-day run rate",
    baselineNote:  "current 7-day run rate",
    rowLabel:      "next month",
    combinedLabel: "next month if implemented now",
    impactBasis:   "next month · 7-day run rate",
  },
  "30d": {
    upliftPhrase:  "next month at current 30-day run rate",
    baselineNote:  "current 30-day run rate",
    rowLabel:      "next month",
    combinedLabel: "next month if implemented now",
    impactBasis:   "next month · 30-day run rate",
  },
  "90d": {
    upliftPhrase:  "next month based on 90-day run rate",
    baselineNote:  "90-day run rate",
    rowLabel:      "next month",
    combinedLabel: "next month if implemented now",
    impactBasis:   "next month · 90-day run rate",
  },
  "12m": {
    upliftPhrase:  "based on trailing 12-month performance",
    baselineNote:  "trailing 12-month performance",
    rowLabel:      "projected",
    combinedLabel: "projected, if implemented now",
    impactBasis:   "projected · 12-month avg",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function MarketingEfficiency() {
  const { timeline } = useTimeline();
  const framing = TIMELINE_FRAMING[timeline] ?? TIMELINE_FRAMING["30d"];

  // ── Phase 1: live discount dependency and repeat purchase rate ────────────
  // Walks back from the current month to find the most recent month with data.
  // Only these two fields are used here — all other ME metrics require ad
  // platform data (Meta/Google Ads API) and remain static for now.
  const { phase1: mktPhase1, periodLabel: mePeriodLabel, loading: mePeriodLoading, dateFrom, dateTo } = useLatestDataPeriod(ME_STORE_ID);

  // Live discount dependency % (1 d.p.) — fallback to static DISCOUNT_DEP.
  const liveDiscountDep = mktPhase1
    ? (mktPhase1.data.discountDependency * 100).toFixed(1)
    : DISCOUNT_DEP.toFixed(1);

  // Live repeat purchase rate % (1 d.p.) — fallback to static REPEAT_RATE.
  const liveRepeatRate = mktPhase1
    ? (mktPhase1.data.repeatPurchaseRate * 100).toFixed(1)
    : REPEAT_RATE.toFixed(1);

  // Patch the two Phase-1-adjacent driver cause strings with live values.
  // Driver, impact, direction, and category remain untouched — only cause text
  // is updated for the visible commercial driver summary.
  const liveMeDrivers = ME_DRIVERS.map((d) => {
    if (d.driver === "Discount-led traffic mix") {
      return {
        ...d,
        cause: `Discount dependency at ${liveDiscountDep}% — higher discount depth shifted order mix toward low-margin SKUs`,
      };
    }
    if (d.driver === "Lower repeat-customer share") {
      return {
        ...d,
        cause: `Repeat purchase rate at ${liveRepeatRate}% — declining repeat share increases reliance on expensive new customer acquisition`,
      };
    }
    return d;
  });

  // ── Phase 3: live marketing channel metrics ────────────────────────────────
  // Calls four Supabase RPCs in parallel via getMarketingChannelMetrics().
  // Individual RPC failures are isolated — other fields remain intact.
  // All values fall back to static channel-metrics.ts constants if unavailable.
  const [liveChannels,      setLiveChannels]      = useState<ChannelMonthlyMetrics[]>([]);
  const [liveBlended,       setLiveBlended]       = useState<BlendedMarketingPerformance | null>(null);
  const [liveBlendedPrev,   setLiveBlendedPrev]   = useState<BlendedMarketingPerformance | null>(null);
  const [liveOpportunities, setLiveOpportunities] = useState<ChannelOpportunity[]>([]);
  const [liveCacTrend,      setLiveCacTrend]      = useState<CacTrendPoint[]>([]);

  useEffect(() => {
    if (mePeriodLoading) return;
    let cancelled = false;
    // Derive prior-period date range (one calendar month back) for blended CAC MoM.
    const d = new Date(dateFrom);
    d.setMonth(d.getMonth() - 1);
    const prevMo   = d.getMonth() + 1;
    const prevYr   = d.getFullYear();
    const prevFrom = `${prevYr}-${String(prevMo).padStart(2, "0")}-01`;
    const prevTo   = new Date(prevYr, prevMo, 0).toISOString().slice(0, 10);
    (async () => {
      const [curr, prev] = await Promise.all([
        getMarketingChannelMetrics(ME_STORE_ID, dateFrom, dateTo),
        getMarketingChannelMetrics(ME_STORE_ID, prevFrom, prevTo),
      ]);
      if (cancelled) return;
      setLiveChannels(curr.channels);
      setLiveBlended(curr.blended);
      setLiveBlendedPrev(prev.blended);
      setLiveOpportunities(curr.opportunities);
      setLiveCacTrend(curr.cacTrend);
    })();
    return () => { cancelled = true; };
  }, [mePeriodLoading, dateFrom, dateTo]);

  // ── Live computed values (Phase 3 — with static fallbacks) ─────────────────
  // Blended CAC: current and prior period from RPC.
  const liveBlendedCac     = liveBlended?.blendedCac     ?? BLENDED_CAC;
  const liveBlendedCacPrev = liveBlendedPrev?.blendedCac ?? BLENDED_CAC_PREV;
  const liveBlendedCacChange   = +(liveBlendedCac - liveBlendedCacPrev).toFixed(2);
  const liveBlendedCacChangeLy = +(liveBlendedCac - BLENDED_CAC_LY).toFixed(2);

  // Opportunity uplift total from active scored opportunities.
  const liveUplift = totalOpportunityUplift(liveOpportunities);
  const liveEstimatedContribution = liveUplift.high > 0
    ? Math.round(liveUplift.high)
    : ESTIMATED_CONTRIBUTION;

  // DB slug → UI display name.
  const SLUG_TO_NAME: Record<string, string> = {
    meta: "Meta", google_shopping: "Google Shopping", email: "Email", organic: "Organic",
  };

  // Efficiency band: strong < 70% of blended · watch < 120% · weak ≥ 120%.
  const getCacEfficiency = (cac: number, blended: number): EfficiencyRating =>
    cac < blended * 0.7 ? "strong" :
    cac < blended * 1.2 ? "watch"  : "weak";

  // Live CAC by channel — falls back to full static array if RPC returns no rows.
  const liveCacByChannel: typeof CAC_BY_CHANNEL = (() => {
    if (!liveChannels.length) return CAC_BY_CHANNEL;
    const blCac = liveBlendedCac;
    return (["meta", "google_shopping", "email", "organic"] as const).flatMap((slug) => {
      const ch = findChannel(liveChannels, slug);
      if (!ch || ch.cac === null) {
        return CAC_BY_CHANNEL.filter((r) => r.channel === SLUG_TO_NAME[slug]);
      }
      const pts    = getCacTrendForChannel(liveCacTrend, slug);
      const latest = pts[pts.length - 1] ?? null;
      const mom    = latest?.momChangePct ?? null;
      const changeLabel =
        mom === null || mom === 0 ? "Stable" :
        mom > 0 ? `+${Math.round(mom * 100)}%` : `−${Math.round(Math.abs(mom) * 100)}%`;
      const change =
        mom === null || mom === 0 ? null :
        (mom > 0 ? Math.round(mom * 100) : -Math.round(Math.abs(mom) * 100));
      return [{ channel: SLUG_TO_NAME[slug] ?? slug, cac: ch.cac, change, changeLabel, efficiency: getCacEfficiency(ch.cac, blCac) }];
    });
  })();

  // Live contribution margin % and attributed net sales per channel.
  const liveChannelCm: { channel: string; cm: number; revenue: number }[] = (() => {
    if (!liveChannels.length) return CHANNEL_CM;
    const get = (slug: string, fallbackCm: number, fallbackRev: number) => {
      const ch = findChannel(liveChannels, slug);
      return { cm: ch ? ch.contributionMarginPct * 100 : fallbackCm, revenue: ch ? ch.attributedNetSales : fallbackRev };
    };
    return [
      { channel: "Email",           ...get("email",           CHANNEL_CM_PCT.email,          CHANNEL_CM[0].revenue) },
      { channel: "Organic",         ...get("organic",         CHANNEL_CM_PCT.organic,        CHANNEL_CM[1].revenue) },
      { channel: "Google Shopping", ...get("google_shopping", CHANNEL_CM_PCT.googleShopping, CHANNEL_CM[2].revenue) },
      { channel: "Meta",            ...get("meta",            CHANNEL_CM_PCT.meta,           CHANNEL_CM[3].revenue) },
    ];
  })();

  // Live contribution profit per channel.
  const liveChannelCp: { channel: string; cp: number }[] = (() => {
    if (!liveChannels.length) return CHANNEL_CP;
    return [
      { channel: "Email",           cp: findChannel(liveChannels, "email")?.contributionProfit           ?? CHANNEL_CP[0].cp },
      { channel: "Organic",         cp: findChannel(liveChannels, "organic")?.contributionProfit         ?? CHANNEL_CP[1].cp },
      { channel: "Google Shopping", cp: findChannel(liveChannels, "google_shopping")?.contributionProfit ?? CHANNEL_CP[2].cp },
      { channel: "Meta",            cp: findChannel(liveChannels, "meta")?.contributionProfit            ?? CHANNEL_CP[3].cp },
    ];
  })();

  // Live CAC payback by channel from cac_payback_orders RPC field.
  const livePaybackByChannel: { channel: string; payback: number }[] = (() => {
    if (!liveChannels.length) return PAYBACK_BY_CHANNEL;
    return (["email", "organic", "google_shopping", "meta"] as const).map((slug) => {
      const ch       = findChannel(liveChannels, slug);
      const fallback = PAYBACK_BY_CHANNEL.find((p) => p.channel === SLUG_TO_NAME[slug])?.payback ?? 1.0;
      return { channel: SLUG_TO_NAME[slug] ?? slug, payback: ch?.cacPaybackOrders ?? fallback };
    });
  })();

  // Best/worst CP channels — used in §4 interpretation text (dynamic with live data).
  const liveCpSortedDesc   = [...liveChannelCp].sort((a, b) => b.cp - a.cp);
  const liveBestCpChannel  = liveCpSortedDesc[0]?.channel  ?? "Email";
  const liveWorstCpChannel = liveCpSortedDesc[liveCpSortedDesc.length - 1]?.channel ?? "Meta";
  const liveBestCpAmt      = liveCpSortedDesc[0]?.cp ?? 0;
  const liveWorstCpAmt     = liveCpSortedDesc[liveCpSortedDesc.length - 1]?.cp ?? 0;

  // ── Budget Reallocation Simulator state ──────────────────────────────────
  const [metaToEmail,    setMetaToEmail]    = useState(0);
  const [metaToOrganic,  setMetaToOrganic]  = useState(0);
  const [googleToEmail,  setGoogleToEmail]  = useState(0);
  const [googleToOrganic,setGoogleToOrganic]= useState(0);

  const totalShift    = metaToEmail + metaToOrganic + googleToEmail + googleToOrganic;
  const effectiveShift = Math.min(totalShift, 30);
  const shiftRatio     = effectiveShift / 30;

  const simContribution = Math.round(shiftRatio * 18_200 / 100) * 100;
  const simCacChange    = +(shiftRatio * 1.10).toFixed(2);
  const simMarginGain   = +(shiftRatio * 3.0).toFixed(1);
  const simRisk         = effectiveShift > 15 ? "Medium" : "Low";
  const simHighConf     = Math.round(shiftRatio * 9_800 / 100) * 100;
  const simMedConf      = Math.round(shiftRatio * 8_400 / 100) * 100;

  const isPro = canAccess("marketing_budget_simulator");

  return (
    <AppLayout>

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Marketing Efficiency
          </h1>
          <p className="text-muted-foreground mt-1">
            Which channels are creating profitable customers, and where budget should move next.
          </p>
          <DataPeriodLabel
            periodLabel={mePeriodLabel}
            loading={mePeriodLoading}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        </div>
        <TimelineSelector />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          §1  CFO CHANNEL VERDICT
          Founder decision briefing before analysis
      ══════════════════════════════════════════════════════════════════════ */}

      <div className="sc-purple rounded-2xl shadow-md mb-6 overflow-hidden">
        <div className="sc-purple-header flex items-center gap-3 px-6 py-3">
          <Sparkles className="w-4 h-4 text-indigo-300 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
            CFO Channel Verdict
          </span>
          <span className="ml-auto inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-destructive/15 text-destructive whitespace-nowrap">
            Budget shift recommended
          </span>
        </div>

        <div className="px-6 pt-5 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.85fr] gap-6 mb-5 pb-5 border-b border-primary/15">
            <div className="space-y-3">
              <p className="text-lg sm:text-xl font-bold text-foreground leading-snug">
                Email and Organic are creating the most profitable customers. Meta is now the weakest channel and is pulling blended acquisition efficiency down.
              </p>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                {isPro
                  ? "The commercial move is to shift 15-25% of Meta spend toward lifecycle, Email and Organic activity before adding new budget."
                  : "The commercial issue is clear: weaker paid acquisition is absorbing budget that could be working harder elsewhere."}{" "}
                That gives the business a route to recover approximately{" "}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">£{liveEstimatedContribution.toLocaleString()}</span>{" "}
                {framing.upliftPhrase}.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-100/80 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700/60 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">Strongest channel</p>
                <p className="text-xl font-display font-bold text-emerald-900 dark:text-emerald-200">{liveBestCpChannel}</p>
                <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-1">
                  £{liveBestCpAmt.toLocaleString()} contribution
                </p>
              </div>
              <div className="rounded-xl bg-red-50/80 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-1">Weakening channel</p>
                <p className="text-xl font-display font-bold text-red-700 dark:text-red-300">{liveWorstCpChannel}</p>
                <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">
                  £{liveWorstCpAmt.toLocaleString()} contribution
                </p>
              </div>
              <div className="col-span-2 rounded-xl bg-secondary/50 border border-border/50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Recoverable contribution</p>
                <div className="flex items-end gap-3">
                  <p className="text-3xl font-display font-bold text-emerald-600 dark:text-emerald-400 leading-none">
                    £{liveEstimatedContribution.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground pb-0.5">
                    {framing.rowLabel} · +{ME_TOTAL_PP.toFixed(1)}pp margin
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-secondary/30 border border-primary/10 px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">What is happening</p>
              <p className="text-sm text-foreground leading-snug">Contribution is being diluted by paid acquisition costs rising faster than profitable customer value.</p>
            </div>
            <div className="rounded-xl bg-secondary/30 border border-primary/10 px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">What to do next</p>
              <p className="text-sm text-foreground leading-snug">
                {isPro
                  ? "Tighten Meta spend first, then move budget toward owned and organic demand."
                  : "Prioritise fixing inefficient paid acquisition before adding more budget."}
              </p>
            </div>
            <div className="rounded-xl bg-secondary/30 border border-primary/10 px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Why this matters</p>
              <p className="text-sm text-foreground leading-snug">The business can recover contribution without increasing total marketing spend.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          §2  START HERE
          Top actions before modelling and diagnostics
      ══════════════════════════════════════════════════════════════════════ */}

      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">Start Here</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          The first three budget moves your CFO would make from this channel mix.
        </p>
      </div>

      {isPro ? (
        <div className="space-y-4 mb-8">
          {ME_OPPORTUNITIES.map((o, i) => {
            const guidance = ACTION_GUIDANCE[i] ?? ACTION_GUIDANCE[0];
            return (
              <details
                key={o.shortLabel}
                open={i === 0}
                className={cn(
                  "group rounded-2xl border bg-card shadow-sm overflow-hidden",
                  i === 0 ? "border-emerald-300 dark:border-emerald-700/60" : "border-border/60"
                )}
              >
                <summary className="list-none cursor-pointer px-6 py-5 hover:bg-secondary/20 transition-colors">
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-5 items-start">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-xs font-bold",
                        i === 0
                          ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                          : "bg-secondary text-muted-foreground"
                      )}>
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-bold text-foreground">{o.shortLabel}</p>
                          {i === 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                              Start Monday
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 leading-snug">{o.detail}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-[auto_auto_auto_auto] gap-2 lg:justify-end">
                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-700/40 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-0.5">Recovery</p>
                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">+£{o.cashImpact.toLocaleString()}/mo</p>
                      </div>
                      <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Confidence</p>
                        <p className="text-sm font-semibold text-foreground">{o.confidence === "high" ? "High" : "Medium"}</p>
                      </div>
                      <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Effort</p>
                        <p className="text-sm font-semibold text-foreground">{o.effort === "low" ? "Low" : "Medium"}</p>
                      </div>
                      <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Timing</p>
                        <p className="text-sm font-semibold text-foreground">30 days</p>
                      </div>
                    </div>
                  </div>
                </summary>
                <div className="px-6 pb-5 -mt-1">
                  <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-4 pl-11">
                    <div className="rounded-xl bg-secondary/30 border border-border/50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Why this matters</p>
                      <p className="text-sm text-foreground leading-relaxed">{guidance.why}</p>
                    </div>
                    <div className="rounded-xl bg-secondary/30 border border-border/50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">How to start</p>
                      <ul className="space-y-1.5 text-sm text-foreground">
                        {guidance.steps.map((step) => (
                          <li key={step} className="flex items-start gap-2">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="leading-snug">{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/70 dark:bg-indigo-950/25 shadow-sm mb-8 px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
                <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Your Marketing Recovery Plan</p>
                <p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 mt-1">
                  3 prioritised actions identified worth approximately £{liveEstimatedContribution.toLocaleString()} contribution recovery. Upgrade to view the action plan, recommended budget moves and implementation steps.
                </p>
              </div>
            </div>
            <div className="shrink-0 md:text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-1">Estimated contribution recovery</p>
              <p className="text-2xl font-display font-bold text-indigo-900 dark:text-indigo-100">£{liveEstimatedContribution.toLocaleString()}</p>
              <a href="/upgrade" className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:underline mt-1 inline-block">
                Upgrade to Pro →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          §3  PROFITABLE CUSTOMER CHANNELS
      ══════════════════════════════════════════════════════════════════════ */}

      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">Which Channels Create Profitable Customers?</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Channel ranking by contribution profit, with CAC and margin evidence kept compact.
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 shadow-sm mb-8 overflow-hidden bg-card">
        <div className="divide-y divide-border/40">
          {[...liveChannelCp].sort((a, b) => b.cp - a.cp).map((row, i) => {
            const cm = liveChannelCm.find((c) => c.channel === row.channel)?.cm ?? 0;
            const cac = liveCacByChannel.find((c) => c.channel === row.channel)?.cac;
            const isBest = row.channel === liveBestCpChannel;
            const isWorst = row.channel === liveWorstCpChannel;
            return (
              <div key={row.channel} className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 px-6 py-4 items-center">
                <div className="flex items-start gap-3">
                  <span className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-full shrink-0 text-xs font-bold",
                    isBest ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300" :
                    isWorst ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" :
                    "bg-secondary text-muted-foreground"
                  )}>
                    {i + 1}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{row.channel}</p>
                      {isBest && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">Protect and grow</span>}
                      {isWorst && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">Tighten spend</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">
                      {isBest
                        ? "This channel is producing the strongest contribution after marketing cost."
                        : isWorst
                        ? "This channel is the clearest candidate for budget reallocation."
                        : "Keep this channel under review against contribution quality, not revenue alone."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 md:justify-end text-sm">
                  <span className="font-bold text-foreground tabular-nums">£{row.cp.toLocaleString()} contribution</span>
                  <span className="text-muted-foreground tabular-nums">{cm.toFixed(1)}% CM</span>
                  {cac !== undefined && <span className="text-muted-foreground tabular-nums">£{cac.toFixed(2)} CAC</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          §4  WHAT THIS COULD RECOVER
      ══════════════════════════════════════════════════════════════════════ */}

      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-950/15 shadow-sm mb-8 px-6 py-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">What This Could Recover</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              These actions recover contribution by moving existing spend toward channels that already generate better customer economics.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">Contribution recovery</p>
              <p className="text-4xl font-display font-bold text-emerald-700 dark:text-emerald-300 leading-none">£{liveEstimatedContribution.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">{framing.rowLabel} · £{(liveEstimatedContribution * 12).toLocaleString()} annualised</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Margin upside</p>
              <p className="text-3xl font-display font-bold text-foreground leading-none">+{ME_TOTAL_PP.toFixed(1)}pp</p>
              <p className="text-xs text-muted-foreground mt-1">from the top actions</p>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          §5  WHY THIS IS HAPPENING
      ══════════════════════════════════════════════════════════════════════ */}

      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">Why This Is Happening</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          The main commercial reasons marketing contribution is leaking.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {liveMeDrivers.slice(0, 3).map((driver) => (
          <div key={driver.driver} className="rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-sm">
            <p className="text-sm font-semibold text-foreground mb-1">{driver.driver}</p>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">{driver.cause}</p>
            <p className="text-sm font-bold text-destructive tabular-nums">−£{Math.abs(driver.impact).toLocaleString()}</p>
          </div>
        ))}
      </div>

      <AiCfoAskCard pageId="marketing" />

      {/* ══════════════════════════════════════════════════════════════════════
          §6  MODEL THE BUDGET SHIFT
          Interactive channel shift modelling with Pro-gated outputs
      ══════════════════════════════════════════════════════════════════════ */}

      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">Model The Budget Shift</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Optional modelling for the recommended move: reduce inefficient paid spend and redirect it toward higher-contribution channels.
        </p>
      </div>

      {isPro ? (
      <div className="rounded-2xl border border-border/60 shadow-sm mb-10 overflow-hidden bg-card">

        {/* ── Header bar ── */}
        <div className="flex items-center gap-3 px-6 py-3 bg-secondary/30 border-b border-border/50">
          <SlidersHorizontal className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Channel Shift Modeller
          </span>
          {totalShift > 30 && (
            <span className="ml-auto text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700/40 px-2 py-0.5 rounded-full">
              Combined shift capped at 30%
            </span>
          )}
        </div>

        <div className="px-6 pt-6 pb-5">

          {/* ── Sliders ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">

            {/* Meta → Email */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">Shift Meta budget → Email</p>
                <span className="text-sm font-bold text-primary tabular-nums">{metaToEmail}%</span>
              </div>
              <Slider
                aria-label="Shift Meta budget to Email"
                min={0} max={25} step={1}
                value={[metaToEmail]}
                onValueChange={([v]) => setMetaToEmail(v)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1.5">0–25% of Meta spend</p>
            </div>

            {/* Meta → Organic */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">Shift Meta budget → Organic</p>
                <span className="text-sm font-bold text-primary tabular-nums">{metaToOrganic}%</span>
              </div>
              <Slider
                aria-label="Shift Meta budget to Organic"
                min={0} max={25} step={1}
                value={[metaToOrganic]}
                onValueChange={([v]) => setMetaToOrganic(v)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1.5">0–25% of Meta spend</p>
            </div>

            {/* Google → Email */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">Shift Google budget → Email</p>
                <span className="text-sm font-bold text-primary tabular-nums">{googleToEmail}%</span>
              </div>
              <Slider
                aria-label="Shift Google budget to Email"
                min={0} max={25} step={1}
                value={[googleToEmail]}
                onValueChange={([v]) => setGoogleToEmail(v)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1.5">0–25% of Google spend</p>
            </div>

            {/* Google → Organic */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">Shift Google budget → Organic</p>
                <span className="text-sm font-bold text-primary tabular-nums">{googleToOrganic}%</span>
              </div>
              <Slider
                aria-label="Shift Google budget to Organic"
                min={0} max={25} step={1}
                value={[googleToOrganic]}
                onValueChange={([v]) => setGoogleToOrganic(v)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1.5">0–25% of Google spend</p>
            </div>

          </div>

          {/* ── Recoverable Contribution Opportunity Card (Pro gated) ── */}
          {isPro ? (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-950/20 px-5 py-4 mb-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-3">
                Projected contribution uplift
              </p>
              <div className="flex flex-wrap items-end gap-x-8 gap-y-2 mb-3">
                <div>
                  <p className="text-4xl font-display font-bold text-emerald-700 dark:text-emerald-300 leading-none tabular-nums mb-1">
                    £{simContribution.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-muted-foreground">(30 days) · £{(simContribution * 12).toLocaleString()} (annualised)</p>
                </div>
                <div className="pb-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/60 mb-0.5">
                    Equivalent to
                  </p>
                  <p className="text-2xl font-display font-bold text-emerald-600 dark:text-emerald-400 leading-none tabular-nums">
                    +{simMarginGain}pp
                  </p>
                  <p className="text-xs text-emerald-700/60 dark:text-emerald-400/60 leading-snug">
                    contribution margin
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-1 mb-3">
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
                  <span className="font-semibold">High confidence</span>&ensp;£{simHighConf.toLocaleString()}
                </p>
                <p className="text-xs text-emerald-700/60 dark:text-emerald-400/60 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 dark:bg-emerald-400/50 shrink-0" />
                  <span className="font-semibold">Medium confidence</span>&ensp;£{simMedConf.toLocaleString()}
                </p>
              </div>
              <ConfidenceBadge level="Medium" helper="Based on channel-level attribution and recent trend data." />
            </div>
          ) : (
            <div className="relative rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/70 dark:bg-indigo-950/30 px-5 py-4 mb-5 overflow-hidden">
              <div className="blur-sm select-none pointer-events-none" aria-hidden="true">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-3">
                  Projected contribution uplift
                </p>
                <p className="text-4xl font-display font-bold text-emerald-700 leading-none tabular-nums mb-2">
                  £18,200
                </p>
                <p className="text-xs text-emerald-700/60">High confidence £9,800 · Medium confidence £8,400</p>
              </div>
              <div className="absolute inset-0 flex items-center justify-center px-6">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0 mt-0.5">
                    <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 leading-snug">
                      Upgrade to Pro to unlock channel reallocation impact modelling
                    </p>
                    <a href="/upgrade" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline mt-0.5 inline-block">
                      Upgrade to Pro →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Simulator outputs ── */}
          {isPro ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="rounded-xl bg-secondary/40 border border-border/50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Contribution uplift
                </p>
                {simContribution > 0 ? (
                  <PeriodImpact value={simContribution} valueClassName="text-2xl font-display" />
                ) : (
                  <p className="text-2xl font-display font-bold leading-none tabular-nums text-foreground">—</p>
                )}
              </div>
              <div className="rounded-xl bg-secondary/40 border border-border/50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Blended CAC change
                </p>
                <p className={cn(
                  "text-2xl font-display font-bold leading-none tabular-nums",
                  simCacChange > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                )}>
                  {simCacChange > 0 ? `−£${simCacChange.toFixed(2)}` : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-secondary/40 border border-border/50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Margin improvement
                </p>
                <p className={cn(
                  "text-2xl font-display font-bold leading-none tabular-nums",
                  simMarginGain > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                )}>
                  {simMarginGain > 0 ? `+${simMarginGain}pp` : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-secondary/40 border border-border/50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Risk level
                </p>
                <p className={cn(
                  "text-2xl font-display font-bold leading-none",
                  simRisk === "Low"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                )}>
                  {effectiveShift > 0 ? simRisk : "—"}
                </p>
              </div>
            </div>
          ) : (
            <div className="relative rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/50 dark:bg-indigo-950/20 mb-6 overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 blur-sm select-none pointer-events-none" aria-hidden="true">
                {["Contribution uplift", "Blended CAC change", "Margin improvement", "Risk level"].map((label) => (
                  <div key={label} className="rounded-xl bg-[#13233F] border border-border/50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
                    <p className="text-2xl font-display font-bold leading-none text-emerald-600">+£18,200</p>
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <a href="/upgrade" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg transition-colors">
                  <Lock className="w-3.5 h-3.5" />
                  Upgrade to Pro to unlock budget reallocation modelling
                </a>
              </div>
            </div>
          )}

          {/* ── Fastest Recovery Lever ── */}
          <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-950/25 border border-emerald-300 dark:border-emerald-700/50 px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Recommended model preset
              </p>
            </div>
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200 leading-relaxed">
              Reallocate 15–25% of Meta spend toward Email and Organic — the two highest-contribution channels by profit margin.
            </p>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-700/30">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-emerald-600/70 dark:text-emerald-400/60" />
                <span className="text-xs text-emerald-700/70 dark:text-emerald-400/60">Low implementation risk</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-emerald-600/70 dark:text-emerald-400/60" />
                <span className="text-xs text-emerald-700/70 dark:text-emerald-400/60">Low effort · High impact</span>
              </div>
            </div>
          </div>

        </div>
      </div>
      ) : (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/70 dark:bg-indigo-950/25 shadow-sm mb-10 px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
                <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Budget reallocation model locked</p>
                <p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 mt-1 max-w-2xl">
                  See how shifting spend between Meta, Email, Organic and Google Shopping changes contribution, CAC and margin.
                </p>
              </div>
            </div>
            <a href="/upgrade" className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition-colors shrink-0">
              <Lock className="w-3.5 h-3.5" />
              Upgrade to Pro
            </a>
          </div>
        </div>
      )}

      {isPro ? (
      <details className="rounded-2xl border border-border/60 bg-card shadow-sm mb-8 overflow-hidden">
        <summary className="list-none cursor-pointer px-6 py-4 hover:bg-secondary/20 transition-colors">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Supporting Analysis</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                The key proof points behind the budget recommendation.
              </p>
            </div>
            <span className="text-sm font-semibold text-muted-foreground shrink-0">View details ▼</span>
          </div>
        </summary>

        <div className="px-6 pb-6">
          {/* ══════════════════════════════════════════════════════════════════════
              KEY NUMBERS BEHIND THE VERDICT
              KPI support kept below the decision surface
          ══════════════════════════════════════════════════════════════════════ */}

          <div className="mb-4 pt-2">
            <h3 className="text-lg font-bold text-foreground">Key Numbers Behind The Verdict</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              The core metrics supporting the channel allocation recommendation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4 mb-6">

        {/* 1 — Marketing Contribution Profit */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Marketing Contribution Profit</p>
          <p className="text-3xl font-display font-bold text-foreground mb-2">
            £{MKT_CP.toLocaleString()}
          </p>
          <div className="space-y-0.5 mb-2">
            <VarLine
              label="vs last month"
              value={`↓ £${Math.abs(MKT_CP_CHANGE_MOM).toLocaleString()}`}
              sentiment={deltaToSentiment(MKT_CP_CHANGE_MOM, DELTA_POLARITY.mktCp)}
            />
            <VarLine
              label="vs 12-month avg"
              value={`↑ £${MKT_CP_CHANGE_LY.toLocaleString()}`}
              sentiment={deltaToSentiment(MKT_CP_CHANGE_LY, DELTA_POLARITY.mktCp)}
            />
          </div>
          <p className="text-xs text-muted-foreground leading-snug">Revenue remaining after all marketing costs</p>
        </div>

        {/* 2 — Blended CAC */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Blended CAC</p>
          <p className="text-3xl font-display font-bold text-foreground mb-2">£{liveBlendedCac.toFixed(2)}</p>
          <div className="space-y-0.5 mb-2">
            <VarLine
              label="vs last month"
              value={`↑ £${Math.abs(liveBlendedCacChange).toFixed(2)}`}
              sentiment={deltaToSentiment(liveBlendedCacChange, DELTA_POLARITY.blendedCac)}
            />
            <VarLine
              label="vs 12-month avg"
              value={`↑ £${Math.abs(liveBlendedCacChangeLy).toFixed(2)}`}
              sentiment={deltaToSentiment(liveBlendedCacChangeLy, DELTA_POLARITY.blendedCac)}
            />
          </div>
          <p className="text-xs text-muted-foreground leading-snug">Average cost to acquire one customer across all channels</p>
        </div>

        {/* 3 — Blended ROAS */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Blended ROAS</p>
          <p className="text-3xl font-display font-bold text-foreground mb-2">{BLENDED_ROAS}×</p>
          <div className="space-y-0.5 mb-2">
            <VarLine
              label="vs last month"
              value={`↓ ${Math.abs(BLENDED_ROAS_CHANGE_MOM).toFixed(1)}×`}
              sentiment={deltaToSentiment(BLENDED_ROAS_CHANGE_MOM, DELTA_POLARITY.blendedRoas)}
            />
            <VarLine
              label="vs 12-month avg"
              value={`↓ ${Math.abs(BLENDED_ROAS_CHANGE_LY).toFixed(1)}×`}
              sentiment={deltaToSentiment(BLENDED_ROAS_CHANGE_LY, DELTA_POLARITY.blendedRoas)}
            />
          </div>
          <p className="text-xs text-muted-foreground leading-snug">Revenue returned per £1 of blended marketing spend</p>
        </div>

        {/* 4 — CAC Payback */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">CAC Payback</p>
          <p className="text-3xl font-display font-bold text-foreground mb-2">
            {CAC_PAYBACK}<span className="text-xl font-semibold text-muted-foreground ml-1">orders</span>
          </p>
          <div className="space-y-0.5 mb-2">
            <VarLine
              label="vs last month"
              value={`↑ ${(CAC_PAYBACK - CAC_PAYBACK_PREV).toFixed(1)} orders`}
              sentiment={deltaToSentiment(CAC_PAYBACK - CAC_PAYBACK_PREV, DELTA_POLARITY.cacPayback)}
            />
            <VarLine
              label="vs 12-month avg"
              value={`↑ ${(CAC_PAYBACK - CAC_PAYBACK_LY).toFixed(1)} orders`}
              sentiment={deltaToSentiment(CAC_PAYBACK - CAC_PAYBACK_LY, DELTA_POLARITY.cacPayback)}
            />
          </div>
          <p className="text-xs text-muted-foreground leading-snug">Orders needed to recover the cost of acquiring each new customer</p>
        </div>

          </div>

      {/* ══════════════════════════════════════════════════════════════════════
          §8  CHANNEL EVIDENCE
          Deeper channel diagnostics after the recommendation
      ══════════════════════════════════════════════════════════════════════ */}

      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground">Channel Evidence</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Deeper channel diagnostics for founders who want to inspect the recommendation.
        </p>
      </div>

      {/* Contribution per Order by Channel — sub-section of Allocation Diagnostics */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 mb-4">

        {/* Sub-heading row */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h3 className="font-semibold text-base text-foreground">Contribution per Order by Channel</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Contribution profit generated per order by acquisition channel after marketing cost
            </p>
          </div>
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Highest
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />Lowest
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary/60 inline-block" />Other
            </span>
          </div>
        </div>

        {/* Channel rows — horizontal bar + value */}
        <div className="space-y-4">
          {[...CHANNEL_CPO].sort((a, b) => b.cpo - a.cpo).map((entry) => {
            const isMax = entry.cpo === maxCpo;
            const isMin = entry.cpo === minCpo;
            const barColor = isMax ? "bg-emerald-500" : isMin ? "bg-red-500" : "bg-primary/60";
            const valueColor = isMax
              ? "text-emerald-600 dark:text-emerald-400"
              : isMin
              ? "text-red-500 dark:text-red-400"
              : "text-foreground";
            const pct = (entry.cpo / maxCpo) * 100;
            return (
              <div key={entry.channel} className="flex items-center gap-4">
                {/* Channel name */}
                <span className="w-[130px] shrink-0 text-sm font-medium text-foreground truncate">
                  {entry.channel}
                </span>

                {/* Bar */}
                <div className="flex-1 h-7 bg-secondary/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Value */}
                <span className={`w-[52px] text-right text-sm font-bold tabular-nums shrink-0 ${valueColor}`}>
                  £{entry.cpo.toFixed(2)}
                </span>

                {/* Badge for extremes */}
                {(isMax || isMin) && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                    isMax
                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                      : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                  }`}>
                    {isMax ? "Best" : "Weakest"}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Differentiator note vs CAC Payback */}
        <div className="flex items-start gap-2 mt-3 px-3 py-2.5 rounded-lg bg-secondary/50 border border-border/40">
          <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-snug">
            <span className="font-semibold text-foreground">Contribution per order</span> shows which channels create the most profit per sale.{" "}
            <span className="font-semibold text-foreground">CAC payback</span> shows how quickly acquisition spend is recovered.
            Together they give a complete picture of channel efficiency.
          </p>
        </div>

      </div>

      <div className="space-y-4">

      {/* CAC by Channel */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/50 bg-secondary/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Customer Acquisition Cost by Channel
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Blended avg:{" "}
              <span className="font-semibold text-foreground tabular-nums">£{liveBlendedCac.toFixed(2)}</span>
            </span>
            <span className="text-xs text-muted-foreground border-l border-border/50 pl-3">vs last month</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 px-6 py-2.5 border-b border-border/40">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Channel</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">CAC · vs blended avg</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Change</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Efficiency</span>
        </div>

        {/* Blended Average reference row */}
        <div className="grid grid-cols-4 gap-4 px-6 py-2.5 bg-secondary/30 border-b border-border/40 items-center">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0 bg-slate-400 dark:bg-slate-500" />
            <span className="text-xs font-semibold text-muted-foreground">Blended Average</span>
          </div>
          <span className="text-sm font-bold text-muted-foreground tabular-nums text-right">
            £{liveBlendedCac.toFixed(2)}
          </span>
          <span className="text-xs text-muted-foreground/50 text-right">—</span>
          <span className="text-xs text-muted-foreground/50 text-right">—</span>
        </div>

        <div className="divide-y divide-border/40">
          {liveCacByChannel.map((row) => {
            const cfg = EFFICIENCY_CONFIG[row.efficiency];
            const cacDiff = +(row.cac - liveBlendedCac).toFixed(2);
            const absCacDiff = Math.abs(cacDiff).toFixed(2);
            const cacDiffLabel = cacDiff > 0
              ? `+£${absCacDiff} vs blended avg`
              : `−£${absCacDiff} vs blended avg`;
            return (
              <div key={row.channel} className="grid grid-cols-4 gap-4 px-6 py-3.5 items-center hover:bg-secondary/30 transition-colors">
                <div className="flex items-center gap-2">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.dot)} />
                  <span className="text-sm font-medium text-foreground">{row.channel}</span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-sm font-bold text-foreground tabular-nums">£{row.cac.toFixed(2)}</span>
                  <span
                    className={cn(
                      "text-[11px] font-medium tabular-nums",
                      cacDiff > 0
                        ? "text-destructive/80"
                        : "text-emerald-600/80 dark:text-emerald-400/80"
                    )}
                  >
                    {cacDiffLabel}
                  </span>
                </div>
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

      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/50 bg-secondary/20">
          <div>
            <h3 className="font-semibold text-base text-foreground">CAC Payback by Channel</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Which channels recover acquisition cost fastest.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Blended avg</p>
            <p className="text-sm font-bold text-foreground tabular-nums">{CAC_PAYBACK} orders</p>
          </div>
        </div>

        <div className="divide-y divide-border/40">
          {[...livePaybackByChannel].sort((a, b) => a.payback - b.payback).map((row, i) => {
            const band = getPaybackBand(row.payback);
            return (
              <div key={row.channel} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-4 px-6 py-3.5 items-center">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-secondary text-xs font-bold text-muted-foreground">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-foreground">{row.channel}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      band.label === "Risk"    ? "text-destructive" :
                      band.label === "Monitor" ? "text-amber-600 dark:text-amber-400" :
                      "text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {row.payback} orders
                  </span>
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", band.badgeCls)}>
                    {band.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

          </div>
        </div>
      </details>
      ) : (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/70 dark:bg-indigo-950/25 shadow-sm mb-8 px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
                <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Supporting analysis available on Pro</p>
                <p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 mt-1">
                  Unlock the detailed channel evidence behind the recommendation, including CAC, payback and contribution-per-order comparisons.
                </p>
              </div>
            </div>
            <a href="/upgrade" className="text-sm font-semibold text-indigo-600 dark:text-indigo-300 hover:underline shrink-0">
              Upgrade to Pro →
            </a>
          </div>
        </div>
      )}

      {/*
       * ══════════════════════════════════════════════════════════════════════
       * FUTURE SECTION — Traffic Quality Diagnostics
       * ══════════════════════════════════════════════════════════════════════
       *
       * Intentionally excluded from this page to keep the focus on:
       *   — channel contribution profit and margin
       *   — customer acquisition cost (blended and by channel)
       *   — CAC payback period
       *   — budget reallocation opportunities
       *
       * When added, Traffic Quality Diagnostics should appear as a separate
       * sub-page or tab, NOT inline here. Suggested metrics when the time comes:
       *   — Paid vs organic traffic split and quality score
       *   — Landing page conversion rate by channel
       *   — Session-to-order conversion rate by acquisition source
       *   — Bounce rate by paid channel (signal of ad/landing page mismatch)
       *
       * Do NOT add GA4-style web analytics (top pages, bounce rate, session
       * duration, funnel charts) to this page. This page is a financial
       * decision surface, not a web analytics dashboard.
       * ══════════════════════════════════════════════════════════════════════
       */}

      <DataBenchmarkAssumptions
        benchmarkNote="Meta CAC payback is 2.1 orders, above the safe range of <1.2 orders."
        dataQualityNote="Channel contribution estimates rely on revenue attribution from Google and Meta. Cross-channel attribution differences may affect comparisons."
        className="mb-2"
      />

    </AppLayout>
  );
}
