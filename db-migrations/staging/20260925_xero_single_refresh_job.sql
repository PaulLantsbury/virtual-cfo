BEGIN;

-- Staging-only discovery for the first controlled refresh. The worker receives
-- only the opaque identifiers needed by worker_get_refresh_context. It fails
-- closed unless exactly one active connection has one current, complete
-- five-category mapping and an encrypted credential envelope.
CREATE OR REPLACE FUNCTION xero_v1.worker_get_single_refresh_job(
 p_scope_from date,p_scope_to date,p_currency text,p_closed_period boolean)
RETURNS TABLE(connection_id uuid,mapping_version_id uuid)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path=pg_catalog,xero_v1 AS $$
DECLARE candidate_count integer;
BEGIN
 IF session_user<>'night_scout_import_login' THEN
  RAISE EXCEPTION 'Xero worker capability required';
 END IF;
 IF p_scope_from IS NULL OR p_scope_to IS NULL OR p_scope_from>p_scope_to OR p_scope_to>current_date
  OR p_scope_to-p_scope_from>=31 OR p_currency!~'^[A-Z]{3}$' OR p_closed_period IS NULL THEN
  RAISE EXCEPTION 'invalid Xero refresh scope';
 END IF;

 WITH candidates AS (
  SELECT c.id connection_id,current_mapping.id mapping_version_id
  FROM xero_v1.connections c
  JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id
  CROSS JOIN LATERAL (
   SELECT mv.id
   FROM xero_v1.mapping_versions mv
   WHERE mv.connection_id=c.id AND mv.effective_from<=current_date
   ORDER BY mv.effective_from DESC,mv.version DESC,mv.id DESC
   LIMIT 1
  ) current_mapping
  WHERE c.retired_at IS NULL
   AND ce.algorithm='AES-256-GCM' AND ce.version>0
   AND (SELECT count(DISTINCT ms.category) FROM xero_v1.mapping_selections ms
        WHERE ms.mapping_version_id=current_mapping.id)=5
   AND NOT EXISTS (
    SELECT 1 FROM xero_v1.mapping_selections ms
    LEFT JOIN xero_v1.account_directories ad
      ON ad.connection_id=c.id
     AND ad.retrieved_at=(SELECT mv.directory_retrieved_at FROM xero_v1.mapping_versions mv WHERE mv.id=current_mapping.id)
     AND ad.account_id=ms.account_id AND ad.account_status='ACTIVE'
    WHERE ms.mapping_version_id=current_mapping.id AND ad.account_id IS NULL
   )
   AND NOT EXISTS (
    SELECT 1 FROM xero_v1.accounting_evidence ae
    WHERE ae.connection_id=c.id AND ae.mapping_version_id=current_mapping.id
     AND ae.scope_from=p_scope_from AND ae.scope_to=p_scope_to
     AND ae.currency=p_currency AND ae.closed_period=p_closed_period
   )
 )
 SELECT count(*)::integer INTO candidate_count FROM candidates;

 IF candidate_count<>1 THEN
  RAISE EXCEPTION 'Xero staging refresh job unavailable';
 END IF;

 RETURN QUERY
 WITH candidates AS (
  SELECT c.id connection_id,current_mapping.id mapping_version_id
  FROM xero_v1.connections c
  JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id
  CROSS JOIN LATERAL (
   SELECT mv.id
   FROM xero_v1.mapping_versions mv
   WHERE mv.connection_id=c.id AND mv.effective_from<=current_date
   ORDER BY mv.effective_from DESC,mv.version DESC,mv.id DESC
   LIMIT 1
  ) current_mapping
  WHERE c.retired_at IS NULL
   AND ce.algorithm='AES-256-GCM' AND ce.version>0
   AND (SELECT count(DISTINCT ms.category) FROM xero_v1.mapping_selections ms
        WHERE ms.mapping_version_id=current_mapping.id)=5
   AND NOT EXISTS (
    SELECT 1 FROM xero_v1.mapping_selections ms
    LEFT JOIN xero_v1.account_directories ad
      ON ad.connection_id=c.id
     AND ad.retrieved_at=(SELECT mv.directory_retrieved_at FROM xero_v1.mapping_versions mv WHERE mv.id=current_mapping.id)
     AND ad.account_id=ms.account_id AND ad.account_status='ACTIVE'
    WHERE ms.mapping_version_id=current_mapping.id AND ad.account_id IS NULL
   )
   AND NOT EXISTS (
    SELECT 1 FROM xero_v1.accounting_evidence ae
    WHERE ae.connection_id=c.id AND ae.mapping_version_id=current_mapping.id
     AND ae.scope_from=p_scope_from AND ae.scope_to=p_scope_to
     AND ae.currency=p_currency AND ae.closed_period=p_closed_period
   )
 ) SELECT candidates.connection_id,candidates.mapping_version_id FROM candidates;
