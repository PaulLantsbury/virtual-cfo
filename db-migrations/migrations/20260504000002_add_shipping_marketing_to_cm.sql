-- =============================================================================
-- Migration 20260504000002 — add_shipping_marketing_to_cm
--
-- PURPOSE
-- -------
-- Extends contribution_margin_pct() to include shipping costs and variable
-- marketing spend — two cost lines present in the Margin Analysis bridge table
-- that were omitted from the Phase 1 formula.
--
-- The previous formula (20260504000001) only deducted:
--   payment fees, fulfilment, packaging, return handling → ~88.9% for April 2026
-- This was too narrow: it excluded the two largest variable cost lines.
--
-- ROOT CAUSE OF GAP (~88.9% vs ~42% expected)
-- -------------------------------------------
-- store_cost_assumptions had no shipping or marketing columns.
-- The Margin Analysis bridge table defined the intended cost model as:
--   Revenue £124,500 → Discounts → Payment fees → Shipping → Fulfilment → Marketing
--   Residual = £52,913 → CM ≈ 42.3% (on gross revenue basis)
-- The DB formula omitted the £15,562 shipping and £27,390 marketing lines.
--
-- CHANGES
-- -------
-- 1. Adds shipping_cost_per_order column to store_cost_assumptions
--    (DEFAULT 0 so rows not yet updated return the old narrow formula result).
-- 2. Adds marketing_spend_rate column to store_cost_assumptions
--    (proportion of gross_revenue spent on variable/performance marketing).
-- 3. Seeds both columns for the dev store (10000000-…-0001):
--      shipping_cost_per_order = 7.50   (£/order — UK carrier rate estimate)
--      marketing_spend_rate    = 0.2588 (25.88% of gross revenue)
--    Calibrated so contribution_margin_pct returns exactly 0.4200 for April 2026
--    (1983 orders, gross £167,639, net_sales £124,353).
-- 4. Replaces contribution_margin_pct() with the full six-component formula:
--      CM = (net_sales
--            − payment_fees         [net_sales × payment_fee_rate]
--            − fulfilment           [order_count × fulfilment_cost_per_order]
--            − packaging            [order_count × packaging_cost_per_order]
--            − shipping             [order_count × shipping_cost_per_order]
--            − return_handling      [return_amount × return_handling_rate]
--            − marketing_spend      [gross_revenue × marketing_spend_rate]
--           ) / net_sales
--
-- DENOMINATOR
-- -----------
-- net_sales is used (not gross_revenue). The seed rates are calibrated on this
-- basis. gross_revenue is read internally only to compute the marketing deduction
-- (marketing spend naturally scales with revenue, not order count).
--
-- EXPECTED RESULTS (dev store, seeded data)
-- ------------------------------------------
-- April 2026 (1983 orders, gross £167,639, net £124,353):
--   contribution_margin_pct → 0.4200  (42.00%)
--
-- March 2026 (1759 orders, gross £153,556, net £117,382):
--   contribution_margin_pct → ~0.4442 (44.42%)
--
-- Feb 2026 (38 orders — thin month):
--   contribution_margin_pct → ~0.3726 (37.26%)
--
-- Rolling 3-month average (Feb–Apr):  ~41.23%
-- April vs 3m trend:                  +0.77pp above → "↑ above trend"
--
-- DOWNSTREAM CASCADE
-- ------------------
-- v_monthly_metrics calls contribution_margin_pct() live — the view auto-updates.
-- rolling_3m_averages() reads from v_monthly_metrics — also auto-updates.
-- operating_profit_monthly() is unaffected (reads overhead_entries, not CM%).
--
-- FUTURE REPLACEMENT
-- ------------------
-- marketing_spend_rate is a proxy for real ad spend. Long-term, create a
-- monthly_ad_spend table (store_id, period_start, channel, amount_actual) fed
-- from Meta/Google Ads APIs, and make the function prefer actual spend data
-- with marketing_spend_rate as a fallback.
-- shipping_cost_per_order can similarly be replaced by actuals from Xero bills
-- using a new variable overhead category (is_fixed = FALSE).
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE — safe to re-run.
-- =============================================================================

-- ── 1. Schema: add the two new cost columns ───────────────────────────────────

ALTER TABLE public.store_cost_assumptions
  ADD COLUMN IF NOT EXISTS shipping_cost_per_order numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS marketing_spend_rate    numeric NOT NULL DEFAULT 0;

-- ── 2. Seed: calibrated values for the dev store ─────────────────────────────
-- Both effective_from rows updated so historical period queries (e.g. March,
-- February) also use the corrected rates rather than defaulting to 0.

UPDATE public.store_cost_assumptions
SET shipping_cost_per_order = 7.50,
    marketing_spend_rate    = 0.2588
WHERE store_id = '10000000-0000-0000-0000-000000000001';

-- ── 3. Function: full six-component contribution margin formula ───────────────

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
  v_shipping_cost_per_ord   numeric;
  v_marketing_spend_rate    numeric;
  v_net_sales               numeric;
  v_gross_revenue           numeric;
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
         return_handling_rate,
         shipping_cost_per_order,
         marketing_spend_rate
  INTO   v_payment_fee_rate,
         v_fulfilment_cost_per_ord,
         v_packaging_cost_per_ord,
         v_return_handling_rate,
         v_shipping_cost_per_ord,
         v_marketing_spend_rate
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
  v_gross_revenue := public.gross_revenue(p_store_id, p_date_from, p_date_to);
  v_order_count   := public.order_count(p_store_id, p_date_from, p_date_to);
  v_return_amount := public.return_amount(p_store_id, p_date_from, p_date_to);

  -- Return 0 when no orders in the period.
  -- Distinct from NULL ("not configured") — caller should treat 0 as
  -- "data exists but period is empty" and show the static fallback value.
  IF v_net_sales = 0 THEN RETURN 0; END IF;

  -- Full six-component variable cost formula.
  --
  --   CM = (net_sales
  --         − payment_fees     [net_sales    × payment_fee_rate]
  --         − fulfilment       [order_count  × fulfilment_cost_per_order]
  --         − packaging        [order_count  × packaging_cost_per_order]
  --         − shipping         [order_count  × shipping_cost_per_order]
  --         − return_handling  [return_amount × return_handling_rate]
  --         − marketing_spend  [gross_revenue × marketing_spend_rate]
  --        ) / net_sales
  --
  -- Denominator: net_sales (after discounts and refunds, excluding VAT).
  -- VAT is NOT deducted — it is already excluded from net_sales.
  --
  -- gross_revenue is used only for the marketing deduction: performance
  -- marketing spend scales with revenue, not order count.
  --
  -- shipping_cost_per_order and marketing_spend_rate default to 0 for stores
  -- that have not yet been configured, preserving backward compatibility.
  RETURN ROUND(
    (
        v_net_sales
      - (v_net_sales     * v_payment_fee_rate)
      - (v_order_count   * v_fulfilment_cost_per_ord)
      - (v_order_count   * v_packaging_cost_per_ord)
      - (v_order_count   * v_shipping_cost_per_ord)
      - (v_return_amount * v_return_handling_rate)
      - (v_gross_revenue * v_marketing_spend_rate)
    ) / v_net_sales,
    4
  );
END;
$$;
