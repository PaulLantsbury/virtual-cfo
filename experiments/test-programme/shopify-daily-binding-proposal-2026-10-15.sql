-- PROPOSAL ONLY. Shopify-only alternative to the coupled daily amendment; never run both.
-- Requires existing installed writer schema/roles, but no Xero programme, envelope or consent.
-- Operator must first verify the separate same-organisation writer app/private config against
-- the actual development shop. Session settings below are operator evidence, NOT provider proof
-- or authorisation. Never fabricate them from this template or commit credentials.
-- In the same operator session, set night_scout.shopify_writer_config to exact non-secret JSON private config and
-- night_scout.shopify_writer_receipt to the fresh non-secret provider receipt in that
-- session before executing this complete transaction. Clear those metadata settings afterwards.
-- Receipt fields match prepareShopifyDailyReadiness: domain/currency/partnerDevelopment,
-- separateWriterApp/sameOrganisation/grantedScopes/observedAt. Missing evidence fails closed.
-- Does not enable generation, install a schedule, mint a token or write to Shopify.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $guard$
DECLARE c jsonb; r jsonb; observed timestamptz;
BEGIN
 IF current_user IN ('night_scout_test_writer','night_scout_test_writer_service') THEN RAISE EXCEPTION 'Operator binding required'; END IF;
 IF to_regclass('staging_test_programme.programmes') IS NULL OR to_regclass('staging_test_programme.actions') IS NULL OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='night_scout_test_writer_service' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication) THEN RAISE EXCEPTION 'Existing restricted writer installation required'; END IF;
 c:=nullif(current_setting('night_scout.shopify_writer_config',true),'')::jsonb;
 r:=nullif(current_setting('night_scout.shopify_writer_receipt',true),'')::jsonb;
 IF c IS DISTINCT FROM '{"provider":"shopify","target":"pocketlaunchpad1.myshopify.com","startMonday":"2026-10-12","programmeKey":"shopify-staging-20261012","scheduleProfile":"daily-20261015-v1"}'::jsonb THEN RAISE EXCEPTION 'Exact verified private Shopify config required'; END IF;
 IF r IS NULL OR jsonb_typeof(r)<>'object' OR r->>'domain' IS DISTINCT FROM 'pocketlaunchpad1.myshopify.com' OR r->>'currency' IS DISTINCT FROM 'GBP' OR r->'partnerDevelopment' IS DISTINCT FROM 'true'::jsonb OR r->'separateWriterApp' IS DISTINCT FROM 'true'::jsonb OR r->'sameOrganisation' IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(r->'grantedScopes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Verified separate development writer receipt required'; END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(r))<>7 OR EXISTS(SELECT 1 FROM jsonb_object_keys(r) k WHERE k NOT IN ('domain','currency','partnerDevelopment','separateWriterApp','sameOrganisation','grantedScopes','observedAt')) OR jsonb_typeof(r->'observedAt') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Exact non-secret receipt schema required'; END IF;
 IF NOT (r->'grantedScopes' @> '["read_orders","write_orders"]'::jsonb) OR EXISTS(SELECT 1 FROM jsonb_array_elements(r->'grantedScopes') s WHERE s NOT IN ('"read_orders"'::jsonb,'"write_orders"'::jsonb,'"read_all_orders"'::jsonb)) OR jsonb_array_length(r->'grantedScopes')<>(SELECT count(DISTINCT s) FROM jsonb_array_elements(r->'grantedScopes') s) THEN RAISE EXCEPTION 'Unexpected writer scopes'; END IF;
 observed:=(r->>'observedAt')::timestamptz;
 IF observed IS NULL OR observed>now() OR observed<now()-interval '1 hour' THEN RAISE EXCEPTION 'Fresh actual provider receipt required'; END IF;
 IF (now() AT TIME ZONE 'Europe/London')::date>DATE '2026-10-18' THEN RAISE EXCEPTION 'Daily binding expired'; END IF;
