-- =============================================================================
-- Virtual CFO — Phase 1 Canonical Metric Functions
-- =============================================================================
--
-- Nine parameterised SQL functions covering every metric in the Shopify
-- Phase 1 scope.  All functions are:
--   • STABLE  — read-only, safe for query inlining and caching
--   • SECURITY INVOKER (default) — runs with the caller's row-level permissions
--   • SEARCH_PATH locked to public, pg_temp — mitigates search-path injection
--
-- PARAMETER CONVENTION
--   p_store_id  uuid  — store to aggregate (matches orders.store_id)
--   p_date_from date  — first day of the period (inclusive)
--   p_date_to   date  — last day of the period  (inclusive)
--
--   Date comparison: created_at::date BETWEEN p_date_from AND p_date_to
--   Timezone note : created_at::date truncates using the SESSION timezone
--                   (UTC by default in Supabase).  UK merchants should set
--                   "timezone = 'Europe/London'" in supabase config or at
--                   connection time before calling these functions.
--
-- BASE FILTER (applied in every function unless noted otherwise)
--   financial_status <> 'cancelled'
--   Cancelled orders represent voided intent, not recorded revenue.
--
-- CANCELLATION vs REFUND DISTINCTION
--   cancelled   → excluded from ALL aggregates and all counts
--   refunded    → included in revenue / discount / refund aggregates
--                 (contributes negative net), but EXCLUDED from order_count
--                 and therefore from average_order_value denominator
--
-- REFUND ATTRIBUTION
--   Refunds are attributed to the original order created_at date, NOT to the
--   refund event created_at.  This is achieved by reading orders.refunds
--   (a pre-aggregated sum on the order row) filtered by orders.created_at.
--
-- FORMULA DISCREPANCIES vs CURRENT FRONTEND (documented as assumptions)
--   average_order_value : SQL uses net_sales / order_count
--                         Frontend (commerceMetrics.ts) uses total_sales / count(*)
--                         → SQL version is canonical per user requirements
--   discount_dependency : SQL uses value-based SUM(discounts)/SUM(gross_sales)
--                         Data dictionary §3.5 canonical is count-based
--                         (orders with a code / total orders)
--                         → SQL version is canonical per user requirements
--   repeat_purchase_rate: SQL defines "returning" as first_order_at < period_start
--                         Frontend aggregates a single un-filtered dataset
--                         (no date-range awareness)
--                         → SQL version is correct for time-windowed analysis
-- =============================================================================

SET search_path TO public, pg_temp;

-- =============================================================================
-- 1. gross_revenue
--    SUM(gross_sales) for non-cancelled orders in the period.
--    Canonical metric: "monthly_revenue" (tile id: mr)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.gross_revenue(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(gross_sales), 0)
  FROM   orders
  WHERE  store_id         = p_store_id
    AND  created_at::date BETWEEN p_date_from AND p_date_to
    AND  financial_status <> 'cancelled';
$$;

COMMENT ON FUNCTION public.gross_revenue(uuid, date, date) IS
  'Gross revenue: SUM(gross_sales) excluding cancelled orders.
   Partial and full refunds are included (refunds appear separately in return_amount).
   Canonical metric: monthly_revenue.';

-- =============================================================================
-- 2. discount_cost
--    SUM(discounts) for non-cancelled orders in the period.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.discount_cost(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(discounts), 0)
  FROM   orders
  WHERE  store_id         = p_store_id
    AND  created_at::date BETWEEN p_date_from AND p_date_to
    AND  financial_status <> 'cancelled';
$$;

COMMENT ON FUNCTION public.discount_cost(uuid, date, date) IS
  'Total discount value applied to non-cancelled orders in the period.
   Value-based (sum of discount amounts), not count-based.';

-- =============================================================================
-- 3. return_amount
--    SUM(refunds) attributed to the original order date, for non-cancelled
--    orders in the period.  Does NOT fan out to the refunds table.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.return_amount(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(refunds), 0)
  FROM   orders
  WHERE  store_id         = p_store_id
    AND  created_at::date BETWEEN p_date_from AND p_date_to
    AND  financial_status <> 'cancelled';
$$;

COMMENT ON FUNCTION public.return_amount(uuid, date, date) IS
  'Total refund value attributed to the original order created_at date.
   Reads orders.refunds (pre-aggregated), not the refunds event table.
   This means a refund issued in month 2 for a month-1 order falls in month 1.';

-- =============================================================================
-- 4. net_sales
--    Gross Sales − Discounts − Refunds − Tax for non-cancelled orders.
--    Canonical metric: "net_sales" (tile id: ns)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.net_sales(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(gross_sales - discounts - refunds - tax), 0)
  FROM   orders
  WHERE  store_id         = p_store_id
    AND  created_at::date BETWEEN p_date_from AND p_date_to
    AND  financial_status <> 'cancelled';
$$;

COMMENT ON FUNCTION public.net_sales(uuid, date, date) IS
  'Net Sales = gross_sales - discounts - refunds - tax, for non-cancelled orders.
   Fully refunded orders contribute negative net (gross - 0 - total_sales - tax < 0).
   Canonical metric: net_sales.';

-- =============================================================================
-- 5. order_count
--    COUNT of orders excluding BOTH cancelled AND fully refunded orders.
--    Used as the denominator for average_order_value.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.order_count(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)
  FROM   orders
  WHERE  store_id         = p_store_id
    AND  created_at::date BETWEEN p_date_from AND p_date_to
    AND  financial_status NOT IN ('cancelled', 'refunded');
