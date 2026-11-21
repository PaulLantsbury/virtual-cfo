-- Read-only metadata postflight. No credential/provider values or identities.
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT
 p.oid::regprocedure::text AS reader,
 p.prosecdef AS security_definer,
 p.proowner='postgres'::regrole AS expected_owner,
 p.proconfig=ARRAY['search_path=pg_catalog, public, xero_v1'] AS fixed_search_path,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS member_execute,
 NOT has_function_privilege('anon',p.oid,'EXECUTE') AS anonymous_denied,
 NOT has_function_privilege('service_role',p.oid,'EXECUTE') AS service_denied,
 NOT has_function_privilege('night_scout_import_login',p.oid,'EXECUTE') AS worker_denied,
 NOT has_function_privilege('night_scout_xero_bootstrap_login',p.oid,'EXECUTE') AS bootstrap_denied,
 strpos(pg_get_functiondef(p.oid),'auth.uid()')>0 AND strpos(pg_get_functiondef(p.oid),'public.store_memberships')>0 AS member_bound
FROM pg_proc p WHERE p.oid IN (
 'public.xero_merchant_readiness(uuid)'::regprocedure,
 'public.xero_accounting_period(uuid,date,date,text)'::regprocedure)
ORDER BY reader;
SELECT
 NOT has_table_privilege('authenticated','xero_v1.accounting_evidence','SELECT') AS direct_accounting_denied,
 NOT has_table_privilege('authenticated','xero_v1.credential_envelopes','SELECT') AS direct_credentials_denied,
 strpos(pg_get_functiondef('public.xero_merchant_readiness(uuid)'::regprocedure),'xero_third_reauthorization_authorizations')>0 AS third_authorization_preserved,
 strpos(pg_get_functiondef('public.xero_merchant_readiness(uuid)'::regprocedure),'connection_preflight_evidence')>0 AS current_credential_preflight_observed;
ROLLBACK;
