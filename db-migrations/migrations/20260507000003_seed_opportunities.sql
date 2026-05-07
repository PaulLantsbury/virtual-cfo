-- =============================================================================
-- Migration 20260507000003 — seed_opportunities
--
-- PURPOSE
-- -------
-- Two related fixes applied together:
--
-- 1. REPLACE incorrect seed rows.
--    The opportunities table was seeded with 3 rows that had lowercase category
--    values ("pricing", "retention", "operations") and wrong titles that did not
--    match SHARED_OPPORTUNITIES in the TypeScript codebase.  These are replaced
--    with the canonical 5 opportunities (opp-a … opp-e) — correct TitleCase
--    categories, correct titles, recommended actions, linked pages, and impact
--    ranges — so the Opportunities page always renders meaningful data.
--
-- 2. FIX recoverable_contribution_range() to exclude cash_improvement rows.
--    The function previously summed ALL non-archived opportunities regardless of
--    impact_type.  opp-d is a one-off cash release (£40k–£60k), not a recurring
--    monthly contribution, so including it inflated the "Recoverable contribution"
--    KPI tile and the Opportunities page header total.  The fix adds an
--    impact_type = 'monthly_contribution' filter.
--
-- IDEMPOTENCY
-- -----------
-- • CREATE OR REPLACE — safe to re-run.
-- • INSERT … ON CONFLICT (id) DO UPDATE — upserts; no duplicate rows.
-- • DELETE targets only the 3 known stale UUIDs before the upsert.
--
-- AFFECTED ROWS
-- -------------
-- store_id: 10000000-0000-0000-0000-000000000001  (dev / demo seed store)
-- ids removed : 70000000-0000-0000-0000-000000000001 … 000000000003 (stale)
-- ids upserted: 70000000-0000-0000-0000-000000000001 … 000000000005 (canonical)
-- =============================================================================


-- ── 1. Fix recoverable_contribution_range() ───────────────────────────────────
-- Add impact_type filter so only monthly_contribution rows are summed.
-- This aligns the KPI tile and Opportunities page header with displayed cards.

CREATE OR REPLACE FUNCTION public.recoverable_contribution_range(p_store_id uuid)
RETURNS TABLE(recoverable_low numeric, recoverable_high numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT
    COALESCE(SUM(impact_low),  0) AS recoverable_low,
    COALESCE(SUM(impact_high), 0) AS recoverable_high
  FROM public.opportunities
  WHERE store_id   = p_store_id
    AND status     <> 'archived'
    AND impact_type = 'monthly_contribution';
$$;


-- ── 2. Remove stale seed rows ─────────────────────────────────────────────────
-- These 3 rows used wrong category casing and mismatched titles.
-- They share the same UUIDs as the correct rows below, so we delete first to
-- allow the ON CONFLICT DO UPDATE to replace them cleanly.

DELETE FROM public.opportunities
WHERE id IN (
  '70000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000002',
  '70000000-0000-0000-0000-000000000003'
);


-- ── 3. Upsert canonical 5 SHARED_OPPORTUNITIES ───────────────────────────────
-- Matches SHARED_OPPORTUNITIES in artifacts/virtual-cfo/src/lib/mock-data.ts.
-- category values use TitleCase to match CATEGORY_COLORS in opportunities.tsx.
-- impact_mid is derived by the opportunity_breakdown() RPC — not stored here.

INSERT INTO public.opportunities (
  id,
  store_id,
  title,
  description,
  category,
  status,
  priority,
  impact_low,
  impact_high,
  confidence,
  effort,
  timing,
  implementation_type,
  recommended_action,
  linked_page,
  linked_page_label,
  impact_type,
  created_at,
  updated_at
) VALUES

-- opp-a: Reduce average discount depth
(
  '70000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Reduce average discount depth',
  'Discount dependency at 38% — above preferred 15–25% range.',
  'Pricing',
  'active',
  1,
  12000,
  18000,
  'High',
  'Low',
  'Immediate',
  'No additional investment required',
  'Reduce average discount from 18% to 15% by removing automatic repeat-customer discounts. Returning buyers have demonstrated intent — discounting them is pure margin loss.',
  '/growth-quality',
  'Growth Quality',
  'monthly_contribution',
  now(),
  now()
),

-- opp-b: Reallocate inefficient Meta spend
(
  '70000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'Reallocate inefficient Meta spend',
  'Meta CAC up 14% month-on-month — £28 vs £24 prior period.',
  'Marketing',
  'active',
  2,
  6000,
  10000,
  'Medium',
  'Low',
  '1–2 weeks',
  'No additional investment required',
  'Shift 15% of Meta budget to email and organic. Meta CAC (£28) runs 5.8× higher than email CAC (£4.80) — the same spend generates significantly more profitable customers through email.',
  '/marketing-efficiency',
  'Marketing Efficiency',
  'monthly_contribution',
  now(),
  now()
),

-- opp-c: Reduce shipping cost per order
(
  '70000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  'Reduce shipping cost per order',
  'Shipping costs up 12% per order vs prior period.',
  'Margin',
  'active',
  3,
  5000,
  7000,
  'High',
  'Medium',
  '2–4 weeks',
  'Requires carrier negotiation or policy change',
  'Renegotiate rates with current carrier or introduce a minimum order threshold for free shipping. At current volume, a 10% reduction in shipping cost adds £3.70 per order to contribution.',
  '/margin-analysis',
  'Margin Analysis',
  'monthly_contribution',
  now(),
  now()
),

-- opp-d: Reduce inventory days (cash release — one-off, not monthly contribution)
(
  '70000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000001',
  'Reduce inventory days',
  'Inventory days at 82 — above typical 45–60 day range.',
  'Cash',
  'active',
  4,
  40000,
  60000,
  'Medium',
  'Medium',
  '30–90 days',
  'Operational change required',
  'Reduce inventory days from 82 to 60 by tightening replenishment rules and clearing slow-moving SKUs. Each 10-day reduction frees approximately £14k in working capital.',
  '/profit-engine',
  'Profit Engine',
  'cash_improvement',
  now(),
  now()
),

-- opp-e: Improve full-price order ratio
(
  '70000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000001',
  'Improve full-price order ratio',
  '38% of orders now discounted — full-price ratio declining.',
  'Pricing',
  'active',
  5,
  8000,
  14000,
  'Medium',
  'Medium',
  '30 days',
  'Policy and CRM change required',
  'Segment promotions by customer lifecycle stage. Remove blanket discounts for repeat buyers and reserve offers for re-engagement campaigns only.',
  '/growth-quality',
  'Growth Quality',
  'monthly_contribution',
  now(),
  now()
)

ON CONFLICT (id) DO UPDATE SET
  title               = EXCLUDED.title,
  description         = EXCLUDED.description,
  category            = EXCLUDED.category,
  status              = EXCLUDED.status,
  priority            = EXCLUDED.priority,
  impact_low          = EXCLUDED.impact_low,
  impact_high         = EXCLUDED.impact_high,
  confidence          = EXCLUDED.confidence,
  effort              = EXCLUDED.effort,
  timing              = EXCLUDED.timing,
  implementation_type = EXCLUDED.implementation_type,
  recommended_action  = EXCLUDED.recommended_action,
  linked_page         = EXCLUDED.linked_page,
  linked_page_label   = EXCLUDED.linked_page_label,
  impact_type         = EXCLUDED.impact_type,
  updated_at          = now();
