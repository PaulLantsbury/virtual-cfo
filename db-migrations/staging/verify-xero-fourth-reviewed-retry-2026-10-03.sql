-- Status-only pre-run verification. No identifiers, credentials or values.
WITH authorization_status AS (
 SELECT count(*)::integer AS total,
  count(*) FILTER(WHERE consumed_at IS NOT NULL)::integer AS consumed,
  count(*) FILTER(WHERE consumed_at IS NULL)::integer AS unconsumed
 FROM xero_v1.accounting_evidence_retry_authorizations
), current_latest AS (
 SELECT ae.id,ae.connection_id,ae.created_at,ce.version AS credential_version
 FROM xero_v1.accounting_evidence ae
 JOIN xero_v1.connections c ON c.id=ae.connection_id AND c.retired_at IS NULL
 JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id
  AND (ce.lease_expires_at IS NULL OR ce.lease_expires_at<=clock_timestamp())
 WHERE ae.scope_from=date '2026-09-01' AND ae.scope_to=date '2026-09-25'
  AND ae.currency='GBP' AND ae.closed_period=false
  AND ae.state='failed' AND ae.reason='source_refresh_failed'
  AND ae.id=(SELECT newest.id FROM xero_v1.accounting_evidence newest
             WHERE newest.connection_id=ae.connection_id
              AND newest.mapping_version_id=ae.mapping_version_id
              AND newest.scope_from=ae.scope_from AND newest.scope_to=ae.scope_to
              AND newest.currency=ae.currency AND newest.closed_period=ae.closed_period
             ORDER BY newest.created_at DESC,newest.id DESC LIMIT 1)
), latest_preflight AS (
 SELECT pe.* FROM xero_v1.connection_preflight_evidence pe
 JOIN current_latest latest ON latest.connection_id=pe.connection_id
 ORDER BY pe.checked_at DESC,pe.id DESC LIMIT 1
)
SELECT
 status.total=4 AS exactly_four_reviewed_retries,
 status.consumed=3 AS exactly_three_retries_consumed,
 status.unconsumed=1 AS exactly_one_retry_unconsumed,
 (SELECT count(*)=1 FROM xero_v1.accounting_evidence_retry_authorizations ra
   JOIN current_latest latest ON latest.id=ra.evidence_id WHERE ra.consumed_at IS NULL)
  AS current_latest_failure_authorized,
 (SELECT count(*)=1 FROM latest_preflight pe JOIN current_latest latest ON true
   WHERE pe.outcome='connected' AND pe.phase='organisation' AND pe.reason='ok'
    AND pe.provider_status IS NULL AND pe.tenant_visible=true
    AND pe.checked_at>latest.created_at AND pe.credential_version=latest.credential_version)
  AS current_credential_preflight_supported
FROM authorization_status status;
