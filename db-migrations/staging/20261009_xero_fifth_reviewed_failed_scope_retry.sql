-- STAGING ONLY. Fifth operator-reviewed, one-shot accounting retry for the
-- exact September scope after the reviewed reconnect. It is bound to the
-- newest accounting_evidence_unavailable receipt, the current credential,
-- and a newer successful organisation preflight on that credential.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog,xero_v1,public;

DO $$
DECLARE
 latest_failed_id uuid;
 selected_connection uuid;
 latest_failure_at timestamptz;
 current_credential_version integer;
 matching integer;
 authorization_count integer;
 consumed_count integer;
 first_reauthorization_count integer;
 first_reauthorization_consumed integer;
 second_reauthorization_count integer;
 second_reauthorization_consumed integer;
 third_reauthorization_count integer;
 third_reauthorization_consumed integer;
BEGIN
 IF current_user IN ('night_scout_import_login','night_scout_xero_bootstrap_login') THEN
  RAISE EXCEPTION 'run as the staging migration owner, never as an application login';
 END IF;

 SELECT count(*),(array_agg(ae.id))[1],(array_agg(ae.connection_id))[1],
        (array_agg(ae.created_at))[1],(array_agg(ce.version))[1]
 INTO matching,latest_failed_id,selected_connection,latest_failure_at,current_credential_version
 FROM xero_v1.accounting_evidence ae
 JOIN xero_v1.connections c ON c.id=ae.connection_id AND c.retired_at IS NULL
 JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id
  AND (ce.lease_expires_at IS NULL OR ce.lease_expires_at<=clock_timestamp())
 WHERE ae.scope_from=date '2026-09-01' AND ae.scope_to=date '2026-09-25'
  AND ae.currency='GBP' AND ae.closed_period=false
  AND ae.state='failed' AND ae.reason='accounting_evidence_unavailable'
  AND ae.id=(SELECT newest.id FROM xero_v1.accounting_evidence newest
             WHERE newest.connection_id=ae.connection_id
              AND newest.mapping_version_id=ae.mapping_version_id
              AND newest.scope_from=ae.scope_from AND newest.scope_to=ae.scope_to
              AND newest.currency=ae.currency AND newest.closed_period=ae.closed_period
             ORDER BY newest.created_at DESC,newest.id DESC LIMIT 1);
 IF matching<>1 THEN RAISE EXCEPTION 'fifth reviewed Xero failed scope unavailable'; END IF;

 SELECT count(*)::integer,count(*) FILTER(WHERE consumed_at IS NOT NULL)::integer
 INTO authorization_count,consumed_count
 FROM xero_v1.accounting_evidence_retry_authorizations;
 IF authorization_count<>4 OR consumed_count<>4 THEN
  RAISE EXCEPTION 'prior Xero retry authorizations unavailable';
 END IF;
 IF EXISTS(SELECT 1 FROM xero_v1.accounting_evidence_retry_authorizations WHERE evidence_id=latest_failed_id) THEN
  RAISE EXCEPTION 'latest Xero failure already authorized';
 END IF;

 SELECT count(*)::integer,count(*) FILTER(WHERE consumed_at IS NOT NULL)::integer
 INTO first_reauthorization_count,first_reauthorization_consumed
 FROM xero_v1.xero_reauthorization_authorizations WHERE connection_id=selected_connection;
 SELECT count(*)::integer,count(*) FILTER(WHERE consumed_at IS NOT NULL)::integer
 INTO second_reauthorization_count,second_reauthorization_consumed
 FROM xero_v1.xero_second_reauthorization_authorizations WHERE connection_id=selected_connection;
 SELECT count(*)::integer,count(*) FILTER(WHERE consumed_at IS NOT NULL)::integer
 INTO third_reauthorization_count,third_reauthorization_consumed
 FROM xero_v1.xero_third_reauthorization_authorizations WHERE connection_id=selected_connection;
 IF first_reauthorization_count<>1 OR first_reauthorization_consumed<>1
  OR second_reauthorization_count<>1 OR second_reauthorization_consumed<>1
  OR third_reauthorization_count<>1 OR third_reauthorization_consumed<>1 THEN
  RAISE EXCEPTION 'reviewed Xero reauthorizations unavailable';
 END IF;

 IF NOT EXISTS(
  SELECT 1 FROM xero_v1.connection_preflight_evidence pe
  WHERE pe.connection_id=selected_connection
   AND pe.credential_version=current_credential_version
   AND pe.outcome='connected' AND pe.phase='organisation' AND pe.reason='ok'
   AND pe.provider_status IS NULL AND pe.tenant_visible=true
   AND pe.checked_at>latest_failure_at
   AND pe.id=(SELECT newest.id FROM xero_v1.connection_preflight_evidence newest
              WHERE newest.connection_id=selected_connection
              ORDER BY newest.checked_at DESC,newest.id DESC LIMIT 1)
 ) THEN
  RAISE EXCEPTION 'successful current-credential Xero preflight required';
 END IF;

 INSERT INTO xero_v1.accounting_evidence_retry_authorizations(evidence_id)
 VALUES(latest_failed_id);