$$;

COMMENT ON FUNCTION public.order_count(uuid, date, date) IS
  'Qualifying order count: excludes cancelled (voided) and fully refunded orders.
   partially_refunded and paid orders both count.
   Used as the AOV denominator.';

-- =============================================================================
-- 6. average_order_value
--    net_sales / order_count.  Returns 0 when order_count = 0.
--    Canonical metric: "average_order_value" (tile id: aov)
--
--    NOTE: the current frontend (commerceMetrics.ts) computes
--    total_sales / count(*) — a different formula.  This function implements
--    net_sales / order_count per the canonical requirement.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.average_order_value(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  -- Single-pass: compute net_sales numerator and order_count denominator
  -- from the same base scan, using conditional aggregation.
  -- Base: exclude cancelled.
  -- Denominator: additionally exclude fully refunded.
  SELECT COALESCE(
    SUM(gross_sales - discounts - refunds - tax)
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
$$;

COMMENT ON FUNCTION public.average_order_value(uuid, date, date) IS
  'AOV = net_sales / order_count (qualifying orders only).
   Numerator  : SUM(gross_sales - discounts - refunds - tax) excl. cancelled
   Denominator: COUNT(*) excl. cancelled AND refunded
   Returns 0 when no qualifying orders exist.
   Canonical metric: average_order_value.';

-- =============================================================================
-- 7. repeat_purchase_rate
--    Proportion of customers (in the period) who had placed their first-ever
--    order BEFORE the period start — i.e. genuinely returning customers.
--    Guest checkouts (customer_id IS NULL) are excluded from both sides.
--
--    Formula:
--      numerator   = distinct customers in period with first_order_at < p_date_from
--      denominator = distinct customers in period (any first_order_at)
--      rate        = numerator / NULLIF(denominator, 0)
--
--    Canonical metric: "repeat_purchase_rate" (tile id: rpr)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.repeat_purchase_rate(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH period_customers AS (
    -- One row per distinct registered customer who placed a non-cancelled
    -- order in the period. Join to customers for their all-time first_order_at.
    SELECT
      o.customer_id,
      c.first_order_at
    FROM   orders     o
    JOIN   customers  c
           ON  c.id         = o.customer_id
           AND c.store_id   = p_store_id
    WHERE  o.store_id         = p_store_id
      AND  o.created_at::date BETWEEN p_date_from AND p_date_to
      AND  o.financial_status <> 'cancelled'
      AND  o.customer_id IS NOT NULL        -- exclude guest checkouts
    GROUP  BY o.customer_id, c.first_order_at
  )
  SELECT COALESCE(
    COUNT(*) FILTER (WHERE first_order_at < p_date_from::timestamptz)::numeric
    / NULLIF(COUNT(*)::numeric, 0),
    0
  )
  FROM period_customers;
$$;

COMMENT ON FUNCTION public.repeat_purchase_rate(uuid, date, date) IS
  'Repeat Purchase Rate = returning customers / all customers in period.
   "Returning" = first_order_at (all-time) is strictly before p_date_from.
   Guest checkouts (customer_id IS NULL) excluded from both numerator and denominator.
   Returns a ratio in [0, 1].  Multiply by 100 for percentage display.
   Canonical metric: repeat_purchase_rate.';

-- =============================================================================
-- 8. discount_dependency
--    SUM(discounts) / SUM(gross_sales) for non-cancelled orders.
--    Returns 0 when gross_sales = 0.  Returns a ratio in [0, 1].
--    Canonical metric: "discount_dependency_ratio" (tile id: dd)
--
--    NOTE: data-dictionary-v1.md §3.5 defines the canonical as count-based
--    (orders with a code / total orders).  This function implements the
--    value-based formula per explicit user requirements.  The discrepancy is
--    documented here and in the reconciliation report.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.discount_dependency(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    SUM(discounts) / NULLIF(SUM(gross_sales), 0),
    0
  )
  FROM   orders
  WHERE  store_id         = p_store_id
    AND  created_at::date BETWEEN p_date_from AND p_date_to
    AND  financial_status <> 'cancelled';
$$;

COMMENT ON FUNCTION public.discount_dependency(uuid, date, date) IS
  'Discount Dependency Ratio = SUM(discounts) / SUM(gross_sales) (value-based).
   Excludes cancelled orders.  Returns ratio in [0, 1].
   Formula note: data-dictionary-v1.md canonical is count-based (orders with code /
   total orders); this function uses value-based per explicit requirements.
   Canonical metric: discount_dependency_ratio.';

-- =============================================================================
-- 9. refund_rate
--    SUM(refunds) / SUM(gross_sales) for non-cancelled orders.
--    Returns 0 when gross_sales = 0.  Returns a ratio in [0, 1].
--    Canonical metric: "refund_rate_pct" (tile id: rr)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.refund_rate(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    SUM(refunds) / NULLIF(SUM(gross_sales), 0),
    0
  )
  FROM   orders
  WHERE  store_id         = p_store_id
    AND  created_at::date BETWEEN p_date_from AND p_date_to
    AND  financial_status <> 'cancelled';
$$;

COMMENT ON FUNCTION public.refund_rate(uuid, date, date) IS
  'Refund Rate = SUM(refunds) / SUM(gross_sales) (value-based).
   Excludes cancelled orders.  Returns ratio in [0, 1].
   Refunds attributed to original order created_at, not refund event date.
   Canonical metric: refund_rate_pct.';
