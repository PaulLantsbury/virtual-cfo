-- =============================================================================
-- Migration 20260430000005 — Phase 2a RPC functions
--
-- Creates three parameterised functions:
--
--   monthly_overhead_total(store_id, date_from, date_to, entry_type)
--     → SUM of active-category overhead for the period.  Powers np and cr.
--
--   cash_runway_months(store_id)
--     → Months of overhead the current cash balance covers.  Powers cr tile.
--
--   operating_profit_monthly(store_id, date_from, date_to)
--     → Contribution £ minus fixed overhead.  Powers np tile.
--
-- All functions:
--   LANGUAGE plpgsql  — required for multi-step variable assignments
--   STABLE            — read-only; same result for same inputs in a transaction
--   SECURITY DEFINER  — runs as function owner (DB owner / service role).
--                       Used because Phase 2a tables have no explicit RLS
--                       policies, matching the pattern of contribution_margin_pct()
--                       (migration 20260429000003).  The nine basic Phase 1
--                       metric functions (20260429000001) use SECURITY INVOKER —
--                       SECURITY DEFINER here is not universal across Phase 1
--                       but is consistent with the contribution_margin_pct
--                       precedent that operating_profit_monthly() calls.
--   SET search_path = public, pg_temp  — mitigates search-path injection.
--
-- Depends on: overhead_entries, overhead_categories, cash_balance_snapshots
--             (migrations 000000–000002) and Phase 1 functions
--             net_sales() and contribution_margin_pct().
-- =============================================================================

SET search_path TO public, pg_temp;

