import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpgradePreviewCardProps {
  title: string;
  description?: string;
  ctaText?: string;
  showLock?: boolean;
  /**
   * compact — vertical stacked layout for narrow containers (e.g. KPI grid cells).
   * Removes the border/background wrapper and renders inline with smaller icon.
   */
  compact?: boolean;
  className?: string;
}

/**
 * Reusable upgrade prompt for plan-gated sections.
 *
 * Standard (default) — horizontal card with border, lock icon, title, and right-aligned CTA:
 *   <UpgradePreviewCard title="Unlock driver-level breakdown" />
 *
 * Compact — bare vertical stack for tight grid cells:
 *   <UpgradePreviewCard title="Unlock acquisition diagnostics" compact />
 */
export function UpgradePreviewCard({
  title,
  description,
  ctaText = "Upgrade →",
  showLock = true,
  compact = false,
  className,
}: UpgradePreviewCardProps) {
  if (compact) {
    return (
      <div className={cn("flex flex-col gap-2.5", className)}>
        <div className="flex items-start gap-2">
          {showLock && (
            <Lock className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
          )}
          <p className="text-sm font-semibold text-foreground leading-snug">{title}</p>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground leading-snug">{description}</p>
        )}
        {ctaText && (
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 leading-none">
            {ctaText}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-indigo-200 dark:border-indigo-700/50",
        "bg-indigo-50/60 dark:bg-indigo-950/20",
        "px-6 py-5 flex items-center justify-between gap-4",
        className
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        {showLock && (
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0 mt-0.5">
            <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 leading-snug">
            {title}
          </p>
          {description && (
            <p className="text-xs text-indigo-700/70 dark:text-indigo-400/70 mt-1 leading-snug">
              {description}
            </p>
          )}
        </div>
      </div>
      {ctaText && (
        <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap shrink-0">
          {ctaText}
        </span>
      )}
    </div>
  );
}
