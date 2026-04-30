/**
 * business-snapshot.ts
 *
 * Central mock data for P&L and margin metrics.
 * Single source of truth for: Dashboard, Margin Analysis, Profit Engine,
 *                             Cash Control, Scenario Lab.
 *
 * NOTE ON PERIOD BASIS: Two revenue bases are used across the app (intentionally):
 *   ANNUAL_REVENUE  (520k) — Profit Engine P&L waterfall and Cash Control simulator
 *   MONTHLY_REVENUE (124.5k) — Margin Analysis current-month snapshot and Dashboard KPIs
 *   The 420k "pricing period" basis lives in pricing-metrics.ts (Pricing + Scenario Lab).
 *
 * @temporary This is a static mock snapshot for March 2026.
 * @future Replace with live Xero P&L data (revenue, costs, margins) and
 *         Shopify order data (order volume, AOV, contribution per order).
 * Pages should import from this file rather than declaring these values locally.
 */

import { MONTHLY_FIXED_COSTS } from "@/lib/data/cash-snapshot";

// ─── Annual / Profit Engine P&L basis (520k revenue period) ──────────────────
// Used by: Profit Engine, Cash Control simulator

/** Gross revenue for the annual/longer-period P&L basis */
export const ANNUAL_REVENUE         = 520_000;

/** Total discounts for the annual/longer-period P&L basis (15.8% of revenue) */
export const ANNUAL_DISCOUNTS       = 82_000;

/** Total returns for the annual/longer-period P&L basis (7.9% of revenue) */
export const ANNUAL_RETURNS         = 41_000;

/** Net revenue after discounts and returns (derived: 520k − 82k − 41k) */
export const ANNUAL_NET_REVENUE     = ANNUAL_REVENUE - ANNUAL_DISCOUNTS - ANNUAL_RETURNS; // 397,000

/** Variable costs — product, fulfilment and payment processing for the annual basis */
export const ANNUAL_VARIABLE_COSTS  = 199_000;

/**
 * Contribution — what remains after variable costs to pay overheads and generate profit.
 * Derived: 397,000 − 199,000 = 198,000
 * This value is also used in Pricing Optimisation and Scenario Lab
 * (exported separately in pricing-metrics.ts as BASE_CONTRIBUTION for clarity).
 */
export const CONTRIBUTION           = ANNUAL_NET_REVENUE - ANNUAL_VARIABLE_COSTS; // 198,000

/** Contribution margin % on the annual revenue basis (derived: 198k / 520k ≈ 38.08%) */
export const CONTRIBUTION_MARGIN_PCT = CONTRIBUTION / ANNUAL_REVENUE;

/**
 * EBITDA / operating profit — derived from contribution minus fixed costs.
 * Fixed costs (120k) are imported from cash-snapshot to avoid duplication.
 * Feeds tile id "np" (annual basis). Dashboard currently uses a hardcoded monthly
 * figure (£56,300 = MONTHLY_CM_VALUE − MONTHLY_FIXED_COSTS estimate).
 * @canonical operating_profit_estimate (see src/lib/metrics.ts METRIC.OPERATING_PROFIT_ESTIMATE)
 * @future Replace dashboard "np" tile hardcoded value with a MONTHLY_OPERATING_PROFIT constant.
 */
export const BASE_EBITDA            = CONTRIBUTION - MONTHLY_FIXED_COSTS; // 78,000

// ─── Monthly snapshot (March 2026) ────────────────────────────────────────────
// Used by: Margin Analysis, Dashboard KPI cards

/**
 * Monthly gross revenue — current month (March 2026).
 * Feeds tile id "mr". Live override: commerceMetrics.totalRevenue.
 * @canonical monthly_revenue (see src/lib/metrics.ts METRIC.MONTHLY_REVENUE)
 * @dev-only DEV-ONLY FALLBACK — static March 2026 snapshot value (£124,500).
 *   Used as the KPI_CARDS "mr" Tier 3 loading sentinel in dashboard.tsx.
 *   Primary source: gross_revenue() Supabase RPC (Phase 1 — already live).
 *   This constant is only visible while both async sources are loading.
 *   Do not rely on this value in production once the RPC is stable.
 * @future Sourced from Shopify: sum of order totals for the calendar month
 */
export const MONTHLY_REVENUE        = 124_500;

/**
 * Current month contribution margin %.
 * This is the headline margin figure shown in Dashboard and Margin Analysis.
 * Different from CONTRIBUTION_MARGIN_PCT (38.08%) which uses the annual basis.
 * Feeds tile id "cm". Live override: commerceMetrics.contributionMarginPercent.
 * @canonical contribution_margin_pct (see src/lib/metrics.ts METRIC.CONTRIBUTION_MARGIN_PCT)
 * @dev-only DEV-ONLY FALLBACK — static March 2026 snapshot value (42.3%).
 *   Used as the KPI_CARDS "cm" Tier 3 loading sentinel in dashboard.tsx.
 *   Primary source: contribution_margin_pct() Supabase RPC (Phase 1 — already live).
 *   This constant is only visible while both async sources are loading.
 *   Do not rely on this value in production once the RPC is stable.
 * @future Computed from monthly Shopify + Xero data
 */
