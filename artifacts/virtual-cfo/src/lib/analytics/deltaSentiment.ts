/**
 * deltaSentiment.ts
 *
 * Shared delta badge sentiment helpers used by Dashboard, Margin Analysis,
 * and Growth Quality pages.
 *
 * Sentiment of a month-on-month delta badge:
 *   "positive" — the delta is favourable for this metric   → green badge
 *   "negative" — the delta is unfavourable                 → red badge
 *   "neutral"  — delta is exactly zero                     → muted badge
 *   null       — no prior period data (shows "—")          → muted badge
 */

export type DeltaSentiment = "positive" | "negative" | "neutral";

/**
 * Maps each metric key to its directional polarity.
 *   "up-is-good"   — a positive delta is a good signal (Revenue, CM, RPR, AOV, etc.)
 *   "down-is-good" — a negative delta is a good signal (Discount Dependency, Refund Rate)
 * Tiles not listed here have no Phase 2 delta wiring.
 */
export const DELTA_POLARITY = {
  mr:  "up-is-good",
  ns:  "up-is-good",
  aov: "up-is-good",
  rpr: "up-is-good",
  cm:  "up-is-good",
  np:  "up-is-good",
  dd:  "down-is-good",
  rr:  "down-is-good",
} as const satisfies Record<string, "up-is-good" | "down-is-good">;

/**
 * Converts a raw delta number + polarity into a DeltaSentiment.
 * Returns null when delta is null (no prior period data — caller shows "—").
 */
export function deltaToSentiment(
  delta: number | null | undefined,
  polarity: "up-is-good" | "down-is-good",
): DeltaSentiment | null {
  if (delta === null || delta === undefined) return null;
  if (delta === 0) return "neutral";
  const isGood = polarity === "up-is-good" ? delta > 0 : delta < 0;
  return isGood ? "positive" : "negative";
}
