-- LOCAL PROPOSAL ONLY: private candidate intake, not financial evidence publication.
-- No runner registration, API exposure, importer credentials or remote application.
BEGIN;
CREATE SCHEMA ingest_v1;
REVOKE ALL ON SCHEMA ingest_v1 FROM PUBLIC, anon, authenticated;
CREATE TABLE ingest_v1.batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES public.stores(id),
 date_from date NOT NULL, date_to date NOT NULL CHECK(date_to>=date_from),
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 mapping_state text NOT NULL CHECK(mapping_state IN ('mapped_for_review','blocked')),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 coverage_certified boolean NOT NULL DEFAULT false CHECK(coverage_certified=false),
 created_at timestamptz NOT NULL DEFAULT now(), superseded_at timestamptz,
 UNIQUE(store_id,date_from,date_to,fingerprint),
 UNIQUE(store_id,date_from,date_to,id)
);
CREATE TABLE ingest_v1.heads (
 store_id uuid NOT NULL, date_from date NOT NULL, date_to date NOT NULL,
 batch_id uuid NOT NULL,
 needs_recheck boolean NOT NULL DEFAULT false,
 PRIMARY KEY(store_id,date_from,date_to),
 FOREIGN KEY(store_id,date_from,date_to,batch_id)
 REFERENCES ingest_v1.batches(store_id,date_from,date_to,id)
);
CREATE TABLE ingest_v1.source_versions (
 store_id uuid NOT NULL REFERENCES public.stores(id),
 source_id text NOT NULL, source_version timestamptz NOT NULL,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 PRIMARY KEY(store_id,source_id)
);
ALTER TABLE ingest_v1.source_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_v1.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_v1.heads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA ingest_v1 FROM PUBLIC,anon,authenticated;
COMMIT;
