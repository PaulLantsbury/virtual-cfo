-- STAGING ONLY: confirm dashboard project bioalckltvkhlczusdvl before execution.
-- SQL cannot independently identify the selected Supabase project.
-- Additive schema/permission package; no credentials, reviewer grants or row imports.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $guard$
BEGIN
 IF to_regnamespace('ingest_v1') IS NOT NULL THEN RAISE EXCEPTION 'Intake schema already exists; do not replay'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('night_scout_review_service','night_scout_review_login')) THEN
  RAISE EXCEPTION 'Review roles already exist; inspect privileges before proceeding';
 END IF;
 IF to_regclass('finance_v1.coverage_evidence') IS NULL OR to_regprocedure('public.verified_sales_source(uuid,date,date)') IS NULL THEN
  RAISE EXCEPTION 'Verified finance baseline missing';
 END IF;
 IF (SELECT count(*) FROM public.stores)<>2 OR
    (SELECT count(*) FROM public.stores WHERE id IN ('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002'))<>2 THEN
  RAISE EXCEPTION 'Expected two synthetic staging stores only';
 END IF;
 IF (SELECT count(*) FROM public.orders)<>2 OR
    (SELECT count(*) FROM public.orders WHERE id IN ('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002'))<>2 THEN
  RAISE EXCEPTION 'Unexpected order baseline';
 END IF;
END $guard$;

-- Source: ingest_v1_candidate_batches.sql
-- LOCAL PROPOSAL ONLY: private candidate intake, not financial evidence publication.
-- No runner registration, API exposure, importer credentials or remote application.
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


-- Source: ingest_v1_verified_invalidation.sql
-- LOCAL PROPOSAL ONLY. Requires finance_v1 and ingest_v1 candidate schema.
-- Invalidates coverage; never publishes or recertifies figures.
CREATE FUNCTION ingest_v1.invalidate_verified_store(p_store_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$
 UPDATE finance_v1.coverage_evidence SET sales_and_refunds_complete=false
 WHERE store_id=p_store_id AND sales_and_refunds_complete;
$$;
REVOKE ALL ON FUNCTION ingest_v1.invalidate_verified_store(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION ingest_v1.invalidate_source_change()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE old_store uuid; new_store uuid;
BEGIN
 IF TG_OP='UPDATE' AND to_jsonb(OLD)=to_jsonb(NEW) THEN RETURN NEW; END IF;
 IF TG_OP<>'INSERT' THEN old_store:=OLD.store_id; END IF;
 IF TG_OP<>'DELETE' THEN new_store:=NEW.store_id; END IF;
 IF old_store IS NOT NULL THEN
  PERFORM ingest_v1.invalidate_verified_store(old_store);
  UPDATE ingest_v1.heads SET needs_recheck=true WHERE store_id=old_store AND NOT needs_recheck;
 END IF;
 IF new_store IS NOT NULL AND new_store IS DISTINCT FROM old_store THEN
  PERFORM ingest_v1.invalidate_verified_store(new_store);
  UPDATE ingest_v1.heads SET needs_recheck=true WHERE store_id=new_store AND NOT needs_recheck;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
REVOKE ALL ON FUNCTION ingest_v1.invalidate_source_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ingest_source_coverage AFTER INSERT OR UPDATE OR DELETE ON ingest_v1.source_versions
 FOR EACH ROW EXECUTE FUNCTION ingest_v1.invalidate_source_change();
CREATE TRIGGER ingest_order_coverage AFTER INSERT OR UPDATE OR DELETE ON public.orders
 FOR EACH ROW EXECUTE FUNCTION ingest_v1.invalidate_source_change();
CREATE TRIGGER ingest_refund_coverage AFTER INSERT OR UPDATE OR DELETE ON public.refunds
 FOR EACH ROW EXECUTE FUNCTION ingest_v1.invalidate_source_change();

CREATE FUNCTION ingest_v1.invalidate_head_review()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  PERFORM ingest_v1.invalidate_verified_store(OLD.store_id); RETURN OLD;
 END IF;
 IF NEW.needs_recheck THEN PERFORM ingest_v1.invalidate_verified_store(NEW.store_id); END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION ingest_v1.invalidate_head_review() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ingest_head_coverage AFTER INSERT OR UPDATE OR DELETE ON ingest_v1.heads
 FOR EACH ROW EXECUTE FUNCTION ingest_v1.invalidate_head_review();

CREATE FUNCTION ingest_v1.invalidate_store_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM ingest_v1.invalidate_verified_store(NEW.id);
 UPDATE ingest_v1.heads SET needs_recheck=true WHERE store_id=NEW.id AND NOT needs_recheck;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION ingest_v1.invalidate_store_settings() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ingest_settings_coverage AFTER UPDATE ON public.stores
 FOR EACH ROW WHEN (
 OLD.currency_code IS DISTINCT FROM NEW.currency_code OR OLD.timezone IS DISTINCT FROM NEW.timezone
 OR OLD.shopify_domain IS DISTINCT FROM NEW.shopify_domain OR OLD.shopify_store_id IS DISTINCT FROM NEW.shopify_store_id)
 EXECUTE FUNCTION ingest_v1.invalidate_store_settings();


-- Source: ingest_v1_review_restoration.sql
-- LOCAL PROPOSAL ONLY. Requires candidate, finance evidence and invalidation proposals.
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


-- Source: ingest_v1_review_service.sql
-- LOCAL PROPOSAL ONLY. Run after review_restoration, as the migration owner.
-- No login/password or role membership is provisioned here.
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='night_scout_review_service') THEN
  CREATE ROLE night_scout_review_service NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='night_scout_review_service'
   AND (rolcanlogin OR rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
   OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='night_scout_review_service')) THEN
  RAISE EXCEPTION 'Existing review role is not an isolated non-login role';
 END IF;
