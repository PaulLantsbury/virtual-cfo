-- =============================================================================
-- Migration 20260430000010 — VAT Refund Correction (Option C)
-- =============================================================================
--
-- PROBLEM
--   orders.refunds is inconsistently VAT-valued across financial_status values:
--     'refunded'           → VAT-inclusive  (gross × 1.20, e.g. £106.80)
--     'partially_refunded' → VAT-exclusive  (gross × 0.50, e.g. £44.50)
--   net_sales() formula (gross − discounts − refunds − tax) therefore:
--     • double-counts VAT on fully refunded orders  → net = −£35.60 (should be £0)
--     • over-deducts tax on partially refunded orders → understates net by £8.90/order
--   return_amount() reads orders.refunds, applying return_handling_rate to a
--   mixed-VAT base, overstating return handling cost for fully refunded orders.
--
-- SOLUTION (Option C from VAT audit plan, 2026-04-30)
--   Add two explicit decomposition columns to orders:
--     refund_ex_vat — ex-VAT value of goods returned (P&L numerator)
--     refund_tax    — VAT portion of the refund (reclaimed from HMRC)
--   orders.refunds is PRESERVED UNCHANGED (customer-facing cash amount; useful
--   for cash-flow reconciliation and matches Shopify's total_refunded field).
--
-- BACKFILL LOGIC
--   'refunded':           refund_ex_vat = gross_sales − discounts
--                         refund_tax    = tax          (all VAT refunded/reclaimed)
--   'partially_refunded': refund_ex_vat = refunds      (already ex-VAT in seed)
--                         refund_tax    = ROUND(refunds × 0.20, 2)
--                         NOTE: the 0.20 factor appears only in this one-time
--                         backfill for existing seed rows.  Future rows ingested
--                         from Shopify should populate refund_tax directly from
--                         refunds[].refund_line_items[].total_tax — no computation
--                         needed at ingestion time.
--   'paid' / 'cancelled': both columns stay at DEFAULT 0 (no UPDATE needed).
--
-- FUNCTIONS CHANGED
--   net_sales()     — formula updated; signature and attributes unchanged
--   return_amount() — reads refund_ex_vat instead of refunds; signature unchanged
--
-- FUNCTIONS NOT CHANGED
--   gross_revenue(), contribution_margin_pct(), operating_profit_monthly(),
--   cash_runway_months(), monthly_overhead_total(), average_order_value(),
--   discount_dependency(), refund_rate(), repeat_purchase_rate(), order_count()
--   All Phase 2b RPCs (month_on_month_delta, rolling_3m_averages, cfo_alerts)
--   inherit the correction through net_sales() and return_amount() automatically.
--
-- KNOWN REMAINING ITEM
--   average_order_value() contains the same inline formula as net_sales() was
--   using (gross_sales − discounts − refunds − tax).  It is NOT changed here
--   per scope constraints.  A follow-up migration should update its numerator to
--   (gross_sales − discounts − refund_ex_vat − (tax − refund_tax)) for
--   consistency.  Impact is small — fully refunded orders are excluded from the
--   denominator but not the numerator, so distortion is already limited.
--
-- IDEMPOTENCY
--   ADD COLUMN IF NOT EXISTS  — safe to re-run.
--   Backfill UPDATEs          — recompute to the same deterministic value; harmless.
--   CREATE OR REPLACE FUNCTION — always idempotent.
--
-- EXPECTED METRIC SHIFTS (dev store 10000000-0000-0000-0000-000000000001)
--   April net_sales:  £122,758 → ~£124,358  (+£1,600, +1.3%)
--   March net_sales:  £116,245 → ~£117,930  (+£1,685, +1.4%)
--   April return_amount (fully refunded portion): £2,843 → £2,369 (−£474)
--   April return_handling_cost: −£71  →  CM% marginally improves
--   Both months shift uniformly; MoM delta direction and all 4 CFO alert
--   triggers (margin_falling, refunds_rising, discounts_rising, runway_tightening)
--   remain unchanged.
-- =============================================================================

SET search_path TO public, pg_temp;

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Add columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refund_ex_vat NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_tax    NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orders.refund_ex_vat IS
  'Ex-VAT value of goods returned to the customer. '
  'Zero for paid and cancelled orders. '
  'For refunded orders: gross_sales − discounts (full product value reversed). '
  'For partially_refunded orders: the ex-VAT portion of the partial return. '
  'Shopify ingestion source: SUM(refunds[].refund_line_items[].subtotal). '
  'Used by net_sales() and return_amount() for economically correct P&L metrics. '
  'orders.refunds (VAT-inclusive cash total) is preserved separately for '
  'cash-flow reconciliation. Migration: 20260430000010.';

COMMENT ON COLUMN public.orders.refund_tax IS
  'VAT portion of the refund issued to the customer, reclaimed from HMRC. '
  'Zero for paid and cancelled orders. '
  'For refunded orders: equals orders.tax (all original VAT was refunded). '
  'For partially_refunded orders: VAT on the returned ex-VAT amount only. '
  'Shopify ingestion source: SUM(refunds[].refund_line_items[].total_tax). '
  'Used by net_sales() to deduct only the net VAT owed after refunds: '
  '(tax − refund_tax) represents VAT still payable to HMRC. '
  'Migration: 20260430000010.';

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Backfill: fully refunded orders
-- ─────────────────────────────────────────────────────────────────────────────
-- orders.refunds for these rows = gross × 1.20 (VAT-inclusive customer refund).
-- refund_ex_vat = gross_sales − discounts  (ex-VAT product value reversed)
-- refund_tax    = tax                      (all VAT refunded → all reclaimed)
--
-- Verification:
--   net_sales formula after fix:
--   gross − disc − refund_ex_vat − (tax − refund_tax)
--   = gross − disc − (gross−disc) − (tax − tax) = 0  ✓

UPDATE public.orders
SET
  refund_ex_vat = gross_sales - discounts,
  refund_tax    = tax
WHERE financial_status = 'refunded';

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — Backfill: partially refunded orders
-- ─────────────────────────────────────────────────────────────────────────────
-- orders.refunds for these rows = ex-VAT partial return amount (e.g. gross × 0.50).
-- refund_ex_vat = refunds          (same value — already ex-VAT)
-- refund_tax    = ROUND(refunds × 0.20, 2)
--                (VAT on the returned ex-VAT portion only)
--
-- The 0.20 factor is used only in this one-time backfill for seed rows.
-- Future Shopify-ingested rows: populate refund_tax from the API directly.
--
-- Verification (example: £89 order, 50% partial refund, no discount):
--   net_sales formula after fix:
--   89 − 0 − 44.50 − (17.80 − 8.90)
--   = 89 − 44.50 − 8.90 = £35.60  ✓  (was: 89 − 44.50 − 17.80 = £26.70)

UPDATE public.orders
SET
  refund_ex_vat = refunds,
  refund_tax    = ROUND(refunds * 0.20, 2)
WHERE financial_status = 'partially_refunded';

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4 — Update net_sales()
-- ─────────────────────────────────────────────────────────────────────────────
-- Formula change:
--   FROM: gross_sales − discounts − refunds − tax
--   TO:   gross_sales − discounts − refund_ex_vat − (tax − refund_tax)
--
-- The expression (tax − refund_tax) is the net VAT still owed to HMRC after
-- accounting for the VAT portion reclaimed on any refunds.
--
-- Paid orders (refund_ex_vat = 0, refund_tax = 0): result identical to before.
-- Fully refunded:    net = 0       (was −£35.60 per order)
-- Partially refunded: net = ex-VAT kept revenue  (was understated by £8.90/order)
--
-- Function attributes preserved exactly:
--   LANGUAGE sql | STABLE | SECURITY INVOKER (default) | SET search_path

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
  SELECT COALESCE(
    SUM(gross_sales - discounts - refund_ex_vat - (tax - refund_tax)),
    0
  )
  FROM   orders
  WHERE  store_id         = p_store_id
    AND  created_at::date BETWEEN p_date_from AND p_date_to
    AND  financial_status <> 'cancelled';
$$;

COMMENT ON FUNCTION public.net_sales(uuid, date, date) IS
  'Net Sales = gross_sales − discounts − refund_ex_vat − (tax − refund_tax), '
  'for non-cancelled orders. '
  'refund_ex_vat: ex-VAT product value returned (0 for paid orders). '
  '(tax − refund_tax): net VAT owed to HMRC after reclaiming refund VAT. '
  'Paid orders: formula equivalent to prior gross − disc − 0 − tax. '
  'Fully refunded orders: net = £0 (corrected from −£35.60 per order). '
  'Partially refunded orders: net = ex-VAT kept revenue '
  '(corrected from prior understatement of ~£8.90 per order at 20% VAT). '
  'orders.refunds (VAT-inclusive cash column) is no longer used here; '
  'it remains on the table for cash-flow reconciliation. '
  'Canonical metric: net_sales. Updated: migration 20260430000010.';

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5 — Update return_amount()
-- ─────────────────────────────────────────────────────────────────────────────
-- Changes the source column from orders.refunds to orders.refund_ex_vat.
--
-- orders.refunds was VAT-inclusive for 'refunded' rows (£106.80), causing
-- return_handling_cost = return_amount × 0.15 in contribution_margin_pct()
-- to be calculated on an inflated base (+£17.80 per fully refunded order).
--
-- orders.refund_ex_vat is consistently VAT-exclusive for all statuses:
--   'paid':               £0    (unchanged)
--   'partially_refunded': £44.50 (unchanged — refunds was already ex-VAT)
--   'refunded':           £89.00 (corrected — was £106.80)
--
-- This makes the return_handling_cost base consistent with the ex-VAT
-- net_sales base used throughout the P&L stack.
--
-- Function attributes preserved exactly:
--   LANGUAGE sql | STABLE | SECURITY INVOKER (default) | SET search_path

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
  SELECT COALESCE(SUM(refund_ex_vat), 0)
  FROM   orders
  WHERE  store_id         = p_store_id
    AND  created_at::date BETWEEN p_date_from AND p_date_to
    AND  financial_status <> 'cancelled';
$$;

COMMENT ON FUNCTION public.return_amount(uuid, date, date) IS
  'Total ex-VAT value of goods returned, attributed to the original order created_at date. '
  'Reads orders.refund_ex_vat (added migration 20260430000010). '
  'Previously read orders.refunds, which was VAT-inclusive for fully refunded orders '
  'and VAT-exclusive for partially refunded orders — an inconsistent base. '
  'orders.refunds is preserved unchanged for cash-flow reconciliation. '
  'Used as the goods-returned base in contribution_margin_pct() via '
  'return_handling_cost = return_amount() × return_handling_rate. '
  'Shopify ingestion: refund_ex_vat = SUM(refund_line_items[].subtotal). '
  'Updated: migration 20260430000010.';

COMMIT;
