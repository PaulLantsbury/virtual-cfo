import { Lock } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";

const UPGRADE_HREF = "/upgrade";

interface PremiumBlurPreviewProps {
  /** Section heading — always visible whether locked or unlocked */
  title: string;
  /** Section sub-heading — always visible */
  subtitle?: string;
  /**
   * Extra node rendered on the right of the header when the section is
   * unlocked (e.g. a "Blended avg: X" summary). Hidden when locked so no
   * Pro-only numbers are exposed.
   */
  headerExtra?: React.ReactNode;
  /**
   * Badge label shown top-right when locked.
   * Defaults to "PRO".
   */
  badgeText?: string;
  /** Lock-overlay title */
  ctaTitle: string;
  /** Lock-overlay supporting description */
  ctaDescription?: string;
  /** Lock-overlay CTA link text. Defaults to "Upgrade →" */
  ctaText?: string;
  /**
   * When true: children render normally with no blur or overlay.
   * When false: children are blurred/faded and the upgrade overlay is shown.
   * Pass `canAccess("feature_name")` directly.
   */
  isPro: boolean;
  /** The real section content (charts, tables, etc.) */
  children: React.ReactNode;
  /** Extra classes for the outer card wrapper */
  className?: string;
}

/**
 * PremiumBlurPreview
 *
 * Wraps a Pro-gated section in a consistent premium card shell.
 *
 * — Unlocked (isPro = true): renders `children` normally inside the card.
 * — Locked (isPro = false): blurs `children` behind a gradient and overlays
 *   an indigo upgrade card so the section structure remains visible while
 *   precise values are unreadable.
 *
 * Usage:
 *   <PremiumBlurPreview
 *     title="CAC Payback by Channel"
 *     subtitle="Orders needed to recover acquisition cost per channel."
 *     headerExtra={<BlendedAvgSummary />}
 *     badgeText="PRO — Unlock cash recovery diagnostics"
 *     ctaTitle="Unlock CAC Payback Analysis"
 *     ctaDescription="Identify which channels delay cash recovery."
 *     isPro={canAccess("cac_payback")}
 *   >
 *     <PaybackChart />
 *   </PremiumBlurPreview>
 */
export function PremiumBlurPreview({
  title,
  subtitle,
  headerExtra,
  badgeText = "PRO",
  ctaTitle,
  ctaDescription,
  ctaText = "Upgrade →",
  isPro,
  children,
  className,
}: PremiumBlurPreviewProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-2xl shadow-sm border border-border/50 p-6",
        className
      )}
    >
      {/* ── Header — always visible ── */}
      <div className={cn("flex items-start justify-between gap-4", isPro ? "mb-5" : "mb-4")}>
        <div className="min-w-0">
          <h3 className="font-semibold text-lg text-foreground">{title}</h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{subtitle}</p>
          )}
        </div>

        {isPro ? (
          /* Unlocked — show caller-supplied header extra (e.g. a metric summary) */
          headerExtra ? (
            <div className="shrink-0">{headerExtra}</div>
          ) : null
        ) : (
          /* Locked — show Pro badge instead of metric data */
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider whitespace-nowrap shrink-0 mt-0.5">
            {badgeText}
          </span>
        )}
      </div>

      {isPro ? (
        /* ── Unlocked: full content ── */
        <>{children}</>
      ) : (
        /* ── Locked: blur + gradient + upgrade overlay ── */
        <div className="relative">
          {/* Real children — blurred: structure recognisable, values unreadable */}
          <div
            className="blur-[10px] opacity-[0.7] pointer-events-none select-none"
            aria-hidden="true"
          >
            {children}
          </div>

          {/* White/dark overlay — reduces contrast of blurred values further */}
          <div className="absolute inset-0 bg-white/20 dark:bg-slate-950/25 pointer-events-none rounded-b-xl" />

          {/* Gradient: top clear (structure visible), bottom fades to card bg */}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent rounded-b-xl pointer-events-none" />

          {/* Upgrade card — floats above blur, shadow gives depth */}
          <div className="relative mt-4">
            <a
              href={UPGRADE_HREF}
              className={cn(
                "flex items-center justify-between gap-4",
                "rounded-xl border border-indigo-200 dark:border-indigo-700/50",
                "bg-indigo-50/90 dark:bg-indigo-950/40",
                "px-5 py-4",
                "shadow-lg shadow-indigo-500/10 dark:shadow-indigo-900/30",
                "hover:border-indigo-300 hover:bg-indigo-100/90",
                "dark:hover:border-indigo-600 dark:hover:bg-indigo-900/45",
                "transition-colors cursor-pointer group"
              )}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 shrink-0 mt-0.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 leading-snug">
                    {ctaTitle}
                  </p>
                  {ctaDescription && (
                    <p className="text-xs text-indigo-700/70 dark:text-indigo-400/70 mt-1 leading-snug">
                      {ctaDescription}
                    </p>
                  )}
                </div>
              </div>
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap shrink-0 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                {ctaText}
              </span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
