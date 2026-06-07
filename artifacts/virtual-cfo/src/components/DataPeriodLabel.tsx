import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataPeriodLabelProps {
  periodLabel: string;
  loading: boolean;
  dateFrom?: string;
  dateTo?: string;
  variant?: "using" | "based";
  className?: string;
}

/**
 * subtitle. Renders a muted placeholder while the hook is still walking back
 * through completed periods, then swaps to the live label once resolved.
 *
 * Trust format when dateFrom/dateTo are provided:
 *   "Using latest completed period"
 *   "May 2026: 1 May - 31 May 2026"
 *
 * Forward-looking pages can pass variant="based":
 *   "Based on latest completed period"
 *   "May 2026: 1 May - 31 May 2026"
 *
 * Compact fallback without dateFrom/dateTo:
 *   "Using latest completed period: May 2026"
 */
function formatTradingDateRange(dateFrom: string, dateTo: string): string {
  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);

  const startLabel = start.toLocaleDateString("en-GB", {
    day:   "numeric",
    month: "short",
  });
  const endLabel = end.toLocaleDateString("en-GB", {
    day:   "numeric",
    month: "short",
    year:  "numeric",
  });

  return `${startLabel} – ${endLabel}`;
}

export function DataPeriodLabel({
  periodLabel,
  loading,
  dateFrom,
  dateTo,
  variant = "using",
  className,
}: DataPeriodLabelProps) {
  const hasDateRange = Boolean(dateFrom && dateTo);
  const tradingPeriodRange = dateFrom && dateTo ? formatTradingDateRange(dateFrom, dateTo) : null;
  const trustStatement = variant === "based"
    ? "Based on latest completed period"
    : "Using latest completed period";

  if (hasDateRange) {
    return (
      <div
        className={cn("mt-1.5 inline-flex items-start gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs", className)}
      >
        <Calendar className="w-3 h-3 shrink-0 mt-0.5 text-muted-foreground/60" />
        <div>
          <p className="font-semibold text-foreground">
            {loading ? "Checking latest trading data" : trustStatement}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {loading ? "Loading data basis" : `${periodLabel}: ${tradingPeriodRange}`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <p
      className={cn("flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground/60", className)}
    >
      <Calendar className="w-3 h-3 shrink-0" />
      {loading ? "Checking latest trading data" : `${trustStatement}: ${periodLabel}`}
    </p>
  );
}
