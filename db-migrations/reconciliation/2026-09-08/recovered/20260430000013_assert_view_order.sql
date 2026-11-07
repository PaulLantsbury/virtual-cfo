-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 20260430000013 — Assert correct view creation order
--
-- Purpose
-- -------
-- The deployment diff tool can emit DDL that DROPs v_monthly_metrics via
-- CASCADE (when patching upstream objects) and then tries to recreate
-- v_month_on_month BEFORE v_monthly_metrics — because the diff only adds
-- v_month_on_month to its change list (the one it knows was dropped) while
-- omitting v_monthly_metrics (it appeared unchanged in shadow vs production).
--
-- This migration runs last in both the shadow DB and production, guaranteeing:
--   1. v_monthly_metrics is created/replaced FIRST.
--   2. v_month_on_month is created/replaced SECOND (it depends on #1).
--   3. Both definitions in shadow and production are byte-identical, so the
--      diff generates no DDL for either view in future deploys.
--
-- SAFE TO RE-RUN: both statements use CREATE OR REPLACE VIEW.
-- NO DATA IS AFFECTED: views contain no rows.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. v_monthly_metrics ────────────────────────────────────────────────────

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

-- ── 2. v_month_on_month (depends on v_monthly_metrics above) ────────────────

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
