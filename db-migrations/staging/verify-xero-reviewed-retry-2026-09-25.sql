-- Status-only pre-run verification. No identifiers, credentials or values.
SELECT
 count(*)=1 AS exactly_one_reviewed_retry,
 count(*) FILTER (WHERE ra.consumed_at IS NULL)=1 AS retry_is_unconsumed,
 bool_and(ae.state='failed' AND ae.reason='source_refresh_failed'
  AND ae.scope_from=date '2026-09-01' AND ae.scope_to=date '2026-09-25'
  AND ae.currency='GBP' AND ae.closed_period=false) AS exact_failed_scope_authorized
FROM xero_v1.accounting_evidence_retry_authorizations ra
JOIN xero_v1.accounting_evidence ae ON ae.id=ra.evidence_id;
