-- Read-only safe postflight. No IDs, credential material or provider operations.
BEGIN READ ONLY;
SELECT
 (SELECT count(*) FROM xero_v1.xero_fifth_reauthorization_authorizations) AS fifth_authorizations,
 (SELECT count(*) FROM xero_v1.xero_fifth_reauthorization_authorizations ra JOIN xero_v1.credential_envelopes ce ON ce.connection_id=ra.connection_id WHERE ra.consumed_at IS NULL AND ra.replacement_version IS NULL AND ra.target_credential_version=ce.version AND (ce.lease_expires_at IS NULL OR ce.lease_expires_at<=clock_timestamp())) AS ready_one_use_authorizations,
 (SELECT count(*) FROM xero_v1.xero_fourth_reauthorization_authorizations WHERE consumed_at IS NOT NULL) AS consumed_fourth_authorizations,
 has_function_privilege('night_scout_xero_bootstrap_login','xero_v1.bootstrap_get_reauthorization_target(uuid,text,uuid)','EXECUTE') AS bootstrap_lookup_granted,
 NOT has_function_privilege('authenticated','xero_v1.bootstrap_get_reauthorization_target(uuid,text,uuid)','EXECUTE') AS member_lookup_denied,
 NOT has_function_privilege('night_scout_import_login','xero_v1.bootstrap_reauthorize_connection(uuid,uuid,text,uuid,integer,bytea,bytea,text,text)','EXECUTE') AS worker_replace_denied,
 (SELECT relrowsecurity FROM pg_class WHERE oid='xero_v1.xero_fifth_reauthorization_authorizations'::regclass) AS fifth_rls_enabled;
ROLLBACK;
