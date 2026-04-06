import { TrendingUp, Target, ArrowRight, Zap, Lock } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { canAccess } from "@/lib/plan";

// ─── Data constants ───────────────────────────────────────────────────────────

/**
 * @dynamic Total range = sum of opportunity uplifts ± uncertainty factor.
 * Update when opportunity estimates are replaced with live data.
 */
const TOTAL_LOW  = 28_000;
const TOTAL_HIGH = 46_000;

/**
 * Capital-free subset: opportunities requiring no new budget spend —
 * only reallocation or policy change.
 * @dynamic Recompute as sum of capitalFree=true opportunity uplift ± uncertainty.
 */
const CAPITAL_FREE_LOW  = 18_000;
const CAPITAL_FREE_HIGH = 26_000;

type ImpactLevel  = "high" | "medium" | "quick-win";
type Confidence   = "High" | "Medium";
type TimeToImpact =
  | "Immediate impact (0–30 days)"
  | "Short-term impact (1–2 months)"
  | "Structural impact (2–3 months)";

/**
 * @dynamic Each uplift estimate is computed from:
 *   uplift = orderVolume × perOrderGain
 * where perOrderGain is derived from the specific lever (CAC delta,
 * discount reduction, shipping renegotiation, email margin per send, etc.)
 */
const OPPORTUNITIES: {
  id:                 string;
  label:              string;
  description:        string;
  uplift:             number;
  impact:             ImpactLevel;
  implementationType: string;
  timeToImpact:       TimeToImpact;
  confidence:         Confidence;
  /** True = no new budget required; eligible for capital-free uplift total */
  capitalFree:        boolean;
}[] = [
  {
    id:    "o1",
    label: "Reallocate Meta spend",
    description:
      "Shift 15% of Meta budget to email and organic channels. Meta's blended CAC (£28) is 5.8× higher than email CAC (£4.80), meaning the same budget generates far more profitable customers through email. Every £1 reallocated recovers approximately £1.20 in contribution margin.",
    uplift:             14_600,
    impact:             "high",
    implementationType: "No additional investment required",
    timeToImpact:       "Immediate impact (0–30 days)",
    confidence:         "High",
    capitalFree:        true,
  },
  {
    id:    "o2",
    label: "Reduce discount depth",
    description:
      "Lower average discount depth from 7% to 5% on returning customer segments. Returning customers have demonstrated intent — discount depth is pure margin loss rather than acquisition cost. Recovering 2pp across 3,680 monthly repeat orders adds approximately £9.2k contribution at current volume.",
    uplift:             9_200,
    impact:             "high",
    implementationType: "No additional investment required",
    timeToImpact:       "Immediate impact (0–30 days)",
    confidence:         "High",
    capitalFree:        true,
  },
  {
    id:    "o3",
    label: "Renegotiate shipping rates",
    description:
      "Renegotiate carrier contract rates or introduce free-shipping thresholds to reduce per-order fulfilment cost. At current order volume, a 10% reduction in shipping cost adds ~£3.70 per order to contribution margin. AOV thresholds above £60 typically reduce subsidy rate by 18–22%.",
    uplift:             6_800,
    impact:             "medium",
    implementationType: "Requires supplier negotiation",
    timeToImpact:       "Short-term impact (1–2 months)",
    confidence:         "Medium",
    capitalFree:        false,
  },
  {
    id:    "o4",
    label: "Activate email conversion flows",
    description:
      "Build post-purchase and winback email sequences targeting lapsed customers. Email generates the highest contribution margin of any channel (58.6%) at the lowest CAC (£4.80). A 0.4pp improvement in email-attributed conversion adds approximately £4.3k monthly contribution from existing list volume.",
    uplift:             4_300,
    impact:             "quick-win",
    implementationType: "Requires CRM setup",
    timeToImpact:       "Short-term impact (1–2 months)",
    confidence:         "Medium",
    capitalFree:        false,
  },
];

const TOP_TWO_UPLIFT = OPPORTUNITIES.slice(0, 2).reduce((s, o) => s + o.uplift, 0);
const TOTAL_MID      = (TOTAL_LOW + TOTAL_HIGH) / 2;
const TOP_TWO_PCT    = Math.round((TOP_TWO_UPLIFT / TOTAL_MID) * 100);

