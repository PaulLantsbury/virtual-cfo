-- READ ONLY in separately verified Night Scout Staging project; no tokens, hashes,
-- ciphertext, contacts, accounts, source transaction IDs or raw provider payloads.
BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT programme_key,provider,target,starts_at,ends_at,action_cap,enabled,stopped,
 (SELECT count(*) FROM staging_test_programme.actions a WHERE a.programme_key=p.programme_key) AS action_count,
 (SELECT count(*) FROM staging_test_programme.actions a WHERE a.programme_key=p.programme_key AND a.state IN ('claimed','submitted','uncertain')) AS unresolved_count,
 EXISTS(SELECT 1 FROM staging_test_programme.writer_envelopes e WHERE e.programme_key=p.programme_key) AS writer_envelope_present,
 EXISTS(SELECT 1 FROM staging_test_programme.writer_envelopes e WHERE e.programme_key=p.programme_key AND e.tenant_id::text=p.target AND e.refresh_claim IS NULL) AS matching_idle_writer_envelope
FROM staging_test_programme.programmes p WHERE provider='xero' ORDER BY programme_key;
SELECT to_regprocedure('staging_test_programme.xero_daily_20261030_ready(text,text,text,integer)') IS NOT NULL AS restart_readiness_rpc_present,
 to_regprocedure('staging_test_programme.start_xero_20261030_consent(text,uuid,uuid)') IS NOT NULL AS restart_consent_rpc_present;
ROLLBACK;
