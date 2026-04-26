import { cn } from "@/lib/utils";
import type { ConfidenceLevel } from "@/lib/mock-data";

interface ConfidenceBadgeProps {
  level:     ConfidenceLevel;
  /** Optional single-line helper text rendered below the badge. */
  helper?:   string;
  className?: string;
}

const DOT: Record<ConfidenceLevel, string> = {
  "High":        "bg-emerald-500",
  "Medium-High": "bg-emerald-400",
  "Medium":      "bg-amber-400",
  "Low":         "bg-muted-foreground/40",
};

const TEXT: Record<ConfidenceLevel, string> = {
  "High":        "text-emerald-700 dark:text-emerald-400",
  "Medium-High": "text-emerald-600 dark:text-emerald-400",
  "Medium":      "text-amber-700 dark:text-amber-400",
  "Low":         "text-muted-foreground",
};

const BG: Record<ConfidenceLevel, string> = {
  "High":        "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/30",
  "Medium-High": "bg-emerald-50/80 dark:bg-emerald-950/15 border-emerald-200/50 dark:border-emerald-800/25",
  "Medium":      "bg-amber-50 dark:bg-amber-950/15 border-amber-200/60 dark:border-amber-800/25",
  "Low":         "bg-secondary border-border/40",
};

/**
 * Compact confidence badge used on recoverable contribution blocks,
 * opportunity rows and scenario plan cards.
 */
export function ConfidenceBadge({ level, helper, className }: ConfidenceBadgeProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap",
        BG[level], TEXT[level],
      )}>
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", DOT[level])} />
        Confidence: {level}
      </span>
      {helper && (
        <p className="text-[10px] text-muted-foreground/60 leading-snug pl-1">{helper}</p>
      )}
    </div>
  );
}
