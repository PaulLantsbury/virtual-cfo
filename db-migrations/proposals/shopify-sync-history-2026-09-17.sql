-- PROPOSAL ONLY: apply to staging after explicit approval. No membership grant.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.stores WHERE id='56d92f8a-746e-4b4f-b408-81fc98c4aa17' AND shopify_domain='pocketlaunchpad1.myshopify.com' AND shopify_store_id='95601983836' AND currency_code='GBP' AND timezone='Europe/London') THEN RAISE EXCEPTION 'Expected staging development store missing or changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='night_scout_intake_service' AND NOT (rolcanlogin OR rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN RAISE EXCEPTION 'Expected restricted intake role missing or changed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN ('public.stores'::regclass,'ingest_v1.heads'::regclass,'ingest_v1.batches'::regclass) AND NOT relrowsecurity) THEN RAISE EXCEPTION 'Required RLS disabled'; END IF;
END $$;

CREATE TABLE ingest_v1.sync_attempts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES public.stores(id),
 date_from date NOT NULL,date_to date NOT NULL,
 state text NOT NULL DEFAULT 'running' CHECK(state IN ('running','completed','unconfirmed')),
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),finished_at timestamptz,
 result_code text CHECK(result_code IN ('recorded_requires_review','changed_requires_review','replay','historical_replay','stale_source','conflicting_source','missing_source')),
 CHECK(date_to>=date_from AND date_to-date_from<31),
 CHECK((state='running' AND finished_at IS NULL AND result_code IS NULL) OR (state='completed' AND finished_at IS NOT NULL AND finished_at>=started_at AND result_code IS NOT NULL) OR (state='unconfirmed' AND finished_at IS NOT NULL AND finished_at>=started_at AND result_code IS NULL))
);
CREATE UNIQUE INDEX sync_attempts_unresolved_store ON ingest_v1.sync_attempts(store_id) WHERE state IN ('running','unconfirmed');
ALTER TABLE ingest_v1.sync_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ingest_v1.sync_attempts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON ingest_v1.sync_attempts TO night_scout_intake_service;
GRANT INSERT(store_id,date_from,date_to),UPDATE(state,result_code) ON ingest_v1.sync_attempts TO night_scout_intake_service;
CREATE POLICY intake_sync_read ON ingest_v1.sync_attempts FOR SELECT TO night_scout_intake_service USING(store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17');
CREATE POLICY intake_sync_insert ON ingest_v1.sync_attempts FOR INSERT TO night_scout_intake_service WITH CHECK(store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17');
CREATE POLICY intake_sync_update ON ingest_v1.sync_attempts FOR UPDATE TO night_scout_intake_service USING(store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17') WITH CHECK(store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17');
CREATE FUNCTION ingest_v1.guard_sync_attempt() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.state<>'running' OR NEW.state NOT IN ('completed','unconfirmed') OR NEW.id<>OLD.id OR NEW.store_id<>OLD.store_id OR NEW.date_from<>OLD.date_from OR NEW.date_to<>OLD.date_to OR NEW.started_at<>OLD.started_at THEN RAISE EXCEPTION 'Invalid sync attempt transition'; END IF;
  NEW.finished_at=clock_timestamp();
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_sync_attempt BEFORE UPDATE ON ingest_v1.sync_attempts FOR EACH ROW EXECUTE FUNCTION ingest_v1.guard_sync_attempt();
REVOKE ALL ON FUNCTION ingest_v1.guard_sync_attempt() FROM PUBLIC,anon,authenticated;
-- Membership is checked inside the definer boundary before any private history read.
-- This returns metadata only, never tokens, source payloads or exception text.
CREATE FUNCTION public.shopify_connection_status(p_store_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a ingest_v1.sync_attempts%ROWTYPE; successful ingest_v1.sync_attempts%ROWTYPE; c jsonb; latest jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.store_memberships WHERE user_id=auth.uid() AND store_id=p_store_id) THEN RAISE EXCEPTION 'Store membership required'; END IF;
 IF p_store_id<>'56d92f8a-746e-4b4f-b408-81fc98c4aa17'::uuid THEN RETURN jsonb_build_object('state','not_configured','storeId',p_store_id,'latestAttempt',null,'latestSuccessfulCollection',null,'candidate',jsonb_build_object('state','not_assessed'),'financialVerification','not_assessed'); END IF;
 SELECT * INTO a FROM ingest_v1.sync_attempts WHERE store_id=p_store_id ORDER BY started_at DESC,id DESC LIMIT 1;
 SELECT * INTO successful FROM ingest_v1.sync_attempts WHERE store_id=p_store_id AND state='completed' AND result_code IN ('recorded_requires_review','changed_requires_review','replay') ORDER BY finished_at DESC,id DESC LIMIT 1;
 c=jsonb_build_object('state','not_assessed');
 IF a.id IS NOT NULL THEN
  latest=jsonb_build_object('state',a.state,'startedAt',a.started_at,'finishedAt',a.finished_at,'from',a.date_from,'to',a.date_to,'resultCode',a.result_code);
  SELECT jsonb_build_object('state',CASE WHEN h.needs_recheck THEN 'needs_recheck' ELSE 'current_unverified' END,'from',h.date_from,'to',h.date_to,
   'orderCount',jsonb_array_length(b.payload->'source'->'orders'),
   'refundCount',(SELECT COALESCE(sum(jsonb_array_length(o->'refunds')),0) FROM jsonb_array_elements(b.payload->'source'->'orders') o),
   'mappedEventCount',jsonb_array_length(b.payload->'mapped'->'events'),
   'testExcludedCount',CASE WHEN jsonb_typeof(b.payload->'mapped'->'excluded')='array' THEN (SELECT count(*) FROM jsonb_array_elements(b.payload->'mapped'->'excluded') e WHERE e->>'reason'='TEST_ORDER') ELSE NULL END)
  INTO c FROM ingest_v1.heads h JOIN ingest_v1.batches b ON b.id=h.batch_id AND b.store_id=h.store_id AND b.date_from=h.date_from AND b.date_to=h.date_to
  WHERE h.store_id=p_store_id AND h.date_from=a.date_from AND h.date_to=a.date_to;
  IF c IS NULL THEN c=jsonb_build_object('state','unavailable','from',a.date_from,'to',a.date_to); END IF;
 END IF;
 RETURN jsonb_build_object('state','available','storeId',p_store_id,'latestAttempt',latest,'latestSuccessfulCollection',CASE WHEN successful.id IS NULL THEN NULL ELSE jsonb_build_object('finishedAt',successful.finished_at,'from',successful.date_from,'to',successful.date_to,'resultCode',successful.result_code) END,'candidate',c,'financialVerification','not_assessed');
END $$;
REVOKE ALL ON FUNCTION public.shopify_connection_status(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shopify_connection_status(uuid) TO authenticated;
COMMIT;
