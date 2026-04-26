import { useEffect, useRef } from "react";
import { X, Sparkles, Lock, ShieldCheck, TrendingUp, Lightbulb, ChevronRight } from "lucide-react";
import { useAiCfo } from "@/components/AiCfoProvider";
import { AI_CFO_RESPONSES, type Confidence } from "@/lib/aiCfoResponses";
import { canAccess } from "@/lib/plan";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const CONFIDENCE_META: Record<Confidence, { label: string; colour: string }> = {
  high:   { label: "High confidence",   colour: "text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700/50" },
  medium: { label: "Medium confidence", colour: "text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700/50" },
  low:    { label: "Lower confidence",  colour: "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600/50" },
};

export function AiCfoDrawer() {
  const { isOpen, activePageId, closeDrawer } = useAiCfo();
  const hasActionPlans = canAccess("ai_cfo_action_plans");
  const [, navigate] = useLocation();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => closeRef.current?.focus(), 50);
      document.body.style.overflow = "hidden";
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

  const shownEvidence = hasActionPlans ? data.evidence : data.evidence.slice(0, 2);

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
          "fixed top-0 right-0 z-50 h-full w-full max-w-[480px] bg-background shadow-2xl border-l border-border transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-primary/5 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/15">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">AI CFO Analysis</p>
            <p className="text-sm font-semibold text-foreground leading-tight truncate">{data.question}</p>
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

          {/* Confidence badge */}
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className={cn("inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full border", conf.colour)}>
              {conf.label}
            </span>
            <span className="text-[11px] text-muted-foreground">· Based on your last 30 days of data</span>
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
                    Pro includes specific step-by-step recommended actions and quantified expected impact for every AI CFO analysis — across all 9 dashboard pages.
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