END $$;

-- Keep the run fence after OAuth rotation. Evidence collection and its
-- terminal database write remain inside the same lease; rotation alone is not
-- a completed refresh.
CREATE OR REPLACE FUNCTION xero_v1.worker_store_refresh_envelope_leased(
 p_connection_id uuid,p_ciphertext bytea,p_encrypted_dek bytea,p_key_version text,p_algorithm text,
 p_expected_version integer,p_new_version integer,p_expected_lease_expires_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,xero_v1 AS $$
DECLARE stored uuid;
BEGIN
 IF session_user<>'night_scout_import_login' THEN RAISE EXCEPTION 'Xero worker capability required'; END IF;
 IF p_connection_id IS NULL OR p_algorithm<>'AES-256-GCM'
  OR octet_length(p_ciphertext) NOT BETWEEN 1 AND 16384 OR octet_length(p_encrypted_dek) NOT BETWEEN 1 AND 16384
  OR p_key_version !~ '^[A-Za-z0-9._-]{1,128}$' OR p_expected_version<1
  OR p_new_version<>p_expected_version+1 OR p_expected_lease_expires_at IS NULL THEN
  RAISE EXCEPTION 'invalid encrypted credential envelope'; END IF;
 UPDATE xero_v1.credential_envelopes e SET ciphertext=p_ciphertext,encrypted_dek=p_encrypted_dek,
  key_version=p_key_version,algorithm=p_algorithm,version=p_new_version,rotated_at=now()
 FROM xero_v1.connections c WHERE e.connection_id=p_connection_id AND c.id=e.connection_id AND c.retired_at IS NULL
  AND e.version=p_expected_version AND e.lease_expires_at=p_expected_lease_expires_at
  AND e.lease_expires_at>clock_timestamp() RETURNING e.connection_id INTO stored;
 IF stored IS NOT NULL THEN
  INSERT INTO xero_v1.credential_audit(connection_id,action) VALUES(p_connection_id,'credential_rotated');
 END IF;
 RETURN stored IS NOT NULL;
END $$;

-- Append the bounded terminal evidence and clear the exact live fence in one
-- transaction. A stale, overlapping or replayed worker cannot persist or
-- release another run's result.
CREATE OR REPLACE FUNCTION xero_v1.worker_record_accounting_evidence_leased(
 p_connection_id uuid,p_mapping_version_id uuid,p_scope_from date,p_scope_to date,
 p_currency text,p_closed_period boolean,p_state text,p_reason text,
 p_report_as_of date,p_retrieved_at timestamptz,p_source_fingerprint text,
 p_booked_revenue_minor bigint,p_processing_fee_minor bigint,p_advertising_minor bigint,
 p_software_minor bigint,p_included_cash_minor bigint,p_expected_version integer,
 p_expected_lease_expires_at timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,xero_v1 AS $$
DECLARE evidence_id uuid; released uuid;
BEGIN
 IF session_user<>'night_scout_import_login' THEN RAISE EXCEPTION 'Xero worker capability required'; END IF;
 IF p_connection_id IS NULL OR p_mapping_version_id IS NULL OR p_expected_version<1
  OR p_expected_lease_expires_at IS NULL THEN RAISE EXCEPTION 'invalid Xero refresh completion'; END IF;
 IF (p_state='supported' AND p_expected_version<2)
  OR (p_state<>'supported' AND p_expected_version<1) THEN
  RAISE EXCEPTION 'invalid Xero refresh completion';
 END IF;
 IF p_expected_version=1 AND (p_state<>'failed' OR p_source_fingerprint IS NOT NULL OR p_report_as_of IS NOT NULL
  OR p_booked_revenue_minor IS NOT NULL OR p_processing_fee_minor IS NOT NULL OR p_advertising_minor IS NOT NULL
  OR p_software_minor IS NOT NULL OR p_included_cash_minor IS NOT NULL) THEN
  RAISE EXCEPTION 'pre-rotation completion must be value-free failure';
 END IF;
 PERFORM 1 FROM xero_v1.credential_envelopes ce JOIN xero_v1.connections c ON c.id=ce.connection_id
  JOIN xero_v1.mapping_versions mv ON mv.id=p_mapping_version_id AND mv.connection_id=c.id
  WHERE ce.connection_id=p_connection_id AND c.retired_at IS NULL AND ce.version=p_expected_version
   AND ce.lease_expires_at=p_expected_lease_expires_at AND ce.lease_expires_at>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'Xero refresh fence unavailable'; END IF;
 INSERT INTO xero_v1.accounting_evidence(
  connection_id,mapping_version_id,scope_from,scope_to,currency,closed_period,state,reason,
  report_as_of,retrieved_at,source_fingerprint,booked_revenue_minor,processing_fee_minor,
  advertising_minor,software_minor,included_cash_minor)
 VALUES(p_connection_id,p_mapping_version_id,p_scope_from,p_scope_to,p_currency,p_closed_period,p_state,p_reason,
  p_report_as_of,p_retrieved_at,p_source_fingerprint,p_booked_revenue_minor,p_processing_fee_minor,
  p_advertising_minor,p_software_minor,p_included_cash_minor) RETURNING id INTO evidence_id;
 INSERT INTO xero_v1.accounting_evidence_audit(evidence_id,action,actor_kind) VALUES(evidence_id,'recorded','worker');
 UPDATE xero_v1.credential_envelopes SET lease_expires_at=NULL
  WHERE connection_id=p_connection_id AND version=p_expected_version
   AND lease_expires_at=p_expected_lease_expires_at AND lease_expires_at>clock_timestamp()
  RETURNING connection_id INTO released;
 IF released IS NULL THEN RAISE EXCEPTION 'Xero refresh fence unavailable'; END IF;
 RETURN evidence_id;
END $$;

REVOKE ALL ON FUNCTION xero_v1.worker_get_single_refresh_job(date,date,text,boolean) FROM PUBLIC,anon,authenticated,night_scout_xero_bootstrap_login;
REVOKE ALL ON FUNCTION xero_v1.worker_record_accounting_evidence_leased(uuid,uuid,date,date,text,boolean,text,text,date,timestamptz,text,bigint,bigint,bigint,bigint,bigint,integer,timestamptz) FROM PUBLIC,anon,authenticated,night_scout_xero_bootstrap_login;
REVOKE EXECUTE ON FUNCTION xero_v1.worker_record_accounting_evidence(uuid,uuid,date,date,text,boolean,text,text,date,timestamptz,text,bigint,bigint,bigint,bigint,bigint) FROM night_scout_import_login;
GRANT EXECUTE ON FUNCTION xero_v1.worker_get_single_refresh_job(date,date,text,boolean) TO night_scout_import_login;
GRANT EXECUTE ON FUNCTION xero_v1.worker_record_accounting_evidence_leased(uuid,uuid,date,date,text,boolean,text,text,date,timestamptz,text,bigint,bigint,bigint,bigint,bigint,integer,timestamptz) TO night_scout_import_login;

COMMIT;