END $guard$;
-- Fail closed if another profile migration was already applied; inspect rather than replay.
ALTER TABLE staging_test_programme.programmes ADD COLUMN schedule_profile text NOT NULL DEFAULT 'original';
ALTER TABLE staging_test_programme.programmes ADD CONSTRAINT writer_schedule_profile_allowed CHECK (schedule_profile IN ('original','daily-20261015-v1'));
-- Metadata only. No envelope/token returned. Missing RPC makes the opted-in runtime fail closed.
CREATE FUNCTION staging_test_programme.daily_profile_ready(p text,provider_name text,target_name text,cap integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme AS $$
DECLARE r staging_test_programme.programmes%ROWTYPE; local_now timestamp:=now() AT TIME ZONE 'Europe/London';
BEGIN
 IF p IS NULL OR provider_name IS NULL OR target_name IS NULL OR cap IS NULL THEN RETURN false; END IF;
 SELECT * INTO r FROM staging_test_programme.programmes WHERE programme_key=p;
 IF NOT FOUND OR p<>provider_name||'-staging-20261012' OR r.provider<>provider_name OR r.target<>target_name OR r.project_ref<>'bioalckltvkhlczusdvl' OR r.schedule_profile<>'daily-20261015-v1' OR r.action_cap<>4 OR cap<>4 OR NOT r.enabled OR r.stopped OR r.starts_at<>'2026-10-12T00:00:00Z'::timestamptz OR r.ends_at<>'2026-10-26T00:00:00Z'::timestamptz THEN RETURN false; END IF;
 IF local_now::date NOT IN (DATE '2026-10-15',DATE '2026-10-16',DATE '2026-10-17',DATE '2026-10-18') OR local_now::time<TIME '18:00' OR local_now::time>=TIME '18:15' THEN RETURN false; END IF;
 IF provider_name='shopify' THEN RETURN target_name='pocketlaunchpad1.myshopify.com'; END IF;
 IF provider_name='xero' THEN RETURN EXISTS(SELECT 1 FROM staging_test_programme.writer_envelopes e WHERE e.programme_key=p AND e.tenant_id::text=target_name); END IF;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION staging_test_programme.daily_profile_ready(text,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION staging_test_programme.daily_profile_ready(text,text,text,integer) TO night_scout_test_writer_service;

CREATE OR REPLACE FUNCTION staging_test_programme.claim_action(p text,k text,d text,provider_name text,target_name text,cap integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme AS $$
DECLARE r staging_test_programme.programmes%ROWTYPE; a staging_test_programme.actions%ROWTYPE;
BEGIN
 IF p IS NULL OR k IS NULL OR d IS NULL OR provider_name IS NULL OR target_name IS NULL OR cap IS NULL THEN RETURN 'blocked'; END IF;
 SELECT * INTO r FROM staging_test_programme.programmes WHERE programme_key=p FOR UPDATE;
 IF NOT FOUND OR NOT r.enabled OR r.stopped OR r.provider<>provider_name OR r.target<>target_name OR r.action_cap<>cap OR now()<r.starts_at OR now()>=r.ends_at THEN RETURN 'blocked'; END IF;
 IF r.schedule_profile='daily-20261015-v1' AND NOT staging_test_programme.daily_profile_ready(p,provider_name,target_name,cap) THEN RETURN 'blocked'; END IF;
 SELECT * INTO a FROM staging_test_programme.actions WHERE programme_key=p AND action_key=k;
 IF FOUND THEN IF a.payload_digest=d THEN RETURN 'existing'; ELSE RETURN 'blocked'; END IF; END IF;
 IF d !~ '^[0-9a-f]{64}$' OR k !~ '^ns-[0-9a-f]{40}$' THEN RETURN 'blocked'; END IF;
 IF EXISTS(SELECT 1 FROM staging_test_programme.actions WHERE programme_key=p AND state IN ('claimed','submitted','uncertain')) OR (SELECT count(*) FROM staging_test_programme.actions WHERE programme_key=p)>=r.action_cap THEN RETURN 'blocked'; END IF;
 IF r.schedule_profile='daily-20261015-v1' AND EXISTS(SELECT 1 FROM staging_test_programme.actions WHERE programme_key=p AND (created_at AT TIME ZONE 'Europe/London')::date=(now() AT TIME ZONE 'Europe/London')::date) THEN RETURN 'blocked'; END IF;
 INSERT INTO staging_test_programme.actions(programme_key,action_key,payload_digest,state) VALUES(p,k,d,'claimed'); RETURN 'claimed';
END $$;

-- Serialize even when the row does not yet exist. No claims are removed or reset.
LOCK TABLE staging_test_programme.programmes IN SHARE ROW EXCLUSIVE MODE;
DO $bind$
DECLARE r staging_test_programme.programmes%ROWTYPE;
BEGIN
 SELECT * INTO r FROM staging_test_programme.programmes WHERE programme_key='shopify-staging-20261012' FOR UPDATE;
 IF FOUND THEN
  IF r.provider<>'shopify' OR r.project_ref<>'bioalckltvkhlczusdvl' OR r.target<>'pocketlaunchpad1.myshopify.com' OR r.enabled OR r.stopped OR r.action_cap<>6 OR r.schedule_profile<>'original' OR r.starts_at<>'2026-10-12T00:00:00Z'::timestamptz OR r.ends_at<>'2026-10-26T00:00:00Z'::timestamptz THEN RAISE EXCEPTION 'Existing Shopify programme incompatible'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM staging_test_programme.actions WHERE programme_key='shopify-staging-20261012') THEN RAISE EXCEPTION 'Used Shopify programme cannot be amended'; END IF;
 INSERT INTO staging_test_programme.programmes(programme_key,provider,project_ref,target,starts_at,ends_at,action_cap,enabled,stopped,schedule_profile)
 VALUES('shopify-staging-20261012','shopify','bioalckltvkhlczusdvl','pocketlaunchpad1.myshopify.com','2026-10-12T00:00:00Z','2026-10-26T00:00:00Z',4,false,false,'daily-20261015-v1')
 ON CONFLICT(programme_key) DO UPDATE SET action_cap=4,schedule_profile='daily-20261015-v1';
END $bind$;
COMMIT;
