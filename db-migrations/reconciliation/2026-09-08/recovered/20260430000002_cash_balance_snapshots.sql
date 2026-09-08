-- =============================================================================
-- Migration 20260430000002 — cash_balance_snapshots
--
-- Creates the cash_balance_snapshots table: point-in-time cash balances per
-- store account.  Multiple accounts per store are supported via account_key.
-- cash_runway_months() aggregates SUM(cash_balance) across all account_key
-- values at the most recent snapshot_date for a given store.
--
-- account_key  = machine-stable slug used in UNIQUE constraint and RPC logic.
--               Must not change after creation.
-- account_display_name = mutable UI label; can be renamed freely without
--               breaking any query or constraint logic.
--
-- Phase 2a of 6.  No Phase 1 tables are altered.
-- =============================================================================

SET search_path TO public, pg_temp;

-- -----------------------------------------------------------------------------
-- 1. cash_balance_snapshots
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cash_balance_snapshots (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id             uuid          NOT NULL
                                     REFERENCES stores(id) ON DELETE CASCADE,
  snapshot_date        date          NOT NULL,
  cash_balance         numeric(14,2) NOT NULL,
  account_key          text          NOT NULL DEFAULT 'main',
  account_display_name text          NOT NULL DEFAULT 'Main Account',
  currency_code        text          NOT NULL DEFAULT 'GBP',
  source               text          NOT NULL DEFAULT 'manual',
  external_ref         text,
  notes                text,
  created_at           timestamptz   NOT NULL DEFAULT now(),

  -- account_key (not account_display_name) is the stable slug used here.
  -- Renaming the display name does not create a new row or break the constraint.
  CONSTRAINT uq_cash_balance_snapshots_store_date_account
    UNIQUE (store_id, snapshot_date, account_key),

  CONSTRAINT chk_cash_balance_snapshots_source CHECK (
    source IN ('manual', 'xero', 'quickbooks', 'open_banking', 'csv_import')
  )
);

-- -----------------------------------------------------------------------------
-- 2. Index
-- -----------------------------------------------------------------------------

-- Descending on snapshot_date optimises the MAX(snapshot_date) correlated
-- subquery in v_current_cash_balance and cash_runway_months().
CREATE INDEX IF NOT EXISTS idx_cash_balance_snapshots_store_date
  ON public.cash_balance_snapshots (store_id, snapshot_date DESC);

-- -----------------------------------------------------------------------------
-- 3. Comments
-- -----------------------------------------------------------------------------

COMMENT ON TABLE public.cash_balance_snapshots IS
  'Point-in-time cash balance per store account.  One row per date per account.
   cash_runway_months() sums all account_key balances at the latest snapshot_date.
   Multi-currency aggregation (e.g. GBP + USD accounts) is deferred to Phase 3.';

COMMENT ON COLUMN public.cash_balance_snapshots.account_key IS
  'Machine-stable slug identifying the account.  Used in the UNIQUE constraint
   and all RPC/query logic.  Treat as immutable after creation.
   Examples: main, stripe_reserve, savings.';

COMMENT ON COLUMN public.cash_balance_snapshots.account_display_name IS
  'Human-readable label shown in the UI.  Can be changed freely without
   breaking any logic — it is not part of the UNIQUE constraint.
   Examples: Main Business Account, Stripe Reserve, Tax Savings Pot.';

COMMENT ON COLUMN public.cash_balance_snapshots.currency_code IS
  'ISO 4217 currency code for cash_balance.  Stored per-row to support
   future stores with multi-currency cash holdings.  Phase 2 seeds GBP only.';

COMMENT ON COLUMN public.cash_balance_snapshots.source IS
  'Origin of the snapshot: manual | xero | quickbooks | open_banking | csv_import.';
