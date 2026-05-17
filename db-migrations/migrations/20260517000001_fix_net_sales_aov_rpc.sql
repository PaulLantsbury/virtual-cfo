-- =============================================================================
-- Migration 20260517000001 — fix_net_sales_aov_rpc
--
-- PURPOSE
-- -------
-- Replaces only the two dashboard RPCs currently producing zero/unavailable
-- values because their previous definitions referenced refund_ex_vat/refund_tax.
-- The current cloud orders schema stores the supported refund value in
-- public.orders.refunds and tax in public.orders.tax.
--
-- SCOPE
-- -----
--   • net_sales(p_store_id uuid, p_date_from date, p_date_to date)
--   • average_order_value(p_store_id uuid, p_date_from date, p_date_to date)
--
-- No dashboard/UI changes. No unrelated RPC changes.
-- =============================================================================

-- ── net_sales ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.net_sales(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE(
    SUM(
      COALESCE(o.gross_sales, 0)
      - COALESCE(o.discounts, 0)
      - COALESCE(o.refunds, 0)
      - COALESCE(o.tax, 0)
    ),
    0
  )
  FROM public.orders o
  WHERE o.store_id = p_store_id
    AND o.created_at::date BETWEEN p_date_from AND p_date_to
    AND o.financial_status <> 'cancelled';
$$;

-- ── average_order_value ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.average_order_value(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE(
    SUM(
      COALESCE(o.gross_sales, 0)
      - COALESCE(o.discounts, 0)
      - COALESCE(o.refunds, 0)
      - COALESCE(o.tax, 0)
    )
    / NULLIF(
        COUNT(*) FILTER (WHERE o.financial_status <> 'refunded'),
        0
      ),
    0
  )
  FROM public.orders o
  WHERE o.store_id = p_store_id
    AND o.created_at::date BETWEEN p_date_from AND p_date_to
    AND o.financial_status <> 'cancelled';
$$;
