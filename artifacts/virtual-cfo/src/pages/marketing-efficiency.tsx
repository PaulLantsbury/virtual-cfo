import { useState } from "react";
import { Sparkles, TrendingUp, AlertTriangle, Lock, SlidersHorizontal, Info, Zap, Shield } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { ActionRecommendations } from "@/components/ActionRecommendations";
import type { Recommendation } from "@/components/ActionRecommendations";
import { PremiumBlurPreview } from "@/components/PremiumBlurPreview";
import { canAccess } from "@/lib/plan";
import { useTimeline } from "@/lib/timeline";
import { TimelineSelector } from "@/components/TimelineSelector";
import { cn } from "@/lib/utils";

// ─── Data constants ───────────────────────────────────────────────────────────

/** @dynamic */
const BLENDED_CAC        = 12.20;
const BLENDED_CAC_PREV   = 9.80;   // last month
const BLENDED_CAC_LY     = 10.20;  // 12-month average
const BLENDED_CAC_CHANGE = +(BLENDED_CAC - BLENDED_CAC_PREV).toFixed(2);
const BLENDED_CAC_CHANGE_LY = +(BLENDED_CAC - BLENDED_CAC_LY).toFixed(2);

/** @dynamic */
const BLENDED_ROAS       = 2.8;
const BLENDED_ROAS_PREV  = 3.4;    // last month
const BLENDED_ROAS_LY    = 3.2;    // 12-month average
const BLENDED_ROAS_CHANGE_MOM = +(BLENDED_ROAS - BLENDED_ROAS_PREV).toFixed(1);
const BLENDED_ROAS_CHANGE_LY  = +(BLENDED_ROAS - BLENDED_ROAS_LY).toFixed(1);

/** @dynamic */
const CAC_PAYBACK        = 1.4;
const CAC_PAYBACK_PREV   = 1.1;    // last month
const CAC_PAYBACK_LY     = 1.0;    // 12-month average

/** @dynamic */
const MKT_CM             = 38.6;
const MKT_CM_PREV        = 41.8;   // last month
const MKT_CM_LY          = 43.5;   // 12-month average
const MKT_CM_CHANGE      = +(MKT_CM - MKT_CM_PREV).toFixed(1);
const MKT_CM_CHANGE_LY   = +(MKT_CM - MKT_CM_LY).toFixed(1);

/** @dynamic Marketing contribution margin target range */
const MKT_CM_TARGET      = { low: 42, high: 48 } as const;

/**
 * Total contribution profit after all marketing costs for the selected period.
 * @dynamic revenueTotal × (MKT_CM / 100)
 */
const MKT_CP             = 38_400;
const MKT_CP_PREV        = 41_200;  // last month
const MKT_CP_LY          = 35_400;  // last 12-month average
const MKT_CP_CHANGE_MOM  = MKT_CP - MKT_CP_PREV;   // -2_800 (unfavourable)
const MKT_CP_CHANGE_LY   = MKT_CP - MKT_CP_LY;     // +3_000 (favourable)

/** @dynamic MKT_CP / order_count — contribution profit generated per order after all marketing costs */
const MKT_CP_PER_ORDER           =  9.40;
const MKT_CP_PER_ORDER_PREV      = 10.50;  // last month
const MKT_CP_PER_ORDER_LY        = 11.70;  // 12-month average
const MKT_CP_PER_ORDER_CHANGE_MOM = +(MKT_CP_PER_ORDER - MKT_CP_PER_ORDER_PREV).toFixed(2); // -1.10 (unfavourable)
const MKT_CP_PER_ORDER_CHANGE_LY  = +(MKT_CP_PER_ORDER - MKT_CP_PER_ORDER_LY).toFixed(2);  // -2.30 (unfavourable)

/**
 * Total marketing spend for the current period across all channels.
 * @dynamic Sourced from advertising platform costs (Meta, Google Shopping) + email tool costs.
 *          Validated against: MKT_CP / TOTAL_MKT_SPEND ≈ CP_PER_SPEND
 */
const TOTAL_MKT_SPEND      = 17_600; // current period
const TOTAL_MKT_SPEND_PREV = 16_000; // last month — lower spend, better efficiency
const TOTAL_MKT_SPEND_LY   = 12_500; // 12-month average — historically more efficient

/**
 * Contribution generated for every £1 of marketing spend.
 * @dynamic MKT_CP / TOTAL_MKT_SPEND
 * Unfavourable direction: higher is better (declining = spending more to earn less contribution).
 */
const CP_PER_SPEND      = +(MKT_CP      / TOTAL_MKT_SPEND).toFixed(2);            // £2.18
const CP_PER_SPEND_PREV = +(MKT_CP_PREV / TOTAL_MKT_SPEND_PREV).toFixed(2);      // £2.58
const CP_PER_SPEND_LY   = +(MKT_CP_LY   / TOTAL_MKT_SPEND_LY).toFixed(2);        // £2.83
const CP_PER_SPEND_CHANGE_MOM = +(CP_PER_SPEND - CP_PER_SPEND_PREV).toFixed(2);   // -0.40 (unfavourable)
const CP_PER_SPEND_CHANGE_LY  = +(CP_PER_SPEND - CP_PER_SPEND_LY).toFixed(2);     // -0.65 (unfavourable)

/**
 * Recoverable contribution available if spend is reallocated toward higher-margin channels.
 * @dynamic Math.round(orderVolume × (cmGainPp / 100) × revenuePerOrder)
 */
const ESTIMATED_CONTRIBUTION = 18_200;
/** @dynamic Math.round((ESTIMATED_CONTRIBUTION / MKT_CP) * 100) */
const OPPORTUNITY_UPLIFT_PCT = Math.round((ESTIMATED_CONTRIBUTION / MKT_CP) * 100);

/**
 * @ai-commentary Replace with live-generated insight.
 */
const CFO_INSIGHT = {
  primaryDrivers: [
    "Meta CAC increased materially — up £3.40 per order vs prior period",
    "Repeat-customer share declined, increasing reliance on higher-cost new acquisition",
    "Lifecycle email conversion remains underutilised relative to its contribution potential",
  ],
  recoveryLever: "Reallocate 15–25% of paid acquisition spend toward Email and Organic — the two highest-contribution channels by profit margin",
} as const;

