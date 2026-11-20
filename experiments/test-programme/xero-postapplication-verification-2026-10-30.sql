-- READ ONLY, verified Night Scout Staging operator session only.
-- No provider calls, credential/envelope bytes, IDs, claims or account names returned.
-- This is post-application metadata verification, NOT consent/activation authority.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='15s';
WITH signatures(name) AS (VALUES
 ('staging_test_programme.claim_action(text,text,text,text,text,integer)'),
 ('staging_test_programme.claim_action_before_xero_20261030(text,text,text,text,text,integer)'),
 ('staging_test_programme.claim_action_before_20261029(text,text,text,text,text,integer)'),
 ('staging_test_programme.start_xero_20261030_consent(text,uuid,uuid)'),
 ('staging_test_programme.consume_xero_20261030_consent(text,uuid,uuid)'),
 ('staging_test_programme.seed_xero_20261030_consent(text,uuid,uuid,uuid,uuid,bytea,bytea,text)'),
 ('staging_test_programme.xero_daily_20261030_ready(text,text,text,integer)'),
 ('public.xero_member_active_tenant_binding_v1(uuid)')
), functions AS (
 SELECT s.name,p.* FROM signatures s
 LEFT JOIN pg_catalog.pg_proc p ON p.oid=to_regprocedure(s.name)
)
SELECT jsonb_build_object(
 'transaction_read_only',current_setting('transaction_read_only')='on',
 'expected_functions_present',(SELECT count(*)=8 AND bool_and(oid IS NOT NULL) FROM functions),
 'functions_security_definer',(SELECT bool_and(prosecdef) FROM functions),
 'function_public_execution_closed',NOT EXISTS(
  SELECT 1 FROM functions p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
  WHERE a.grantee=0 AND a.privilege_type='EXECUTE'),
 'service_outer_claim_allowed',has_function_privilege('night_scout_test_writer_service','staging_test_programme.claim_action(text,text,text,text,text,integer)','EXECUTE'),
 'login_outer_claim_denied',NOT has_function_privilege('night_scout_test_writer','staging_test_programme.claim_action(text,text,text,text,text,integer)','EXECUTE'),
 'underlying_claim_chain_closed',NOT EXISTS(
  SELECT 1 FROM (VALUES('night_scout_test_writer'),('night_scout_test_writer_service'),('anon'),('authenticated')) r(role_name)
  CROSS JOIN (VALUES
   ('staging_test_programme.claim_action_before_xero_20261030(text,text,text,text,text,integer)'),
   ('staging_test_programme.claim_action_before_20261029(text,text,text,text,text,integer)')) f(signature)
  WHERE has_function_privilege(r.role_name,f.signature,'EXECUTE')),
 'shopify_claim_gate_preserved',position('shopify_daily_20261029_ready' IN pg_get_functiondef('staging_test_programme.claim_action_before_xero_20261030(text,text,text,text,text,integer)'::regprocedure))>0,
 'xero_outer_chains_shopify_wrapper',position('claim_action_before_xero_20261030' IN pg_get_functiondef('staging_test_programme.claim_action(text,text,text,text,text,integer)'::regprocedure))>0,
 'new_xero_service_rpcs_allowed',NOT EXISTS(
  SELECT 1 FROM functions WHERE name IN (
   'staging_test_programme.start_xero_20261030_consent(text,uuid,uuid)',
   'staging_test_programme.consume_xero_20261030_consent(text,uuid,uuid)',
   'staging_test_programme.seed_xero_20261030_consent(text,uuid,uuid,uuid,uuid,bytea,bytea,text)',
   'staging_test_programme.xero_daily_20261030_ready(text,text,text,integer)')
  AND NOT has_function_privilege('night_scout_test_writer_service',name,'EXECUTE')),
 'member_rpc_authenticated_allowed',has_function_privilege('authenticated','public.xero_member_active_tenant_binding_v1(uuid)','EXECUTE'),
 'member_rpc_nonmember_execution_closed',NOT EXISTS(
  SELECT 1 FROM (VALUES('anon'),('service_role'),('night_scout_test_writer'),('night_scout_test_writer_service')) r(role_name)
  WHERE has_function_privilege(r.role_name,'public.xero_member_active_tenant_binding_v1(uuid)','EXECUTE')),
 'required_tables_rls_intact',(SELECT count(*)=5 AND bool_and(relrowsecurity) FROM pg_catalog.pg_class WHERE oid IN (
  'public.store_memberships'::regclass,'xero_v1.connections'::regclass,
  'staging_test_programme.programmes'::regclass,'staging_test_programme.writer_envelopes'::regclass,
  'staging_test_programme.xero_restart_20261030_oauth_states'::regclass)),
 'writer_reader_table_access_denied',NOT EXISTS(
  SELECT 1 FROM (VALUES('night_scout_test_writer'),('night_scout_test_writer_service')) r(role_name)
  CROSS JOIN (VALUES('xero_v1.connections'),('xero_v1.credential_envelopes')) t(table_name)
  WHERE has_table_privilege(r.role_name,t.table_name,'SELECT')),
 'new_xero_programme_absent',NOT EXISTS(SELECT 1 FROM staging_test_programme.programmes WHERE programme_key='xero-staging-20261030'),
 'new_xero_envelope_absent',NOT EXISTS(SELECT 1 FROM staging_test_programme.writer_envelopes WHERE programme_key='xero-staging-20261030'),
 'new_xero_actions_absent',NOT EXISTS(SELECT 1 FROM staging_test_programme.actions WHERE programme_key='xero-staging-20261030'),
 'new_xero_consent_states_absent',NOT EXISTS(SELECT 1 FROM staging_test_programme.xero_restart_20261030_oauth_states),
 'shopify_exact_active_binding_preserved',EXISTS(SELECT 1 FROM staging_test_programme.programmes
  WHERE programme_key='shopify-staging-20261029' AND provider='shopify'
  AND project_ref='bioalckltvkhlczusdvl' AND target='pocketlaunchpad1.myshopify.com'
  AND starts_at='2026-10-29T00:00:00Z'::timestamptz AND ends_at='2026-11-05T00:00:00Z'::timestamptz
  AND action_cap=7 AND enabled AND NOT stopped),
 'shopify_action_count_within_cap',(SELECT count(*)<=7 FROM staging_test_programme.actions WHERE programme_key='shopify-staging-20261029')
) AS postapplication_metadata;
ROLLBACK;

