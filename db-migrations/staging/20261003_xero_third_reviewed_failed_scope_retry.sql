BEGIN;

-- A third operator-reviewed, one-shot retry for the exact September staging
-- scope after the retained Xero connection was reauthorized. The two earlier
-- authorizations and every failed evidence row remain immutable. This
-- migration only appends an authorization for the newest exact-scope failure.
DO $$
DECLARE
 latest_failed_id uuid;
 matching integer;
 authorization_count integer;
 consumed_count integer;
BEGIN
 SELECT count(*),(array_agg(ae.id))[1]
 INTO matching,latest_failed_id
 FROM xero_v1.accounting_evidence ae
 JOIN xero_v1.connections c ON c.id=ae.connection_id AND c.retired_at IS NULL
 WHERE ae.scope_from=date '2026-09-01' AND ae.scope_to=date '2026-09-25'
  AND ae.currency='GBP' AND ae.closed_period=false
  AND ae.state='failed' AND ae.reason='source_refresh_failed'
  AND ae.id=(SELECT newest.id FROM xero_v1.accounting_evidence newest
             WHERE newest.connection_id=ae.connection_id
              AND newest.mapping_version_id=ae.mapping_version_id
              AND newest.scope_from=ae.scope_from AND newest.scope_to=ae.scope_to
              AND newest.currency=ae.currency AND newest.closed_period=ae.closed_period
             ORDER BY newest.created_at DESC,newest.id DESC LIMIT 1);

 IF matching<>1 THEN
  RAISE EXCEPTION 'third reviewed Xero failed scope unavailable';
 END IF;

 SELECT count(*)::integer,
        count(*) FILTER (WHERE consumed_at IS NOT NULL)::integer
 INTO authorization_count,consumed_count
 FROM xero_v1.accounting_evidence_retry_authorizations;

 IF authorization_count<>2 OR consumed_count<>authorization_count THEN
  RAISE EXCEPTION 'prior Xero retry authorizations unavailable';
 END IF;

 IF EXISTS (
  SELECT 1 FROM xero_v1.accounting_evidence_retry_authorizations
  WHERE evidence_id=latest_failed_id
 ) THEN
  RAISE EXCEPTION 'latest Xero failure already authorized';
 END IF;

 INSERT INTO xero_v1.accounting_evidence_retry_authorizations(evidence_id)
 VALUES(latest_failed_id);
END $$;

COMMIT;
