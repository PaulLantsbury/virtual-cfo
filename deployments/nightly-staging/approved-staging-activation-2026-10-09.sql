-- APPROVED NIGHT SCOUT STAGING ACTIVATION — 9 OCTOBER 2026.
-- Run once in the already verified Night Scout Staging project.
-- Atomic member readers, conditional exact-connection reconnect authorization,
-- and isolated disabled provider-writer capability. No provider writes occur.
-- No passwords, client credentials, owner UUIDs or tenant IDs are embedded.
BEGIN;
-- Component: db-migrations/proposals/xero-member-readers-activation-2026-10-09.sql
-- STAGING ACTIVATION ONLY: installs two member readers, preserving saved
-- source evidence, mappings, credentials, authorizations and Shopify figures.
-- No source write, OAuth consumption, scheduler, new role or broad table grant.
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

-- Component: experiments/test-programme/provider-activation-install.sql
-- NIGHT SCOUT STAGING ONLY. Creates an isolated disabled writer capability.
-- No programme rows, provider credentials or source writes are installed here.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL night_scout.approved_project='bioalckltvkhlczusdvl';
DO $guard$ BEGIN
 IF current_setting('night_scout.approved_project',true)<>'bioalckltvkhlczusdvl' THEN RAISE EXCEPTION 'Wrong staging project'; END IF;
 IF current_setting('server_version_num')::integer<170000 THEN RAISE EXCEPTION 'PostgreSQL17 or newer required'; END IF;
 IF to_regnamespace('staging_test_programme') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ('night_scout_test_writer','night_scout_test_writer_service')) THEN RAISE EXCEPTION 'Writer installation target occupied; inspect before retry'; END IF;
 IF current_user IN ('night_scout_test_writer','night_scout_test_writer_service') THEN RAISE EXCEPTION 'Operator installation required'; END IF;
 IF to_regclass('public.store_memberships') IS NULL OR (SELECT count(*) FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('public.store_memberships') AND attname IN ('user_id','store_id') AND atttypid='uuid'::regtype AND NOT attisdropped)<>2 THEN RAISE EXCEPTION 'Existing membership boundary required'; END IF;
END $guard$;
-- PROPOSAL ONLY: no runner imports this file, no grants or activation.
-- Atomic claim adapter must lock the programme row, enforce stop/cap, then insert.
-- A submitted action has no lease expiry and can only be reconciled, never reclaimed.
CREATE SCHEMA IF NOT EXISTS staging_test_programme;
CREATE TABLE staging_test_programme.programmes (
 programme_key text PRIMARY KEY,
 provider text NOT NULL CHECK (provider IN ('shopify','xero')),
 project_ref text NOT NULL CHECK (project_ref = 'bioalckltvkhlczusdvl'),
 target text NOT NULL,
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '14 days'),
 action_cap integer NOT NULL CHECK (action_cap BETWEEN 1 AND 14),
 enabled boolean NOT NULL DEFAULT false,
 stopped boolean NOT NULL DEFAULT false
);
CREATE TABLE staging_test_programme.actions (
 programme_key text NOT NULL REFERENCES staging_test_programme.programmes(programme_key),
 action_key text NOT NULL,
 payload_digest text NOT NULL CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
 state text NOT NULL CHECK (state IN ('claimed','submitted','confirmed','uncertain','skipped')),
 source_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 submitted_at timestamptz,
 confirmed_at timestamptz,
 PRIMARY KEY(programme_key, action_key),
 CHECK ((state = 'confirmed') = (source_id IS NOT NULL AND confirmed_at IS NOT NULL))
);
REVOKE ALL ON SCHEMA staging_test_programme FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA staging_test_programme FROM PUBLIC;
-- No credential columns, raw response/error columns, automatic cleanup or retry.
-- Before application: reviewed least-privilege RPC/role, RLS, cap locking,
-- immutable submitted records, target-bound reconciliation and stop semantics.

