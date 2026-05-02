-- =============================================================================
-- Migration 000018 — shadow_metric_functions
--
-- PURPOSE
-- -------
-- The publish-validation shadow DB applies all local migrations sequentially.
-- Several earlier migrations abort mid-file (FK seed violations) before they
-- can register the metric functions that v_monthly_metrics depends on.  The
-- diff tool then generates "CREATE VIEW v_monthly_metrics" referencing those
-- missing functions, producing:
--
--   function gross_revenue(uuid, date, date) does not exist
--
-- FIX: re-assert every function v_monthly_metrics calls (CREATE OR REPLACE,
-- byte-identical to production), then re-assert both views.  This is a no-op
-- on production because all objects already exist with identical definitions.
--
-- DEPENDENCY ORDER inside this file
-- -----------------------------------
--  1. Leaf functions (gross_revenue, net_sales, average_order_value,
--     refund_rate, discount_dependency, repeat_purchase_rate,
--     monthly_overhead_total)
--  2. contribution_margin_pct  (calls gross_revenue)
--  3. operating_profit_monthly (calls contribution_margin_pct, net_sales,
--                               monthly_overhead_total)
--  4. v_monthly_metrics        (calls all of the above)
--  5. v_month_on_month         (joins v_monthly_metrics to itself)
-- =============================================================================

