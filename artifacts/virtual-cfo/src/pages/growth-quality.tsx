import { useState, useEffect } from "react";
import { Sparkles, TrendingUp, TrendingDown, Minus, ArrowRight, Lock } from "lucide-react";
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { canAccess } from "@/lib/plan";
import { useTimeline } from "@/lib/timeline";
import { TimelineSelector } from "@/components/TimelineSelector";
import { DataBenchmarkAssumptions } from "@/components/DataBenchmarkAssumptions";
import { AiCfoAskCard } from "@/components/AiCfoAskCard";
import {
  REPEAT_RATE,
  REPEAT_RATE_PREV,
  DISCOUNT_DEP,
  DISCOUNT_DEP_PREV,
  CAC_PAYBACK,
  CAC_PAYBACK_PREV,
} from "@/lib/data/growth-metrics";
import { useLatestDataPeriod } from "@/lib/analytics/useLatestDataPeriod";
import { usePhase2Deltas } from "@/lib/analytics/usePhase2Deltas";
import { DataPeriodLabel } from "@/components/DataPeriodLabel";
import {
  getMarketingChannelMetrics,
  findChannel,
  type ChannelMonthlyMetrics,
  type CacTrendPoint,
} from "@/lib/analytics/marketingChannelMetrics";

// ─── Store ID ─────────────────────────────────────────────────────────────────
// Dev store UUID — matches Dashboard, Margin Analysis, and Marketing Efficiency.
const GQ_STORE_ID = "10000000-0000-0000-0000-000000000001";

// ─── Data constants ──────────────────────────────────────────────────────────
// REPEAT_RATE, DISCOUNT_DEP, CAC_PAYBACK imported from
// src/lib/data/growth-metrics.ts — the central source of truth for growth metrics.
// REPEAT_RATE resolved to 28% (was 27% here; Dashboard and BENCHMARKS both use 28%).

const REPEAT_RATE_CHANGE  = +(REPEAT_RATE  - REPEAT_RATE_PREV).toFixed(1);
const DISCOUNT_DEP_CHANGE = +(DISCOUNT_DEP - DISCOUNT_DEP_PREV).toFixed(1);
const CAC_PAYBACK_CHANGE  = +(CAC_PAYBACK  - CAC_PAYBACK_PREV).toFixed(1);

type ScoreStatus = "strong" | "watch" | "weak" | "mixed" | "declining";

/**
 * @ai-commentary Replace with dynamically generated driver list when ready.
 * impact values:
 *   @dynamic retention  = (repeatRateDelta / 100) × qualityScoreWeight × gradePointScale
 *   @dynamic discount   = orderVolume × (discountDepthDelta / 100) × avgOrderRevenue
 *   @dynamic cac        = newCustVolume × (cacDelta / 100) × avgMarginRate
 *   @dynamic channelMix = blendedCACDelta × newCustVolume (contribution-margin adjusted)
 */
const KEY_DRIVERS: {
  text:      string;
  freeLabel: string;
  dir:       "positive" | "negative" | "neutral";
  impact:    string;
}[] = [
  {
    text:      "Repeat rate up 2.4pp — more customers returning without being paid for",
    freeLabel: "Retention signal improved",
    dir:       "positive",
    impact:    "The only component moving in the right direction this period — repeat rate up while all others weakened.",
  },
  {
    text:      "Discount depth up 1.8pp — contribution compressed on every discounted order",
    freeLabel: "Discount pressure increased",
    dir:       "negative",
    impact:    "Approximately £4.2k contribution drag at current order volume.",
  },
  {
    text:      "Meta CAC up 14% — new customers now cost more to acquire than one order recovers",
    freeLabel: "Paid acquisition efficiency weakened",
    dir:       "negative",
    impact:    "Approximately £3.1k more in new customer acquisition cost per month vs the prior period.",
  },
  {
    text:      "Email and organic share shrinking — blended CAC rising as the cheapest channels decline",
    freeLabel: "Channel mix quality weakened",
    dir:       "negative",
    impact:    "Blended CAC rising — second consecutive month of channel mix deterioration.",
  },
  {
    text:      "Email-driven orders still the most profitable — holding the floor on contribution quality",
    freeLabel: "Owned-channel contribution remained strongest",
    dir:       "positive",
    impact:    "Partially offsets the discount and CAC pressure — without email's contribution margin, the overall score would be materially lower.",
  },
];

/**
 * @dynamic Growth classification is computed from underlying metrics.
 * Rules (override when live data is connected):
 *   discount dependency > 35% AND declining repeat rate → "Promotion-led growth"
 *   repeat rate > 35% AND discount dep < 25%           → "Retention-led growth"
 *   paid channel share > 60%                           → "Paid-acquisition-led growth"
 *   contribution margin declining month-on-month       → "Margin-dilutive growth"
 */
