-- READ ONLY verification for the staging-only Xero bootstrap capability.
SELECT rolname,rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,
       rolreplication,rolbypassrls,rolconnlimit
FROM pg_roles WHERE rolname IN ('night_scout_import_login','night_scout_xero_bootstrap_login') ORDER BY rolname;

SELECT rolname,(rolpassword IS NULL) AS password_is_null
FROM pg_authid WHERE rolname='night_scout_xero_bootstrap_login';

SELECT member.rolname AS member_role,granted.rolname AS granted_role
FROM pg_auth_members membership
JOIN pg_roles member ON member.oid=membership.member
JOIN pg_roles granted ON granted.oid=membership.roleid
WHERE member.rolname IN ('night_scout_import_login','night_scout_xero_bootstrap_login')
   OR granted.rolname IN ('night_scout_import_login','night_scout_xero_bootstrap_login');

SELECT grantee,table_schema,table_name,privilege_type
FROM information_schema.role_table_grants
WHERE grantee IN ('night_scout_import_login','night_scout_xero_bootstrap_login')
  AND table_schema='xero_v1';

SELECT routine_name,grantee,privilege_type
FROM information_schema.role_routine_grants
WHERE routine_schema='xero_v1'
  AND grantee IN ('night_scout_import_login','night_scout_xero_bootstrap_login')
ORDER BY grantee,routine_name;

SELECT grantee,privilege_type
FROM information_schema.usage_privileges
WHERE object_type='SCHEMA' AND object_name='xero_v1'
  AND grantee IN ('night_scout_import_login','night_scout_xero_bootstrap_login')
ORDER BY grantee,privilege_type;

SELECT 'relation' AS object_kind,n.nspname AS schema_name,c.relname AS object_name
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relowner='night_scout_xero_bootstrap_login'::regrole
UNION ALL
SELECT 'function',n.nspname,p.proname
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.proowner='night_scout_xero_bootstrap_login'::regrole
UNION ALL
SELECT 'schema',NULL,n.nspname
FROM pg_namespace n WHERE n.nspowner='night_scout_xero_bootstrap_login'::regrole;

SELECT p.oid::regprocedure,p.prosecdef,pg_get_userbyid(p.proowner) AS owner,p.proconfig,p.proacl
FROM pg_proc p WHERE p.oid='xero_v1.bootstrap_create_initial_connection(uuid,text,uuid,date,timestamptz,jsonb,jsonb,bytea,bytea,text,text)'::regprocedure;
