import { ChevronDown } from "lucide-react";
import { TIMELINE_OPTIONS, COMPARE_LABEL, useTimeline } from "@/lib/timeline";
import type { TimelineValue } from "@/lib/timeline";

/**
 * Shared timeline selector — reads and writes the global TimelineContext.
 * Drop into any page header to give the page a consistent period picker.
 *
 * Shows:
 *   - A dropdown for the analysis period (Last 30 days, This month, etc.)
 *   - A date-range badge displaying the resolved period label
 *   - A "Compare to" sub-label beneath the controls
 */
export function TimelineSelector() {
  const { timeline, setTimeline, periodBadge } = useTimeline();

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <div className="flex items-center gap-2">
        {/* Period dropdown */}
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

        {/* Resolved period badge */}
        <span className="text-sm text-muted-foreground font-medium bg-secondary px-3 py-1.5 rounded-lg border border-border/40 whitespace-nowrap">
          {periodBadge}
        </span>
      </div>

      {/* Compare to label */}
      <span className="text-[11px] text-muted-foreground/60">{COMPARE_LABEL}</span>
    </div>
  );
}
