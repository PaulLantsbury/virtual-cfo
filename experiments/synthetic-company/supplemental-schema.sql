-- PREPARED PROPOSAL ONLY. Requires existing history-v2 and correction schema.
-- No role/login creation, private binding, runtime grants, publication or activation.
BEGIN;
CREATE SCHEMA finance_review_supplement_v1;
REVOKE ALL ON SCHEMA finance_review_supplement_v1 FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA finance_review_supplement_v1 REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA finance_review_supplement_v1 REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA finance_review_supplement_v1 REVOKE ALL ON FUNCTIONS FROM PUBLIC;
CREATE TABLE finance_review_supplement_v1.snapshots(
 snapshot_id uuid PRIMARY KEY,
 store_id uuid NOT NULL REFERENCES public.stores(id) CHECK(store_id='d7500000-0000-4000-8000-000000000009'::uuid),
 date_from date NOT NULL CHECK(EXTRACT(day FROM date_from)=1),
 date_to date NOT NULL CHECK(date_to=(date_from+interval '1 month'-interval '1 day')::date),
 kind text NOT NULL CHECK(kind IN('cash','acquisition')),
 financial_version uuid NOT NULL,
 sales_revision text NOT NULL CHECK(sales_revision~'^[a-f0-9]{64}$'),
 cost_revision text NOT NULL CHECK(cost_revision~'^[a-f0-9]{64}$'),
 body jsonb NOT NULL CHECK(jsonb_typeof(body)='object' AND octet_length(body::text)<=1048576),
 body_hash text NOT NULL CHECK(body_hash~'^[a-f0-9]{64}$'),
 observed_at timestamptz NOT NULL CHECK(isfinite(observed_at)),
 invalidated boolean NOT NULL DEFAULT false,
 UNIQUE(store_id,date_from,date_to,kind,financial_version),
 CONSTRAINT supplement_body_exact CHECK((
  body ?& ARRAY['contract','kind','scope','financialVersionId','salesRevision','costRevision','sourceBasis','observedAt','payload']
  AND body-ARRAY['contract','kind','scope','financialVersionId','salesRevision','costRevision','sourceBasis','observedAt','payload']='{}'::jsonb
  AND body->>'contract'='reviewed-supplement-v1' AND body->>'kind'=kind
  AND body->>'financialVersionId'=financial_version::text
  AND body->>'salesRevision'=sales_revision AND body->>'costRevision'=cost_revision
  AND body->>'sourceBasis'='synthetic-local' AND jsonb_typeof(body->'payload')='object'
  AND jsonb_typeof(body->'scope')='object'
  AND body->'scope'=jsonb_build_object('storeId',store_id::text,'currency','GBP','timezone','Europe/London','from',date_from::text,'to',date_to::text)
  AND jsonb_typeof(body->'observedAt')='string'
  AND body->>'observedAt'~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$'
  AND (body->>'observedAt')::timestamptz=observed_at
  AND observed_at>=((date_to+1)::timestamp AT TIME ZONE 'Europe/London')
 ) IS TRUE)
);
ALTER TABLE finance_review_supplement_v1.snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplement_member_read ON finance_review_supplement_v1.snapshots FOR SELECT USING(
 store_id='d7500000-0000-4000-8000-000000000009'::uuid AND NOT invalidated
 AND EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.store_id=snapshots.store_id
  AND m.user_id=NULLIF(current_setting('night_scout.profit_user_id',true),'')::uuid)
);
-- Insertion preflight ties the proposed source to the currently selected financial
-- seal. Full source/hash/correction validation remains the read-only reader's job.
CREATE FUNCTION finance_review_supplement_v1.guard_insert() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE matched boolean;
BEGIN
 SELECT EXISTS(
  SELECT 1 FROM finance_history_v2.seals s WHERE s.snapshot_id=NEW.financial_version
   AND s.store_id=NEW.store_id AND s.date_from=NEW.date_from AND s.date_to=NEW.date_to
   AND s.sales_revision=NEW.sales_revision AND s.cost_revision=NEW.cost_revision
   AND NOT EXISTS(SELECT 1 FROM finance_history_v2.invalidations i WHERE i.snapshot_id=s.snapshot_id)
   AND NOT EXISTS(SELECT 1 FROM finance_history_v2.version_heads h WHERE h.store_id=s.store_id AND h.date_from=s.date_from AND h.date_to=s.date_to)
   AND NOT EXISTS(SELECT 1 FROM finance_history_v2.correction_selections c WHERE c.store_id=s.store_id AND c.previous_version_id=s.snapshot_id)
  UNION ALL
  SELECT 1 FROM finance_history_v2.correction_versions v
   JOIN finance_history_v2.version_heads h ON h.version_id=v.version_id AND h.store_id=v.store_id AND h.date_from=v.date_from AND h.date_to=v.date_to
   JOIN finance_history_v2.correction_selections c ON c.selection_id=h.selection_id AND c.version_id=v.version_id AND c.store_id=v.store_id AND c.date_from=v.date_from AND c.date_to=v.date_to
   WHERE v.version_id=NEW.financial_version AND v.store_id=NEW.store_id AND v.date_from=NEW.date_from AND v.date_to=NEW.date_to
    AND v.sales_revision=NEW.sales_revision AND v.cost_revision=NEW.cost_revision
    AND NOT EXISTS(SELECT 1 FROM finance_history_v2.correction_selections later WHERE later.store_id=v.store_id AND later.previous_version_id=v.version_id)
 ) INTO matched;
 IF NOT matched OR NEW.invalidated THEN RAISE EXCEPTION 'Supplement requires current matching financial evidence'; END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER supplement_current_financial BEFORE INSERT ON finance_review_supplement_v1.snapshots FOR EACH ROW EXECUTE FUNCTION finance_review_supplement_v1.guard_insert();
