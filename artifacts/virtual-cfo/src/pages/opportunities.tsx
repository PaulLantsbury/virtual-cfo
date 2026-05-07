import { useEffect, useState } from "react";
import { useLatestDataPeriod } from "@/lib/analytics/useLatestDataPeriod";
import {
  getMarketingChannelMetrics,
  type ChannelOpportunity,
  type BlendedMarketingPerformance,
} from "@/lib/analytics/marketingChannelMetrics";
import { TrendingUp, Zap, Lock, Tag, Target, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { canAccess } from "@/lib/plan";
import { SHARED_OPPORTUNITIES } from "@/lib/mock-data";
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

// ─── Adapt shared opportunities to page format ────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Pricing:    "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-200/60 dark:border-indigo-700/30",
  Marketing:  "bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-400 border-violet-200/60 dark:border-violet-700/30",
  Margin:     "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200/60 dark:border-blue-700/30",
  Cash:       "bg-amber-50 dark:bg-amber-950/15 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-700/30",
  Operations: "bg-secondary text-muted-foreground border-border/50",
  Retention:  "bg-rose-50 dark:bg-rose-950/10 text-rose-700 dark:text-rose-400 border-rose-200/50 dark:border-rose-700/25",
};

const EFFORT_COLORS: Record<string, string> = {
  Low:    "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/25",
  Medium: "bg-secondary text-muted-foreground border-border/50",
  High:   "bg-rose-50/70 dark:bg-rose-950/10 text-rose-700 dark:text-rose-400 border-rose-200/50 dark:border-rose-700/25",
};

/*const OPPORTUNITIES = SHARED_OPPORTUNITIES.map((opp) => {
  const midpoint   = Math.round((opp.monthlyImpactLow + opp.monthlyImpactHigh) / 2);
  const impactLevel: ImpactLevel =
    opp.confidence === "High" && opp.effort === "Low" ? "high"
    : opp.effort === "Low" ? "quick-win"
    : "medium";

  return {
    ...opp,
    label:              opp.title,
    description:        opp.recommendedAction,
    uplift:             midpoint,
    impact:             impactLevel,
    implementationType: opp.effort === "Low" ? "No additional investment required" : "Requires operational change",
    timeToImpact:       opp.timing === "Immediate" ? "Immediate impact (0–30 days)"
                        : opp.timing === "1–2 weeks" || opp.timing === "2–4 weeks" || opp.timing === "30 days"
                          ? "Short-term impact (1–2 months)"
                          : "Structural impact (2–3 months)",
    capitalFree:        opp.effort === "Low",
    sources:            [{ label: opp.linkedPageLabel, href: opp.linkedPage }],
    impactRangeLabel:   opp.impactType === "cash_improvement"
                        ? `£${(opp.monthlyImpactLow / 1000).toFixed(0)}k–£${(opp.monthlyImpactHigh / 1000).toFixed(0)}k cash`
                        : `£${(opp.monthlyImpactLow / 1000).toFixed(0)}k–£${(opp.monthlyImpactHigh / 1000).toFixed(0)}k/mo`,
  };
});*/

