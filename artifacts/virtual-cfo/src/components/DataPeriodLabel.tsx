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
 * Text format: "Data: Apr 2026 (latest available)"
 */
export function DataPeriodLabel({ periodLabel, loading, className }: DataPeriodLabelProps) {
  return (
    <p className={cn("flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground/60", className)}>
      <Calendar className="w-3 h-3 shrink-0" />
      {loading ? "Loading…" : `Data: ${periodLabel} (latest available)`}
    </p>
  );
}
