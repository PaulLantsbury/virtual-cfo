/**
 * phase2aMetrics.ts
 *
 * Phase 2a Dashboard Metrics Query Layer.
 *
 * Fetches cash_runway_months() and operating_profit_monthly() from Supabase
 * for a given store and date range.  This module is the Phase 2a counterpart
 * to phase1Metrics.ts — intentionally kept separate so that a failure in
 * Phase 2a never affects Phase 1 tiles, and vice versa.
 *
 * Run with an independent useEffect in dashboard.tsx.  Never import Phase 1
 * state or merge these results with Phase 1 data in this module.
 *
 * DESIGN
 * ------
 * - cash_runway_months() takes ONLY p_store_id (no date range).
 *   The denominator is always computed from CURRENT_DATE inside the SQL
 *   function; the caller does not pass a period.
 * - operating_profit_monthly() takes p_store_id, p_date_from, p_date_to —
 *   matching the Phase 1 date-range convention.
 * - Both functions may legitimately return NULL:
 *     cash_runway_months     → null when no cash_balance_snapshots row exists
 *                              or when current-month overhead = 0.
 *     operating_profit_monthly → null when no store_cost_assumptions row exists
 *                              (contribution_margin_pct propagates its null).
 *   NULL is preserved and returned as null to the caller.  It is NOT coerced
 *   to 0 — null means "not configured / no data" and must trigger the fallback.
 * - Both RPCs are called in parallel (Promise.all).
 * - Each call is individually error-isolated: a failure in one returns null
 *   for that field and records the error, leaving the other field unaffected.
 *
 * DATE RANGE CONVENTION
 * ---------------------
 * dateFrom and dateTo follow the same Phase 1 convention:
 *   both inclusive ISO date strings ("YYYY-MM-DD").
 *   e.g. "2026-04-01" / "2026-04-30"
 * These are passed through to operating_profit_monthly only.
 * cash_runway_months ignores them — they are accepted here for API symmetry
 * with getPhase1Metrics so callers can share the same computed date bounds.
 */

import { supabase } from "../supabase";

// ── Result type ───────────────────────────────────────────────────────────────

/**
 * Raw Phase 2a metric values returned by the two Phase 2a Supabase functions.
 * All values are unformatted numbers or null.  No rounding, no currency symbols.
 */
export type Phase2aMetricsResult = {
  /**
   * Months of current-month overhead covered by current total cash balance.
   * Formula: SUM(cash_balance at MAX(snapshot_date)) / current-month actual overhead.
   * NULL when:
   *   • no cash_balance_snapshots row exists for the store, or
   *   • current-month actual overhead total is 0 (NULLIF guard in SQL).
   * @canonical METRIC.CASH_RUNWAY_MONTHS — tile id "cr"
   */
  cashRunwayMonths: number | null;

  /**
   * Operating profit for the period: contribution £ minus fixed overhead.
   * Formula: (net_sales × contribution_margin_pct) − monthly_overhead_total('actual').
   * NULL when contribution_margin_pct() returns NULL (no store_cost_assumptions row).
   * May be negative — a negative result is valid and must be displayed, not suppressed.
   * @canonical METRIC.OPERATING_PROFIT_ESTIMATE — tile id "np"
   */
  operatingProfitMonthly: number | null;
};

// ── Error type ────────────────────────────────────────────────────────────────

/**
 * Per-function error record.  Collected and returned alongside the result
 * so callers can surface data quality warnings without throwing.
 */
export type Phase2aMetricsError = {
  /** Name of the Supabase RPC function that failed. */
  fn: string;
  /** Supabase error message. */
  message: string;
};

// ── Response envelope ─────────────────────────────────────────────────────────

export type Phase2aMetricsResponse = {
  /** Metric values.  Fields for failed or unconfigured RPC calls are null. */
  data: Phase2aMetricsResult;
  /**
   * Errors from individual RPC calls.  Empty array when all calls succeed.
   * A null field whose fn does NOT appear here means the RPC succeeded and
   * the DB returned null (i.e. "not configured", not a failure).
   */
  errors: Phase2aMetricsError[];
};

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Calls one Supabase RPC function whose SQL may legitimately return NULL.
 * NULL means "not configured / no data" — distinct from 0.
 * Preserves DB NULL as null in the return value.
 * On Supabase/network error, pushes to the shared errors array and returns null.
 */
async function callRpcNullable(
  fnName: string,
  params: Record<string, unknown>,
  errors: Phase2aMetricsError[],
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

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches the two Phase 2a canonical metrics from Supabase for the given store
 * and date range.  Both RPC calls run in parallel.
 *
 * cash_runway_months() does not use the date range — it is accepted here for
 * API symmetry with getPhase1Metrics() so dashboard.tsx can share the same
 * PHASE1_DATE_FROM / PHASE1_DATE_TO constants for both calls.
 *
 * @param storeId  UUID of the store.
 * @param dateFrom First day of the period, inclusive (e.g. "2026-04-01").
 *                 Used for operating_profit_monthly only.
 * @param dateTo   Last day of the period, inclusive (e.g. "2026-04-30").
 *                 Used for operating_profit_monthly only.
 *
 * @returns Phase2aMetricsResponse with raw numeric-or-null data and any
 *   per-function errors.  A failure or null in one RPC is isolated — the
 *   other field is unaffected.  Check errors[] to distinguish a network
 *   failure (field null + error entry) from "not configured" (field null,
 *   no error entry).
 *
 * @example
 *   const { data, errors } = await getPhase2aMetrics(
 *     storeId,
 *     "2026-04-01",
 *     "2026-04-30",
 *   );
 *   if (errors.length) console.warn("[Phase2a] partial failure", errors);
 *   console.log(data.cashRunwayMonths, data.operatingProfitMonthly);
 */
export async function getPhase2aMetrics(
  storeId: string,
  dateFrom: string,
  dateTo: string,
): Promise<Phase2aMetricsResponse> {
  const errors: Phase2aMetricsError[] = [];

  // cash_runway_months takes only p_store_id — no date range params.
  const crParams = { p_store_id: storeId };

  // operating_profit_monthly matches the Phase 1 three-param convention.
  const opParams = {
    p_store_id:  storeId,
    p_date_from: dateFrom,
    p_date_to:   dateTo,
  };

  const [cashRunwayMonths, operatingProfitMonthly] = await Promise.all([
    callRpcNullable("cash_runway_months",        crParams, errors),
    callRpcNullable("operating_profit_monthly",  opParams, errors),
  ]);

  if (errors.length > 0) {
    console.warn("[Phase2a] RPC error(s) — affected tiles will use fallback values:", errors);
  }

  return {
    data: { cashRunwayMonths, operatingProfitMonthly },
    errors,
  };
}
