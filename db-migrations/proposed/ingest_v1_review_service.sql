-- LOCAL PROPOSAL ONLY. Run after review_restoration, as the migration owner.
-- No login/password or role membership is provisioned here.
BEGIN;
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
COMMIT;
