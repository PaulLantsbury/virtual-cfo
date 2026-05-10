import { useState, useEffect } from "react";
import { Sparkles, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus, ArrowRight } from "lucide-react";
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { ActionRecommendations } from "@/components/ActionRecommendations";
import type { Recommendation } from "@/components/ActionRecommendations";
import { PremiumBlurPreview } from "@/components/PremiumBlurPreview";
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
  GQ_SCORE,
  GQ_SCORE_PREV,
} from "@/lib/data/growth-metrics";
import { useLatestDataPeriod } from "@/lib/analytics/useLatestDataPeriod";
import { usePhase2Deltas } from "@/lib/analytics/usePhase2Deltas";
import { DataPeriodLabel } from "@/components/DataPeriodLabel";
import { deltaToSentiment, DELTA_POLARITY } from "@/lib/analytics/deltaSentiment";
import {
  getMarketingChannelMetrics,
  findChannel,
  getCacTrendForChannel,
  type ChannelMonthlyMetrics,
  type CacTrendPoint,
} from "@/lib/analytics/marketingChannelMetrics";

// ─── Store ID ─────────────────────────────────────────────────────────────────
// Dev store UUID — matches Dashboard, Margin Analysis, and Marketing Efficiency.
const GQ_STORE_ID = "10000000-0000-0000-0000-000000000001";

// ─── Data constants ──────────────────────────────────────────────────────────
// REPEAT_RATE, DISCOUNT_DEP, CAC_PAYBACK, GQ_SCORE imported from
// src/lib/data/growth-metrics.ts — the central source of truth for growth metrics.
// REPEAT_RATE resolved to 28% (was 27% here; Dashboard and BENCHMARKS both use 28%).

// GQ_SCORE_DIR is now live-computed inside the component as liveGqScoreDir.

const REPEAT_RATE_CHANGE  = +(REPEAT_RATE  - REPEAT_RATE_PREV).toFixed(1);
const DISCOUNT_DEP_CHANGE = +(DISCOUNT_DEP - DISCOUNT_DEP_PREV).toFixed(1);
const CAC_PAYBACK_CHANGE  = +(CAC_PAYBACK  - CAC_PAYBACK_PREV).toFixed(1);

/**
 * @ai-commentary Replace with AI-generated insight when ready.
 * cashLow / cashHigh:
 *   @dynamic Math.round(orderVolume * (ppLow / 100) * revenuePerOrder)
 */
const CFO_INSIGHT = {
  /** @ai-commentary Opening diagnostic sentence — replace with AI-generated headline when live */
  headline: "Growth is being bought, not earned. Discount dependency at 38% and rising Meta CAC are compressing contribution — this is the third consecutive month of quality decline.",
  /** @ai-commentary Replace with dynamically identified primary drivers when live */
  drivers: [
    "discount dependency at 38% — 13pp above the 25% target",
    "Meta CAC up 14% — new customers cost more to acquire than one order earns back",
    "email and organic share declining — blended acquisition cost rising as cheaper channels shrink",
  ],
} as const;

type ScoreStatus = "strong" | "watch" | "weak" | "mixed" | "declining";

