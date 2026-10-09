-- Isolated writer consent state. Hash only; no OAuth codes/tokens or plaintext secrets.
CREATE TABLE staging_test_programme.writer_oauth_states(
 state_digest text PRIMARY KEY CHECK(state_digest ~ '^[0-9a-f]{64}$'),
 owner_id uuid NOT NULL,store_id uuid NOT NULL,
 expires_at timestamptz NOT NULL CHECK(expires_at<=now()+interval '10 minutes'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','consumed','seeded')),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE staging_test_programme.writer_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON staging_test_programme.writer_oauth_states FROM PUBLIC,night_scout_test_writer_service;
CREATE FUNCTION staging_test_programme.start_writer_consent(d text,o uuid,s uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme,public AS $$
BEGIN
 IF d !~ '^[0-9a-f]{64}$' OR NOT EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.user_id=o AND m.store_id=s) OR EXISTS(SELECT 1 FROM staging_test_programme.writer_envelopes WHERE programme_key='xero-staging-20261012') THEN RETURN false; END IF;
 DELETE FROM staging_test_programme.writer_oauth_states WHERE owner_id=o AND store_id=s AND status='pending';
 INSERT INTO staging_test_programme.writer_oauth_states(state_digest,owner_id,store_id,expires_at) VALUES(d,o,s,now()+interval '10 minutes');RETURN true;
END $$;
CREATE FUNCTION staging_test_programme.consume_writer_consent(d text,o uuid,s uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.user_id=o AND m.store_id=s) THEN RETURN false; END IF;
 UPDATE staging_test_programme.writer_oauth_states SET status='consumed' WHERE state_digest=d AND owner_id=o AND store_id=s AND status='pending' AND expires_at>now();RETURN FOUND;
END $$;
CREATE FUNCTION staging_test_programme.seed_writer_consent(d text,o uuid,s uuid,t uuid,c uuid,ct bytea,dek bytea,kv text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme,public AS $$
DECLARE p staging_test_programme.programmes%ROWTYPE;
BEGIN
 PERFORM 1 FROM staging_test_programme.writer_oauth_states WHERE state_digest=d AND owner_id=o AND store_id=s AND status='consumed' AND expires_at>now() FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.user_id=o AND m.store_id=s) OR EXISTS(SELECT 1 FROM staging_test_programme.writer_envelopes WHERE programme_key='xero-staging-20261012') THEN RETURN false; END IF;
 SELECT * INTO p FROM staging_test_programme.programmes WHERE programme_key='xero-staging-20261012' FOR UPDATE;
 IF FOUND THEN
 IF p.provider<>'xero' OR p.project_ref<>'bioalckltvkhlczusdvl' OR p.target<>t::text OR p.enabled OR p.stopped OR p.action_cap<>6 OR p.starts_at<>'2026-10-12T00:00:00Z'::timestamptz OR p.ends_at<>'2026-10-26T00:00:00Z'::timestamptz THEN RETURN false; END IF;
 ELSE
 INSERT INTO staging_test_programme.programmes(programme_key,provider,project_ref,target,starts_at,ends_at,action_cap,enabled,stopped)
 VALUES('xero-staging-20261012','xero','bioalckltvkhlczusdvl',t::text,'2026-10-12T00:00:00Z','2026-10-26T00:00:00Z',6,false,false);
 END IF;
 INSERT INTO staging_test_programme.writer_envelopes(programme_key,connection_id,tenant_id,ciphertext,encrypted_dek,key_version,algorithm,version)
 VALUES('xero-staging-20261012',c,t,ct,dek,kv,'AES-256-GCM',1);
 UPDATE staging_test_programme.writer_oauth_states SET status='seeded' WHERE state_digest=d;RETURN true;
END $$;
REVOKE ALL ON FUNCTION staging_test_programme.start_writer_consent(text,uuid,uuid),staging_test_programme.consume_writer_consent(text,uuid,uuid),staging_test_programme.seed_writer_consent(text,uuid,uuid,uuid,uuid,bytea,bytea,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION staging_test_programme.start_writer_consent(text,uuid,uuid),staging_test_programme.consume_writer_consent(text,uuid,uuid),staging_test_programme.seed_writer_consent(text,uuid,uuid,uuid,uuid,bytea,bytea,text) TO night_scout_test_writer_service;
