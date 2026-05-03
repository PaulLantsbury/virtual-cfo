-- =============================================================================
-- Migration 20260430000011 — AOV VAT/Refund Formula Correction
-- =============================================================================
--
-- CONTEXT
--   Migration 20260430000010 corrected net_sales() and return_amount() to use
--   the refund_ex_vat and refund_tax columns added to the orders table, fixing
--   the VAT double-count on fully refunded orders and the over-deduction of tax
--   on partially refunded orders.
--
--   average_order_value() was intentionally left out of that migration (scope
--   constraint).  It still uses the old inline formula:
--     SUM(gross_sales - discounts - refunds - tax)
--   in its numerator, causing AOV to diverge from the corrected net_sales().
--
-- PROBLEM
--   AOV is defined as net_sales / order_count.
--   The numerator must use the same formula as net_sales() to stay consistent.
--   Currently:
--     old numerator (paid orders):              correct — refunds = 0, no impact
--     old numerator (partially_refunded orders): understates by ~£8.90 per order
--     old numerator (refunded orders):           overstates negative by −£35.60
--       but refunded orders are EXCLUDED from the denominator, so they drag the
--       numerator down without reducing the count — inflating the apparent AOV
--       downward.
--
-- SINGLE-PASS DESIGN PRESERVED
--   The function uses a single table scan with conditional aggregation
--   (COUNT(*) FILTER) rather than calling net_sales() and order_count()
--   separately.  This is intentional for query efficiency and is preserved.
--   Only the SUM expression changes.
--
-- FORMULA CHANGE
--   Numerator:
--     FROM: SUM(gross_sales - discounts - refunds - tax)
--     TO:   SUM(gross_sales - discounts - refund_ex_vat - (tax - refund_tax))
--
--   Denominator (unchanged):
--     COUNT(*) FILTER (WHERE financial_status <> 'refunded')
--     Excludes cancelled (base WHERE clause) and fully refunded (FILTER).
--
-- ATTRIBUTES PRESERVED EXACTLY
--   LANGUAGE sql | STABLE | SECURITY INVOKER (default) | SET search_path
--   Signature: average_order_value(uuid, date, date) → numeric
--   No table changes. No frontend changes.
--
-- IDEMPOTENCY
--   CREATE OR REPLACE FUNCTION — always idempotent.
--
-- EXPECTED AOV SHIFT
--   April: refunded orders (27) had negative numerator contribution (−£947.60
--          total).  Corrected to £0.  Partially refunded (72 orders) gain
--          +£647.60.  Denominator (1,985 qualifying orders) is unchanged.
--          April AOV: ~£61.93 → ~£62.86  (+£0.93, +1.5%)
--   March: similar proportional improvement.
--   The AOV now matches net_sales() / order_count() exactly.
-- =============================================================================

SET search_path TO public, pg_temp;

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
  -- Base filter : exclude cancelled orders.
  -- Denominator : additionally exclude fully refunded orders.
  --
  -- Numerator uses refund_ex_vat and refund_tax (added migration 000010)
  -- instead of the raw refunds column, matching the corrected net_sales()
  -- formula.  For paid orders (refund_ex_vat = 0, refund_tax = 0) the
  -- result is identical to the previous formula.
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
$$;

COMMENT ON FUNCTION public.average_order_value(uuid, date, date) IS
  'AOV = net_sales / order_count (qualifying orders only). '
  'Numerator  : SUM(gross_sales - discounts - refund_ex_vat - (tax - refund_tax)) excl. cancelled. '
  'Denominator: COUNT(*) excl. cancelled AND fully refunded. '
  'Uses refund_ex_vat and refund_tax (migration 000010) so numerator is '
  'consistent with the corrected net_sales() formula — no VAT double-count '
  'on fully refunded orders, correct partial-refund tax adjustment. '
  'For paid orders the formula is equivalent to the pre-000010 expression. '
  'Returns 0 when no qualifying orders exist. '
  'Canonical metric: average_order_value. Updated: migration 20260430000011.';
