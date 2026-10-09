-- PROPOSAL ONLY. Apply after provider-ledger-proposal.sql in exact staging.
-- The login/password is deliberately not created; operator creates a restricted
-- NOINHERIT login and grants this NOLOGIN capability role, with no other membership.
CREATE ROLE night_scout_test_writer_service NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE TABLE staging_test_programme.writer_envelopes (
 programme_key text PRIMARY KEY REFERENCES staging_test_programme.programmes,
 connection_id uuid NOT NULL,
 tenant_id uuid NOT NULL,
 ciphertext bytea NOT NULL CHECK (octet_length(ciphertext) BETWEEN 30 AND 16384),
 encrypted_dek bytea NOT NULL CHECK (octet_length(encrypted_dek) BETWEEN 30 AND 16384),
 key_version text NOT NULL CHECK (length(key_version) BETWEEN 1 AND 128),
 algorithm text NOT NULL CHECK (algorithm='AES-256-GCM'),
 version integer NOT NULL CHECK (version>0),
 refresh_claim uuid,
 rotated_at timestamptz
);
ALTER TABLE staging_test_programme.programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging_test_programme.actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging_test_programme.writer_envelopes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA staging_test_programme FROM PUBLIC,night_scout_test_writer_service;
GRANT USAGE ON SCHEMA staging_test_programme TO night_scout_test_writer_service;

CREATE FUNCTION staging_test_programme.claim_action(p text,k text,d text,provider_name text,target_name text,cap integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme AS $$
DECLARE r staging_test_programme.programmes%ROWTYPE; a staging_test_programme.actions%ROWTYPE;
BEGIN
 SELECT * INTO r FROM staging_test_programme.programmes WHERE programme_key=p FOR UPDATE;
 IF NOT FOUND OR NOT r.enabled OR r.stopped OR r.provider<>provider_name OR r.target<>target_name OR r.action_cap<>cap OR now()<r.starts_at OR now()>=r.ends_at THEN RETURN 'blocked'; END IF;
 SELECT * INTO a FROM staging_test_programme.actions WHERE programme_key=p AND action_key=k;
 IF FOUND THEN IF a.payload_digest=d THEN RETURN 'existing'; ELSE RETURN 'blocked'; END IF; END IF;
 IF d !~ '^[0-9a-f]{64}$' OR k !~ '^ns-[0-9a-f]{40}$' THEN RETURN 'blocked'; END IF;
 IF EXISTS(SELECT 1 FROM staging_test_programme.actions WHERE programme_key=p AND state IN ('claimed','submitted','uncertain')) OR (SELECT count(*) FROM staging_test_programme.actions WHERE programme_key=p)>=r.action_cap THEN RETURN 'blocked'; END IF;
 INSERT INTO staging_test_programme.actions(programme_key,action_key,payload_digest,state) VALUES(p,k,d,'claimed'); RETURN 'claimed';
END $$;
CREATE FUNCTION staging_test_programme.transition_action(p text,k text,old_state text,new_state text,sid text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme AS $$
DECLARE n integer;
BEGIN
 PERFORM 1 FROM staging_test_programme.programmes WHERE programme_key=p FOR UPDATE;
 IF NOT ((old_state='claimed' AND new_state='submitted' AND sid IS NULL) OR (old_state='submitted' AND new_state='uncertain' AND sid IS NULL) OR (old_state='submitted' AND new_state='confirmed' AND length(sid) BETWEEN 1 AND 256)) THEN RETURN false; END IF;
 UPDATE staging_test_programme.actions SET state=new_state,source_id=sid,
 submitted_at=CASE WHEN new_state='submitted' THEN now() ELSE submitted_at END,
 confirmed_at=CASE WHEN new_state='confirmed' THEN now() ELSE confirmed_at END
 WHERE programme_key=p AND action_key=k AND state=old_state;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n=1 AND new_state='uncertain' THEN UPDATE staging_test_programme.programmes SET stopped=true WHERE programme_key=p; END IF;
 RETURN n=1;
END $$;
CREATE FUNCTION staging_test_programme.claim_writer_envelope(p text,t uuid)
RETURNS TABLE(connection_id uuid,tenant_id uuid,ciphertext bytea,encrypted_dek bytea,key_version text,algorithm text,version integer,refresh_claim uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme AS $$
DECLARE r staging_test_programme.programmes%ROWTYPE; claim uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO r FROM staging_test_programme.programmes WHERE programme_key=p FOR UPDATE;
 IF NOT FOUND OR r.provider<>'xero' OR r.target<>t::text OR NOT r.enabled OR r.stopped OR now()<r.starts_at OR now()>=r.ends_at THEN RETURN; END IF;
 UPDATE staging_test_programme.writer_envelopes e SET refresh_claim=claim WHERE e.programme_key=p AND e.tenant_id=t AND e.refresh_claim IS NULL;
 IF NOT FOUND THEN RETURN; END IF;
 RETURN QUERY SELECT e.connection_id,e.tenant_id,e.ciphertext,e.encrypted_dek,e.key_version,e.algorithm,e.version,e.refresh_claim FROM staging_test_programme.writer_envelopes e WHERE e.programme_key=p;
END $$;
CREATE FUNCTION staging_test_programme.rotate_writer_envelope(p text,t uuid,c uuid,v integer,ct bytea,dek bytea)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme AS $$
DECLARE n integer;
BEGIN
 PERFORM 1 FROM staging_test_programme.programmes WHERE programme_key=p FOR UPDATE;
 UPDATE staging_test_programme.writer_envelopes SET ciphertext=ct,encrypted_dek=dek,version=version+1,rotated_at=now(),refresh_claim=NULL
 WHERE programme_key=p AND tenant_id=t AND refresh_claim=c AND version=v;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n=1;
END $$;
CREATE FUNCTION staging_test_programme.stop_programme(p text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme AS $$
BEGIN UPDATE staging_test_programme.programmes SET stopped=true WHERE programme_key=p; RETURN FOUND; END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA staging_test_programme FROM PUBLIC;
GRANT EXECUTE ON FUNCTION staging_test_programme.claim_action(text,text,text,text,text,integer),
 staging_test_programme.transition_action(text,text,text,text,text),
 staging_test_programme.claim_writer_envelope(text,uuid),
 staging_test_programme.rotate_writer_envelope(text,uuid,uuid,integer,bytea,bytea),
 staging_test_programme.stop_programme(text) TO night_scout_test_writer_service;
-- Envelope seeding is an operator action after separate test-writer OAuth consent.
-- Never copy the existing reader envelope or grant access to xero_v1 credentials.
