-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 20260430000014 — Sync contribution_margin_pct to production body
--
-- The body in migration 000003 has a different number of Unicode box-drawing
-- characters (U+2500) in some comment lines compared to what was stored in the
-- production database.  Even though the logic is identical, the diff tool sees
-- the pg_get_functiondef strings as different and generates DDL for it.
--
-- If the diff uses DROP FUNCTION ... CASCADE, v_monthly_metrics is dropped as
-- a side-effect, which cascades to v_month_on_month.  Since both views appear
-- identical between shadow and production, no view DDL is in the diff, so the
-- views are never recreated → deployment fails.
--
-- This migration uses CREATE OR REPLACE FUNCTION with the pg_get_functiondef
-- verbatim from production, guaranteeing byte-identical agreement between the
-- shadow DB and production after this migration runs.
--
-- SAFE TO RE-RUN: CREATE OR REPLACE, no cascade.
-- NO DATA AFFECTED: pure function replacement.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.contribution_margin_pct(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  -- Revenue inputs (reuse existing SECURITY DEFINER functions)
  v_net_sales     numeric;
  v_order_count   bigint;
  v_return_amount numeric;

  -- Cost assumption columns (read from view)
  v_payment_fee_rate          numeric;
  v_fulfilment_cost_per_order numeric;
  v_packaging_cost_per_order  numeric;
  v_return_handling_rate      numeric;

  -- Computed variable cost components
  v_payment_fees  numeric;
  v_fulfilment    numeric;
  v_packaging     numeric;
  v_return_hdl    numeric;

  -- Final ratio
  v_contribution  numeric;
BEGIN

  -- ── Revenue inputs ────────────────────────────────────────────────────────
  -- All three functions exclude cancelled orders and are SECURITY DEFINER.
  v_net_sales     := public.net_sales(p_store_id, p_date_from, p_date_to);
  v_order_count   := public.order_count(p_store_id, p_date_from, p_date_to);
  v_return_amount := public.return_amount(p_store_id, p_date_from, p_date_to);

  -- Guard: no revenue in period → margin is 0 (not null — avoids division error)
  IF v_net_sales = 0 THEN
    RETURN 0;
  END IF;

  -- ── Cost assumptions ─────────────────────────────────────────────────────
  SELECT
    payment_fee_rate,
    fulfilment_cost_per_order,
    packaging_cost_per_order,
    return_handling_rate
  INTO
    v_payment_fee_rate,
    v_fulfilment_cost_per_order,
    v_packaging_cost_per_order,
    v_return_handling_rate
  FROM public.v_current_cost_assumptions
  WHERE store_id = p_store_id;

  -- Guard: no cost row → return NULL to signal "not configured".
  -- The dashboard tile falls back to commerceMetrics when NULL is returned.
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- ── Variable cost components ──────────────────────────────────────────────
  v_payment_fees := v_net_sales  * v_payment_fee_rate;
  v_fulfilment   := v_order_count::numeric * v_fulfilment_cost_per_order;
  v_packaging    := v_order_count::numeric * v_packaging_cost_per_order;
  v_return_hdl   := v_return_amount * v_return_handling_rate;

  -- ── Contribution margin ratio ─────────────────────────────────────────────
  v_contribution := v_net_sales
                    - v_payment_fees
                    - v_fulfilment
                    - v_packaging
                    - v_return_hdl;

  -- NULLIF guard redundant here (v_net_sales ≠ 0 already checked) but kept
  -- for defensive correctness.
  RETURN v_contribution / NULLIF(v_net_sales, 0);

END;
$function$
;
