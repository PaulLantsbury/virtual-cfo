-- =============================================================================
-- Migration 20260430000007z — pre_views_functions
--
-- PURPOSE
-- -------
-- Some earlier migrations (seed files) abort mid-file due to FK violations,
-- which rolls back their transaction and removes any functions defined in
-- the same file.  This migration re-asserts every function that
-- v_monthly_metrics and v_month_on_month depend on, immediately before
-- those views are created in migration 20260430000008.
--
-- All statements use CREATE OR REPLACE so this is idempotent on production.
-- No seed data, no views — functions only.
-- =============================================================================

-- ── gross_revenue ─────────────────────────────────────────────────────────────
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

-- ── net_sales ─────────────────────────────────────────────────────────────────
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

-- ── average_order_value ───────────────────────────────────────────────────────
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

-- ── refund_rate ───────────────────────────────────────────────────────────────
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

-- ── discount_dependency ───────────────────────────────────────────────────────
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

-- ── repeat_purchase_rate ──────────────────────────────────────────────────────
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

-- ── monthly_overhead_total ────────────────────────────────────────────────────
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

-- ── contribution_margin_pct ───────────────────────────────────────────────────
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

-- ── operating_profit_monthly ──────────────────────────────────────────────────
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
