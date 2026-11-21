-- OFFLINE PROPOSAL. No runtime grants, roles, activation or changes to existing48 summaries.
BEGIN;
CREATE SCHEMA finance_customer_sidecar_v1;
REVOKE ALL ON SCHEMA finance_customer_sidecar_v1 FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA finance_customer_sidecar_v1 REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA finance_customer_sidecar_v1 REVOKE ALL ON FUNCTIONS FROM PUBLIC;
CREATE TABLE finance_customer_sidecar_v1.versions(
 version_id text PRIMARY KEY CHECK(version_id~'^[a-f0-9]{64}$'),
 base_snapshot_id uuid NOT NULL UNIQUE REFERENCES finance_review_supplement_v1.snapshots(snapshot_id),
 base_body_hash text NOT NULL CHECK(base_body_hash~'^[a-f0-9]{64}$'),
 store_id uuid NOT NULL CHECK(store_id='d7500000-0000-4000-8000-000000000009'::uuid),
 financial_version uuid NOT NULL,
 date_from date NOT NULL CHECK(EXTRACT(day FROM date_from)=1),
 date_to date NOT NULL CHECK(date_to=(date_from+interval '1 month'-interval '1 day')::date),
 sales_revision text NOT NULL CHECK(sales_revision~'^[a-f0-9]{64}$'),
 cost_revision text NOT NULL CHECK(cost_revision~'^[a-f0-9]{64}$'),
 body jsonb NOT NULL CHECK(jsonb_typeof(body)='object' AND octet_length(body::text)<=65536),
 CHECK((body ?& ARRAY['contract','baseBodyHash','scope','financialVersionId','salesRevision','costRevision','activity']
 AND body-ARRAY['contract','baseBodyHash','scope','financialVersionId','salesRevision','costRevision','activity']='{}'::jsonb
 AND body->>'contract'='synthetic-customer-summary-sidecar-v1'
 AND body->>'baseBodyHash'=base_body_hash AND body->>'financialVersionId'=financial_version::text
 AND body->>'salesRevision'=sales_revision AND body->>'costRevision'=cost_revision
 AND body->'scope'=jsonb_build_object('storeId',store_id::text,'currency','GBP','timezone','Europe/London','from',date_from::text,'to',date_to::text)
 AND jsonb_typeof(body->'activity')='object') IS TRUE)
);
CREATE TABLE finance_customer_sidecar_v1.selections(
 base_snapshot_id uuid PRIMARY KEY REFERENCES finance_review_supplement_v1.snapshots(snapshot_id),
 version_id text NOT NULL UNIQUE REFERENCES finance_customer_sidecar_v1.versions(version_id),
 selected_by uuid NOT NULL,
 selected_at timestamptz NOT NULL CHECK(isfinite(selected_at))
);
CREATE FUNCTION finance_customer_sidecar_v1.guard_insert() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE owner_allowed boolean; matched boolean;
BEGIN
 SELECT c.relowner=r.oid OR r.rolsuper INTO owner_allowed FROM pg_catalog.pg_class c CROSS JOIN pg_catalog.pg_roles r WHERE c.oid=TG_RELID AND r.rolname=current_user;
 IF NOT coalesce(owner_allowed,false) THEN RAISE EXCEPTION 'Owner-reviewed publication only'; END IF;
 IF TG_TABLE_NAME='versions' THEN
 SELECT EXISTS(SELECT 1 FROM finance_review_supplement_v1.snapshots b WHERE b.snapshot_id=NEW.base_snapshot_id AND b.kind='acquisition' AND NOT b.invalidated
 AND b.body_hash=NEW.base_body_hash AND b.store_id=NEW.store_id AND b.financial_version=NEW.financial_version
 AND b.date_from=NEW.date_from AND b.date_to=NEW.date_to AND b.sales_revision=NEW.sales_revision AND b.cost_revision=NEW.cost_revision) INTO matched;
 ELSE
 SELECT EXISTS(SELECT 1 FROM finance_customer_sidecar_v1.versions v JOIN finance_review_supplement_v1.snapshots b ON b.snapshot_id=v.base_snapshot_id
 JOIN public.store_memberships m ON m.store_id=v.store_id AND m.user_id=NEW.selected_by
 WHERE v.version_id=NEW.version_id AND v.base_snapshot_id=NEW.base_snapshot_id AND b.kind='acquisition' AND NOT b.invalidated AND b.body_hash=v.base_body_hash) INTO matched;
 END IF;
 IF NOT coalesce(matched,false) THEN RAISE EXCEPTION 'Exact valid acquisition base and member selection required'; END IF;
 RETURN NEW;
END$$;
CREATE FUNCTION finance_customer_sidecar_v1.deny_change() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Customer sidecar records and selections are immutable'; END$$;
CREATE TRIGGER version_insert BEFORE INSERT ON finance_customer_sidecar_v1.versions FOR EACH ROW EXECUTE FUNCTION finance_customer_sidecar_v1.guard_insert();
CREATE TRIGGER selection_insert BEFORE INSERT ON finance_customer_sidecar_v1.selections FOR EACH ROW EXECUTE FUNCTION finance_customer_sidecar_v1.guard_insert();
CREATE TRIGGER version_change BEFORE UPDATE OR DELETE ON finance_customer_sidecar_v1.versions FOR EACH ROW EXECUTE FUNCTION finance_customer_sidecar_v1.deny_change();
CREATE TRIGGER selection_change BEFORE UPDATE OR DELETE ON finance_customer_sidecar_v1.selections FOR EACH ROW EXECUTE FUNCTION finance_customer_sidecar_v1.deny_change();
CREATE TRIGGER version_truncate BEFORE TRUNCATE ON finance_customer_sidecar_v1.versions FOR EACH STATEMENT EXECUTE FUNCTION finance_customer_sidecar_v1.deny_change();
CREATE TRIGGER selection_truncate BEFORE TRUNCATE ON finance_customer_sidecar_v1.selections FOR EACH STATEMENT EXECUTE FUNCTION finance_customer_sidecar_v1.deny_change();
ALTER TABLE finance_customer_sidecar_v1.versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_customer_sidecar_v1.selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_read ON finance_customer_sidecar_v1.versions FOR SELECT USING(
 EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.store_id=versions.store_id AND m.user_id=NULLIF(current_setting('night_scout.profit_user_id',true),'')::uuid)
 AND EXISTS(SELECT 1 FROM finance_review_supplement_v1.snapshots b WHERE b.snapshot_id=versions.base_snapshot_id AND b.kind='acquisition' AND NOT b.invalidated AND b.body_hash=versions.base_body_hash));
CREATE POLICY member_read ON finance_customer_sidecar_v1.selections FOR SELECT USING(
 EXISTS(SELECT 1 FROM finance_customer_sidecar_v1.versions v WHERE v.version_id=selections.version_id AND v.base_snapshot_id=selections.base_snapshot_id));
REVOKE ALL ON ALL TABLES IN SCHEMA finance_customer_sidecar_v1 FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finance_customer_sidecar_v1 FROM PUBLIC;
-- SQL checks storage/bindings; trusted reader MUST verify canonical JSON digest,
-- full activity validation and current financial dependency in same read transaction.
COMMIT;
