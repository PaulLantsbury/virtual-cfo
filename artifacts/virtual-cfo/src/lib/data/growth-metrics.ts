/**
 * growth-metrics.ts
 *
 * Central mock data for growth quality and retention metrics.
 * Single source of truth for: Growth Quality, Dashboard, Margin Analysis,
 *                             Marketing Efficiency, Scenario Lab.
 *
 * @temporary This is a static mock snapshot for March 2026.
 * @future Replace with live computed values from Shopify order data:
 *         - repeat rate: (repeat orders / total orders) for the rolling 30-day period
 *         - discount dependency: (discounted orders / total orders)
 *         - CAC payback: blended CAC / (contribution per order × contribution margin)
 * Pages should import from this file rather than declaring these values locally.
 */

/**
 * Repeat purchase rate — % of orders placed by returning customers.
 * Resolved from prior discrepancy: Dashboard showed 28%, Growth Quality showed 27%.
 * Canonical value is 28%, consistent with Dashboard display and mock-data BENCHMARKS.
 * @future Computed from Shopify: repeatOrders / totalOrders for the period
 */
export const REPEAT_RATE      = 28.0;
export const REPEAT_RATE_PREV = 24.6; // prior month

/**
 * Discount dependency — % of orders that include a discount code.
 * @future Computed from Shopify: ordersWithDiscount / totalOrders
 */
export const DISCOUNT_DEP      = 38.0;
export const DISCOUNT_DEP_PREV = 36.2; // prior month

/**
 * CAC payback — orders required for a new customer to cover their acquisition cost.
 * Shared across Marketing Efficiency, Margin Analysis, Growth Quality pages.
 * Note: Scenario Lab uses BASE_CAC_PAYBACK = 1.6 as a scenario-specific starting value.
 * @future Computed: blendedCAC / (contributionPerOrder)
 */
export const CAC_PAYBACK      = 1.4;
export const CAC_PAYBACK_PREV = 1.1; // prior month

/** Growth quality grade — composite score across retention, discount reliance, channel efficiency */
export const GQ_SCORE      = "B-";
export const GQ_SCORE_PREV = "B";

/** Qualitative retention status — used in dashboard scorecard and growth quality page */
export const RETENTION_STATUS: "strengthening" | "stable" | "weakening" = "strengthening";