-- =============================================================================
-- 1. monthly_overhead_total
--
-- Returns the sum of overhead amounts for a store and period, filtered to
-- active categories and the specified entry_type.
--
-- Period containment: period_start >= p_date_from AND period_end <= p_date_to
-- (full containment, not partial overlap).  Callers must pass exact calendar
-- month bounds.
--
-- COALESCE(..., 0): returns 0, never NULL, when no qualifying rows exist.
-- This prevents downstream NULL propagation in cash_runway_months() and
-- operating_profit_monthly().
--
-- No is_recurring filter at Phase 2.  A future p_recurring_only boolean
-- parameter will be added when CFO alerting needs a recurring-cost baseline.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.monthly_overhead_total(
  p_store_id   uuid,
  p_date_from  date,
  p_date_to    date,
  p_entry_type text DEFAULT 'actual'
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

COMMENT ON FUNCTION public.monthly_overhead_total(uuid, date, date, text) IS
  'Sum of overhead entries for a store and period, active categories only.
   p_entry_type: actual (default) | budget | forecast.
   Period containment: period_start >= p_date_from AND period_end <= p_date_to.
   Returns 0 (never NULL) when no rows match.
   Powers monthly_overhead_total calls in cash_runway_months() and
   operating_profit_monthly().';

-- =============================================================================
-- 2. cash_runway_months
--
-- Returns how many months of current-month fixed overhead the store's cash
-- balance covers at the most recent snapshot date.
--
-- Formula:
--   total_cash    = SUM(cash_balance) at MAX(snapshot_date) for the store
--   monthly_fixed = monthly_overhead_total(store, current month, 'actual')
--   runway        = total_cash / NULLIF(monthly_fixed, 0)
--
-- Returns NULL if:
--   - no cash snapshot exists for the store
--   - monthly_fixed = 0 (NULLIF division guard)
--
-- Date arithmetic:
--   (date_trunc('month', CURRENT_DATE) + interval '1 month')::date - 1
--   is the standard PostgreSQL idiom for the last day of the current month.
--
-- Current-month dependency:
--   If the current month has no overhead_entries rows, monthly_overhead_total()
--   returns 0, NULLIF fires, and the function returns NULL.
--   The 12-month seed (Jan–Dec 2026) prevents this for all 2026 months.
--
-- Expected value on seeded dev data (as of April 30 2026):
--   £186,000 / £119,200 ≈ 1.55 months.  The 3.4-month mock constant in
--   cash-snapshot.ts is illustrative and will be retired when this tile is wired.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cash_runway_months(
  p_store_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_cash    numeric;
  v_monthly_fixed numeric;
  v_period_from   date;
  v_period_to     date;
BEGIN
  -- Step 1: aggregate cash balance across all accounts at the latest snapshot
  SELECT SUM(cash_balance)
  INTO   v_total_cash
  FROM   public.cash_balance_snapshots
  WHERE  store_id      = p_store_id
    AND  snapshot_date = (
           SELECT MAX(s2.snapshot_date)
           FROM   public.cash_balance_snapshots s2
           WHERE  s2.store_id = p_store_id
         );

  -- Return NULL if no snapshot exists for this store
  IF v_total_cash IS NULL THEN
    RETURN NULL;
  END IF;

  -- Step 2: current calendar month bounds
  v_period_from := date_trunc('month', CURRENT_DATE)::date;
  v_period_to   := (date_trunc('month', CURRENT_DATE) + interval '1 month')::date - 1;

  -- Step 3: actual overhead total for the current month
  v_monthly_fixed := public.monthly_overhead_total(
    p_store_id,
    v_period_from,
    v_period_to,
    'actual'
  );

  -- Step 4: runway in months (NULLIF guards against zero denominator)
  RETURN v_total_cash / NULLIF(v_monthly_fixed, 0);
END;
$$;

COMMENT ON FUNCTION public.cash_runway_months(uuid) IS
  'Months of overhead covered by current cash balance.
   Numerator : SUM(cash_balance) at MAX(snapshot_date) across all accounts.
   Denominator: monthly_overhead_total() for the current calendar month (actual).
   Returns NULL when no cash snapshot exists or when overhead = 0.
   Powers the cr (Cash Runway) KPI tile.
   Expected dev value (April 30 2026): £186,000 / £119,200 ≈ 1.55 months.';

-- =============================================================================
-- 3. operating_profit_monthly
--
-- Returns operating profit for the period:
--   contribution_£ = net_sales × contribution_margin_pct   (Phase 1 RPCs)
--   operating_profit = contribution_£ − monthly_overhead_total  (Phase 2a RPC)
--
-- Returns NULL if contribution_margin_pct() returns NULL (no store_cost_assumptions
-- row exists for the store — treated as "not configured").
--
-- Returns a negative number when fixed costs exceed contribution.  This is
-- correct for a loss-making month.  The frontend tile must handle negatives.
--
-- Expected value on Phase 1 dev seed data:
--   net_sales ≈ £700 (small test dataset, not realistic £124,500/month).
--   Result will be deeply negative (£700 × ~0.91 − £119,200 ≈ −£118,563).
--   This is expected — Phase 1 seed data was sized for RPC validation only.
--   Expand the Phase 1 order seed before wiring the np tile.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.operating_profit_monthly(
  p_store_id   uuid,
  p_date_from  date,
  p_date_to    date
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cm_pct      numeric;
  v_net_sales   numeric;
  v_fixed_costs numeric;
BEGIN
  -- Phase 1 RPC: contribution margin % (ratio [0,1]), NULL if not configured
  v_cm_pct := public.contribution_margin_pct(p_store_id, p_date_from, p_date_to);

  -- Return NULL if cost assumptions are not configured for this store
  IF v_cm_pct IS NULL THEN
    RETURN NULL;
  END IF;

  -- Phase 1 RPC: net sales for the period
  v_net_sales := public.net_sales(p_store_id, p_date_from, p_date_to);

  -- Phase 2a RPC: actual fixed overhead for the period
  v_fixed_costs := public.monthly_overhead_total(
    p_store_id,
    p_date_from,
    p_date_to,
    'actual'
  );

  -- Operating profit = contribution £ minus fixed costs (may be negative)
  RETURN (v_net_sales * v_cm_pct) - v_fixed_costs;
END;
$$;

COMMENT ON FUNCTION public.operating_profit_monthly(uuid, date, date) IS
  'Operating profit for the period: (net_sales × cm_pct) − fixed_overhead.
   Calls Phase 1 RPCs net_sales() and contribution_margin_pct(),
   and Phase 2a RPC monthly_overhead_total().
   Returns NULL when contribution_margin_pct() is NULL (store not configured).
   Returns a negative number for loss-making months — frontend must handle this.
   Powers the np (Net Profit) KPI tile.';
