-- UNAPPROVED PROPOSAL ONLY. No live application or broader schema exposure.
-- Adds ONE member-scoped metadata RPC in already exposed public schema.
-- No table grants, reader/writer credentials, reports, tokens or health assertion.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$ BEGIN
 IF to_regprocedure('auth.uid()') IS NULL
  OR to_regclass('public.store_memberships') IS NULL
  OR to_regclass('xero_v1.connections') IS NULL
  OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='authenticated')
  OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='anon')
 THEN RAISE EXCEPTION 'Existing member and Xero connection boundaries required'; END IF;
 IF current_user IN ('anon','authenticated','night_scout_test_writer','night_scout_test_writer_service','night_scout_import_login','night_scout_xero_bootstrap_login') THEN RAISE EXCEPTION 'Reviewed operator application required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid='public.store_memberships'::regclass AND relrowsecurity)
  OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid='xero_v1.connections'::regclass AND relrowsecurity)
 THEN RAISE EXCEPTION 'Existing row-level security boundary required'; END IF;
 IF to_regprocedure('public.xero_member_active_tenant_binding_v1(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Binding RPC already exists; inspect without replacing'; END IF;
END $guard$;

CREATE FUNCTION public.xero_member_active_tenant_binding_v1(p_store_id uuid)
RETURNS TABLE(store_id uuid,tenant_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog
AS $function$
DECLARE member_id uuid:=auth.uid(); active_count integer; binding xero_v1.connections%ROWTYPE;
BEGIN
 IF member_id IS NULL OR p_store_id IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.store_memberships m WHERE m.user_id=member_id AND m.store_id=p_store_id
 ) THEN RAISE EXCEPTION 'Xero tenant binding unavailable'; END IF;
 SELECT count(*) INTO active_count FROM xero_v1.connections c WHERE c.store_id=p_store_id AND c.retired_at IS NULL;
 IF active_count<>1 THEN RAISE EXCEPTION 'Xero tenant binding unavailable'; END IF;
 SELECT c.* INTO binding FROM xero_v1.connections c WHERE c.store_id=p_store_id AND c.retired_at IS NULL;
 IF NOT FOUND OR binding.tenant_id IS NULL OR binding.tenant_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  OR binding.created_at IS NULL OR NOT isfinite(binding.created_at) OR binding.created_at>transaction_timestamp()
 THEN RAISE EXCEPTION 'Xero tenant binding unavailable'; END IF;
 RETURN QUERY SELECT binding.store_id,binding.tenant_id;
END $function$;

REVOKE ALL ON FUNCTION public.xero_member_active_tenant_binding_v1(uuid) FROM PUBLIC,anon,authenticated;
-- Remove any explicit defaults inherited by the creator for known non-member roles.
DO $revoke$ DECLARE r text; BEGIN
 FOR r IN SELECT rolname FROM pg_catalog.pg_roles WHERE rolname IN
  ('service_role','night_scout_import_login','night_scout_xero_bootstrap_login','night_scout_test_writer','night_scout_test_writer_service')
 LOOP EXECUTE format('REVOKE ALL ON FUNCTION public.xero_member_active_tenant_binding_v1(uuid) FROM %I',r); END LOOP;
END $revoke$;
GRANT EXECUTE ON FUNCTION public.xero_member_active_tenant_binding_v1(uuid) TO authenticated;
COMMIT;
