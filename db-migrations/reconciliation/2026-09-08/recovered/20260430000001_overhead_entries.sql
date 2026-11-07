-- =============================================================================
-- Migration 20260430000001 — overhead_entries
--
-- Creates the overhead_entries table: monthly fixed overhead amounts per
-- category, per period, per entry type.  A single table handles both budget
-- and actual tracking via the entry_type column.
--
-- The UNIQUE constraint includes is_recurring so that a recurring entry and
-- an exceptional one-off for the same category, period, and entry type can
-- coexist as separate rows without conflict.
--
-- Phase 2a of 6.  Depends on overhead_categories (20260430000000).
-- No Phase 1 tables are altered.
-- =============================================================================

SET search_path TO public, pg_temp;

-- -----------------------------------------------------------------------------
-- 1. overhead_entries
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.overhead_entries (
  id             uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       uuid            NOT NULL
                                 REFERENCES stores(id) ON DELETE CASCADE,
  category_id    uuid            NOT NULL
                                 REFERENCES overhead_categories(id) ON DELETE RESTRICT,
  period_start   date            NOT NULL,
  period_end     date            NOT NULL,
  amount         numeric(14,2)   NOT NULL,
  currency_code  text            NOT NULL DEFAULT 'GBP',
  entry_type     text            NOT NULL DEFAULT 'actual',
  is_recurring   boolean         NOT NULL DEFAULT true,
  source         text            NOT NULL DEFAULT 'manual',
  external_ref   text,
  notes          text,
  created_at     timestamptz     NOT NULL DEFAULT now(),
  updated_at     timestamptz     NOT NULL DEFAULT now(),

  -- One row per category / period / type / recurring-flag combination.
  -- Including is_recurring allows a recurring retainer and an exceptional
  -- one-off to coexist in the same category and period as separate rows.
  -- Use ON CONFLICT (...) DO UPDATE SET amount = excluded.amount to upsert.
  CONSTRAINT uq_overhead_entries_store_cat_period_type_recurring
    UNIQUE (store_id, category_id, period_start, entry_type, is_recurring),

  CONSTRAINT chk_overhead_entries_entry_type CHECK (
    entry_type IN ('actual', 'budget', 'forecast')
  ),

  CONSTRAINT chk_overhead_entries_source CHECK (
    source IN ('manual', 'xero', 'quickbooks', 'csv_import')
  )
);

-- -----------------------------------------------------------------------------
-- 2. Indexes
-- -----------------------------------------------------------------------------

-- Primary index for monthly_overhead_total(): filters on store_id,
-- period_start, and entry_type on every call.
CREATE INDEX IF NOT EXISTS idx_overhead_entries_store_period_type
  ON public.overhead_entries (store_id, period_start, entry_type);

-- Secondary index for category-level breakdown queries on the Cash Control
-- and Profit Engine pages.
CREATE INDEX IF NOT EXISTS idx_overhead_entries_store_category_period
  ON public.overhead_entries (store_id, category_id, period_start);

-- -----------------------------------------------------------------------------
-- 3. Comments
-- -----------------------------------------------------------------------------

COMMENT ON TABLE public.overhead_entries IS
  'Monthly fixed overhead amounts per category, per period, per entry type.
   entry_type = actual | budget | forecast — one table covers all three.
   is_recurring distinguishes predictable recurring costs from exceptional
   one-off spend within the same category and period.';

COMMENT ON COLUMN public.overhead_entries.period_start IS
  'First calendar day of the overhead period, e.g. 2026-04-01.
   Use exact calendar month bounds when calling monthly_overhead_total():
   period_start >= p_date_from AND period_end <= p_date_to (full containment).';

COMMENT ON COLUMN public.overhead_entries.period_end IS
  'Last calendar day of the overhead period, e.g. 2026-04-30.
   Must be the exact last day of the month — hard-code in seed migrations,
   do not compute dynamically to avoid timezone edge cases.';

COMMENT ON COLUMN public.overhead_entries.currency_code IS
  'ISO 4217 currency code for the amount.  Stored per-entry to support future
   multi-currency stores (e.g. USD SaaS subscription on a GBP store) without
   a schema migration.  Phase 2 seeds all entries as GBP.';

COMMENT ON COLUMN public.overhead_entries.is_recurring IS
  'true  = predictable, repeating monthly cost (payroll, rent, subscriptions).
   false = exceptional or one-off (legal settlement, equipment purchase).
   Used by the CFO alert engine to separate baseline from exceptional spend.
   The UNIQUE constraint includes this column so both can exist simultaneously
   under the same category, period, and entry type.';

COMMENT ON COLUMN public.overhead_entries.source IS
  'Origin of the entry: manual | xero | quickbooks | csv_import.
   Vendor-neutral — the category taxonomy (overhead_categories.external_account_code)
   is also vendor-neutral.';

COMMENT ON COLUMN public.overhead_entries.category_id IS
  'FK to overhead_categories.id with ON DELETE RESTRICT.  A category cannot be
   hard-deleted while historical entries exist.  Use overhead_categories.is_active
   = false to soft-delete instead.';
