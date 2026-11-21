-- LOCAL PROPOSAL ONLY. First-import backend capability, never a merchant role.
BEGIN;
CREATE ROLE night_scout_import_service NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA public,finance_v1,ingest_v1 TO night_scout_import_service;
GRANT SELECT ON public.stores,public.orders,public.refunds,finance_v1.order_evidence,finance_v1.refund_evidence,finance_v1.coverage_evidence,finance_v1.order_mapping,finance_v1.refund_mapping,ingest_v1.batches,ingest_v1.heads,ingest_v1.source_versions TO night_scout_import_service;
GRANT INSERT ON public.orders,public.refunds,finance_v1.order_evidence,finance_v1.refund_evidence,finance_v1.coverage_evidence TO night_scout_import_service;
-- Existing invoker invalidation triggers need these narrowly bounded updates.
GRANT UPDATE(sales_and_refunds_complete) ON finance_v1.coverage_evidence TO night_scout_import_service;
GRANT UPDATE(needs_recheck) ON ingest_v1.heads TO night_scout_import_service;
DO $$ DECLARE relation text; BEGIN
 FOREACH relation IN ARRAY ARRAY['public.stores','public.orders','public.refunds','finance_v1.order_evidence','finance_v1.refund_evidence','finance_v1.coverage_evidence','ingest_v1.batches','ingest_v1.heads','ingest_v1.source_versions'] LOOP
 EXECUTE format('CREATE POLICY import_service_read ON %s FOR SELECT TO night_scout_import_service USING(true)',relation);
 END LOOP;
 FOREACH relation IN ARRAY ARRAY['public.orders','public.refunds','finance_v1.order_evidence','finance_v1.refund_evidence'] LOOP
 EXECUTE format('CREATE POLICY import_service_insert ON %s FOR INSERT TO night_scout_import_service WITH CHECK(true)',relation);
 END LOOP;
END $$;
CREATE POLICY import_service_coverage_insert ON finance_v1.coverage_evidence FOR INSERT TO night_scout_import_service WITH CHECK(NOT sales_and_refunds_complete);
CREATE POLICY import_service_invalidate ON finance_v1.coverage_evidence FOR UPDATE TO night_scout_import_service USING(true) WITH CHECK(NOT sales_and_refunds_complete);
CREATE POLICY import_service_recheck ON ingest_v1.heads FOR UPDATE TO night_scout_import_service USING(true) WITH CHECK(needs_recheck);
GRANT EXECUTE ON FUNCTION ingest_v1.invalidate_verified_store(uuid) TO night_scout_import_service;
CREATE FUNCTION ingest_v1.lock_import_dependencies() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 LOCK TABLE public.stores,public.orders,public.refunds,finance_v1.order_evidence,finance_v1.refund_evidence,finance_v1.coverage_evidence,ingest_v1.source_versions,ingest_v1.batches,ingest_v1.heads IN SHARE ROW EXCLUSIVE MODE;
END $$;
REVOKE ALL ON FUNCTION ingest_v1.lock_import_dependencies() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ingest_v1.lock_import_dependencies() TO night_scout_import_service;
COMMIT;
