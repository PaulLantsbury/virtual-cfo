-- STAGING-ONLY XERO WORKER ACCESS POST-INSTALL.
--
-- Run manually only after 20260918_apply_xero_staging.sql has completed and
-- its verification record has been reviewed in Night Scout Staging
-- (bioalckltvkhlczusdvl).  This is repeatable only for repairing/replacing the
-- same functions and grants; it creates no schema, tables, roles, data or
-- browser access.  It deliberately grants no table privilege to the worker.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog, public;

DO $$
BEGIN
  IF current_user = 'night_scout_import_login' THEN
    RAISE EXCEPTION 'run this as the staging migration owner, never as the worker login';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'night_scout_import_login'
                 AND rolcanlogin AND NOT rolinherit AND NOT rolsuper
                 AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication
                 AND NOT rolbypassrls AND rolconnlimit = 1) THEN
    RAISE EXCEPTION 'restricted night_scout_import_login prerequisite is missing or unsafe';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'xero_v1')
     OR to_regclass('xero_v1.connections') IS NULL
     OR to_regclass('xero_v1.credential_envelopes') IS NULL
     OR to_regclass('xero_v1.credential_audit') IS NULL
     OR to_regclass('xero_v1.accounting_evidence') IS NULL
     OR to_regclass('xero_v1.accounting_evidence_audit') IS NULL THEN
    RAISE EXCEPTION 'Xero staging schema is incomplete; run its one-shot installer and verification first';
  END IF;
END
$$;

