/**
 * phase1Metrics.ts
 *
 * Phase 1 Dashboard Metrics Query Layer.
 *
 * Fetches all nine Phase 1 canonical metric function results from Supabase
 * for a given store and date range.  This helper is the bridge between the
 * Supabase SQL functions (migration 20260429000001) and the dashboard.
 *
 * IMPORTANT — this module is intentionally decoupled from the dashboard UI.
 * It does not read from commerceMetrics.ts and does not replace it yet.
 * Wire individual dashboard tiles to this helper during the dashboard wiring
 * step; do not change dashboard.tsx or commerceMetrics.ts as part of adding
 * this file.
 *
 * DESIGN
 * ------
 * - All nine SQL functions are called in parallel (Promise.all).
 * - Each RPC call is individually error-isolated: a failure in one function
 *   returns 0 for that field and records the error, leaving the remaining
 *   fields unaffected.
 * - No formatting is applied here.  All values are raw numbers:
 *     rates (repeatPurchaseRate, discountDependency, refundRate) → ratio [0, 1]
 *     counts (orderCount) → integer
 *     monetary values → decimal with full precision from the DB
 *   Callers are responsible for display formatting (× 100 for %, toFixed, etc.)
 *
 * DATE RANGE CONVENTION
 * ---------------------
 * dateFrom and dateTo are both inclusive ISO date strings ("YYYY-MM-DD").
 * The SQL functions use created_at::date BETWEEN p_date_from AND p_date_to.
 *   Feb 2026 → dateFrom="2026-02-01", dateTo="2026-02-28"
 *   Mar 2026 → dateFrom="2026-03-01", dateTo="2026-03-31"
 *   Apr 2026 → dateFrom="2026-04-01", dateTo="2026-04-30"
 *
 * FORMULA NOTE — averageOrderValue
 * ---------------------------------
 * The Supabase function uses: net_sales / qualifying_order_count
 *   (cancels and fully-refunded orders excluded from denominator)
 * The current frontend (commerceMetrics.averageOrderValue) uses: total_sales / count(*)
 * These produce different numbers.  This helper returns the canonical figure.
 * See docs/data-dictionary-v1.md §A.6 for the full mismatch record.
 */

import { supabase } from "../supabase";
import { METRIC } from "../metrics";

// ── Result type ───────────────────────────────────────────────────────────────

/**
 * Raw metric values returned by the nine Phase 1 Supabase functions.
 * All values are unformatted numbers.  No rounding, no currency symbols.
 */
