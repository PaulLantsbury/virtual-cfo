-- READ ONLY, operator in verified Night Scout Staging project only.
-- No passwords, hashes, OAuth envelopes, tokens, or real customer/order IDs returned.
BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT rolname,rolcanlogin,rolconnlimit,rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls
FROM pg_catalog.pg_roles WHERE rolname IN ('night_scout_test_writer','night_scout_test_writer_service');
SELECT r.rolname AS role_name,u.rolname AS member_name,m.admin_option,m.inherit_option,m.set_option
FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.roleid JOIN pg_catalog.pg_roles u ON u.oid=m.member
WHERE u.rolname IN ('night_scout_test_writer','night_scout_test_writer_service');
SELECT programme_key,provider,project_ref,target,starts_at,ends_at,action_cap,enabled,stopped,
 (SELECT count(*) FROM staging_test_programme.actions a WHERE a.programme_key=p.programme_key) AS action_count,
 (SELECT count(*) FROM staging_test_programme.actions a WHERE a.programme_key=p.programme_key AND a.state IN ('claimed','submitted','uncertain')) AS unresolved_count
FROM staging_test_programme.programmes p ORDER BY programme_key;
SELECT to_regprocedure('staging_test_programme.shopify_daily_20261029_ready(text,text,text,integer)') IS NOT NULL AS renewed_daily_rpc_present;
ROLLBACK;
-- Password presence is deliberately excluded: if needed, a suitably privileged operator
-- checks only a boolean privately. Do not query or display pg_authid.rolpassword itself.