END $$;
GRANT USAGE ON SCHEMA public,finance_v1,ingest_v1 TO night_scout_review_service;
GRANT SELECT ON public.stores,public.store_memberships,public.orders,public.refunds,
 finance_v1.order_evidence,finance_v1.refund_evidence,finance_v1.coverage_evidence,
 finance_v1.order_mapping,finance_v1.refund_mapping,
 ingest_v1.batches,ingest_v1.heads,ingest_v1.source_versions,
 ingest_v1.review_authorizations,ingest_v1.review_audit TO night_scout_review_service;
GRANT INSERT ON ingest_v1.review_audit TO night_scout_review_service;
GRANT UPDATE(sales_and_refunds_complete,evidence_ref,verified_by,verified_at)
 ON finance_v1.coverage_evidence TO night_scout_review_service;
GRANT UPDATE(needs_recheck) ON ingest_v1.heads TO night_scout_review_service;
-- Trusted internal service reads all stores; application authorisation is mandatory.
DO $$ DECLARE relation text; BEGIN
 FOREACH relation IN ARRAY ARRAY['public.stores','public.store_memberships','public.orders','public.refunds',
  'finance_v1.order_evidence','finance_v1.refund_evidence','finance_v1.coverage_evidence',
  'ingest_v1.batches','ingest_v1.heads','ingest_v1.source_versions',
  'ingest_v1.review_authorizations','ingest_v1.review_audit'] LOOP
  EXECUTE format('CREATE POLICY review_service_read ON %s FOR SELECT TO night_scout_review_service USING (true)',relation);
 END LOOP;
END $$;
CREATE POLICY review_service_append ON ingest_v1.review_audit FOR INSERT TO night_scout_review_service WITH CHECK(true);
CREATE POLICY review_service_coverage ON finance_v1.coverage_evidence FOR UPDATE TO night_scout_review_service USING(true) WITH CHECK(true);
CREATE POLICY review_service_recheck ON ingest_v1.heads FOR UPDATE TO night_scout_review_service USING(true) WITH CHECK(true);
-- Strong table locks otherwise require granting write rights to source tables.
-- The definer capability has no arguments/dynamic SQL and can ONLY take fixed locks.
CREATE FUNCTION ingest_v1.lock_review_dependencies() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 LOCK TABLE public.stores,public.store_memberships,
  ingest_v1.review_authorizations,public.orders,public.refunds,
  finance_v1.order_evidence,finance_v1.refund_evidence,
  ingest_v1.source_versions,ingest_v1.batches,ingest_v1.heads,
  finance_v1.coverage_evidence,ingest_v1.review_audit IN SHARE ROW EXCLUSIVE MODE;
END $$;
REVOKE ALL ON FUNCTION ingest_v1.lock_review_dependencies() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ingest_v1.lock_review_dependencies() TO night_scout_review_service;
GRANT EXECUTE ON FUNCTION ingest_v1.invalidate_verified_store(uuid) TO night_scout_review_service;

-- No login, reviewer assignment or candidate data is created.
COMMIT;