-- SQL-only member-scope probe. This does NOT validate a signed JWT, AAL2, browser
-- login, Data API transport or live provider health. Derive the sole existing
-- member privately; refuse ambiguity rather than selecting an arbitrary account.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='15s';
DO $member_context$
DECLARE chosen_member uuid; membership_count integer;
BEGIN
 SELECT count(*),min(m.user_id::text)::uuid INTO membership_count,chosen_member
 FROM public.store_memberships m WHERE m.store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17';
 IF membership_count<>1 OR chosen_member IS NULL THEN RAISE EXCEPTION 'Unique existing store-member context required for SQL-only probe'; END IF;
 PERFORM set_config('request.jwt.claim.sub',chosen_member::text,true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',chosen_member,'role','authenticated','aud','authenticated')::text,true);
END $member_context$;
SET LOCAL ROLE authenticated;
SELECT jsonb_build_object(
 'read_only',current_setting('transaction_read_only')='on',
 'member_role',current_user='authenticated',
 'sql_member_binding_returns_exact_single_scope',count(*)=1 AND bool_and(store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17'::uuid AND tenant_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'),
 'signed_owner_login_verified',false,'reader_health_verified',false
) AS sql_member_scope_probe
FROM public.xero_member_active_tenant_binding_v1('56d92f8a-746e-4b4f-b408-81fc98c4aa17'::uuid);
ROLLBACK;

-- Enrollment metadata only. A verified factor count is NOT an actual AAL2 login.
-- No names, email addresses, user/factor identifiers, secrets or recovery data.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='15s';
WITH member_context AS (
 SELECT m.user_id FROM public.store_memberships m
 WHERE m.store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17'
), sole_member AS (
 SELECT user_id FROM member_context WHERE (SELECT count(*) FROM member_context)=1
)
SELECT jsonb_build_object(
 'unique_existing_store_member',(SELECT count(*)=1 FROM member_context),
 'verified_totp_factor_count',(SELECT count(*) FROM auth.mfa_factors f
  JOIN sole_member m ON m.user_id=f.user_id WHERE f.factor_type='totp' AND f.status='verified'),
 'live_mfa_login_verified',false
) AS owner_mfa_enrollment_metadata;
ROLLBACK;