const GROWTH_TYPE = {
  label:     "Promotion-led growth",
  risk:      "medium" as "low" | "medium" | "high",
  riskLabel: "Medium risk",
  signal:    "Revenue is growing, but the margin it generates is shrinking. Discounts and paid spend are doing the work that repeat customers should be doing.",
  /** @dynamic Derived from comparing current classification to prior period classification */
  priorPeriod: "Mix was more balanced last month — this is a deteriorating trend, not a one-off",
} as const;

/**
 * Growth composition — share of growth attributable to each acquisition/order type.
 * @dynamic repeat   = repeatOrders / totalOrders (previous period vs current)
 * @dynamic paid     = newPaidAcqOrders / totalOrders
 * @dynamic discount = discountedOrders (excl. already-counted repeat/paid) / totalOrders
 * All three sum to 100 for each month.
 */
const COMPOSITION_DATA = [
  { month: "Oct", repeat: 52, paid: 31, discount: 17 },
  { month: "Nov", repeat: 50, paid: 32, discount: 18 },
  { month: "Dec", repeat: 47, paid: 33, discount: 20 },
  { month: "Jan", repeat: 44, paid: 34, discount: 22 },
  { month: "Feb", repeat: 41, paid: 36, discount: 23 },
  { month: "Mar", repeat: 38, paid: 38, discount: 24 },
];

const COMPOSITION_LEGEND = [
  { key: "repeat",   color: "#22c55e", label: "Repeat-customer growth" },
  { key: "paid",     color: "#6366f1", label: "Paid-acquisition growth" },
  { key: "discount", color: "#f59e0b", label: "Discount-led growth"    },
] as const;

const GROWTH_RECOVERY_ACTIONS = [
  {
    id: "gq1",
    title: "Reduce discount dependency",
    expectedImpact: "£6k-£14k/month",
    confidence: "High",
    effort: "Medium",
    timing: "30 days",
    why: "Discounted orders are above target, so contribution is being lost on demand that may already exist.",
    start: "Audit active codes, suppress blanket discounts for returning customers, and keep offers tied to margin-protective thresholds.",
    link: "/pricing-optimisation",
    linkLabel: "Model pricing impact",
  },
  {
    id: "gq2",
    title: "Improve acquisition quality",
    expectedImpact: "£6k-£14k/month",
    confidence: "Medium",
    effort: "Medium",
    timing: "30-45 days",
    why: "Meta CAC is rising, so new-customer growth is costing more before it becomes contribution-positive.",
    start: "Tighten Meta budget to higher-margin acquisition cohorts and redirect testing budget toward Email, Organic and Google Shopping where contribution is stronger.",
    link: "/marketing-efficiency",
    linkLabel: "Review channel efficiency",
  },
  {
    id: "gq3",
    title: "Increase repeat purchase rate",
    expectedImpact: "Contribution quality lift",
    confidence: "Medium",
    effort: "Low",
    timing: "14-30 days",
    why: "Retention is the one improving signal; strengthening it reduces reliance on paid acquisition and blanket promotions.",
    start: "Launch post-purchase email journeys for first-order customers and target repeat rate above 30% before adding more acquisition spend.",
    link: "/scenario-lab",
    linkLabel: "Model repeat-rate scenario",
  },
] as const;

/**
 * Recoverable contribution upside — what could be recaptured if growth mix
 * and acquisition efficiency return to healthier levels.
 * @dynamic cashLow / cashHigh:
 *   Math.round(orderVolume × ppRecoveryLow × avgOrderRevenue)
 *   where ppRecoveryLow = target discount dep (25%) − current (38%) → ~3pp contribution gain
 *   and   ppRecoveryHigh includes CAC improvement contribution as well
 */
