-- LOCAL PROPOSAL ONLY. Requires ingest_v1_import_service.sql.
BEGIN;
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
