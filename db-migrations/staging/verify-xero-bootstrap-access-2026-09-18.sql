-- READ ONLY verification for the staging-only Xero bootstrap capability.
SELECT rolname,rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,
       rolreplication,rolbypassrls,rolconnlimit
FROM pg_roles WHERE rolname IN ('night_scout_import_login','night_scout_xero_bootstrap_login') ORDER BY rolname;

SELECT grantee,table_schema,table_name,privilege_type
FROM information_schema.role_table_grants
WHERE grantee='night_scout_xero_bootstrap_login' AND table_schema='xero_v1';

SELECT routine_name,grantee,privilege_type
FROM information_schema.role_routine_grants
WHERE routine_schema='xero_v1' AND routine_name='bootstrap_create_initial_connection'
ORDER BY grantee;

SELECT p.oid::regprocedure,p.prosecdef,pg_get_userbyid(p.proowner) AS owner
FROM pg_proc p WHERE p.oid='xero_v1.bootstrap_create_initial_connection(uuid,text,uuid,date,timestamptz,jsonb,jsonb,bytea,bytea,text,text)'::regprocedure;
