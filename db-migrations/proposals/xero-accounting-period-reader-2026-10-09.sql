-- PROPOSAL ONLY. No live application or grants are authorised by this file.
-- Member-scoped exact-period read of bounded saved Xero evidence; no raw reports,
-- credentials, cash eligibility claims, Shopify figures or calculated P&L totals.
BEGIN;
CREATE OR REPLACE FUNCTION public.xero_accounting_period(p_store_id uuid,p_from date,p_to date,p_currency text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path=pg_catalog,public,xero_v1
AS $$
DECLARE
 v_user uuid:=(SELECT auth.uid());v_connection xero_v1.connections%ROWTYPE;
 v_mapping xero_v1.mapping_versions%ROWTYPE;v_evidence xero_v1.accounting_evidence%ROWTYPE;
 v_state text:='unavailable';v_reason text:='accounting_evidence_unavailable';
 v_scope jsonb:=jsonb_build_object('from',p_from,'to',p_to,'currency',p_currency);
BEGIN
 IF v_user IS NULL OR p_store_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.store_memberships sm WHERE sm.user_id=v_user AND sm.store_id=p_store_id)
 THEN RAISE EXCEPTION 'Xero accounting access denied'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to OR p_currency IS NULL OR p_currency!~'^[A-Z]{3}$'
 THEN RAISE EXCEPTION 'Invalid accounting period'; END IF;
 SELECT * INTO v_connection FROM xero_v1.connections c WHERE c.store_id=p_store_id AND c.retired_at IS NULL ORDER BY c.created_at DESC LIMIT 1;
 IF FOUND THEN
  SELECT * INTO v_mapping FROM xero_v1.mapping_versions mv WHERE mv.connection_id=v_connection.id AND mv.effective_from<=p_from ORDER BY mv.effective_from DESC,mv.version DESC LIMIT 1;
  IF v_mapping.id IS NULL OR EXISTS(SELECT 1 FROM xero_v1.mapping_versions mv WHERE mv.connection_id=v_connection.id AND mv.effective_from>p_from AND mv.effective_from<=p_to)
   OR EXISTS(SELECT 1 FROM xero_v1.mapping_audit ma WHERE ma.connection_id=v_connection.id AND ma.action='review_required' AND ma.occurred_at>v_mapping.confirmed_at)
   OR (SELECT count(DISTINCT category) FROM xero_v1.mapping_selections ms WHERE ms.mapping_version_id=v_mapping.id)<>5
  THEN v_state:='review_required';v_reason:='account_mapping_review_required';
  ELSE
   SELECT * INTO v_evidence FROM xero_v1.accounting_evidence ae WHERE ae.connection_id=v_connection.id AND ae.scope_from=p_from AND ae.scope_to=p_to AND ae.currency=p_currency ORDER BY ae.created_at DESC,ae.retrieved_at DESC,ae.id DESC LIMIT 1;
   IF v_evidence.id IS NOT NULL THEN
    IF v_evidence.mapping_version_id<>v_mapping.id OR v_evidence.state IN ('review_required','invalidated') THEN v_state:='review_required';v_reason:='source_review_required';
    ELSIF v_evidence.state='failed' THEN
     v_state:='unavailable';v_reason:='source_refresh_failed';
     IF v_evidence.closed_period THEN
      SELECT * INTO v_evidence FROM xero_v1.accounting_evidence ae WHERE ae.connection_id=v_connection.id AND ae.mapping_version_id=v_mapping.id AND ae.scope_from=p_from AND ae.scope_to=p_to AND ae.currency=p_currency AND ae.closed_period AND ae.state='supported' ORDER BY ae.created_at DESC,ae.retrieved_at DESC,ae.id DESC LIMIT 1;
      IF v_evidence.id IS NOT NULL THEN v_state:='stale'; END IF;
     END IF;
    END IF;
    IF v_evidence.state='supported' AND v_evidence.report_as_of=p_to AND v_state NOT IN ('review_required') THEN
     IF v_state<>'stale' THEN v_state:='available';v_reason:=NULL; END IF;
     -- JSON bigint values travel as decimal strings to preserve integer precision.
     RETURN jsonb_build_object('storeId',p_store_id,'scope',v_scope,'state',v_state,'reason',v_reason,
      'accounting',jsonb_build_object('basis','accrual_p_and_l','currency',p_currency,'asOf',v_evidence.report_as_of,
       'retrievedAt',to_char(v_evidence.retrieved_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
       'mappingVersionId',v_mapping.id,'closedPeriod',v_evidence.closed_period,
       'bookedRevenueMinor',v_evidence.booked_revenue_minor::text,'processingFeesMinor',v_evidence.processing_fee_minor::text,
       'advertisingMinor',v_evidence.advertising_minor::text,'softwareMinor',v_evidence.software_minor::text),
      'cash',NULL,'shopifyComparison','not_requested');
    END IF;
   END IF;
  END IF;
 END IF;
 RETURN jsonb_build_object('storeId',p_store_id,'scope',v_scope,'state',v_state,'reason',v_reason,'accounting',NULL,'cash',NULL,'shopifyComparison','not_requested');
END $$;
REVOKE ALL ON FUNCTION public.xero_accounting_period(uuid,date,date,text) FROM PUBLIC,anon,authenticated,service_role,night_scout_xero_bootstrap_login,night_scout_import_login;
GRANT EXECUTE ON FUNCTION public.xero_accounting_period(uuid,date,date,text) TO authenticated;
COMMIT;
