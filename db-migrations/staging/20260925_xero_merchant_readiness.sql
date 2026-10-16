BEGIN;

CREATE OR REPLACE FUNCTION public.xero_merchant_readiness(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path=pg_catalog,public,xero_v1
AS $$
DECLARE v_user uuid:=(SELECT auth.uid());v_connection xero_v1.connections%ROWTYPE;v_mapping xero_v1.mapping_versions%ROWTYPE;
 v_last_success timestamptz;v_last_failure timestamptz;v_latest_state text;v_latest_at timestamptz;v_review boolean:=false;
BEGIN
 IF v_user IS NULL OR p_store_id IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.store_memberships sm WHERE sm.user_id=v_user AND sm.store_id=p_store_id
 ) THEN RAISE EXCEPTION 'Xero readiness access denied'; END IF;
 SELECT * INTO v_connection FROM xero_v1.connections c WHERE c.store_id=p_store_id AND c.retired_at IS NULL ORDER BY c.created_at DESC LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('storeId',p_store_id,'connection',NULL,'evidenceState',NULL,'evidenceRetrievedAt',NULL); END IF;
 SELECT * INTO v_mapping FROM xero_v1.mapping_versions mv WHERE mv.connection_id=v_connection.id ORDER BY mv.version DESC LIMIT 1;
 v_review:=v_mapping.id IS NULL OR EXISTS(SELECT 1 FROM xero_v1.mapping_audit ma WHERE ma.connection_id=v_connection.id AND ma.action='review_required' AND ma.occurred_at>coalesce(v_mapping.confirmed_at,'-infinity'::timestamptz));
 SELECT max(ae.retrieved_at) FILTER(WHERE ae.state='supported'),max(ae.retrieved_at) FILTER(WHERE ae.state<>'supported')
 INTO v_last_success,v_last_failure FROM xero_v1.accounting_evidence ae WHERE ae.connection_id=v_connection.id;
 SELECT ae.state,ae.retrieved_at INTO v_latest_state,v_latest_at FROM xero_v1.accounting_evidence ae WHERE ae.connection_id=v_connection.id ORDER BY ae.created_at DESC LIMIT 1;
 RETURN jsonb_build_object(
  'storeId',p_store_id,
  'connection',jsonb_build_object('status',CASE WHEN EXISTS(SELECT 1 FROM xero_v1.credential_envelopes ce WHERE ce.connection_id=v_connection.id) THEN 'active' ELSE 'reauthorization_required' END,
    'scopeVersion','read-only-v1','createdAt',to_char(v_connection.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'lastSuccessAt',CASE WHEN v_last_success IS NULL THEN NULL ELSE to_char(v_last_success AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
    'lastFailureAt',CASE WHEN v_last_failure IS NULL THEN NULL ELSE to_char(v_last_failure AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,'mappingReviewRequired',v_review),
  'evidenceState',CASE WHEN v_latest_state='supported' AND NOT v_review THEN 'ready' WHEN v_latest_state IN ('review_required','invalidated') OR v_review THEN 'review_required' WHEN v_latest_state='failed' AND v_last_success IS NOT NULL THEN 'stale' ELSE 'unavailable' END,
  'evidenceRetrievedAt',CASE WHEN v_latest_state='supported' AND NOT v_review THEN to_char(v_latest_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') ELSE NULL END
 );
END $$;

REVOKE ALL ON FUNCTION public.xero_merchant_readiness(uuid) FROM PUBLIC,anon,authenticated,service_role,night_scout_xero_bootstrap_login,night_scout_import_login;
GRANT EXECUTE ON FUNCTION public.xero_merchant_readiness(uuid) TO authenticated;

COMMIT;
