-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 20260429000003 — contribution_margin_pct
--
-- Adds the Supabase-backed Contribution Margin % function for Phase 1.
--
-- Steps:
--   1. Create view v_current_cost_assumptions
--   2. Seed dev store cost assumptions (idempotent)
--   3. Create SECURITY DEFINER function contribution_margin_pct()
--
-- Canonical metric: METRIC.CONTRIBUTION_MARGIN_PCT / tile id "cm"
--
-- Formula:
--   cm_pct = (net_sales - payment_fees - fulfilment_cost
--              - packaging_cost - return_handling_cost) / net_sales
--
--   where:
--     payment_fees          = net_sales × payment_fee_rate
--     fulfilment_cost       = order_count × fulfilment_cost_per_order
--     packaging_cost        = order_count × packaging_cost_per_order
--     return_handling_cost  = return_amount × return_handling_rate
--
-- Dependencies:
--   Reuses existing Phase 1 SECURITY DEFINER functions:
--     net_sales(uuid, date, date)
--     order_count(uuid, date, date)
--     return_amount(uuid, date, date)
--
-- Return value:
--   Ratio in [0, 1] — NOT a formatted percentage.
--   Returns NULL when no cost assumption row exists for the store.
--   Callers should treat NULL as "not configured" and fall back to commerceMetrics.
--
-- Dev store:
--   UUID: 10000000-0000-0000-0000-000000000001
--   Seed values: 2.9% payment rate, £3.50 fulfilment, £1.25 packaging, 15% return handling
--   Expected output on current test data:
--     net_sales=163.20, order_count=2, return_amount=0.00
--     payment_fees=4.73  fulfilment=7.00  packaging=2.50  return_handling=0.00
--     contribution=163.20−4.73−7.00−2.50−0.00 = 148.97
--     cm_pct = 148.97 / 163.20 = 0.9129 ≈ 91.3%
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. View: v_current_cost_assumptions ──────────────────────────────────────
-- Returns the most recent effective cost assumption row per store
-- (highest effective_from that is ≤ today).

CREATE OR REPLACE VIEW public.v_current_cost_assumptions AS
SELECT DISTINCT ON (store_id)
  id,
  store_id,
  payment_fee_rate,
  fulfilment_cost_per_order,
  packaging_cost_per_order,
  return_handling_rate,
  effective_from,
  created_at
FROM public.store_cost_assumptions
WHERE effective_from <= CURRENT_DATE
ORDER BY store_id, effective_from DESC;

COMMENT ON VIEW public.v_current_cost_assumptions IS
  'Current (most recent effective_from ≤ today) cost assumption row per store. '
  'Used by contribution_margin_pct() and other cost-based metrics.';

-- ── 2. Seed: dev store cost assumptions ─────────────────────────────────────
-- Idempotent INSERT — safe to re-run.
-- Unique constraint: (store_id, effective_from).

INSERT INTO public.store_cost_assumptions (
  store_id,
  payment_fee_rate,
  fulfilment_cost_per_order,
  packaging_cost_per_order,
  return_handling_rate,
  effective_from
)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  0.029,    -- 2.9% — Shopify Payments / Stripe standard blended card rate
  3.50,     -- £3.50 per order for third-party fulfilment or in-house pick/pack
  1.25,     -- £1.25 per order for packaging materials
  0.15,     -- 15% of returned goods value for return handling (restocking + inspection)
  '2026-01-01'
)
ON CONFLICT (store_id, effective_from) DO NOTHING;

-- ── 3. Function: contribution_margin_pct ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.contribution_margin_pct(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

COMMENT ON FUNCTION public.contribution_margin_pct(uuid, date, date) IS
  'Contribution margin % for a store in a date range. '
  'Formula: (net_sales − payment_fees − fulfilment − packaging − return_handling) / net_sales. '
  'Cost rates read from v_current_cost_assumptions (most recent effective_from ≤ today). '
  'Returns NULL when no cost row is found for the store (caller should fall back). '
  'Returns 0 when net_sales = 0. '
  'SECURITY DEFINER — runs as table owner, bypasses RLS for anon-key callers. '
  'Reuses: net_sales(), order_count(), return_amount().';
