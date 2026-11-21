-- Run as the staging migration owner after the one-off worker has completed.
-- This returns status only: no tenant identifier, account, credential or
-- financial value is selected.
WITH active AS (
 SELECT c.id FROM xero_v1.connections c WHERE c.retired_at IS NULL
), current_mapping AS (
 SELECT mv.id,mv.connection_id
 FROM active a
 CROSS JOIN LATERAL (
  SELECT candidate.* FROM xero_v1.mapping_versions candidate
  WHERE candidate.connection_id=a.id AND candidate.effective_from<=current_date
  ORDER BY candidate.effective_from DESC,candidate.version DESC,candidate.id DESC LIMIT 1
 ) mv
), evidence AS (
 SELECT ae.* FROM xero_v1.accounting_evidence ae
 JOIN current_mapping cm ON cm.id=ae.mapping_version_id AND cm.connection_id=ae.connection_id
 WHERE ae.state='supported'
)
SELECT
 (SELECT count(*)=1 FROM active) AS exactly_one_active_connection,
 (SELECT count(*)=1 FROM current_mapping) AS exactly_one_current_mapping,
 (SELECT count(DISTINCT ms.category)=5 FROM xero_v1.mapping_selections ms
   JOIN current_mapping cm ON cm.id=ms.mapping_version_id) AS five_mapping_categories,
 (SELECT count(*)=1 FROM xero_v1.credential_envelopes ce JOIN active a ON a.id=ce.connection_id) AS exactly_one_credential,
 (SELECT bool_and(ce.version>=2 AND ce.rotated_at IS NOT NULL AND ce.lease_expires_at IS NULL)
   FROM xero_v1.credential_envelopes ce JOIN active a ON a.id=ce.connection_id) AS credential_rotated_and_lease_cleared,
 (SELECT count(*)>=1 FROM evidence) AS supported_evidence_recorded,
 (SELECT count(*)=1 FROM evidence) AS exactly_one_supported_evidence_recorded,
 (SELECT count(*)>=1 FROM xero_v1.credential_audit ca JOIN active a ON a.id=ca.connection_id
   WHERE ca.action='credential_rotated') AS rotation_audited,
 (SELECT count(*)>=1 FROM xero_v1.accounting_evidence_audit aa JOIN evidence e ON e.id=aa.evidence_id
   WHERE aa.action='recorded' AND aa.actor_kind='worker') AS evidence_audited;
