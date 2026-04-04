import { ChevronDown } from "lucide-react";
import { TIMELINE_OPTIONS, useTimeline } from "@/lib/timeline";
import type { TimelineValue } from "@/lib/timeline";

/**
 * Shared timeline selector — reads and writes the global TimelineContext.
 * Drop into any supported page header to give the page a consistent period picker.
 */
export function TimelineSelector() {
  const { timeline, setTimeline, periodBadge } = useTimeline();

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="relative">
        <select
          value={timeline}
          onChange={(e) => setTimeline(e.target.value as TimelineValue)}
          className="appearance-none bg-secondary text-sm font-medium text-foreground pl-3 pr-8 py-1.5 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 border border-border/40"
          aria-label="Select analysis period"
        >
          {TIMELINE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      <span className="text-sm text-muted-foreground font-medium bg-secondary px-3 py-1.5 rounded-lg border border-border/40 whitespace-nowrap">
        {periodBadge}
      </span>
    </div>
  );
}
