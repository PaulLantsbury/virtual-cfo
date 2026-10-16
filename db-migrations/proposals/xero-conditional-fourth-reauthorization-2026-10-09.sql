-- Included atomically by xero-member-readers-activation-2026-10-09.sql.
-- Do not run this extracted block alone.

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
