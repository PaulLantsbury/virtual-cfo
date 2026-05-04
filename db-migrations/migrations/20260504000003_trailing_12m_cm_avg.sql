-- =============================================================================
-- Migration 20260504000003 — trailing_12m_cm_avg
--
-- PURPOSE
-- -------
-- Adds a new RPC that computes the trailing 12-month CM% average for a given
-- store, using the 12 calendar months immediately BEFORE the supplied anchor
-- date (T-1 through T-12).
--
-- This replaces the hardcoded CM_LY constant that was used on the Margin
-- Analysis page to show "vs 12-month avg" on the CM KPI card.  That constant
-- (48.2%) was the March 2025 year-ago snapshot value, not a real rolling
-- average.  The RPC derives a proper trailing average from live order data.
--
-- DESIGN
-- ------
-- The function iterates T-1 through T-12 and calls:
--   • gross_revenue()           to detect months with no order data (→ skip)
--   • contribution_margin_pct() to get the [0,1] CM ratio for each live month
-- Only months where gross_revenue > 0 contribute to the average.  This
-- matches the zero-revenue guard already in rolling_3m_averages().
--
-- RETURN
-- ------
-- Returns a single row TABLE:
--   cm_pct_12m_avg  numeric   — [0,1] ratio; NULL when no live months found
--   months_included integer   — count of non-zero months averaged (0–12)
--
-- USAGE (TypeScript caller pattern, mirrors getRolling3mAverages)
-- ---------------------------------------------------------------
--   const { data, error } = await supabase.rpc('trailing_12m_cm_avg', {
--     p_store_id:  storeId,
--     p_date_from: dateFrom,   // first day of the CURRENT period
--   });
--
-- IDEMPOTENT: CREATE OR REPLACE — safe to re-run on production.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trailing_12m_cm_avg(
  p_store_id  uuid,
  p_date_from date   -- first day of the current period (anchor month T)
)
RETURNS TABLE (
  cm_pct_12m_avg  numeric,
  months_included integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_total      numeric := 0;
  v_count      integer := 0;
  v_cm         numeric;
  v_rev        numeric;
  v_month_from date;
  v_month_to   date;
  i            integer;
BEGIN
  -- Iterate T-1 through T-12 (the 12 calendar months before the anchor).
  -- gross_revenue() and contribution_margin_pct() both accept inclusive date
  -- ranges and use COALESCE(..., 0), so they never raise when a month is empty.
  FOR i IN 1..12 LOOP
    -- First day of month T-i
    v_month_from := (date_trunc('month', p_date_from::timestamp)
                     - (i || ' month')::interval)::date;
    -- Last day of month T-i (day 0 of T-i+1 = last day of T-i)
    v_month_to   := (v_month_from + interval '1 month' - interval '1 day')::date;

    -- Skip months with no order data to avoid dragging the average toward 0.
    v_rev := public.gross_revenue(p_store_id, v_month_from, v_month_to);
    CONTINUE WHEN v_rev = 0;

    -- contribution_margin_pct() returns NULL when store has no cost assumptions.
    -- NULL months are excluded from the running total.
    v_cm := public.contribution_margin_pct(p_store_id, v_month_from, v_month_to);
    CONTINUE WHEN v_cm IS NULL;

    v_total := v_total + v_cm;
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    -- No months with live data found — caller should show "—" or fall back.
    RETURN QUERY SELECT NULL::numeric, 0;
  ELSE
    RETURN QUERY SELECT ROUND(v_total / v_count, 4), v_count;
  END IF;
END;
$$;
