/**
 * metrics.ts
 *
 * Central metric name registry for the Virtual CFO dashboard.
 *
 * This is the single source of truth for canonical metric naming.
 *
 * PURPOSE
 * -------
 * Multiple data files (business-snapshot.ts, cash-snapshot.ts, growth-metrics.ts,
 * channel-metrics.ts, commerceMetrics.ts) each define constants for dashboard KPIs
 * using their own local naming conventions. Without a registry, the same metric
 * concept can appear under three different names:
 *
 *   business-snapshot.ts  →  MONTHLY_CM_PCT
 *   commerceMetrics.ts    →  contributionMarginPercent
 *   Data Dictionary       →  contribution_margin_pct
 *
 * This file defines the canonical name for every metric and maps each dashboard
 * tile ID (used in KPI_CARDS[].id in dashboard.tsx) to exactly one canonical name.
 *
 * USAGE
 * -----
 * - Import METRIC when you need a canonical metric name as a string (e.g. for
 *   analytics event tracking, alert rule keys, or metric snapshot keys).
 * - Import TILE_METRIC_MAP when you need to resolve a dashboard tile ID to its
 *   canonical metric name.
 * - Each constant and field in the data files has a @canonical JSDoc tag
 *   pointing to its entry in METRIC.
 *
 * REFERENCE
 * ---------
 * Full definitions, formulas, confidence risks and data quality flags are in:
 *   docs/data-dictionary-v1.md — Appendix A (Dashboard KPI Coverage)
 */

// ─── Canonical metric names ───────────────────────────────────────────────────

/**
 * Canonical string keys for every named metric in the app.
 * String values match the canonical metric names in docs/data-dictionary-v1.md.
 *
 * Dashboard KPI tiles (11):
 *   NS  · CM  · RC  · CR  · MR  · AOV  · RPR  · DD  · AE  · RR  · NP
 *
 * Internal diagnostics (not KPI tiles):
 *   LIVE_ORDER_LEAKAGE_ESTIMATE
 */
export const METRIC = {
  // ── Business Health Summary row ───────────────────────────────────────────
  /** Net Sales = Gross Sales − Discounts − Refunds − VAT/Tax · tile id: "ns" */
  NET_SALES:                       "net_sales",

  /** Contribution Margin % = (Net Sales − Variable Costs) / Net Sales · tile id: "cm" */
  CONTRIBUTION_MARGIN_PCT:         "contribution_margin_pct",

  /**
   * Recoverable Contribution range from the opportunity engine.
   * NOT derived from commerceMetrics.ts diagnostics. tile id: "rc"
   */
  RECOVERABLE_CONTRIBUTION_RANGE:  "recoverable_contribution_range",

  /** Cash Runway = Cash Balance / Monthly Fixed Costs (months) · tile id: "cr" */
  CASH_RUNWAY_MONTHS:              "cash_runway_months",

  // ── Revenue Quality Diagnostics row ──────────────────────────────────────
  /** Monthly gross revenue for the current calendar month · tile id: "mr" */
  MONTHLY_REVENUE:                 "monthly_revenue",

  /** Average Order Value = Net Sales / Order Count · tile id: "aov" */
  AVERAGE_ORDER_VALUE:             "average_order_value",

  /**
   * Repeat Purchase Rate = orders from returning customers / total orders in period.
   * tile id: "rpr"
   */
  REPEAT_PURCHASE_RATE:            "repeat_purchase_rate",

  /**
   * Discount Dependency Ratio = Discount Value / Gross Sales.
   * (Canonical formula is count-based; current live impl uses value-based — see data dict.)
   * tile id: "dd"
   */
  DISCOUNT_DEPENDENCY_RATIO:       "discount_dependency_ratio",

  // ── Efficiency and Profit Leakage row ─────────────────────────────────────
  /**
   * Meta CAC Trend = Meta CAC (current period) vs Meta CAC (prior period).
   * Not blended CAC, CAC payback, or ROAS. tile id: "ae"
   */
  META_CAC_TREND:                  "meta_cac_trend",

  /** Refund Rate = Refund Value / Gross Sales · tile id: "rr" */
  REFUND_RATE_PCT:                 "refund_rate_pct",

  /**
   * Operating Profit Estimate = Contribution − Fixed Operating Costs.
   * Not statutory net profit. tile id: "np"
   */
  OPERATING_PROFIT_ESTIMATE:       "operating_profit_estimate",

  // ── Internal diagnostics — NOT dashboard KPI tiles ────────────────────────
  /**
   * Live Order Leakage Estimate = excess discount loss + excess refund loss + excess payment fees.
   * Internal diagnostic only. Computed in commerceMetrics.ts. Not shown on any KPI tile.
   * Source of truth for naming: CommerceMetrics.liveOrderLeakageEstimate.
   */
  LIVE_ORDER_LEAKAGE_ESTIMATE:     "live_order_leakage_estimate",
} as const;

/** Union type of all canonical metric name string values */
export type MetricName = typeof METRIC[keyof typeof METRIC];


// ─── Tile ID → canonical metric name mapping ──────────────────────────────────

/**
 * Maps each dashboard tile ID (KPI_CARDS[].id in dashboard.tsx) to exactly
 * one canonical metric name from METRIC.
 *
 * Tile IDs are short internal codes; canonical names are the stable identifiers
 * used in documentation, alert rules, and metric snapshot storage.
 *
 * Adding a new dashboard tile:
 *   1. Add the canonical name to METRIC above.
 *   2. Add the tile id → canonical name entry here.
 *   3. Add a @canonical JSDoc tag to the data-file constant that supplies the value.
 *   4. Add an entry to docs/data-dictionary-v1.md Appendix A.
 */
export const TILE_METRIC_MAP: Readonly<Record<string, MetricName>> = {
  ns:   METRIC.NET_SALES,
  cm:   METRIC.CONTRIBUTION_MARGIN_PCT,
  rc:   METRIC.RECOVERABLE_CONTRIBUTION_RANGE,
  cr:   METRIC.CASH_RUNWAY_MONTHS,
  mr:   METRIC.MONTHLY_REVENUE,
  aov:  METRIC.AVERAGE_ORDER_VALUE,
  rpr:  METRIC.REPEAT_PURCHASE_RATE,
  dd:   METRIC.DISCOUNT_DEPENDENCY_RATIO,
  ae:   METRIC.META_CAC_TREND,
  rr:   METRIC.REFUND_RATE_PCT,
  np:   METRIC.OPERATING_PROFIT_ESTIMATE,
} as const;
