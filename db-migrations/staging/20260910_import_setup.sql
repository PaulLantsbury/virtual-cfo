-- STAGING ONLY: manually confirm project bioalckltvkhlczusdvl.
-- Installs a non-login role and empty receipt table; no importer is enabled.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF to_regclass('ingest_v1.review_audit') IS NULL OR to_regprocedure('ingest_v1.lock_review_dependencies()') IS NULL THEN RAISE EXCEPTION 'Review baseline missing'; END IF;
 IF to_regclass('ingest_v1.import_receipts') IS NOT NULL OR to_regprocedure('ingest_v1.lock_import_dependencies()') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('night_scout_import_service','night_scout_import_login')) THEN RAISE EXCEPTION 'Importer objects already exist'; END IF;
 IF (SELECT count(*) FROM public.stores)<>2 OR (SELECT count(*) FROM public.stores WHERE id IN ('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002'))<>2 THEN RAISE EXCEPTION 'Unexpected staging stores'; END IF;
END $guard$;

-- Source: ingest_v1_import_service.sql
-- LOCAL PROPOSAL ONLY. First-import backend capability, never a merchant role.
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


-- Source: ingest_v1_import_receipts.sql
-- LOCAL PROPOSAL ONLY. Requires ingest_v1_import_service.sql.
CREATE TABLE ingest_v1.import_receipts (
 batch_id uuid PRIMARY KEY,
 store_id uuid NOT NULL,
 date_from date NOT NULL,date_to date NOT NULL,
 source_fingerprint text NOT NULL CHECK(source_fingerprint ~ '^[0-9a-f]{64}$'),
 order_count integer NOT NULL CHECK(order_count>0),
 refund_count integer NOT NULL CHECK(refund_count>=0),
 completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(store_id,date_from,date_to,batch_id) REFERENCES ingest_v1.batches(store_id,date_from,date_to,id)
);
ALTER TABLE ingest_v1.import_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ingest_v1.import_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON ingest_v1.import_receipts TO night_scout_import_service;
CREATE POLICY import_receipt_read ON ingest_v1.import_receipts FOR SELECT TO night_scout_import_service USING(true);
CREATE POLICY import_receipt_append ON ingest_v1.import_receipts FOR INSERT TO night_scout_import_service WITH CHECK(true);
CREATE FUNCTION ingest_v1.reject_import_receipt_mutation() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Import receipts are append-only'; END $$;
REVOKE ALL ON FUNCTION ingest_v1.reject_import_receipt_mutation() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER import_receipt_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON ingest_v1.import_receipts FOR EACH STATEMENT EXECUTE FUNCTION ingest_v1.reject_import_receipt_mutation();

COMMIT;
