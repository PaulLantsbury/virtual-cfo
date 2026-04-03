import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpgradePreviewCardProps {
  title: string;
  description?: string;
  ctaText?: string;
  showLock?: boolean;
  className?: string;
}

/**
 * Reusable upgrade prompt for plan-gated sections.
 *
 * Usage:
 *   <UpgradePreviewCard
 *     title="Unlock driver-level breakdown showing exactly what changed"
 *     description="Optional supporting sentence."
 *     ctaText="Upgrade →"
 *   />
 */
export function UpgradePreviewCard({
  title,
  description,
  ctaText = "Upgrade →",
  showLock = true,
  className,
}: UpgradePreviewCardProps) {
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
