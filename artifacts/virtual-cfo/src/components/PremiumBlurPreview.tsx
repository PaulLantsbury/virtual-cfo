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
  /**
   * Optional ghost preview content rendered in locked state instead of
   * blurred children. Show labels and category names clearly, but replace
   * all numeric values with masked placeholders (£ —,—, —.—%, etc.).
   * When omitted, falls back to full blur of children.
   */
  ghostContent?: React.ReactNode;
  /**
   * Optional explanatory paragraph shown below the header in both locked and
   * unlocked states. Use for "why this metric matters" context lines.
   */
  description?: string;
  /** Extra classes for the outer card wrapper */
  className?: string;
}

/**
 * PremiumBlurPreview
 *
 * Wraps a Pro-gated section in a consistent premium card shell.
 *
 * — Unlocked (isPro = true): renders `children` normally inside the card.
 * — Locked (isPro = false):
 *     If `ghostContent` is supplied: renders it as a readable preview with
 *     category labels visible and all numeric values replaced by masked
 *     placeholders, then overlays the gradient + upgrade card on top.
 *     If no `ghostContent`: blurs `children` behind a gradient and overlays
 *     the upgrade card (original full-blur fallback).
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
  ghostContent,
  description,
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
      <div className={cn("flex items-start justify-between gap-4", description ? "mb-2" : isPro ? "mb-5" : "mb-4")}>
        <div className="min-w-0">
          <h3 className="font-semibold text-lg text-foreground">{title}</h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{subtitle}</p>
          )}
        </div>

        {isPro ? (
          headerExtra ? (
            <div className="shrink-0">{headerExtra}</div>
          ) : null
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider whitespace-nowrap shrink-0 mt-0.5">
            {badgeText}
          </span>
        )}
      </div>

      {description && (
        <p className="text-xs text-muted-foreground leading-relaxed mb-4 border-l-2 border-border/60 pl-3 italic">
          {description}
        </p>
      )}

      {isPro ? (
        /* ── Unlocked: full content ── */
        <>{children}</>
      ) : (
        /* ── Locked: ghost preview or full blur + gradient + upgrade card ── */
        <div className="relative">

          {ghostContent ? (
            /* Ghost preview: labels readable, values masked — no blur applied */
            <div className="pointer-events-none select-none" aria-hidden="true">
              {ghostContent}
            </div>
          ) : (
            /* Full blur fallback for sections without custom ghost content */
            <div
              className="blur-[10px] opacity-[0.7] pointer-events-none select-none"
              aria-hidden="true"
            >
              {children}
            </div>
          )}

          {/* Overlay — washes ghost content slightly or adds opacity over blur */}
          <div className={cn(
            "absolute inset-0 pointer-events-none rounded-b-xl",
            ghostContent
              ? "bg-white/8 dark:bg-slate-950/10"
              : "bg-white/20 dark:bg-slate-950/25"
          )} />

          {/* Gradient: top clear, bottom fades firmly to card bg hiding bottom rows */}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent rounded-b-xl pointer-events-none" />

          {/* Upgrade card — floats above everything */}
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
