-- NIGHT SCOUT STAGING ONLY. Creates an isolated disabled writer capability.
-- No programme rows, provider credentials or source writes are installed here.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL night_scout.approved_project='bioalckltvkhlczusdvl';
DO $guard$ BEGIN
 IF current_setting('night_scout.approved_project',true)<>'bioalckltvkhlczusdvl' THEN RAISE EXCEPTION 'Wrong staging project'; END IF;
 IF current_setting('server_version_num')::integer<170000 THEN RAISE EXCEPTION 'PostgreSQL17 or newer required'; END IF;
 IF to_regnamespace('staging_test_programme') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ('night_scout_test_writer','night_scout_test_writer_service')) THEN RAISE EXCEPTION 'Writer installation target occupied; inspect before retry'; END IF;
 IF current_user IN ('night_scout_test_writer','night_scout_test_writer_service') THEN RAISE EXCEPTION 'Operator installation required'; END IF;
 IF to_regclass('public.store_memberships') IS NULL OR (SELECT count(*) FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('public.store_memberships') AND attname IN ('user_id','store_id') AND atttypid='uuid'::regtype AND NOT attisdropped)<>2 THEN RAISE EXCEPTION 'Existing membership boundary required'; END IF;
END $guard$;
-- PROPOSAL ONLY: no runner imports this file, no grants or activation.
-- Atomic claim adapter must lock the programme row, enforce stop/cap, then insert.
-- A submitted action has no lease expiry and can only be reconciled, never reclaimed.
CREATE SCHEMA IF NOT EXISTS staging_test_programme;
CREATE TABLE staging_test_programme.programmes (
 programme_key text PRIMARY KEY,
 provider text NOT NULL CHECK (provider IN ('shopify','xero')),
 project_ref text NOT NULL CHECK (project_ref = 'bioalckltvkhlczusdvl'),
 target text NOT NULL,
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '14 days'),
 action_cap integer NOT NULL CHECK (action_cap BETWEEN 1 AND 14),
 enabled boolean NOT NULL DEFAULT false,
 stopped boolean NOT NULL DEFAULT false
);
CREATE TABLE staging_test_programme.actions (
 programme_key text NOT NULL REFERENCES staging_test_programme.programmes(programme_key),
 action_key text NOT NULL,
 payload_digest text NOT NULL CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
 state text NOT NULL CHECK (state IN ('claimed','submitted','confirmed','uncertain','skipped')),
 source_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 submitted_at timestamptz,
 confirmed_at timestamptz,
 PRIMARY KEY(programme_key, action_key),
 CHECK ((state = 'confirmed') = (source_id IS NOT NULL AND confirmed_at IS NOT NULL))
);
REVOKE ALL ON SCHEMA staging_test_programme FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA staging_test_programme FROM PUBLIC;
-- No credential columns, raw response/error columns, automatic cleanup or retry.
-- Before application: reviewed least-privilege RPC/role, RLS, cap locking,
-- immutable submitted records, target-bound reconciliation and stop semantics.

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

CREATE ROLE night_scout_test_writer LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 3;
GRANT night_scout_test_writer_service TO night_scout_test_writer WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
REVOKE ALL ON SCHEMA staging_test_programme FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA staging_test_programme FROM PUBLIC,night_scout_test_writer,night_scout_test_writer_service;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA staging_test_programme FROM PUBLIC,night_scout_test_writer;
DO $browser$ DECLARE r text; BEGIN
 FOR r IN SELECT rolname FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated') LOOP
 EXECUTE format('REVOKE ALL ON SCHEMA staging_test_programme FROM %I',r);
 EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA staging_test_programme FROM %I',r);
 EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA staging_test_programme FROM %I',r);
 END LOOP;
END $browser$;
DO $check$ BEGIN
 IF (SELECT count(*) FROM staging_test_programme.programmes)<>0 OR (SELECT count(*) FROM staging_test_programme.actions)<>0 OR (SELECT count(*) FROM staging_test_programme.writer_envelopes)<>0 OR (SELECT count(*) FROM staging_test_programme.writer_oauth_states)<>0 THEN RAISE EXCEPTION 'Unexpected writer data'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ('night_scout_test_writer','night_scout_test_writer_service') AND (rolsuper OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN RAISE EXCEPTION 'Unsafe writer role'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='night_scout_test_writer' AND rolcanlogin AND rolconnlimit=3) OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='night_scout_test_writer_service' AND NOT rolcanlogin) THEN RAISE EXCEPTION 'Unsafe writer login capability'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles u ON u.oid=m.member WHERE u.rolname IN ('night_scout_test_writer','night_scout_test_writer_service'))<>1 THEN RAISE EXCEPTION 'Unexpected writer membership'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles u ON u.oid=m.member WHERE u.rolname='night_scout_test_writer' AND (m.admin_option OR m.inherit_option OR NOT m.set_option)) THEN RAISE EXCEPTION 'Unsafe writer membership'; END IF;
END $check$;
COMMIT;
SELECT 'writer_schema_installed_disabled' AS state, 0 AS enabled_programmes;
