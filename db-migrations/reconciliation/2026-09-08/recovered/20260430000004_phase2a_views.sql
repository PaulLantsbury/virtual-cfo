-- =============================================================================
-- Migration 20260430000004 — Phase 2a views
--
-- Creates two views used by Phase 2a RPCs and future frontend pages:
--
--   v_current_cash_balance     — total cash per store at most recent snapshot date
--   v_monthly_overhead_summary — overhead totals by store, category, period, type
--
-- Depends on tables from migrations 000000–000002.
-- No Phase 1 tables are referenced or altered.
-- =============================================================================

SET search_path TO public, pg_temp;

-- =============================================================================
-- 1. v_current_cash_balance
--
-- Returns the sum of all account balances at the most recent snapshot_date
-- for each store.  Used by cash_runway_months() to determine total cash.
--
-- Note on the correlated subquery: safe at Phase 2 data volumes.
-- If the snapshot table grows to thousands of rows per store in production,
-- rewrite using:
--   DISTINCT ON (store_id) ORDER BY store_id, snapshot_date DESC
-- with idx_cash_balance_snapshots_store_date.  The output columns
-- (store_id, snapshot_date, total_cash_balance) are identical either way —
-- callers are unaffected by the rewrite.
-- =============================================================================

CREATE OR REPLACE VIEW public.v_current_cash_balance AS
SELECT
  store_id,
  snapshot_date,
  SUM(cash_balance) AS total_cash_balance
FROM  public.cash_balance_snapshots
WHERE snapshot_date = (
  SELECT MAX(s2.snapshot_date)
  FROM   public.cash_balance_snapshots s2
  WHERE  s2.store_id = cash_balance_snapshots.store_id
)
GROUP BY store_id, snapshot_date;

COMMENT ON VIEW public.v_current_cash_balance IS
  'Total cash balance per store at the most recent snapshot_date, summed
   across all account_key values.  Used by cash_runway_months().
   Multi-currency aggregation (no FX conversion) is deferred to Phase 3.';

-- =============================================================================
-- 2. v_monthly_overhead_summary
--
-- Overhead totals grouped by store, category, period, entry type, and
-- recurring flag.  Used by the Cash Control breakdown chart and the
-- Profit Engine waterfall.
--
-- Inactive categories are excluded via the JOIN condition
-- (AND oc.is_active = true), matching the behaviour of monthly_overhead_total().
-- Both the view and the RPC return consistent totals for the same store and
-- period — a soft-deleted category is excluded from both.
--
-- is_recurring is included in GROUP BY so callers can distinguish the
-- recurring-cost total from exceptional one-offs without a second query.
-- =============================================================================

CREATE OR REPLACE VIEW public.v_monthly_overhead_summary AS
SELECT
  oe.store_id,
  oc.category_type,
  oc.name           AS category_name,
  oe.period_start,
  oe.period_end,
  oe.entry_type,
  oe.is_recurring,
  SUM(oe.amount)    AS total_amount,
  COUNT(*)          AS entry_count
FROM  public.overhead_entries    oe
JOIN  public.overhead_categories oc
  ON  oc.id        = oe.category_id
 AND  oc.is_active = true
GROUP BY
  oe.store_id,
  oc.category_type,
  oc.name,
  oe.period_start,
  oe.period_end,
  oe.entry_type,
  oe.is_recurring;

COMMENT ON VIEW public.v_monthly_overhead_summary IS
  'Overhead totals per store, category, period, entry type, and is_recurring.
   Excludes inactive categories (oc.is_active = true in JOIN).
   Powers the Cash Control breakdown chart and Profit Engine waterfall.
   entry_type = actual | budget | forecast — filter in the calling query.';
