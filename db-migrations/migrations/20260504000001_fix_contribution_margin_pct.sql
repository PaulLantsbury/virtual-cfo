-- =============================================================================
-- Migration 20260504000001 — fix_contribution_margin_pct
--
-- PURPOSE
-- -------
-- Fixes contribution_margin_pct() which has been returning HTTP 400 on every
-- call since deployment due to three column name mismatches with the actual
-- store_cost_assumptions schema, plus a formula that omits per-order variable
-- costs and incorrectly deducts VAT (which is already excluded from net_sales).
--
-- ROOT CAUSE
-- ----------
-- The function deployed in 20260430000007z_pre_views_functions.sql queries
-- columns cogs_pct, payment_fee_pct, and return_rate — none of which exist.
-- The actual store_cost_assumptions columns are:
--   payment_fee_rate, fulfilment_cost_per_order, packaging_cost_per_order,
--   return_handling_rate, vat_rate (not used in corrected formula).
--
-- CHANGES FROM PREVIOUS VERSION
-- --------------------------------
-- 1. Removes reference to non-existent column cogs_pct.
-- 2. Renames payment_fee_pct  → payment_fee_rate      (actual column name).
-- 3. Renames return_rate      → return_handling_rate   (actual column name).
-- 4. Adds fulfilment_cost_per_order and packaging_cost_per_order (per-order costs).
-- 5. Switches formula basis from gross_revenue to net_sales — matches the
--    canonical definition in phase1Metrics.ts and the phase2b plan's expected
--    values (~88.7% for April 2026).
-- 6. Removes erroneous VAT deduction — VAT is already excluded from net_sales.
-- 7. Adds ORDER BY effective_from DESC so cost row selection is deterministic
--    when multiple rows exist for the same store.
-- 8. Adds effective_from <= p_date_from filter so future-dated cost rows do
--    not apply retroactively to historical periods.
-- 9. Delegates net_sales, order_count, return_amount to their existing Phase 1
--    helper functions for consistency and to avoid inline re-implementation.
--
-- EXPECTED RESULT
-- ---------------
-- contribution_margin_pct('10000000-0000-0000-0000-000000000001',
--                          '2026-04-01', '2026-04-30')
-- → 0.8880  (88.80% — within 0.1pp of the ~88.7% phase2b plan target)
--
-- contribution_margin_pct('10000000-0000-0000-0000-000000000001',
--                          '2026-05-01', '2026-05-31')
-- → 0  (no orders in May 2026 seed data — 0, not an error)
--
-- DOWNSTREAM IMPACT
-- -----------------
-- operating_profit_monthly() calls this function internally. It was returning
-- NULL due to the 400 error propagating through the call chain. After this fix
-- it will return the correct value: (net_sales × cm_pct) − fixed_overhead.
-- No other function definitions or view DDL require changes.
--
-- IDEMPOTENT: CREATE OR REPLACE — safe to re-run.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.contribution_margin_pct(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_payment_fee_rate        numeric;
  v_fulfilment_cost_per_ord numeric;
  v_packaging_cost_per_ord  numeric;
  v_return_handling_rate    numeric;
  v_net_sales               numeric;
  v_order_count             bigint;
  v_return_amount           numeric;
BEGIN
  -- Most recent cost assumptions effective at or before the period start.
  -- ORDER BY is required: multiple rows may exist per store (e.g. annual reviews).
  -- effective_from <= p_date_from ensures future-dated rows are excluded from
  -- historical period calculations.
  SELECT payment_fee_rate,
         fulfilment_cost_per_order,
         packaging_cost_per_order,
         return_handling_rate
  INTO   v_payment_fee_rate,
         v_fulfilment_cost_per_ord,
         v_packaging_cost_per_ord,
         v_return_handling_rate
  FROM   public.store_cost_assumptions
  WHERE  store_id       = p_store_id
    AND  effective_from <= p_date_from
  ORDER  BY effective_from DESC
  LIMIT  1;

  -- NULL signals "store not configured" — frontend falls back to commerceMetrics.
  -- Distinct from 0 which means "configured but no orders in period".
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Delegate to existing Phase 1 helper functions for consistency.
  -- These functions each use COALESCE(..., 0) so they never return NULL.
  v_net_sales     := public.net_sales(p_store_id, p_date_from, p_date_to);
  v_order_count   := public.order_count(p_store_id, p_date_from, p_date_to);
  v_return_amount := public.return_amount(p_store_id, p_date_from, p_date_to);

  -- Return 0 when no orders in the period.
  -- Distinct from NULL ("not configured") — caller should treat 0 as
  -- "data exists but period is empty" and show the static fallback value.
  IF v_net_sales = 0 THEN RETURN 0; END IF;

  -- Canonical formula (matches phase1Metrics.ts contract):
  --
  --   CM = (net_sales − payment_fees − fulfilment − packaging − return_handling)
  --        / net_sales
  --
  --   payment_fees         = net_sales × payment_fee_rate
  --   fulfilment_cost      = order_count × fulfilment_cost_per_order
  --   packaging_cost       = order_count × packaging_cost_per_order
  --   return_handling_cost = return_amount × return_handling_rate
  --
  -- Note: VAT is NOT deducted here. It is already excluded from net_sales via
  --   the net_sales() formula: gross_sales − discounts − refund_ex_vat − net_tax.
  -- Deducting vat_rate here would be double-counting and produce incorrect results.
  RETURN ROUND(
    (
        v_net_sales
      - (v_net_sales     * v_payment_fee_rate)
      - (v_order_count   * v_fulfilment_cost_per_ord)
      - (v_order_count   * v_packaging_cost_per_ord)
      - (v_return_amount * v_return_handling_rate)
    ) / v_net_sales,
    4
  );
END;
$$;
