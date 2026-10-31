-- =============================================================================
-- Migration 20260430000000 — overhead_categories
--
-- Creates the overhead_categories table: the "chart of accounts" for fixed
-- overheads.  One row per cost category per store.  Vendor-neutral — supports
-- manual entry, Xero nominal code mapping, and QuickBooks account IDs via the
-- external_account_code column.
--
-- Phase 2a of 6.  No Phase 1 tables are altered.
--
-- Design distinction:
--   store_cost_assumptions  = VARIABLE cost RATES applied per order  (Phase 1)
--   overhead_categories     = taxonomy of FIXED cost categories       (Phase 2)
--   overhead_entries        = absolute FIXED cost amounts per period  (Phase 2)
-- =============================================================================

SET search_path TO public, pg_temp;

-- -----------------------------------------------------------------------------
-- 1. overhead_categories
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.overhead_categories (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              uuid          NOT NULL
                                      REFERENCES stores(id) ON DELETE CASCADE,
  name                  text          NOT NULL,
  category_type         text          NOT NULL DEFAULT 'other',
  is_fixed              boolean       NOT NULL DEFAULT true,
  external_account_code text,
  sort_order            int           NOT NULL DEFAULT 0,
  is_active             boolean       NOT NULL DEFAULT true,
  created_at            timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT uq_overhead_categories_store_name
    UNIQUE (store_id, name),

  CONSTRAINT chk_overhead_categories_type CHECK (
    category_type IN (
      'payroll',
      'facilities',
      'technology',
      'marketing_fixed',
      'logistics_fixed',
      'finance',
      'other'
    )
  )
);

-- -----------------------------------------------------------------------------
-- 2. Comments
-- -----------------------------------------------------------------------------

COMMENT ON TABLE public.overhead_categories IS
  'Taxonomy of fixed overhead cost categories per store.  One row per category.
   Vendor-neutral: source integration is recorded on overhead_entries.source,
   not here.  Contrast with store_cost_assumptions (variable rate per order).';

COMMENT ON COLUMN public.overhead_categories.category_type IS
  'Coarse classification used for grouping in dashboards and alerts.
   Allowed values: payroll, facilities, technology, marketing_fixed,
   logistics_fixed, finance, other.';

COMMENT ON COLUMN public.overhead_categories.is_fixed IS
  'true = pure fixed overhead regardless of order volume.
   false = semi-variable (e.g. packaging beyond minimum contract tier).
   Phase 2 seeds all categories as fixed.';

COMMENT ON COLUMN public.overhead_categories.external_account_code IS
  'Optional vendor-neutral integration code.  Xero nominal code, QuickBooks
   account ID, or CSV column header.  No vendor-specific prefix — the source
   integration type is carried on overhead_entries.source.  NULL for
   manual-only categories.';

COMMENT ON COLUMN public.overhead_categories.is_active IS
  'Soft-delete flag.  Inactive categories are hidden in the UI but their
   historical overhead_entries rows are retained for reporting.
   overhead_entries has ON DELETE RESTRICT to prevent hard deletion while
   entries exist.';
