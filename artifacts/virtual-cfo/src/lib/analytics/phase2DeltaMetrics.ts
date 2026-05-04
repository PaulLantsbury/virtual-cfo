/**
 * phase2DeltaMetrics.ts
 *
 * Phase 2 prior-period delta query layer.
 *
 * Calls month_on_month_delta() which returns current-period values,
 * prior-period values, and computed deltas for all Phase 1 metrics in a
 * single round-trip.  The RPC is already deployed in Supabase — no DDL
 * changes are required to use this helper.
 *
 * DELTA UNIT CONVENTIONS (set at the SQL level — never convert here)
 * ------------------------------------------------------------------
 *   _delta_pct  Already a percentage (e.g. +12.4 = revenue up 12.4%)
 *               Applies to: gross_revenue, net_sales, aov, op_profit, overhead
 *   _delta_pp   Already in percentage points (e.g. -2.8 = CM down 2.8pp)
 *               Applies to: refund_rate, discount_dep, rpr, cm_pct
 *   _prv fields Raw values — rate fields are [0,1] ratios, matching Phase 1 RPCs
 *
 * NULL SEMANTICS
 * -------------
 * All _delta_* columns are null when the prior period has no order data
 * (NULLIF guard in the SQL function).  Callers MUST render "—" rather than
 * "0" for any null delta.  The formatDeltaPct() and formatDeltaPp() helpers
 * enforce this automatically.
 *
 * _prv columns are 0 (not null) when the prior period is empty — they
 * represent "there were no orders" rather than "we don't know".
 *
 * ERROR ISOLATION
 * ---------------
 * A single RPC failure sets data = null and records the error.  The caller
 * can check errors[] to distinguish a network failure from an empty result.
 * All other data layers (Phase 1, Phase 2a) are completely unaffected.
 */

import { supabase } from "../supabase";

// ── Result type ───────────────────────────────────────────────────────────────

/**
 * One row returned by month_on_month_delta().
 * Current-period fields are always numbers (0 when no data).
 * Prior-period fields are always numbers (0 when prior period is empty).
 * Delta fields are null when the prior period had no order data.
 */
export type Phase2DeltaRow = {
  // ── Current period ──────────────────────────────────────────────────────
  gross_revenue_cur:       number;
  net_sales_cur:           number;
  aov_cur:                 number;
  /** [0,1] ratio */
  refund_rate_cur:         number;
  /** [0,1] ratio */
  discount_dep_cur:        number;
  /** [0,1] ratio */
  rpr_cur:                 number;
  /** [0,1] ratio */
  cm_pct_cur:              number;
  op_profit_cur:           number;
  overhead_cur:            number;
  runway_cur:              number | null;

  // ── Prior period ─────────────────────────────────────────────────────────
  gross_revenue_prv:       number;
  net_sales_prv:           number;
  aov_prv:                 number;
  /** [0,1] ratio */
  refund_rate_prv:         number;
  /** [0,1] ratio */
  discount_dep_prv:        number;
  /** [0,1] ratio */
  rpr_prv:                 number;
  /** [0,1] ratio */
  cm_pct_prv:              number;
  op_profit_prv:           number;
  overhead_prv:            number;
  runway_prv:              number | null;

  // ── Deltas — null when prior period has no data ───────────────────────────
  /** % change — e.g. +12.4 means revenue up 12.4% */
  gross_revenue_delta_pct: number | null;
  /** % change */
  net_sales_delta_pct:     number | null;
  /** % change */
  aov_delta_pct:           number | null;
  /** pp change — e.g. +2.1 means refund rate up 2.1pp */
  refund_rate_delta_pp:    number | null;
  /** pp change */
  discount_dep_delta_pp:   number | null;
  /** pp change */
  rpr_delta_pp:            number | null;
  /** pp change */
  cm_pct_delta_pp:         number | null;
  /** % change */
  op_profit_delta_pct:     number | null;
  /** % change */
  overhead_delta_pct:      number | null;
  /** months change */
  runway_delta_months:     number | null;
};

export type Phase2DeltaError = {
  fn: string;
  message: string;
};

export type Phase2DeltaResponse = {
  /**
   * null when:
   *   - The RPC returned 0 rows (period has no data)
   *   - The RPC call itself failed (error recorded in errors[])
   */
  data:   Phase2DeltaRow | null;
  errors: Phase2DeltaError[];
};

// ── Formatters ────────────────────────────────────────────────────────────────

/**
 * Formats a _delta_pct value (already in %) as a change badge string.
 *   +12.4  → "↑ 12.4% vs last month"
 *   -3.2   → "↓ 3.2% vs last month"
 *   null   → "—"
 *   NaN    → "—"
 *
 * IMPORTANT: do NOT multiply by 100 before passing — the DB already returns
 * these as percentages, not [0,1] ratios.
 */
