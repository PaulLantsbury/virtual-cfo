import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimingHorizon } from "@/lib/mock-data";

interface TimingBadgeProps {
  timing:     TimingHorizon;
  className?: string;
}

type Style = { bg: string; text: string };

function getStyle(timing: TimingHorizon): Style {
  switch (timing) {
    case "Immediate":
      return {
        bg:   "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/30",
        text: "text-emerald-700 dark:text-emerald-400",
      };
    case "1–2 weeks":
    case "2–4 weeks":
      return {
        bg:   "bg-blue-50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/30",
        text: "text-blue-700 dark:text-blue-400",
      };
    case "30 days":
    case "30–90 days":
      return {
        bg:   "bg-amber-50 dark:bg-amber-950/15 border-amber-200/60 dark:border-amber-800/25",
        text: "text-amber-700 dark:text-amber-400",
      };
    case "6 months":
    default:
      return {
        bg:   "bg-secondary border-border/40",
        text: "text-muted-foreground",
      };
  }
}

/**
 * Compact timing horizon badge for opportunity and action cards.
 */
export function TimingBadge({ timing, className }: TimingBadgeProps) {
  const { bg, text } = getStyle(timing);
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap",
      bg, text, className,
    )}>
      <Clock className="w-2.5 h-2.5 shrink-0" />
      {timing}
    </span>
  );
}
