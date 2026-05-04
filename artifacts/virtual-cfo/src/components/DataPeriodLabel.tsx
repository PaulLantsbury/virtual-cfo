import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataPeriodLabelProps {
  periodLabel: string;
  loading: boolean;
  className?: string;
}

/**
 * Displays the resolved data period from useLatestDataPeriod below each page's
 * subtitle. Renders a muted placeholder while the hook is still walking back
 * through months, then swaps to the live label once resolved.
 *
 * Fallback detection (UI-level only):
 *   Compares the resolved periodLabel against the current calendar month.
 *   If they differ, the hook walked back to a prior month because the current
 *   month has no data yet — a native title tooltip is shown on hover.
 *
 *   IMPORTANT: The toLocaleString format used here must stay in sync with
 *   useLatestDataPeriod.ts → getPeriod() → toLocaleString("en-GB", …).
 *   If that format ever changes, update the currentMonth derivation below.
 *
 * Text format: "Data: Apr 2026"
 */
export function DataPeriodLabel({ periodLabel, loading, className }: DataPeriodLabelProps) {
  // UI-level fallback check — no hook or page changes required.
  // Format mirrors useLatestDataPeriod.ts → getPeriod() exactly.
  const currentMonth = new Date().toLocaleString("en-GB", { month: "short", year: "numeric" });
  const isFallback   = !loading && periodLabel !== currentMonth;

  return (
    <p
      className={cn("flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground/60", className)}
      title={isFallback ? "No data yet for current month — showing latest available" : undefined}
    >
      <Calendar className="w-3 h-3 shrink-0" />
      {loading ? "Loading…" : `Data: ${periodLabel}`}
    </p>
  );
}
