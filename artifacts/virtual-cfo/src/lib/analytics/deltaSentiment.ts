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
  // Dashboard / Margin Analysis / Growth Quality
  mr:  "up-is-good",
  ns:  "up-is-good",
  aov: "up-is-good",
  rpr: "up-is-good",
  cm:  "up-is-good",
  np:  "up-is-good",
  dd:  "down-is-good",
  rr:  "down-is-good",

  // Marketing Efficiency
  mktCp:       "up-is-good",   // Marketing Contribution Profit
  blendedCac:  "down-is-good", // Blended CAC — lower is better
  blendedRoas: "up-is-good",   // Blended ROAS — higher is better
  cacPayback:  "down-is-good", // CAC Payback — fewer orders to recover cost is better
  mktCm:       "up-is-good",   // Marketing Contribution Margin
  cpPerOrder:  "up-is-good",   // Contribution per Order
  cpPerSpend:  "up-is-good",   // Contribution per £1 of Marketing Spend

  // Pricing Optimisation
  asp:                "up-is-good",   // Average Selling Price — higher realised price is better
  avgDiscount:        "down-is-good", // Average Discount — lower discount preserves margin
  fullPriceRatio:     "up-is-good",   // Full-Price Order Ratio — more full-price is better
  discountCost:       "down-is-good", // Discount Cost — lower cost is better
  returnsImpact:      "down-is-good", // Returns Impact — lower leakage is better
  recoverableContrib: "down-is-good", // Recoverable Contribution — more recoverable means more wasted
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
