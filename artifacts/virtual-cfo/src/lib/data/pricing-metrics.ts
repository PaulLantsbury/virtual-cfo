/**
 * pricing-metrics.ts
 *
 * Central mock data for pricing, discount and order-level metrics.
 * Single source of truth for: Pricing Optimisation, Scenario Lab,
 *                             Dashboard, Margin Analysis, Growth Quality.
 *
 * NOTE ON PERIOD BASIS: These figures use a different revenue period than
 * the Profit Engine (which uses a 520k annual basis). The 420k figure here
 * represents the gross revenue basis for the pricing/scenario period.
 * This discrepancy is intentional — see business-snapshot.ts for details.
 *
 * @temporary This is a static mock snapshot.
 * @future Replace with live Shopify data:
 *         - grossRevenue: sum of order totals before discounts
 *         - discountCost: sum of discount amounts applied
 *         - returnsImpact: sum of refund amounts + fulfilment cost on returns
 *         - avgDiscountPct: totalDiscountCost / totalGrossRevenue × 100
 * Pages should import from this file rather than declaring these values locally.
 */

/** Gross revenue before discounts and returns (pricing/scenario period basis) */
export const GROSS_REVENUE       = 420_000;

/** Total discount cost — revenue given away through promotions and codes */
export const DISCOUNT_COST       = 64_000;

/** Net revenue after discounts (derived) */
export const NET_REVENUE         = GROSS_REVENUE - DISCOUNT_COST; // 356,000

/**
 * Returns impact — contribution lost through returned orders (revenue + fulfilment cost).
 * @future Shopify refunds API + returns fulfilment cost from Xero
 */
export const RETURNS_IMPACT      = 18_000;

/** Net retained revenue after discounts and returns (derived) */
export const NET_RETAINED        = NET_REVENUE - RETURNS_IMPACT; // 338,000

/** Total order volume for the pricing period */
export const ORDERS              = 16_000;

/**
 * Contribution (£) for the pricing/scenario period.
 * This is the same 198,000 figure as CONTRIBUTION in business-snapshot.ts —
 * both periods arrive at the same contribution value from different revenue bases.
 */
export const BASE_CONTRIBUTION   = 198_000;

/**
 * Average discount % applied across all orders.
 * @future Computed from Shopify: totalDiscountCost / totalGrossRevenue × 100
 */
export const AVG_DISCOUNT_PCT    = 18;

/**
 * Contribution per order — contribution generated per order in the pricing period.
 * Used by Scenario Lab (as BASE_CPO) and referenced in Pricing Optimisation KPI display.
 * Note: different from business-snapshot CONTRIBUTION_PER_ORDER (35.00)
 * which is the monthly gross contribution per order for March 2026.
 * @future Computed: contributionForPeriod / orderCount
 */
export const CONTRIBUTION_PER_ORDER = 12.40;
