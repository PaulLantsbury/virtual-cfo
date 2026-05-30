import { useEffect, useState } from "react";
import { useLatestDataPeriod } from "@/lib/analytics/useLatestDataPeriod";
import {
  getMarketingChannelMetrics,
  type ChannelOpportunity,
  type BlendedMarketingPerformance,
} from "@/lib/analytics/marketingChannelMetrics";
import { ChevronDown, FlaskConical, Lock, Target, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { canAccess } from "@/lib/plan";
import { RECOVERABLE_LOW, RECOVERABLE_HIGH } from "@/lib/data/business-snapshot";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { TimingBadge } from "@/components/TimingBadge";
import { DataBenchmarkAssumptions } from "@/components/DataBenchmarkAssumptions";
import { AiCfoAskCard } from "@/components/AiCfoAskCard";
import { AiCfoInlineButtons } from "@/components/AiCfoInlineButtons";

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

const EFFORT_COLORS: Record<string, string> = {
  Low:    "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/25",
  Medium: "bg-secondary text-muted-foreground border-border/50",
  High:   "bg-rose-50/70 dark:bg-rose-950/10 text-rose-700 dark:text-rose-400 border-rose-200/50 dark:border-rose-700/25",
};

/**
 * Maps opportunity card titles to Scenario Lab preset IDs.
 * Only the 3 supported opportunities get a "Model this scenario" button.
 */
const TITLE_TO_PRESET: Record<string, string> = {
  "Reduce average discount depth":   "reduce-discount-depth",
  "Reallocate inefficient Meta spend": "reallocate-meta-spend",
  "Improve full-price order ratio":  "improve-fullprice-ratio",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IMPACT_CONFIG: Record<ImpactLevel, { label: string; classes: string }> = {
  "high":      { label: "High impact",  classes: "bg-destructive/10 text-destructive" },
  "medium":    { label: "Medium impact", classes: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  "quick-win": { label: "Quick win",    classes: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" },
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

  // ── Intelligent ranking ──────────────────────────────────────────────────────
  // Composite score: confidence (35%) + effort (25%) + timing (20%) + uplift (20%).
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
  );

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
  const expandedOpportunity = visibleQueue.find((o) => o.id === expandedOppId);
  const selectedOpportunity = expandedOpportunity ?? topAction;

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

  const showHeadline     = canAccess("opportunities_headline_value");
  const showUpliftValues = canAccess("opportunities_uplift_values");
  const showExecPriority = canAccess("opportunities_execution_priority");
  const showRowDetail    = canAccess("opportunities_row_detail");

  return (
    <AppLayout>

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Execution Queue</h1>
          <p className="text-muted-foreground mt-1">
            The next profit actions to take, ranked by impact, confidence, effort and timing.
          </p>
        </div>
        <span className="text-sm text-muted-foreground font-medium bg-secondary px-3 py-1.5 rounded-lg">
          {periodLabel}
        </span>
      </div>

      {/* ── CFO verdict ── */}
      <div className="sc-purple rounded-2xl px-6 py-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-300/80 mb-2">
              CFO verdict
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-foreground leading-tight">
              Do {topAction?.label ?? "the highest-confidence action"} first.
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-3xl leading-relaxed">
              {topAction
                ? `${topAction.label} is the first move because it combines the strongest near-term profit impact with ${topAction.confidence.toLowerCase()} confidence, ${topAction.effort.toLowerCase()} effort and ${topAction.timing.toLowerCase()} timing.`
                : loading
                  ? "Loading the current opportunity queue."
                  : "No active execution actions were found for this period."}
            </p>
            {!showExecPriority && (
              <div className="flex items-center gap-2 mt-3 text-xs text-indigo-200/70">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>Upgrade to unlock the full prioritised execution plan.</span>
              </div>
            )}
          </div>

          {topAction && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2 w-full lg:w-[22rem] shrink-0">
              <div className="rounded-lg border border-indigo-300/15 bg-indigo-950/25 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300/60">Impact</p>
                {showUpliftValues ? (
                  <p className="text-sm font-bold text-emerald-300 mt-1">{topAction.impactRangeLabel}</p>
                ) : (
                  <p className="text-sm font-bold text-emerald-300 mt-1 blur-sm select-none">£00k-£00k/mo</p>
                )}
              </div>
              <div className="rounded-lg border border-indigo-300/15 bg-indigo-950/25 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300/60">Confidence</p>
                <p className="text-sm font-semibold text-foreground mt-1">{topAction.confidence}</p>
              </div>
              <div className="rounded-lg border border-indigo-300/15 bg-indigo-950/25 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300/60">Effort</p>
                <p className="text-sm font-semibold text-foreground mt-1">{topAction.effort}</p>
              </div>
              <div className="rounded-lg border border-indigo-300/15 bg-indigo-950/25 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300/60">Timing</p>
                <p className="text-sm font-semibold text-foreground mt-1">{topAction.timing}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Execution queue ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50">
          <h3 className="font-semibold text-lg text-foreground">Execution Queue</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Top 3 actions to take first. Expand a row for the mechanics and source detail.
          </p>
        </div>

        <div className="divide-y divide-border/40">
          {visibleQueue.map((opp, idx) => {
            const isExpanded = expandedOppId ? expandedOppId === opp.id : idx === 0;

            return (
              <div key={opp.id} className={cn(
                "px-6 py-4",
                idx === 0 && "bg-emerald-50/40 dark:bg-emerald-950/10",
                isExpanded && "ring-1 ring-inset ring-primary/20",
              )}>
                <button
                  type="button"
                  onClick={() => setExpandedOppId(isExpanded ? null : opp.id)}
                  className="w-full text-left"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_9rem_7rem_6rem_7rem_1.5rem] gap-3 lg:items-center">
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
                          {idx === 0 && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                              Do first
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {opp.implementationType}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 lg:hidden">Impact</p>
                      {showUpliftValues ? (
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{opp.impactRangeLabel}</p>
                      ) : (
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 blur-sm select-none">£00k-£00k/mo</p>
                      )}
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 lg:hidden">Confidence</p>
                      <p className="text-xs font-semibold text-foreground">{opp.confidence}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 lg:hidden">Effort</p>
                      <p className="text-xs font-semibold text-foreground">{opp.effort}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 lg:hidden">Timing</p>
                      <p className="text-xs font-semibold text-foreground">{opp.timing}</p>
                    </div>

                    <ChevronDown className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform justify-self-end",
                      isExpanded && "rotate-180",
                    )} />
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Money available ── */}
      <div className="sc-teal rounded-2xl shadow-sm mb-8 overflow-hidden">
        <div className="px-6 py-5 border-b border-[#2E7C8F]/50 flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#22D3EE]/15 shrink-0">
            <TrendingUp className="w-5 h-5 text-[#22D3EE]" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 mb-1">
              Money available
            </p>
            <p className="text-sm text-emerald-700/70 dark:text-emerald-400/80 leading-relaxed">
              The queue separates recurring contribution recovery from one-off cash release projects.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#2E7C8F]/40">
          <div className="px-6 py-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/60 dark:text-emerald-300/60">Recoverable contribution</p>
            {showHeadline ? (
              <p className="text-3xl font-display font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                £{(liveTotalLow / 1000).toFixed(0)}k–£{(liveTotalHigh / 1000).toFixed(0)}k/month
              </p>
            ) : (
              <p className="text-3xl font-display font-bold text-emerald-700 dark:text-emerald-300 mt-1 blur-sm select-none">
                £00k-£00k/month
              </p>
            )}
          </div>
          <div className="px-6 py-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/60 dark:text-emerald-300/60">Capital-free uplift</p>
            {showHeadline ? (
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                £{(capitalFreeLow / 1000).toFixed(0)}k–£{(capitalFreeHigh / 1000).toFixed(0)}k
              </p>
            ) : (
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1 blur-sm select-none">£00k-£00k</p>
            )}
            <p className="text-xs text-emerald-800/60 dark:text-emerald-300/60 mt-1">Requires no new budget spend.</p>
          </div>
          <div className="px-6 py-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/60 dark:text-emerald-300/60">All identified value</p>
            {showUpliftValues ? (
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                £{(liveAllLow / 1_000).toFixed(0)}k–£{(liveAllHigh / 1_000).toFixed(0)}k
              </p>
            ) : (
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1 blur-sm select-none">£00k-£00k</p>
            )}
            <p className="text-xs text-emerald-800/60 dark:text-emerald-300/60 mt-1">Includes cash release projects.</p>
          </div>
        </div>
      </div>

      {/* ── Expanded opportunity detail ── */}
      {selectedOpportunity && (
        <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-border/50">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">
              Expanded opportunity detail
            </p>
            <h3 className="font-semibold text-lg text-foreground">{selectedOpportunity.label}</h3>
          </div>

          {!showRowDetail ? (
            <div className="px-6 py-5 flex items-start sm:items-center justify-between gap-4 flex-wrap bg-indigo-50/50 dark:bg-indigo-950/20">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0">
                  <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Unlock expanded action detail</p>
                  <p className="text-xs text-indigo-700/60 dark:text-indigo-400/60 mt-0.5">
                    See why this action matters, where the estimate comes from and which scenario to model.
                  </p>
                </div>
              </div>
              <a href="/upgrade" className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                Upgrade to Pro
              </a>
            </div>
          ) : (
            <div className="px-6 py-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_17rem] gap-6">
              <div>
                <p className="text-sm text-muted-foreground leading-relaxed">{selectedOpportunity.description}</p>
                {(() => { const r = liveRationale(selectedOpportunity); return r ? (
                  <p className="text-xs text-muted-foreground/60 mt-2 leading-snug italic">{r}</p>
                ) : null; })()}
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <TimingBadge timing={selectedOpportunity.timing} />
                  <ConfidenceBadge
                    level={selectedOpportunity.confidence}
                    helper={
                      selectedOpportunity.confidence === "High"
                        ? "Based on direct Shopify and cost data."
                        : selectedOpportunity.confidence === "Medium"
                          ? "Based on channel-level attribution and recent trend data."
                          : "Requires more complete mapping or longer trading history."
                    }
                  />
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                    EFFORT_COLORS[selectedOpportunity.effort],
                  )}>
                    Effort: {selectedOpportunity.effort}
                  </span>
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold",
                    IMPACT_CONFIG[selectedOpportunity.impact as ImpactLevel].classes,
                  )}>
                    {IMPACT_CONFIG[selectedOpportunity.impact as ImpactLevel].label}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {showUpliftValues && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Expected impact</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{selectedOpportunity.impactRangeLabel}</p>
                    {selectedOpportunity.annualImpact > 0 && (
                      <p className="text-xs text-muted-foreground/60">Approx. £{(selectedOpportunity.annualImpact / 1000).toFixed(0)}k/year</p>
                    )}
                  </div>
                )}
                {selectedOpportunity.sources.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1">Source analysis</p>
                    {selectedOpportunity.sources.map((src: { label: string; href: string }) => (
                      <Link
                        key={src.href}
                        href={src.href}
                        className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                      >
                        {src.label}
                      </Link>
                    ))}
                  </div>
                )}
                <AiCfoInlineButtons pageId="opportunities" />
                {TITLE_TO_PRESET[selectedOpportunity.label] && (
                  <a
                    href={`/scenario-lab?preset=${TITLE_TO_PRESET[selectedOpportunity.label]}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    Model this scenario
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Cash release projects ── */}
      {cashReleaseProjects.length > 0 && (
        <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-border/50 flex items-center gap-3">
            <Target className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <h3 className="font-semibold text-lg text-foreground">Cash Release Projects</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Valuable working-capital actions, kept separate from monthly contribution recovery.
              </p>
            </div>
          </div>
          <div className="divide-y divide-border/40">
            {cashReleaseProjects.map((opp) => (
              <div key={opp.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{opp.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{opp.implementationType}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {showUpliftValues ? (
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{opp.impactRangeLabel}</span>
                  ) : (
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-400 blur-sm select-none">£00k-£00k cash</span>
                  )}
                  <span className="text-xs font-semibold text-muted-foreground">{opp.confidence} confidence</span>
                  <span className="text-xs font-semibold text-muted-foreground">{opp.effort} effort</span>
                  <span className="text-xs font-semibold text-muted-foreground">{opp.timing}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AiCfoAskCard pageId="opportunities" />

      <DataBenchmarkAssumptions
        benchmarkNote="Opportunities are ranked by estimated value, confidence, timing and effort."
        dataQualityNote="Opportunity values are directional estimates based on current connected data quality."
        confidenceNote="High-confidence opportunities use direct Shopify and cost data. Medium and low confidence use industry benchmarks and trend extrapolation."
        className="mb-2"
      />

    </AppLayout>
  );
}