-- PROPOSAL ONLY. Apply after provider-ledger-proposal.sql in exact staging.
-- The login/password is deliberately not created; operator creates a restricted
-- NOINHERIT login and grants this NOLOGIN capability role, with no other membership.
CREATE ROLE night_scout_test_writer_service NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE TABLE staging_test_programme.writer_envelopes (
 programme_key text PRIMARY KEY REFERENCES staging_test_programme.programmes,
 connection_id uuid NOT NULL,
 tenant_id uuid NOT NULL,
 ciphertext bytea NOT NULL CHECK (octet_length(ciphertext) BETWEEN 30 AND 16384),
 encrypted_dek bytea NOT NULL CHECK (octet_length(encrypted_dek) BETWEEN 30 AND 16384),
 key_version text NOT NULL CHECK (length(key_version) BETWEEN 1 AND 128),
 algorithm text NOT NULL CHECK (algorithm='AES-256-GCM'),
 version integer NOT NULL CHECK (version>0),
 refresh_claim uuid,
 rotated_at timestamptz
);
ALTER TABLE staging_test_programme.programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging_test_programme.actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging_test_programme.writer_envelopes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA staging_test_programme FROM PUBLIC,night_scout_test_writer_service;
GRANT USAGE ON SCHEMA staging_test_programme TO night_scout_test_writer_service;

