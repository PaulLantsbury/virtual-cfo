-- PROPOSAL ONLY. Apply only after separate review of the staging migration.
-- Metadata-only RPC; no credential, financial value, tenant ID or user ID output.
BEGIN;
CREATE OR REPLACE FUNCTION public.xero_saved_mapping(p_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path=pg_catalog,public,xero_v1
AS $$
DECLARE v_user uuid:=(SELECT auth.uid());v_connection uuid;v_mapping xero_v1.mapping_versions%ROWTYPE;
 v_categories jsonb;v_review boolean;
BEGIN
 IF v_user IS NULL OR p_store_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.store_memberships sm WHERE sm.user_id=v_user AND sm.store_id=p_store_id)
 THEN RAISE EXCEPTION 'Xero mapping access denied'; END IF;
 SELECT c.id INTO v_connection FROM xero_v1.connections c WHERE c.store_id=p_store_id AND c.retired_at IS NULL ORDER BY c.created_at DESC LIMIT 1;
 IF v_connection IS NULL THEN RETURN jsonb_build_object('storeId',p_store_id,'state','not_connected','mapping',NULL); END IF;
 SELECT * INTO v_mapping FROM xero_v1.mapping_versions mv WHERE mv.connection_id=v_connection ORDER BY mv.version DESC LIMIT 1;
 IF v_mapping.id IS NULL THEN RETURN jsonb_build_object('storeId',p_store_id,'state','mapping_unavailable','mapping',NULL); END IF;
 SELECT jsonb_agg(jsonb_build_object('category',c.category,'accounts',coalesce((
  SELECT jsonb_agg(jsonb_build_object('accountId',ms.account_id,'name',ad.account_name,'type',ad.account_type,'status',ad.account_status) ORDER BY ad.account_name,ms.account_id)
   FROM xero_v1.mapping_selections ms LEFT JOIN xero_v1.account_directories ad
    ON ad.connection_id=v_connection AND ad.retrieved_at=v_mapping.directory_retrieved_at AND ad.account_id=ms.account_id
   WHERE ms.mapping_version_id=v_mapping.id AND ms.category=c.category
 ),'[]'::jsonb)) ORDER BY c.ord) INTO v_categories
 FROM unnest(ARRAY['revenue','processingFee','advertising','software','includedCash']) WITH ORDINALITY c(category,ord);
 v_review:=EXISTS(SELECT 1 FROM xero_v1.mapping_audit ma WHERE ma.connection_id=v_connection AND ma.action='review_required' AND ma.occurred_at>v_mapping.confirmed_at)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_categories) category WHERE jsonb_array_length(category->'accounts')=0)
  OR EXISTS(SELECT 1 FROM xero_v1.mapping_selections ms LEFT JOIN xero_v1.account_directories ad
    ON ad.connection_id=v_connection AND ad.retrieved_at=v_mapping.directory_retrieved_at AND ad.account_id=ms.account_id
    WHERE ms.mapping_version_id=v_mapping.id AND (ad.account_id IS NULL OR ad.account_status<>'ACTIVE'
      OR (ms.category='revenue' AND ad.account_type NOT IN ('REVENUE','SALES'))
      OR (ms.category IN ('processingFee','advertising','software') AND ad.account_type NOT IN ('EXPENSE','OVERHEADS'))
      OR (ms.category='includedCash' AND ad.account_type<>'BANK')));
 RETURN jsonb_build_object('storeId',p_store_id,'state','available','mapping',jsonb_build_object(
  'version',v_mapping.version,'effectiveFrom',v_mapping.effective_from,
  'confirmedAt',to_char(v_mapping.confirmed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'directoryRetrievedAt',to_char(v_mapping.directory_retrieved_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'reviewRequired',v_review,'categories',v_categories));
END $$;
REVOKE ALL ON FUNCTION public.xero_saved_mapping(uuid) FROM PUBLIC,anon,authenticated,service_role,night_scout_xero_bootstrap_login,night_scout_import_login;
GRANT EXECUTE ON FUNCTION public.xero_saved_mapping(uuid) TO authenticated;
COMMIT;
