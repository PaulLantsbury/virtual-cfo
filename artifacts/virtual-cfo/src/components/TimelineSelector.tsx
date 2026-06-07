import { cn } from "@/lib/utils";
import { TIMELINE_OPTIONS, useTimeline } from "@/lib/timeline";
import type { TimelineValue } from "@/lib/timeline";

/**
 * Shared CFO reporting period toggle.
 * Users choose only between a weekly review and a monthly review.
 */
export function TimelineSelector() {
  const { timeline, setTimeline } = useTimeline();

  return (
    <div className="inline-flex rounded-xl border border-border/50 bg-secondary/40 p-1 shrink-0">
      {TIMELINE_OPTIONS.map((opt) => {
        const selected = timeline === opt.value;

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTimeline(opt.value as TimelineValue)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              selected
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={selected}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full border",
                selected ? "border-primary bg-primary" : "border-muted-foreground/50",
              )}
            />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
