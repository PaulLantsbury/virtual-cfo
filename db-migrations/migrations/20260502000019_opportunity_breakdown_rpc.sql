-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 20260502000019 — opportunity_breakdown RPC + enriched columns
--
-- PURPOSE
-- -------
-- The Opportunities page calls supabase.rpc("opportunity_breakdown", ...)
-- but the function did not exist — the page was falling back entirely to
-- hardcoded values (confidence, effort, timing, etc.).
--
-- This migration:
--   1. Adds nullable enrichment columns to public.opportunities so each row
--      can carry its own confidence, effort, timing, implementation_type,
--      recommended_action, linked_page, linked_page_label, and impact_type.
--   2. Backfills the three existing dev rows with sensible values matching
--      the current UI hardcodes.
--   3. Creates opportunity_breakdown(p_store_id uuid) — a SECURITY DEFINER
--      RPC that returns all columns the Opportunities page needs.
--
-- SAFE TO RE-RUN
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS — idempotent.
--   • UPDATE is safe against repeated runs (same values).
--   • CREATE OR REPLACE FUNCTION — no DROP, no CASCADE.
--   • NO table schema destructive changes.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Add enrichment columns ─────────────────────────────────────────────
-- All nullable so existing rows are unaffected until backfilled.
-- Callers must apply defensive fallbacks when any field is NULL.

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS confidence        text,
  ADD COLUMN IF NOT EXISTS effort            text,
  ADD COLUMN IF NOT EXISTS timing            text,
  ADD COLUMN IF NOT EXISTS implementation_type text,
  ADD COLUMN IF NOT EXISTS recommended_action  text,
  ADD COLUMN IF NOT EXISTS linked_page         text,
  ADD COLUMN IF NOT EXISTS linked_page_label   text,
  ADD COLUMN IF NOT EXISTS impact_type         text;

-- ── 2. Backfill the three dev seed rows ──────────────────────────────────
-- Values match the hardcoded UI defaults that were previously in
-- mappedOpportunities in opportunities.tsx.

UPDATE public.opportunities
SET
  confidence         = 'High',
  effort             = 'Low',
  timing             = 'Immediate',
  implementation_type = 'No additional investment required',
  recommended_action = 'Reduce average discount depth applied to orders. '
                       'Set a maximum discount threshold per SKU and review '
                       'which discount codes are auto-applied at checkout.',
  linked_page        = '/growth-quality',
  linked_page_label  = 'Growth Quality',
  impact_type        = 'monthly_contribution'
WHERE id = '70000000-0000-0000-0000-000000000001';

UPDATE public.opportunities
SET
  confidence         = 'Medium',
  effort             = 'Medium',
  timing             = '1–2 weeks',
  implementation_type = 'Requires operational change',
  recommended_action = 'Implement a post-purchase email sequence to drive '
                       'second purchases. Target customers 14 and 30 days '
                       'after their first order with personalised product '
                       'recommendations.',
  linked_page        = '/growth-quality',
  linked_page_label  = 'Growth Quality',
  impact_type        = 'monthly_contribution'
WHERE id = '70000000-0000-0000-0000-000000000002';

UPDATE public.opportunities
SET
  confidence         = 'Medium',
  effort             = 'Medium',
  timing             = '2–4 weeks',
  implementation_type = 'Requires operational change',
  recommended_action = 'Tighten pre-despatch quality control and improve '
                       'on-site size guidance. Analyse top refund reasons '
                       'and address the two highest-frequency causes first.',
  linked_page        = '/margin-analysis',
  linked_page_label  = 'Margin Analysis',
  impact_type        = 'monthly_contribution'
WHERE id = '70000000-0000-0000-0000-000000000003';

-- ── 3. Create opportunity_breakdown RPC ───────────────────────────────────
-- Returns one row per non-archived opportunity for the store, including all
-- enrichment columns.  The frontend sums impact_low / impact_high for the
-- headline range and uses per-row fields for the card display.
--
-- impact_mid is computed here (not stored) as the midpoint used for
-- relative bar-chart sizing and the "Where to start" uplift display.
--
-- NULL enrichment fields are passed through as-is; the frontend applies
-- defensive fallbacks.

CREATE OR REPLACE FUNCTION public.opportunity_breakdown(
  p_store_id uuid
)
RETURNS TABLE(
  id                   uuid,
  title                text,
  description          text,
  category             text,
  status               text,
  priority             integer,
  impact_low           numeric,
  impact_high          numeric,
  impact_mid           numeric,
  confidence           text,
  effort               text,
  timing               text,
  implementation_type  text,
  recommended_action   text,
  linked_page          text,
  linked_page_label    text,
  impact_type          text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    o.id,
    o.title,
    o.description,
    o.category,
    o.status,
    o.priority,
    o.impact_low,
    o.impact_high,
    ROUND((COALESCE(o.impact_low, 0) + COALESCE(o.impact_high, 0)) / 2.0, 0) AS impact_mid,
    o.confidence,
    o.effort,
    o.timing,
    o.implementation_type,
    o.recommended_action,
    o.linked_page,
    o.linked_page_label,
    o.impact_type
  FROM public.opportunities o
  WHERE o.store_id = p_store_id
    AND o.status   <> 'archived'
  ORDER BY o.priority ASC;
$$;

COMMENT ON FUNCTION public.opportunity_breakdown(uuid) IS
  'Returns all enriched opportunity rows for a store, ordered by priority. '
  'Excludes archived rows. impact_mid is computed as (impact_low + impact_high) / 2. '
  'Enrichment columns (confidence, effort, timing, etc.) may be NULL for rows '
  'that predate the 20260502000019 backfill — callers must apply fallbacks.';
