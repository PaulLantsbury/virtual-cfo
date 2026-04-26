import { useEffect, useRef, useState } from "react";
import {
  X, Sparkles, Lock, ShieldCheck, TrendingUp, Lightbulb,
  ChevronRight, FlaskConical, Loader2,
} from "lucide-react";
import { useAiCfo } from "@/components/AiCfoProvider";
import { AI_CFO_RESPONSES, type PageId, type Confidence } from "@/lib/aiCfoResponses";
import { canAccess } from "@/lib/plan";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

// ─── Page metadata ────────────────────────────────────────────────────────────

const PAGE_NAMES: Record<PageId, string> = {
  dashboard:     "Dashboard",
  margin:        "Profit Margin Analysis",
  growth:        "Growth Quality",
  marketing:     "Marketing Efficiency",
  pricing:       "Pricing Optimisation",
  profit:        "Profit Engine",
  cash:          "Cash Control",
  opportunities: "Profit Opportunities",
  scenario:      "Scenario Lab",
  alerts:        "CFO Alerts",
};

const CONFIDENCE_META: Record<Confidence, { label: string; colour: string }> = {
  high:   { label: "High confidence",   colour: "text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700/50" },
  medium: { label: "Medium confidence", colour: "text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700/50" },
  low:    { label: "Lower confidence",  colour: "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600/50" },
};

const FOLLOW_UP_CHIPS = [
  "Show assumptions",
  "Model impact",
  "Create action plan",
  "Explain risk level",
];

// ─── Component ────────────────────────────────────────────────────────────────

export function AiCfoDrawer() {
  const { isOpen, activePageId, activeQuestion, closeDrawer, openDrawer } = useAiCfo();
  const hasActionPlans = canAccess("ai_cfo_action_plans");
  const [, navigate] = useLocation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => closeRef.current?.focus(), 50);
      document.body.style.overflow = "hidden";
      setFollowUpQuestion(null);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeDrawer(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeDrawer]);

  if (!activePageId) return null;

  const data = AI_CFO_RESPONSES[activePageId];
  const conf = CONFIDENCE_META[data.confidence];
  const pageName = PAGE_NAMES[activePageId];
  const displayQuestion = followUpQuestion ?? activeQuestion ?? data.question;
  const shownEvidence = hasActionPlans ? data.evidence : data.evidence.slice(0, 2);

  function handleFollowUp(chip: string) {
    setFollowUpLoading(true);
    setTimeout(() => {
      setFollowUpQuestion(chip);
      setFollowUpLoading(false);
    }, 400);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="AI CFO Analysis"
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full max-w-[500px] bg-background shadow-2xl border-l border-border transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-primary/5 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/15">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">AI CFO Analysis</p>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary/70 border border-primary/20">
                Context: {pageName}
              </span>
            </div>
            <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
              {followUpLoading ? "Analysing…" : displayQuestion}
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={closeDrawer}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-secondary transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {followUpLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm">Analysing your question…</p>
            </div>
          ) : (
            <>
              {/* Confidence badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className={cn("inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full border", conf.colour)}>
                  {conf.label}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  · Based on your recent {pageName.toLowerCase()} data and trends
                </span>
              </div>

              {/* Verdict */}
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-3.5 h-3.5 text-primary shrink-0" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">CFO Verdict</p>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{data.verdict}</p>
              </div>

              {/* Evidence */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Supporting Evidence
                </p>
                <ul className="space-y-2.5">
                  {shownEvidence.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/90 leading-relaxed">
                      <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      {item}
                    </li>
                  ))}
                  {!hasActionPlans && data.evidence.length > 2 && (
                    <li className="flex items-center gap-2 text-sm text-muted-foreground/70 italic pl-4">
                      <Lock className="w-3 h-3 shrink-0" />
                      {data.evidence.length - 2} more data points available on Pro
                    </li>
                  )}
                </ul>
              </div>

              {/* Action plan — Pro only */}
              {hasActionPlans ? (
                <>
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/50 px-4 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ChevronRight className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                        Recommended Action
                      </p>
                    </div>
                    <p className="text-sm text-emerald-900 dark:text-emerald-200 leading-relaxed">{data.recommendedAction}</p>
                  </div>

                  <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/25 border border-indigo-200 dark:border-indigo-800/50 px-4 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400 shrink-0" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-400">
                        Expected Impact
                      </p>
                    </div>
                    <p className="text-sm text-indigo-900 dark:text-indigo-200 leading-relaxed">{data.expectedImpact}</p>
                  </div>
                </>
              ) : (
                /* Upgrade prompt */
                <div className="rounded-xl border border-dashed border-primary/40 bg-primary/3 px-4 py-5">
                  <div className="flex items-start gap-3">
                    <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-1">
                        Unlock the full action plan
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                        Upgrade to Pro to unlock full CFO action plans — with specific recommended actions and quantified expected impact for every analysis across all pages.
                      </p>
                      <Button
                        size="sm"
                        className="bg-primary text-white hover:bg-primary/90"
                        onClick={() => { closeDrawer(); navigate("/upgrade"); }}
                      >
                        Upgrade to Pro
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Follow-up chips */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Ask next</p>
                <div className="flex flex-wrap gap-2">
                  {FOLLOW_UP_CHIPS.map((chip) => {
                    const isAdvanced = chip === "Model impact" || chip === "Create action plan";
                    const locked = isAdvanced && !hasActionPlans;
                    return (
                      <button
                        key={chip}
                        onClick={() => !locked && handleFollowUp(chip)}
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
                          locked
                            ? "bg-secondary text-muted-foreground/50 border-border/40 cursor-not-allowed"
                            : "bg-background text-foreground border-border/60 hover:bg-primary/10 hover:border-primary/40 hover:text-primary"
                        )}
                        disabled={locked}
                        title={locked ? "Available on Pro" : undefined}
                      >
                        {locked && <Lock className="w-2.5 h-2.5" />}
                        {chip}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scenario Lab CTA — Pro only */}
              {hasActionPlans && (
                <button
                  onClick={() => { closeDrawer(); navigate("/scenario-lab"); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/5 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
                >
                  <FlaskConical className="w-4 h-4" />
                  Apply to Scenario Lab
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-border bg-secondary/20">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            AI CFO analysis is based on your current mock data and industry benchmarks. Figures are indicative — connect live data for production accuracy.
          </p>
        </div>
      </aside>
    </>
  );
}
