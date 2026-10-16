-- STAGING ACTIVATION ONLY: installs two member readers, preserving saved
-- source evidence, mappings, credentials, authorizations and Shopify figures.
-- No source write, OAuth consumption, scheduler, new role or broad table grant.
BEGIN;
SET LOCAL night_scout.approved_project='bioalckltvkhlczusdvl';
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog,public,xero_v1;
DO $$ DECLARE r text;BEGIN
 IF current_setting('night_scout.approved_project',true)<>'bioalckltvkhlczusdvl' OR current_user<>'postgres' THEN RAISE EXCEPTION 'verified staging migration owner required';END IF;
 FOREACH r IN ARRAY ARRAY['public.store_memberships','xero_v1.connections','xero_v1.mapping_versions','xero_v1.mapping_selections','xero_v1.mapping_audit','xero_v1.accounting_evidence','xero_v1.credential_envelopes','xero_v1.connection_preflight_evidence'] LOOP
  IF to_regclass(r) IS NULL THEN RAISE EXCEPTION 'required Xero staging relation unavailable';END IF;
 END LOOP;
 IF to_regprocedure('auth.uid()') IS NULL OR to_regprocedure('public.xero_merchant_readiness(uuid)') IS NULL THEN RAISE EXCEPTION 'existing member readiness unavailable';END IF;
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','night_scout_xero_bootstrap_login','night_scout_import_login'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN RAISE EXCEPTION 'existing staging role unavailable';END IF;
 END LOOP;
END $$;

-- Conditional, one-shot reconnect authorization. This never rotates a
-- credential or consumes/changes earlier authorization, mapping or evidence.
DO $activation$
DECLARE v_connection uuid;v_owner uuid;v_preflight uuid;v_version integer;v_matches integer;v_usable boolean;v_lookup text;v_replace text;v_function regprocedure;v_role text;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'staging migration owner required';END IF;
 IF to_regclass('xero_v1.xero_third_reauthorization_authorizations') IS NULL THEN RAISE EXCEPTION 'reviewed third authorization schema unavailable';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='xero_v1.bootstrap_get_reauthorization_target(uuid,text,uuid)'::regprocedure AND prosecdef AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=pg_catalog, xero_v1, public'] AND prosrc IN ('