export type Phase1MetricsResult = {
  /**
   * SUM(gross_sales) for non-cancelled orders in the period.
   * @canonical METRIC.MONTHLY_REVENUE — used as the period gross revenue figure.
   */
  grossRevenue: number;

  /**
   * SUM(discounts) for non-cancelled orders in the period.
   * No direct METRIC entry; feeds METRIC.DISCOUNT_DEPENDENCY_RATIO numerator.
   */
  discountCost: number;

  /**
   * SUM(refunds) attributed to original order created_at date, non-cancelled.
   * No direct METRIC entry; feeds METRIC.REFUND_RATE_PCT numerator.
   */
  returnAmount: number;

  /**
   * SUM(gross_sales − discounts − refunds − tax) for non-cancelled orders.
   * @canonical METRIC.NET_SALES
   */
  netSales: number;

  /**
   * COUNT of qualifying orders — excludes cancelled AND fully-refunded.
   * Denominator for METRIC.AVERAGE_ORDER_VALUE.
   */
  orderCount: number;

  /**
   * net_sales / qualifying_order_count.  Returns 0 when orderCount = 0.
   * @canonical METRIC.AVERAGE_ORDER_VALUE
   * NOTE: differs from commerceMetrics.averageOrderValue (total_sales / count(*)).
   *       The frontend formula will be replaced at dashboard tile wiring time.
   */
  averageOrderValue: number;

  /**
   * Ratio [0, 1].  Proportion of registered customers in the period whose
   * first-ever order (customers.first_order_at) preceded the period start.
   * Guest checkouts excluded from both numerator and denominator.
   * Multiply by 100 for percentage display.
   * @canonical METRIC.REPEAT_PURCHASE_RATE
   */
  repeatPurchaseRate: number;

  /**
   * Ratio [0, 1].  SUM(discounts) / SUM(gross_sales) for non-cancelled orders.
   * Value-based revenue rate — not a count of orders with a code.
   * Multiply by 100 for percentage display.
   * @canonical METRIC.DISCOUNT_DEPENDENCY_RATIO
   */
  discountDependency: number;

  /**
   * Ratio [0, 1].  SUM(refunds) / SUM(gross_sales) for non-cancelled orders.
   * Refunds attributed to original order date, not refund event date.
   * Multiply by 100 for percentage display.
   * @canonical METRIC.REFUND_RATE_PCT
   */
  refundRate: number;

  /**
   * Ratio [0, 1].  Contribution margin after variable cost deduction.
   * Formula: (net_sales − payment_fees − fulfilment − packaging − return_handling) / net_sales
   *   payment_fees         = net_sales × payment_fee_rate
   *   fulfilment_cost      = order_count × fulfilment_cost_per_order
   *   packaging_cost       = order_count × packaging_cost_per_order
   *   return_handling_cost = return_amount × return_handling_rate
   * Cost rates sourced from v_current_cost_assumptions (most recent effective row per store).
   * NULL when no cost assumption row exists for the store — caller falls back to commerceMetrics.
   * 0 when net_sales = 0.
   * Multiply by 100 for percentage display.
   * @canonical METRIC.CONTRIBUTION_MARGIN_PCT
   */
  contributionMarginPct: number | null;

  /**
   * SUM(impact_low) across all non-archived opportunities for the store.
   * Currency value (e.g. 18000 = £18,000). 0 when no qualifying rows exist.
   * No date filtering — opportunities are store-level, not period-bound.
   * @canonical METRIC.RECOVERABLE_CONTRIBUTION_RANGE (low bound), tile id "rc"
   */
  recoverableLow: number;

  /**
   * SUM(impact_high) across all non-archived opportunities for the store.
   * Currency value (e.g. 42000 = £42,000). 0 when no qualifying rows exist.
   * No date filtering — opportunities are store-level, not period-bound.
   * @canonical METRIC.RECOVERABLE_CONTRIBUTION_RANGE (high bound), tile id "rc"
   */
  recoverableHigh: number;
};

// ── Error type ────────────────────────────────────────────────────────────────

/**
 * Per-function error record.  Collected and returned alongside the result
 * so callers can surface data quality warnings without throwing.
 */
export type Phase1MetricsError = {
  /** Name of the Supabase RPC function that failed. */
  fn: string;
  /** Supabase error message. */
  message: string;
};

// ── Response envelope ─────────────────────────────────────────────────────────

export type Phase1MetricsResponse = {
  /** Metric values.  Fields for failed RPC calls default to 0. */
  data: Phase1MetricsResult;
  /**
   * Errors from individual RPC calls.  Empty array when all calls succeed.
   * Callers should check this before trusting any field whose fn appears here.
   */
  errors: Phase1MetricsError[];
};

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Coerces any DB return value to a finite number.  Null and NaN → 0. */
function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Calls one Supabase RPC function and returns its numeric result.
 * On error, pushes to the shared errors array and returns 0.
 */
async function callRpc(
  fnName: string,
  params: { p_store_id: string; p_date_from: string; p_date_to: string },
  errors: Phase1MetricsError[],
): Promise<number> {
  const { data, error } = await supabase.rpc(fnName, params);
  if (error) {
    errors.push({ fn: fnName, message: error.message });
    return 0;
  }
  return toNumber(data);
}

/**
 * Calls one Supabase RPC function whose SQL may legitimately return NULL.
 * NULL means "not configured / not applicable" — distinct from 0.
 * On error, pushes to the shared errors array and returns null.
 * On success, returns number | null preserving DB NULL.
 *
 * Used for contribution_margin_pct() which returns NULL when no cost
 * assumption row exists for the store (caller falls back to commerceMetrics).
 */
async function callRpcNullable(
  fnName: string,
  params: { p_store_id: string; p_date_from: string; p_date_to: string },
  errors: Phase1MetricsError[],
): Promise<number | null> {
  const { data, error } = await supabase.rpc(fnName, params);
  if (error) {
    errors.push({ fn: fnName, message: error.message });
    return null;
  }
  if (data === null || data === undefined) return null;
  const n = Number(data);
  return Number.isFinite(n) ? n : null;
}

