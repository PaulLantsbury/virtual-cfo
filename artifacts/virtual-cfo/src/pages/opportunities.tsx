import { useState } from "react";
import { SHARED_OPPORTUNITIES } from "@/lib/mock-data";
import { ChevronDown, FlaskConical, Lock, Target } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { canAccess } from "@/lib/plan";
import { DataBenchmarkAssumptions } from "@/components/DataBenchmarkAssumptions";

type ImpactLevel = "high" | "medium" | "quick-win";
type PriorityTier = "Do First" | "High Priority" | "Do next" | "Watch List";

const priorityTierStyles: Record<PriorityTier, string> = {
  "Do First":      "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-800/50",
  "High Priority": "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/70 dark:border-indigo-800/50",
  "Do next":       "bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border-sky-200/70 dark:border-sky-800/50",
  "Watch List":    "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200/70 dark:border-amber-800/50",
};

const priorityTierCopy: Record<PriorityTier, string> = {
  "Do First":      "Start here",
  "High Priority": "Next best action",
  "Do next":       "Worth scheduling",
  "Watch List":    "Lower priority for now",
};

function priorityTierFromScore(score: number): PriorityTier {
  if (score >= 90) return "Do First";
  if (score >= 75) return "High Priority";
  if (score >= 60) return "Do next";
  return "Watch List";
}

function freeOpportunityLabel(opp: { label: string; category?: string; impactType?: string }): string {
  const text = `${opp.label} ${opp.category ?? ""}`.toLowerCase();
  if (opp.impactType === "cash_improvement" || text.includes("inventory") || text.includes("cash")) return "Cash release example";
  if (text.includes("meta") || text.includes("acquisition") || text.includes("marketing")) return "Marketing example";
  if (text.includes("shipping") || text.includes("fulfil") || text.includes("margin")) return "Margin example";
  if (text.includes("discount") || text.includes("full-price") || text.includes("pricing")) return "Pricing example";
  return `${opp.category ?? "Profit"} example`;
}

function freeOpportunityRationale(opp: { category?: string; impactType?: string }): string {
  if (opp.impactType === "cash_improvement") return "This sample illustrates a cash lever that may improve runway.";
  if (opp.category === "Marketing") return "This sample illustrates a customer acquisition lever worth investigating.";
  if (opp.category === "Margin") return "This sample illustrates a margin lever worth investigating.";
  if (opp.category === "Pricing") return "This sample illustrates a pricing lever that may recover contribution.";
  return "This sample illustrates a controllable opportunity worth investigating.";
}