CREATE FUNCTION finance_review_supplement_v1.guard_change() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE owner_allowed boolean;
BEGIN
 IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'Supplemental evidence is immutable'; END IF;
 SELECT c.relowner=r.oid OR r.rolsuper INTO owner_allowed FROM pg_catalog.pg_class c CROSS JOIN pg_catalog.pg_roles r WHERE c.oid=TG_RELID AND r.rolname=current_user;
 IF NOT owner_allowed OR OLD.invalidated OR NOT NEW.invalidated OR (to_jsonb(NEW)-'invalidated')<>(to_jsonb(OLD)-'invalidated') THEN
  RAISE EXCEPTION 'Only owner one-way invalidation is allowed';
 END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER supplement_immutable_row BEFORE UPDATE OR DELETE ON finance_review_supplement_v1.snapshots FOR EACH ROW EXECUTE FUNCTION finance_review_supplement_v1.guard_change();
CREATE TRIGGER supplement_immutable_truncate BEFORE TRUNCATE ON finance_review_supplement_v1.snapshots FOR EACH STATEMENT EXECUTE FUNCTION finance_review_supplement_v1.guard_change();
REVOKE ALL ON ALL TABLES IN SCHEMA finance_review_supplement_v1 FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA finance_review_supplement_v1 FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finance_review_supplement_v1 FROM PUBLIC;
-- Existing browser/default server roles stay excluded. No grants are added here.
DO $browser_privileges$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA finance_review_supplement_v1 FROM %I',role_name);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA finance_review_supplement_v1 FROM %I',role_name);
   EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA finance_review_supplement_v1 FROM %I',role_name);
   EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finance_review_supplement_v1 FROM %I',role_name);
   EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA finance_review_supplement_v1 REVOKE ALL ON TABLES FROM %I',role_name);
   EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA finance_review_supplement_v1 REVOKE ALL ON SEQUENCES FROM %I',role_name);
   EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA finance_review_supplement_v1 REVOKE ALL ON FUNCTIONS FROM %I',role_name);
  END IF;
 END LOOP;
END $browser_privileges$;
COMMIT;
