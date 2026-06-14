import { useEffect, useState } from "react";
import { useLatestDataPeriod } from "@/lib/analytics/useLatestDataPeriod";
import {
  getMarketingChannelMetrics,
  type ChannelOpportunity,
  type BlendedMarketingPerformance,
} from "@/lib/analytics/marketingChannelMetrics";
import { ChevronDown, FlaskConical, Lock, Target } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { canAccess } from "@/lib/plan";
import { RECOVERABLE_LOW, RECOVERABLE_HIGH } from "@/lib/data/business-snapshot";
import { DataBenchmarkAssumptions } from "@/components/DataBenchmarkAssumptions";
import { AiCfoAskCard } from "@/components/AiCfoAskCard";
import { DataPeriodLabel } from "@/components/DataPeriodLabel";

// ─── Data constants ───────────────────────────────────────────────────────────

/** Seed store UUID — shared by all Phase 1, Phase 3, and opportunity_breakdown calls. */
const STORE_ID = "10000000-0000-0000-0000-000000000001";

/**
 * Static fallback totals — used while Phase 1 RPC is loading or on failure.
 * Live values come from phase1.data.recoverableLow / recoverableHigh which
 * sum SUM(impact_low) / SUM(impact_high) from all active opportunities in DB.
 * These match the recoverable_contribution_range() RPC static snapshot values.
 * @dev-only DEV-ONLY FALLBACK — do not promote to production default.
 */
const TOTAL_LOW  = RECOVERABLE_LOW;
const TOTAL_HIGH = RECOVERABLE_HIGH;

/**
 * Capital-free subset: Low-effort opportunities requiring no new budget.
 * opp-a (£12k–18k) + opp-b (£6k–10k) = £18k–28k.
 * @dynamic Recompute as sum of effort=Low opportunity uplift ± uncertainty.
 */
const CAPITAL_FREE_LOW  = 18_000;
const CAPITAL_FREE_HIGH = 26_000;

type ImpactLevel = "high" | "medium" | "quick-win";
type PriorityTier = "Do First" | "High Priority" | "Next Up" | "Watch List";

const priorityTierStyles: Record<PriorityTier, string> = {
  "Do First":      "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-800/50",
  "High Priority": "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/70 dark:border-indigo-800/50",
  "Next Up":       "bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border-sky-200/70 dark:border-sky-800/50",
  "Watch List":    "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200/70 dark:border-amber-800/50",
};

const priorityTierCopy: Record<PriorityTier, string> = {
  "Do First":      "Start here",
  "High Priority": "Next best action",
  "Next Up":       "Worth scheduling",
  "Watch List":    "Lower priority for now",
};

function priorityTierFromScore(score: number): PriorityTier {
  if (score >= 90) return "Do First";
  if (score >= 75) return "High Priority";
  if (score >= 60) return "Next Up";
  return "Watch List";
}

/**
 * Maps opportunity card titles to Profit Launchpad preset IDs.
 * Only the 3 supported opportunities get an "Open Launchpad" button.
 */
const TITLE_TO_PRESET: Record<string, string> = {
  "Reduce average discount depth":   "reduce-discount-depth",
  "Reallocate inefficient Meta spend": "reallocate-meta-spend",
  "Improve full-price order ratio":  "improve-fullprice-ratio",
};

