-- =============================================================================
-- Migration 20260430000012 — Add vat_rate to store_cost_assumptions
-- =============================================================================
--
-- CONTEXT
--   All seed migrations (000004–000011) hard-coded a 0.20 VAT rate for
--   computing orders.tax and orders.refund_tax.  Those stored amounts are
--   correct for the dev store, but the rate itself was never persisted.
--   This migration introduces vat_rate as a first-class, time-versioned column
--   on store_cost_assumptions so that:
--
--     a) Future ingestion pipelines can read the correct rate per store/period
--        from v_current_cost_assumptions rather than hard-coding 0.20.
--
--     b) Phase 3 marketing/CAC work can use vat_rate to normalise VAT-inclusive
--        ad spend (Google Ads, Meta, TikTok invoices arrive as gross-of-VAT
--        figures).  Without stripping VAT, CAC is overstated by 20% and ROAS
--        is proportionally understated.
--
--     c) The system can record VAT rate changes over time (e.g. a temporary
--        rate reduction) by inserting a new store_cost_assumptions row with the
--        new effective_from date, exactly as payment_fee_rate is versioned.
--
-- SEMANTIC CONTRACTS (documentation — no logic changes)
--
--   orders.tax
--     VAT charged to the customer on the original order at the point of sale.
--     Sourced from Shopify API: total_tax on the order object.
--     Never modified after the order is placed, even when refunds are issued.
--     Equals (gross_sales − discounts) × vat_rate at time of order (approximately
--     — exact value comes from Shopify; the rate is provided here for ingestion
--     pipeline cross-checks and future backfill operations).
--
--   orders.refund_tax
--     VAT portion of the refund issued to the customer, reclaimed from HMRC.
--     Zero for paid and cancelled orders.
--     For fully refunded orders: equals orders.tax.
--     For partially refunded orders: VAT on the returned portion only.
--     Sourced from Shopify API: SUM(refunds[].refund_line_items[].total_tax).
--     Added in migration 20260430000010.
--
--   net_sales()
--     Formula: SUM(gross_sales − discounts − refund_ex_vat − (tax − refund_tax))
--     VAT-correct and refund-correct as of migrations 000010 (refund columns)
--     and 000011 (AOV alignment).  Fully refunded orders contribute £0.
--     Partially refunded orders deduct only the VAT on the kept portion.
--     No changes to this function in this migration.
--
--   contribution_margin_pct(), operating_profit_monthly(), average_order_value()
--     All inherit the corrected net_sales() formula.
--     None of these functions use vat_rate in their computation — they operate
--     on stored amounts (orders.tax, orders.refund_tax, orders.refund_ex_vat).
--     No changes to any RPC function in this migration.
--
--   store_cost_assumptions.vat_rate (NEW)
--     Effective VAT rate for this store, versioned via effective_from.
--     Used by ingestion pipelines at the time an order or refund is processed.
--     Example Phase 3 usage:
--       ex_vat_ad_spend = gross_ad_spend / (1 + vat_rate)
--     Read via v_current_cost_assumptions — same pattern as payment_fee_rate.
--
-- SCOPE
--   1. ALTER TABLE store_cost_assumptions — add vat_rate column.
--   2. CREATE OR REPLACE VIEW v_current_cost_assumptions — expose vat_rate.
--   3. COMMENT updates on column and view.
--   No RPC functions modified.
--   No frontend code modified.
--   No seed data modified.
--   vat_rate is NOT added to stores or store_settings.
--
-- IDEMPOTENCY
--   ADD COLUMN IF NOT EXISTS — safe to re-run.
--   CREATE OR REPLACE VIEW — always idempotent.
--
-- BACKWARD COMPATIBILITY
--   PostgreSQL 12+ implements NOT NULL DEFAULT via a "fast default":
--   existing rows immediately return 0.20 with no table rewrite and no
--   explicit UPDATE required.  Both existing dev store rows (effective_from
--   2025-01-01 and 2026-01-01) will expose vat_rate = 0.20.
--   No existing query results change.  v_current_cost_assumptions gains one
--   new column; all existing column names and positions are preserved.
-- =============================================================================

SET search_path TO public, pg_temp;

-- ── 1. Add vat_rate column ────────────────────────────────────────────────────

ALTER TABLE public.store_cost_assumptions
  ADD COLUMN IF NOT EXISTS vat_rate NUMERIC NOT NULL DEFAULT 0.20;

COMMENT ON COLUMN public.store_cost_assumptions.vat_rate IS
  'Effective VAT rate for this store, expressed as a decimal (0.20 = 20%). '
  'Versioned via effective_from — insert a new row to record a rate change. '
  'Default 0.20 reflects UK standard rate. '
  'Used by ingestion pipelines to normalise VAT-inclusive inputs (e.g. ad spend). '
  'NOT used by current RPC functions, which read stored tax amounts directly.';

-- ── 2. Rebuild view to expose vat_rate ───────────────────────────────────────
-- Exact same DISTINCT ON / ORDER BY / WHERE logic as migration 000003.
-- vat_rate appended last — CREATE OR REPLACE VIEW requires new columns at the
-- end of the SELECT list; inserting into an existing position is not permitted.

CREATE OR REPLACE VIEW public.v_current_cost_assumptions AS
SELECT DISTINCT ON (store_id)
  id,
  store_id,
  payment_fee_rate,
  fulfilment_cost_per_order,
  packaging_cost_per_order,
  return_handling_rate,
  effective_from,
  created_at,
  vat_rate          -- appended last: CREATE OR REPLACE VIEW requires new columns at end
FROM public.store_cost_assumptions
WHERE effective_from <= CURRENT_DATE
ORDER BY store_id, effective_from DESC;

COMMENT ON VIEW public.v_current_cost_assumptions IS
  'Current (most recent effective_from ≤ today) cost assumption row per store. '
  'Used by contribution_margin_pct() and other cost-based metrics. '
  'Columns: payment_fee_rate, fulfilment_cost_per_order, packaging_cost_per_order, '
  'return_handling_rate, vat_rate (added migration 000012), effective_from. '
  'Phase 3 ingestion pipelines should read vat_rate from this view to normalise '
  'VAT-inclusive inputs such as ad spend: ex_vat = gross / (1 + vat_rate).';
