-- PROPOSAL ONLY: fresh Shopify-only programme, NOT an extension/reset of the expired trial.
-- Explicit approval required before application. Keep generation false.
-- Requires installed restricted writer schema, fresh actual seven-field provider receipt
-- and exact non-secret config in night_scout.shopify_writer_receipt/config session settings.
-- Pins 29 October–4 November 2026, one test order/day at 18:00–18:14 London, cap7.
-- No provider calls, enabled programmes, credentials, or schedules are created here.
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
 IF c IS DISTINCT FROM '{"provider":"shopify","target":"pocketlaunchpad1.myshopify.com","startMonday":"2026-10-26","programmeKey":"shopify-staging-20261029","scheduleProfile":"daily-20261029-v1"}'::jsonb THEN RAISE EXCEPTION 'Exact verified private Shopify config required'; END IF;
 IF r IS NULL OR jsonb_typeof(r)<>'object' OR r->>'domain' IS DISTINCT FROM 'pocketlaunchpad1.myshopify.com' OR r->>'currency' IS DISTINCT FROM 'GBP' OR r->'partnerDevelopment' IS DISTINCT FROM 'true'::jsonb OR r->'separateWriterApp' IS DISTINCT FROM 'true'::jsonb OR r->'sameOrganisation' IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(r->'grantedScopes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Verified separate development writer receipt required'; END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(r))<>7 OR EXISTS(SELECT 1 FROM jsonb_object_keys(r) k WHERE k NOT IN ('domain','currency','partnerDevelopment','separateWriterApp','sameOrganisation','grantedScopes','observedAt')) OR jsonb_typeof(r->'observedAt') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Exact non-secret receipt schema required'; END IF;
 IF NOT (r->'grantedScopes' @> '["read_orders","write_orders"]'::jsonb) OR EXISTS(SELECT 1 FROM jsonb_array_elements(r->'grantedScopes') s WHERE s NOT IN ('"read_orders"'::jsonb,'"write_orders"'::jsonb,'"read_all_orders"'::jsonb)) OR jsonb_array_length(r->'grantedScopes')<>(SELECT count(DISTINCT s) FROM jsonb_array_elements(r->'grantedScopes') s) THEN RAISE EXCEPTION 'Unexpected writer scopes'; END IF;
 observed:=(r->>'observedAt')::timestamptz;
 IF observed IS NULL OR observed>now() OR observed<now()-interval '1 hour' THEN RAISE EXCEPTION 'Fresh actual provider receipt required'; END IF;
 IF EXISTS(SELECT 1 FROM staging_test_programme.programmes WHERE provider='shopify' AND enabled AND NOT stopped AND ends_at>now()) OR EXISTS(SELECT 1 FROM staging_test_programme.actions a JOIN staging_test_programme.programmes p USING(programme_key) WHERE p.provider='shopify' AND a.state IN ('claimed','submitted','uncertain')) THEN RAISE EXCEPTION 'Inspect active or unresolved Shopify programme before new binding'; END IF;
 IF (now() AT TIME ZONE 'Europe/London')::date>DATE '2026-11-04' THEN RAISE EXCEPTION 'Daily binding expired'; END IF;
END $guard$;

-- A separate metadata gate avoids changing the expired profile or any Xero binding.
CREATE FUNCTION staging_test_programme.shopify_daily_20261029_ready(p text,provider_name text,target_name text,cap integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme AS $$
DECLARE r staging_test_programme.programmes%ROWTYPE; local_now timestamp:=now() AT TIME ZONE 'Europe/London';
BEGIN
 IF p IS DISTINCT FROM 'shopify-staging-20261029' OR provider_name IS DISTINCT FROM 'shopify' OR target_name IS DISTINCT FROM 'pocketlaunchpad1.myshopify.com' OR cap IS DISTINCT FROM 7 THEN RETURN false; END IF;
 SELECT * INTO r FROM staging_test_programme.programmes WHERE programme_key=p;
 IF NOT FOUND OR r.provider<>'shopify' OR r.target<>target_name OR r.project_ref<>'bioalckltvkhlczusdvl' OR r.action_cap<>7 OR NOT r.enabled OR r.stopped OR r.starts_at<>'2026-10-29T00:00:00Z'::timestamptz OR r.ends_at<>'2026-11-05T00:00:00Z'::timestamptz THEN RETURN false; END IF;
 IF local_now::date<DATE '2026-10-29' OR local_now::date>DATE '2026-11-04' OR local_now::time<TIME '18:00' OR local_now::time>=TIME '18:15' THEN RETURN false; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION staging_test_programme.shopify_daily_20261029_ready(text,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION staging_test_programme.shopify_daily_20261029_ready(text,text,text,integer) TO night_scout_test_writer_service;

-- Preserve the installed claim function verbatim for old programmes. Its replacement
-- gates this new programme in the database too; direct RPC use cannot bypass daily limits.
ALTER FUNCTION staging_test_programme.claim_action(text,text,text,text,text,integer) RENAME TO claim_action_before_20261029;
REVOKE ALL ON FUNCTION staging_test_programme.claim_action_before_20261029(text,text,text,text,text,integer) FROM PUBLIC,night_scout_test_writer_service,night_scout_test_writer;
CREATE FUNCTION staging_test_programme.claim_action(p text,k text,d text,provider_name text,target_name text,cap integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme AS $$
DECLARE result text;
BEGIN
 IF p IS NULL OR k IS NULL OR d IS NULL OR provider_name IS NULL OR target_name IS NULL OR cap IS NULL THEN RETURN 'blocked'; END IF;
 IF p='shopify-staging-20261029' THEN
  PERFORM 1 FROM staging_test_programme.programmes WHERE programme_key=p FOR UPDATE;
  IF NOT staging_test_programme.shopify_daily_20261029_ready(p,provider_name,target_name,cap) THEN RETURN 'blocked'; END IF;
  -- Replays remain existing/reconciliation-only; different same-day keys are refused.
  IF NOT EXISTS(SELECT 1 FROM staging_test_programme.actions WHERE programme_key=p AND action_key=k)
   AND EXISTS(SELECT 1 FROM staging_test_programme.actions WHERE programme_key=p AND (created_at AT TIME ZONE 'Europe/London')::date=(now() AT TIME ZONE 'Europe/London')::date) THEN RETURN 'blocked'; END IF;
 END IF;
 SELECT staging_test_programme.claim_action_before_20261029(p,k,d,provider_name,target_name,cap) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION staging_test_programme.claim_action(text,text,text,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION staging_test_programme.claim_action(text,text,text,text,text,integer) TO night_scout_test_writer_service;
LOCK TABLE staging_test_programme.programmes IN SHARE ROW EXCLUSIVE MODE;
DO $bind$ BEGIN
 IF EXISTS(SELECT 1 FROM staging_test_programme.programmes WHERE programme_key='shopify-staging-20261029') THEN RAISE EXCEPTION 'New programme already exists; inspect without resetting'; END IF;
END $bind$;
INSERT INTO staging_test_programme.programmes(programme_key,provider,project_ref,target,starts_at,ends_at,action_cap,enabled,stopped)
VALUES('shopify-staging-20261029','shopify','bioalckltvkhlczusdvl','pocketlaunchpad1.myshopify.com','2026-10-29T00:00:00Z','2026-11-05T00:00:00Z',7,false,false);
COMMIT;
