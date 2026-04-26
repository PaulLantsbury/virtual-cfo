import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

type BenchmarkStatus = "below" | "above" | "watch" | "in";

interface BenchmarkStripProps {
  message:   string;
  status?:   BenchmarkStatus;
  className?: string;
}

/**
 * Compact inline benchmark context strip.
 * Renders a single line showing where the current metric sits relative to
 * a healthy DTC range. Status colours: below = amber, above = rose,
 * watch = light amber, in = neutral.
 */
export function BenchmarkStrip({ message, status = "in", className }: BenchmarkStripProps) {
  const border =
    status === "below" ? "border-amber-200/70 dark:border-amber-800/30"
    : status === "above" ? "border-rose-200/60 dark:border-rose-800/25"
    : status === "watch" ? "border-amber-200/50 dark:border-amber-800/20"
    : "border-border/40";

  const bg =
    status === "below" ? "bg-amber-50/60 dark:bg-amber-950/15"
    : status === "above" ? "bg-rose-50/50 dark:bg-rose-950/10"
    : status === "watch" ? "bg-amber-50/40 dark:bg-amber-950/10"
    : "bg-secondary/30";

  const iconColor =
    status === "below" || status === "watch" ? "text-amber-500 dark:text-amber-400"
    : status === "above" ? "text-rose-500 dark:text-rose-400"
    : "text-muted-foreground/50";

  return (
    <div className={cn(
      "flex items-start gap-2.5 rounded-xl border px-4 py-2.5 mb-5",
      border, bg, className,
    )}>
      <Info className={cn("w-3.5 h-3.5 shrink-0 mt-px", iconColor)} />
      <p className="text-xs text-muted-foreground leading-relaxed">
        <span className="font-semibold text-foreground/60 mr-1">Benchmark</span>
        {message}
      </p>
    </div>
  );
}
