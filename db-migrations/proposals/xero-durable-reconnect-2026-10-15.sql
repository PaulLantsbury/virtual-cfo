-- PROPOSAL ONLY. Separate staging migration approval required; no runtime activation.
-- Existing server bootstrap identity is reused, not a new password/role. It is
-- already the narrow encrypted-credential bootstrap boundary; browser/import
-- identities receive no RPC or relation access. Existing ordinal RPCs unchanged.
-- Owner authority is the latest confirmed mapping owner plus current membership,
-- matching existing staging bootstrap policy. This is NOT a generic role model.
-- Scope read-only-v1 denotes the existing full read-only scope set plus offline.
-- No codes, verifier, raw state, session, tokens or pending token envelope here.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'staging migration owner required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='night_scout_xero_bootstrap_login' AND rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls AND rolconnlimit=1) THEN RAISE EXCEPTION 'reviewed bootstrap role required'; END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members am WHERE am.member='night_scout_xero_bootstrap_login'::regrole OR am.roleid='night_scout_xero_bootstrap_login'::regrole) THEN RAISE EXCEPTION 'bootstrap membership drift'; END IF;
END $$;
CREATE TABLE xero_v1.customer_reconnect_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 connection_id uuid NOT NULL REFERENCES xero_v1.connections(id),
 store_id uuid NOT NULL REFERENCES public.stores(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 tenant_id text NOT NULL CHECK(length(tenant_id) BETWEEN 1 AND 256),
 expected_version integer NOT NULL CHECK(expected_version BETWEEN 1 AND 2147483646),
 session_digest text NOT NULL CHECK(session_digest ~ '^[a-f0-9]{64}$'),
 state_digest text NOT NULL UNIQUE CHECK(state_digest ~ '^[a-f0-9]{64}$'),
 scope_version text NOT NULL CHECK(scope_version='read-only-v1'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','exchanging','consumed','failed','expired')),
 exchange_claim uuid UNIQUE,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '10 minutes',
 finished_at timestamptz,
 replacement_version integer,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '10 minutes 1 second'),
 CHECK((status='pending' AND exchange_claim IS NULL) OR status<>'pending'),
 CHECK((status IN ('pending','exchanging') AND finished_at IS NULL AND replacement_version IS NULL)
 OR (status IN ('failed','expired') AND finished_at IS NOT NULL AND replacement_version IS NULL)
 OR (status='consumed' AND finished_at IS NOT NULL AND exchange_claim IS NOT NULL AND replacement_version=expected_version+1))
);
CREATE UNIQUE INDEX customer_reconnect_one_active ON xero_v1.customer_reconnect_attempts(connection_id) WHERE status IN ('pending','exchanging');
ALTER TABLE xero_v1.customer_reconnect_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON xero_v1.customer_reconnect_attempts FROM PUBLIC,anon,authenticated,service_role,night_scout_import_login,night_scout_xero_bootstrap_login;

