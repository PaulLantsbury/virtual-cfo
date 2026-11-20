-- PROPOSAL ONLY, NOT APPROVED/APPLIED. Exact new Xero-only trial: 30Oct–5Nov,
-- one GBP10 posted demo invoice per day at 18:00–18:14 London, cap7/GBP70/GBP0 paid.
-- Separate owner-consent operator and writer app only. Customer app remains read-only.
-- New row/envelope are seeded disabled by fresh actual GBP Demo Company OAuth proof.
-- No old row, envelope, date, cap, claim or Shopify binding is reset or copied.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_user IN ('night_scout_test_writer','night_scout_test_writer_service') THEN RAISE EXCEPTION 'Operator migration required'; END IF;
 IF to_regclass('staging_test_programme.programmes') IS NULL OR to_regclass('staging_test_programme.writer_envelopes') IS NULL OR to_regclass('public.store_memberships') IS NULL THEN RAISE EXCEPTION 'Inspect existing writer installation'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='night_scout_test_writer_service' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolinherit AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls) THEN RAISE EXCEPTION 'Restricted writer role required'; END IF;
 IF now()>='2026-11-06T00:00:00Z'::timestamptz THEN RAISE EXCEPTION 'Unapproved proposal expired; do not extend'; END IF;
 IF EXISTS(SELECT 1 FROM staging_test_programme.programmes WHERE programme_key='xero-staging-20261030' OR provider='xero' AND enabled AND NOT stopped AND ends_at>now()) OR EXISTS(SELECT 1 FROM staging_test_programme.actions a JOIN staging_test_programme.programmes p USING(programme_key) WHERE p.provider='xero' AND a.state IN ('claimed','submitted','uncertain')) THEN RAISE EXCEPTION 'Inspect active, occupied or unresolved Xero programme'; END IF;
