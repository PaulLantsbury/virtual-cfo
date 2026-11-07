-- Read-only, no identifiers, amounts or credentials. Does not authorise another attempt.
BEGIN READ ONLY;
SELECT
 (SELECT count(*) FROM xero_v1.xero_fifth_reauthorization_authorizations) AS fifth_authorizations,
 (SELECT count(*) FROM xero_v1.xero_fifth_reauthorization_authorizations WHERE consumed_at IS NOT NULL) AS consumed_fifth_authorizations,
 (SELECT count(*) FROM xero_v1.connections c JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id
 JOIN LATERAL(SELECT * FROM xero_v1.connection_preflight_evidence p WHERE p.connection_id=c.id ORDER BY p.checked_at DESC,p.id DESC LIMIT 1) pe ON true
 WHERE c.store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17'::uuid AND c.retired_at IS NULL
 AND pe.credential_version=ce.version AND pe.checked_at BETWEEN clock_timestamp()-interval '24 hours' AND clock_timestamp()
 AND pe.outcome='failed' AND pe.phase='connection' AND pe.reason='reconnect_required' AND pe.tenant_visible=false
 AND (ce.lease_expires_at IS NULL OR ce.lease_expires_at<=clock_timestamp())) AS current_failed_reconnect_targets,
 to_regclass('xero_v1.xero_sixth_reauthorization_authorizations') IS NOT NULL AS sixth_installed,
 (SELECT md5(prosrc) FROM pg_proc WHERE oid='xero_v1.bootstrap_get_reauthorization_target(uuid,text,uuid)'::regprocedure) AS installed_lookup_body_fingerprint,
 (SELECT md5(prosrc) FROM pg_proc WHERE oid='xero_v1.bootstrap_reauthorize_connection(uuid,uuid,text,uuid,integer,bytea,bytea,text,text)'::regprocedure) AS installed_replace_body_fingerprint;
ROLLBACK;
