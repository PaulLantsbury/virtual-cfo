import { useState } from "react";
import { Lightbulb, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export type ImpactLevel = "high" | "medium" | "quick-win";

export interface Recommendation {
  id: string;
  text: string;
  impact: ImpactLevel;
}

interface ActionRecommendationsProps {
  recommendations: Recommendation[];
  isLoading?: boolean;
  defaultExpanded?: boolean;
  title?: string;
  subtitle?: string;
  viewAllHref?: string;
}

const impactConfig: Record<ImpactLevel, { label: string; classes: string }> = {
  "high": {
    label: "High impact",
    classes: "bg-destructive/10 text-destructive",
  },
  "medium": {
    label: "Medium impact",
    classes: "bg-amber-500/10 text-amber-600",
  },
  "quick-win": {
    label: "Quick win",
    classes: "bg-success/10 text-success",
  },
};

export function ActionRecommendations({
  recommendations,
  isLoading,
  defaultExpanded = true,
  title = "What to do next",
  subtitle = "Recommended actions to improve profitability and cash performance",
  viewAllHref,
}: ActionRecommendationsProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-8">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 shrink-0">
            <Lightbulb className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-foreground leading-none mb-1">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="shrink-0 ml-4 text-muted-foreground">
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Recommended actions
          </p>

          {isLoading ? (
            <ul className="space-y-3">
              {Array(4).fill(0).map((_, i) => (
                <li key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />
                  <div className="h-4 bg-secondary rounded flex-1" />
                  <div className="h-5 w-20 bg-secondary rounded-full shrink-0" />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-3">
              {recommendations.map((rec) => {
                const { label, classes } = impactConfig[rec.impact];
                return (
                  <li
                    key={rec.id}
                    className="flex items-center gap-3 group py-2 border-b border-border/40 last:border-0"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0 mt-0.5 group-hover:bg-primary transition-colors" />
                    <span className="flex-1 text-sm text-foreground leading-snug">
                      {rec.text}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap",
                        classes
                      )}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {viewAllHref && (
            <div className="mt-4 pt-4 border-t border-border/40">
              <Link
                href={viewAllHref}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                View full action plan <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