-- A worker receives a single current envelope only for an active connection.
-- It has no SELECT grant on any Xero table and cannot enumerate connection IDs
-- through the database.  Scheduling decides which known connection IDs to run.
CREATE OR REPLACE FUNCTION xero_v1.worker_get_refresh_envelope(p_connection_id uuid)
RETURNS TABLE (
  connection_id uuid, tenant_id text, ciphertext bytea, encrypted_dek bytea,
  key_version text, algorithm text, version integer, lease_expires_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, xero_v1
AS $$
  SELECT c.id, c.tenant_id, e.ciphertext, e.encrypted_dek, e.key_version,
         e.algorithm, e.version, e.lease_expires_at
    FROM xero_v1.connections c
    JOIN xero_v1.credential_envelopes e ON e.connection_id = c.id
   WHERE c.id = p_connection_id
     AND c.retired_at IS NULL
$$;

-- Envelope rotations must be monotonic.  The opaque ciphertext and wrapped
-- data-encryption key never enter a browser-readable relation or audit field.
CREATE OR REPLACE FUNCTION xero_v1.worker_store_refresh_envelope(
  p_connection_id uuid, p_ciphertext bytea, p_encrypted_dek bytea,
  p_key_version text, p_algorithm text, p_version integer,
  p_lease_expires_at timestamptz DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, xero_v1
AS $$
DECLARE stored_connection uuid;
BEGIN
  IF p_algorithm <> 'AES-256-GCM' OR octet_length(p_ciphertext) NOT BETWEEN 1 AND 16384
     OR octet_length(p_encrypted_dek) NOT BETWEEN 1 AND 16384
     OR length(trim(p_key_version)) NOT BETWEEN 1 AND 128 OR p_version < 1 THEN
    RAISE EXCEPTION 'invalid encrypted credential envelope';
  END IF;
  PERFORM 1 FROM xero_v1.connections WHERE id = p_connection_id AND retired_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'active Xero connection is required'; END IF;
  INSERT INTO xero_v1.credential_envelopes AS e
    (connection_id,ciphertext,encrypted_dek,key_version,algorithm,version,rotated_at,lease_expires_at)
  VALUES (p_connection_id,p_ciphertext,p_encrypted_dek,p_key_version,p_algorithm,p_version,now(),p_lease_expires_at)
  ON CONFLICT (connection_id) DO UPDATE
    SET ciphertext=EXCLUDED.ciphertext, encrypted_dek=EXCLUDED.encrypted_dek,
        key_version=EXCLUDED.key_version, algorithm=EXCLUDED.algorithm,
        version=EXCLUDED.version, rotated_at=now(), lease_expires_at=EXCLUDED.lease_expires_at
    WHERE EXCLUDED.version = e.version + 1
  RETURNING connection_id INTO stored_connection;
  IF stored_connection IS NULL THEN
    RAISE EXCEPTION 'credential envelope version must be first or exactly one greater than the current version';
  END IF;
  INSERT INTO xero_v1.credential_audit(connection_id,action)
  VALUES (p_connection_id, CASE WHEN p_version = 1 THEN 'credential_stored' ELSE 'credential_rotated' END);
END
$$;

CREATE OR REPLACE FUNCTION xero_v1.worker_record_credential_refresh_failure(
  p_connection_id uuid, p_safe_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, xero_v1
AS $$
BEGIN
  IF p_safe_reason NOT IN ('invalid_grant','provider_unavailable','refresh_failed','scope_changed','tenant_unavailable') THEN
    RAISE EXCEPTION 'unsafe credential failure reason';
  END IF;
  PERFORM 1 FROM xero_v1.connections WHERE id = p_connection_id AND retired_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'active Xero connection is required'; END IF;
  INSERT INTO xero_v1.credential_audit(connection_id,action,safe_reason)
  VALUES (p_connection_id,'credential_refresh_failed',p_safe_reason);
END
$$;

-- The worker may append only the agreed, bounded calculated Xero evidence.
-- Table constraints reject malformed supported results and all value-bearing
-- failed/review rows.  Raw reports, transactions and OAuth data have no column.
CREATE OR REPLACE FUNCTION xero_v1.worker_record_accounting_evidence(
  p_connection_id uuid, p_mapping_version_id uuid, p_scope_from date, p_scope_to date,
  p_currency text, p_closed_period boolean, p_state text, p_reason text,
  p_report_as_of date, p_retrieved_at timestamptz, p_source_fingerprint text,
  p_booked_revenue_minor bigint, p_processing_fee_minor bigint,
  p_advertising_minor bigint, p_software_minor bigint, p_included_cash_minor bigint
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, xero_v1
AS $$
DECLARE evidence_id uuid;
BEGIN
  PERFORM 1 FROM xero_v1.connections WHERE id = p_connection_id AND retired_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'active Xero connection is required'; END IF;
  INSERT INTO xero_v1.accounting_evidence(
    connection_id,mapping_version_id,scope_from,scope_to,currency,closed_period,state,reason,
    report_as_of,retrieved_at,source_fingerprint,booked_revenue_minor,processing_fee_minor,
    advertising_minor,software_minor,included_cash_minor
  ) VALUES (
    p_connection_id,p_mapping_version_id,p_scope_from,p_scope_to,p_currency,p_closed_period,p_state,p_reason,
    p_report_as_of,p_retrieved_at,p_source_fingerprint,p_booked_revenue_minor,p_processing_fee_minor,
    p_advertising_minor,p_software_minor,p_included_cash_minor
  ) RETURNING id INTO evidence_id;
  INSERT INTO xero_v1.accounting_evidence_audit(evidence_id,action,actor_kind)
  VALUES (evidence_id,'recorded','worker');
  RETURN evidence_id;
END
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA xero_v1 FROM night_scout_import_login;
REVOKE ALL ON FUNCTION xero_v1.worker_get_refresh_envelope(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION xero_v1.worker_store_refresh_envelope(uuid,bytea,bytea,text,text,integer,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION xero_v1.worker_record_credential_refresh_failure(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION xero_v1.worker_record_accounting_evidence(uuid,uuid,date,date,text,boolean,text,text,date,timestamptz,text,bigint,bigint,bigint,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA xero_v1 TO night_scout_import_login;
GRANT EXECUTE ON FUNCTION xero_v1.worker_get_refresh_envelope(uuid) TO night_scout_import_login;
GRANT EXECUTE ON FUNCTION xero_v1.worker_store_refresh_envelope(uuid,bytea,bytea,text,text,integer,timestamptz) TO night_scout_import_login;
GRANT EXECUTE ON FUNCTION xero_v1.worker_record_credential_refresh_failure(uuid,text) TO night_scout_import_login;
GRANT EXECUTE ON FUNCTION xero_v1.worker_record_accounting_evidence(uuid,uuid,date,date,text,boolean,text,text,date,timestamptz,text,bigint,bigint,bigint,bigint,bigint) TO night_scout_import_login;

COMMIT;
