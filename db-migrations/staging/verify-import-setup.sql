-- Read only. Confirm dashboard project bioalckltvkhlczusdvl first.
SELECT rolname,rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname IN ('night_scout_import_service','night_scout_import_login');
SELECT relrowsecurity FROM pg_class WHERE oid='ingest_v1.import_receipts'::regclass;
SELECT count(*) AS receipt_count FROM ingest_v1.import_receipts;
SELECT polname,pg_get_expr(polqual,polrelid) AS using_expression,pg_get_expr(polwithcheck,polrelid) AS check_expression FROM pg_policy WHERE polname LIKE 'import_%' ORDER BY polname;
SELECT has_table_privilege('night_scout_import_service','public.orders','UPDATE,DELETE,TRUNCATE') AS raw_mutation,has_table_privilege('night_scout_import_service','ingest_v1.import_receipts','UPDATE,DELETE,TRUNCATE') AS receipt_mutation,has_table_privilege('night_scout_import_service','ingest_v1.review_authorizations','INSERT,UPDATE,DELETE,TRUNCATE') AS reviewer_grant,has_table_privilege('night_scout_import_service','ingest_v1.review_audit','INSERT,UPDATE,DELETE,TRUNCATE') AS review_write;
SELECT has_function_privilege('anon','ingest_v1.lock_import_dependencies()','EXECUTE') AS anon_lock,has_function_privilege('authenticated','ingest_v1.lock_import_dependencies()','EXECUTE') AS member_lock;
SELECT store_id,date_from,date_to,sales_and_refunds_complete,evidence_ref FROM finance_v1.coverage_evidence ORDER BY store_id,date_from;
SELECT count(*) AS review_count FROM ingest_v1.review_audit;
