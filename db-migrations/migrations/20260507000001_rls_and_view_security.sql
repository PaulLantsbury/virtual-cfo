-- =============================================================================
-- Migration 20260507000001 — rls_and_view_security
--
-- PURPOSE
-- -------
-- Resolves Supabase Security Advisor lint errors:
--   • "RLS Disabled in Public Tables" — 4 tables were missing RLS
--   • "Security Definer View" — 5 views lacked an explicit security_invoker flag
--
-- WHAT THIS DOES
-- ──────────────
-- 1. Enables RLS on 4 tables that were missing it:
--      cash_balance_snapshots, overhead_categories,
--      overhead_entries, store_cost_assumptions
--    This matches the pattern already applied to the other 13 tables.
--
-- 2. Sets security_invoker = true on 5 views:
--      v_monthly_metrics, v_current_cost_assumptions,
--      v_current_cash_balance, v_monthly_overhead_summary, v_month_on_month
--
-- WHY NO POLICIES ARE ADDED
-- ─────────────────────────
-- Every data read in this app goes through SECURITY DEFINER functions
-- (gross_revenue, contribution_margin_pct, operating_profit_monthly, etc.).
-- Those functions execute as the postgres owner, which bypasses RLS
-- regardless of policies. Direct table access from the anon or authenticated
-- role is intentionally blocked (zero permissive policies = deny-by-default).
-- This is the consistent pattern across all 17 tables in this schema.
-- The service_role key bypasses RLS entirely at the driver level, so any
-- server-side write operations are unaffected.
--
-- SAFETY GUARANTEES
-- ─────────────────
-- • No INSERT / UPDATE / DELETE policies → no public write path is opened.
-- • No SELECT policies → direct table reads from anon remain denied.
-- • All app queries go through SECURITY DEFINER RPCs → zero regression.
-- • All statements are idempotent — safe to re-run on production.
--
-- =============================================================================

-- ── 1. Enable RLS on the 4 tables currently missing it ───────────────────────

ALTER TABLE public.cash_balance_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overhead_categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overhead_entries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_cost_assumptions  ENABLE ROW LEVEL SECURITY;

-- ── 2. Fix views: set explicit SECURITY INVOKER ───────────────────────────────
-- When security_invoker = true, a view executes with the privileges of the
-- calling role rather than the view owner. Since all app access goes through
-- SECURITY DEFINER RPCs (not views directly), this has zero runtime impact.
-- Direct anon queries against these views will correctly return no rows
-- because the underlying tables have RLS enabled with no permissive policies.

ALTER VIEW public.v_monthly_metrics          SET (security_invoker = true);
ALTER VIEW public.v_current_cost_assumptions SET (security_invoker = true);
ALTER VIEW public.v_current_cash_balance     SET (security_invoker = true);
ALTER VIEW public.v_monthly_overhead_summary SET (security_invoker = true);
ALTER VIEW public.v_month_on_month           SET (security_invoker = true);
