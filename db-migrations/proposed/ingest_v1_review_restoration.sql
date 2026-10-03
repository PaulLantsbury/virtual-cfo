-- LOCAL PROPOSAL ONLY. Requires candidate, finance evidence and invalidation proposals.
BEGIN;
CREATE TABLE ingest_v1.review_authorizations (
 store_id uuid NOT NULL REFERENCES public.stores(id),
 reviewer_id uuid NOT NULL REFERENCES auth.users(id),
 PRIMARY KEY(store_id,reviewer_id)
);
CREATE TABLE ingest_v1.review_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL,
 date_from date NOT NULL, date_to date NOT NULL,
 batch_id uuid NOT NULL,
 review_snapshot jsonb NOT NULL CHECK(jsonb_typeof(review_snapshot)='object'),
 snapshot_digest text NOT NULL CHECK(snapshot_digest ~ '^[0-9a-f]{64}$'),
 reviewer_id uuid NOT NULL REFERENCES auth.users(id),
 evidence_ref text NOT NULL CHECK(length(trim(evidence_ref)) BETWEEN 1 AND 2000),
 completeness_statement text NOT NULL CHECK(length(trim(completeness_statement)) BETWEEN 1 AND 10000),
 reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(store_id,date_from,date_to,batch_id)
 REFERENCES ingest_v1.batches(store_id,date_from,date_to,id),
 UNIQUE(store_id,date_from,date_to,snapshot_digest)
);
ALTER TABLE ingest_v1.review_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_v1.review_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ingest_v1.review_authorizations,ingest_v1.review_audit FROM PUBLIC,anon,authenticated;
CREATE FUNCTION ingest_v1.reject_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Review audit is append-only'; END;
$$;
REVOKE ALL ON FUNCTION ingest_v1.reject_audit_mutation() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER review_audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON ingest_v1.review_audit
 FOR EACH STATEMENT EXECUTE FUNCTION ingest_v1.reject_audit_mutation();
-- Changes to interpretation/evidence must also revoke previously restored coverage.
CREATE TRIGGER ingest_order_evidence_coverage AFTER INSERT OR UPDATE OR DELETE ON finance_v1.order_evidence
 FOR EACH ROW EXECUTE FUNCTION ingest_v1.invalidate_source_change();
CREATE TRIGGER ingest_refund_evidence_coverage AFTER INSERT OR UPDATE OR DELETE ON finance_v1.refund_evidence
 FOR EACH ROW EXECUTE FUNCTION ingest_v1.invalidate_source_change();
COMMIT;
