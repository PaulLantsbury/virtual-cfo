-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 20260502000020 — Fix effort for Improve Repeat Purchase Rate
--
-- PURPOSE
-- -------
-- Migration 20260502000019 incorrectly backfilled effort = 'Medium' for the
-- "Improve Repeat Purchase Rate" opportunity. It should be 'Low' so that it
-- is included in the capital-free uplift strip alongside "Reduce Discount
-- Dependency", producing the correct £14k–£32k range.
--
-- SAFE TO RE-RUN
--   • UPDATE is idempotent (sets same value on repeated runs).
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.opportunities
SET effort = 'Low'
WHERE id = '70000000-0000-0000-0000-000000000002';