const PRIORITY_NOTE =
  "Start with reducing discount depth and reallocating Meta spend. Together, these two changes represent the highest-confidence, lowest-effort opportunities this month — and both require no additional investment, only a pricing policy change and a budget reallocation.";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IMPACT_CONFIG: Record<ImpactLevel, { label: string; classes: string }> = {
  "high":      { label: "High impact",  classes: "bg-destructive/10 text-destructive" },
  "medium":    { label: "Medium impact", classes: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  "quick-win": { label: "Quick win",    classes: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" },
};

//const maxUplift = Math.max(...OPPORTUNITIES.map((o) => o.uplift));

// ─── Component ────────────────────────────────────────────────────────────────

export default function Opportunities() {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOpportunities() {
      try {
        const res = await fetch(`/api/opportunities?store_id=${STORE_ID}`);
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

  // "Do now" / "Next wave" section boundary.
  // Uses count of High-confidence + Low-effort ("high" impact) items, minimum 2
  // to preserve the existing 2-item "Do now" section when few top-tier items exist.
  const doNowCount = Math.min(
    Math.max(sortedOpportunities.filter((o) => o.impact === "high").length, 2),
    Math.max(sortedOpportunities.length - 1, 1),
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

  // Dynamic header bullets: highest-confidence and fastest-timing ranked items.
  const highestConfOpp = sortedOpportunities.find((o) => o.confidence === "High");
  const fastestOpp     = sortedOpportunities.find((o) => o.timing === "Immediate");

  // Dynamic execution priority note — references live top-2 ranked items.
  const livePriorityNote =
    sortedOpportunities.length >= 2
      ? `Start with "${sortedOpportunities[0].label}" and "${sortedOpportunities[1].label}". ` +
        `Together, these represent the highest-confidence, lowest-effort opportunities this month` +
        (sortedOpportunities[0].capitalFree && sortedOpportunities[1].capitalFree
          ? " — both require no additional investment."
          : ".")
      : PRIORITY_NOTE;

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
  const showWhereToStart = canAccess("opportunities_where_to_start");

  return (
    <AppLayout>

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Profit Opportunities</h1>
          <p className="text-muted-foreground mt-1">
            Rank the highest-impact profit and cash opportunities identified across your business.
          </p>
        </div>
        <span className="text-sm text-muted-foreground font-medium bg-secondary px-3 py-1.5 rounded-lg">
          {periodLabel}
        </span>
      </div>

      {/* ── Total recoverable block ── */}
      <div className="sc-teal rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="px-8 py-8 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#22D3EE]/15 shrink-0">
            <TrendingUp className="w-7 h-7 text-[#22D3EE]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
              Estimated recoverable contribution next month
            </p>

            {showHeadline ? (
              /* Pro: full £ value */
              <>
                <p className="text-5xl font-display font-bold text-emerald-700 dark:text-emerald-300 leading-none">
                  £{(liveTotalLow / 1000).toFixed(0)}k–£{(liveTotalHigh / 1000).toFixed(0)}k/month
                </p>
                <p className="text-sm text-emerald-700/70 dark:text-emerald-400/80 mt-2 leading-snug">
                  Recoverable contribution identified across pricing, marketing, margin and cash.
                  Estimates update automatically when live data is connected.
                </p>
                <div className="flex flex-wrap gap-3 mt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800/70 dark:text-emerald-300/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    Highest confidence: {highestConfOpp?.label ?? "Reduce average discount depth"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800/70 dark:text-emerald-300/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    Fastest: {fastestOpp?.label ?? "Reduce discount depth"} — Immediate
                  </span>
                </div>
              </>
            ) : (
              /* Free: blurred value + upgrade prompt */
              <>
                <p
                  className="text-5xl font-display font-bold text-emerald-700 dark:text-emerald-300 leading-none select-none pointer-events-none"
                  style={{ filter: "blur(8px)" }}
                  aria-hidden="true"
                >
                  £{(liveTotalLow / 1000).toFixed(0)}k–£{(liveTotalHigh / 1000).toFixed(0)}k
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Lock className="w-3.5 h-3.5 text-emerald-600/60 dark:text-emerald-500/60 shrink-0" />
                  <p className="text-sm text-emerald-700/70 dark:text-emerald-400/80 leading-snug">
                    {sortedOpportunities.length} profit opportunities identified — upgrade to see quantified recovery estimates
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Capital-free uplift strip — Pro only (contains £ values) */}
        {showHeadline && (
          <div className="px-8 py-3.5 border-t border-[#2E7C8F]/50 bg-[#22D3EE]/8 flex items-center gap-3">
            <Zap className="w-3.5 h-3.5 text-[#22D3EE] shrink-0" />
            <p className="text-xs text-emerald-800/70 dark:text-emerald-400/80 leading-snug">
              <span className="font-semibold">
                Estimated capital-free uplift: £{(capitalFreeLow / 1000).toFixed(0)}k–£{(capitalFreeHigh / 1000).toFixed(0)}k
              </span>
              {" "}— from opportunities requiring no new budget spend
            </p>
          </div>
        )}
      </div>

      <AiCfoAskCard pageId="opportunities" />

      {/* ── Execution priority strip — Pro only ── */}
      {showExecPriority && (
        <div className="sc-purple rounded-2xl px-6 py-5 mb-6 flex items-start gap-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-900/40 shrink-0 mt-0.5">
            <Zap className="w-4 h-4 text-indigo-300" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-300/80 mb-1.5">
              Execution priority this month
            </p>
            <p className="text-sm font-medium text-foreground leading-relaxed">
              {livePriorityNote}
            </p>
          </div>
        </div>
      )}

      {/* ── Opportunity list ── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-border/50">
          <h3 className="font-semibold text-lg text-foreground">Identified Opportunities</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ranked by estimated contribution uplift. Each figure represents additional contribution profit next month.
          </p>
        </div>

        <div className="divide-y divide-border/40">
          {sortedOpportunities.map((opp, idx) => {
            const { label: impactLabel, classes: impactClasses } = IMPACT_CONFIG[opp.impact as ImpactLevel];
            const barPct = Math.round((opp.uplift / maxUplift) * 100);

            return showRowDetail ? (
              /* ── Pro row: full detail ── */
              <div key={opp.id} className="px-6 py-5 hover:bg-secondary/20 transition-colors">
                {idx === 0 && (
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Do now</span>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>
                )}
                {idx === doNowCount && (
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Next wave</span>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>
                )}
                <div className="flex items-start justify-between gap-4 mb-2">

                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      {/* Category badge + title */}
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border",
                          CATEGORY_COLORS[opp.category] ?? "bg-secondary text-muted-foreground border-border/50",
                        )}>
                          <Tag className="w-2.5 h-2.5" />
                          {opp.category}
                        </span>
                      </div>
                      <p className="font-semibold text-foreground text-sm leading-snug">{opp.label}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{opp.description}</p>
                      {/* Live "why this matters" rationale — Phase 1 + Phase 3 signals */}
                      {(() => { const r = liveRationale(opp); return r ? (
                        <p className="text-[11px] text-muted-foreground/50 mt-1.5 leading-snug italic">{r}</p>
                      ) : null; })()}
                      {/* Badge row: timing, confidence, effort */}
                      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                        <TimingBadge timing={opp.timing} />
                        <ConfidenceBadge
                          level={opp.confidence}
                          helper={
                            opp.confidence === "High"
                              ? "Based on direct Shopify and cost data."
                              : opp.confidence === "Medium"
                                ? "Based on channel-level attribution and recent trend data."
                                : "Requires more complete mapping or longer trading history."
                          }
                        />
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                          EFFORT_COLORS[opp.effort],
                        )}>
                          Effort: {opp.effort}
                        </span>
                      </div>
                      {/* Source link */}
                      <div className="mt-1.5">
                        <span className="text-[11px] text-muted-foreground/50">
                          See analysis:{" "}
                          {opp.sources.map((src: { label: string; href: string }, i: number) => (
                            <span key={src.href}>
                              {i > 0 && <span className="text-muted-foreground/30">, </span>}
                              <Link
                                href={src.href}
                                className="underline-offset-2 hover:underline hover:text-muted-foreground transition-colors"
                              >
                                {src.label}
                              </Link>
                            </span>
                          ))}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {showUpliftValues && (
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap leading-tight">
                          {opp.impactRangeLabel}
                        </p>
                        {opp.impactType === "monthly_contribution" && opp.annualImpact > 0 && (
                          <p className="text-[10px] text-muted-foreground/60 whitespace-nowrap">
                            ≈ £{(opp.annualImpact / 1000).toFixed(0)}k/year
                          </p>
                        )}
                        {opp.impactType === "cash_improvement" && (
                          <p className="text-[10px] text-muted-foreground/60 whitespace-nowrap">
                            One-off cash release
                          </p>
                        )}
                      </div>
                    )}
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap",
                      impactClasses,
                    )}>
                      {impactLabel}
                    </span>
                  </div>
                </div>

                <div className="ml-9 mt-3">
                  <div className="w-full h-1.5 bg-secondary rounded-full">
                    <div
                      className="h-1.5 rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {barPct}% of largest single opportunity
                  </p>
                  <div className="mt-3">
                    <AiCfoInlineButtons pageId="opportunities" />
                  </div>
                </div>
              </div>
            ) : (
              /* ── Free row: masked — rank + progress bar preserved, detail obscured ── */
              <div key={opp.id} className="px-6 py-4">
                {idx === 0 && (
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Do now</span>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>
                )}
                {idx === doNowCount && (
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Next wave</span>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>
                )}
                <div className="flex items-start justify-between gap-4 mb-2">

                  {/* Left: rank visible, label + description blurred */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      {/* Label: blurred — shape and word-count visible, text unreadable */}
                      <p
                        className="font-semibold text-foreground text-sm leading-snug select-none pointer-events-none"
                        style={{ filter: "blur(5px)" }}
                        aria-hidden="true"
                      >
                        {opp.label}
                      </p>
                      {/* Description: more heavily blurred — clearly blocked */}
                      <p
                        className="text-xs text-muted-foreground mt-1 leading-relaxed select-none pointer-events-none"
                        style={{ filter: "blur(4px)", opacity: 0.45 }}
                        aria-hidden="true"
                      >
                        {opp.description.slice(0, 80)}
                      </p>
                    </div>
                  </div>

                  {/* Right: stronger masking — colored badge visible, text blurred; no £ value */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {/* Impact badge: color tier preserved (signals relative importance), text blurred */}
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap",
                      impactClasses,
                    )}>
                      <span
                        className="select-none pointer-events-none"
                        style={{ filter: "blur(6px)" }}
                        aria-hidden="true"
                      >
                        {impactLabel}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Progress bar: fully visible — communicates relative scale without revealing £ */}
                <div className="ml-9 mt-2">
                  <div className="w-full h-1.5 bg-secondary rounded-full">
                    <div
                      className="h-1.5 rounded-full bg-emerald-400/50 transition-all"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom row: Pro shows total, Free shows upgrade CTA */}
        {showUpliftValues ? (
          <div className="px-6 py-4 bg-emerald-50/60 dark:bg-emerald-950/15 border-t border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Total estimated uplift</span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              £{(liveAllLow / 1_000).toFixed(0)}k–£{(liveAllHigh / 1_000).toFixed(0)}k
            </span>
          </div>
        ) : (
          <div className="px-6 py-5 border-t border-border/40 bg-indigo-50/50 dark:bg-indigo-950/20">
            <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0 mt-0.5 sm:mt-0">
                  <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                    Unlock opportunity breakdown
                  </p>
                  <p className="text-xs text-indigo-700/60 dark:text-indigo-400/60 mt-0.5">
                    See the £ impact, confidence level, and time-to-impact for each action.
                  </p>
                </div>
              </div>
              <a
                href="/upgrade"
                className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors whitespace-nowrap shrink-0"
              >
                Upgrade to Pro →
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── Where to start — always visible; content gated ── */}
      <div className="sc-purple rounded-2xl shadow-sm overflow-hidden">
        <div className="sc-purple-header flex items-center gap-2.5 px-6 py-3.5">
          <Target className="w-4 h-4 text-indigo-300 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
            Where to start
          </span>
        </div>

        {showWhereToStart ? (
          <div className="px-6 py-5">
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Both can be actioned this week with no new budget. Start with whichever your team has most direct control over.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mappedOpportunities.slice(0, 2).map((opp) => (
                <div
                  key={opp.id}
                  className="flex items-center gap-3 rounded-xl bg-card border border-border/50 px-4 py-3.5 shadow-sm"
                >
                  <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-snug">{opp.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{opp.implementationType}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                    +£{opp.uplift.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-6 py-5 bg-indigo-50/50 dark:bg-indigo-950/20">
            <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0 mt-0.5 sm:mt-0">
                  <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                    Unlock prioritised execution plan
                  </p>
                  <p className="text-xs text-indigo-700/60 dark:text-indigo-400/60 mt-0.5">
                    See the top 1–2 changes to make first and how much they are worth.
                  </p>
                </div>
              </div>
              <a
                href="/upgrade"
                className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors whitespace-nowrap shrink-0"
              >
                Upgrade to Pro →
              </a>
            </div>
          </div>
        )}
      </div>

      <DataBenchmarkAssumptions
        benchmarkNote="Opportunities are ranked by estimated value, confidence, timing and effort."
        dataQualityNote="Opportunity values are directional estimates based on current connected data quality."
        confidenceNote="High-confidence opportunities use direct Shopify and cost data. Medium and low confidence use industry benchmarks and trend extrapolation."
        className="mb-2"
      />

    </AppLayout>
  );
}