const OPPORTUNITY_GUIDANCE: Record<string, {
  shortWhy: string;
  evidence: string[];
  implementation: string[];
}> = {
  "Reduce average discount depth": {
    shortWhy: "Repeat customers already have buying intent, so blanket discounts are likely to leak contribution without creating enough incremental demand.",
    evidence: [
      "Current average discount: 18%",
      "Test target: 15%",
      "Discount dependency: 38%",
      "Uplift estimate comes from current discount leakage",
    ],
    implementation: [
      "Remove blanket repeat-customer discount codes.",
      "Limit welcome discounts to first purchase only.",
      "Test reducing larger campaign discounts by 3 percentage points.",
      "Keep win-back discounts for inactive customers only.",
    ],
  },
  "Reduce shipping cost per order": {
    shortWhy: "Shipping cost is rising per order, so every operational saving drops directly into contribution without needing more sales.",
    evidence: [
      "Shipping cost per order up 12%",
      "Target reduction: 10%",
      "Estimated contribution gain: £3.70 per order",
      "High-confidence margin lever",
    ],
    implementation: [
      "Review courier rates and surcharge lines.",
      "Test a minimum order threshold for free shipping.",
      "Renegotiate rates where current volume supports it.",
      "Identify SKUs or orders where fulfilment cost is disproportionate.",
    ],
  },
  "Reallocate inefficient Meta spend": {
    shortWhy: "Meta acquisition is currently expensive relative to owned channels, so moving budget into lifecycle activity should improve contribution quality.",
    evidence: [
      "Meta CAC: £28",
      "Prior Meta CAC: £24",
      "Email CAC benchmark: £4.80",
      "Suggested shift: 15% of Meta budget",
    ],
    implementation: [
      "Pause the weakest Meta ad sets.",
      "Shift 15-25% of spend toward Email and Organic/lifecycle activity.",
      "Prioritise campaigns aimed at repeat purchase.",
      "Review CAC payback weekly.",
    ],
  },
  "Improve full-price order ratio": {
    shortWhy: "Discounted order mix is pulling down realised margin, so tighter promotion rules should recover contribution from customers who would buy anyway.",
    evidence: [
      "Discounted orders: 38%",
      "Medium effort pricing change",
      "30 day timing",
      "Uplift estimate based on full-price mix recovery",
    ],
    implementation: [
      "Segment offers by customer lifecycle stage.",
      "Remove blanket repeat-buyer promotions.",
      "Reserve larger discounts for reactivation campaigns.",
      "Review full-price order ratio weekly during the test.",
    ],
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Opportunities() {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOppId, setExpandedOppId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOpportunities() {
      try {
        const res = await fetch(`/api/opportunities`);
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data: any[] = await res.json();
        setOpportunities(data);
      } catch (err) {
        console.error("Error fetching opportunities:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchOpportunities();
  }, []);

  // ── Phase 1 — period label + recoverable range (no extra fetch) ─────────────
  const {
    phase1,
    dateFrom,
    dateTo,
    periodLabel,
    loading: periodLoading,
  } = useLatestDataPeriod(STORE_ID);

  // ── Phase 3 — channel opportunities for rationale enrichment ─────────────────
  // Used for: (a) live "why this matters" rationale on Marketing cards, (b) blended
  // CM/CAC signals. NOT merged as separate cards — opportunity_breakdown is authoritative.
  const [channelOpps, setChannelOpps] = useState<ChannelOpportunity[]>([]);
  const [blendedMets, setBlendedMets] = useState<BlendedMarketingPerformance | null>(null);

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    let cancelled = false;
    getMarketingChannelMetrics(STORE_ID, dateFrom, dateTo)
      .then(({ opportunities: opps, blended }) => {
        if (cancelled) return;
        setChannelOpps(opps);
        setBlendedMets(blended);
      })
      .catch(() => { /* static fallbacks apply — state stays as initialized */ });
    return () => { cancelled = true; };
  }, [dateFrom, dateTo]);

  const mappedOpportunities = opportunities.map((o) => {
    // ── Derive impact level from RPC fields with defensive fallbacks ──────────
    // Primary: confidence + effort from DB. Fallback: "medium" if either is null.
    const conf   = (o.confidence ?? "Medium") as string;
    const eff    = (o.effort     ?? "Medium") as string;
    const impact: ImpactLevel =
      conf === "High" && eff === "Low" ? "high"
      : eff === "Low"                  ? "quick-win"
      : "medium";

    // ── Derive timeToImpact label from RPC timing field ──────────────────────
    // Fallback to "Immediate impact (0–30 days)" if timing is null.
    const timing = (o.timing ?? "Immediate") as string;
    const timeToImpact =
      timing === "Immediate"                                         ? "Immediate impact (0–30 days)"
      : timing === "1–2 weeks" || timing === "2–4 weeks" || timing === "30 days"
                                                                     ? "Short-term impact (1–2 months)"
      : "Structural impact (2–3 months)";

    // ── Source link — from linked_page / linked_page_label RPC fields ────────
    // Fallback to empty array (hides "See analysis:" row in Pro view) if null.
    const sources: { label: string; href: string }[] =
      o.linked_page && o.linked_page_label
        ? [{ label: o.linked_page_label as string, href: o.linked_page as string }]
        : [];

    // ── Impact range label — cash vs monthly contribution ────────────────────
    const impType = (o.impact_type ?? "monthly_contribution") as string;
    const impactRangeLabel =
      impType === "cash_improvement"
        ? `£${(Number(o.impact_low) / 1000).toFixed(0)}k–£${(Number(o.impact_high) / 1000).toFixed(0)}k cash`
        : `£${(Number(o.impact_low) / 1000).toFixed(0)}k–£${(Number(o.impact_high) / 1000).toFixed(0)}k/mo`;

    const uplift = Number(o.impact_mid ?? 0);

    return {
      ...o,
      label:              o.title                       as string,
      // description: use recommended_action from DB when available; fall back
      // to the stored description column, then category as last resort.
      description:        (o.recommended_action ?? o.description ?? o.category ?? "") as string,
      evidenceSummary:    (o.description ?? "") as string,
      uplift,
      impact,
      effort:             eff,
      confidence:         conf,
      timing,
      implementationType: (o.implementation_type ?? "No additional investment required") as string,
      timeToImpact,
      capitalFree:        eff === "Low",
      sources,
      annualImpact:       uplift * 12,
      impactType:         impType,
      impactRangeLabel,
    };
  });

  const capitalFreeLow  = mappedOpportunities.length === 0
    ? CAPITAL_FREE_LOW
    : opportunities.filter((o) => o.effort === "Low").reduce((sum, o) => sum + Number(o.impact_low), 0);
  const capitalFreeHigh = mappedOpportunities.length === 0
    ? CAPITAL_FREE_HIGH
    : opportunities.filter((o) => o.effort === "Low").reduce((sum, o) => sum + Number(o.impact_high), 0);

  const maxUplift = Math.max(...mappedOpportunities.map((o) => o.uplift), 1);

  // ── Internal ordering ────────────────────────────────────────────────────────
  // Internal priority signal: confidence (35%) + effort (25%) + timing (20%) + uplift (20%).
  // Sorting is deterministic as soon as opportunity_breakdown resolves.
  const rankOpp = (opp: (typeof mappedOpportunities)[number]): number => {
    const conf = opp.confidence === "High" ? 100 : opp.confidence === "Medium" ? 60 : 30;
    const eff  = opp.effort === "Low"      ? 100 : opp.effort === "Medium"      ? 60 : 20;
    const tim  =
      opp.timing === "Immediate"                                                    ? 100
      : (opp.timing === "1–2 weeks" || opp.timing === "2–4 weeks" || opp.timing === "30 days") ? 70
      : opp.timing === "1–3 months"                                                 ? 40
      : 20;
    const upl = maxUplift > 0 ? (opp.uplift / maxUplift) * 100 : 0;
    return conf * 0.35 + eff * 0.25 + tim * 0.20 + upl * 0.20;
  };

  const sortedOpportunities = [...mappedOpportunities].sort(
    (a, b) => rankOpp(b) - rankOpp(a),
  ).map((opp, index) => {
    const tier = index === 0 ? "Do First" : priorityTierFromScore(rankOpp(opp));
    return {
      ...opp,
      priorityTier: tier,
      priorityCopy: priorityTierCopy[tier],
    };
  });

  // ── Live header values ────────────────────────────────────────────────────────
  // Header "monthly contribution" total: sum impact_low/high from
  // monthly_contribution cards only — excludes cash_improvement (opp-d is a
  // one-off working-capital release, not a recurring monthly figure).
  // Falls back to Phase 1 recoverableLow/High (now also monthly_contribution-only
  // after migration 20260507000003) then to static constants.
  const liveContribOpps = mappedOpportunities.filter(
    (o) => o.impactType === "monthly_contribution",
  );
  const liveTotalLow =
    liveContribOpps.length > 0
      ? liveContribOpps.reduce((s, o) => s + Number((o as any).impact_low ?? 0), 0)
      : phase1 && phase1.data.recoverableLow > 0
        ? phase1.data.recoverableLow
        : TOTAL_LOW;
  const liveTotalHigh =
    liveContribOpps.length > 0
      ? liveContribOpps.reduce((s, o) => s + Number((o as any).impact_high ?? 0), 0)
      : phase1 && phase1.data.recoverableHigh > 0
        ? phase1.data.recoverableHigh
        : TOTAL_HIGH;

  // "Total estimated uplift" bottom row includes ALL types (monthly + cash release).
  const liveAllLow =
    mappedOpportunities.length > 0
      ? mappedOpportunities.reduce((s, o) => s + Number((o as any).impact_low ?? 0), 0)
      : liveTotalLow;
  const liveAllHigh =
    mappedOpportunities.length > 0
      ? mappedOpportunities.reduce((s, o) => s + Number((o as any).impact_high ?? 0), 0)
      : liveTotalHigh;

  const monthlyQueue = sortedOpportunities.filter((o) => o.impactType === "monthly_contribution");
  const cashReleaseProjects = sortedOpportunities.filter((o) => o.impactType === "cash_improvement");
  const visibleQueue = monthlyQueue.slice(0, 3);
  const topAction = visibleQueue[0] ?? sortedOpportunities[0];

  // ── Live "why this matters" rationale ─────────────────────────────────────────
  // Derives a concise data-driven sentence from Phase 1 / Phase 3 live signals.
  // Shown in Pro row only, below the description. Returns null when no live signal
  // maps to the card's category (rationale is always additive — never blocking).
  const liveRationale = (opp: (typeof mappedOpportunities)[number]): string | null => {
    const category = opp.category as string;
    if (category === "Marketing") {
      const best = channelOpps.find((co) => co.rationale !== null);
      if (best?.rationale) return best.rationale;
      if (blendedMets) {
        const cm  = blendedMets.blendedContributionMarginPct;
        const cac = blendedMets.blendedCac;
        if (cm !== null && cac !== null)
          return `Blended marketing CM ${(cm * 100).toFixed(1)}%, blended CAC £${cac.toFixed(0)}.`;
        if (cm !== null)
          return `Blended marketing contribution margin at ${(cm * 100).toFixed(1)}%.`;
      }
      return null;
    }
    if (category === "Margin" || category === "Pricing") {
      const cm = phase1?.data.contributionMarginPct;
      if (cm != null)
        return `Live contribution margin ${(cm * 100).toFixed(1)}% — margin recovery is high leverage.`;
      return null;
    }
    if (category === "Retention") {
      if (!phase1) return null;
      const rpr = (phase1.data.repeatPurchaseRate * 100).toFixed(1);
      const dd  = (phase1.data.discountDependency  * 100).toFixed(1);
      return `Repeat rate ${rpr}%, discount dependency ${dd}% of revenue.`;
    }
    return null;
  };

  const getEvidence = (opp: (typeof mappedOpportunities)[number]): string[] => {
    const guidance = OPPORTUNITY_GUIDANCE[opp.label];
    const fallback = [
      opp.evidenceSummary,
      opp.impactRangeLabel,
      `${opp.confidence} confidence`,
    ].filter(Boolean);

    return guidance?.evidence ?? fallback;
  };

  const showHeadline     = canAccess("opportunities_headline_value");
  const showUpliftValues = canAccess("opportunities_uplift_values");
  const showExecPriority = canAccess("opportunities_execution_priority");
  const showRowDetail    = canAccess("opportunities_row_detail");
  const hasRecoveryPlan  = showExecPriority && showRowDetail;

  return (
    <AppLayout>

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Opportunity Finder</h1>
          <p className="text-muted-foreground mt-1">
            Night Scout continuously scans your business for profit, cash and growth opportunities worth pursuing.
          </p>
        </div>
        <DataPeriodLabel
          periodLabel={periodLabel}
          loading={periodLoading}
          dateFrom={dateFrom}
          dateTo={dateTo}
          className="mt-0"
        />
      </div>

      {/* ── CFO verdict ── */}
      <div className="sc-purple rounded-2xl px-6 py-6 mb-10">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-300/80 mb-2">
              CFO view
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-foreground leading-tight">
              Profit is leaking through controllable decisions, not weak demand.
            </h2>
            <div className="text-xs text-indigo-200/70 mt-2 leading-relaxed">
              <p>Most opportunity is concentrated in three areas:</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <span>• Discounting</span>
                <span>• Customer acquisition efficiency</span>
                <span>• Fulfilment costs</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2 max-w-3xl leading-relaxed">
              {topAction
                ? `Contribution margin is below the healthy range, but the primary issues are discount leakage, rising acquisition costs and fulfilment pressure. Together, the actions below represent approximately ${showHeadline ? `£${(liveTotalLow / 1000).toFixed(0)}k–£${(liveTotalHigh / 1000).toFixed(0)}k per month` : "meaningful monthly contribution"} of recoverable contribution without requiring additional marketing spend.`
                : loading
                  ? "Loading the current recovery plan."
                  : "No active execution actions were found for this period."}
            </p>
            {topAction && hasRecoveryPlan && (
              <div className="mt-4 rounded-xl border border-indigo-300/15 bg-indigo-950/20 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300/70 mb-1">Highest impact opportunity</p>
                <p className="text-sm font-semibold text-foreground">{topAction.label}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {OPPORTUNITY_GUIDANCE[topAction.label]?.shortWhy ?? topAction.description}
                </p>
              </div>
            )}
            {topAction && !hasRecoveryPlan && (
              <div className="mt-4 rounded-xl border border-indigo-300/15 bg-indigo-950/20 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300/70 mb-1">Highest impact opportunity</p>
                <p className="text-sm font-semibold text-foreground">{topAction.label}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {OPPORTUNITY_GUIDANCE[topAction.label]?.shortWhy ?? topAction.description}
                </p>
              </div>
            )}
            {!hasRecoveryPlan && (
              <div className="flex items-center gap-2 mt-3 text-xs text-indigo-200/70">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>Upgrade to unlock quantified value, detailed action steps and deeper evidence.</span>
              </div>
            )}
          </div>

          {topAction && (
            <div className="w-full lg:w-[19rem] shrink-0 rounded-xl border border-indigo-300/15 bg-indigo-950/20 px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300/70">
                {showHeadline ? "Recoverable contribution" : "Recommended focus"}
              </p>
              {showHeadline ? (
                <>
                  <p className="text-3xl font-display font-bold text-emerald-300 mt-1">
                    £{(liveTotalLow / 1000).toFixed(0)}k–£{(liveTotalHigh / 1000).toFixed(0)}k
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Estimated monthly contribution recovery.</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-display font-bold text-emerald-300 mt-1">Recoverable contribution identified</p>
                  <p className="text-xs text-muted-foreground mt-1">Upgrade to Pro to see the value and action plan.</p>
                </>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", priorityTierStyles[topAction.priorityTier])}>{topAction.priorityTier}</span>
                <span className="rounded-full bg-indigo-900/40 px-2.5 py-1 text-[11px] font-semibold text-indigo-100">{topAction.confidence} confidence</span>
                <span className="rounded-full bg-indigo-900/40 px-2.5 py-1 text-[11px] font-semibold text-indigo-100">{topAction.effort} effort</span>
                <span className="rounded-full bg-indigo-900/40 px-2.5 py-1 text-[11px] font-semibold text-indigo-100">{topAction.timing}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Priority actions ── */}
      {visibleQueue.length > 0 ? (
        <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-10">
          <div className="px-6 py-5 border-b border-border/50">
            <h3 className="font-semibold text-lg text-foreground">Priority Actions</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              The highest-impact profit recovery actions to brief into the team.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-2 leading-relaxed">
              <span className="font-semibold text-foreground/70">Why these actions? </span>
              These actions combine management control, confidence, timing and likely impact. Together they represent the fastest route to recovering contribution without increasing marketing spend.
              {!showHeadline && " Pro adds quantified value, detailed action steps and deeper evidence."}
            </p>
          </div>

          <div className="space-y-3 p-4">
            {visibleQueue.map((opp, idx) => {
              const isExpanded = hasRecoveryPlan && (expandedOppId ? expandedOppId === opp.id : idx === 0);
              const guidance = OPPORTUNITY_GUIDANCE[opp.label];
              const liveSignal = liveRationale(opp);

              return (
                <div key={opp.id} className={cn(
                  "rounded-xl border border-border/60 bg-background px-4 py-4 transition-colors",
                  idx === 0 && "border-emerald-300/60 bg-emerald-50/50 dark:border-emerald-800/50 dark:bg-emerald-950/10",
                  isExpanded && "border-primary/40 bg-primary/[0.035] shadow-sm ring-1 ring-primary/20 dark:bg-primary/[0.08]",
                )}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!hasRecoveryPlan) return;
                      setExpandedOppId(isExpanded ? null : opp.id);
                    }}
                    className={cn("w-full text-left", !hasRecoveryPlan && "cursor-default")}
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className={cn(
                            "flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 mt-0.5",
                            idx === 0 ? "bg-emerald-600 text-white" : "bg-primary/10 text-primary",
                          )}>
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-foreground text-sm leading-snug">{opp.label}</p>
                              <span className={cn(
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                priorityTierStyles[opp.priorityTier],
                              )}>
                                {opp.priorityTier}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                              {guidance?.shortWhy ?? opp.implementationType}
                            </p>
                          </div>
                        </div>

                        {hasRecoveryPlan && (
                          <ChevronDown className={cn(
                            "w-4 h-4 text-muted-foreground transition-transform shrink-0 mt-1",
                            isExpanded && "rotate-180",
                          )} />
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {showUpliftValues ? (
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{opp.impactRangeLabel}</span>
                        ) : (
                          <span className="rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{opp.category}</span>
                        )}
                        {!showUpliftValues && idx > 0 && (
                          <span className="rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Estimated value available on Pro</span>
                        )}
                        {showUpliftValues && (
                          <span className="rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{opp.priorityCopy}</span>
                        )}
                        <span className="rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{opp.timing}</span>
                        <span className="rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{opp.confidence} confidence</span>
                        <span className="rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{opp.effort} effort</span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && hasRecoveryPlan && (
                    <div className="space-y-4 mt-4 pt-4 border-t border-border/50">
                      <div className="grid grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)] gap-4">
                        <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-950/15 px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700/70 dark:text-emerald-300/70 mb-1">Expected recovery</p>
                          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{opp.impactRangeLabel}</p>
                        </div>
                        <div className="rounded-xl border border-border/50 bg-secondary/20 px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50 mb-2">How to start</p>
                          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5">
                            {(guidance?.implementation ?? [opp.description]).slice(0, 4).map((step) => (
                              <li key={step} className="flex gap-2 text-sm text-foreground leading-relaxed">
                                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                <span>{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-4 items-start">
                        <div className="rounded-xl border border-border/50 bg-secondary/20 px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50 mb-2">Evidence</p>
                          <div className="flex flex-wrap gap-2">
                            {getEvidence(opp).slice(0, 3).map((item) => (
                              <span key={item} className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                        {TITLE_TO_PRESET[opp.label] && (
                          <a
                            href={`/scenario-lab?preset=${TITLE_TO_PRESET[opp.label]}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/80 dark:bg-indigo-950/25 px-3 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                          >
                            <FlaskConical className="w-3.5 h-3.5" />
                            Open Launchpad
                          </a>
                        )}
                      </div>

                      <div className="rounded-xl border border-border/40 bg-background/60 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50 mb-1">Why this matters</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{guidance?.shortWhy ?? opp.description}</p>
                        {liveSignal && (
                          <p className="text-xs text-muted-foreground/60 mt-1 leading-snug italic">{liveSignal}</p>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/70 dark:bg-indigo-950/25 shadow-sm mb-10 px-6 py-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
                <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-950 dark:text-indigo-100 uppercase tracking-wide">Opportunity Finder</p>
                <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 mt-1">
                  No active recommended actions were found for this period.
                </p>
                <p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 mt-1">
                  Night Scout will show the next best action here when a controllable opportunity appears.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── How to execute this ── */}
      {!hasRecoveryPlan && (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50/70 dark:bg-indigo-950/25 shadow-sm mb-10 px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
                <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Unlock the full opportunity plan</p>
                <p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 mt-1">
                  See the value of each opportunity, the recommended actions, evidence, and the launch plan to test.
                </p>
              </div>
            </div>
            <a href="/upgrade" className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shrink-0">
              Unlock Pro
            </a>
          </div>
        </div>
      )}

      {/* ── Cash release projects ── */}
      {cashReleaseProjects.length > 0 && (
        <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-10">
          <div className="px-6 py-5 border-b border-border/50 flex items-center gap-3">
            <Target className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <h3 className="font-semibold text-lg text-foreground">Cash release projects</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                These actions improve cash runway rather than monthly profit.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">
                These actions primarily improve cash runway rather than monthly profit by releasing cash already trapped in the business.
                {showUpliftValues && ` All identified value including cash release is £${(liveAllLow / 1000).toFixed(0)}k–£${(liveAllHigh / 1000).toFixed(0)}k.`}
              </p>
            </div>
          </div>
          {hasRecoveryPlan ? (
            <div className="divide-y divide-border/40">
              {cashReleaseProjects.map((opp) => (
                <div key={opp.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{opp.label}</p>
                      <span className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        priorityTierStyles[opp.priorityTier],
                      )}>
                        {opp.priorityTier}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{opp.implementationType}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{opp.impactRangeLabel}</span>
                    <span className="text-xs font-semibold text-muted-foreground">{opp.confidence} confidence</span>
                    <span className="text-xs font-semibold text-muted-foreground">{opp.effort} effort</span>
                    <span className="text-xs font-semibold text-muted-foreground">{opp.timing}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {cashReleaseProjects.map((opp) => (
                <div key={opp.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-amber-50/40 dark:bg-amber-950/10">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">Cash release opportunity identified</p>
                      <span className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        priorityTierStyles[opp.priorityTier],
                      )}>
                        {opp.priorityTier}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-semibold text-muted-foreground">{opp.category}</span>
                    <span className="text-xs font-semibold text-muted-foreground">{opp.confidence} confidence</span>
                    <span className="text-xs font-semibold text-muted-foreground">{opp.effort} effort</span>
                    <span className="text-xs font-semibold text-muted-foreground">{opp.timing}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AiCfoAskCard pageId="opportunities" className="mb-10" />

      <DataBenchmarkAssumptions
        benchmarkNote="Recommended actions are ordered by estimated value, confidence, timing and effort."
        dataQualityNote="Opportunity values are directional estimates based on current connected data quality."
        confidenceNote="High-confidence opportunities use direct Shopify and cost data. Medium and low confidence use industry benchmarks and trend extrapolation."
        className="mb-2"
      />

    </AppLayout>
  );
}