export function formatDeltaPct(delta: number | null | undefined): string {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return "—";
  const abs   = Math.abs(delta);
  const arrow = delta >= 0 ? "↑" : "↓";
  return `${arrow} ${abs.toFixed(1)}% vs last month`;
}

/**
 * Formats a _delta_pp value (already in percentage points) as a change badge string.
 *   +2.4  → "↑ 2.4pp vs last month"
 *   -1.8  → "↓ 1.8pp vs last month"
 *   null  → "—"
 *
 * IMPORTANT: do NOT multiply by 100 before passing — the DB already returns
 * these as pp values, not [0,1] ratios.
 */
export function formatDeltaPp(delta: number | null | undefined): string {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return "—";
  const abs   = Math.abs(delta);
  const arrow = delta >= 0 ? "↑" : "↓";
  return `${arrow} ${abs.toFixed(1)}pp vs last month`;
}

// ── Trailing 12-month CM average types ───────────────────────────────────────

/**
 * One row returned by trailing_12m_cm_avg().
 * The RPC averages the 12 calendar months immediately BEFORE the anchor
 * date (T-1 through T-12), excluding months where gross_revenue = 0.
 *
 * cm_pct_12m_avg is a [0,1] ratio — multiply by 100 for display as %.
 * null when no months with live order data were found in the window.
 * months_included reflects how many non-zero months were averaged (0–12).
 */
export type Trailing12mRow = {
  /** [0,1] ratio — multiply × 100 for display. null when no live months found. */
  cm_pct_12m_avg:  number | null;
  /** Number of non-zero-revenue months included in the average (0–12) */
  months_included: number;
};

export type Trailing12mError = {
  fn:      string;
  message: string;
};

export type Trailing12mResponse = {
  /**
   * null when:
   *   - The RPC returned 0 rows
   *   - The RPC call itself failed (error recorded in errors[])
   */
  data:   Trailing12mRow | null;
  errors: Trailing12mError[];
};

/**
 * Calls trailing_12m_cm_avg() and returns the first row.
 *
 * The RPC averages CM% for the 12 months immediately BEFORE the anchor
 * (T-1 through T-12, where T = p_date_from), skipping months with zero
 * gross revenue.  months_included in the result tells callers how many
 * months contributed to the average.
 *
 * @param storeId  UUID of the store — matches orders.store_id.
 * @param dateFrom First day of the CURRENT period (e.g. "2026-04-01").
 *                 Used as the anchor month T.  The RPC looks back T-1..T-12.
 */
