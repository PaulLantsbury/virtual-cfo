-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 20260501000017 — Shadow DB consistency guard
--
-- WHY THIS MIGRATION EXISTS
-- ─────────────────────────
-- Migration 000003 (contribution_margin_pct) contains three steps:
--   1. CREATE VIEW v_current_cost_assumptions
--   2. Seed store_cost_assumptions (INSERT with FK on stores)
--   3. CREATE FUNCTION contribution_margin_pct
--
-- On a FRESH shadow database (empty — no store rows yet), step 2 raises a
-- foreign-key violation and psql aborts the script before step 3 runs.
-- As a result, the shadow DB is missing contribution_margin_pct.
--
-- Downstream consequence:
--   • Migration 000008 (phase2b_trend_views) references contribution_margin_pct
--     → fails → v_monthly_metrics and v_month_on_month are never created.
--   • Migration 000013 (assert_view_order) also references the function
--     → fails → no recovery.
--
-- The deployment diff tool compares the (broken) shadow schema to production.
-- It sees that production has v_month_on_month but shadow does not. The diff
-- emits a CREATE VIEW for v_month_on_month without first emitting one for
-- v_monthly_metrics — because alphabetical order puts "month_on_month" before
-- "monthly_metrics" — producing:
--
--   ERROR: relation "v_monthly_metrics" does not exist
--
-- FIX
-- ───
-- Re-assert the three missing objects using CREATE OR REPLACE so this
-- migration is a strict no-op when run against production (all objects
-- already exist with byte-identical definitions).
--
-- Dependency order:
--   contribution_margin_pct  ← needed by v_monthly_metrics
--   v_monthly_metrics        ← needed by v_month_on_month
--   v_month_on_month
--
-- SAFETY
-- ──────
-- • CREATE OR REPLACE only — no DROP, no CASCADE, no data changes.
-- • Idempotent: safe to re-run any number of times.
-- • No tables, columns, or data are altered.
-- ═══════════════════════════════════════════════════════════════════════════

SET search_path TO public, pg_temp;

-- ── 1. contribution_margin_pct ───────────────────────────────────────────────
-- Byte-identical to the production definition.  No-op if already present.

