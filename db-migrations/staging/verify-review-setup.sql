-- READ ONLY. Confirm project bioalckltvkhlczusdvl in dashboard first.
SELECT n.nspname,c.relname,c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='ingest_v1' AND c.relkind='r' ORDER BY c.relname;
SELECT rolname,rolcanlogin,rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls
FROM pg_roles WHERE rolname IN ('night_scout_review_service','night_scout_review_login');
SELECT p.proname,p.prosecdef,pg_get_userbyid(p.proowner) AS owner,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS member_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ingest_v1' ORDER BY p.proname;
SELECT 'candidate batches' AS item,count(*) FROM ingest_v1.batches
UNION ALL SELECT 'review assignments',count(*) FROM ingest_v1.review_authorizations
UNION ALL SELECT 'review audits',count(*) FROM ingest_v1.review_audit;
SELECT store_id,date_from,date_to,currency,sales_and_refunds_complete
FROM finance_v1.coverage_evidence ORDER BY store_id,date_from,date_to;
SELECT has_table_privilege('night_scout_review_service','public.orders','INSERT,UPDATE,DELETE,TRUNCATE') AS source_mutation,
 has_table_privilege('night_scout_review_service','ingest_v1.review_authorizations','INSERT,UPDATE,DELETE,TRUNCATE') AS self_grant,
 has_table_privilege('night_scout_review_service','ingest_v1.review_audit','UPDATE,DELETE,TRUNCATE') AS audit_mutation;