BEGIN
 IF session_user<>''night_scout_xero_bootstrap_login'' THEN RAISE EXCEPTION ''Xero bootstrap capability required''; END IF;
 IF p_store_id IS NULL OR p_owner_id IS NULL OR length(trim(coalesce(p_tenant_id,''''))) NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION ''invalid Xero reauthorization target''; END IF;
 RETURN QUERY SELECT c.id,ce.version FROM xero_v1.xero_third_reauthorization_authorizations ra
 JOIN xero_v1.connections c ON c.id=ra.connection_id AND c.retired_at IS NULL
 JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id AND ce.version=ra.target_credential_version AND (ce.lease_expires_at IS NULL OR ce.lease_expires_at<=clock_timestamp())
 WHERE ra.consumed_at IS NULL AND ra.allowed_owner_id=p_owner_id AND c.store_id=p_store_id AND c.tenant_id=trim(p_tenant_id)
  AND EXISTS(SELECT 1 FROM public.store_memberships sm WHERE sm.user_id=p_owner_id AND sm.store_id=p_store_id);
END ','
BEGIN
 IF session_user<>''night_scout_xero_bootstrap_login'' THEN RAISE EXCEPTION ''Xero bootstrap capability required''; END IF;
 IF p_store_id IS NULL OR p_owner_id IS NULL OR length(trim(coalesce(p_tenant_id,''''))) NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION ''invalid Xero reauthorization target''; END IF;
 RETURN QUERY SELECT c.id,ce.version FROM xero_v1.xero_fourth_reauthorization_authorizations ra
 JOIN xero_v1.connections c ON c.id=ra.connection_id AND c.retired_at IS NULL
 JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id AND ce.version=ra.target_credential_version AND (ce.lease_expires_at IS NULL OR ce.lease_expires_at<=clock_timestamp())
 WHERE ra.consumed_at IS NULL AND ra.allowed_owner_id=p_owner_id AND c.store_id=p_store_id AND c.tenant_id=trim(p_tenant_id)
  AND EXISTS(SELECT 1 FROM public.store_memberships sm WHERE sm.user_id=p_owner_id AND sm.store_id=p_store_id);
END ')) THEN RAISE EXCEPTION 'installed reviewed bootstrap definition mismatch';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='xero_v1.bootstrap_reauthorize_connection(uuid,uuid,text,uuid,integer,bytea,bytea,text,text)'::regprocedure AND prosecdef AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=pg_catalog, xero_v1, public'] AND prosrc IN ('
DECLARE v_authorization uuid;v_new_version integer;
BEGIN
 IF session_user<>''night_scout_xero_bootstrap_login'' THEN RAISE EXCEPTION ''Xero bootstrap capability required''; END IF;
 IF p_connection_id IS NULL OR p_store_id IS NULL OR p_owner_id IS NULL OR p_expected_version<3 OR length(trim(coalesce(p_tenant_id,''''))) NOT BETWEEN 1 AND 256 OR p_algorithm<>''AES-256-GCM'' OR octet_length(p_ciphertext) NOT BETWEEN 1 AND 16384 OR octet_length(p_encrypted_dek) NOT BETWEEN 1 AND 16384 OR p_key_version !~ ''^[A-Za-z0-9._-]{1,128}$'' THEN RAISE EXCEPTION ''invalid Xero reauthorization input''; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.store_memberships WHERE user_id=p_owner_id AND store_id=p_store_id) THEN RAISE EXCEPTION ''Xero reauthorization store membership required''; END IF;
 SELECT ra.id INTO v_authorization FROM xero_v1.xero_third_reauthorization_authorizations ra JOIN xero_v1.connections c ON c.id=ra.connection_id
 WHERE ra.connection_id=p_connection_id AND ra.allowed_owner_id=p_owner_id AND ra.consumed_at IS NULL AND ra.target_credential_version=p_expected_version
  AND c.store_id=p_store_id AND c.tenant_id=trim(p_tenant_id) AND c.retired_at IS NULL FOR UPDATE OF ra;
 IF v_authorization IS NULL THEN RAISE EXCEPTION ''Xero reauthorization unavailable''; END IF;
 v_new_version:=p_expected_version+1;
 UPDATE xero_v1.credential_envelopes ce SET ciphertext=p_ciphertext,encrypted_dek=p_encrypted_dek,key_version=p_key_version,algorithm=p_algorithm,version=v_new_version,rotated_at=clock_timestamp(),lease_expires_at=NULL
 WHERE ce.connection_id=p_connection_id AND ce.version=p_expected_version AND (ce.lease_expires_at IS NULL OR ce.lease_expires_at<=clock_timestamp());
 IF NOT FOUND THEN RAISE EXCEPTION ''Xero reauthorization unavailable''; END IF;
 UPDATE xero_v1.xero_third_reauthorization_authorizations SET consumed_at=clock_timestamp(),replacement_version=v_new_version WHERE id=v_authorization AND consumed_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION ''Xero reauthorization unavailable''; END IF;
 INSERT INTO xero_v1.credential_audit(connection_id,actor_id,action) VALUES(p_connection_id,p_owner_id,''credential_rotated'');
 RETURN QUERY SELECT p_connection_id,v_new_version;
END ','
DECLARE v_authorization uuid;v_new_version integer;
BEGIN
 IF session_user<>''night_scout_xero_bootstrap_login'' THEN RAISE EXCEPTION ''Xero bootstrap capability required''; END IF;
 IF p_connection_id IS NULL OR p_store_id IS NULL OR p_owner_id IS NULL OR p_expected_version<3 OR length(trim(coalesce(p_tenant_id,''''))) NOT BETWEEN 1 AND 256 OR p_algorithm<>''AES-256-GCM'' OR octet_length(p_ciphertext) NOT BETWEEN 1 AND 16384 OR octet_length(p_encrypted_dek) NOT BETWEEN 1 AND 16384 OR p_key_version !~ ''^[A-Za-z0-9._-]{1,128}$'' THEN RAISE EXCEPTION ''invalid Xero reauthorization input''; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.store_memberships WHERE user_id=p_owner_id AND store_id=p_store_id) THEN RAISE EXCEPTION ''Xero reauthorization store membership required''; END IF;
 SELECT ra.id INTO v_authorization FROM xero_v1.xero_fourth_reauthorization_authorizations ra JOIN xero_v1.connections c ON c.id=ra.connection_id
 WHERE ra.connection_id=p_connection_id AND ra.allowed_owner_id=p_owner_id AND ra.consumed_at IS NULL AND ra.target_credential_version=p_expected_version
  AND c.store_id=p_store_id AND c.tenant_id=trim(p_tenant_id) AND c.retired_at IS NULL FOR UPDATE OF ra;
 IF v_authorization IS NULL THEN RAISE EXCEPTION ''Xero reauthorization unavailable''; END IF;
 v_new_version:=p_expected_version+1;
 UPDATE xero_v1.credential_envelopes ce SET ciphertext=p_ciphertext,encrypted_dek=p_encrypted_dek,key_version=p_key_version,algorithm=p_algorithm,version=v_new_version,rotated_at=clock_timestamp(),lease_expires_at=NULL
 WHERE ce.connection_id=p_connection_id AND ce.version=p_expected_version AND (ce.lease_expires_at IS NULL OR ce.lease_expires_at<=clock_timestamp());
 IF NOT FOUND THEN RAISE EXCEPTION ''Xero reauthorization unavailable''; END IF;
 UPDATE xero_v1.xero_fourth_reauthorization_authorizations SET consumed_at=clock_timestamp(),replacement_version=v_new_version WHERE id=v_authorization AND consumed_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION ''Xero reauthorization unavailable''; END IF;
 INSERT INTO xero_v1.credential_audit(connection_id,actor_id,action) VALUES(p_connection_id,p_owner_id,''credential_rotated'');
 RETURN QUERY SELECT p_connection_id,v_new_version;
END ')) THEN RAISE EXCEPTION 'installed reviewed bootstrap definition mismatch';END IF;
 LOCK TABLE xero_v1.credential_envelopes,xero_v1.connections,xero_v1.mapping_versions,xero_v1.connection_preflight_evidence IN SHARE ROW EXCLUSIVE MODE;
 FOREACH v_function IN ARRAY ARRAY['xero_v1.bootstrap_get_reauthorization_target(uuid,text,uuid)'::regprocedure,'xero_v1.bootstrap_reauthorize_connection(uuid,uuid,text,uuid,integer,bytea,bytea,text,text)'::regprocedure] LOOP
  IF NOT has_function_privilege('night_scout_xero_bootstrap_login',v_function,'EXECUTE') THEN RAISE EXCEPTION 'existing bootstrap capability unavailable';END IF;
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated','service_role','night_scout_import_login'] LOOP
   IF has_function_privilege(v_role,v_function,'EXECUTE') THEN RAISE EXCEPTION 'existing bootstrap grant broader than reviewed';END IF;
  END LOOP;
 END LOOP;
 SELECT pg_get_functiondef('xero_v1.bootstrap_get_reauthorization_target(uuid,text,uuid)'::regprocedure),pg_get_functiondef('xero_v1.bootstrap_reauthorize_connection(uuid,uuid,text,uuid,integer,bytea,bytea,text,text)'::regprocedure)
 INTO v_lookup,v_replace;
 IF (strpos(v_lookup,'xero_fourth_reauthorization_authorizations')>0)<>(strpos(v_replace,'xero_fourth_reauthorization_authorizations')>0) THEN RAISE EXCEPTION 'bootstrap authorization generation mismatch';END IF;
 SELECT count(*),(array_agg(c.id))[1],(array_agg(mv.confirmed_by))[1],(array_agg(pe.id))[1],(array_agg(ce.version))[1]
 INTO v_matches,v_connection,v_owner,v_preflight,v_version
 FROM xero_v1.connections c
 JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id AND ce.version>=3 AND (ce.lease_expires_at IS NULL OR ce.lease_expires_at<=clock_timestamp())
 JOIN LATERAL(SELECT * FROM xero_v1.mapping_versions m WHERE m.connection_id=c.id ORDER BY m.version DESC,m.id DESC LIMIT 1) mv ON true
 JOIN LATERAL(SELECT * FROM xero_v1.connection_preflight_evidence p WHERE p.connection_id=c.id ORDER BY p.checked_at DESC,p.id DESC LIMIT 1) pe ON pe.credential_version=ce.version
 WHERE c.retired_at IS NULL AND pe.outcome='failed' AND pe.phase='connection' AND pe.reason='reconnect_required' AND pe.tenant_visible=false
  AND EXISTS(SELECT 1 FROM public.store_memberships sm WHERE sm.user_id=mv.confirmed_by AND sm.store_id=c.store_id);
 -- A connected/no-current-reconnect target does not receive an authorization.
 IF v_matches=0 THEN RETURN;END IF;
 IF v_matches<>1 OR v_owner IS NULL THEN RAISE EXCEPTION 'single current reconnect target unavailable';END IF;
 IF strpos(v_lookup,'xero_third_reauthorization_authorizations')>0 THEN
  SELECT EXISTS(SELECT 1 FROM xero_v1.xero_third_reauthorization_authorizations ra WHERE ra.connection_id=v_connection AND ra.allowed_owner_id=v_owner AND ra.target_credential_version=v_version AND ra.consumed_at IS NULL) INTO v_usable;
  IF v_usable THEN RETURN;END IF;
 ELSE
  IF to_regclass('xero_v1.xero_fourth_reauthorization_authorizations') IS NULL THEN RAISE EXCEPTION 'installed fourth authorization table unavailable';END IF;
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM xero_v1.xero_fourth_reauthorization_authorizations WHERE connection_id=$1 AND allowed_owner_id=$2 AND target_credential_version=$3 AND consumed_at IS NULL)' INTO v_usable USING v_connection,v_owner,v_version;
  IF v_usable THEN RETURN;END IF;
 END IF;
 IF to_regclass('xero_v1.xero_fourth_reauthorization_authorizations') IS NOT NULL THEN RAISE EXCEPTION 'fourth authorization already exists; review required';END IF;

 CREATE TABLE xero_v1.xero_fourth_reauthorization_authorizations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),connection_id uuid NOT NULL UNIQUE REFERENCES xero_v1.connections(id),
  preflight_evidence_id uuid NOT NULL UNIQUE REFERENCES xero_v1.connection_preflight_evidence(id),allowed_owner_id uuid NOT NULL REFERENCES auth.users(id),
  target_credential_version integer NOT NULL CHECK(target_credential_version>2),authorized_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  consumed_at timestamptz,replacement_version integer CHECK(replacement_version IS NULL OR replacement_version=target_credential_version+1),
  CHECK((consumed_at IS NULL AND replacement_version IS NULL) OR (consumed_at IS NOT NULL AND replacement_version IS NOT NULL)));
 ALTER TABLE xero_v1.xero_fourth_reauthorization_authorizations ENABLE ROW LEVEL SECURITY;
 REVOKE ALL ON xero_v1.xero_fourth_reauthorization_authorizations FROM PUBLIC,anon,authenticated,service_role,night_scout_import_login,night_scout_xero_bootstrap_login;
 INSERT INTO xero_v1.xero_fourth_reauthorization_authorizations(connection_id,preflight_evidence_id,allowed_owner_id,target_credential_version)
 VALUES(v_connection,v_preflight,v_owner,v_version);

 EXECUTE $lookup$CREATE OR REPLACE FUNCTION xero_v1.bootstrap_get_reauthorization_target(p_store_id uuid,p_tenant_id text,p_owner_id uuid)
RETURNS TABLE(connection_id uuid,credential_version integer) LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=pg_catalog,xero_v1,public AS $$
BEGIN
 IF session_user<>'night_scout_xero_bootstrap_login' THEN RAISE EXCEPTION 'Xero bootstrap capability required'; END IF;
 IF p_store_id IS NULL OR p_owner_id IS NULL OR length(trim(coalesce(p_tenant_id,''))) NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION 'invalid Xero reauthorization target'; END IF;
 RETURN QUERY SELECT c.id,ce.version FROM xero_v1.xero_fourth_reauthorization_authorizations ra
 JOIN xero_v1.connections c ON c.id=ra.connection_id AND c.retired_at IS NULL
 JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id AND ce.version=ra.target_credential_version AND (ce.lease_expires_at IS NULL OR ce.lease_expires_at<=clock_timestamp())
 WHERE ra.consumed_at IS NULL AND ra.allowed_owner_id=p_owner_id AND c.store_id=p_store_id AND c.tenant_id=trim(p_tenant_id)
  AND EXISTS(SELECT 1 FROM public.store_memberships sm WHERE sm.user_id=p_owner_id AND sm.store_id=p_store_id);
END $$;$lookup$;
 EXECUTE $replace$CREATE OR REPLACE FUNCTION xero_v1.bootstrap_reauthorize_connection(p_connection_id uuid,p_store_id uuid,p_tenant_id text,p_owner_id uuid,p_expected_version integer,p_ciphertext bytea,p_encrypted_dek bytea,p_key_version text,p_algorithm text)
RETURNS TABLE(connection_id uuid,credential_version integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,xero_v1,public AS $$
DECLARE v_authorization uuid;v_new_version integer;
BEGIN
 IF session_user<>'night_scout_xero_bootstrap_login' THEN RAISE EXCEPTION 'Xero bootstrap capability required'; END IF;
 IF p_connection_id IS NULL OR p_store_id IS NULL OR p_owner_id IS NULL OR p_expected_version<3 OR length(trim(coalesce(p_tenant_id,''))) NOT BETWEEN 1 AND 256 OR p_algorithm<>'AES-256-GCM' OR octet_length(p_ciphertext) NOT BETWEEN 1 AND 16384 OR octet_length(p_encrypted_dek) NOT BETWEEN 1 AND 16384 OR p_key_version !~ '^[A-Za-z0-9._-]{1,128}$' THEN RAISE EXCEPTION 'invalid Xero reauthorization input'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.store_memberships WHERE user_id=p_owner_id AND store_id=p_store_id) THEN RAISE EXCEPTION 'Xero reauthorization store membership required'; END IF;
 SELECT ra.id INTO v_authorization FROM xero_v1.xero_fourth_reauthorization_authorizations ra JOIN xero_v1.connections c ON c.id=ra.connection_id
 WHERE ra.connection_id=p_connection_id AND ra.allowed_owner_id=p_owner_id AND ra.consumed_at IS NULL AND ra.target_credential_version=p_expected_version
  AND c.store_id=p_store_id AND c.tenant_id=trim(p_tenant_id) AND c.retired_at IS NULL FOR UPDATE OF ra;
 IF v_authorization IS NULL THEN RAISE EXCEPTION 'Xero reauthorization unavailable'; END IF;
 v_new_version:=p_expected_version+1;
 UPDATE xero_v1.credential_envelopes ce SET ciphertext=p_ciphertext,encrypted_dek=p_encrypted_dek,key_version=p_key_version,algorithm=p_algorithm,version=v_new_version,rotated_at=clock_timestamp(),lease_expires_at=NULL
 WHERE ce.connection_id=p_connection_id AND ce.version=p_expected_version AND (ce.lease_expires_at IS NULL OR ce.lease_expires_at<=clock_timestamp());
 IF NOT FOUND THEN RAISE EXCEPTION 'Xero reauthorization unavailable'; END IF;
 UPDATE xero_v1.xero_fourth_reauthorization_authorizations SET consumed_at=clock_timestamp(),replacement_version=v_new_version WHERE id=v_authorization AND consumed_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Xero reauthorization unavailable'; END IF;
 INSERT INTO xero_v1.credential_audit(connection_id,actor_id,action) VALUES(p_connection_id,p_owner_id,'credential_rotated');
 RETURN QUERY SELECT p_connection_id,v_new_version;
END $$;$replace$;
END $activation$;

-- Internal preservation hashes never expose source rows or credential material.
CREATE TEMP TABLE xero_reader_preservation(relation_name text PRIMARY KEY,row_count bigint,body_hash text) ON COMMIT DROP;
DO $$ DECLARE r text;n bigint;h text;BEGIN
 FOREACH r IN ARRAY ARRAY['xero_v1.connections','xero_v1.mapping_versions','xero_v1.mapping_selections','xero_v1.mapping_audit','xero_v1.accounting_evidence','xero_v1.credential_envelopes','xero_v1.connection_preflight_evidence','xero_v1.xero_reauthorization_authorizations','xero_v1.xero_second_reauthorization_authorizations','xero_v1.xero_third_reauthorization_authorizations','xero_v1.xero_fourth_reauthorization_authorizations'] LOOP
  IF to_regclass(r) IS NOT NULL THEN
   EXECUTE format('SELECT count(*),md5(coalesce(string_agg(row_to_json(t)::text,''|'' ORDER BY row_to_json(t)::text),'''')) FROM %s t',r) INTO n,h;
   INSERT INTO pg_temp.xero_reader_preservation VALUES(r,n,h);
  END IF;
 END LOOP;
END $$;
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

CREATE OR REPLACE FUNCTION public.xero_merchant_readiness(p_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path=pg_catalog,public,xero_v1 AS $$
DECLARE v_user uuid:=(SELECT auth.uid());v_connection xero_v1.connections%ROWTYPE;v_mapping xero_v1.mapping_versions%ROWTYPE;
 v_last_success timestamptz;v_last_failure timestamptz;v_latest_state text;v_latest_at timestamptz;v_review boolean:=false;v_reauthorization boolean:=false;v_preflight xero_v1.connection_preflight_evidence%ROWTYPE;v_preflight_failed boolean:=false;v_authorization_table text;v_pending boolean;
BEGIN
 IF v_user IS NULL OR p_store_id IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.store_memberships sm WHERE sm.user_id=v_user AND sm.store_id=p_store_id
 ) THEN RAISE EXCEPTION 'Xero readiness access denied'; END IF;
 SELECT * INTO v_connection FROM xero_v1.connections c WHERE c.store_id=p_store_id AND c.retired_at IS NULL ORDER BY c.created_at DESC LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('storeId',p_store_id,'connection',NULL,'evidenceState',NULL,'evidenceRetrievedAt',NULL); END IF;
 SELECT * INTO v_mapping FROM xero_v1.mapping_versions mv WHERE mv.connection_id=v_connection.id ORDER BY mv.version DESC LIMIT 1;
 v_review:=v_mapping.id IS NULL OR EXISTS(SELECT 1 FROM xero_v1.mapping_audit ma WHERE ma.connection_id=v_connection.id AND ma.action='review_required' AND ma.occurred_at>coalesce(v_mapping.confirmed_at,'-infinity'::timestamptz));
 -- Preserve all installed append-only authorization generations. Each table
 -- name is a fixed constant; no caller-controlled identifier enters this SQL.
 FOREACH v_authorization_table IN ARRAY ARRAY[
  'xero_v1.xero_reauthorization_authorizations',
  'xero_v1.xero_second_reauthorization_authorizations',
  'xero_v1.xero_third_reauthorization_authorizations',
  'xero_v1.xero_fourth_reauthorization_authorizations'] LOOP
  IF to_regclass(v_authorization_table) IS NOT NULL AND strpos(pg_get_functiondef('xero_v1.bootstrap_get_reauthorization_target(uuid,text,uuid)'::regprocedure),v_authorization_table)>0 THEN
   IF v_authorization_table='xero_v1.xero_reauthorization_authorizations' THEN
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s WHERE connection_id=$1 AND consumed_at IS NULL)',v_authorization_table) INTO v_pending USING v_connection.id;
   ELSE
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s ra JOIN xero_v1.credential_envelopes ce ON ce.connection_id=ra.connection_id AND ce.version=ra.target_credential_version WHERE ra.connection_id=$1 AND ra.consumed_at IS NULL)',v_authorization_table) INTO v_pending USING v_connection.id;
   END IF;
   v_reauthorization:=v_reauthorization OR v_pending;
  END IF;
 END LOOP;
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


REVOKE ALL ON FUNCTION public.xero_merchant_readiness(uuid) FROM PUBLIC,anon,authenticated,service_role,night_scout_xero_bootstrap_login,night_scout_import_login;
GRANT EXECUTE ON FUNCTION public.xero_merchant_readiness(uuid) TO authenticated;
DO $$ DECLARE r record;n bigint;h text;f regprocedure;denied_role text;BEGIN
 FOR r IN SELECT * FROM pg_temp.xero_reader_preservation LOOP
  EXECUTE format('SELECT count(*),md5(coalesce(string_agg(row_to_json(t)::text,''|'' ORDER BY row_to_json(t)::text),'''')) FROM %s t',r.relation_name) INTO n,h;
  IF n<>r.row_count OR h<>r.body_hash THEN RAISE EXCEPTION 'saved Xero state changed during reader installation';END IF;
 END LOOP;
 FOREACH f IN ARRAY ARRAY['public.xero_merchant_readiness(uuid)'::regprocedure,'public.xero_accounting_period(uuid,date,date,text)'::regprocedure] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=f AND prosecdef AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=pg_catalog, public, xero_v1']) THEN RAISE EXCEPTION 'member reader owner or search path mismatch';END IF;
  IF NOT has_function_privilege('authenticated',f,'EXECUTE') THEN RAISE EXCEPTION 'member reader execute unavailable';END IF;
  FOREACH denied_role IN ARRAY ARRAY['anon','service_role','night_scout_xero_bootstrap_login','night_scout_import_login'] LOOP
   IF has_function_privilege(denied_role,f,'EXECUTE') THEN RAISE EXCEPTION 'member reader grant broader than reviewed';END IF;
  END LOOP;
 END LOOP;
 IF to_regclass('xero_v1.xero_fourth_reauthorization_authorizations') IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='xero_v1.xero_fourth_reauthorization_authorizations'::regclass AND relrowsecurity AND relowner='postgres'::regrole) THEN RAISE EXCEPTION 'fourth authorization owner or RLS mismatch';END IF;
  FOREACH denied_role IN ARRAY ARRAY['anon','authenticated','service_role','night_scout_xero_bootstrap_login','night_scout_import_login'] LOOP
   IF has_table_privilege(denied_role,'xero_v1.xero_fourth_reauthorization_authorizations','SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'direct fourth authorization grant present';END IF;
  END LOOP;
 END IF;
 IF has_table_privilege('authenticated','xero_v1.accounting_evidence','SELECT') OR has_table_privilege('authenticated','xero_v1.credential_envelopes','SELECT') THEN RAISE EXCEPTION 'direct sensitive evidence grant present';END IF;
END $$;
COMMIT;