CREATE OR REPLACE FUNCTION public.contribution_margin_pct(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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

-- ── 2. v_monthly_metrics ─────────────────────────────────────────────────────
-- Must be created BEFORE v_month_on_month (which depends on it).
-- Byte-identical to migration 000013.  No-op if already present.

CREATE OR REPLACE VIEW public.v_monthly_metrics AS
WITH months AS (
  SELECT
    generate_series(
      '2026-01-01'::date,
      '2026-06-01'::date,
      interval '1 month'
    )::date AS month_start
),
stores_list AS (
  SELECT id AS store_id FROM public.stores
)
SELECT
  s.store_id,
  m.month_start                                                    AS period_start,
  (m.month_start + interval '1 month')::date - 1                  AS period_end,

  public.gross_revenue(
    s.store_id,
    m.month_start,
    (m.month_start + interval '1 month')::date - 1
  )                                                                AS gross_revenue,

  public.net_sales(
    s.store_id,
    m.month_start,
    (m.month_start + interval '1 month')::date - 1
  )                                                                AS net_sales,

  public.average_order_value(
    s.store_id,
    m.month_start,
    (m.month_start + interval '1 month')::date - 1
  )                                                                AS average_order_value,

  public.refund_rate(
    s.store_id,
    m.month_start,
    (m.month_start + interval '1 month')::date - 1
  )                                                                AS refund_rate,

  public.discount_dependency(
    s.store_id,
    m.month_start,
    (m.month_start + interval '1 month')::date - 1
  )                                                                AS discount_dependency,

  public.repeat_purchase_rate(
    s.store_id,
    m.month_start,
    (m.month_start + interval '1 month')::date - 1
  )                                                                AS repeat_purchase_rate,

  public.contribution_margin_pct(
    s.store_id,
    m.month_start,
    (m.month_start + interval '1 month')::date - 1
  )                                                                AS contribution_margin_pct,

  public.operating_profit_monthly(
    s.store_id,
    m.month_start,
    (m.month_start + interval '1 month')::date - 1
  )                                                                AS operating_profit,

  public.monthly_overhead_total(
    s.store_id,
    m.month_start,
    (m.month_start + interval '1 month')::date - 1,
    'actual'
  )                                                                AS fixed_overhead_actual

FROM months     m
CROSS JOIN stores_list s;

COMMENT ON VIEW public.v_monthly_metrics IS
  'Monthly metric snapshot for every store × calendar month (Jan–Jun 2026). '
  'One row per (store_id, period_start). '
  'Calls Phase 1 + Phase 2a RPCs: gross_revenue, net_sales, average_order_value, '
  'refund_rate, discount_dependency, repeat_purchase_rate, contribution_margin_pct, '
  'operating_profit_monthly, monthly_overhead_total. '
  'cash_runway_months() is excluded — it reads CURRENT_DATE and cannot be '
  'parameterised by historical month. '
  'Range: Jan 2026 – Jun 2026 (hard-coded; extend generate_series as data grows). '
  'Powers v_month_on_month and the trend RPC layer.';

-- ── 3. v_month_on_month (depends on v_monthly_metrics above) ────────────────
-- Byte-identical to migration 000013.  No-op if already present.

CREATE OR REPLACE VIEW public.v_month_on_month AS
SELECT
  cur.store_id,
  cur.period_start,
  cur.period_end,

  cur.gross_revenue                      AS gross_revenue_cur,
  cur.net_sales                          AS net_sales_cur,
  cur.average_order_value                AS aov_cur,
  cur.refund_rate                        AS refund_rate_cur,
  cur.discount_dependency                AS discount_dep_cur,
  cur.repeat_purchase_rate               AS rpr_cur,
  cur.contribution_margin_pct            AS cm_pct_cur,
  cur.operating_profit                   AS op_profit_cur,
  cur.fixed_overhead_actual              AS overhead_cur,

  prv.gross_revenue                      AS gross_revenue_prv,
  prv.net_sales                          AS net_sales_prv,
  prv.average_order_value                AS aov_prv,
  prv.refund_rate                        AS refund_rate_prv,
  prv.discount_dependency                AS discount_dep_prv,
  prv.repeat_purchase_rate               AS rpr_prv,
  prv.contribution_margin_pct            AS cm_pct_prv,
  prv.operating_profit                   AS op_profit_prv,
  prv.fixed_overhead_actual              AS overhead_prv,

  ROUND(
    (cur.gross_revenue - prv.gross_revenue)
    / NULLIF(ABS(prv.gross_revenue), 0) * 100,
    1
  )                                      AS gross_revenue_delta_pct,

  ROUND(
    (cur.net_sales - prv.net_sales)
    / NULLIF(ABS(prv.net_sales), 0) * 100,
    1
  )                                      AS net_sales_delta_pct,

  ROUND(
    (cur.average_order_value - prv.average_order_value)
    / NULLIF(ABS(prv.average_order_value), 0) * 100,
    1
  )                                      AS aov_delta_pct,

  ROUND(
    (cur.operating_profit - prv.operating_profit)
    / NULLIF(ABS(prv.operating_profit), 0) * 100,
    1
  )                                      AS op_profit_delta_pct,

  ROUND(
    (cur.fixed_overhead_actual - prv.fixed_overhead_actual)
    / NULLIF(ABS(prv.fixed_overhead_actual), 0) * 100,
    1
  )                                      AS overhead_delta_pct,

  ROUND(
    (cur.refund_rate - prv.refund_rate) * 100,
    2
  )                                      AS refund_rate_delta_pp,

  ROUND(
    (cur.discount_dependency - prv.discount_dependency) * 100,
    2
  )                                      AS discount_dep_delta_pp,

  ROUND(
    (cur.repeat_purchase_rate - prv.repeat_purchase_rate) * 100,
    1
  )                                      AS rpr_delta_pp,

  ROUND(
    (cur.contribution_margin_pct - prv.contribution_margin_pct) * 100,
    2
  )                                      AS cm_pct_delta_pp

FROM public.v_monthly_metrics cur
LEFT JOIN public.v_monthly_metrics prv
  ON  prv.store_id     = cur.store_id
  AND prv.period_start = (cur.period_start - interval '1 month')::date;

COMMENT ON VIEW public.v_month_on_month IS
  'Month-on-month delta view for every store × calendar month. '
  'Self-join on v_monthly_metrics: current row + prior month row + computed deltas. '
  'Money deltas (gross_revenue, net_sales, aov, op_profit, overhead): '
  '  (cur − prv) / ABS(prv) × 100  — ABS denominator safe for negative op_profit. '
  'Ratio deltas (refund_rate, discount_dep, rpr, cm_pct): '
  '  (cur − prv) × 100  — absolute percentage-point change. '
  'January 2026 has NULL deltas (no prior month, LEFT JOIN). '
  'Powers the month_on_month_delta() RPC and the Trend tab in the dashboard.';
