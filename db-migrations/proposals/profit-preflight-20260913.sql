-- READ ONLY preflight; run only against explicitly verified staging connection.
-- This SQL cannot establish the Supabase project URL; operator must separately
-- confirm project bioalckltvkhlczusdvl. No migration or automatic corrections.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT current_database() database_name,current_user database_role,version() postgres_version;
SELECT n.nspname schema_name,c.relname object_name,c.relkind,c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','finance_v1','ingest_v1') AND c.relname IN
('stores','store_memberships','orders','order_line_items','refunds','overhead_entries','overhead_categories','marketing_channel_daily_metrics','order_evidence','refund_evidence','coverage_evidence','order_mapping','refund_mapping','profit_evidence_versions','line_cost_evidence','stock_return_evidence','expense_evidence','profit_component_coverage','review_audit','import_receipts')
ORDER BY 1,2;
SELECT count(*) FILTER(WHERE table_name IN ('profit_evidence_versions','line_cost_evidence','stock_return_evidence','expense_evidence','profit_component_coverage')) profit_columns_present,
 count(*) FILTER(WHERE table_name IN ('order_evidence','refund_evidence','coverage_evidence')) sales_evidence_columns_present
FROM information_schema.columns WHERE table_schema='finance_v1';
SELECT count(*) profit_guard_functions,count(*) FILTER(WHERE prosecdef) elevated_guard_functions
FROM pg_proc WHERE pronamespace='finance_v1'::regnamespace AND proname='profit_evidence_guard';
SELECT count(*) new_profit_client_table_grants FROM information_schema.table_privileges WHERE table_schema='finance_v1'
AND table_name IN ('profit_evidence_versions','line_cost_evidence','stock_return_evidence','expense_evidence','profit_component_coverage')
AND grantee IN ('PUBLIC','anon','authenticated','service_role');
SELECT conname,pg_get_constraintdef(oid) definition FROM pg_constraint
WHERE conname IN ('chk_overhead_entries_source','mcdm_channel_check','mcdm_source_check','uq_overhead_entries_store_cat_period_type_recurring') ORDER BY conname;
SELECT id,name,currency_code,timezone FROM public.stores
WHERE id IN ('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000004')
OR shopify_domain='night-scout-profit-fixture-d.invalid' ORDER BY id;
SELECT store_id,count(*) original_records FROM public.orders GROUP BY store_id ORDER BY store_id;
SELECT store_id,count(*) refund_records FROM public.refunds GROUP BY store_id ORDER BY store_id;
SELECT store_id,date_from,date_to,currency,sales_and_refunds_complete FROM finance_v1.coverage_evidence ORDER BY store_id,date_from;
SELECT 'orders' source,count(*) reserved_id_collisions FROM public.orders WHERE id::text LIKE '94000000-0000-4000-8000-%'
UNION ALL SELECT 'lines',count(*) FROM public.order_line_items WHERE id::text LIKE '94000000-0000-4000-8000-%'
UNION ALL SELECT 'refunds',count(*) FROM public.refunds WHERE id::text LIKE '94000000-0000-4000-8000-%'
UNION ALL SELECT 'overhead_entries',count(*) FROM public.overhead_entries WHERE id::text LIKE '94000000-0000-4000-8000-%'
UNION ALL SELECT 'overhead_categories',count(*) FROM public.overhead_categories WHERE id::text LIKE '94000000-0000-4000-8000-%'
UNION ALL SELECT 'marketing',count(*) FROM public.marketing_channel_daily_metrics WHERE id::text LIKE '94000000-0000-4000-8000-%';
COMMIT;
