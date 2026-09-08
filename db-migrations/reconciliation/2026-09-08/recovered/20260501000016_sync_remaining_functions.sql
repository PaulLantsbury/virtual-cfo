-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 20260501000016 — Fix remaining 2-function shadow/production diff
--
-- After migration 000015, a fresh shadow build still shows two functions
-- with single-character Unicode differences in comment lines:
--
--   cfo_alerts         : one U+2500 box char off in the revenue_declining comment
--   month_on_month_delta: one box char off in the "Load the delta row" comment
--
-- Both functions are replaced here with verbatim pg_get_functiondef text
-- fetched from production immediately before this migration was authored,
-- guaranteeing byte-identical agreement.
--
-- SAFE TO RE-RUN: CREATE OR REPLACE FUNCTION only — no DROP, no CASCADE.
-- NO DATA AFFECTED: pure function replacements.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── month_on_month_delta ────────────────────────────────────────
-- (production body: 3497 bytes, 106 U+2500 chars)

CREATE OR REPLACE FUNCTION public.month_on_month_delta(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS TABLE(gross_revenue_cur numeric, gross_revenue_prv numeric, gross_revenue_delta_pct numeric, net_sales_cur numeric, net_sales_prv numeric, net_sales_delta_pct numeric, aov_cur numeric, aov_prv numeric, aov_delta_pct numeric, refund_rate_cur numeric, refund_rate_prv numeric, refund_rate_delta_pp numeric, discount_dep_cur numeric, discount_dep_prv numeric, discount_dep_delta_pp numeric, rpr_cur numeric, rpr_prv numeric, rpr_delta_pp numeric, cm_pct_cur numeric, cm_pct_prv numeric, cm_pct_delta_pp numeric, op_profit_cur numeric, op_profit_prv numeric, op_profit_delta_pct numeric, overhead_cur numeric, overhead_prv numeric, overhead_delta_pct numeric, runway_cur numeric, runway_prv numeric, runway_delta_months numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row        record;
  v_prior_from date;
  v_prior_to   date;
  v_prior_cash numeric;
  v_prior_ovhd numeric;
  v_runway_cur numeric;
  v_runway_prv numeric;
BEGIN
  -- ── 1. Load the delta row from the view ────────────────────────────────────
  SELECT *
  INTO   v_row
  FROM   public.v_month_on_month
  WHERE  store_id     = p_store_id
    AND  period_start = p_date_from;

  IF NOT FOUND THEN
    RETURN; -- empty result set — caller receives zero rows
  END IF;

  -- ── 2. Current runway (live, always reads CURRENT_DATE snapshot) ───────────
  v_runway_cur := public.cash_runway_months(p_store_id);

  -- ── 3. Prior-month runway: cash at end of prior month / prior overhead ──────
  v_prior_from := date_trunc('month', p_date_from - interval '1 month')::date;
  v_prior_to   := (v_prior_from + interval '1 month')::date - 1;

  -- Most recent snapshot on or before the last day of the prior month
  SELECT COALESCE(SUM(s.cash_balance), 0)
  INTO   v_prior_cash
  FROM   public.cash_balance_snapshots s
  WHERE  s.store_id     = p_store_id
    AND  s.snapshot_date = (
           SELECT MAX(s2.snapshot_date)
           FROM   public.cash_balance_snapshots s2
           WHERE  s2.store_id     = p_store_id
             AND  s2.snapshot_date <= v_prior_to
         );

  v_prior_ovhd := public.monthly_overhead_total(
    p_store_id, v_prior_from, v_prior_to, 'actual'
  );

  v_runway_prv := v_prior_cash / NULLIF(v_prior_ovhd, 0);

  -- ── 4. Return the combined row ─────────────────────────────────────────────
  RETURN QUERY
  SELECT
    v_row.gross_revenue_cur,
    v_row.gross_revenue_prv,
    v_row.gross_revenue_delta_pct,
    v_row.net_sales_cur,
    v_row.net_sales_prv,
    v_row.net_sales_delta_pct,
    v_row.aov_cur,
    v_row.aov_prv,
    v_row.aov_delta_pct,
    v_row.refund_rate_cur,
    v_row.refund_rate_prv,
    v_row.refund_rate_delta_pp,
    v_row.discount_dep_cur,
    v_row.discount_dep_prv,
    v_row.discount_dep_delta_pp,
    v_row.rpr_cur,
    v_row.rpr_prv,
    v_row.rpr_delta_pp,
    v_row.cm_pct_cur,
    v_row.cm_pct_prv,
    v_row.cm_pct_delta_pp,
    v_row.op_profit_cur,
    v_row.op_profit_prv,
    v_row.op_profit_delta_pct,
    v_row.overhead_cur,
    v_row.overhead_prv,
    v_row.overhead_delta_pct,
    v_runway_cur,
    v_runway_prv,
    v_runway_cur - v_runway_prv;
END;
$function$
;

-- ── cfo_alerts ──────────────────────────────────────────────────
-- (production body: 6927 bytes, 328 U+2500 chars)

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

  -- ── 1. revenue_declining ───────────────────────────────────────────────────
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