END $$;

-- Preserve the original worker contract while admitting the newly reviewed
-- parser/extractor failure reason only when its one-shot row is unconsumed.
CREATE OR REPLACE FUNCTION xero_v1.worker_get_single_refresh_job(
 p_scope_from date,p_scope_to date,p_currency text,p_closed_period boolean)
RETURNS TABLE(connection_id uuid,mapping_version_id uuid)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE
SET search_path=pg_catalog,xero_v1 AS $$
DECLARE candidate_count integer; selected_connection uuid; selected_mapping uuid;
 retry_evidence uuid; consumed uuid;
BEGIN
 IF session_user<>'night_scout_import_login' THEN RAISE EXCEPTION 'Xero worker capability required'; END IF;
 IF p_scope_from IS NULL OR p_scope_to IS NULL OR p_scope_from>p_scope_to OR p_scope_to>current_date
  OR p_scope_to-p_scope_from>=31 OR p_currency!~'^[A-Z]{3}$' OR p_closed_period IS NULL THEN
  RAISE EXCEPTION 'invalid Xero refresh scope'; END IF;

 WITH candidates AS (
  SELECT c.id connection_id,current_mapping.id mapping_version_id,
   CASE WHEN latest.id IS NULL THEN NULL ELSE latest.id END retry_evidence
  FROM xero_v1.connections c
  JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id
  CROSS JOIN LATERAL (SELECT mv.id,mv.directory_retrieved_at FROM xero_v1.mapping_versions mv
   WHERE mv.connection_id=c.id AND mv.effective_from<=current_date
   ORDER BY mv.effective_from DESC,mv.version DESC,mv.id DESC LIMIT 1) current_mapping
  LEFT JOIN LATERAL (SELECT ae.id,ae.state,ae.reason FROM xero_v1.accounting_evidence ae
   WHERE ae.connection_id=c.id AND ae.mapping_version_id=current_mapping.id
    AND ae.scope_from=p_scope_from AND ae.scope_to=p_scope_to
    AND ae.currency=p_currency AND ae.closed_period=p_closed_period
   ORDER BY ae.created_at DESC,ae.id DESC LIMIT 1) latest ON true
  LEFT JOIN xero_v1.accounting_evidence_retry_authorizations ra
   ON ra.evidence_id=latest.id AND ra.consumed_at IS NULL
  WHERE c.retired_at IS NULL AND ce.algorithm='AES-256-GCM' AND ce.version>0
   AND (SELECT count(DISTINCT ms.category) FROM xero_v1.mapping_selections ms WHERE ms.mapping_version_id=current_mapping.id)=5
   AND NOT EXISTS (SELECT 1 FROM xero_v1.mapping_selections ms LEFT JOIN xero_v1.account_directories ad
    ON ad.connection_id=c.id AND ad.retrieved_at=current_mapping.directory_retrieved_at
    AND ad.account_id=ms.account_id AND ad.account_status='ACTIVE'
    WHERE ms.mapping_version_id=current_mapping.id AND ad.account_id IS NULL)
   AND (latest.id IS NULL OR (latest.state='failed'
    AND latest.reason IN ('source_refresh_failed','accounting_evidence_unavailable')
    AND ra.evidence_id IS NOT NULL))
 )
 SELECT count(*)::integer,(array_agg(candidate.connection_id))[1],(array_agg(candidate.mapping_version_id))[1],
  (array_agg(candidate.retry_evidence) FILTER (WHERE candidate.retry_evidence IS NOT NULL))[1]
 INTO candidate_count,selected_connection,selected_mapping,retry_evidence FROM candidates candidate;
 IF candidate_count<>1 THEN RAISE EXCEPTION 'Xero staging refresh job unavailable'; END IF;

 IF retry_evidence IS NOT NULL THEN
  UPDATE xero_v1.accounting_evidence_retry_authorizations SET consumed_at=clock_timestamp()
   WHERE evidence_id=retry_evidence AND consumed_at IS NULL RETURNING evidence_id INTO consumed;
  IF consumed IS NULL THEN RAISE EXCEPTION 'Xero staging refresh retry unavailable'; END IF;
 END IF;
 RETURN QUERY SELECT selected_connection,selected_mapping;
END $$;

REVOKE ALL ON FUNCTION xero_v1.worker_get_single_refresh_job(date,date,text,boolean)
 FROM PUBLIC,anon,authenticated,night_scout_xero_bootstrap_login;
GRANT EXECUTE ON FUNCTION xero_v1.worker_get_single_refresh_job(date,date,text,boolean)
 TO night_scout_import_login;

COMMIT;