const RECOVERABLE_UPSIDE = {
  cashLow:  12_000,
  cashHigh: 28_000,
  /** @ai-commentary Replace with AI-generated narrative when live */
  supporting:
    "Reducing discount depth to target and improving Meta CAC efficiency unlocks an estimated £12k–£28k of contribution per month — without needing more revenue.",
  levers: [
    {
      id: "rv1",
      label: "Reduce discount dependency",
      description:
        "Cut discount depth from 38% toward the 25% target — margin recovers on orders already coming in, with no extra volume needed.",
      upliftLow:  6_000,
      upliftHigh: 14_000,
    },
    {
      id: "rv2",
      label: "Restore paid acquisition efficiency",
      description:
        "Reduce Meta CAC to prior-period levels — every new customer becomes meaningfully more profitable at current acquisition volume.",
      upliftLow:  6_000,
      upliftHigh: 14_000,
    },
  ],
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ScoreStatus, { label: string; bar: string; badge: string; text: string }> = {
  strong:   { label: "Strong",   bar: "bg-emerald-500",  badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300", text: "text-emerald-700 dark:text-emerald-300" },
  watch:    { label: "Watch",    bar: "bg-amber-400",    badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",        text: "text-amber-700 dark:text-amber-300"    },
  weak:     { label: "Weak",     bar: "bg-destructive",  badge: "bg-destructive/10 text-destructive",                                          text: "text-destructive"                      },
  mixed:    { label: "Mixed",    bar: "bg-slate-400",    badge: "bg-secondary text-muted-foreground",                                          text: "text-muted-foreground"                 },
  declining:{ label: "Declining",bar: "bg-amber-500",    badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",        text: "text-amber-700 dark:text-amber-300"    },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function GrowthQuality() {
  useTimeline();

  // ── Phase 1: live repeat rate and discount dependency ─────────────────────
  // Walks back from the current month to find the most recent month with data.
  // Only these two KPI headlines are wired — all other GQ metrics (GQ_SCORE,
  // CAC_PAYBACK, SCORE grades, composition chart, driver impacts) remain static
  // pending ad-platform integration and a prior-period RPC.
  const { phase1: gqPhase1, dateFrom: gqDateFrom, dateTo: gqDateTo, periodLabel: gqPeriodLabel, loading: gqPeriodLoading } = useLatestDataPeriod(GQ_STORE_ID);

  // ── Phase 2: month-on-month deltas ────────────────────────────────────────
  // Fires after useLatestDataPeriod resolves. Used for:
  //   - Repeat purchase rate change badge (replaces static REPEAT_RATE_CHANGE)
  //   - Discount dependency change badge (replaces static DISCOUNT_DEP_CHANGE)
  // A failure leaves gqDeltas null; badges fall back to static snapshots.
  const { deltas: gqDeltas, loading: gqDeltasLoading } = usePhase2Deltas(GQ_STORE_ID, gqDateFrom, gqDateTo);

  // ── Phase 3: marketing channel metrics (CAC payback + channel CM quality) ─
  // Fires once gqDateFrom / gqDateTo resolve. On failure leaves arrays empty
  // and blended null — all live values fall back to static constants.
  // gqPhase3Loading stays true until the RPC resolves or fails, preventing
  // the composite score from rendering with a mixed live/static input set.
  const [gqChannels,    setGqChannels]    = useState<ChannelMonthlyMetrics[]>([]);
  const [gqBlendedCm,   setGqBlendedCm]   = useState<number | null>(null);
  const [gqCacTrend,    setGqCacTrend]    = useState<CacTrendPoint[]>([]);
  const [gqPhase3Loading, setGqPhase3Loading] = useState(true);

  useEffect(() => {
    if (!gqDateFrom || !gqDateTo) return;
    let cancelled = false;
    setGqPhase3Loading(true);
    getMarketingChannelMetrics(GQ_STORE_ID, gqDateFrom, gqDateTo).then(({ channels, blended, cacTrend }) => {
      if (cancelled) return;
      setGqChannels(channels);
      setGqBlendedCm(blended?.blendedContributionMarginPct ?? null);
      setGqCacTrend(cacTrend);
      setGqPhase3Loading(false);
    }).catch(() => {
      if (!cancelled) setGqPhase3Loading(false);
    });
    return () => { cancelled = true; };
  }, [gqDateFrom, gqDateTo]);

  // ── Live repeat purchase rate % (1 d.p.) — fallback to static REPEAT_RATE.
  const liveRepeatRate = gqPhase1
    ? (gqPhase1.data.repeatPurchaseRate * 100).toFixed(1)
    : REPEAT_RATE.toFixed(1);

  // Raw numeric repeat rate — used in score formula.
  const liveRepeatRateNum = gqPhase1
    ? gqPhase1.data.repeatPurchaseRate * 100
    : REPEAT_RATE;

  // ── Live discount dependency % (1 d.p.) — fallback to static DISCOUNT_DEP.
  const liveDiscountDep = gqPhase1
    ? (gqPhase1.data.discountDependency * 100).toFixed(1)
    : DISCOUNT_DEP.toFixed(1);

  // Raw numeric discount dep — used in score formula.
  const liveDiscountDepNum = gqPhase1
    ? gqPhase1.data.discountDependency * 100
    : DISCOUNT_DEP;

  // ── Raw delta numbers for change badges.
  // During loading → static snapshot fallback value.
  // After load     → live pp value, or null (no prior period data → show "—").
  const liveRprChangePp     = !gqDeltasLoading
    ? (gqDeltas?.rpr_delta_pp ?? null)
    : REPEAT_RATE_CHANGE;
  const liveDiscDepChangePp = !gqDeltasLoading
    ? (gqDeltas?.discount_dep_delta_pp ?? null)
    : DISCOUNT_DEP_CHANGE;

  // ── Live CAC Payback ───────────────────────────────────────────────────────
  // Weighted average of cacPaybackOrders per channel, weighted by attributedOrders.
  // Falls back to static CAC_PAYBACK if Phase 3 data has not loaded or all channels
  // lack payback data (e.g. 0 attributed orders).
  const liveCacPayback: number = (() => {
    const valid = gqChannels.filter(
      (c) => c.cacPaybackOrders !== null && c.attributedOrders > 0,
    );
    if (valid.length === 0) return CAC_PAYBACK;
    const totalOrders  = valid.reduce((s, c) => s + c.attributedOrders, 0);
    const weightedSum  = valid.reduce((s, c) => s + (c.cacPaybackOrders! * c.attributedOrders), 0);
    return totalOrders > 0 ? +(weightedSum / totalOrders).toFixed(2) : CAC_PAYBACK;
  })();

  // ── CAC payback change vs prior period ────────────────────────────────────
  // Derived from the weighted blended MoM CAC % change in the trend data.
  // Payback is proportional to CAC, so a +14% CAC rise ≈ +14% payback rise.
  // Falls back to static CAC_PAYBACK_CHANGE if trend data is empty or no MoM
  // data exists (first seeded period has momChangePct = null).
  const liveCacPaybackChange: number = (() => {
    const withMom = gqCacTrend.filter(
      (p) => p.momChangePct !== null && p.attributedNewCustomers > 0,
    );
    if (withMom.length === 0) return +(CAC_PAYBACK - CAC_PAYBACK_PREV).toFixed(2);
    const totalNew     = withMom.reduce((s, p) => s + p.attributedNewCustomers, 0);
    const weightedPct  = withMom.reduce((s, p) => s + (p.momChangePct! * p.attributedNewCustomers), 0);
    const blendedMomPct = totalNew > 0 ? weightedPct / totalNew : 0;
    // Convert proportional CAC change to payback change in orders.
    return +(liveCacPayback * blendedMomPct).toFixed(2);
  })();

  // ── Growth Quality Score: 4-component weighted model ──────────────────────
  //
  // Each sub-score is normalised to 0–100, then combined:
  //   repeatScore    = clamp(repeatRatePct / 35 × 100, 0, 100)
  //   discountScore  = clamp((1 − max(0, discountDepPct − 15) / 35) × 100, 0, 100)
  //   cacScore       = clamp((2.0 − cacPayback) / 1.2 × 100, 0, 100)
  //   blendedCmScore = clamp((blendedCmPct × 100 − 25) / 30 × 100, 0, 100)
  //   composite      = repeatScore × 0.30 + discountScore × 0.25
  //                  + cacScore × 0.25   + blendedCmScore × 0.20
  //
  // Benchmarks:
  //   repeatScore:    35% repeat rate = 100;  0% = 0
  //   discountScore:  ≤15% dep = 100;         ≥50% = 0
  //   cacScore:       ≤0.8 payback = 100;     ≥2.0 = 0
  //   blendedCmScore: ≥55% CM = 100;          ≤25% = 0

  function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

  const repeatScore    = clamp((liveRepeatRateNum / 35) * 100, 0, 100);
  const discountScore  = clamp((1 - Math.max(0, liveDiscountDepNum - 15) / 35) * 100, 0, 100);
  const cacScore       = clamp(((2.0 - liveCacPayback) / 1.2) * 100, 0, 100);
  const blendedCmPctNum = gqBlendedCm !== null ? gqBlendedCm * 100 : 38.6; // 38.6 = seeded fallback
  const blendedCmScore  = clamp(((blendedCmPctNum - 25) / 30) * 100, 0, 100);

  // Channel mix quality: % of attributed net sales from high-CM channels (email + organic).
  // Used for the 5th score display component only — not in the composite.
  const emailRevenue    = findChannel(gqChannels, "email")?.attributedNetSales   ?? 0;
  const organicRevenue  = findChannel(gqChannels, "organic")?.attributedNetSales ?? 0;
  const totalRevenue    = gqChannels.reduce((s, c) => s + c.attributedNetSales, 0);
  const highCmShare     = totalRevenue > 0 ? (emailRevenue + organicRevenue) / totalRevenue : 0.30;
  const channelMixScore = clamp((highCmShare / 0.50) * 100, 0, 100);

  const compositeScore = Math.round(
    repeatScore   * 0.30 +
    discountScore * 0.25 +
    cacScore      * 0.25 +
    blendedCmScore * 0.20,
  );

  // Convert numeric score to a letter grade.
  function scoreToGrade(s: number): string {
    if (s >= 88) return "A";
    if (s >= 80) return "A–";
    if (s >= 72) return "B+";
    if (s >= 64) return "B";
    if (s >= 57) return "B–";
    if (s >= 50) return "C+";
    if (s >= 43) return "C";
    if (s >= 36) return "C–";
    if (s >= 29) return "D+";
    if (s >= 22) return "D";
    return "D–";
  }

  // Component-level sub-scores → status and grade labels.
  function scoreToStatus(s: number): ScoreStatus {
    if (s >= 65) return "strong";
    if (s >= 40) return "watch";
    if (s >= 25) return "weak";
    return "weak";
  }

  function scoreToStatusWithDeclining(s: number, prevScore: number): ScoreStatus {
    if (s >= 65) return "strong";
    if (s >= 40) return s < prevScore ? "declining" : "watch";
    return "weak";
  }

  function componentGrade(s: number): string {
    if (s >= 88) return "A";
    if (s >= 78) return "A–";
    if (s >= 68) return "B+";
    if (s >= 58) return "B";
    if (s >= 50) return "B–";
    if (s >= 42) return "C+";
    if (s >= 34) return "C";
    if (s >= 26) return "C–";
    if (s >= 18) return "D+";
    if (s >= 10) return "D";
    return "D–";
  }

  const liveGqGrade     = scoreToGrade(compositeScore);

  // True only when every input to the composite score has settled.
  // Phase 1 (repeat rate, discount dep) and Phase 3 (CAC payback, blended CM)
  // load independently; mixing live + static values produces transient grades
  // that differ from the fully-resolved value (e.g. "A" flash before "B+").
  // The score tile suppresses its grade and direction badge until this is true.
  const gqScoreReady = gqPhase1 !== null && !gqPhase3Loading;

  // ── Live Score Components ──────────────────────────────────────────────────
  // All 5 components now derive their score, status, grade, and explanation
  // from live metric values. Direction ("strengthening" / "weakening") is also
  // live-computed from the sub-score vs a healthy benchmark threshold.
  const liveScoreComponents: {
    label:      string;
    status:     ScoreStatus;
    grade:      string;
    explanation: string;
    score:      number;
    direction:  "strengthening" | "weakening";
  }[] = [
    {
      label:      "Retention quality",
      status:     scoreToStatus(repeatScore),
      grade:      componentGrade(repeatScore),
      explanation: `Repeat rate at ${liveRepeatRateNum.toFixed(1)}% — ${liveRepeatRateNum >= 30 ? "above the 30% level where retention carries the business" : "approaching the 30% level where customers return without paid re-acquisition"}.`,
      score:      Math.round(repeatScore),
      direction:  repeatScore >= 65 ? "strengthening" : "weakening",
    },
    {
      label:      "Discount reliance",
      status:     discountScore >= 65 ? "strong" : discountScore >= 40 ? "watch" : "weak",
      grade:      componentGrade(discountScore),
      explanation: `${liveDiscountDepNum.toFixed(1)}% of orders use a discount code — ${liveDiscountDepNum <= 25 ? "within the 25% target" : "above the 25% target; discounts are driving orders that should return without them"}.`,
      score:      Math.round(discountScore),
      direction:  discountScore >= 65 ? "strengthening" : "weakening",
    },
    {
      label:      "CAC efficiency",
      status:     scoreToStatusWithDeclining(cacScore, 55),
      grade:      componentGrade(cacScore),
      explanation: `CAC payback at ${liveCacPayback.toFixed(1)} orders. ${liveCacPayback <= 1.2 ? "Within target — new customers cover their acquisition cost within one order." : liveCacPayback <= 1.8 ? "Above the 1.2-order target — paid acquisition is costing more than one order earns back." : "Elevated — new customers require more than one order to cover their acquisition cost."}`,
      score:      Math.round(cacScore),
      direction:  cacScore >= 60 ? "strengthening" : "weakening",
    },
    {
      label:      "Contribution quality",
      status:     scoreToStatusWithDeclining(blendedCmScore, 52),
      grade:      componentGrade(blendedCmScore),
      explanation: `Blended contribution margin at ${blendedCmPctNum.toFixed(1)}% — ${blendedCmPctNum >= 45 ? "within the 45–55% target range" : "below the 45–55% target; paid channels are diluting overall profitability"}.`,
      score:      Math.round(blendedCmScore),
      direction:  blendedCmScore >= 55 ? "strengthening" : "weakening",
    },
    {
      label:      "Channel mix quality",
      status:     channelMixScore >= 65 ? "strong" : channelMixScore >= 40 ? "mixed" : "weak",
      grade:      componentGrade(channelMixScore),
      explanation: `Email and organic represent ${(highCmShare * 100).toFixed(0)}% of revenue — ${highCmShare >= 0.50 ? "a healthy owned-channel balance" : "below the 50% target; as this share falls, blended CAC rises"}.`,
      score:      Math.round(channelMixScore),
      direction:  channelMixScore >= 55 ? "strengthening" : "weakening",
    },
  ];

  const isGqPro = canAccess("growth_quality_actions");
  const topGrowthDrivers = [KEY_DRIVERS[1], KEY_DRIVERS[2], KEY_DRIVERS[0]];
  const strengtheningCount = liveScoreComponents.filter((c) => c.direction === "strengthening").length;
  const weakeningCount = liveScoreComponents.filter((c) => c.direction === "weakening").length;
  const scorecardDisplay: Record<string, {
    currentLabel: string;
    currentClass: string;
    travelLabel: string;
    travelClass: string;
    icon: "up" | "down";
    explanation: string;
  }> = {
    "Retention quality": {
      currentLabel: "Current level strong",
      currentClass: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
      travelLabel: "Supporting growth",
      travelClass: "text-emerald-700 dark:text-emerald-400",
      icon: "up",
      explanation: `Repeat rate at ${liveRepeatRateNum.toFixed(1)}% — retention is still supporting growth, but it is not enough to offset discount and paid-acquisition pressure.`,
    },
    "Discount reliance": {
      currentLabel: "Monitor",
      currentClass: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
      travelLabel: "Pressure increasing",
      travelClass: "text-amber-700 dark:text-amber-400",
      icon: "down",
      explanation: `${liveDiscountDepNum.toFixed(1)}% of orders use a discount code — discount pressure is above target and needs active control even if current sales remain healthy.`,
    },
    "CAC efficiency": {
      currentLabel: "Watch",
      currentClass: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
      travelLabel: "Weakening",
      travelClass: "text-destructive",
      icon: "down",
      explanation: `CAC payback at ${liveCacPayback.toFixed(1)} orders — paid growth is becoming more expensive, so new-customer revenue is carrying less contribution quality.`,
    },
    "Contribution quality": {
      currentLabel: "Watch",
      currentClass: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
      travelLabel: "Weakening",
      travelClass: "text-destructive",
      icon: "down",
      explanation: `Blended contribution margin at ${blendedCmPctNum.toFixed(1)}% — margin pressure is emerging as discounts and paid channels absorb more of the growth.`,
    },
    "Channel mix quality": {
      currentLabel: "Below target",
      currentClass: "bg-secondary text-muted-foreground",
      travelLabel: "Weakening",
      travelClass: "text-destructive",
      icon: "down",
      explanation: `Email and organic represent ${(highCmShare * 100).toFixed(0)}% of revenue — owned-channel mix is below target, which leaves growth more exposed to paid CAC and promotions.`,
    },
  };

  return (
    <AppLayout>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Growth Quality Analysis
          </h1>
          <p className="text-muted-foreground mt-1">
            Assess whether revenue growth is generating lasting profit — or being bought through discounts and paid spend.
          </p>
          <DataPeriodLabel
            periodLabel={gqPeriodLabel}
            loading={gqPeriodLoading}
            dateFrom={gqDateFrom}
            dateTo={gqDateTo}
          />
        </div>
        <TimelineSelector />
      </div>

      {/* ── CFO Growth Verdict ── */}
      <div className="sc-purple rounded-2xl shadow-md mb-6 overflow-hidden">
        <div className="sc-purple-header flex items-center gap-3 px-6 py-3">
          <Sparkles className="w-4 h-4 text-indigo-300 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
            CFO Growth Verdict
          </span>
          <span className="ml-auto inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 whitespace-nowrap">
            Quality weakening
          </span>
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-5 pb-4 border-b border-primary/15">
            <div>
              <p className="text-lg sm:text-xl font-bold text-foreground leading-snug">
                Growth quality is deteriorating despite revenue growth.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                Revenue growth is increasingly being driven by discounting and paid acquisition rather than repeat demand. That weakens contribution even when sales look healthy.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-secondary/30 border border-primary/10 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Growth type</p>
                <p className="text-sm font-bold text-foreground">Promotion-led</p>
              </div>
              <div className="rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">Direction</p>
                <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Weakening</p>
              </div>
              <div className="rounded-xl bg-secondary/30 border border-primary/10 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Risk</p>
                <p className="text-sm font-bold text-foreground">Medium</p>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Main pressures</p>
            <div className="flex flex-wrap gap-2">
              {["Discount dependency above target", "Meta CAC rising", "Owned-channel mix weakening"].map((pressure) => (
                <span key={pressure} className="rounded-full bg-secondary/30 border border-primary/10 px-3 py-1.5 text-xs font-semibold text-foreground">
                  {pressure}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recoverable Growth Quality ── */}
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-950/15 shadow-sm mb-8 px-6 py-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">Recoverable Growth Quality</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Growth quality can improve without requiring additional revenue. The opportunity is to recover contribution already being lost to discount dependency and acquisition inefficiency.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">Estimated recoverable contribution</p>
              <p className="text-4xl font-display font-bold text-emerald-700 dark:text-emerald-300 leading-none">
                £{(RECOVERABLE_UPSIDE.cashLow / 1_000).toFixed(0)}k-£{(RECOVERABLE_UPSIDE.cashHigh / 1_000).toFixed(0)}k
              </p>
              <p className="text-xs text-muted-foreground mt-1">per month · medium confidence</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Primary drivers</p>
              <p className="text-sm font-semibold text-foreground">Discount dependency</p>
              <p className="text-sm font-semibold text-foreground">Acquisition efficiency</p>
            </div>
          </div>
        </div>

        {isGqPro ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 pt-5 border-t border-emerald-200/70 dark:border-emerald-800/40">
            {RECOVERABLE_UPSIDE.levers.map((lv) => (
              <div key={lv.id} className="flex items-start gap-3 rounded-xl bg-card border border-border/50 px-4 py-3.5 shadow-sm">
                <ArrowRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-snug">{lv.label}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{lv.description}</p>
                </div>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 shrink-0 whitespace-nowrap">
                  +£{lv.upliftLow / 1_000}k-£{lv.upliftHigh / 1_000}k
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 pt-5 border-t border-emerald-200/70 dark:border-emerald-800/40">
            {["Discount recovery lever identified", "Acquisition efficiency lever identified"].map((lever) => (
              <div key={lever} className="flex items-center gap-3 rounded-xl bg-card/70 border border-border/50 px-4 py-3.5 shadow-sm">
                <Lock className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <p className="text-sm font-semibold text-foreground">{lever}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── What Is Driving This? ── */}
      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">What Is Driving This?</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          The three commercial signals most responsible for this month's growth quality.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {topGrowthDrivers.map((driver) => (
          <div key={driver.text} className="rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className={cn(
                "mt-0.5 flex items-center justify-center w-6 h-6 rounded-full shrink-0",
                driver.dir === "positive" ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-destructive/10",
              )}>
                {driver.dir === "positive" ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                )}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground leading-snug">{driver.freeLabel}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  {driver.text}
                </p>
                <p className={cn(
                  "text-xs font-semibold mt-3",
                  driver.dir === "positive" ? "text-emerald-700 dark:text-emerald-400" : "text-destructive/80 dark:text-destructive/70",
                )}>
                  {isGqPro ? driver.impact : "Contribution impact available in Pro"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Growth Quality Scorecard ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">Growth Quality Scorecard</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Current levels remain usable, but the direction of travel is weakening.
            </p>
          </div>
          <div className="rounded-xl bg-secondary/40 border border-border/50 px-4 py-3 sm:text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Trend</p>
            <div className="flex sm:justify-end items-center gap-2">
              <p className="text-3xl font-display font-bold text-amber-700 dark:text-amber-300">Weakening</p>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {gqScoreReady ? `Current level ${liveGqGrade}` : "Current level calculating"}
            </p>
          </div>
        </div>

        <div className="divide-y divide-border/40">
          {liveScoreComponents.map((component) => {
            const cfg = STATUS_CONFIG[component.status];
            const display = scorecardDisplay[component.label];
            return (
              <div key={component.label} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 py-4 first:pt-0 last:pb-0">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{component.label}</p>
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold", display.currentClass)}>
                      {display.currentLabel}
                    </span>
                    <span className={cn(
                      "inline-flex items-center gap-1 text-[11px] font-semibold",
                      display.travelClass,
                    )}>
                      {display.icon === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {display.travelLabel}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{display.explanation}</p>
                </div>
                <div className="lg:text-right">
                  <p className={cn("text-2xl font-display font-bold tabular-nums", cfg.text)}>{component.grade}</p>
                  <p className="text-[11px] text-muted-foreground">{component.score}/100</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Growth Composition Trend ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-foreground">Growth Composition Trend</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Whether growth is becoming repeat-led, paid-led or discount-led.
          </p>
        </div>
        <div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 mb-5">
            {COMPOSITION_LEGEND.map((item) => (
              <div key={item.key} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
          {/* Chart */}
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={COMPOSITION_DATA}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  dy={8}
                />
                <YAxis
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickFormatter={(v: number) => `${v}%`}
                  ticks={[0, 25, 50, 75, 100]}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted)/0.15)" }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid hsl(var(--border))",
                    boxShadow: "0 4px 12px rgb(0 0 0 / .08)",
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [
                    `${value}%`,
                    name === "repeat" ? "Repeat-customer" : name === "paid" ? "Paid acquisition" : "Discount-led",
                  ]}
                />
                <Bar dataKey="repeat"   stackId="a" fill="#22c55e" radius={[0, 0, 4, 4]} maxBarSize={52} />
                <Bar dataKey="paid"     stackId="a" fill="#6366f1" maxBarSize={52} />
                <Bar dataKey="discount" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={52} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 pt-3 border-t border-border/40">
            <p className="text-xs text-muted-foreground leading-snug">
              <span className="font-semibold text-foreground">
                Repeat-led growth fell from {COMPOSITION_DATA[0].repeat}% to {COMPOSITION_DATA[COMPOSITION_DATA.length - 1].repeat}%
              </span>{" "}
              over the last 6 months, while discount-led growth rose to{" "}
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {COMPOSITION_DATA[COMPOSITION_DATA.length - 1].discount}%
              </span>.{" "}
              More revenue is now being bought than earned — and the gap is widening.
            </p>
          </div>
        </div>
      </div>

      {/* ── Growth Recovery Plan / Action Plan ── */}
      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">Growth Recovery Plan</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          The next actions to recover contribution and make growth healthier.
        </p>
      </div>

      {isGqPro ? (
        <div className="space-y-4 mb-8">
          {GROWTH_RECOVERY_ACTIONS.map((action, i) => (
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
                      <ArrowRight className="w-3.5 h-3.5" />
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
                <p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Your Growth Recovery Plan</p>
                <p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 mt-1">
                  3 prioritised actions identified to improve contribution quality. Upgrade to view the action plan, implementation steps, confidence scoring and scenario links.
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

      <AiCfoAskCard pageId="growth" />

      {/* ── Growth Diagnostics ── */}
      <details className="group bg-card rounded-2xl shadow-sm border border-border/50 mb-8 overflow-hidden">
        <summary className="list-none cursor-pointer px-6 py-5 hover:bg-secondary/20 transition-colors">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Growth Diagnostics</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Detailed driver context, KPI movements and benchmark logic.
              </p>
            </div>
            <span className="text-xs font-semibold text-primary group-open:hidden">Expand</span>
            <span className="text-xs font-semibold text-primary hidden group-open:inline">Collapse</span>
          </div>
        </summary>

        <div className="px-6 pb-6">
        {isGqPro ? (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Detailed KPI movements</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl bg-secondary/30 border border-border/50 px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">Repeat purchase rate</p>
                  <p className="text-2xl font-display font-bold text-foreground">{liveRepeatRate}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{liveRprChangePp !== null ? `${liveRprChangePp >= 0 ? "+" : ""}${Math.abs(liveRprChangePp).toFixed(1)}pp vs last month` : "- vs last month"}</p>
                </div>
                <div className="rounded-xl bg-secondary/30 border border-border/50 px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">Discount dependency</p>
                  <p className="text-2xl font-display font-bold text-foreground">{liveDiscountDep}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{liveDiscDepChangePp !== null ? `${liveDiscDepChangePp >= 0 ? "+" : ""}${Math.abs(liveDiscDepChangePp).toFixed(1)}pp vs last month` : "- vs last month"}</p>
                </div>
                <div className="rounded-xl bg-secondary/30 border border-border/50 px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">CAC payback</p>
                  <p className="text-2xl font-display font-bold text-foreground">{gqPhase3Loading ? "-" : `${liveCacPayback.toFixed(1)} orders`}</p>
                  <p className="text-xs text-muted-foreground mt-1">{gqPhase3Loading ? "Calculating" : `${liveCacPaybackChange > 0 ? "+" : ""}${liveCacPaybackChange.toFixed(2)} orders vs last month`}</p>
                </div>
                <div className="rounded-xl bg-secondary/30 border border-border/50 px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">High-CM channel share</p>
                  <p className="text-2xl font-display font-bold text-foreground">{(highCmShare * 100).toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{strengtheningCount} strengthening · {weakeningCount} weakening</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Full driver list</p>
              <div className="divide-y divide-border/40 rounded-xl border border-border/50 overflow-hidden">
                {KEY_DRIVERS.map((driver) => (
                  <div key={driver.text} className="px-4 py-3 flex items-start gap-3">
                    <span className={cn(
                      "mt-0.5 flex items-center justify-center w-5 h-5 rounded-full shrink-0",
                      driver.dir === "positive" ? "bg-emerald-100 dark:bg-emerald-900/40" : driver.dir === "negative" ? "bg-destructive/10" : "bg-secondary",
                    )}>
                      {driver.dir === "positive" && <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                      {driver.dir === "negative" && <TrendingDown className="w-3 h-3 text-destructive" />}
                      {driver.dir === "neutral" && <Minus className="w-3 h-3 text-muted-foreground" />}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground leading-snug">{driver.text}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{driver.impact}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-secondary/20 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Benchmark logic</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Healthy growth quality is benchmarked against 30%+ repeat purchase rate, discount dependency below 25%, CAC payback below 1.2 orders, contribution margin in the 45-55% range and a stronger owned-channel mix.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/70 dark:bg-indigo-950/25 px-5 py-4 flex items-start gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
              <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Detailed diagnostics are available on Pro</p>
              <p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 mt-1">
                Unlock the full driver list, detailed KPI movements, benchmark logic and quantified impact commentary.
              </p>
            </div>
          </div>
        )}
        </div>
      </details>

      <DataBenchmarkAssumptions
        benchmarkNote="Repeat purchase rate benchmark: 30%+ indicates healthy self-sustaining retention. Below 30% means paid acquisition is doing the work customers should be doing for free."
        dataQualityNote="Growth quality depends on accurate customer, order and discount tagging."
        className="mb-2"
      />

    </AppLayout>
  );
}