const PRIORITY_NOTE =
  `Start with reallocating Meta spend and reducing discount depth. Together these two changes represent over ${TOP_TWO_PCT > 60 ? "60" : TOP_TWO_PCT}% of the recoverable contribution improvement this month — and both require no additional investment, only reallocation and a pricing policy change.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IMPACT_CONFIG: Record<ImpactLevel, { label: string; classes: string }> = {
  "high":      { label: "High impact",  classes: "bg-destructive/10 text-destructive" },
  "medium":    { label: "Medium impact", classes: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  "quick-win": { label: "Quick win",    classes: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" },
};

const maxUplift = Math.max(...OPPORTUNITIES.map((o) => o.uplift));

// ─── Component ────────────────────────────────────────────────────────────────

export default function Opportunities() {
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
            Ranked by estimated contribution uplift — each figure represents additional profit next month.
          </p>
        </div>
        <span className="text-sm text-muted-foreground font-medium bg-secondary px-3 py-1.5 rounded-lg">
          March 2026
        </span>
      </div>

      {/* ── Total recoverable block ── */}
      <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/50 shadow-sm mb-6 overflow-hidden">
        <div className="px-8 py-8 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 shrink-0">
            <TrendingUp className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
              Estimated recoverable contribution next month
            </p>

            {showHeadline ? (
              /* Pro: full £ value */
              <>
                <p className="text-5xl font-display font-bold text-emerald-700 dark:text-emerald-300 leading-none">
                  £{(TOTAL_LOW / 1000).toFixed(0)}k–£{(TOTAL_HIGH / 1000).toFixed(0)}k
                </p>
                <p className="text-sm text-emerald-700/70 dark:text-emerald-400/80 mt-2 leading-snug">
                  Based on {OPPORTUNITIES.length} identified improvement opportunities at current sales volume.
                  Estimates update automatically when live data is connected.
                </p>
              </>
            ) : (
              /* Free: blurred value + upgrade prompt */
              <>
                <p
                  className="text-5xl font-display font-bold text-emerald-700 dark:text-emerald-300 leading-none select-none pointer-events-none"
                  style={{ filter: "blur(8px)" }}
                  aria-hidden="true"
                >
                  £{(TOTAL_LOW / 1000).toFixed(0)}k–£{(TOTAL_HIGH / 1000).toFixed(0)}k
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Lock className="w-3.5 h-3.5 text-emerald-600/60 dark:text-emerald-500/60 shrink-0" />
                  <p className="text-sm text-emerald-700/70 dark:text-emerald-400/80 leading-snug">
                    {OPPORTUNITIES.length} improvement opportunities identified — upgrade to see the full estimate
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Capital-free uplift strip — Pro only (contains £ values) */}
        {showHeadline && (
          <div className="px-8 py-3.5 border-t border-emerald-200 dark:border-emerald-800/40 bg-emerald-100/40 dark:bg-emerald-900/20 flex items-center gap-3">
            <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500 shrink-0" />
            <p className="text-xs text-emerald-800/70 dark:text-emerald-400/80 leading-snug">
              <span className="font-semibold">
                Estimated capital-free uplift: £{(CAPITAL_FREE_LOW / 1000).toFixed(0)}k–£{(CAPITAL_FREE_HIGH / 1000).toFixed(0)}k
              </span>
              {" "}— from opportunities requiring no new budget spend
            </p>
          </div>
        )}
      </div>

      {/* ── Execution priority strip — Pro only ── */}
      {showExecPriority && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-6 py-5 mb-6 flex items-start gap-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10 shrink-0 mt-0.5">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary/70 mb-1.5">
              Execution priority this month
            </p>
            <p className="text-sm font-medium text-foreground leading-relaxed">
              {PRIORITY_NOTE}
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
          {OPPORTUNITIES.map((opp, idx) => {
            const { label: impactLabel, classes: impactClasses } = IMPACT_CONFIG[opp.impact];
            const barPct = Math.round((opp.uplift / maxUplift) * 100);

            return showRowDetail ? (
              /* ── Pro row: full detail ── */
              <div key={opp.id} className="px-6 py-5 hover:bg-secondary/20 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-2">

                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm leading-snug">{opp.label}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{opp.description}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-[11px] text-muted-foreground/70 font-medium">
                          {opp.timeToImpact}
                        </span>
                        <span className="text-muted-foreground/30 text-[11px]">·</span>
                        <span className={cn(
                          "text-[11px] font-medium",
                          opp.confidence === "High"
                            ? "text-emerald-600/70 dark:text-emerald-500/70"
                            : "text-amber-600/70 dark:text-amber-500/70",
                        )}>
                          Confidence: {opp.confidence}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {showUpliftValues && (
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        +£{opp.uplift.toLocaleString()}
                      </span>
                    )}
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap",
                      impactClasses,
                    )}>
                      {impactLabel}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap bg-secondary text-muted-foreground/70 border border-border/50">
                      {opp.implementationType}
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
                </div>
              </div>
            ) : (
              /* ── Free row: masked — rank + progress bar preserved, detail obscured ── */
              <div key={opp.id} className="px-6 py-4">
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
              £{(TOTAL_LOW / 1_000).toFixed(0)}k–£{(TOTAL_HIGH / 1_000).toFixed(0)}k
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
                    Unlock the full opportunity breakdown
                  </p>
                  <p className="text-xs text-indigo-700/60 dark:text-indigo-400/60 mt-0.5">
                    See ranked £ uplift estimates, execution guidance, and where to focus first
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

      {/* ── Where to start — Pro only ── */}
      {showWhereToStart && (
        <div className="rounded-2xl border border-primary/25 bg-primary/5 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-6 py-3.5 bg-primary/10 border-b border-primary/20">
            <Target className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Where to start
            </span>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Both can be actioned this week with no new budget. Start with whichever your team has most direct control over.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {OPPORTUNITIES.slice(0, 2).map((opp) => (
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
        </div>
      )}

    </AppLayout>
  );
}
