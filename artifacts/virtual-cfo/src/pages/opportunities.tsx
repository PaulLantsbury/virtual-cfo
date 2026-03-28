import { TrendingUp, Target, ArrowRight } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";

// ─── Data constants ───────────────────────────────────────────────────────────

/**
 * @dynamic Total range computed as sum of opportunity uplifts ± uncertainty factor.
 * Update TOTAL_LOW / TOTAL_HIGH when opportunity estimates are replaced with live data.
 */
const TOTAL_LOW  = 28_000;
const TOTAL_HIGH = 46_000;

type ImpactLevel = "high" | "medium" | "quick-win";

/**
 * @dynamic Each uplift estimate is computed from:
 *   uplift = orderVolume × perOrderGain
 * where perOrderGain is derived from the specific lever (discount reduction,
 * CAC improvement, shipping renegotiation, email revenue per send, etc.).
 */
const OPPORTUNITIES: {
  id: string;
  label: string;
  description: string;
  uplift: number;
  impact: ImpactLevel;
}[] = [
  {
    id: "o1",
    label: "Reallocate Meta spend",
    description: "Shift 15% of Meta budget to email and organic channels, reducing blended CAC and improving contribution margin by ~1.2pp.",
    uplift: 14_600,
    impact: "high",
  },
  {
    id: "o2",
    label: "Reduce discount depth",
    description: "Lower average discount depth from 7% to 5% on returning customers. Retains revenue while recovering ~0.6pp of contribution margin.",
    uplift: 9_200,
    impact: "high",
  },
  {
    id: "o3",
    label: "Improve shipping pricing",
    description: "Renegotiate carrier rates or introduce free-shipping thresholds. At current volume, a 10% reduction in shipping costs adds ~£3.70 per order.",
    uplift: 6_800,
    impact: "medium",
  },
  {
    id: "o4",
    label: "Increase email conversion",
    description: "Strengthen post-purchase and winback email flows. Email has the highest contribution margin (58.6%) and lowest CAC (£4.80) of any channel.",
    uplift: 4_300,
    impact: "quick-win",
  },
];

const TOP_TWO_UPLIFT = OPPORTUNITIES.slice(0, 2).reduce((s, o) => s + o.uplift, 0);
const TOTAL_MID      = (TOTAL_LOW + TOTAL_HIGH) / 2;
const TOP_TWO_PCT    = Math.round((TOP_TWO_UPLIFT / TOTAL_MID) * 100);

const PRIORITY_NOTE =
  `Start by reallocating Meta spend and reducing discount depth. Together these two changes represent over ${TOP_TWO_PCT > 60 ? "60" : TOP_TWO_PCT}% of the recoverable contribution improvement this month and require no additional investment — only reallocation.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IMPACT_CONFIG: Record<ImpactLevel, { label: string; classes: string }> = {
  "high":      { label: "High impact", classes: "bg-destructive/10 text-destructive" },
  "medium":    { label: "Medium impact", classes: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  "quick-win": { label: "Quick win", classes: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" },
};

const maxUplift = Math.max(...OPPORTUNITIES.map((o) => o.uplift));

// ─── Component ────────────────────────────────────────────────────────────────

export default function Opportunities() {
  return (
    <AppLayout>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Profit Opportunities
          </h1>
          <p className="text-muted-foreground mt-1">
            Identify the fastest ways to increase contribution profit.
          </p>
        </div>
        <span className="text-sm text-muted-foreground font-medium bg-secondary px-3 py-1.5 rounded-lg">
          March 2026
        </span>
      </div>

      {/* ── Total recoverable block ── */}
      <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/50 shadow-sm mb-8 overflow-hidden">
        <div className="px-8 py-8 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 shrink-0">
            <TrendingUp className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
              Estimated recoverable contribution next month
            </p>
            <p className="text-5xl font-display font-bold text-emerald-700 dark:text-emerald-300 leading-none">
              £{(TOTAL_LOW / 1000).toFixed(0)}k–£{(TOTAL_HIGH / 1000).toFixed(0)}k
            </p>
            <p className="text-sm text-emerald-700/70 dark:text-emerald-400/80 mt-2 leading-snug">
              Based on {OPPORTUNITIES.length} identified improvement opportunities at current sales volume.
              Estimates will update automatically when live data is connected.
            </p>
          </div>
        </div>
      </div>

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

            return (
              <div key={opp.id} className="px-6 py-5 hover:bg-secondary/20 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Rank number */}
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm leading-snug">{opp.label}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{opp.description}</p>
                    </div>
                  </div>

                  {/* Uplift + badge */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      +£{opp.uplift.toLocaleString()}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap",
                        impactClasses
                      )}
                    >
                      {impactLabel}
                    </span>
                  </div>
                </div>

                {/* Contribution bar */}
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
            );
          })}
        </div>

        {/* Total row */}
        <div className="px-6 py-4 bg-emerald-50/60 dark:bg-emerald-950/15 border-t border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Total estimated uplift</span>
          <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            £{(TOTAL_LOW / 1_000).toFixed(0)}k–£{(TOTAL_HIGH / 1_000).toFixed(0)}k
          </span>
        </div>
      </div>

      {/* ── Where to start ── */}
      <div className="rounded-2xl border border-primary/25 bg-primary/5 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-3.5 bg-primary/10 border-b border-primary/20">
          <Target className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Where to start
          </span>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm font-medium text-foreground leading-relaxed mb-5">
            {PRIORITY_NOTE}
          </p>

          {/* Top 2 callout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {OPPORTUNITIES.slice(0, 2).map((opp) => (
              <div
                key={opp.id}
                className="flex items-center gap-3 rounded-xl bg-card border border-border/50 px-4 py-3.5 shadow-sm"
              >
                <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-snug">{opp.label}</p>
                </div>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                  +£{opp.uplift.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