export async function getTrailing12mCmAvg(
  storeId:  string,
  dateFrom: string,
): Promise<Trailing12mResponse> {
  const errors: Trailing12mError[] = [];

  const { data, error } = await supabase.rpc("trailing_12m_cm_avg", {
    p_store_id:  storeId,
    p_date_from: dateFrom,
  });

  if (error) {
    errors.push({ fn: "trailing_12m_cm_avg", message: error.message });
    return { data: null, errors };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { data: null, errors };

  return {
    errors,
    data: {
      cm_pct_12m_avg:  toNumNullable(row.cm_pct_12m_avg),
      months_included: toNum(row.months_included),
    },
  };
}

// ── Rolling 3-month averages types ───────────────────────────────────────────

/**
 * One row returned by rolling_3m_averages().
 * The RPC averages months T, T−1, T−2 (where T = p_date_from), excluding
 * months with zero gross revenue via a WHERE gross_revenue > 0 guard.
 *
 * cm_pct_3m_avg is a [0,1] ratio — multiply by 100 to display as a %.
 * months_included reflects how many non-zero months were averaged (1–3).
 */
export type Rolling3mRow = {
  /** [0,1] ratio — multiply × 100 for display */
  cm_pct_3m_avg:           number;
  gross_revenue_3m_avg:    number;
  net_sales_3m_avg:        number;
  fixed_overhead_3m_avg:   number;
  operating_profit_3m_avg: number;
  runway_3m_avg:           number | null;
  /** Number of non-zero-revenue months included in the average (1–3) */
  months_included:         number;
};

export type Rolling3mError = {
  fn: string;
  message: string;
};

export type Rolling3mResponse = {
  /**
   * null when:
   *   - The RPC returned 0 rows (no months with data in the window)
   *   - The RPC call itself failed (error recorded in errors[])
   */
  data:   Rolling3mRow | null;
  errors: Rolling3mError[];
};

/**
 * Calls rolling_3m_averages() and returns the first row.
 *
 * The RPC averages the T, T−1, T−2 months starting from p_date_from,
 * skipping months with zero gross revenue.  months_included in the result
 * tells callers how many months were averaged (1, 2 or 3).
 *
 * @param storeId  UUID of the store — matches orders.store_id.
 * @param dateFrom First day of the current period (e.g. "2026-04-01").
 *                 Used as the anchor month T.  Only one date is required —
 *                 the RPC derives the prior two months from this internally.
 */
export async function getRolling3mAverages(
  storeId:  string,
  dateFrom: string,
): Promise<Rolling3mResponse> {
  const errors: Rolling3mError[] = [];

  const { data, error } = await supabase.rpc("rolling_3m_averages", {
    p_store_id:  storeId,
    p_date_from: dateFrom,
  });

  if (error) {
    errors.push({ fn: "rolling_3m_averages", message: error.message });
    return { data: null, errors };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { data: null, errors };

  return {
    errors,
    data: {
      cm_pct_3m_avg:           toNum(row.cm_pct_3m_avg),
      gross_revenue_3m_avg:    toNum(row.gross_revenue_3m_avg),
      net_sales_3m_avg:        toNum(row.net_sales_3m_avg),
      fixed_overhead_3m_avg:   toNum(row.fixed_overhead_3m_avg),
      operating_profit_3m_avg: toNum(row.operating_profit_3m_avg),
      runway_3m_avg:           toNumNullable(row.runway_3m_avg),
      months_included:         toNum(row.months_included),
    },
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toNumNullable(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Calls month_on_month_delta() and returns the first row of results.
 *
 * The function computes the prior period automatically as the calendar month
 * immediately before p_date_from.  No extra params are needed.
 *
 * @param storeId  UUID of the store — matches orders.store_id.
 * @param dateFrom First day of the current period (e.g. "2026-04-01").
 * @param dateTo   Last day of the current period (e.g. "2026-04-30").
 *
 * @returns Phase2DeltaResponse — data is null on RPC failure or empty result.
 *   errors[] is empty on success.  A non-empty errors[] with data = null
 *   means the RPC call itself failed (network error, SQL error).
 *   data = null with errors[] empty means the period has no rows in the view.
 */
export async function getPhase2Deltas(
  storeId: string,
  dateFrom: string,
  dateTo: string,
): Promise<Phase2DeltaResponse> {
  const errors: Phase2DeltaError[] = [];

  const { data, error } = await supabase.rpc("month_on_month_delta", {
    p_store_id:  storeId,
    p_date_from: dateFrom,
    p_date_to:   dateTo,
  });

  if (error) {
    errors.push({ fn: "month_on_month_delta", message: error.message });
    return { data: null, errors };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { data: null, errors };

  return {
    errors,
    data: {
      gross_revenue_cur:       toNum(row.gross_revenue_cur),
      net_sales_cur:           toNum(row.net_sales_cur),
      aov_cur:                 toNum(row.aov_cur),
      refund_rate_cur:         toNum(row.refund_rate_cur),
      discount_dep_cur:        toNum(row.discount_dep_cur),
      rpr_cur:                 toNum(row.rpr_cur),
      cm_pct_cur:              toNum(row.cm_pct_cur),
      op_profit_cur:           toNum(row.op_profit_cur),
      overhead_cur:            toNum(row.overhead_cur),
      runway_cur:              toNumNullable(row.runway_cur),
      gross_revenue_prv:       toNum(row.gross_revenue_prv),
      net_sales_prv:           toNum(row.net_sales_prv),
      aov_prv:                 toNum(row.aov_prv),
      refund_rate_prv:         toNum(row.refund_rate_prv),
      discount_dep_prv:        toNum(row.discount_dep_prv),
      rpr_prv:                 toNum(row.rpr_prv),
      cm_pct_prv:              toNum(row.cm_pct_prv),
      op_profit_prv:           toNum(row.op_profit_prv),
      overhead_prv:            toNum(row.overhead_prv),
      runway_prv:              toNumNullable(row.runway_prv),
      gross_revenue_delta_pct: toNumNullable(row.gross_revenue_delta_pct),
      net_sales_delta_pct:     toNumNullable(row.net_sales_delta_pct),
      aov_delta_pct:           toNumNullable(row.aov_delta_pct),
      refund_rate_delta_pp:    toNumNullable(row.refund_rate_delta_pp),
      discount_dep_delta_pp:   toNumNullable(row.discount_dep_delta_pp),
      rpr_delta_pp:            toNumNullable(row.rpr_delta_pp),
      cm_pct_delta_pp:         toNumNullable(row.cm_pct_delta_pp),
      op_profit_delta_pct:     toNumNullable(row.op_profit_delta_pct),
      overhead_delta_pct:      toNumNullable(row.overhead_delta_pct),
      runway_delta_months:     toNumNullable(row.runway_delta_months),
    },
  };
}
