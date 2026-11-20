-- Read-only, status only; does not select or consume a refresh job.
BEGIN READ ONLY;
SELECT count(*)=1 AS exactly_one_reviewed_retry,
 count(*) FILTER(WHERE ra.consumed_at IS NULL)=1 AS ready_once,
 count(*) FILTER(WHERE ra.consumed_at IS NOT NULL)=1 AS consumed_once
FROM xero_v1.accounting_evidence_retry_authorizations ra
JOIN xero_v1.accounting_evidence ae ON ae.id=ra.evidence_id
JOIN xero_v1.connections c ON c.id=ae.connection_id
WHERE c.store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17'::uuid
 AND ae.scope_from=date '2026-10-01' AND ae.scope_to=date '2026-10-10'
 AND ae.currency='GBP' AND ae.closed_period=false AND ae.state='failed'
 AND ae.reason='accounting_evidence_unavailable'
 AND ae.retrieved_at=timestamptz '2026-10-11T16:04:16.227Z';
ROLLBACK;
