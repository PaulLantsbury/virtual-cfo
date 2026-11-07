-- STAGING ONLY. Append-only, worker-private evidence for the non-consuming
-- Xero connection preflight. No provider identifiers, payloads or tokens are
-- retained. Accounting retry authorization is intentionally untouched.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog,xero_v1,public;

CREATE TABLE xero_v1.connection_preflight_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 connection_id uuid NOT NULL REFERENCES xero_v1.connections(id),
 checked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 outcome text NOT NULL CHECK(outcome IN ('connected','failed')),
 phase text NOT NULL CHECK(phase IN ('token','connection','organisation')),
 reason text NOT NULL CHECK(reason IN (
  'ok','invalid_grant','refresh_failed','insufficient_scope','unauthorized',
  'forbidden','reconnect_required','rate_limited','upstream_unavailable',
  'provider_unavailable','malformed_response'
 )),
 provider_status smallint CHECK(provider_status IN (401,403,429,500,502,503,504)),
 tenant_visible boolean,
 credential_version integer NOT NULL CHECK(credential_version>0),
 CHECK(
  (outcome='connected' AND phase='organisation' AND reason='ok'
   AND provider_status IS NULL AND tenant_visible=true)
  OR
  (outcome='failed' AND reason<>'ok')
 )
);

ALTER TABLE xero_v1.connection_preflight_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON xero_v1.connection_preflight_evidence
 FROM PUBLIC,anon,authenticated,night_scout_xero_bootstrap_login,night_scout_import_login;

CREATE FUNCTION xero_v1.worker_record_connection_preflight(
 p_connection_id uuid,p_credential_version integer,p_outcome text,p_phase text,p_reason text,
 p_provider_status smallint,p_tenant_visible boolean,p_lease_expires_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER VOLATILE
SET search_path=pg_catalog,xero_v1 AS $$
BEGIN
 IF session_user<>'night_scout_import_login' THEN
  RAISE EXCEPTION 'Xero worker capability required';
 END IF;
 IF p_connection_id IS NULL OR p_credential_version<1 OR p_lease_expires_at IS NULL THEN
  RAISE EXCEPTION 'invalid Xero preflight evidence';
 END IF;
 IF NOT EXISTS(
  SELECT 1
  FROM xero_v1.connections c
  JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id
  WHERE c.id=p_connection_id AND c.retired_at IS NULL
   AND ce.version=p_credential_version
   AND ce.lease_expires_at=p_lease_expires_at
   AND ce.lease_expires_at>clock_timestamp()
 ) THEN
  RAISE EXCEPTION 'Xero preflight credential lease unavailable';
 END IF;
 INSERT INTO xero_v1.connection_preflight_evidence(
  connection_id,credential_version,outcome,phase,reason,provider_status,tenant_visible)
 VALUES(p_connection_id,p_credential_version,p_outcome,p_phase,p_reason,p_provider_status,p_tenant_visible);
 RETURN true;
END $$;

REVOKE ALL ON FUNCTION xero_v1.worker_record_connection_preflight(uuid,integer,text,text,text,smallint,boolean,timestamptz)
 FROM PUBLIC,anon,authenticated,night_scout_xero_bootstrap_login;
GRANT EXECUTE ON FUNCTION xero_v1.worker_record_connection_preflight(uuid,integer,text,text,text,smallint,boolean,timestamptz)
 TO night_scout_import_login;

COMMIT;
