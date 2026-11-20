-- PROPOSAL ONLY: staging operator review/application required. Does not enable generation.
-- Apply only after existing activation installer; never replay that installer.
BEGIN;
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

-- Amend ONLY the existing exact disabled pristine rows, as one transaction.
-- Demo-company/GBP proof is furnished by separate writer bootstrap, not inferred from UUID.
DO $$
DECLARE r staging_test_programme.programmes%ROWTYPE; n integer:=0;
BEGIN
 FOR r IN SELECT * FROM staging_test_programme.programmes WHERE programme_key IN ('shopify-staging-20261012','xero-staging-20261012') ORDER BY programme_key FOR UPDATE LOOP
  n:=n+1;
  IF r.programme_key<>r.provider||'-staging-20261012' OR r.project_ref<>'bioalckltvkhlczusdvl' OR r.enabled OR r.stopped OR r.action_cap<>6 OR r.schedule_profile<>'original' OR r.starts_at<>'2026-10-12T00:00:00Z'::timestamptz OR r.ends_at<>'2026-10-26T00:00:00Z'::timestamptz OR EXISTS(SELECT 1 FROM staging_test_programme.actions WHERE programme_key=r.programme_key) THEN RAISE EXCEPTION 'Daily amendment requires exact unused disabled original programmes'; END IF;
  IF r.provider='shopify' AND r.target<>'pocketlaunchpad1.myshopify.com' THEN RAISE EXCEPTION 'Shopify target mismatch'; END IF;
  IF r.provider='xero' AND NOT EXISTS(SELECT 1 FROM staging_test_programme.writer_envelopes e WHERE e.programme_key=r.programme_key AND e.tenant_id::text=r.target AND e.refresh_claim IS NULL) THEN RAISE EXCEPTION 'Matching idle writer envelope required'; END IF;
 END LOOP;
 IF n<>2 THEN RAISE EXCEPTION 'Both existing verified disabled programmes required'; END IF;
 IF (now() AT TIME ZONE 'Europe/London')::date>DATE '2026-10-18' THEN RAISE EXCEPTION 'Daily amendment expired'; END IF;
 UPDATE staging_test_programme.programmes SET schedule_profile='daily-20261015-v1',action_cap=4 WHERE programme_key IN ('shopify-staging-20261012','xero-staging-20261012');
END $$;
COMMIT;