CREATE FUNCTION staging_test_programme.claim_action(p text,k text,d text,provider_name text,target_name text,cap integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme AS $$
DECLARE r staging_test_programme.programmes%ROWTYPE; a staging_test_programme.actions%ROWTYPE;
BEGIN
 SELECT * INTO r FROM staging_test_programme.programmes WHERE programme_key=p FOR UPDATE;
 IF NOT FOUND OR NOT r.enabled OR r.stopped OR r.provider<>provider_name OR r.target<>target_name OR r.action_cap<>cap OR now()<r.starts_at OR now()>=r.ends_at THEN RETURN 'blocked'; END IF;
 SELECT * INTO a FROM staging_test_programme.actions WHERE programme_key=p AND action_key=k;
 IF FOUND THEN IF a.payload_digest=d THEN RETURN 'existing'; ELSE RETURN 'blocked'; END IF; END IF;
 IF d !~ '^[0-9a-f]{64}$' OR k !~ '^ns-[0-9a-f]{40}$' THEN RETURN 'blocked'; END IF;
 IF EXISTS(SELECT 1 FROM staging_test_programme.actions WHERE programme_key=p AND state IN ('claimed','submitted','uncertain')) OR (SELECT count(*) FROM staging_test_programme.actions WHERE programme_key=p)>=r.action_cap THEN RETURN 'blocked'; END IF;
 INSERT INTO staging_test_programme.actions(programme_key,action_key,payload_digest,state) VALUES(p,k,d,'claimed'); RETURN 'claimed';
END $$;
CREATE FUNCTION staging_test_programme.transition_action(p text,k text,old_state text,new_state text,sid text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme AS $$
DECLARE n integer;
BEGIN
 PERFORM 1 FROM staging_test_programme.programmes WHERE programme_key=p FOR UPDATE;
 IF NOT ((old_state='claimed' AND new_state='submitted' AND sid IS NULL) OR (old_state='submitted' AND new_state='uncertain' AND sid IS NULL) OR (old_state='submitted' AND new_state='confirmed' AND length(sid) BETWEEN 1 AND 256)) THEN RETURN false; END IF;
 UPDATE staging_test_programme.actions SET state=new_state,source_id=sid,
 submitted_at=CASE WHEN new_state='submitted' THEN now() ELSE submitted_at END,
 confirmed_at=CASE WHEN new_state='confirmed' THEN now() ELSE confirmed_at END
 WHERE programme_key=p AND action_key=k AND state=old_state;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n=1 AND new_state='uncertain' THEN UPDATE staging_test_programme.programmes SET stopped=true WHERE programme_key=p; END IF;
 RETURN n=1;
END $$;
CREATE FUNCTION staging_test_programme.claim_writer_envelope(p text,t uuid)
RETURNS TABLE(connection_id uuid,tenant_id uuid,ciphertext bytea,encrypted_dek bytea,key_version text,algorithm text,version integer,refresh_claim uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme AS $$
DECLARE r staging_test_programme.programmes%ROWTYPE; claim uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO r FROM staging_test_programme.programmes WHERE programme_key=p FOR UPDATE;
 IF NOT FOUND OR r.provider<>'xero' OR r.target<>t::text OR NOT r.enabled OR r.stopped OR now()<r.starts_at OR now()>=r.ends_at THEN RETURN; END IF;
 UPDATE staging_test_programme.writer_envelopes e SET refresh_claim=claim WHERE e.programme_key=p AND e.tenant_id=t AND e.refresh_claim IS NULL;
 IF NOT FOUND THEN RETURN; END IF;
 RETURN QUERY SELECT e.connection_id,e.tenant_id,e.ciphertext,e.encrypted_dek,e.key_version,e.algorithm,e.version,e.refresh_claim FROM staging_test_programme.writer_envelopes e WHERE e.programme_key=p;
END $$;
CREATE FUNCTION staging_test_programme.rotate_writer_envelope(p text,t uuid,c uuid,v integer,ct bytea,dek bytea)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme AS $$
DECLARE n integer;
BEGIN
 PERFORM 1 FROM staging_test_programme.programmes WHERE programme_key=p FOR UPDATE;
 UPDATE staging_test_programme.writer_envelopes SET ciphertext=ct,encrypted_dek=dek,version=version+1,rotated_at=now(),refresh_claim=NULL
 WHERE programme_key=p AND tenant_id=t AND refresh_claim=c AND version=v;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n=1;
END $$;
CREATE FUNCTION staging_test_programme.stop_programme(p text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme AS $$
BEGIN UPDATE staging_test_programme.programmes SET stopped=true WHERE programme_key=p; RETURN FOUND; END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA staging_test_programme FROM PUBLIC;
GRANT EXECUTE ON FUNCTION staging_test_programme.claim_action(text,text,text,text,text,integer),
 staging_test_programme.transition_action(text,text,text,text,text),
 staging_test_programme.claim_writer_envelope(text,uuid),
 staging_test_programme.rotate_writer_envelope(text,uuid,uuid,integer,bytea,bytea),
 staging_test_programme.stop_programme(text) TO night_scout_test_writer_service;
-- Envelope seeding is an operator action after separate test-writer OAuth consent.
-- Never copy the existing reader envelope or grant access to xero_v1 credentials.

-- Isolated writer consent state. Hash only; no OAuth codes/tokens or plaintext secrets.
CREATE TABLE staging_test_programme.writer_oauth_states(
 state_digest text PRIMARY KEY CHECK(state_digest ~ '^[0-9a-f]{64}$'),
 owner_id uuid NOT NULL,store_id uuid NOT NULL,
 expires_at timestamptz NOT NULL CHECK(expires_at<=now()+interval '10 minutes'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','consumed','seeded')),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE staging_test_programme.writer_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON staging_test_programme.writer_oauth_states FROM PUBLIC,night_scout_test_writer_service;
CREATE FUNCTION staging_test_programme.start_writer_consent(d text,o uuid,s uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme,public AS $$
BEGIN
 IF d !~ '^[0-9a-f]{64}$' OR NOT EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.user_id=o AND m.store_id=s) OR EXISTS(SELECT 1 FROM staging_test_programme.writer_envelopes WHERE programme_key='xero-staging-20261012') THEN RETURN false; END IF;
 DELETE FROM staging_test_programme.writer_oauth_states WHERE owner_id=o AND store_id=s AND status='pending';
 INSERT INTO staging_test_programme.writer_oauth_states(state_digest,owner_id,store_id,expires_at) VALUES(d,o,s,now()+interval '10 minutes');RETURN true;
END $$;
CREATE FUNCTION staging_test_programme.consume_writer_consent(d text,o uuid,s uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.user_id=o AND m.store_id=s) THEN RETURN false; END IF;
 UPDATE staging_test_programme.writer_oauth_states SET status='consumed' WHERE state_digest=d AND owner_id=o AND store_id=s AND status='pending' AND expires_at>now();RETURN FOUND;
END $$;
CREATE FUNCTION staging_test_programme.seed_writer_consent(d text,o uuid,s uuid,t uuid,c uuid,ct bytea,dek bytea,kv text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,staging_test_programme,public AS $$
DECLARE p staging_test_programme.programmes%ROWTYPE;
BEGIN
 PERFORM 1 FROM staging_test_programme.writer_oauth_states WHERE state_digest=d AND owner_id=o AND store_id=s AND status='consumed' AND expires_at>now() FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.user_id=o AND m.store_id=s) OR EXISTS(SELECT 1 FROM staging_test_programme.writer_envelopes WHERE programme_key='xero-staging-20261012') THEN RETURN false; END IF;
 SELECT * INTO p FROM staging_test_programme.programmes WHERE programme_key='xero-staging-20261012' FOR UPDATE;
 IF FOUND THEN
 IF p.provider<>'xero' OR p.project_ref<>'bioalckltvkhlczusdvl' OR p.target<>t::text OR p.enabled OR p.stopped OR p.action_cap<>6 OR p.starts_at<>'2026-10-12T00:00:00Z'::timestamptz OR p.ends_at<>'2026-10-26T00:00:00Z'::timestamptz THEN RETURN false; END IF;
 ELSE
 INSERT INTO staging_test_programme.programmes(programme_key,provider,project_ref,target,starts_at,ends_at,action_cap,enabled,stopped)
 VALUES('xero-staging-20261012','xero','bioalckltvkhlczusdvl',t::text,'2026-10-12T00:00:00Z','2026-10-26T00:00:00Z',6,false,false);
 END IF;
 INSERT INTO staging_test_programme.writer_envelopes(programme_key,connection_id,tenant_id,ciphertext,encrypted_dek,key_version,algorithm,version)
 VALUES('xero-staging-20261012',c,t,ct,dek,kv,'AES-256-GCM',1);
 UPDATE staging_test_programme.writer_oauth_states SET status='seeded' WHERE state_digest=d;RETURN true;
END $$;
REVOKE ALL ON FUNCTION staging_test_programme.start_writer_consent(text,uuid,uuid),staging_test_programme.consume_writer_consent(text,uuid,uuid),staging_test_programme.seed_writer_consent(text,uuid,uuid,uuid,uuid,bytea,bytea,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION staging_test_programme.start_writer_consent(text,uuid,uuid),staging_test_programme.consume_writer_consent(text,uuid,uuid),staging_test_programme.seed_writer_consent(text,uuid,uuid,uuid,uuid,bytea,bytea,text) TO night_scout_test_writer_service;

CREATE ROLE night_scout_test_writer LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 3;
GRANT night_scout_test_writer_service TO night_scout_test_writer WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
REVOKE ALL ON SCHEMA staging_test_programme FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA staging_test_programme FROM PUBLIC,night_scout_test_writer,night_scout_test_writer_service;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA staging_test_programme FROM PUBLIC,night_scout_test_writer;
DO $browser$ DECLARE r text; BEGIN
 FOR r IN SELECT rolname FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated') LOOP
 EXECUTE format('REVOKE ALL ON SCHEMA staging_test_programme FROM %I',r);
 EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA staging_test_programme FROM %I',r);
 EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA staging_test_programme FROM %I',r);
 END LOOP;
END $browser$;
DO $check$ BEGIN
 IF (SELECT count(*) FROM staging_test_programme.programmes)<>0 OR (SELECT count(*) FROM staging_test_programme.actions)<>0 OR (SELECT count(*) FROM staging_test_programme.writer_envelopes)<>0 OR (SELECT count(*) FROM staging_test_programme.writer_oauth_states)<>0 THEN RAISE EXCEPTION 'Unexpected writer data'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ('night_scout_test_writer','night_scout_test_writer_service') AND (rolsuper OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN RAISE EXCEPTION 'Unsafe writer role'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='night_scout_test_writer' AND rolcanlogin AND rolconnlimit=3) OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='night_scout_test_writer_service' AND NOT rolcanlogin) THEN RAISE EXCEPTION 'Unsafe writer login capability'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles u ON u.oid=m.member WHERE u.rolname IN ('night_scout_test_writer','night_scout_test_writer_service'))<>1 THEN RAISE EXCEPTION 'Unexpected writer membership'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles u ON u.oid=m.member WHERE u.rolname='night_scout_test_writer' AND (m.admin_option OR m.inherit_option OR NOT m.set_option)) THEN RAISE EXCEPTION 'Unsafe writer membership'; END IF;
END $check$;
SELECT 'writer_schema_installed_disabled' AS state, 0 AS enabled_programmes;

COMMIT;
SELECT 'staging_readers_and_disabled_writer_installed' AS state,
 (SELECT count(*) FROM pg_proc p WHERE p.oid IN ('public.xero_merchant_readiness(uuid)'::regprocedure,'public.xero_accounting_period(uuid,date,date,text)'::regprocedure)) AS member_readers,
 (SELECT count(*) FROM staging_test_programme.programmes WHERE enabled) AS enabled_writer_programmes,
 (SELECT count(*) FROM staging_test_programme.actions) AS provider_actions,
 strpos(pg_get_functiondef('xero_v1.bootstrap_get_reauthorization_target(uuid,text,uuid)'::regprocedure),'xero_fourth_reauthorization_authorizations')>0 AS reconnect_uses_fourth_authorization;