/** @dynamic Score components computed from underlying metrics when live */
const SCORE_COMPONENTS: {
  label: string;
  status: ScoreStatus;
  grade: string;
  explanation: string;
  score: number;
  /** Determines which group the component appears in */
  direction: "strengthening" | "weakening";
}[] = [
  {
    label: "Retention quality",
    status: "strong",
    grade: "B+",
    explanation: "Repeat purchase rate improved 2.4pp — more customers returning without paid re-acquisition.",
    score: 82,
    direction: "strengthening",
  },
  {
    label: "Discount reliance",
    status: "weak",
    grade: "D+",
    explanation: "38% of orders use a discount code — 13pp above the 25% target, compressing margin on more than a third of all orders.",
    score: 32,
    direction: "weakening",
  },
  {
    label: "CAC efficiency",
    status: "watch",
    grade: "C+",
    explanation: "CAC payback at 1.4 orders — above the 1.2-order target. Rising Meta costs mean new customers cost more to acquire than one order earns back.",
    score: 55,
    direction: "weakening",
  },
  {
    label: "Contribution quality",
    status: "declining",
    grade: "C+",
    explanation: "Contribution margin at 42.3% is below the 45–55% target range and declining month-on-month.",
    score: 52,
    direction: "weakening",
  },
  {
    label: "Channel mix quality",
    status: "mixed",
    grade: "C",
    explanation: "Paid acquisition share rising while email and organic share decline — blended CAC rising as a result.",
    score: 48,
    direction: "weakening",
  },
];

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

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: "gq1",
    text: "Stop discounting returning customers — they'd buy anyway. Cut dependency from 38% toward the 25% target.",
    impact: "high",
  },
  {
    id: "gq2",
    text: "Reallocate Meta budget toward email and organic — each conversion costs a fraction of the current Meta CAC.",
    impact: "high",
  },
  {
    id: "gq3",
    text: "Build a post-purchase email sequence to bring customers back at zero acquisition cost — target repeat rate above 30%.",
    impact: "medium",
  },
  {
    id: "gq4",
    text: "Focus acquisition campaigns on products with the highest contribution margin.",
    impact: "medium",
  },
  {
    id: "gq5",
    text: "Audit which discount codes generate repeat purchases vs one-time buyers — retire those that just compress margin.",
    impact: "quick-win",
  },
];

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

  // Convert a letter grade to an ordinal for direction comparison.
  function gradeToOrdinal(g: string): number {
    const order = ["D–","D","D+","C–","C","C+","B–","B","B+","A–","A","A+"];
    const idx = order.indexOf(g);
    return idx >= 0 ? idx : 0;
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
  const liveGqGradePrev = GQ_SCORE_PREV; // prior period: no live prior-period score RPC yet
  const liveGqScoreDir: "up" | "down" | "stable" = (() => {
    const curr = gradeToOrdinal(liveGqGrade);
    const prev = gradeToOrdinal(liveGqGradePrev);
    return curr > prev ? "up" : curr < prev ? "down" : "stable";
  })();

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
          <DataPeriodLabel periodLabel={gqPeriodLabel} loading={gqPeriodLoading} />
        </div>
        <TimelineSelector />
      </div>

      {/* ── CFO Insight ── */}
      <div className="sc-purple rounded-2xl shadow-sm mb-8 overflow-hidden">
        <div className="sc-purple-header flex items-center gap-2.5 px-6 py-3.5">
          <Sparkles className="w-4 h-4 text-indigo-300 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
            CFO Insight
          </span>
        </div>
        <div className="px-6 py-5">
          {/* Diagnostic narrative — three-part structure */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground leading-relaxed">
              {CFO_INSIGHT.headline}
            </p>
            <div>
              <p className="text-sm font-medium text-foreground mb-1.5">The main pressures are:</p>
              <ul className="space-y-1">
                {CFO_INSIGHT.drivers.map((d) => (
                  <li key={d} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-[5px] w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </div>

      <AiCfoAskCard pageId="growth" />

      {/* ── Growth Classification & Risk Signal ── */}
      <div className={cn(
        "rounded-2xl border px-6 py-5 mb-8 bg-[#182A4A]",
        GROWTH_TYPE.risk === "high"
          ? "border-[#EF4444]/30"
          : GROWTH_TYPE.risk === "medium"
          ? "border-[#F59E0B]/30"
          : "border-[#22C55E]/30"
      )}>
        {/* Row 1: classification label + risk badge */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className={cn(
              "text-[10px] font-bold uppercase tracking-widest mb-1",
              GROWTH_TYPE.risk === "high"
                ? "text-destructive/60"
                : GROWTH_TYPE.risk === "medium"
                ? "text-[#F59E0B]/70"
                : "text-[#22C55E]/70"
            )}>
              Growth Classification
            </p>
            <p className="text-base font-bold text-foreground leading-tight">
              {GROWTH_TYPE.label}
            </p>
          </div>
          <span className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border shrink-0",
            GROWTH_TYPE.risk === "high"
              ? "bg-destructive/10 text-destructive border-destructive/20"
              : GROWTH_TYPE.risk === "medium"
              ? "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30"
              : "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30"
          )}>
            <span className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              GROWTH_TYPE.risk === "high" ? "bg-destructive" : GROWTH_TYPE.risk === "medium" ? "bg-amber-500" : "bg-emerald-500"
            )} />
            {GROWTH_TYPE.riskLabel}
          </span>
        </div>
        {/* Row 2: risk signal */}
        <p className={cn(
          "mt-3 pt-3 border-t text-sm leading-relaxed text-[#A9B8D3]",
          GROWTH_TYPE.risk === "high"
            ? "border-destructive/20"
            : GROWTH_TYPE.risk === "medium"
            ? "border-[#F59E0B]/25"
            : "border-[#22C55E]/25"
        )}>
          {GROWTH_TYPE.signal}
        </p>
        <p className="mt-2 text-xs text-muted-foreground/50 leading-snug">
          {GROWTH_TYPE.priorPeriod}
        </p>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Growth Quality Score */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Growth Quality Score</p>
          <p className="text-4xl font-display font-bold text-foreground">
            {gqScoreReady ? liveGqGrade : "—"}
          </p>
          <div className="flex items-center gap-2 mt-3 text-xs min-h-[22px]">
            {gqScoreReady ? (
              <span className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold",
                liveGqScoreDir === "up"
                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                  : liveGqScoreDir === "down"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-secondary text-muted-foreground",
              )}>
                {liveGqScoreDir === "up"
                  ? <ArrowUpRight className="w-3 h-3" />
                  : liveGqScoreDir === "down"
                  ? <ArrowDownRight className="w-3 h-3" />
                  : <Minus className="w-3 h-3" />}
                {liveGqScoreDir === "up"
                  ? `Up from ${liveGqGradePrev}`
                  : liveGqScoreDir === "down"
                  ? `Down from ${liveGqGradePrev}`
                  : `Stable vs ${liveGqGradePrev}`}
              </span>
            ) : (
              <span className="text-muted-foreground/40">Calculating…</span>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground leading-snug">
            A–/B+ = growth is generating profit sustainably. Below B– = revenue is outpacing margin quality.
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground/50 leading-snug">
            Healthy range: A– to B+
          </p>
        </div>

        {/* Repeat Purchase Rate */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Repeat Purchase Rate</p>
          <p className="text-4xl font-display font-bold text-foreground">{liveRepeatRate}%</p>
          <div className="flex items-center gap-2 mt-3 text-xs">
            <span className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold",
              deltaToSentiment(liveRprChangePp, DELTA_POLARITY.rpr) === "positive"
                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                : deltaToSentiment(liveRprChangePp, DELTA_POLARITY.rpr) === "negative"
                ? "bg-destructive/10 text-destructive"
                : "bg-secondary text-muted-foreground"
            )}>
              {liveRprChangePp !== null && liveRprChangePp > 0
                ? <ArrowUpRight className="w-3 h-3" />
                : liveRprChangePp !== null && liveRprChangePp < 0
                ? <ArrowDownRight className="w-3 h-3" />
                : <Minus className="w-3 h-3" />}
              {liveRprChangePp !== null
                ? `${liveRprChangePp >= 0 ? "+" : ""}${Math.abs(liveRprChangePp).toFixed(1)}pp vs last month`
                : "— vs last month"}
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground leading-snug">
            Above 30% means customers return without paid re-acquisition. Currently improving — the one positive signal.
          </p>
        </div>

        {/* Discount Dependency */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">Discount Dependency</p>
          <p className="text-4xl font-display font-bold text-foreground">{liveDiscountDep}%</p>
          <div className="flex items-center gap-2 mt-3 text-xs">
            <span className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold",
              deltaToSentiment(liveDiscDepChangePp, DELTA_POLARITY.dd) === "positive"
                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                : deltaToSentiment(liveDiscDepChangePp, DELTA_POLARITY.dd) === "negative"
                ? "bg-destructive/10 text-destructive"
                : "bg-secondary text-muted-foreground"
            )}>
              {liveDiscDepChangePp !== null && liveDiscDepChangePp > 0
                ? <ArrowUpRight className="w-3 h-3" />
                : liveDiscDepChangePp !== null && liveDiscDepChangePp < 0
                ? <ArrowDownRight className="w-3 h-3" />
                : <Minus className="w-3 h-3" />}
              {liveDiscDepChangePp !== null
                ? `${liveDiscDepChangePp >= 0 ? "+" : ""}${Math.abs(liveDiscDepChangePp).toFixed(1)}pp vs last month`
                : "— vs last month"}
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground leading-snug">
            Orders using a discount code — target below 25%. Above this, discounts are driving demand that should be self-sustaining.
          </p>
        </div>

        {/* CAC Payback */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">CAC Payback</p>
          <p className="text-4xl font-display font-bold text-foreground">
            {gqPhase3Loading ? "—" : <>{liveCacPayback.toFixed(1)}{" "}<span className="text-lg font-medium text-muted-foreground">orders</span></>}
          </p>
          <div className="flex items-center gap-2 mt-3 text-xs min-h-[22px]">
            {gqPhase3Loading ? (
              <span className="text-muted-foreground/40">Calculating…</span>
            ) : (
              <span className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold",
                liveCacPaybackChange > 0
                  ? "bg-destructive/10 text-destructive"
                  : liveCacPaybackChange < 0
                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                  : "bg-secondary text-muted-foreground",
              )}>
                {liveCacPaybackChange > 0
                  ? <ArrowUpRight className="w-3 h-3" />
                  : liveCacPaybackChange < 0
                  ? <ArrowDownRight className="w-3 h-3" />
                  : <Minus className="w-3 h-3" />}
                {liveCacPaybackChange !== 0
                  ? `${liveCacPaybackChange > 0 ? "+" : ""}${liveCacPaybackChange.toFixed(2)} orders vs last month`
                  : "Stable vs last month"}
              </span>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground leading-snug">
            {gqPhase3Loading
              ? "Below 1.2 orders is healthy"
              : <>Below 1.2 orders is healthy — {liveCacPayback.toFixed(1)} {liveCacPayback <= 1.2 ? "is within the healthy range" : "signals acquisition cost pressure"}</>}
          </p>
        </div>
      </div>

      {/* ── Score Breakdown — strengthening vs weakening ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-6 mb-8">
        <div className="mb-6">
          <h3 className="font-semibold text-lg text-foreground">
            Where growth quality is strengthening vs weakening
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            What's holding growth quality up — and what's pulling it down.
          </p>
        </div>

        {(
          [
            {
              dir:      "strengthening" as const,
              icon:     <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
              labelCls: "text-emerald-700 dark:text-emerald-400",
              heading:  "Strengthening",
            },
            {
              dir:      "weakening" as const,
              icon:     <TrendingDown className="w-3.5 h-3.5 text-destructive shrink-0" />,
              labelCls: "text-destructive",
              heading:  "Under pressure",
            },
          ] as const
        ).map(({ dir, icon, labelCls, heading }, gi) => {
          const items = liveScoreComponents.filter((c) => c.direction === dir);
          if (!items.length) return null;
          return (
            <div key={dir} className={gi > 0 ? "mt-6 pt-6 border-t border-border/50" : ""}>
              {/* Group header */}
              <div className="flex items-center gap-1.5 mb-4">
                {icon}
                <span className={cn("text-xs font-semibold uppercase tracking-wider", labelCls)}>
                  {heading} ({items.length})
                </span>
              </div>

              <div className="space-y-4">
                {items.map((c) => {
                  const cfg = STATUS_CONFIG[c.status];
                  return (
                    <div key={c.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-foreground">{c.label}</span>
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold",
                            cfg.badge,
                          )}>
                            {cfg.label}
                          </span>
                        </div>
                        {canAccess("score_component_detail") ? (
                          <span className={cn("text-sm font-bold tabular-nums", cfg.text)}>{c.grade}</span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider whitespace-nowrap">
                            PRO
                          </span>
                        )}
                      </div>
                      {/* Bar */}
                      <div className="w-full h-1.5 bg-secondary rounded-full mb-1.5">
                        <div
                          className={cn("h-1.5 rounded-full transition-all", cfg.bar)}
                          style={{ width: `${c.score}%` }}
                        />
                      </div>
                      {/* Explanation — gated */}
                      {canAccess("score_component_detail") ? (
                        <p className="text-xs text-muted-foreground leading-snug">{c.explanation}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground/35 leading-snug blur-sm select-none pointer-events-none">
                          {c.explanation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Growth Composition Trend — Pro only ── */}
      <PremiumBlurPreview
        title="Growth Composition Trend"
        subtitle="How the mix of repeat, paid, and discount-led growth has shifted over the last six months."
        badgeText="PRO — Unlock composition"
        ctaTitle="Unlock growth composition breakdown"
        ctaDescription="See whether growth is becoming more or less healthy over time — and which channel types are driving the shift."
        isPro={canAccess("growth_composition_trend")}
        className="mb-8"
        ghostContent={
          <div>
            {/* Ghost legend */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 mb-4">
              {COMPOSITION_LEGEND.map((item) => (
                <div key={item.key} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-foreground/[0.08] shrink-0" />
                  <span className="text-xs text-muted-foreground/60">{item.label}</span>
                </div>
              ))}
            </div>
            {/* Ghost stacked bars — CSS only, no real data */}
            <div className="h-[200px] flex items-end gap-2">
              {[62, 57, 52, 48, 44, 40].map((rh, i) => {
                const ph = Math.round((100 - rh) * 0.57);
                const dh = 100 - rh - ph;
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end gap-px" style={{ height: "100%" }}>
                    <div className="w-full rounded-t-sm bg-foreground/[0.06]" style={{ height: `${dh}%` }} />
                    <div className="w-full bg-foreground/[0.07]" style={{ height: `${ph}%` }} />
                    <div className="w-full rounded-b-sm bg-foreground/[0.09]" style={{ height: `${rh}%` }} />
                  </div>
                );
              })}
            </div>
            {/* Ghost X labels */}
            <div className="flex gap-2 mt-2.5">
              {COMPOSITION_DATA.map((d) => (
                <span key={d.month} className="flex-1 text-center text-[11px] text-muted-foreground/50">{d.month}</span>
              ))}
            </div>
            {/* Ghost takeaway */}
            <div className="mt-3 pt-3 border-t border-border/40">
              <p className="text-xs text-foreground/[0.13] leading-snug">
                —— —— fell from —% to —% over the last — months. —— —— growth now represents —% of total growth.
              </p>
            </div>
          </div>
        }
      >
        {/* Pro: real stacked bar chart */}
        <div>
          {/* Legend */}
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
          {/* Takeaway */}
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
      </PremiumBlurPreview>

      {/* ── Key Growth Drivers — Pro only (with impact lines) ── */}
      <PremiumBlurPreview
        title="Key Growth Drivers This Month"
        subtitle="Which changes this month improved or weakened growth quality — and the contribution impact of each."
        badgeText="PRO — Unlock driver impact"
        ctaTitle="Unlock driver impact analysis"
        ctaDescription="See which specific changes this month improved or weakened growth quality — with quantified impact on contribution and acquisition efficiency."
        isPro={canAccess("driver_impact_detail")}
        className="mb-8"
        ghostContent={
          <ul className="space-y-0">
            {KEY_DRIVERS.map((d, i) => (
              <li key={i} className="flex items-start gap-3 py-3 border-b border-border/30 last:border-0">
                {/* Direction icon — fully visible so pos/neg signal is clear */}
                <span className={cn(
                  "mt-0.5 flex items-center justify-center w-5 h-5 rounded-full shrink-0",
                  d.dir === "positive" ? "bg-emerald-100 dark:bg-emerald-900/40"
                    : d.dir === "negative" ? "bg-destructive/10"
                    : "bg-secondary",
                )}>
                  {d.dir === "positive" && <TrendingUp  className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                  {d.dir === "negative" && <TrendingDown className="w-3 h-3 text-destructive" />}
                  {d.dir === "neutral"  && <Minus        className="w-3 h-3 text-muted-foreground" />}
                </span>
                {/* Text content — blurred so structure is preserved but text is unreadable */}
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-medium text-foreground leading-snug select-none pointer-events-none"
                    style={{ filter: "blur(4px)", opacity: 0.55 }}
                  >
                    {d.freeLabel}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/50 leading-snug select-none pointer-events-none">
                    → detailed impact available in Pro
                  </p>
                </div>
              </li>
            ))}
          </ul>
        }
      >
        {/* Pro: full rows with impact interpretation */}
        <ul className="space-y-3">
          {KEY_DRIVERS.map((d) => (
            <li key={d.text} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
              <span className={cn(
                "mt-0.5 flex items-center justify-center w-5 h-5 rounded-full shrink-0",
                d.dir === "positive" ? "bg-emerald-100 dark:bg-emerald-900/40"
                  : d.dir === "negative" ? "bg-destructive/10"
                  : "bg-secondary",
              )}>
                {d.dir === "positive" && <TrendingUp  className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                {d.dir === "negative" && <TrendingDown className="w-3 h-3 text-destructive" />}
                {d.dir === "neutral"  && <Minus        className="w-3 h-3 text-muted-foreground" />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug">{d.text}</p>
                <p className={cn(
                  "mt-1 text-xs leading-snug",
                  d.dir === "positive"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : d.dir === "negative"
                    ? "text-destructive/80 dark:text-destructive/70"
                    : "text-muted-foreground",
                )}>
                  → {d.impact}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </PremiumBlurPreview>

      {/* ── Recoverable Growth Quality — Pro only ── */}
      <PremiumBlurPreview
        title="Recoverable Growth Quality"
        subtitle="Estimated contribution available if discount dependency and CAC efficiency return to target levels."
        badgeText="PRO — Unlock upside estimate"
        ctaTitle="Unlock recoverable growth quality"
        ctaDescription="See the estimated monthly contribution unlock from reducing discount depth and improving Meta CAC efficiency."
        isPro={canAccess("recoverable_growth_quality")}
        className="mb-8"
        ghostContent={
          <div>
            {/* Ghost headline block */}
            <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30 px-6 py-5 mb-5 flex items-center gap-5">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100/50 dark:bg-emerald-900/30 shrink-0">
                <TrendingUp className="w-6 h-6 text-emerald-400/50 dark:text-emerald-600/40" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600/40 dark:text-emerald-500/30 mb-1">
                  Estimated recoverable contribution
                </p>
                <p className="text-4xl font-display font-bold text-foreground/[0.10] leading-none select-none">
                  £——k–£——k
                </p>
                <p className="text-xs text-foreground/[0.10] mt-2 select-none">
                  —— —— —— —— —— —— —— —— ——
                </p>
              </div>
            </div>
            {/* Ghost lever rows — structure preserved, label text blurred */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {RECOVERABLE_UPSIDE.levers.map((lv) => (
                <div key={lv.id} className="flex items-start gap-3 rounded-xl bg-card border border-border/40 px-4 py-3.5">
                  <ArrowRight className="w-4 h-4 text-foreground/10 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold text-foreground leading-snug select-none pointer-events-none"
                      style={{ filter: "blur(4px)", opacity: 0.55 }}
                    >
                      {lv.label}
                    </p>
                    <p className="text-xs text-foreground/[0.13] mt-1 leading-relaxed select-none pointer-events-none">
                      —— —— —— —— —— ——
                    </p>
                  </div>
                  <span className="text-sm font-bold text-foreground/[0.10] shrink-0 whitespace-nowrap select-none pointer-events-none">
                    +£——k
                  </span>
                </div>
              ))}
            </div>
          </div>
        }
      >
        {/* Pro: full upside block */}
        <div>
          {/* Headline */}
          <div className="sc-teal rounded-xl px-6 py-5 mb-5 flex items-center gap-5">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#22D3EE]/15 shrink-0">
              <TrendingUp className="w-6 h-6 text-[#22D3EE]" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#22D3EE] mb-1">
                Estimated recoverable contribution
              </p>
              <p className="text-4xl font-display font-bold text-[#22D3EE] leading-none">
                £{(RECOVERABLE_UPSIDE.cashLow / 1_000).toFixed(0)}k–£{(RECOVERABLE_UPSIDE.cashHigh / 1_000).toFixed(0)}k
                <span className="text-base font-medium text-cyan-300/70 ml-2">per month</span>
              </p>
              <p className="text-xs text-cyan-300/75 mt-2 leading-snug max-w-xl">
                {RECOVERABLE_UPSIDE.supporting}
              </p>
              <p className="text-[11px] text-muted-foreground/40 mt-2">
                Confidence: Medium
              </p>
            </div>
          </div>
          {/* Lever breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {RECOVERABLE_UPSIDE.levers.map((lv) => (
              <div key={lv.id} className="flex items-start gap-3 rounded-xl bg-card border border-border/50 px-4 py-3.5 shadow-sm">
                <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-snug">{lv.label}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{lv.description}</p>
                </div>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 shrink-0 whitespace-nowrap">
                  +£{lv.upliftLow / 1_000}k–£{lv.upliftHigh / 1_000}k
                </span>
              </div>
            ))}
          </div>
        </div>
      </PremiumBlurPreview>

      {/* ── Recommended Actions — Pro only ── */}
      {canAccess("growth_quality_actions") ? (
        <ActionRecommendations
          recommendations={RECOMMENDATIONS}
          title="What to do next"
          subtitle="Actions to reduce discount dependency, improve CAC efficiency, and build sustainable repeat growth"
          defaultExpanded
        />
      ) : (
        <PremiumBlurPreview
          title="What to do next"
          subtitle="Actions to reduce discount dependency, improve CAC efficiency, and build sustainable repeat growth"
          badgeText="PRO — Unlock action plan"
          ctaTitle="Unlock growth quality action plan"
          ctaDescription="See the specific actions that improve retention, reduce discount dependency, and strengthen profitable growth."
          isPro={false}
          className="mb-8"
        >
          <ActionRecommendations
            recommendations={RECOMMENDATIONS}
            defaultExpanded
          />
        </PremiumBlurPreview>
      )}

      <DataBenchmarkAssumptions
        benchmarkNote="Repeat purchase rate benchmark: 30%+ indicates healthy self-sustaining retention. Below 30% means paid acquisition is doing the work customers should be doing for free."
        dataQualityNote="Growth quality depends on accurate customer, order and discount tagging."
        className="mb-2"
      />

    </AppLayout>
  );
}
