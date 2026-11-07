-- STAGING ONLY. Fourth operator-reviewed, one-shot retry for the exact
-- September scope. It can be installed only after a newer, successful,
-- non-consuming connection preflight using the current encrypted credential.
-- All failures and earlier retry authorizations remain immutable.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog,xero_v1,public;

DO $$
DECLARE
 latest_failed_id uuid;
 selected_connection uuid;
 latest_failure_at timestamptz;
 current_credential_version integer;
 matching integer;
 authorization_count integer;
 consumed_count integer;
BEGIN
 IF current_user IN ('night_scout_import_login','night_scout_xero_bootstrap_login') THEN
  RAISE EXCEPTION 'run as the staging migration owner, never as an application login';
 END IF;
 IF to_regclass('xero_v1.connection_preflight_evidence') IS NULL THEN
  RAISE EXCEPTION 'successful Xero connection preflight required';
 END IF;

 SELECT count(*),(array_agg(ae.id))[1],(array_agg(ae.connection_id))[1],
        (array_agg(ae.created_at))[1],(array_agg(ce.version))[1]
 INTO matching,latest_failed_id,selected_connection,latest_failure_at,current_credential_version
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
             ORDER BY newest.created_at DESC,newest.id DESC LIMIT 1);
 IF matching<>1 THEN RAISE EXCEPTION 'fourth reviewed Xero failed scope unavailable'; END IF;

 SELECT count(*)::integer,count(*) FILTER(WHERE consumed_at IS NOT NULL)::integer
 INTO authorization_count,consumed_count
 FROM xero_v1.accounting_evidence_retry_authorizations;
 IF authorization_count<>3 OR consumed_count<>authorization_count THEN
  RAISE EXCEPTION 'prior Xero retry authorizations unavailable';
 END IF;
 IF EXISTS(SELECT 1 FROM xero_v1.accounting_evidence_retry_authorizations WHERE evidence_id=latest_failed_id) THEN
  RAISE EXCEPTION 'latest Xero failure already authorized';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM xero_v1.connection_preflight_evidence pe
  WHERE pe.connection_id=selected_connection
   AND pe.credential_version=current_credential_version
   AND pe.outcome='connected' AND pe.phase='organisation' AND pe.reason='ok'
   AND pe.provider_status IS NULL AND pe.tenant_visible=true
   AND pe.checked_at>latest_failure_at
   AND pe.id=(SELECT newest.id FROM xero_v1.connection_preflight_evidence newest
              WHERE newest.connection_id=selected_connection
              ORDER BY newest.checked_at DESC,newest.id DESC LIMIT 1)
 ) THEN
  RAISE EXCEPTION 'successful Xero connection preflight required';
 END IF;

 INSERT INTO xero_v1.accounting_evidence_retry_authorizations(evidence_id)
 VALUES(latest_failed_id);
END $$;

COMMIT;
