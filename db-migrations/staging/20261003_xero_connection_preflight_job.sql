-- STAGING ONLY. Discover the single persisted connection suitable for the
-- connection-only preflight. This capability neither reads nor consumes
-- accounting evidence or retry authorizations.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog,xero_v1,public;

CREATE FUNCTION xero_v1.worker_get_single_connection_preflight_job()
RETURNS TABLE(connection_id uuid,mapping_version_id uuid)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path=pg_catalog,xero_v1 AS $$
DECLARE candidate_count integer;
BEGIN
 IF session_user<>'night_scout_import_login' THEN
  RAISE EXCEPTION 'Xero worker capability required';
 END IF;

 WITH candidates AS (
  SELECT c.id connection_id,current_mapping.id mapping_version_id
  FROM xero_v1.connections c
  JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id
  CROSS JOIN LATERAL (
   SELECT mv.id,mv.directory_retrieved_at
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
     AND ad.retrieved_at=current_mapping.directory_retrieved_at
     AND ad.account_id=ms.account_id AND ad.account_status='ACTIVE'
    WHERE ms.mapping_version_id=current_mapping.id AND ad.account_id IS NULL
   )
 )
 SELECT count(*)::integer INTO candidate_count FROM candidates;

 IF candidate_count<>1 THEN
  RAISE EXCEPTION 'Xero staging preflight job unavailable';
 END IF;

 RETURN QUERY
 WITH candidates AS (
  SELECT c.id connection_id,current_mapping.id mapping_version_id
  FROM xero_v1.connections c
  JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id
  CROSS JOIN LATERAL (
   SELECT mv.id,mv.directory_retrieved_at
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
     AND ad.retrieved_at=current_mapping.directory_retrieved_at
     AND ad.account_id=ms.account_id AND ad.account_status='ACTIVE'
    WHERE ms.mapping_version_id=current_mapping.id AND ad.account_id IS NULL
   )
 )
 SELECT candidates.connection_id,candidates.mapping_version_id FROM candidates;
END $$;

REVOKE ALL ON FUNCTION xero_v1.worker_get_single_connection_preflight_job()
 FROM PUBLIC,anon,authenticated,night_scout_xero_bootstrap_login;
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION xero_v1.worker_get_single_connection_preflight_job() FROM service_role';
 END IF;
END $$;
GRANT EXECUTE ON FUNCTION xero_v1.worker_get_single_connection_preflight_job()
 TO night_scout_import_login;

COMMIT;