/** @dynamic Replace with live channel-level margin data from Shopify + ad platforms */
const CHANNEL_CM = [
  { channel: "Email",           cm: 58.6, revenue: 18_200 },
  { channel: "Organic",         cm: 52.3, revenue: 24_800 },
  { channel: "Google Shopping", cm: 40.1, revenue: 42_600 },
  { channel: "Meta",            cm: 34.2, revenue: 38_900 },
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
const maxCp = Math.max(...CHANNEL_CP.map((c) => c.cp));
const minCp = Math.min(...CHANNEL_CP.map((c) => c.cp));
const totalAttributedCp = CHANNEL_CP.reduce((s, c) => s + c.cp, 0);

/**
 * Estimated contribution profit lost per period due to sub-optimal channel allocation.
 * @dynamic Compute as: (blended CP rate − lowest-performing channel CP rate) × that
 *          channel's revenue × practical reallocation headroom (e.g. 0.9). Where
 *          blended CP rate = totalAttributedCp / totalChannelRevenue and channel CP
 *          rate = channel_cp / channel_revenue. Replace with live values from
 *          ad-platform + Shopify revenue attribution.
 */
const ALLOC_LOSS_CP = 6_700;

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

/**
 * Revenue share vs contribution share per acquisition channel.
 * @dynamic revShare: channel.revenue / totalRevenue; cpShare: channel_cp / totalAttributedCp
 */
const totalChannelRevenue = CHANNEL_CM.reduce((s, c) => s + c.revenue, 0);
const CHANNEL_SHARE = CHANNEL_CM.map((c) => {
  const cp = CHANNEL_CP.find((p) => p.channel === c.channel)!.cp;
  const revShare = Math.round((c.revenue / totalChannelRevenue) * 100);
  const cpShare  = Math.round((cp / totalAttributedCp) * 100);
  return { channel: c.channel, revShare, cpShare, delta: cpShare - revShare };
});

type EfficiencyRating = "strong" | "watch" | "weak";

/** @dynamic Replace with live CAC per channel from ad platform APIs */
const CAC_BY_CHANNEL: {
  channel: string;
  cac: number;
  change: number | null;
  changeLabel: string;
  efficiency: EfficiencyRating;
}[] = [
  { channel: "Meta",            cac: 18.40, change: 14,   changeLabel: "+14%",   efficiency: "weak"   },
  { channel: "Google Shopping", cac: 11.20, change: 6,    changeLabel: "+6%",    efficiency: "watch"  },
  { channel: "Email",           cac:  4.80, change: -2,   changeLabel: "−2%",    efficiency: "strong" },
  { channel: "Organic",         cac:  2.10, change: null, changeLabel: "Stable", efficiency: "strong" },
];

/** @dynamic */
/**
 * Generic channel labels for the CAC Payback FREE ghost preview.
 * Ordered to match PAYBACK_BY_CHANNEL sorted by payback ascending:
 *   Email → Organic → Google Shopping → Meta
 */
const PAYBACK_CHANNEL_GHOST_NAMES = ["Channel A", "Channel B", "Channel C", "Channel D"] as const;

const PAYBACK_THRESHOLD = 1.5;

/** @dynamic Replace with live payback data */
const PAYBACK_BY_CHANNEL = [
  { channel: "Email",           payback: 0.6 },
  { channel: "Organic",         payback: 0.8 },
  { channel: "Google Shopping", payback: 1.3 },
  { channel: "Meta",            payback: 2.1 },
];

/** @dynamic Replace with live monthly efficiency data */
const TREND_DATA = [
  { month: "Apr", cac:  8.2, roas: 4.1 },
  { month: "May", cac:  8.8, roas: 3.9 },
  { month: "Jun", cac:  9.1, roas: 3.7 },
  { month: "Jul", cac:  9.4, roas: 3.5 },
  { month: "Aug", cac:  9.8, roas: 3.6 },
  { month: "Sep", cac:  9.2, roas: 3.8 },
  { month: "Oct", cac:  8.9, roas: 3.9 },
  { month: "Nov", cac:  9.6, roas: 3.5 },
  { month: "Dec", cac: 10.2, roas: 3.2 },
  { month: "Jan", cac: 10.8, roas: 3.0 },
  { month: "Feb", cac: 11.4, roas: 2.9 },
  { month: "Mar", cac: 12.2, roas: 2.8 },
];

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

/**
 * Softer action labels shown in the FREE ghost preview only.
 * Pro users see the precise shortLabel from ME_OPPORTUNITIES.
 */
const ME_GHOST_LABELS: Record<string, string> = {
  "Reallocate Meta spend":                                           "Reallocate paid spend",
  "Increase lifecycle email conversion":                             "Improve retention efficiency",
  "Improve paid acquisition mix toward higher-contribution products": "Optimise paid acquisition mix",
};

/** @dynamic Sum of ppGain across ME_OPPORTUNITIES */
const ME_TOTAL_PP = +ME_OPPORTUNITIES.reduce((s, o) => s + o.ppGain, 0).toFixed(1);

/**
 * Confidence-weighted breakdown of the total estimated opportunity value.
 * @dynamic Derived from ME_OPPORTUNITIES[].confidence and cashImpact
 */
const ME_CONFIDENCE_TOTALS = {
  high:   ME_OPPORTUNITIES.filter((o) => o.confidence === "high").reduce((s, o) => s + o.cashImpact, 0),
  medium: ME_OPPORTUNITIES.filter((o) => o.confidence === "medium").reduce((s, o) => s + o.cashImpact, 0),
  low:    ME_OPPORTUNITIES.filter((o) => o.confidence === "low").reduce((s, o) => s + o.cashImpact, 0),
};

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: "me1",
    text: "Reduce spend on lowest-margin paid channels — reallocate 15–20% of Meta budget to email and organic.",
    impact: "high",
  },
  {
    id: "me2",
    text: "Increase lifecycle email automation coverage to improve LTV and reduce blended CAC.",
    impact: "high",
  },
  {
    id: "me3",
    text: "Improve Meta campaign targeting by narrowing audiences to high-value, repeat-purchase segments.",
    impact: "medium",
  },
  {
    id: "me4",
    text: "Focus paid acquisition on products with the highest contribution margin.",
    impact: "medium",
  },
  {
    id: "me5",
    text: "Set up channel-level contribution margin tracking to automate future reallocation decisions.",
    impact: "quick-win",
  },
];

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

/**
 * Maps channel-specific driver names to generic equivalents for the FREE ghost preview.
 * Non-channel drivers (mix, structural) are shown as-is.
 */
const ME_DRIVER_GHOST_LABELS: Record<string, string> = {
  "Meta CAC increase": "Paid channel CAC increase",
};

/** Ordered group definitions for the Key Drivers section */
const ME_DRIVER_GROUPS = [
  { key: "acquisition-cost" as const, label: "Acquisition Cost Drivers" },
  { key: "mix"              as const, label: "Mix Drivers"              },
  { key: "structural"       as const, label: "Structural Drivers"       },
];

