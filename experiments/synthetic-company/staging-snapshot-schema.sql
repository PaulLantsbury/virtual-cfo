-- PROPOSAL FIXTURE ONLY. Not a migration or an application instruction.
-- Requires inspected public.stores and finance_v1.profit_evidence_versions.
-- No public RPC, browser policy, grant, default source timestamp or backfill.
BEGIN;
CREATE TABLE finance_v1.reporting_snapshots (
 snapshot_id uuid PRIMARY KEY,
 store_id uuid NOT NULL REFERENCES public.stores(id),
 date_from date NOT NULL, date_to date NOT NULL CHECK(date_to>=date_from),
 currency text NOT NULL CHECK(currency='GBP'),
 timezone text NOT NULL CHECK(timezone='Europe/London'),
 source_basis text NOT NULL CHECK(source_basis IN ('synthetic-local','shopify-operational','xero-accounting')),
 formula_version text NOT NULL CHECK(length(trim(formula_version))>0),
 contract_version integer NOT NULL CHECK(contract_version=1),
 sales_revision text NOT NULL CHECK(length(trim(sales_revision))>0),
 profit_version_id uuid,
 source_as_of timestamptz NOT NULL CHECK(isfinite(source_as_of)),
 observed_at timestamptz NOT NULL CHECK(isfinite(observed_at) AND observed_at>=source_as_of),
 manifest_digest text NOT NULL CHECK(manifest_digest ~ '^[a-f0-9]{64}$'),
 profile_version text,
 coverage jsonb NOT NULL CHECK(jsonb_typeof(coverage)='object' AND coverage ? 'sales' AND coverage ? 'costs'
  AND coverage->>'sales'='complete' AND coverage->>'costs' IN ('complete','incomplete','unavailable')),
 CHECK(coverage->>'costs'<>'complete' OR profit_version_id IS NOT NULL),
 CHECK(source_basis<>'synthetic-local' OR length(trim(profile_version))>0 AND profile_version IS NOT NULL),
 UNIQUE(snapshot_id,store_id),
 FOREIGN KEY(profit_version_id,store_id) REFERENCES finance_v1.profit_evidence_versions(id,store_id)
);
CREATE FUNCTION finance_v1.check_reporting_profit_scope() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.profit_version_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM finance_v1.profit_evidence_versions p WHERE p.id=NEW.profit_version_id AND p.store_id=NEW.store_id
 AND p.date_from=NEW.date_from AND p.date_to=NEW.date_to AND p.currency=NEW.currency
 ) THEN RAISE EXCEPTION 'Snapshot profit scope mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reporting_profit_scope BEFORE INSERT ON finance_v1.reporting_snapshots FOR EACH ROW EXECUTE FUNCTION finance_v1.check_reporting_profit_scope();
CREATE TABLE finance_v1.reporting_snapshot_invalidations (
 snapshot_id uuid PRIMARY KEY,
 store_id uuid NOT NULL,
 observed_at timestamptz NOT NULL CHECK(isfinite(observed_at)),
 reason text NOT NULL CHECK(length(trim(reason))>0),
 FOREIGN KEY(snapshot_id,store_id) REFERENCES finance_v1.reporting_snapshots(snapshot_id,store_id)
);
CREATE FUNCTION finance_v1.reject_reporting_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Reporting snapshot evidence is append-only'; END $$;
CREATE TRIGGER reporting_snapshots_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_v1.reporting_snapshots FOR EACH STATEMENT EXECUTE FUNCTION finance_v1.reject_reporting_snapshot_mutation();
CREATE TRIGGER reporting_invalidations_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_v1.reporting_snapshot_invalidations FOR EACH STATEMENT EXECUTE FUNCTION finance_v1.reject_reporting_snapshot_mutation();
ALTER TABLE finance_v1.reporting_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_v1.reporting_snapshot_invalidations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON finance_v1.reporting_snapshots,finance_v1.reporting_snapshot_invalidations FROM PUBLIC;
REVOKE ALL ON FUNCTION finance_v1.check_reporting_profit_scope(),finance_v1.reject_reporting_snapshot_mutation() FROM PUBLIC;
-- No policies: non-owner access defaults to deny. Trusted reader must join
-- invalidations in the same authorised repeatable-read transaction; never
-- select a single arbitrary version. Owner/DBA bypass is not an application role.
COMMIT;