-- ── 1a. gross_revenue ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gross_revenue(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(SUM(gross_sales), 0) FROM public.orders
  WHERE store_id = p_store_id AND created_at::date BETWEEN p_date_from AND p_date_to
    AND financial_status <> 'cancelled';
$function$;

-- ── 1b. net_sales ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.net_sales(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(
    SUM(gross_sales - discounts - refund_ex_vat - (tax - refund_tax)),
    0
  )
  FROM   orders
  WHERE  store_id         = p_store_id
    AND  created_at::date BETWEEN p_date_from AND p_date_to
    AND  financial_status <> 'cancelled';
$function$;

-- ── 1c. average_order_value ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.average_order_value(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(
    SUM(gross_sales - discounts - refund_ex_vat - (tax - refund_tax))
    / NULLIF(
        COUNT(*) FILTER (WHERE financial_status <> 'refunded'),
        0
      ),
    0
  )
  FROM   orders
  WHERE  store_id         = p_store_id
    AND  created_at::date BETWEEN p_date_from AND p_date_to
    AND  financial_status <> 'cancelled';
$function$;

-- ── 1d. refund_rate ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refund_rate(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(SUM(refunds) / NULLIF(SUM(gross_sales), 0), 0) FROM public.orders
  WHERE store_id = p_store_id AND created_at::date BETWEEN p_date_from AND p_date_to
    AND financial_status <> 'cancelled';
$function$;

-- ── 1e. discount_dependency ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.discount_dependency(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(SUM(discounts) / NULLIF(SUM(gross_sales), 0), 0) FROM public.orders
  WHERE store_id = p_store_id AND created_at::date BETWEEN p_date_from AND p_date_to
    AND financial_status <> 'cancelled';
$function$;

-- ── 1f. repeat_purchase_rate ─────────────────────────────────────────────────
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
$function$;

-- ── 1g. monthly_overhead_total ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.monthly_overhead_total(p_store_id uuid, p_date_from date, p_date_to date, p_entry_type text DEFAULT 'actual'::text)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_total numeric;
BEGIN
  SELECT COALESCE(SUM(oe.amount), 0)
  INTO   v_total
  FROM   public.overhead_entries    oe
  JOIN   public.overhead_categories oc
    ON   oc.id        = oe.category_id
   AND   oc.is_active = true
  WHERE  oe.store_id     = p_store_id
    AND  oe.period_start >= p_date_from
    AND  oe.period_end   <= p_date_to
    AND  oe.entry_type   = p_entry_type;

  RETURN v_total;
END;
$function$;

-- ── 2. contribution_margin_pct ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contribution_margin_pct(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_vat_rate        numeric;
  v_cogs_pct        numeric;
  v_payment_fee_pct numeric;
  v_return_rate     numeric;
  v_gross           numeric;
BEGIN
  SELECT vat_rate, cogs_pct, payment_fee_pct, return_rate
  INTO   v_vat_rate, v_cogs_pct, v_payment_fee_pct, v_return_rate
  FROM   public.store_cost_assumptions
  WHERE  store_id = p_store_id
  LIMIT  1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  v_gross := public.gross_revenue(p_store_id, p_date_from, p_date_to);
  IF v_gross = 0 THEN RETURN 0; END IF;

  RETURN ROUND(
    1
    - v_vat_rate
    - v_cogs_pct
    - v_payment_fee_pct
    - v_return_rate,
    4
  );
END;
$function$;

-- ── 3. operating_profit_monthly ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.operating_profit_monthly(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cm_pct      numeric;
  v_net_sales   numeric;
  v_fixed_costs numeric;
BEGIN
  v_cm_pct := public.contribution_margin_pct(p_store_id, p_date_from, p_date_to);

  IF v_cm_pct IS NULL THEN
    RETURN NULL;
  END IF;

  v_net_sales := public.net_sales(p_store_id, p_date_from, p_date_to);

  v_fixed_costs := public.monthly_overhead_total(
    p_store_id,
    p_date_from,
    p_date_to,
    'actual'
  );

  RETURN (v_net_sales * v_cm_pct) - v_fixed_costs;
END;
$function$;

-- ── 4. v_monthly_metrics ─────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_monthly_metrics AS
WITH months AS (
  SELECT generate_series(
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

-- ── 5. v_month_on_month ──────────────────────────────────────────────────────
-- Column names and ROUND precision match production exactly.
CREATE OR REPLACE VIEW public.v_month_on_month AS
SELECT
  cur.store_id,
  cur.period_start,
  cur.period_end,
  cur.gross_revenue                                                        AS gross_revenue_cur,
  cur.net_sales                                                            AS net_sales_cur,
  cur.average_order_value                                                  AS aov_cur,
  cur.refund_rate                                                          AS refund_rate_cur,
  cur.discount_dependency                                                  AS discount_dep_cur,
  cur.repeat_purchase_rate                                                 AS rpr_cur,
  cur.contribution_margin_pct                                              AS cm_pct_cur,
  cur.operating_profit                                                     AS op_profit_cur,
  cur.fixed_overhead_actual                                                AS overhead_cur,
  prv.gross_revenue                                                        AS gross_revenue_prv,
  prv.net_sales                                                            AS net_sales_prv,
  prv.average_order_value                                                  AS aov_prv,
  prv.refund_rate                                                          AS refund_rate_prv,
  prv.discount_dependency                                                  AS discount_dep_prv,
  prv.repeat_purchase_rate                                                 AS rpr_prv,
  prv.contribution_margin_pct                                              AS cm_pct_prv,
  prv.operating_profit                                                     AS op_profit_prv,
  prv.fixed_overhead_actual                                                AS overhead_prv,
  round((cur.gross_revenue - prv.gross_revenue)
    / NULLIF(abs(prv.gross_revenue), 0::numeric) * 100::numeric, 1)       AS gross_revenue_delta_pct,
  round((cur.net_sales - prv.net_sales)
    / NULLIF(abs(prv.net_sales), 0::numeric) * 100::numeric, 1)           AS net_sales_delta_pct,
  round((cur.average_order_value - prv.average_order_value)
    / NULLIF(abs(prv.average_order_value), 0::numeric) * 100::numeric, 1) AS aov_delta_pct,
  round((cur.operating_profit - prv.operating_profit)
    / NULLIF(abs(prv.operating_profit), 0::numeric) * 100::numeric, 1)    AS op_profit_delta_pct,
  round((cur.fixed_overhead_actual - prv.fixed_overhead_actual)
    / NULLIF(abs(prv.fixed_overhead_actual), 0::numeric) * 100::numeric, 1) AS overhead_delta_pct,
  round((cur.refund_rate - prv.refund_rate) * 100::numeric, 2)            AS refund_rate_delta_pp,
  round((cur.discount_dependency - prv.discount_dependency) * 100::numeric, 2) AS discount_dep_delta_pp,
  round((cur.repeat_purchase_rate - prv.repeat_purchase_rate) * 100::numeric, 1) AS rpr_delta_pp,
  round((cur.contribution_margin_pct - prv.contribution_margin_pct) * 100::numeric, 2) AS cm_pct_delta_pp
FROM   public.v_monthly_metrics cur
LEFT JOIN public.v_monthly_metrics prv
  ON   prv.store_id    = cur.store_id
 AND   prv.period_start = (cur.period_start - interval '1 mon')::date;
