-- READ-ONLY staging verification after the 24 September follow-up.
SELECT to_regprocedure('xero_v1.bootstrap_create_initial_connection(uuid,text,uuid,date,timestamptz,jsonb,jsonb,bytea,bytea,text,text)') IS NULL AS old_bootstrap_removed,
 to_regprocedure('xero_v1.bootstrap_create_initial_connection(uuid,uuid,text,uuid,date,timestamptz,jsonb,jsonb,bytea,bytea,text,text)') IS NOT NULL AS bound_bootstrap_present;

SELECT p.oid::regprocedure,p.prosecdef,pg_get_userbyid(p.proowner) owner,p.proconfig,p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='xero_v1' AND p.proname IN
 ('bootstrap_create_initial_connection','worker_get_refresh_context','worker_get_latest_supported_evidence',
  'worker_acquire_refresh_lease','worker_release_refresh_lease')
   OR (n.nspname='xero_v1' AND p.proname='worker_store_refresh_envelope_leased')
ORDER BY p.proname;

SELECT grantee,routine_name,privilege_type FROM information_schema.role_routine_grants
WHERE routine_schema='xero_v1' AND grantee IN ('night_scout_import_login','night_scout_xero_bootstrap_login')
ORDER BY grantee,routine_name;

SELECT
 NOT has_function_privilege('night_scout_import_login','xero_v1.worker_store_refresh_envelope(uuid,bytea,bytea,text,text,integer,timestamptz)','EXECUTE') AS unfenced_rotation_revoked,
 has_function_privilege('night_scout_import_login','xero_v1.worker_acquire_refresh_lease(uuid,integer,integer)','EXECUTE') AS acquire_granted,
 has_function_privilege('night_scout_import_login','xero_v1.worker_release_refresh_lease(uuid,integer,timestamptz)','EXECUTE') AS fenced_release_granted,
 has_function_privilege('night_scout_import_login','xero_v1.worker_store_refresh_envelope_leased(uuid,bytea,bytea,text,text,integer,integer,timestamptz)','EXECUTE') AS fenced_rotation_granted;

SELECT grantee,table_name,privilege_type FROM information_schema.role_table_grants
WHERE table_schema='xero_v1' AND grantee IN ('night_scout_import_login','night_scout_xero_bootstrap_login');

SELECT member.rolname member_role,granted.rolname granted_role FROM pg_auth_members m
JOIN pg_roles member ON member.oid=m.member JOIN pg_roles granted ON granted.oid=m.roleid
WHERE member.rolname IN ('night_scout_import_login','night_scout_xero_bootstrap_login')
   OR granted.rolname IN ('night_scout_import_login','night_scout_xero_bootstrap_login');
