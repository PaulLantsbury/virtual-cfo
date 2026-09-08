-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 20260429000005 — recoverable_contribution_range
--
-- Creates the RPC function used by the METRIC.RECOVERABLE_CONTRIBUTION_RANGE
-- dashboard tile (rc tile).
--
-- Function: recoverable_contribution_range(p_store_id uuid)
-- Returns:  TABLE(recoverable_low numeric, recoverable_high numeric)
--
-- Behaviour:
--   • Sums impact_low and impact_high across all non-archived opportunities
--     for the given store.
--   • "Archived" is represented by status = 'archived'.  No separate column
--     exists, so the filter is status <> 'archived'.
--   • COALESCE ensures 0 / 0 is returned when the store has no qualifying
--     opportunity rows (rather than NULL / NULL).
--   • Marked STABLE (no writes; same input → same output within a transaction).
--   • SECURITY DEFINER so the caller does not need direct table access.
--   • SET search_path = public, pg_temp prevents search-path hijacking.
--
-- Expected output against the Bloom & Co. seed dataset:
--   recoverable_low  = 8000 + 6000 + 4000 = £18,000
--   recoverable_high = 18000 + 14000 + 10000 = £42,000
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION recoverable_contribution_range(
  p_store_id uuid
)
RETURNS TABLE(
  recoverable_low  numeric,
  recoverable_high numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    COALESCE(SUM(impact_low),  0) AS recoverable_low,
    COALESCE(SUM(impact_high), 0) AS recoverable_high
  FROM opportunities
  WHERE store_id = p_store_id
    AND status   <> 'archived';
$$;

COMMENT ON FUNCTION recoverable_contribution_range(uuid) IS
  'Returns the summed impact_low / impact_high across all non-archived '
  'opportunities for a store.  Maps to METRIC.RECOVERABLE_CONTRIBUTION_RANGE.';