/**
 * Calls a Supabase RPC function that returns RETURNS TABLE (i.e. an array of
 * rows) and coerces the first row to the provided fallback shape.
 *
 * Unlike callRpc / callRpcNullable (which handle scalar-returning functions),
 * this helper is needed for recoverable_contribution_range() which uses
 * RETURNS TABLE(recoverable_low numeric, recoverable_high numeric).
 * The Supabase JS client returns such results as an array; we always take [0].
 *
 * On error, pushes to the shared errors array and returns the fallback value.
 */
async function callRpcRow<T extends Record<string, unknown>>(
  fnName: string,
  params: Record<string, unknown>,
  errors: Phase1MetricsError[],
  fallback: T,
): Promise<T> {
  const { data, error } = await supabase.rpc(fnName, params);
  if (error) {
    errors.push({ fn: fnName, message: error.message });
    return fallback;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? fallback) as T;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches all nine Phase 1 canonical metrics from Supabase for the given
 * store and date range.  All RPC calls run in parallel.
 *
 * @param storeId  UUID of the store — matches orders.store_id.
 * @param dateFrom First day of the period, inclusive (e.g. "2026-02-01").
 * @param dateTo   Last day of the period, inclusive (e.g. "2026-02-28").
 *
 * @returns Phase1MetricsResponse with raw numeric data and any per-function errors.
 *
 * @example
 *   const { data, errors } = await getPhase1Metrics(
 *     storeId,
 *     "2026-02-01",
 *     "2026-02-28",
 *   );
 *   if (errors.length) console.warn("Partial metric failure", errors);
 *   console.log(data.netSales, data.repeatPurchaseRate * 100);
 */
export async function getPhase1Metrics(
  storeId: string,
  dateFrom: string,
  dateTo: string,
): Promise<Phase1MetricsResponse> {
  const errors: Phase1MetricsError[] = [];
  const params = {
    p_store_id: storeId,
    p_date_from: dateFrom,
    p_date_to: dateTo,
  };

  // recoverable_contribution_range takes only p_store_id (no date range) —
  // opportunities are store-level signals, not period-bound.
  const rcParams = { p_store_id: storeId };
  const rcFallback = { recoverable_low: 0, recoverable_high: 0 };

  const [
    grossRevenue,
    discountCost,
    returnAmount,
    netSales,
    orderCount,
    averageOrderValue,
    repeatPurchaseRate,
    discountDependency,
    refundRate,
    contributionMarginPct,
    rcRow,
  ] = await Promise.all([
    callRpc("gross_revenue",          params,   errors), // → METRIC.MONTHLY_REVENUE (period gross)
    callRpc("discount_cost",          params,   errors), // → feeds METRIC.DISCOUNT_DEPENDENCY_RATIO
    callRpc("return_amount",          params,   errors), // → feeds METRIC.REFUND_RATE_PCT
    callRpc("net_sales",              params,   errors), // → METRIC.NET_SALES
    callRpc("order_count",            params,   errors), // → denominator for METRIC.AVERAGE_ORDER_VALUE
    callRpc("average_order_value",    params,   errors), // → METRIC.AVERAGE_ORDER_VALUE
    callRpc("repeat_purchase_rate",   params,   errors), // → METRIC.REPEAT_PURCHASE_RATE  [0,1]
    callRpc("discount_dependency",    params,   errors), // → METRIC.DISCOUNT_DEPENDENCY_RATIO [0,1]
    callRpc("refund_rate",            params,   errors), // → METRIC.REFUND_RATE_PCT [0,1]
    callRpcNullable("contribution_margin_pct", params, errors), // → METRIC.CONTRIBUTION_MARGIN_PCT [0,1] | null
    callRpcRow("recoverable_contribution_range", rcParams, errors, rcFallback), // → METRIC.RECOVERABLE_CONTRIBUTION_RANGE
  ]);

  // Suppress unused import warning — METRIC is imported for the JSDoc
  // @canonical references above; it is not used at runtime in this module.
  void (METRIC as unknown);

  return {
    data: {
      grossRevenue,
      discountCost,
      returnAmount,
      netSales,
      orderCount,
      averageOrderValue,
      repeatPurchaseRate,
      discountDependency,
      refundRate,
      contributionMarginPct,
      recoverableLow:  toNumber(rcRow.recoverable_low),
      recoverableHigh: toNumber(rcRow.recoverable_high),
    },
    errors,
  };
}