/**
 * Maps opportunity card titles to Scenario Planner preset IDs.
 * Only the 3 supported opportunities get an "Open Scenario Planner" button.
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
  const [expandedOppId, setExpandedOppId] = useState<string | null>(null);
  // Existing fixtures only: the source endpoint is disabled pending authenticated
  // store access. Never substitute these examples for failed source responses.
  const opportunities = SHARED_OPPORTUNITIES.map(o => ({
    id: o.id, title: o.title, description: o.driverMetric, category: o.category,
    confidence: o.confidence, effort: o.effort, timing: o.timing,
    linked_page: o.linkedPage, linked_page_label: o.linkedPageLabel,
    impact_type: o.impactType, impact_low: o.monthlyImpactLow,
    impact_high: o.monthlyImpactHigh,
    impact_mid: (o.monthlyImpactLow + o.monthlyImpactHigh) / 2,
    recommended_action: o.recommendedAction, implementation_type: "Sample implementation outline",
  }));

  const mappedOpportunities = opportunities.map((o) => {
    const conf = o.confidence;
    const eff = o.effort;
    const impact: ImpactLevel =
      conf === "High" && eff === "Low" ? "high"
      : eff === "Low"                  ? "quick-win"
      : "medium";

    const timing = o.timing;
    const timeToImpact =
      timing === "Immediate"                                         ? "Immediate impact (0–30 days)"
      : timing === "1–2 weeks" || timing === "2–4 weeks" || timing === "30 days"
                                                                     ? "Short-term impact (1–2 months)"
      : "Structural impact (2–3 months)";

    // Links retained from the existing sample fixture.
    // No source evidence is inferred from a link.
    const sources: { label: string; href: string }[] =
      o.linked_page && o.linked_page_label
        ? [{ label: o.linked_page_label as string, href: o.linked_page as string }]
        : [];

    // ── Impact range label — cash vs monthly contribution ────────────────────
    const impType = o.impact_type;
    const impactRangeLabel =
      impType === "cash_improvement"
        ? `£${(Number(o.impact_low) / 1000).toFixed(0)}k–£${(Number(o.impact_high) / 1000).toFixed(0)}k cash`
        : `£${(Number(o.impact_low) / 1000).toFixed(0)}k–£${(Number(o.impact_high) / 1000).toFixed(0)}k/mo`;

    const uplift = o.impact_mid;

    return {
      ...o,
      label:              o.title                       as string,
      // Illustrative description from the existing sample fixture.
      description:        o.recommended_action,
      evidenceSummary:    o.description,
      uplift,
      impact,
      effort:             eff,
      confidence:         conf,
      timing,
      implementationType: o.implementation_type,
      timeToImpact,
      capitalFree:        eff === "Low",
      sources,
      annualImpact:       uplift * 12,
      impactType:         impType,
      impactRangeLabel,
    };
  });

  const maxUplift = Math.max(...mappedOpportunities.map((o) => o.uplift), 1);

  // ── Internal ordering ────────────────────────────────────────────────────────
  // Internal priority signal: confidence (35%) + effort (25%) + timing (20%) + uplift (20%).
  // Deterministic ordering of existing sample fixtures only.
  const rankOpp = (opp: (typeof mappedOpportunities)[number]): number => {
    const conf = opp.confidence === "High" ? 100 : opp.confidence === "Medium" ? 60 : 30;
    const eff  = opp.effort === "Low"      ? 100 : opp.effort === "Medium"      ? 60 : 20;
    const timing: string = opp.timing;
    const tim  =
      timing === "Immediate"                                                    ? 100
      : (timing === "1–2 weeks" || timing === "2–4 weeks" || timing === "30 days") ? 70
      : timing === "1–3 months"                                                 ? 40
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

  // Existing illustrative sum, not overlap-adjusted or a validated forecast.
  const sampleContribOpps = mappedOpportunities.filter(o => o.impactType === "monthly_contribution");
  const sampleTotalLow = sampleContribOpps.reduce((sum, o) => sum + Number(o.impact_low), 0);
  const sampleTotalHigh = sampleContribOpps.reduce((sum, o) => sum + Number(o.impact_high), 0);

  const monthlyQueue = sortedOpportunities.filter((o) => o.impactType === "monthly_contribution");
  const cashReleaseProjects = sortedOpportunities.filter((o) => o.impactType === "cash_improvement");
  const visibleQueue = monthlyQueue.slice(0, 3);
  const topAction = visibleQueue[0] ?? sortedOpportunities[0];

  const getEvidence = (opp: (typeof mappedOpportunities)[number]): string[] => {
    const guidance = OPPORTUNITY_GUIDANCE[opp.label];
    const fallback = [
      opp.evidenceSummary,
      opp.impactRangeLabel,
      `Sample confidence: ${opp.confidence}`,
    ].filter(Boolean);

    return guidance?.evidence ?? fallback;
  };

  const showHeadline     = canAccess("opportunities_headline_value");
  const showUpliftValues = canAccess("opportunities_uplift_values");
  const showExecPriority = canAccess("opportunities_execution_priority");
  const showRowDetail    = canAccess("opportunities_row_detail");
  const hasRecoveryPlan  = showExecPriority && showRowDetail;

  return (
    <AppLayout showMonitoring={false}>

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Opportunity Finder</h1>
          <p className="text-muted-foreground mt-1">
            Explore illustrative actions. Actual store opportunity analysis is unavailable.
          </p>
        </div>
      </div>
      <section aria-label="Opportunity reporting status" className="rounded-xl border border-border p-5 mb-6">
        <h2 className="font-semibold">Actual opportunity analysis: unavailable</h2>
        <p className="text-sm text-muted-foreground mt-2">Store-specific opportunity data is not connected here. No validated benefit, priority or confidence assessment is available. This does not mean your store has no opportunities.</p>
      </section>
      <section aria-label="Sample opportunity model notice" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 mb-6">
        <h2 className="font-semibold">Sample model — not store recommendations</h2>
        <p className="text-sm text-muted-foreground mt-2">All actions, GBP amounts, evidence, confidence, effort and timing below are fixed examples. They do not use your store data. The existing sample ranking weights confidence (35%), effort (25%), timing (20%) and relative impact (20%); these rules are not validated or agreed for real recommendations.</p>
        <p className="text-sm text-muted-foreground mt-2">Monthly example amounts are summed without resolving overlapping actions. They are not a forecast or a validated combined benefit. One-off cash examples remain separate. Upgrading does not activate real analysis.</p>
      </section>

      {/* ── CFO verdict ── */}
      <div className="sc-purple rounded-2xl px-6 py-6 mb-10">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-300/80 mb-2">
              Sample overview
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-foreground leading-tight">
              Illustrative opportunities to explore
            </h2>
            <div className="text-xs text-indigo-200/70 mt-2 leading-relaxed">
              <p>The example covers three areas:</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <span>• Discounting</span>
                <span>• Customer acquisition efficiency</span>
                <span>• Fulfilment costs</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2 max-w-3xl leading-relaxed">
              This fixed example explores discounting, acquisition and fulfilment. It does not diagnose your store or identify its best next action.
            </p>
            {topAction && hasRecoveryPlan && (
              <div className="mt-4 rounded-xl border border-indigo-300/15 bg-indigo-950/20 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300/70 mb-1">First in sample ranking</p>
                <p className="text-sm font-semibold text-foreground">{topAction.label}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {OPPORTUNITY_GUIDANCE[topAction.label]?.shortWhy ?? topAction.description}
                </p>
              </div>
            )}
            {topAction && !hasRecoveryPlan && (
              <div className="mt-4 rounded-xl border border-indigo-300/15 bg-indigo-950/20 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300/70 mb-1">First in sample ranking</p>
                <p className="text-sm font-semibold text-foreground">{freeOpportunityLabel(topAction)}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Pro preview shows the sample action and illustrative amounts.
                </p>
              </div>
            )}
            {!hasRecoveryPlan && (
              <div className="flex items-center gap-2 mt-3 text-xs text-indigo-200/70">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>Pro preview includes detailed sample actions and example evidence.</span>
              </div>
            )}
          </div>

          {topAction && (
            <div className="w-full lg:w-[19rem] shrink-0 rounded-xl border border-indigo-300/15 bg-indigo-950/20 px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300/70">
                {showHeadline ? "Sample monthly contribution" : "Sample focus"}
              </p>
              {showHeadline ? (
                <>
                  <p className="text-3xl font-display font-bold text-emerald-300 mt-1">
                    £{(sampleTotalLow / 1000).toFixed(0)}k–£{(sampleTotalHigh / 1000).toFixed(0)}k
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Unadjusted example total, not expected recovery.</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-display font-bold text-emerald-300 mt-1">Sample detail available</p>
                  <p className="text-xs text-muted-foreground mt-1">Pro preview shows the sample action and illustrative amounts.</p>
                </>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", priorityTierStyles[topAction.priorityTier])}>Sample: {topAction.priorityTier}</span>
                <span className="rounded-full bg-indigo-900/40 px-2.5 py-1 text-[11px] font-semibold text-indigo-100">Sample confidence: {topAction.confidence}</span>
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
            <h3 className="font-semibold text-lg text-foreground">Sample Actions</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Illustrative actions in the existing sample order.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-2 leading-relaxed">
              <span className="font-semibold text-foreground/70">About this ordering: </span>
              The sample score orders examples only; it does not establish the fastest or best route for your store.
              {!showHeadline && " Pro shows detailed examples; actual recommendations remain unavailable."}
            </p>
          </div>

          <div className="space-y-3 p-4">
            {visibleQueue.map((opp, idx) => {
              const isExpanded = hasRecoveryPlan && (expandedOppId ? expandedOppId === opp.id : idx === 0);
              const guidance = OPPORTUNITY_GUIDANCE[opp.label];


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
                              <p className="font-semibold text-foreground text-sm leading-snug">
                                {hasRecoveryPlan ? opp.label : freeOpportunityLabel(opp)}
                              </p>
                              <span className={cn(
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                priorityTierStyles[opp.priorityTier],
                              )}>
                                Sample: {opp.priorityTier}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                              {hasRecoveryPlan ? guidance?.shortWhy ?? opp.implementationType : freeOpportunityRationale(opp)}
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
                          <span className="rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Sample value in Pro preview</span>
                        )}
                        {showUpliftValues && (
                          <span className="rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{opp.priorityCopy}</span>
                        )}
                        <span className="rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{opp.timing}</span>
                        <span className="rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Sample confidence: {opp.confidence}</span>
                        <span className="rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{opp.effort} effort</span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && hasRecoveryPlan && (
                    <div className="space-y-4 mt-4 pt-4 border-t border-border/50">
                      <div className="grid grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)] gap-4">
                        <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-950/15 px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700/70 dark:text-emerald-300/70 mb-1">Sample amount</p>
                          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{opp.impactRangeLabel}</p>
                        </div>
                        <div className="rounded-xl border border-border/50 bg-secondary/20 px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50 mb-2">Example steps</p>
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
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50 mb-2">Example evidence</p>
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
                            Open Scenario Planner
                          </a>
                        )}
                      </div>

                      <div className="rounded-xl border border-border/40 bg-background/60 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50 mb-1">Example rationale</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{guidance?.shortWhy ?? opp.description}</p>
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
                  No sample actions are available. Actual opportunities remain unavailable.
                </p>
                <p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 mt-1">
                  This does not establish whether your store has opportunities.
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
                <p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Explore the sample action plan</p>
                <p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 mt-1">
                  See example actions, illustrative amounts and sample plans. Real analysis remains unavailable.
                </p>
              </div>
            </div>
            <a href="/upgrade" className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shrink-0">
              Unlock Pro
            </a>
          </div>
        </div>
      )}

      {/* ── Sample cash release projects ── */}
      {cashReleaseProjects.length > 0 && (
        <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-10">
          <div className="px-6 py-5 border-b border-border/50 flex items-center gap-3">
            <Target className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <h3 className="font-semibold text-lg text-foreground">Sample cash release projects</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                These are one-off cash examples, separate from monthly contribution.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">
                No actual available cash or runway has been calculated.

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
                        Sample: {opp.priorityTier}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{opp.implementationType}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{opp.impactRangeLabel}</span>
                    <span className="text-xs font-semibold text-muted-foreground">Sample confidence: {opp.confidence}</span>
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
                      <p className="text-sm font-semibold text-foreground">Cash release example</p>
                      <span className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        priorityTierStyles[opp.priorityTier],
                      )}>
                        Sample: {opp.priorityTier}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-semibold text-muted-foreground">{opp.category}</span>
                    <span className="text-xs font-semibold text-muted-foreground">Sample confidence: {opp.confidence}</span>
                    <span className="text-xs font-semibold text-muted-foreground">{opp.effort} effort</span>
                    <span className="text-xs font-semibold text-muted-foreground">{opp.timing}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-sm text-muted-foreground mb-6">Store-specific CFO advice is unavailable. The examples above are not generated advice.</p>

      <DataBenchmarkAssumptions
        benchmarkNote="Sample ordering uses unvalidated weights, not an implemented recommendation engine."
        dataQualityNote="All displayed opportunity amounts and evidence are fixed examples; store data is not connected."
        confidenceNote="Confidence labels are sample inputs, not verified probabilities or evidence assessments."
        className="mb-2"
      />

    </AppLayout>
  );
}
