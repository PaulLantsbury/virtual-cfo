-- Read-only, post-install / PRE-CONSENT check for the exact isolated Demo proposal.
-- Run as the already-authorized migration/audit owner on a dedicated idle session.
-- Expected: exactly one row, every column true. Any false/error means STOP/review.
-- An empty-new-data check is intentionally false after successful Demo consent.
-- No provider calls, credentials, customer IDs, payloads, writes or role switching.
-- Old-reader separation/current shape is checked; historical byte-for-byte identity
-- requires the separately retained pre-application baseline (not inferred here).
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='10s';
SET LOCAL search_path=pg_catalog,public;
WITH expected_roles(name,can_login,service_name) AS (VALUES
 ('night_scout_demo_import_login',true,'night_scout_demo_import_service'),
 ('night_scout_demo_bootstrap_login',true,'night_scout_demo_bootstrap_service'),
 ('night_scout_demo_import_service',false,NULL),
 ('night_scout_demo_bootstrap_service',false,NULL)
), worker_functions(signature) AS (VALUES
 ('worker_get_refresh_context(uuid,uuid)'),
 ('worker_get_latest_supported_evidence(uuid,uuid,date,date,text,boolean)'),
 ('worker_acquire_refresh_lease(uuid,integer,integer)'),
 ('worker_release_refresh_lease(uuid,integer,timestamp with time zone)'),
 ('worker_get_single_refresh_job(date,date,text,boolean)'),
 ('worker_store_refresh_envelope_leased(uuid,bytea,bytea,text,text,integer,integer,timestamp with time zone)'),
 ('worker_record_accounting_evidence_leased(uuid,uuid,date,date,text,boolean,text,text,date,timestamp with time zone,text,bigint,bigint,bigint,bigint,bigint,integer,timestamp with time zone)'),
 ('worker_record_connection_preflight(uuid,integer,text,text,text,smallint,boolean,timestamp with time zone)'),
 ('worker_get_single_connection_preflight_job()'),
 ('worker_record_credential_refresh_failure(uuid,text)')
), bootstrap AS (
 SELECT 'xero_demo_v1.bootstrap_create_initial_connection(uuid,uuid,text,uuid,date,timestamp with time zone,jsonb,jsonb,bytea,bytea,text,text)'::regprocedure oid
), private_functions AS (
 SELECT ('xero_demo_v1.'||signature)::regprocedure oid FROM worker_functions
 UNION ALL SELECT oid FROM bootstrap
), public_functions AS (
 SELECT 'public.xero_demo_member_active_tenant_binding_v1(uuid)'::regprocedure oid
 UNION ALL SELECT 'public.xero_demo_reader_status_v1(uuid)'::regprocedure
), tables AS (
 SELECT c.oid,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='xero_demo_v1' AND c.relkind='r'
), forbidden_roles(name) AS (VALUES
 ('anon'),('authenticated'),('service_role'),('night_scout_import_login'),
 ('night_scout_xero_bootstrap_login'),('night_scout_test_writer'),('night_scout_test_writer_service')
)
SELECT
 current_setting('transaction_read_only')='on' AS transaction_read_only,
 (SELECT count(*)=4 AND bool_and(r.rolcanlogin=e.can_login AND NOT r.rolinherit AND NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolreplication AND NOT r.rolbypassrls AND (NOT e.can_login OR r.rolconnlimit=1)) FROM expected_roles e JOIN pg_roles r ON r.rolname=e.name) AS restricted_roles_exact,
 (SELECT count(*)=2 AND bool_and(NOT m.admin_option AND NOT m.inherit_option AND m.set_option AND s.rolname=e.service_name) FROM expected_roles e JOIN pg_roles r ON r.rolname=e.name JOIN pg_auth_members m ON m.member=r.oid JOIN pg_roles s ON s.oid=m.roleid WHERE e.can_login) AS login_memberships_exact,
 NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname IN ('night_scout_demo_import_service','night_scout_demo_bootstrap_service')) AS services_have_no_memberships,
 (SELECT count(*)=1 FROM public.stores WHERE id='f59e3a44-7106-4df8-9c08-52da30c9de30' AND shopify_domain='xero-demo-only.invalid' AND shopify_store_id='night-scout-xero-demo-only' AND currency_code='GBP' AND timezone='Europe/London' AND is_active) AS synthetic_store_exact,
 (SELECT count(*)=1 FROM public.store_memberships WHERE store_id='f59e3a44-7106-4df8-9c08-52da30c9de30')
 AND (SELECT count(*)=1 FROM public.store_memberships WHERE store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17')
 AND NOT EXISTS(SELECT 1 FROM public.store_memberships d WHERE d.store_id='f59e3a44-7106-4df8-9c08-52da30c9de30' AND NOT EXISTS(SELECT 1 FROM public.store_memberships old WHERE old.store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17' AND old.user_id=d.user_id)) AS sole_existing_member_copied,
 (SELECT count(*)=10 AND bool_and(relrowsecurity) FROM tables) AS private_tables_rls_exact,
 NOT EXISTS(SELECT 1 FROM tables t CROSS JOIN expected_roles r WHERE has_table_privilege(r.name,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
 AND NOT EXISTS(SELECT 1 FROM tables t CROSS JOIN forbidden_roles r JOIN pg_roles p ON p.rolname=r.name WHERE has_table_privilege(r.name,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) AS no_direct_table_privileges,
 (SELECT count(*)=12 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='xero_demo_v1')
 AND (SELECT count(*)=11 AND bool_and(p.prosecdef AND p.proconfig @> ARRAY['search_path=pg_catalog, xero_demo_v1']) FROM private_functions f JOIN pg_proc p ON p.oid=f.oid) AS private_function_contract_present,
 NOT EXISTS(SELECT 1 FROM private_functions f CROSS JOIN forbidden_roles r JOIN pg_roles p ON p.rolname=r.name WHERE has_function_privilege(r.name,f.oid,'EXECUTE'))
 AND NOT EXISTS(SELECT 1 FROM private_functions f CROSS JOIN expected_roles r WHERE r.can_login AND has_function_privilege(r.name,f.oid,'EXECUTE')) AS private_rpcs_exclude_other_roles,
 (SELECT bool_and(has_function_privilege('night_scout_demo_import_service',('xero_demo_v1.'||signature)::regprocedure,'EXECUTE') AND NOT has_function_privilege('night_scout_demo_bootstrap_service',('xero_demo_v1.'||signature)::regprocedure,'EXECUTE')) FROM worker_functions)
 AND (SELECT has_function_privilege('night_scout_demo_bootstrap_service',oid,'EXECUTE') AND NOT has_function_privilege('night_scout_demo_import_service',oid,'EXECUTE') FROM bootstrap) AS services_exact_rpc_split,
 (SELECT count(*)=2 AND bool_and(p.prosecdef AND p.proconfig @> ARRAY['search_path=pg_catalog'] AND has_function_privilege('authenticated',f.oid,'EXECUTE') AND NOT has_function_privilege('anon',f.oid,'EXECUTE')) FROM public_functions f JOIN pg_proc p ON p.oid=f.oid) AS public_member_rpc_acl_exact,
 NOT EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN forbidden_roles r JOIN pg_roles p ON p.rolname=r.name WHERE n.nspname='xero_demo_v1' AND has_schema_privilege(r.name,n.oid,'USAGE')) AS private_schema_not_broadly_granted,
 (SELECT count(*)=0 FROM xero_demo_v1.connections)
 AND (SELECT count(*)=0 FROM xero_demo_v1.account_directories)
 AND (SELECT count(*)=0 FROM xero_demo_v1.mapping_versions)
 AND (SELECT count(*)=0 FROM xero_demo_v1.mapping_selections)
 AND (SELECT count(*)=0 FROM xero_demo_v1.mapping_audit)
 AND (SELECT count(*)=0 FROM xero_demo_v1.credential_envelopes)
 AND (SELECT count(*)=0 FROM xero_demo_v1.credential_audit)
 AND (SELECT count(*)=0 FROM xero_demo_v1.accounting_evidence)
 AND (SELECT count(*)=0 FROM xero_demo_v1.accounting_evidence_audit)
 AND (SELECT count(*)=0 FROM xero_demo_v1.connection_preflight_evidence) AS new_data_empty_before_consent,
 (SELECT count(*)=1 FROM xero_v1.connections WHERE retired_at IS NULL AND store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17')
 AND NOT EXISTS(SELECT 1 FROM xero_v1.connections WHERE store_id='f59e3a44-7106-4df8-9c08-52da30c9de30') AS old_active_reader_remains_separate,
 NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='xero_v1' AND (CASE WHEN p.prokind='f' AND n.nspname='xero_v1' THEN pg_get_functiondef(p.oid) ELSE '' END LIKE '%xero_demo_v1%' OR CASE WHEN p.prokind='f' AND n.nspname='xero_v1' THEN pg_get_functiondef(p.oid) ELSE '' END LIKE '%f59e3a44-7106-4df8-9c08-52da30c9de30%')) AS old_function_graph_has_no_demo_reference,
 NOT has_schema_privilege('night_scout_demo_import_service','xero_v1','USAGE')
 AND NOT has_schema_privilege('night_scout_demo_bootstrap_service','xero_v1','USAGE') AS demo_services_cannot_use_old_schema;
ROLLBACK;
