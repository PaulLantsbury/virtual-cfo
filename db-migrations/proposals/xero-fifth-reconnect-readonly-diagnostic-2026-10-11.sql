-- Read-only metadata: no identifiers, credentials or financial amounts returned.
BEGIN READ ONLY;
SELECT
 (SELECT count(*) FROM xero_v1.xero_fourth_reauthorization_authorizations) AS fourth_authorizations,
 (SELECT count(*) FROM xero_v1.xero_fourth_reauthorization_authorizations WHERE consumed_at IS NOT NULL) AS consumed_fourth_authorizations,
 (SELECT count(*) FROM xero_v1.connections c
  JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id
  JOIN LATERAL(SELECT * FROM xero_v1.connection_preflight_evidence p WHERE p.connection_id=c.id ORDER BY p.checked_at DESC,p.id DESC LIMIT 1) pe ON true
  WHERE c.store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17'::uuid AND c.retired_at IS NULL AND pe.credential_version=ce.version AND pe.checked_at BETWEEN clock_timestamp()-interval '24 hours' AND clock_timestamp() AND pe.outcome='failed' AND pe.phase='connection' AND pe.reason='reconnect_required' AND pe.tenant_visible=false
  AND (ce.lease_expires_at IS NULL OR ce.lease_expires_at<=clock_timestamp())) AS current_failed_reconnect_targets,
 to_regclass('xero_v1.xero_fifth_reauthorization_authorizations') IS NOT NULL AS fifth_installed;
ROLLBACK;