/** @dynamic Sum of ME_DRIVERS impact values */
const ME_DRIVERS_TOTAL = ME_DRIVERS.reduce((s, d) => s + d.impact, 0); // −12_600
/** Driver with the largest absolute impact */
const ME_LARGEST_DRIVER = ME_DRIVERS.reduce((a, b) =>
  Math.abs(a.impact) > Math.abs(b.impact) ? a : b
).driver;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function VarLine({ label, value, favorable }: { label: string; value: string; favorable: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-1 text-xs leading-none",
      favorable ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
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

/** Reserved for upcoming Contribution Margin by Channel chart */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const maxCm = Math.max(...CHANNEL_CM.map((c) => c.cm));
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const minCm = Math.min(...CHANNEL_CM.map((c) => c.cm));

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
  const { periodBadge, periodPhrase, timeline } = useTimeline();
  const framing = TIMELINE_FRAMING[timeline] ?? TIMELINE_FRAMING["30d"];

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
            Understand which acquisition channels create profitable customers and where budget should be reallocated.
          </p>
        </div>
        <TimelineSelector />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          §1  MARKETING EFFICIENCY SUMMARY
          Diagnosis: what is happening and why it matters
      ══════════════════════════════════════════════════════════════════════ */}

      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">Marketing Efficiency Summary</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {periodBadge} · Current efficiency diagnosis and financial exposure
        </p>
      </div>

      <div className="rounded-2xl border border-primary/30 shadow-md mb-10 overflow-hidden">

        {/* ── Header bar ── */}
        <div className="flex items-center gap-3 px-6 py-3 bg-primary/10 border-b border-primary/20">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            CFO Insight
          </span>
          <span className="ml-auto inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-destructive/15 text-destructive whitespace-nowrap">
            Efficiency declining — action required
          </span>
        </div>

        {/* ── Body ── */}
        <div className="bg-primary/5 px-6 pt-5 pb-6">

          {/* ── Hero metrics ── */}
          <div className="grid grid-cols-2 mb-5 pb-5 border-b border-primary/15">

            {/* 1 — Current Marketing Contribution Margin */}
            <div className="pr-6 border-r border-primary/15">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Current Marketing Contribution Margin
              </p>
              <p className="text-4xl sm:text-5xl font-display font-bold text-foreground leading-none mb-2">
                {MKT_CM}%
              </p>
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-sm font-semibold text-destructive">
                  ↓ {Math.abs(MKT_CM_CHANGE)}pp
                </span>
                <span className="text-xs text-muted-foreground">vs last month</span>
              </div>

              {/* @dynamic gaps recompute from MKT_CM vs MKT_CM_TARGET */}
              <div className="pt-3 border-t border-primary/10 space-y-1.5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-muted-foreground">
                    Gap to lower bound ({MKT_CM_TARGET.low}%)
                  </span>
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                    +{(MKT_CM_TARGET.low - MKT_CM).toFixed(1)}pp
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-muted-foreground">
                    Gap to midpoint ({(MKT_CM_TARGET.low + MKT_CM_TARGET.high) / 2}%)
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                    +{((MKT_CM_TARGET.low + MKT_CM_TARGET.high) / 2 - MKT_CM).toFixed(1)}pp
                  </span>
                </div>
              </div>
            </div>

            {/* 2 — Recoverable Contribution Next Month */}
            <div className="pl-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Recoverable Contribution Next Month
              </p>
              <p className="text-4xl sm:text-5xl font-display font-bold text-emerald-600 dark:text-emerald-400 leading-none mb-2">
                £{ESTIMATED_CONTRIBUTION.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground leading-snug max-w-[26ch]">
                Based on {framing.baselineNote}
              </p>
            </div>

          </div>

          {/* ── Headline ── */}
          <div className="mb-5 pb-5 border-b border-primary/15 space-y-2.5">
            <p className="text-lg sm:text-xl font-bold text-foreground leading-snug">
              Marketing efficiency has weakened due to rising Meta CAC and increased reliance on lower-contribution paid acquisition.
            </p>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              If 15–25% of paid acquisition spend is reallocated toward higher-margin channels such as Email and Organic, recoverable contribution is approximately{" "}
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">£{ESTIMATED_CONTRIBUTION.toLocaleString()}</span>{" "}
              {framing.upliftPhrase}.
            </p>
          </div>

          {/* ── Two-column detail ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            {/* Primary drivers */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Primary drivers
              </p>
              <ul className="space-y-2.5">
                {CFO_INSIGHT.primaryDrivers.map((driver, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0 mt-[5px]" />
                    {driver}
                  </li>
                ))}
              </ul>
            </div>

            {/* Fastest recovery lever */}
            <div className="rounded-xl bg-emerald-100/80 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700/60 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">
                Fastest recovery lever identified
              </p>
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200 leading-relaxed">
                {CFO_INSIGHT.recoveryLever}
              </p>
              <p className="text-xs text-emerald-700/60 dark:text-emerald-400/60 mt-3 leading-snug">
                See budget reallocation opportunity below ↓
              </p>
            </div>

          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          §1b  BUDGET REALLOCATION SIMULATOR
          Interactive channel shift modelling with Pro-gated outputs
      ══════════════════════════════════════════════════════════════════════ */}

      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">Budget Reallocation Simulator</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Estimate how shifting paid spend toward higher-contribution channels affects contribution profit and CAC.
        </p>
      </div>

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
                Recoverable contribution next month
              </p>
              <div className="flex flex-wrap items-end gap-x-8 gap-y-2 mb-3">
                <p className="text-4xl font-display font-bold text-emerald-700 dark:text-emerald-300 leading-none tabular-nums">
                  £{simContribution.toLocaleString()}
                </p>
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
              <div className="flex flex-col gap-1">
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
                  <span className="font-semibold">High confidence</span>&ensp;£{simHighConf.toLocaleString()}
                </p>
                <p className="text-xs text-emerald-700/60 dark:text-emerald-400/60 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 dark:bg-emerald-400/50 shrink-0" />
                  <span className="font-semibold">Medium confidence</span>&ensp;£{simMedConf.toLocaleString()}
                </p>
              </div>
            </div>
          ) : (
            <div className="relative rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/70 dark:bg-indigo-950/30 px-5 py-4 mb-5 overflow-hidden">
              <div className="blur-sm select-none pointer-events-none" aria-hidden="true">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-3">
                  Recoverable contribution next month
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
                <p className={cn(
                  "text-2xl font-display font-bold leading-none tabular-nums",
                  simContribution > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                )}>
                  {simContribution > 0 ? `+£${simContribution.toLocaleString()}` : "—"}
                </p>
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
                  <div key={label} className="rounded-xl bg-white/70 dark:bg-slate-800/40 border border-border/50 px-4 py-3">
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
                Fastest recovery lever identified
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

      {/* ══════════════════════════════════════════════════════════════════════
          §2  OPPORTUNITIES
          Ranked by expected contribution uplift next month
      ══════════════════════════════════════════════════════════════════════ */}

      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">Opportunities</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Ranked by contribution uplift — {framing.rowLabel}, at {framing.baselineNote}.
        </p>
      </div>

      {/* ── Structured opportunities panel ── */}
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 shadow-sm mb-8 overflow-hidden">

        {/* ── Hero headline ── */}
        <div className="bg-emerald-50 dark:bg-emerald-950/25 px-8 py-6 border-b border-emerald-200 dark:border-emerald-800/40">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Recoverable contribution — {framing.rowLabel}
            </p>
          </div>
          {/* Dual metric row — £ value + pp equivalent */}
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3 mb-3">
            {/* Primary: cash value */}
            <div>
              <p className="text-5xl font-display font-bold text-emerald-700 dark:text-emerald-300 leading-none">
                £{ESTIMATED_CONTRIBUTION.toLocaleString()}
              </p>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5">
                +{OPPORTUNITY_UPLIFT_PCT}% contribution uplift vs current marketing contribution profit
              </p>
            </div>
            {/* Secondary: margin pp equivalent */}
            <div className="pl-7 border-l-2 border-emerald-300/60 dark:border-emerald-700/40 pb-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/60 mb-1">
                Equivalent to
              </p>
              <p className="text-3xl font-display font-bold text-emerald-600 dark:text-emerald-400 leading-none">
                +{ME_TOTAL_PP.toFixed(1)}pp
              </p>
              <p className="text-xs text-emerald-700/60 dark:text-emerald-400/60 leading-snug mt-1">
                marketing contribution margin
              </p>
            </div>
          </div>

          {/* Confidence breakdown */}
          <div className="flex flex-col gap-1 mb-3">
            {ME_CONFIDENCE_TOTALS.high > 0 && (
              <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
                <span className="font-semibold">High confidence</span>&ensp;£{ME_CONFIDENCE_TOTALS.high.toLocaleString()}
              </p>
            )}
            {ME_CONFIDENCE_TOTALS.medium > 0 && (
              <p className="text-xs text-emerald-700/60 dark:text-emerald-400/60 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 dark:bg-emerald-400/50 shrink-0" />
                <span className="font-semibold">Medium confidence</span>&ensp;£{ME_CONFIDENCE_TOTALS.medium.toLocaleString()}
              </p>
            )}
            {ME_CONFIDENCE_TOTALS.low > 0 && (
              <p className="text-xs text-emerald-700/40 dark:text-emerald-400/40 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/30 dark:bg-emerald-400/30 shrink-0" />
                <span className="font-semibold">Requires validation</span>&ensp;£{ME_CONFIDENCE_TOTALS.low.toLocaleString()}
              </p>
            )}
          </div>

          <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 leading-snug">
            Based on quantified budget reallocation impact from the {framing.baselineNote}
          </p>
          <p className="text-xs text-emerald-700/50 dark:text-emerald-400/50 leading-snug mt-1">
            Current Marketing Contribution Profit: £{MKT_CP.toLocaleString()} · {periodBadge}
          </p>
        </div>

        {/* ── Opportunity rows — gated by plan via inline blur pattern ── */}
        <div className="bg-card">

          {/* Column header — always visible; badge shown when locked */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Top opportunities driving this estimate
            </p>
            {canAccess("opportunity_breakdown") ? (
              <div className="flex items-center gap-5 shrink-0 ml-4 text-right">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-12 text-right">
                  CM uplift
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28 text-right">
                  £ uplift
                </span>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider whitespace-nowrap shrink-0">
                PRO — Unlock opportunity breakdown
              </span>
            )}
          </div>

          {canAccess("opportunity_breakdown") ? (
            /* ── PRO: full rows + combined footer ── */
            <>
              <div className="divide-y divide-border/40">
                {ME_OPPORTUNITIES.map((o, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-6 py-4 hover:bg-secondary/20 transition-colors gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 shrink-0 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{o.shortLabel}</p>
                          <span className={cn(
                            "inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap border",
                            o.confidence === "high"
                              ? "bg-secondary text-muted-foreground border-border/60"
                              : o.confidence === "medium"
                              ? "bg-blue-50 dark:bg-blue-950/25 text-blue-600 dark:text-blue-400 border-blue-200/60 dark:border-blue-700/40"
                              : "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-700/40"
                          )}>
                            {o.confidence === "high" ? "High confidence" : o.confidence === "medium" ? "Medium confidence" : "Requires validation"}
                          </span>
                          <span className={cn(
                            "inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap",
                            o.effort === "low"
                              ? "bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400"
                              : o.effort === "medium"
                              ? "bg-orange-50 dark:bg-orange-950/20 text-orange-500 dark:text-orange-400"
                              : "bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400"
                          )}>
                            {o.effort === "low" ? "Low effort" : o.effort === "medium" ? "Medium effort" : "High effort"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{o.detail}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-5 shrink-0 ml-4">
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap tabular-nums w-12 text-right pt-0.5">
                        +{o.ppGain.toFixed(1)}pp
                      </span>
                      <div className="text-right w-28">
                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 tabular-nums leading-none">
                          £{o.cashImpact.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/50 mt-1 leading-snug">
                          {framing.impactBasis}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Combined impact footer */}
              <div className="flex items-center justify-between px-6 py-4 bg-emerald-50/70 dark:bg-emerald-950/15 border-t border-emerald-200 dark:border-emerald-800/40 gap-4">
                <p className="text-sm font-semibold text-foreground">
                  Combined impact — {framing.combinedLabel}
                </p>
                <div className="flex items-start gap-5 shrink-0 ml-4">
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap tabular-nums w-12 text-right pt-0.5">
                    +{ME_TOTAL_PP}pp
                  </span>
                  <div className="text-right w-28">
                    <p className="text-base font-bold text-emerald-700 dark:text-emerald-300 tabular-nums leading-none">
                      ≈ £{ESTIMATED_CONTRIBUTION.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/50 mt-1 leading-snug">
                      {framing.impactBasis}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* ── FREE: full rows blurred + gradient + indigo upgrade card ── */
            <div className="relative">

              {/* Ghost rows — softer labels, dot ratings, muted values */}
              <div className="pointer-events-none select-none" aria-hidden="true">
                <div className="divide-y divide-border/40">
                  {ME_OPPORTUNITIES.map((o, i) => (
                    <div key={i} className="flex items-center justify-between px-6 py-4 gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Ranking bullet — muted in free mode so ordering feels less explicit */}
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-border/50 dark:bg-slate-700/30 shrink-0 text-[11px] font-medium text-foreground/30">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          {/* Soft action label — generalised vs Pro-specific wording */}
                          <p className="text-sm font-semibold text-foreground leading-snug">
                            {ME_GHOST_LABELS[o.shortLabel] ?? o.shortLabel}
                          </p>
                          {/* Dot indicators — replace explicit confidence/effort text */}
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="inline-flex items-center gap-[2px] text-[9px]">
                              <span className="text-foreground/25 mr-0.5">conf</span>
                              {[0,1,2].map(j => {
                                const f = o.confidence === "high" ? 3 : o.confidence === "medium" ? 2 : 1;
                                return <span key={j} className={j < f ? "text-foreground/40" : "text-foreground/15"}>{j < f ? "●" : "○"}</span>;
                              })}
                            </span>
                            <span className="inline-flex items-center gap-[2px] text-[9px]">
                              <span className="text-foreground/25 mr-0.5">effort</span>
                              {[0,1,2].map(j => {
                                const f = o.effort === "low" ? 1 : o.effort === "medium" ? 2 : 3;
                                return <span key={j} className={j < f ? "text-foreground/40" : "text-foreground/15"}>{j < f ? "●" : "○"}</span>;
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Value columns — deeper masking than left-side labels */}
                      <div className="flex items-start gap-5 shrink-0 ml-4">
                        <span className="text-sm font-bold whitespace-nowrap tabular-nums w-12 text-right pt-0.5 text-foreground/[0.13]">
                          +—.—pp
                        </span>
                        <div className="text-right w-28">
                          <p className="text-sm font-bold tabular-nums leading-none text-foreground/[0.13]">
                            £ —,—
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Combined footer — value more muted than label */}
                <div className="flex items-center justify-between px-6 py-4 bg-emerald-50/70 dark:bg-emerald-950/15 border-t border-emerald-200 dark:border-emerald-800/40 gap-4">
                  <p className="text-sm font-semibold text-foreground">Combined impact — {framing.combinedLabel}</p>
                  <span className="text-base font-bold tabular-nums text-foreground/[0.13]">
                    £ —,—
                  </span>
                </div>
              </div>

              {/* Gradient fade */}
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent rounded-b-xl pointer-events-none" />

              {/* Indigo upgrade card */}
              <div className="relative mx-6 mb-5 mt-4">
                <a
                  href="/upgrade"
                  className="flex items-center justify-between gap-4 rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/90 dark:bg-indigo-950/40 px-5 py-4 shadow-lg shadow-indigo-500/10 dark:shadow-indigo-900/30 hover:border-indigo-300 hover:bg-indigo-100/90 dark:hover:border-indigo-600 dark:hover:bg-indigo-900/45 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0 mt-0.5">
                      <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 leading-snug">
                        Unlock detailed opportunity breakdown
                      </p>
                      <p className="text-xs text-indigo-700/70 dark:text-indigo-400/70 mt-1 leading-snug">
                        See the estimated £ impact, confidence level, and implementation effort for each action.
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap shrink-0 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                    Upgrade →
                  </span>
                </a>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          §3  ACTUAL PERFORMANCE
          KPI headline metrics for the selected period
      ══════════════════════════════════════════════════════════════════════ */}

      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground">Actual Performance</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Key marketing efficiency metrics · {periodBadge}
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
              favorable={MKT_CP_CHANGE_MOM > 0}
            />
            <VarLine
              label="vs 12-month avg"
              value={`↑ £${MKT_CP_CHANGE_LY.toLocaleString()}`}
              favorable={MKT_CP_CHANGE_LY > 0}
            />
          </div>
          <p className="text-xs text-muted-foreground leading-snug">Revenue remaining after all marketing costs</p>
        </div>

        {/* 2 — Blended CAC */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Blended CAC</p>
          <p className="text-3xl font-display font-bold text-foreground mb-2">£{BLENDED_CAC.toFixed(2)}</p>
          <div className="space-y-0.5 mb-2">
            <VarLine
              label="vs last month"
              value={`↑ £${BLENDED_CAC_CHANGE.toFixed(2)}`}
              favorable={BLENDED_CAC_CHANGE < 0}
            />
            <VarLine
              label="vs 12-month avg"
              value={`↑ £${BLENDED_CAC_CHANGE_LY.toFixed(2)}`}
              favorable={BLENDED_CAC_CHANGE_LY < 0}
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
              favorable={BLENDED_ROAS_CHANGE_MOM > 0}
            />
            <VarLine
              label="vs 12-month avg"
              value={`↓ ${Math.abs(BLENDED_ROAS_CHANGE_LY).toFixed(1)}×`}
              favorable={BLENDED_ROAS_CHANGE_LY > 0}
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
              favorable={CAC_PAYBACK < CAC_PAYBACK_PREV}
            />
            <VarLine
              label="vs 12-month avg"
              value={`↑ ${(CAC_PAYBACK - CAC_PAYBACK_LY).toFixed(1)} orders`}
              favorable={CAC_PAYBACK < CAC_PAYBACK_LY}
            />
          </div>
          <p className="text-xs text-muted-foreground leading-snug">Orders needed to recover the cost of acquiring each new customer</p>
        </div>

        {/* 5 — Marketing Contribution Margin */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Marketing Contribution Margin</p>
          <p className="text-3xl font-display font-bold text-foreground mb-2">{MKT_CM}%</p>
          <div className="space-y-0.5 mb-2">
            <VarLine
              label="vs last month"
              value={`↓ ${Math.abs(MKT_CM_CHANGE).toFixed(1)}pp`}
              favorable={MKT_CM_CHANGE > 0}
            />
            <VarLine
              label="vs 12-month avg"
              value={`↓ ${Math.abs(MKT_CM_CHANGE_LY).toFixed(1)}pp`}
              favorable={MKT_CM_CHANGE_LY > 0}
            />
          </div>
          <p className="text-xs text-muted-foreground leading-snug">Blended contribution margin after all marketing costs</p>
        </div>

        {/* 6 — Marketing Contribution per Order */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Contribution per Order</p>
          <p className="text-3xl font-display font-bold text-foreground mb-2">
            £{MKT_CP_PER_ORDER.toFixed(2)}
          </p>
          <div className="space-y-0.5 mb-2">
            <VarLine
              label="vs last month"
              value={`↓ £${Math.abs(MKT_CP_PER_ORDER_CHANGE_MOM).toFixed(2)}`}
              favorable={MKT_CP_PER_ORDER_CHANGE_MOM > 0}
            />
            <VarLine
              label="vs 12-month avg"
              value={`↓ £${Math.abs(MKT_CP_PER_ORDER_CHANGE_LY).toFixed(2)}`}
              favorable={MKT_CP_PER_ORDER_CHANGE_LY > 0}
            />
          </div>
          <p className="text-xs text-muted-foreground leading-snug">Contribution profit generated per order after marketing cost</p>
        </div>

        {/* 7 — Contribution per £1 of Marketing Spend */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Contribution per £1 Marketing Spend</p>
          <p className="text-3xl font-display font-bold text-foreground mb-2">
            £{CP_PER_SPEND.toFixed(2)}
          </p>
          <div className="space-y-0.5 mb-2">
            <VarLine
              label="vs last month"
              value={`${CP_PER_SPEND_CHANGE_MOM < 0 ? "↓" : "↑"} £${Math.abs(CP_PER_SPEND_CHANGE_MOM).toFixed(2)}`}
              favorable={CP_PER_SPEND_CHANGE_MOM > 0}
            />
            <VarLine
              label="vs 12-month avg"
              value={`${CP_PER_SPEND_CHANGE_LY < 0 ? "↓" : "↑"} £${Math.abs(CP_PER_SPEND_CHANGE_LY).toFixed(2)}`}
              favorable={CP_PER_SPEND_CHANGE_LY > 0}
            />
          </div>
          <p className="text-xs text-muted-foreground leading-snug">Contribution generated for every £1 of marketing spend</p>
        </div>

      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          §4  ALLOCATION DIAGNOSTICS
          Channel-level contribution breakdown and budget allocation analysis
      ══════════════════════════════════════════════════════════════════════ */}

      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground">Allocation Diagnostics</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Where budget is currently creating — or destroying — contribution value.
        </p>
      </div>

      {/* Contribution Profit by Channel — sub-section of Allocation Diagnostics */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 mb-10">

        {/* Sub-heading row */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
          <div>
            <h3 className="font-semibold text-base text-foreground">Contribution Profit by Channel (£)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Which channels generate the most contribution profit after marketing cost
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
            <span className="font-semibold text-foreground">
              Total: £{totalAttributedCp.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Diagnostic insight line */}
        <div className="flex items-start gap-2 px-3.5 py-2.5 mb-5 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-700/30">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700/90 dark:text-amber-400/80 leading-snug">
            <span className="font-semibold">£{ALLOC_LOSS_CP.toLocaleString()}</span> of contribution profit is currently being lost due to sub-optimal channel allocation.
          </p>
        </div>

        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[...CHANNEL_CP].sort((a, b) => b.cp - a.cp)}
              layout="vertical"
              margin={{ top: 0, right: 90, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                tickFormatter={(v: number) => `£${(v / 1000).toFixed(0)}k`}
                axisLine={false} tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <YAxis
                type="category" dataKey="channel"
                axisLine={false} tickLine={false}
                tick={{ fill: "hsl(var(--foreground))", fontSize: 13, fontWeight: 500 }}
                width={130}
              />
              <Tooltip
                formatter={(v: number) => [`£${v.toLocaleString()}`, "Contribution Profit"]}
                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 16px rgb(0 0 0 / .12)" }}
              />
              <Bar dataKey="cp" radius={[0, 7, 7, 0]} maxBarSize={44}
                label={{ position: "right", formatter: (v: number) => `£${v.toLocaleString()}`,
                  fill: "hsl(var(--foreground))", fontSize: 13, fontWeight: 700 }}
              >
                {[...CHANNEL_CP].sort((a, b) => b.cp - a.cp).map((entry) => (
                  <Cell key={entry.channel}
                    fill={entry.cp === maxCp ? "#22c55e" : entry.cp === minCp ? "#ef4444" : "hsl(var(--primary))"}
                    opacity={entry.cp === maxCp || entry.cp === minCp ? 1 : 0.6}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-4 pt-4 border-t border-border/40 text-sm text-muted-foreground leading-relaxed">
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Email</span> generates{" "}
          <span className="font-semibold text-foreground">
            {Math.round((CHANNEL_CP.find((c) => c.channel === "Email")!.cp / totalAttributedCp) * 100)}%
          </span>{" "}
          of attributed contribution on{" "}
          <span className="font-semibold text-foreground">
            {Math.round((CHANNEL_CM.find((c) => c.channel === "Email")!.revenue / totalChannelRevenue) * 100)}%
          </span>{" "}
          of revenue — the most efficient channel in the mix.{" "}
          <span className="font-semibold text-red-500">Meta</span>'s £2,100 contribution on the largest
          paid spend signals misallocated budget and is the primary reallocation candidate.
        </p>

      </div>

      {/* Contribution per Order by Channel — sub-section of Allocation Diagnostics */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 mb-10">

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

        {/* Interpretation note */}
        <p className="mt-5 pt-4 border-t border-border/40 text-sm text-muted-foreground leading-relaxed">
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Email</span>{" "}
          generates <span className="font-semibold text-foreground">£{(maxCpo).toFixed(2)}</span> per
          order — <span className="font-semibold text-foreground">
            {((maxCpo / minCpo)).toFixed(1)}×
          </span>{" "}
          more contribution per order than{" "}
          <span className="font-semibold text-red-500">Meta</span> (£{minCpo.toFixed(2)}).
          Shifting volume toward higher-CPO channels directly improves blended contribution margin without
          increasing revenue.
        </p>

      </div>

      {/* Revenue Share vs Contribution Share — sub-section of Allocation Diagnostics */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 mb-10">

        {/* Sub-heading */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h3 className="font-semibold text-base text-foreground">Revenue Share vs Contribution Share</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compare which channels generate revenue versus which channels generate contribution profit
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-slate-400/60 inline-block" />Revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Contribution ↑
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />Contribution ↓
            </span>
          </div>
        </div>

        {/* Channel rows */}
        <div className="space-y-1">
          {CHANNEL_SHARE.map((row) => {
            const positive = row.delta >= 0;
            const cpColor = positive
              ? "bg-emerald-500"
              : "bg-red-500";
            const cpTextColor = positive
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-500 dark:text-red-400";
            const deltaBg = positive
              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
              : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400";
            return (
              <div key={row.channel} className="py-4 border-b border-border/40 last:border-0">

                {/* Channel name + delta badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-foreground">{row.channel}</span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${deltaBg}`}>
                    {positive ? "▲" : "▼"} {positive ? "+" : ""}{row.delta}pp
                  </span>
                </div>

                {/* Revenue bar */}
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[11px] text-muted-foreground w-24 shrink-0">Revenue</span>
                  <div className="flex-1 h-4 bg-secondary/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-400/60 rounded-full transition-all"
                      style={{ width: `${row.revShare}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground tabular-nums w-8 text-right">
                    {row.revShare}%
                  </span>
                </div>

                {/* Contribution bar */}
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground w-24 shrink-0">Contribution</span>
                  <div className="flex-1 h-4 bg-secondary/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${cpColor}`}
                      style={{ width: `${row.cpShare}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold tabular-nums w-8 text-right ${cpTextColor}`}>
                    {row.cpShare}%
                  </span>
                </div>

              </div>
            );
          })}
        </div>

        {/* Interpretation note */}
        <p className="mt-5 pt-4 border-t border-border/40 text-sm text-muted-foreground leading-relaxed">
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Email</span> and{" "}
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Organic</span> both
          return more contribution than their revenue share suggests — they punch above their weight and
          should be protected and grown.{" "}
          <span className="font-semibold text-red-500">Google Shopping</span> and{" "}
          <span className="font-semibold text-red-500">Meta</span> consume a disproportionate share of
          revenue while returning significantly less contribution — a clear signal of over-investment
          relative to profitability.
        </p>

      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          §5  KEY DRIVERS
          Attributed causes: what changed and the £ contribution impact
      ══════════════════════════════════════════════════════════════════════ */}

      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground">Key Drivers</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          What changed over {periodPhrase} and the financial impact on marketing efficiency.
        </p>
      </div>

      {/* Summary block */}
      <div className="flex items-start justify-between mb-4 px-5 py-4 rounded-xl bg-destructive/5 border border-destructive/15 gap-6">
        <p className="text-sm font-semibold text-foreground mt-0.5">
          Total marketing efficiency impact — {periodBadge}
        </p>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold tabular-nums leading-none text-destructive">
            −£{Math.abs(ME_DRIVERS_TOTAL).toLocaleString()}
          </p>
          <p className="text-xs font-medium tabular-nums mt-1.5 leading-none text-destructive/70">
            contribution impact
          </p>
        </div>
      </div>

      <PremiumBlurPreview
        title="Key Drivers"
        subtitle="What changed vs last month and the contribution impact."
        badgeText="PRO — Unlock margin drivers"
        ctaTitle="Unlock attributed driver breakdown"
        ctaDescription="See exactly which cost or mix changes drove the most contribution impact, with per-driver £ attribution."
        isPro={canAccess("driver_breakdown")}
        className="overflow-hidden mb-10"
        ghostContent={
          <div className="-mx-6 -mb-6">
            <div className="flex items-center justify-between px-6 py-3 border-t border-border/50 bg-secondary/20">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                What changed vs last month
              </p>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Contribution impact
              </p>
            </div>
            {ME_DRIVER_GROUPS.map((group) => {
              const groupDrivers = ME_DRIVERS
                .filter((d) => d.category === group.key)
                .sort((a, b) => a.impact - b.impact);
              if (!groupDrivers.length) return null;
              return (
                <div key={group.key}>
                  <div className="flex items-center justify-between px-6 py-2 border-y border-border/40 bg-secondary/30">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">{group.label}</p>
                    <p className="text-[11px] font-bold tabular-nums text-foreground/25 dark:text-foreground/20">−£ —,———</p>
                  </div>
                  <div className="divide-y divide-border/30">
                    {groupDrivers.map((row) => (
                      <div key={row.driver} className="flex items-center justify-between px-6 py-4 gap-6">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={cn(
                            "w-1 self-stretch rounded-full shrink-0 min-h-[2rem] mt-0.5",
                            row.driver === ME_LARGEST_DRIVER ? "bg-destructive" : "bg-destructive/25"
                          )} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-semibold text-foreground">{ME_DRIVER_GHOST_LABELS[row.driver] ?? row.driver}</span>
                              {row.driver === ME_LARGEST_DRIVER && (
                                <span className="inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 whitespace-nowrap">
                                  Largest driver
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-foreground/20 dark:text-foreground/15 leading-snug">—— —— —— ——</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold whitespace-nowrap shrink-0 tabular-nums text-foreground/25 dark:text-foreground/20">
                          −£ —,———
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-border/50 bg-secondary/20">
              <p className="text-xs font-semibold text-foreground">Total attributed impact — {periodBadge}</p>
              <p className="text-sm font-bold tabular-nums text-foreground/25 dark:text-foreground/20">−£ —,———</p>
            </div>
          </div>
        }
      >
        {/* Negative-margin wrapper extends table flush to card edges */}
        <div className="-mx-6 -mb-6">

          {/* Column headers */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-border/50 bg-secondary/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              What changed vs last month
            </p>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contribution impact
            </p>
          </div>

          {/* Grouped driver rows */}
          {ME_DRIVER_GROUPS.map((group) => {
            const groupDrivers = ME_DRIVERS
              .filter((d) => d.category === group.key)
              .sort((a, b) => a.impact - b.impact);
            if (!groupDrivers.length) return null;
            const groupTotal = groupDrivers.reduce((s, d) => s + d.impact, 0);
            return (
              <div key={group.key}>
                {/* Group heading row */}
                <div className="flex items-center justify-between px-6 py-2 border-y border-border/40 bg-secondary/30">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
                    {group.label}
                  </p>
                  <p className="text-[11px] font-bold tabular-nums text-destructive/60">
                    −£{Math.abs(groupTotal).toLocaleString()}
                  </p>
                </div>
                {/* Driver rows within group */}
                <div className="divide-y divide-border/30">
                  {groupDrivers.map((row) => {
                    const isLargest = row.driver === ME_LARGEST_DRIVER;
                    const impactAbs = Math.abs(row.impact);
                    return (
                      <div
                        key={row.driver}
                        className="flex items-center justify-between px-6 py-4 gap-6 hover:bg-secondary/20 transition-colors"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={cn(
                            "w-1 self-stretch rounded-full shrink-0 min-h-[2rem] mt-0.5",
                            isLargest ? "bg-destructive" : "bg-destructive/25"
                          )} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-semibold text-foreground">{row.driver}</span>
                              {isLargest && (
                                <span className="inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 whitespace-nowrap">
                                  Largest driver
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground leading-snug">{row.cause}</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold whitespace-nowrap shrink-0 tabular-nums text-destructive">
                          −£{impactAbs.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Total row */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-border/50 bg-secondary/20">
            <p className="text-xs font-semibold text-foreground">Total attributed impact — {periodBadge}</p>
            <p className="text-sm font-bold text-destructive tabular-nums">
              −£{Math.abs(ME_DRIVERS_TOTAL).toLocaleString()}
            </p>
          </div>

        </div>
      </PremiumBlurPreview>

      {/* ══════════════════════════════════════════════════════════════════════
          §6  DETAILED ANALYSIS
          CAC by channel, payback, contribution margin, and trend evidence
      ══════════════════════════════════════════════════════════════════════ */}

      {/* ── Section divider ── */}
      <div className="border-t border-border/50 pt-10 mb-2">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">
          Deep Dive
        </p>
        <h2 className="text-xl font-bold text-foreground">Detailed Analysis</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Supporting evidence behind current channel performance and efficiency trends.
        </p>
      </div>

      {/* ── Grouped sub-sections ── */}
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
              <span className="font-semibold text-foreground tabular-nums">£{BLENDED_CAC.toFixed(2)}</span>
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
            £{BLENDED_CAC.toFixed(2)}
          </span>
          <span className="text-xs text-muted-foreground/50 text-right">—</span>
          <span className="text-xs text-muted-foreground/50 text-right">—</span>
        </div>

        <div className="divide-y divide-border/40">
          {CAC_BY_CHANNEL.map((row) => {
            const cfg = EFFICIENCY_CONFIG[row.efficiency];
            /** @dynamic diff = row.cac − BLENDED_CAC (live) */
            const cacDiff = +(row.cac - BLENDED_CAC).toFixed(2);
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

        <div className="px-6 py-3 border-t border-border/40 bg-secondary/10">
          <p className="text-xs text-muted-foreground leading-snug">
            Meta CAC has risen {CAC_BY_CHANNEL[0].changeLabel} month-on-month and now exceeds the blended average by £{(CAC_BY_CHANNEL[0].cac - BLENDED_CAC).toFixed(2)} per order.
            Email and Organic remain well below the blended average.
          </p>
        </div>
      </div>

      {/* ── Attribution Confidence Note — visible Free + Pro ── */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-secondary/40 border border-border/50">
        <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Channel-level contribution estimates assume revenue attribution from platform reporting (Meta / Google).
          Cross-channel attribution differences may slightly affect efficiency comparisons.
        </p>
      </div>

      {/* CAC Payback by Channel — Pro gated via PremiumBlurPreview */}
      <PremiumBlurPreview
        title="CAC Payback by Channel"
        subtitle="Orders required to recover acquisition cost using contribution profit per order."
        badgeText="PRO — Unlock cash recovery diagnostics"
        headerExtra={
          <div className="text-right pt-0.5">
            <p className="text-xs text-muted-foreground">Blended avg</p>
            <p className="text-sm font-bold text-foreground tabular-nums">{CAC_PAYBACK} orders</p>
          </div>
        }
        ctaTitle="Unlock CAC payback by channel"
        ctaDescription="Identify which channels delay cash recovery and increase working capital pressure."
        isPro={canAccess("cac_payback")}
        ghostContent={
          <div className="space-y-4">
            {(() => {
              const ghostWidths = ["20%", "28%", "45%", "72%"];
              return [...PAYBACK_BY_CHANNEL]
                .sort((a, b) => a.payback - b.payback)
                .map((row, i) => {
                  const overThreshold = row.payback > PAYBACK_THRESHOLD;
                  return (
                    <div key={row.channel}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-foreground">{PAYBACK_CHANNEL_GHOST_NAMES[i] ?? `Channel ${i + 1}`}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium tabular-nums text-foreground/25 dark:text-foreground/20">—.— avg</span>
                          <span className="text-sm font-bold tabular-nums text-foreground/25 dark:text-foreground/20">—.— orders</span>
                          {overThreshold && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                              Above target
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="relative w-full" style={{ height: "20px" }}>
                        <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 bg-slate-400/60 dark:bg-slate-500/60 rounded-sm z-10" style={{ left: "38%" }} />
                        <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 bg-destructive/40 rounded-sm z-10" style={{ left: "55%" }} />
                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={cn("h-2 rounded-full", overThreshold ? "bg-destructive/70" : "bg-emerald-500/70")}
                            style={{ width: ghostWidths[i] }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                });
            })()}
            <div className="mt-5 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-block w-6 border-t border-dashed border-slate-400/70 dark:border-slate-500/70 shrink-0" />
                <span>Blended avg: <span className="font-semibold tabular-nums text-foreground/25 dark:text-foreground/20">—.— orders</span></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-block w-6 border-t border-dashed border-destructive/60 shrink-0" />
                <span>Target threshold: <span className="font-semibold tabular-nums text-foreground/25 dark:text-foreground/20">—.— orders</span>. Channels above this reduce short-term cash efficiency.</span>
              </div>
            </div>
          </div>
        }
      >
        {/* ── Chart rows — real data, blurred for free users ── */}
        <div className="space-y-4">
          {[...PAYBACK_BY_CHANNEL].sort((a, b) => a.payback - b.payback).map((row) => {
            const overThreshold = row.payback > PAYBACK_THRESHOLD;
            const barPct = Math.min((row.payback / 3) * 100, 100);
            /** @dynamic diff = row.payback − CAC_PAYBACK (live) */
            const paybackDiff = +(row.payback - CAC_PAYBACK).toFixed(1);
            const absPaybackDiff = Math.abs(paybackDiff);
            const paybackDiffLabel =
              paybackDiff === 0
                ? "at avg"
                : `${absPaybackDiff} ${paybackDiff > 0 ? "above" : "below"} avg`;
            /** @dynamic reference line positions within 0–3 order scale */
            const blendedPct = (CAC_PAYBACK / 3) * 100;
            const thresholdPct = (PAYBACK_THRESHOLD / 3) * 100;
            return (
              <div key={row.channel}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-foreground">{row.channel}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[11px] font-medium tabular-nums",
                        paybackDiff > 0
                          ? "text-destructive/70"
                          : "text-emerald-600/70 dark:text-emerald-400/70"
                      )}
                    >
                      {paybackDiffLabel}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        overThreshold ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {row.payback} orders
                    </span>
                    {overThreshold && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                        Above target
                      </span>
                    )}
                  </div>
                </div>
                {/* Bar track with reference line ticks */}
                <div className="relative w-full" style={{ height: "20px" }}>
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 bg-slate-400/60 dark:bg-slate-500/60 rounded-sm z-10 pointer-events-none"
                    style={{ left: `calc(${blendedPct}% - 1px)` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 bg-destructive/40 rounded-sm z-10 pointer-events-none"
                    style={{ left: `calc(${thresholdPct}% - 1px)` }}
                  />
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={cn("h-2 rounded-full transition-all", overThreshold ? "bg-destructive" : "bg-emerald-500")}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-5 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block w-6 border-t border-dashed border-slate-400/70 dark:border-slate-500/70 shrink-0" />
            <span>Blended avg: <span className="font-semibold tabular-nums">{CAC_PAYBACK} orders</span></span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block w-6 border-t border-dashed border-destructive/60 shrink-0" />
            <span>
              Target threshold: <span className="font-semibold tabular-nums">{PAYBACK_THRESHOLD} orders</span>. Channels above this
              reduce short-term cash efficiency and increase growth risk.
            </span>
          </div>
        </div>

        {/* @dynamic Insight: identifies the worst channel above blended avg */}
        {(() => {
          const worst = [...PAYBACK_BY_CHANNEL].reduce((a, b) => a.payback > b.payback ? a : b);
          const worstDiff = +(worst.payback - CAC_PAYBACK).toFixed(1);
          return worstDiff > 0 ? (
            <p className="mt-4 text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-3">
              <span className="font-semibold text-foreground">{worst.channel}</span> payback is{" "}
              <span className="font-semibold tabular-nums">{worstDiff} orders</span> slower than the blended average, increasing short-term cash recovery risk.
            </p>
          ) : null;
        })()}
      </PremiumBlurPreview>

      {/*
       * ── FUTURE SECTION (Pro-only deep-dive) ──────────────────────────────
       * Repeat vs New Customer Contribution Split
       * How much contribution is generated by repeat customers vs new
       * acquisition — and where margin is leaking. Unlocked at Pro tier.
       *
       * When built, this should render a side-by-side or stacked bar chart
       * comparing: repeat customer contribution profit vs new customer
       * contribution profit, alongside retention rate and LTV signals.
       * ─────────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-dashed border-border/60 p-6 mb-6 opacity-60">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-base text-muted-foreground">
            Repeat vs New Customer Contribution Split
          </h3>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary/60 border border-primary/20 uppercase tracking-wider whitespace-nowrap">
            Pro · Coming soon
          </span>
        </div>
        <p className="text-sm text-muted-foreground/70 leading-snug">
          How much contribution is generated by repeat customers vs new acquisition — and where margin is leaking.
        </p>
      </div>

      {/* Marketing Efficiency Trend */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6">
        <div className="mb-5">
          <h3 className="font-semibold text-lg text-foreground">Marketing Efficiency Trend</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Blended CAC and ROAS over the past 12 months.
          </p>
        </div>

        <div className="flex items-center gap-6 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-destructive inline-block rounded" />
            <span className="text-xs text-muted-foreground">Blended CAC (£)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-primary inline-block rounded" />
            <span className="text-xs text-muted-foreground">Blended ROAS (×)</span>
          </div>
        </div>

        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={TREND_DATA} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                dy={8}
              />
              <YAxis
                yAxisId="cac"
                orientation="left"
                domain={[6, 14]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickFormatter={(v: number) => `£${v}`}
              />
              <YAxis
                yAxisId="roas"
                orientation="right"
                domain={[2, 5]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickFormatter={(v: number) => `${v}×`}
              />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgb(0 0 0 / .1)" }}
                formatter={(value: number, name: string) =>
                  name === "cac" ? [`£${value.toFixed(2)}`, "Blended CAC"] : [`${value}×`, "Blended ROAS"]
                }
              />
              <Line yAxisId="cac" type="monotone" dataKey="cac" stroke="#ef4444" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              <Line yAxisId="roas" type="monotone" dataKey="roas" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-muted-foreground mt-3 leading-snug">
          Marketing efficiency has declined over the last 3 months due to rising paid acquisition costs.
          CAC increased from £9.20 in September to £12.20 in March — a 33% increase in 6 months.
        </p>
      </div>

      </div>{/* end Detailed Analysis group */}

      {/* Recommended actions */}
      <div className="mt-10">
        <ActionRecommendations
          recommendations={RECOMMENDATIONS}
          title="What to do next"
          subtitle="Practical actions to improve marketing efficiency and contribution margin"
          defaultExpanded
        />
      </div>

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

    </AppLayout>
  );
}
