BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT count(*)=2 AS restricted_roles_present,
 bool_and(NOT rolsuper AND NOT rolinherit AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls) AS capabilities_restricted
FROM pg_catalog.pg_roles WHERE rolname IN ('night_scout_test_writer','night_scout_test_writer_service');
SELECT count(*)=4 AS isolated_rls_tables FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='staging_test_programme' AND c.relkind='r' AND c.relrowsecurity;
SELECT count(*)=8 AS restricted_rpcs FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='staging_test_programme' AND p.prosecdef AND (p.proconfig @> ARRAY['search_path=pg_catalog, staging_test_programme'] OR p.proconfig @> ARRAY['search_path=pg_catalog, staging_test_programme, public']);
SELECT count(*) AS programmes,count(*) FILTER(WHERE enabled) AS enabled_programmes FROM staging_test_programme.programmes;
SELECT count(*) AS action_count FROM staging_test_programme.actions;
SELECT count(*) AS encrypted_writer_envelope_count FROM staging_test_programme.writer_envelopes;
ROLLBACK;
