-- PROPOSAL ONLY. Target bioalckltvkhlczusdvl after explicit approval + inventory review.
-- Administrator transaction; creates no password, login, membership or certification.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.stores WHERE id='56d92f8a-746e-4b4f-b408-81fc98c4aa17' OR shopify_domain='pocketlaunchpad1.myshopify.com' OR shopify_store_id IN ('95601983836','gid://shopify/Shop/95601983836')) THEN
  RAISE EXCEPTION 'Development store identity already exists: inspect; do not overwrite';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='night_scout_intake_service') THEN RAISE EXCEPTION 'Intake role already exists'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN ('public.stores'::regclass,'ingest_v1.batches'::regclass,'ingest_v1.heads'::regclass,'ingest_v1.source_versions'::regclass,'finance_v1.coverage_evidence'::regclass) AND NOT relrowsecurity) THEN RAISE EXCEPTION 'Required row-level security is disabled'; END IF;
 IF to_regprocedure('ingest_v1.invalidate_verified_store(uuid)') IS NULL THEN RAISE EXCEPTION 'Existing invalidation capability required'; END IF;
END $$;
INSERT INTO public.stores(id,name,shopify_domain,shopify_store_id,currency_code,timezone,is_active)
 VALUES('56d92f8a-746e-4b4f-b408-81fc98c4aa17','PocketLaunchpad1 — Shopify development store','pocketlaunchpad1.myshopify.com','95601983836','GBP','Europe/London',true);
CREATE ROLE night_scout_intake_service NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA public,ingest_v1,finance_v1 TO night_scout_intake_service;
GRANT SELECT(id,shopify_domain,shopify_store_id,currency_code,timezone) ON public.stores TO night_scout_intake_service;
CREATE POLICY intake_store_read ON public.stores FOR SELECT TO night_scout_intake_service USING(id='56d92f8a-746e-4b4f-b408-81fc98c4aa17');
GRANT SELECT ON ingest_v1.batches,ingest_v1.heads,ingest_v1.source_versions TO night_scout_intake_service;
GRANT INSERT(store_id,date_from,date_to,fingerprint,mapping_state,payload) ON ingest_v1.batches TO night_scout_intake_service;
GRANT UPDATE(superseded_at) ON ingest_v1.batches TO night_scout_intake_service;
GRANT INSERT(store_id,date_from,date_to,batch_id,needs_recheck), UPDATE(batch_id,needs_recheck) ON ingest_v1.heads TO night_scout_intake_service;
GRANT INSERT(store_id,source_id,source_version,fingerprint), UPDATE(source_version,fingerprint) ON ingest_v1.source_versions TO night_scout_intake_service;
DO $$ DECLARE relation text; BEGIN
 FOREACH relation IN ARRAY ARRAY['ingest_v1.batches','ingest_v1.heads','ingest_v1.source_versions'] LOOP
  EXECUTE format('CREATE POLICY intake_read ON %s FOR SELECT TO night_scout_intake_service USING(store_id=''56d92f8a-746e-4b4f-b408-81fc98c4aa17'')',relation);
  EXECUTE format('CREATE POLICY intake_insert ON %s FOR INSERT TO night_scout_intake_service WITH CHECK(store_id=''56d92f8a-746e-4b4f-b408-81fc98c4aa17'')',relation);
  EXECUTE format('CREATE POLICY intake_update ON %s FOR UPDATE TO night_scout_intake_service USING(store_id=''56d92f8a-746e-4b4f-b408-81fc98c4aa17'') WITH CHECK(store_id=''56d92f8a-746e-4b4f-b408-81fc98c4aa17'')',relation);
 END LOOP;
END $$;
-- Intake may withdraw review, never clear a recheck requirement.
ALTER POLICY intake_update ON ingest_v1.heads WITH CHECK(store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17' AND needs_recheck);
GRANT SELECT(store_id,sales_and_refunds_complete), UPDATE(sales_and_refunds_complete) ON finance_v1.coverage_evidence TO night_scout_intake_service;
CREATE POLICY intake_coverage_read ON finance_v1.coverage_evidence FOR SELECT TO night_scout_intake_service USING(store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17');
CREATE POLICY intake_invalidate ON finance_v1.coverage_evidence FOR UPDATE TO night_scout_intake_service USING(store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17') WITH CHECK(store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17' AND NOT sales_and_refunds_complete);
GRANT EXECUTE ON FUNCTION ingest_v1.invalidate_verified_store(uuid) TO night_scout_intake_service;
-- Same row lock as existing recorder, without exposing UPDATE on store columns.
CREATE FUNCTION ingest_v1.lock_intake_store(p_store_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF p_store_id IS DISTINCT FROM '56d92f8a-746e-4b4f-b408-81fc98c4aa17'::uuid THEN RAISE EXCEPTION 'Intake store not authorised'; END IF;
 PERFORM 1 FROM public.stores WHERE id=p_store_id AND shopify_domain='pocketlaunchpad1.myshopify.com' AND shopify_store_id='95601983836' AND currency_code='GBP' AND timezone='Europe/London' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Intake store identity/settings mismatch'; END IF;
END $$;
REVOKE ALL ON FUNCTION ingest_v1.lock_intake_store(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ingest_v1.lock_intake_store(uuid) TO night_scout_intake_service;
COMMIT;
