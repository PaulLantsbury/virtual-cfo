-- READ ONLY. First confirm dashboard project bioalckltvkhlczusdvl.
-- Do not apply if ingest_v1/review roles exist or baseline identities differ.
SELECT to_regnamespace('ingest_v1') AS intake_schema,
 to_regclass('finance_v1.coverage_evidence') AS coverage_table,
 to_regprocedure('public.verified_sales_source(uuid,date,date)') AS member_sales_rpc;
SELECT rolname FROM pg_roles WHERE rolname IN ('night_scout_review_service','night_scout_review_login');
SELECT id,currency_code,timezone FROM public.stores ORDER BY id;
SELECT id,store_id FROM public.orders ORDER BY id;
SELECT store_id,date_from,date_to,currency,sales_and_refunds_complete
 FROM finance_v1.coverage_evidence ORDER BY store_id,date_from,date_to;
