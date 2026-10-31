-- READ ONLY metadata in separately verified Night Scout Staging operator session.
-- No credentials, ciphertext, claims, contact/account IDs or provider records returned.
-- Counts are evidence for review, never authority to retarget or activate.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT jsonb_build_object(
 'observedAt',to_char(transaction_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
 'programmeCount',(SELECT count(*) FROM staging_test_programme.programmes WHERE programme_key='xero-staging-20261030'),
 'envelopeCount',(SELECT count(*) FROM staging_test_programme.writer_envelopes WHERE programme_key='xero-staging-20261030'),
 'actionCount',(SELECT count(*) FROM staging_test_programme.actions WHERE programme_key='xero-staging-20261030'),
 'consentStateCount',(SELECT count(*) FROM staging_test_programme.xero_restart_20261030_oauth_states),
 'activeProgrammeCount',(SELECT count(*) FROM staging_test_programme.programmes WHERE provider='xero' AND enabled AND NOT stopped AND ends_at>now()),
 'unresolvedActionCount',(SELECT count(*) FROM staging_test_programme.actions a JOIN staging_test_programme.programmes p USING(programme_key) WHERE p.provider='xero' AND a.state IN ('claimed','submitted','uncertain')),
 'transactionReadOnly',current_setting('transaction_read_only')='on'
) AS writer_inventory;
ROLLBACK;
