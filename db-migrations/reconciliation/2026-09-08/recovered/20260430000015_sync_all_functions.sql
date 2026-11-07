-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 20260430000015 — Full function sync to production bodies
--
-- Eight functions have different pg_get_functiondef strings between the
-- shadow DB (built from migration files) and production.  The differences
-- range from SQL formatting (line breaks, column alignment) to a structural
-- rewrite of discount_dependency (CASE → COALESCE) and unicode character
-- count differences in comments.
--
-- Any of these differences causes the diff tool to generate DDL for the
-- affected function.  If the diff tool uses DROP FUNCTION ... CASCADE, the
-- cascade reaches v_monthly_metrics (which calls all of them) and then
-- v_month_on_month.  Because both views are identical between shadow and
-- production, no view DDL is in the diff, so the views are never recreated
-- and deployment fails.
--
-- This migration uses CREATE OR REPLACE FUNCTION (no CASCADE) with the
-- verbatim pg_get_functiondef text from production, guaranteeing byte-
-- identical agreement between shadow and production for every affected
-- function after this migration runs.
--
-- ORDER: functions are listed in dependency order.
--   gross_revenue, discount_cost, discount_dependency, order_count,
--   refund_rate, repeat_purchase_rate  →  called by v_monthly_metrics
--   recoverable_contribution_range     →  standalone RPC
--   cfo_alerts                         →  calls month_on_month_delta
--
-- SAFE TO RE-RUN: all statements are CREATE OR REPLACE FUNCTION.
-- NO DATA AFFECTED: pure function replacements.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── gross_revenue ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.gross_revenue(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(SUM(gross_sales), 0) FROM public.orders
  WHERE store_id = p_store_id AND created_at::date BETWEEN p_date_from AND p_date_to
    AND financial_status <> 'cancelled';
$function$
;

-- ── discount_cost ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.discount_cost(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(SUM(discounts), 0) FROM public.orders
  WHERE store_id = p_store_id AND created_at::date BETWEEN p_date_from AND p_date_to
    AND financial_status <> 'cancelled';
$function$
;

-- ── discount_dependency ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.discount_dependency(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(SUM(discounts) / NULLIF(SUM(gross_sales), 0), 0) FROM public.orders
  WHERE store_id = p_store_id AND created_at::date BETWEEN p_date_from AND p_date_to
    AND financial_status <> 'cancelled';
$function$
;

-- ── order_count ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.order_count(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COUNT(*) FROM public.orders
  WHERE store_id = p_store_id AND created_at::date BETWEEN p_date_from AND p_date_to
    AND financial_status NOT IN ('cancelled','refunded');
$function$
;

-- ── refund_rate ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.refund_rate(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(SUM(refunds) / NULLIF(SUM(gross_sales), 0), 0) FROM public.orders
  WHERE store_id = p_store_id AND created_at::date BETWEEN p_date_from AND p_date_to
    AND financial_status <> 'cancelled';
$function$
;

-- ── repeat_purchase_rate ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.repeat_purchase_rate(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH period_customers AS (
    SELECT o.customer_id, c.first_order_at
    FROM   public.orders o
    JOIN   public.customers c ON c.id = o.customer_id AND c.store_id = p_store_id
    WHERE  o.store_id = p_store_id AND o.created_at::date BETWEEN p_date_from AND p_date_to
      AND  o.financial_status <> 'cancelled' AND o.customer_id IS NOT NULL
    GROUP  BY o.customer_id, c.first_order_at
  )
  SELECT COALESCE(
    COUNT(*) FILTER (WHERE first_order_at < p_date_from::timestamptz)::numeric
    / NULLIF(COUNT(*)::numeric, 0), 0)
  FROM period_customers;
$function$
;

-- ── recoverable_contribution_range ──────────────────────────────

CREATE OR REPLACE FUNCTION public.recoverable_contribution_range(p_store_id uuid)
 RETURNS TABLE(recoverable_low numeric, recoverable_high numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    COALESCE(SUM(impact_low),  0) AS recoverable_low,
    COALESCE(SUM(impact_high), 0) AS recoverable_high
  FROM opportunities
  WHERE store_id = p_store_id
    AND status   <> 'archived';
$function$
;

-- ── cfo_alerts ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cfo_alerts(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS TABLE(alert_key text, severity text, metric text, current_val numeric, threshold numeric, triggered boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  -- ── Named threshold constants ──────────────────────────────────────────────
  c_revenue_decline_pct     constant numeric :=  -5.0;
  c_margin_fall_pp          constant numeric :=  -0.5;
  c_margin_critical_floor   constant numeric :=  70.0;   -- percent (cm_pct × 100)
  c_refund_rise_pp          constant numeric :=   0.5;
  c_refund_critical_floor   constant numeric :=   8.0;   -- percent (refund_rate × 100)
  c_discount_rise_pp        constant numeric :=   1.0;
  c_discount_critical_floor constant numeric :=  15.0;   -- percent (discount_dep × 100)
  c_overhead_outpace_gap    constant numeric :=   5.0;   -- percentage-point gap
  c_profit_deteriorate_pct  constant numeric := -10.0;
  c_runway_low_months       constant numeric :=   1.0;
  c_runway_tighten_months   constant numeric :=   2.0;
  c_runway_decline_months   constant numeric :=  -0.25;

  -- ── Delta row from month_on_month_delta() ──────────────────────────────────
  r  record;
BEGIN
  -- Single call to month_on_month_delta — all 13 rules share this fetch
  SELECT * INTO r
  FROM public.month_on_month_delta(p_store_id, p_date_from, p_date_to);

  IF NOT FOUND THEN
    RETURN; -- no data for this period — return empty set
  END IF;

  RETURN QUERY

  -- ── 1. revenue_declining ────────────────────────────────��──────────────────
  SELECT
    'revenue_declining'::text,
    'warning'::text,
    'gross_revenue'::text,
    r.gross_revenue_delta_pct,
    c_revenue_decline_pct::numeric,
    (r.gross_revenue_delta_pct IS NOT NULL
     AND r.gross_revenue_delta_pct < c_revenue_decline_pct)::boolean

  UNION ALL

  -- ── 2. revenue_stall (growth between decline threshold and 0%) ─────────────
  SELECT
    'revenue_stall',
    'info',
    'gross_revenue',
    r.gross_revenue_delta_pct,
    0.0,
    (r.gross_revenue_delta_pct IS NOT NULL
     AND r.gross_revenue_delta_pct >= c_revenue_decline_pct
     AND r.gross_revenue_delta_pct <= 0.0)::boolean

  UNION ALL

  -- ── 3. margin_falling (cm pp delta below warning threshold) ───────────────
  SELECT
    'margin_falling',
    'warning',
    'contribution_margin_pct',
    r.cm_pct_delta_pp,
    c_margin_fall_pp::numeric,
    (r.cm_pct_delta_pp IS NOT NULL
     AND r.cm_pct_delta_pp < c_margin_fall_pp)::boolean

  UNION ALL

  -- ── 4. margin_critical (absolute cm below 70% floor) ──────────────────────
  SELECT
    'margin_critical',
    'critical',
    'contribution_margin_pct',
    ROUND(r.cm_pct_cur * 100, 2),
    c_margin_critical_floor::numeric,
    (r.cm_pct_cur IS NOT NULL
     AND r.cm_pct_cur * 100 < c_margin_critical_floor)::boolean

  UNION ALL

  -- ── 5. refunds_rising (refund rate pp delta above warning threshold) ───────
  SELECT
    'refunds_rising',
    'warning',
    'refund_rate',
    r.refund_rate_delta_pp,
    c_refund_rise_pp::numeric,
    (r.refund_rate_delta_pp IS NOT NULL
     AND r.refund_rate_delta_pp > c_refund_rise_pp)::boolean

  UNION ALL

  -- ── 6. refunds_critical (absolute refund rate above 8% floor) ─────────────
  SELECT
    'refunds_critical',
    'critical',
    'refund_rate',
    ROUND(r.refund_rate_cur * 100, 2),
    c_refund_critical_floor::numeric,
    (r.refund_rate_cur IS NOT NULL
     AND r.refund_rate_cur * 100 > c_refund_critical_floor)::boolean

  UNION ALL

  -- ── 7. discounts_rising (discount dep pp delta above warning threshold) ────
  SELECT
    'discounts_rising',
    'warning',
    'discount_dependency',
    r.discount_dep_delta_pp,
    c_discount_rise_pp::numeric,
    (r.discount_dep_delta_pp IS NOT NULL
     AND r.discount_dep_delta_pp > c_discount_rise_pp)::boolean

  UNION ALL

  -- ── 8. discounts_critical (absolute discount dep above 15% floor) ──────────
  SELECT
    'discounts_critical',
    'critical',
    'discount_dependency',
    ROUND(r.discount_dep_cur * 100, 2),
    c_discount_critical_floor::numeric,
    (r.discount_dep_cur IS NOT NULL
     AND r.discount_dep_cur * 100 > c_discount_critical_floor)::boolean

  UNION ALL

  -- ── 9. overhead_outpacing_revenue ─────────────────────────────────────────
  -- Overhead is growing faster than revenue by more than the gap threshold.
  -- current_val = (overhead_delta_pct − gross_revenue_delta_pct).
  SELECT
    'overhead_outpacing_revenue',
    'warning',
    'fixed_overhead_actual',
    ROUND(COALESCE(r.overhead_delta_pct, 0) - COALESCE(r.gross_revenue_delta_pct, 0), 1),
    c_overhead_outpace_gap::numeric,
    (r.overhead_delta_pct IS NOT NULL
     AND r.gross_revenue_delta_pct IS NOT NULL
     AND (r.overhead_delta_pct - r.gross_revenue_delta_pct) > c_overhead_outpace_gap)::boolean

  UNION ALL

  -- ── 10. profit_deteriorating (op_profit delta worse than −10%) ─────────────
  SELECT
    'profit_deteriorating',
    'warning',
    'operating_profit',
    r.op_profit_delta_pct,
    c_profit_deteriorate_pct::numeric,
    (r.op_profit_delta_pct IS NOT NULL
     AND r.op_profit_delta_pct < c_profit_deteriorate_pct)::boolean

  UNION ALL

  -- ── 11. runway_low (cash runway below 1.0-month critical floor) ────────────
  SELECT
    'runway_low',
    'critical',
    'cash_runway_months',
    r.runway_cur,
    c_runway_low_months::numeric,
    (r.runway_cur IS NOT NULL
     AND r.runway_cur < c_runway_low_months)::boolean

  UNION ALL

  -- ── 12. runway_tightening (runway in the 1.0–2.0 month warning band) ───────
  SELECT
    'runway_tightening',
    'warning',
    'cash_runway_months',
    r.runway_cur,
    c_runway_tighten_months::numeric,
    (r.runway_cur IS NOT NULL
     AND r.runway_cur >= c_runway_low_months
     AND r.runway_cur < c_runway_tighten_months)::boolean

  UNION ALL

  -- ── 13. runway_declining (runway shrinking by > 0.25 months MoM) ──────────
  SELECT
    'runway_declining',
    'info',
    'cash_runway_months',
    r.runway_delta_months,
    c_runway_decline_months::numeric,
    (r.runway_delta_months IS NOT NULL
     AND r.runway_delta_months < c_runway_decline_months)::boolean;

END;
$function$
;
