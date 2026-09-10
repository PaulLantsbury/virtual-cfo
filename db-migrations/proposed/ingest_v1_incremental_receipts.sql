-- Local proposal only. Counts remain newly inserted records for each batch.
-- Required for refund-only and no-new-event imports. Existing receipts unchanged.
BEGIN;
ALTER TABLE ingest_v1.import_receipts DROP CONSTRAINT import_receipts_order_count_check;
ALTER TABLE ingest_v1.import_receipts ADD CONSTRAINT import_receipts_order_count_check CHECK(order_count>=0);
COMMIT;