-- Internal common lock order: store -> connection -> membership -> credential -> attempt.
-- Membership FOR SHARE prevents concurrent revocation until command commits.
CREATE FUNCTION xero_v1._customer_reconnect_guard(p_store uuid,p_owner uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,xero_v1,public AS $$
DECLARE v_connection uuid; v_count integer; v_owner uuid; v_version integer;
BEGIN
 IF session_user<>'night_scout_xero_bootstrap_login' OR p_store IS DISTINCT FROM '56d92f8a-746e-4b4f-b408-81fc98c4aa17'::uuid OR p_owner IS NULL THEN RAISE EXCEPTION 'Xero reconnect unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls AND rolconnlimit=1) OR EXISTS(SELECT 1 FROM pg_auth_members am WHERE am.member='night_scout_xero_bootstrap_login'::regrole OR am.roleid='night_scout_xero_bootstrap_login'::regrole) THEN RAISE EXCEPTION 'Xero reconnect unavailable'; END IF;
 PERFORM 1 FROM public.stores s WHERE s.id=p_store FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Xero reconnect unavailable'; END IF;
 SELECT count(*) INTO v_count FROM xero_v1.connections c WHERE c.store_id=p_store AND c.retired_at IS NULL;
 IF v_count<>1 THEN RAISE EXCEPTION 'Xero reconnect unavailable'; END IF;
 SELECT c.id INTO v_connection FROM xero_v1.connections c WHERE c.store_id=p_store AND c.retired_at IS NULL FOR UPDATE;
 IF v_connection IS NULL THEN RAISE EXCEPTION 'Xero reconnect unavailable'; END IF;
 PERFORM 1 FROM public.store_memberships sm WHERE sm.store_id=p_store AND sm.user_id=p_owner FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Xero reconnect unavailable'; END IF;
 SELECT mv.confirmed_by INTO v_owner FROM xero_v1.mapping_versions mv WHERE mv.connection_id=v_connection ORDER BY mv.version DESC,mv.id DESC LIMIT 1 FOR SHARE;
 IF v_owner IS DISTINCT FROM p_owner THEN RAISE EXCEPTION 'Xero reconnect unavailable'; END IF;
 SELECT ce.version INTO v_version FROM xero_v1.credential_envelopes ce WHERE ce.connection_id=v_connection AND ce.version BETWEEN 1 AND 2147483646 AND (ce.lease_expires_at IS NULL OR ce.lease_expires_at<=clock_timestamp()) FOR UPDATE;
 IF v_version IS NULL THEN RAISE EXCEPTION 'Xero reconnect unavailable'; END IF;
 RETURN v_connection;
END $$;

CREATE FUNCTION xero_v1.customer_reconnect_begin(p_store uuid,p_owner uuid,p_session_digest text,p_state_digest text,p_scope_version text)
RETURNS TABLE(attempt_id uuid,connection_id uuid,tenant_id text,credential_version integer,expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,xero_v1,public AS $$
DECLARE v_connection uuid;v_attempt uuid;
BEGIN
 v_connection:=xero_v1._customer_reconnect_guard(p_store,p_owner);
 IF p_session_digest IS NULL OR p_session_digest !~ '^[a-f0-9]{64}$' OR p_state_digest IS NULL OR p_state_digest !~ '^[a-f0-9]{64}$' OR p_scope_version IS DISTINCT FROM 'read-only-v1' THEN RAISE EXCEPTION 'Xero reconnect unavailable'; END IF;
 UPDATE xero_v1.customer_reconnect_attempts a SET status='expired',finished_at=clock_timestamp() WHERE a.connection_id=v_connection AND a.status IN ('pending','exchanging') AND a.expires_at<=clock_timestamp();
 IF EXISTS(SELECT 1 FROM xero_v1.customer_reconnect_attempts a WHERE a.connection_id=v_connection AND a.status IN ('pending','exchanging')) THEN RAISE EXCEPTION 'Xero reconnect unavailable'; END IF;
 INSERT INTO xero_v1.customer_reconnect_attempts(connection_id,store_id,actor_id,tenant_id,expected_version,session_digest,state_digest,scope_version)
 SELECT c.id,c.store_id,p_owner,c.tenant_id,ce.version,p_session_digest,p_state_digest,p_scope_version FROM xero_v1.connections c JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id WHERE c.id=v_connection RETURNING id INTO v_attempt;
 RETURN QUERY SELECT a.id,a.connection_id,a.tenant_id,a.expected_version,a.expires_at FROM xero_v1.customer_reconnect_attempts a WHERE a.id=v_attempt;
END $$;

CREATE FUNCTION xero_v1.customer_reconnect_claim(p_attempt uuid,p_store uuid,p_owner uuid,p_session_digest text,p_state_digest text)
RETURNS TABLE(exchange_claim uuid,connection_id uuid,tenant_id text,credential_version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,xero_v1,public AS $$
DECLARE v_connection uuid;v_attempt xero_v1.customer_reconnect_attempts%ROWTYPE;v_claim uuid;
BEGIN
 v_connection:=xero_v1._customer_reconnect_guard(p_store,p_owner);
 SELECT a.* INTO v_attempt FROM xero_v1.customer_reconnect_attempts a WHERE a.id=p_attempt AND a.connection_id=v_connection AND a.store_id=p_store AND a.actor_id=p_owner AND a.session_digest=p_session_digest FOR UPDATE;
 IF v_attempt.id IS NULL THEN RAISE EXCEPTION 'Xero reconnect unavailable'; END IF;
 IF v_attempt.status<>'pending' OR v_attempt.state_digest IS DISTINCT FROM p_state_digest OR v_attempt.expires_at<=clock_timestamp() OR NOT EXISTS(SELECT 1 FROM xero_v1.credential_envelopes ce WHERE ce.connection_id=v_connection AND ce.version=v_attempt.expected_version) THEN RAISE EXCEPTION 'Xero reconnect unavailable'; END IF;
 v_claim:=gen_random_uuid();
 UPDATE xero_v1.customer_reconnect_attempts SET status='exchanging',exchange_claim=v_claim WHERE id=p_attempt;
 RETURN QUERY SELECT v_claim,v_connection,v_attempt.tenant_id,v_attempt.expected_version;
END $$;
CREATE FUNCTION xero_v1.customer_reconnect_fail(p_attempt uuid,p_claim uuid,p_store uuid,p_owner uuid,p_session_digest text)
RETURNS TABLE(state text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,xero_v1,public AS $$
DECLARE v_connection uuid;v_attempt xero_v1.customer_reconnect_attempts%ROWTYPE;
BEGIN
 v_connection:=xero_v1._customer_reconnect_guard(p_store,p_owner);
 SELECT a.* INTO v_attempt FROM xero_v1.customer_reconnect_attempts a WHERE a.id=p_attempt AND a.connection_id=v_connection AND a.store_id=p_store AND a.actor_id=p_owner AND a.session_digest=p_session_digest FOR UPDATE;
 IF v_attempt.id IS NULL THEN RAISE EXCEPTION 'Xero reconnect unavailable'; END IF;
 IF v_attempt.exchange_claim IS DISTINCT FROM p_claim OR p_claim IS NULL OR v_attempt.status NOT IN ('exchanging','failed') THEN RAISE EXCEPTION 'Xero reconnect unavailable'; END IF;
 UPDATE xero_v1.customer_reconnect_attempts SET status='failed',finished_at=coalesce(finished_at,clock_timestamp()) WHERE id=p_attempt;
 RETURN QUERY SELECT 'failed'::text;
END $$;
CREATE FUNCTION xero_v1.customer_reconnect_finalize(p_attempt uuid,p_claim uuid,p_store uuid,p_owner uuid,p_session_digest text,p_tenant text,p_scope_version text,p_ciphertext bytea,p_encrypted_dek bytea,p_key_version text,p_algorithm text,p_expected_connection uuid,p_expected_version integer)
RETURNS TABLE(connection_id uuid,credential_version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,xero_v1,public AS $$
DECLARE v_connection uuid;v_attempt xero_v1.customer_reconnect_attempts%ROWTYPE;
BEGIN
 v_connection:=xero_v1._customer_reconnect_guard(p_store,p_owner);
 SELECT a.* INTO v_attempt FROM xero_v1.customer_reconnect_attempts a WHERE a.id=p_attempt AND a.connection_id=v_connection AND a.store_id=p_store AND a.actor_id=p_owner AND a.session_digest=p_session_digest FOR UPDATE;
 IF v_attempt.id IS NULL THEN RAISE EXCEPTION 'Xero reconnect unavailable'; END IF;
 IF p_expected_connection IS DISTINCT FROM v_attempt.connection_id OR p_expected_version IS DISTINCT FROM v_attempt.expected_version
 OR v_attempt.status<>'exchanging' OR p_claim IS NULL OR v_attempt.exchange_claim IS DISTINCT FROM p_claim OR v_attempt.expires_at<=clock_timestamp()
 OR v_attempt.tenant_id IS DISTINCT FROM p_tenant OR v_attempt.scope_version IS DISTINCT FROM p_scope_version
 OR NOT EXISTS(SELECT 1 FROM xero_v1.connections c WHERE c.id=v_connection AND c.tenant_id=v_attempt.tenant_id)
 OR p_ciphertext IS NULL OR octet_length(p_ciphertext) NOT BETWEEN 1 AND 16384
 OR p_encrypted_dek IS NULL OR octet_length(p_encrypted_dek) NOT BETWEEN 1 AND 16384
 OR p_key_version IS NULL OR p_key_version !~ '^[A-Za-z0-9._-]{1,128}$' OR p_algorithm IS DISTINCT FROM 'AES-256-GCM'
 THEN RAISE EXCEPTION 'Xero reconnect unavailable'; END IF;
 UPDATE xero_v1.credential_envelopes ce SET ciphertext=p_ciphertext,encrypted_dek=p_encrypted_dek,key_version=p_key_version,algorithm=p_algorithm,version=ce.version+1,rotated_at=clock_timestamp(),lease_expires_at=NULL
 WHERE ce.connection_id=v_connection AND ce.version=v_attempt.expected_version AND (ce.lease_expires_at IS NULL OR ce.lease_expires_at<=clock_timestamp());
 IF NOT FOUND THEN RAISE EXCEPTION 'Xero reconnect unavailable'; END IF;
 UPDATE xero_v1.customer_reconnect_attempts SET status='consumed',finished_at=clock_timestamp(),replacement_version=v_attempt.expected_version+1 WHERE id=p_attempt;
 INSERT INTO xero_v1.credential_audit(connection_id,actor_id,action) VALUES(v_connection,p_owner,'credential_rotated');
 RETURN QUERY SELECT v_connection,v_attempt.expected_version+1;
END $$;

REVOKE ALL ON FUNCTION xero_v1._customer_reconnect_guard(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,night_scout_import_login,night_scout_xero_bootstrap_login;
REVOKE ALL ON FUNCTION xero_v1.customer_reconnect_begin(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated,service_role,night_scout_import_login,night_scout_xero_bootstrap_login;
REVOKE ALL ON FUNCTION xero_v1.customer_reconnect_claim(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role,night_scout_import_login,night_scout_xero_bootstrap_login;
REVOKE ALL ON FUNCTION xero_v1.customer_reconnect_fail(uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role,night_scout_import_login,night_scout_xero_bootstrap_login;
REVOKE ALL ON FUNCTION xero_v1.customer_reconnect_finalize(uuid,uuid,uuid,uuid,text,text,text,bytea,bytea,text,text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role,night_scout_import_login,night_scout_xero_bootstrap_login;
GRANT EXECUTE ON FUNCTION xero_v1.customer_reconnect_begin(uuid,uuid,text,text,text) TO night_scout_xero_bootstrap_login;
GRANT EXECUTE ON FUNCTION xero_v1.customer_reconnect_claim(uuid,uuid,uuid,text,text) TO night_scout_xero_bootstrap_login;
GRANT EXECUTE ON FUNCTION xero_v1.customer_reconnect_fail(uuid,uuid,uuid,uuid,text) TO night_scout_xero_bootstrap_login;
GRANT EXECUTE ON FUNCTION xero_v1.customer_reconnect_finalize(uuid,uuid,uuid,uuid,text,text,text,bytea,bytea,text,text,uuid,integer) TO night_scout_xero_bootstrap_login;
GRANT USAGE ON SCHEMA xero_v1 TO night_scout_xero_bootstrap_login;
COMMIT;
