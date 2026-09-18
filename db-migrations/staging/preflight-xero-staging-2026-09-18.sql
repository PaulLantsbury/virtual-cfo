-- READ ONLY: Xero staging migration preflight.
--
-- Run only after the Supabase dashboard has visibly selected Night Scout
-- Staging, project ref bioalckltvkhlczusdvl. SQL sessions cannot prove a
-- Supabase project ref, so the visible dashboard selection is a required
-- human/environment control. This file performs no DDL, DML, grants, role
-- changes, transaction control, or function creation.
--
-- Expected next files, in order, only when every readiness result below is
-- true and no xero_v1 relation exists:
--   1. ../proposals/xero-mapping-store-2026-09-18.sql
--   2. ../proposals/xero-credential-store-2026-09-18.sql
-- Their SHA-256 values are documented in xero-staging-application-2026-09-18.md.

SELECT
  current_database() AS connected_database,
  current_user AS connected_role,
  to_regclass('public.stores') IS NOT NULL AS has_stores,
  to_regclass('public.store_memberships') IS NOT NULL AS has_store_memberships,
  to_regclass('auth.users') IS NOT NULL AS has_auth_users,
  to_regprocedure('gen_random_uuid()') IS NOT NULL AS has_uuid_generator,
  EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AS has_anon_role,
  EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AS has_authenticated_role,
  NOT EXISTS (
    SELECT 1
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'xero_v1'
      AND relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
  ) AS xero_namespace_is_empty;

-- The mapping proposal relies on an authenticated member-only read boundary.
-- Check the existing dependency is both protected and not browser-writable.
SELECT
  class.relrowsecurity AS memberships_rls_enabled,
  has_table_privilege('authenticated', 'public.store_memberships', 'SELECT') AS authenticated_can_read_memberships,
  NOT has_table_privilege('authenticated', 'public.store_memberships', 'INSERT')
    AND NOT has_table_privilege('authenticated', 'public.store_memberships', 'UPDATE')
    AND NOT has_table_privilege('authenticated', 'public.store_memberships', 'DELETE') AS authenticated_cannot_write_memberships,
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'store_memberships'
      AND policyname = 'membership_self_read'
  ) AS has_member_self_read_policy
FROM pg_class class
WHERE class.oid = 'public.store_memberships'::regclass;

-- A pre-existing schema or relation signals an interrupted/previous deployment.
-- Do not reapply either proposal in that case: inspect the catalog and history.
SELECT
  namespace.nspname AS schema_name,
  relation.relname AS relation_name,
  relation.relkind AS relation_kind,
  relation.relrowsecurity AS rls_enabled
FROM pg_namespace namespace
JOIN pg_class relation ON relation.relnamespace = namespace.oid
WHERE namespace.nspname = 'xero_v1'
ORDER BY relation.relkind, relation.relname;