END $guard$;
CREATE TABLE staging_test_programme.xero_restart_20261030_oauth_states(
 state_digest text PRIMARY KEY CHECK(state_digest ~ '^[0-9a-f]{64}$'),
 owner_id uuid NOT NULL,store_id uuid NOT NULL,
 expires_at timestamptz NOT NULL CHECK(expires_at<=now()+interval '10 minutes'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','consumed','seeded')),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE staging_test_programme.xero_restart_20261030_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON staging_test_programme.xero_restart_20261030_oauth_states FROM PUBLIC,night_scout_test_writer_service,night_scout_test_writer;
CREATE FUNCTION staging_test_programme.start_xero_20261030_consent(d text,o uuid,s uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme,public AS $$
BEGIN
 IF d IS NULL OR o IS NULL OR s IS NULL OR d !~ '^[0-9a-f]{64}$' OR now()>='2026-11-06T00:00:00Z'::timestamptz OR NOT EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.user_id=o AND m.store_id=s) OR EXISTS(SELECT 1 FROM staging_test_programme.programmes WHERE programme_key='xero-staging-20261030') THEN RETURN false; END IF;
 -- A new random state supersedes only an unused state for this same owner/store.
 DELETE FROM staging_test_programme.xero_restart_20261030_oauth_states WHERE owner_id=o AND store_id=s AND status='pending';
 INSERT INTO staging_test_programme.xero_restart_20261030_oauth_states(state_digest,owner_id,store_id,expires_at) VALUES(d,o,s,now()+interval '10 minutes');RETURN true;
END $$;
CREATE FUNCTION staging_test_programme.consume_xero_20261030_consent(d text,o uuid,s uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme,public AS $$
BEGIN
 IF d IS NULL OR o IS NULL OR s IS NULL OR now()>='2026-11-06T00:00:00Z'::timestamptz OR NOT EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.user_id=o AND m.store_id=s) THEN RETURN false; END IF;
 UPDATE staging_test_programme.xero_restart_20261030_oauth_states SET status='consumed' WHERE state_digest=d AND owner_id=o AND store_id=s AND status='pending' AND expires_at>now();RETURN FOUND;
END $$;
CREATE FUNCTION staging_test_programme.seed_xero_20261030_consent(d text,o uuid,s uuid,t uuid,c uuid,ct bytea,dek bytea,kv text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme,public AS $$
BEGIN
 IF d IS NULL OR o IS NULL OR s IS NULL OR t IS NULL OR c IS NULL OR ct IS NULL OR dek IS NULL OR kv IS NULL OR length(kv) NOT BETWEEN 1 AND 128 OR now()>='2026-11-06T00:00:00Z'::timestamptz THEN RETURN false; END IF;
 PERFORM 1 FROM staging_test_programme.xero_restart_20261030_oauth_states WHERE state_digest=d AND owner_id=o AND store_id=s AND status='consumed' AND expires_at>now() FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.user_id=o AND m.store_id=s) THEN RETURN false; END IF;
 LOCK TABLE staging_test_programme.programmes IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM staging_test_programme.programmes WHERE programme_key='xero-staging-20261030' OR provider='xero' AND enabled AND NOT stopped AND ends_at>now()) OR EXISTS(SELECT 1 FROM staging_test_programme.actions a JOIN staging_test_programme.programmes p USING(programme_key) WHERE p.provider='xero' AND a.state IN ('claimed','submitted','uncertain')) THEN RETURN false; END IF;
 INSERT INTO staging_test_programme.programmes(programme_key,provider,project_ref,target,starts_at,ends_at,action_cap,enabled,stopped)
 VALUES('xero-staging-20261030','xero','bioalckltvkhlczusdvl',t::text,'2026-10-30T00:00:00Z','2026-11-06T00:00:00Z',7,false,false);
 INSERT INTO staging_test_programme.writer_envelopes(programme_key,connection_id,tenant_id,ciphertext,encrypted_dek,key_version,algorithm,version)
 VALUES('xero-staging-20261030',c,t,ct,dek,kv,'AES-256-GCM',1);
 UPDATE staging_test_programme.xero_restart_20261030_oauth_states SET status='seeded' WHERE state_digest=d;RETURN true;
END $$;
CREATE FUNCTION staging_test_programme.xero_daily_20261030_ready(p text,provider_name text,target_name text,cap integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme AS $$
DECLARE r staging_test_programme.programmes%ROWTYPE;local_now timestamp:=now() AT TIME ZONE 'Europe/London';
BEGIN
 IF p IS DISTINCT FROM 'xero-staging-20261030' OR provider_name IS DISTINCT FROM 'xero' OR target_name IS NULL OR cap IS DISTINCT FROM 7 THEN RETURN false; END IF;
 SELECT * INTO r FROM staging_test_programme.programmes WHERE programme_key=p;
 IF NOT FOUND OR r.provider<>'xero' OR r.project_ref<>'bioalckltvkhlczusdvl' OR r.target<>target_name OR r.action_cap<>7 OR NOT r.enabled OR r.stopped OR r.starts_at<>'2026-10-30T00:00:00Z'::timestamptz OR r.ends_at<>'2026-11-06T00:00:00Z'::timestamptz THEN RETURN false; END IF;
 IF local_now::date<DATE '2026-10-30' OR local_now::date>DATE '2026-11-05' OR local_now::time<TIME '18:00' OR local_now::time>=TIME '18:15' THEN RETURN false; END IF;
 RETURN EXISTS(SELECT 1 FROM staging_test_programme.writer_envelopes e WHERE e.programme_key=p AND e.tenant_id::text=target_name AND e.refresh_claim IS NULL);
END $$;
REVOKE ALL ON FUNCTION staging_test_programme.start_xero_20261030_consent(text,uuid,uuid),staging_test_programme.consume_xero_20261030_consent(text,uuid,uuid),staging_test_programme.seed_xero_20261030_consent(text,uuid,uuid,uuid,uuid,bytea,bytea,text),staging_test_programme.xero_daily_20261030_ready(text,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION staging_test_programme.start_xero_20261030_consent(text,uuid,uuid),staging_test_programme.consume_xero_20261030_consent(text,uuid,uuid),staging_test_programme.seed_xero_20261030_consent(text,uuid,uuid,uuid,uuid,bytea,bytea,text),staging_test_programme.xero_daily_20261030_ready(text,text,text,integer) TO night_scout_test_writer_service;
-- Chain, do not replace, any already-installed Shopify daily claim safeguards.
ALTER FUNCTION staging_test_programme.claim_action(text,text,text,text,text,integer) RENAME TO claim_action_before_xero_20261030;
REVOKE ALL ON FUNCTION staging_test_programme.claim_action_before_xero_20261030(text,text,text,text,text,integer) FROM PUBLIC,night_scout_test_writer_service,night_scout_test_writer;
CREATE FUNCTION staging_test_programme.claim_action(p text,k text,d text,provider_name text,target_name text,cap integer) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme AS $$
DECLARE result text;
BEGIN
 IF p IS NULL OR k IS NULL OR d IS NULL OR provider_name IS NULL OR target_name IS NULL OR cap IS NULL THEN RETURN 'blocked'; END IF;
 IF p='xero-staging-20261030' THEN
  PERFORM 1 FROM staging_test_programme.programmes WHERE programme_key=p FOR UPDATE;
  IF NOT staging_test_programme.xero_daily_20261030_ready(p,provider_name,target_name,cap) THEN RETURN 'blocked'; END IF;
  IF NOT EXISTS(SELECT 1 FROM staging_test_programme.actions WHERE programme_key=p AND action_key=k) AND EXISTS(SELECT 1 FROM staging_test_programme.actions WHERE programme_key=p AND (created_at AT TIME ZONE 'Europe/London')::date=(now() AT TIME ZONE 'Europe/London')::date) THEN RETURN 'blocked'; END IF;
 END IF;
 SELECT staging_test_programme.claim_action_before_xero_20261030(p,k,d,provider_name,target_name,cap) INTO result;RETURN result;
END $$;
REVOKE ALL ON FUNCTION staging_test_programme.claim_action(text,text,text,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION staging_test_programme.claim_action(text,text,text,text,text,integer) TO night_scout_test_writer_service;
COMMIT;
