-- Read-only fresh-session acceptance after the sixth reconnect. The current
-- London calendar day is the earliest permissible observation window, so an old
-- immediate check cannot establish new-session durability. No clock override,
-- provider request, credential refresh, retry consumption or schema change.
-- Two observations are not proof of uninterrupted uptime or financial validity.
BEGIN READ ONLY;
WITH target AS (
 SELECT c.id,ce.version,ra.consumed_at,
 greatest(ra.consumed_at,date_trunc('day',clock_timestamp() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London') AS window_start
 FROM xero_v1.connections c JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id
 JOIN xero_v1.xero_sixth_reauthorization_authorizations ra ON ra.connection_id=c.id
 WHERE c.store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17'::uuid AND c.retired_at IS NULL
 AND ra.consumed_at IS NOT NULL AND ra.replacement_version=ra.target_credential_version+1 AND ce.version>=ra.replacement_version
 AND (ce.lease_expires_at IS NULL OR ce.lease_expires_at<=clock_timestamp())
), observations AS (
 SELECT t.id,t.consumed_at,t.window_start,pe.credential_version=t.version AS current_version,
 pe.outcome,pe.phase,pe.reason,pe.tenant_visible,pe.checked_at,
 (SELECT count(*) FROM xero_v1.connection_preflight_evidence p WHERE p.connection_id=t.id
 AND p.checked_at>=t.window_start AND p.outcome='connected' AND p.phase='organisation' AND p.reason='ok' AND p.tenant_visible=true) AS successful_observations,
 (SELECT min(p.checked_at) FROM xero_v1.connection_preflight_evidence p WHERE p.connection_id=t.id AND p.checked_at>=t.window_start AND p.outcome='connected' AND p.phase='organisation' AND p.reason='ok' AND p.tenant_visible=true) AS first_success_at
 FROM target t JOIN LATERAL(SELECT * FROM xero_v1.connection_preflight_evidence p WHERE p.connection_id=t.id ORDER BY p.checked_at DESC,p.id DESC LIMIT 1) pe ON true
)
-- Any observed failure invalidates this acceptance window; no automatic reset.
, verified AS (SELECT o.*,NOT EXISTS(SELECT 1 FROM xero_v1.connection_preflight_evidence p WHERE p.connection_id=o.id AND p.outcome='failed' AND p.checked_at>=o.first_success_at AND p.checked_at<=o.checked_at) AS no_failures_during_observation FROM observations o)
SELECT CASE WHEN count(*)=1 AND bool_and(current_version AND outcome='connected' AND phase='organisation' AND reason='ok' AND tenant_visible=true AND checked_at BETWEEN clock_timestamp()-interval '24 hours' AND clock_timestamp() AND checked_at>=window_start+interval '31 minutes' AND checked_at-first_success_at>=interval '31 minutes' AND successful_observations>=2 AND no_failures_during_observation)
 THEN 'fresh_connection_observed_beyond_31_minutes' ELSE 'fresh_duration_acceptance_pending' END AS state,
 count(*)::int AS scoped_targets,
 coalesce(min(successful_observations),0)::int AS successful_observations,
 coalesce(bool_and(current_version),false) AS latest_matches_current_credential,
 coalesce(bool_and(checked_at>=window_start+interval '31 minutes'),false) AS latest_after_31_minutes,
 coalesce(bool_and(checked_at-first_success_at>=interval '31 minutes'),false) AS observations_span_31_minutes,
 coalesce(bool_and(no_failures_during_observation),false) AS no_failures_during_observation
FROM verified;
ROLLBACK;