export const MONTHLY_CM_PCT         = 42.3;

/**
 * Monthly contribution in £ (current month, March 2026).
 * @future Computed: MONTHLY_REVENUE × (MONTHLY_CM_PCT / 100)
 */
export const MONTHLY_CM_VALUE       = 52_913;

/**
 * Contribution per order — £ contribution generated per order in current month.
 * Note: Scenario Lab uses CONTRIBUTION_PER_ORDER = 12.40 from pricing-metrics.ts
 *       (a different period/basis). This 35.00 figure is the gross monthly margin basis.
 * @future Computed: MONTHLY_CM_VALUE / MONTHLY_ORDER_VOLUME
 */
export const CONTRIBUTION_PER_ORDER = 35.00;

/**
 * Monthly operating profit snapshot (£) for the current reporting period.
 * Negative value = the store is running at an operating loss for the month.
 * Derived from contribution margin in £ minus total fixed overhead costs.
 *
 * @dev-only DEV-ONLY FALLBACK — April 2026 figure derived from
 *   operating_profit_monthly() Supabase RPC for store 10000000-…-0001.
 *   Used as the KPI_CARDS "np" Tier 3 loading sentinel in dashboard.tsx.
 *   Primary source: operating_profit_monthly() Phase 2a RPC (live).
 *   This constant is only visible while the Phase 2a async call is still loading,
 *   or as a hard fallback if the RPC fails / returns null.
 * @canonical METRIC.OPERATING_PROFIT_ESTIMATE — tile id "np"
 */
export const MONTHLY_OPERATING_PROFIT = -10_184;

/**
 * Monthly order volume (current month).
 * @future Sourced from Shopify: count of fulfilled orders for the period
 */
export const MONTHLY_ORDER_VOLUME   = 2_000;

/** Human-readable label for the current reporting period */
export const CURRENT_PERIOD         = "March 2026";

// ─── Recoverable contribution range ───────────────────────────────────────────
// Used by: Dashboard (CFO_INSIGHT.upside), Profit Opportunities (TOTAL_LOW / TOTAL_HIGH)

/**
 * Low end of the estimated monthly contribution improvement range (£).
 * Represents the conservative case if margin, marketing and fulfilment
 * opportunities are addressed.
 * Feeds tile id "rc" (lower bound of displayed range).
 * Must NOT be replaced by commerceMetrics.liveOrderLeakageEstimate — these
 * are opportunity-engine figures, not live diagnostic leakage.
 * @canonical recoverable_contribution_range (see src/lib/metrics.ts METRIC.RECOVERABLE_CONTRIBUTION_RANGE)
 * @dev-only DEV-ONLY FALLBACK — static snapshot value (£18,000).
 *   Used in two roles in dashboard.tsx:
 *     1. Tier 3 loading sentinel for the rc KPI tile (via RECOVERABLE_TILE_VALUE).
 *     2. Tier 2 explicit fallback if the recoverable_contribution_range() RPC fails.
 *   Primary source: recoverable_contribution_range() Supabase RPC (Phase 1 — already live).
 *   This constant must not be promoted to a production default — it will diverge
 *   from the live opportunities table as new opportunities are added or closed.
 * @future Recompute as sum of low-estimate uplifts across all active opportunities.
 */
export const RECOVERABLE_LOW  = 18_000;

/**
 * High end of the estimated monthly contribution improvement range (£).
 * Represents the optimistic case across the same opportunity set.
 * Feeds tile id "rc" (upper bound of displayed range).
 * @canonical recoverable_contribution_range (see src/lib/metrics.ts METRIC.RECOVERABLE_CONTRIBUTION_RANGE)
 * @dev-only DEV-ONLY FALLBACK — static snapshot value (£42,000).
 *   Used in two roles in dashboard.tsx:
 *     1. Tier 3 loading sentinel for the rc KPI tile (via RECOVERABLE_TILE_VALUE).
 *     2. Tier 2 explicit fallback if the recoverable_contribution_range() RPC fails.
 *   Primary source: recoverable_contribution_range() Supabase RPC (Phase 1 — already live).
 *   This constant must not be promoted to a production default — it will diverge
 *   from the live opportunities table as new opportunities are added or closed.
 * @future Recompute as sum of high-estimate uplifts across all active opportunities.
 */
export const RECOVERABLE_HIGH = 42_000;
