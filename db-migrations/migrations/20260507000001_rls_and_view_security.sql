-- =============================================================================
-- Migration 20260507000001 — rls_and_view_security
--
-- PURPOSE
-- -------
-- Resolves Supabase Security Advisor lint errors:
--   • "RLS Disabled in Public Tables" — tables were missing RLS
--   • "Security Definer View" — 5 views lacked an explicit security_invoker flag
--
-- WHAT THIS DOES
-- ──────────────
-- 1. Enables RLS on all 11 flagged tables. All ALTER TABLE statements are
--    idempotent — enabling RLS on a table that already has it is a no-op.
--
-- 2. Sets security_invoker = true on 5 views.
--
-- WHY NO POLICIES ARE ADDED
-- ─────────────────────────
-- Every data read in this app goes through SECURITY DEFINER functions
-- (gross_revenue, contribution_margin_pct, operating_profit_monthly, etc.).
-- Those functions execute as the postgres owner, which bypasses RLS
-- regardless of policies. Direct table access from the anon or authenticated
-- role is intentionally blocked (zero permissive policies = deny-by-default).
-- The service_role key bypasses RLS entirely at the driver level, so any
-- server-side write operations are unaffected.
--
-- SAFETY GUARANTEES
-- ─────────────────
-- • No INSERT / UPDATE / DELETE policies → no public write path is opened.
-- • No SELECT policies → direct table reads from anon remain denied.
-- • All app queries go through SECURITY DEFINER RPCs → zero regression.
-- • All statements are idempotent — safe to re-run on any environment.
--
-- KNOWN PRE-EXISTING POLICY (not introduced by this migration)
-- ─────────────────────────────────────────────────────────────
-- Table: orders
-- Policy: "Allow temporary read access to orders"  cmd=SELECT  roles={anon}  USING=true
-- This pre-dates this migration. It grants anon unrestricted SELECT on orders
-- with no store-scoping. It should be reviewed and dropped separately.
--
-- =============================================================================

-- ── 1. Enable RLS on all flagged public tables ────────────────────────────────

ALTER TABLE public.cash_balance_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cfo_alerts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overhead_categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overhead_entries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_line_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_cost_assumptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores                  ENABLE ROW LEVEL SECURITY;

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
