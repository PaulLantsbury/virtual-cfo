-- PROPOSAL ONLY. Staging member metadata reader correction. No new grants,
-- writes to evidence, OAuth consumption or credential exposure.
-- Requires installed 20260928 readiness and 20261003 preflight schemas.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE OR REPLACE FUNCTION public.xero_merchant_readiness(p_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path=pg_catalog,public,xero_v1 AS $$
DECLARE v_user uuid:=(SELECT auth.uid());v_connection xero_v1.connections%ROWTYPE;v_mapping xero_v1.mapping_versions%ROWTYPE;
 v_last_success timestamptz;v_last_failure timestamptz;v_latest_state text;v_latest_at timestamptz;v_review boolean:=false;v_reauthorization boolean:=false;v_preflight xero_v1.connection_preflight_evidence%ROWTYPE;v_preflight_failed boolean:=false;
BEGIN
 IF v_user IS NULL OR p_store_id IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.store_memberships sm WHERE sm.user_id=v_user AND sm.store_id=p_store_id
 ) THEN RAISE EXCEPTION 'Xero readiness access denied'; END IF;
 SELECT * INTO v_connection FROM xero_v1.connections c WHERE c.store_id=p_store_id AND c.retired_at IS NULL ORDER BY c.created_at DESC LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('storeId',p_store_id,'connection',NULL,'evidenceState',NULL,'evidenceRetrievedAt',NULL); END IF;
 SELECT * INTO v_mapping FROM xero_v1.mapping_versions mv WHERE mv.connection_id=v_connection.id ORDER BY mv.version DESC LIMIT 1;
 v_review:=v_mapping.id IS NULL OR EXISTS(SELECT 1 FROM xero_v1.mapping_audit ma WHERE ma.connection_id=v_connection.id AND ma.action='review_required' AND ma.occurred_at>coalesce(v_mapping.confirmed_at,'-infinity'::timestamptz));
 v_reauthorization:=EXISTS(SELECT 1 FROM xero_v1.xero_reauthorization_authorizations ra WHERE ra.connection_id=v_connection.id AND ra.consumed_at IS NULL);
 -- Only the latest receipt for the currently saved credential can establish
 -- a connection failure. Previous credentials must not poison a replacement.
 SELECT pe.* INTO v_preflight FROM xero_v1.connection_preflight_evidence pe
 JOIN xero_v1.credential_envelopes ce ON ce.connection_id=pe.connection_id AND ce.version=pe.credential_version
 WHERE pe.connection_id=v_connection.id ORDER BY pe.checked_at DESC,pe.id DESC LIMIT 1;
 v_reauthorization:=v_reauthorization OR coalesce(v_preflight.outcome='failed' AND v_preflight.reason IN ('reconnect_required','invalid_grant','insufficient_scope','unauthorized'),false);
 SELECT max(ae.retrieved_at) FILTER(WHERE ae.state='supported'),max(ae.retrieved_at) FILTER(WHERE ae.state<>'supported')
 INTO v_last_success,v_last_failure FROM xero_v1.accounting_evidence ae WHERE ae.connection_id=v_connection.id;
 SELECT ae.state,ae.retrieved_at INTO v_latest_state,v_latest_at FROM xero_v1.accounting_evidence ae WHERE ae.connection_id=v_connection.id ORDER BY ae.created_at DESC LIMIT 1;
 v_preflight_failed:=coalesce(v_preflight.outcome='failed' AND v_preflight.checked_at>coalesce(v_last_success,'-infinity'::timestamptz),false);
 RETURN jsonb_build_object(
  'storeId',p_store_id,
  'connection',jsonb_build_object('status',CASE WHEN v_reauthorization THEN 'reauthorization_required' WHEN EXISTS(SELECT 1 FROM xero_v1.credential_envelopes ce WHERE ce.connection_id=v_connection.id) THEN 'active' ELSE 'reauthorization_required' END,
    'scopeVersion','read-only-v1','createdAt',to_char(v_connection.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'lastSuccessAt',CASE WHEN v_last_success IS NULL THEN NULL ELSE to_char(v_last_success AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
    'lastFailureAt',CASE WHEN v_last_failure IS NULL THEN NULL ELSE to_char(v_last_failure AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,'mappingReviewRequired',v_review),
  'evidenceState',CASE WHEN v_reauthorization OR v_review OR v_latest_state IN ('review_required','invalidated') THEN 'review_required' WHEN v_preflight_failed AND v_last_success IS NOT NULL THEN 'stale' WHEN v_preflight_failed THEN 'unavailable' WHEN v_latest_state='supported' AND NOT v_review THEN 'ready' WHEN v_latest_state IN ('review_required','invalidated') OR v_review THEN 'review_required' WHEN v_latest_state='failed' AND v_last_success IS NOT NULL THEN 'stale' ELSE 'unavailable' END,
  'evidenceRetrievedAt',CASE WHEN v_last_success IS NOT NULL AND (v_reauthorization OR v_preflight_failed) THEN to_char(v_last_success AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') WHEN v_latest_state='supported' AND NOT v_review THEN to_char(v_latest_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') ELSE NULL END
 );
END $$;
COMMIT;
