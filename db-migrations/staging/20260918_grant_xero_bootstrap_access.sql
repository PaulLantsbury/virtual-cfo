-- STAGING-ONLY XERO INITIAL-CONNECTION BOOTSTRAP CAPABILITY.
--
-- Run manually in Night Scout Staging (bioalckltvkhlczusdvl) only after the
-- one-shot Xero installer and worker-access grants have been verified. This
-- adds a distinct server login with no table privileges. It cannot run the
-- scheduled refresh functions; conversely the refresh worker cannot call this
-- bootstrap function. Password remains NULL until the staging migration owner
-- provisions a randomly generated value into the host secret store.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog, public;

DO $$
BEGIN
  IF current_user IN ('night_scout_import_login','night_scout_xero_bootstrap_login') THEN
    RAISE EXCEPTION 'run as the staging migration owner, never as an application login';
  END IF;
  IF to_regclass('xero_v1.connections') IS NULL
     OR to_regclass('xero_v1.account_directories') IS NULL
     OR to_regclass('xero_v1.mapping_versions') IS NULL
     OR to_regclass('xero_v1.mapping_selections') IS NULL
     OR to_regclass('xero_v1.credential_envelopes') IS NULL
     OR to_regclass('public.store_memberships') IS NULL
     OR to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'Xero staging schema is incomplete; stop and review the one-shot installer first';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='night_scout_xero_bootstrap_login') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='night_scout_xero_bootstrap_login'
      AND rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolcreatedb
      AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls AND rolconnlimit=1) THEN
      RAISE EXCEPTION 'existing Xero bootstrap login has unsafe attributes';
    END IF;
  ELSE
    CREATE ROLE night_scout_xero_bootstrap_login LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 1 PASSWORD NULL;
  END IF;
END
$$;

-- This one transaction creates a first active connection, a fetched account
-- directory, mapping v1, its immutable selections, and an encrypted refresh
-- envelope. Inputs are bounded metadata/ciphertext only: neither OAuth codes,
-- plaintext tokens, raw reports nor financial values are accepted or stored.
CREATE OR REPLACE FUNCTION xero_v1.bootstrap_create_initial_connection(
  p_store_id uuid, p_tenant_id text, p_owner_id uuid, p_effective_from date,
  p_directory_retrieved_at timestamptz, p_accounts jsonb, p_mapping jsonb,
  p_ciphertext bytea, p_encrypted_dek bytea, p_key_version text, p_algorithm text
) RETURNS TABLE(connection_id uuid,mapping_version_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, xero_v1
AS $$
DECLARE v_connection uuid; v_mapping uuid; v_account jsonb; v_selection jsonb;
        v_category text; v_account_id text; v_directory_count integer:=0;
        v_mapping_count integer:=0;
BEGIN
  -- session_user remains the direct login under SECURITY DEFINER. This prevents
  -- the refresh login or a member role from acquiring bootstrap authority via
  -- SET ROLE or inherited membership.
  IF session_user <> 'night_scout_xero_bootstrap_login' THEN
    RAISE EXCEPTION 'Xero bootstrap capability required';
  END IF;
  IF p_store_id IS NULL OR p_owner_id IS NULL OR p_effective_from IS NULL
     OR p_directory_retrieved_at IS NULL OR p_accounts IS NULL OR p_mapping IS NULL
     OR jsonb_typeof(p_accounts) <> 'array' OR jsonb_typeof(p_mapping) <> 'array'
     OR length(trim(coalesce(p_tenant_id,''))) NOT BETWEEN 1 AND 256
     OR p_algorithm <> 'AES-256-GCM'
     OR octet_length(p_ciphertext) NOT BETWEEN 1 AND 16384
     OR octet_length(p_encrypted_dek) NOT BETWEEN 1 AND 16384
     OR length(trim(coalesce(p_key_version,''))) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'invalid Xero bootstrap input';
  END IF;
  -- The server must separately authenticate this principal as an owner. The
  -- database makes the asserted owner at least a real member of this store.
  IF NOT EXISTS (SELECT 1 FROM public.store_memberships WHERE user_id=p_owner_id AND store_id=p_store_id) THEN
    RAISE EXCEPTION 'Xero bootstrap store membership required';
  END IF;
  IF EXISTS (SELECT 1 FROM xero_v1.connections WHERE store_id=p_store_id AND retired_at IS NULL) THEN
    RAISE EXCEPTION 'active Xero connection already exists for store';
  END IF;
  IF EXISTS (SELECT 1 FROM xero_v1.connections WHERE tenant_id=p_tenant_id AND retired_at IS NULL) THEN
    RAISE EXCEPTION 'active Xero tenant already belongs to a store';
  END IF;

  INSERT INTO xero_v1.connections(store_id,tenant_id) VALUES(p_store_id,trim(p_tenant_id)) RETURNING id INTO v_connection;
  FOR v_account IN SELECT value FROM jsonb_array_elements(p_accounts) LOOP
    IF jsonb_typeof(v_account)<>'object'
       OR (v_account ?& ARRAY['accountId','accountName','accountType','accountStatus']) IS FALSE
       OR jsonb_object_length(v_account)<>4
       OR length(trim(coalesce(v_account->>'accountId',''))) NOT BETWEEN 1 AND 256
       OR length(trim(coalesce(v_account->>'accountName',''))) NOT BETWEEN 1 AND 256
       OR length(trim(coalesce(v_account->>'accountType',''))) NOT BETWEEN 1 AND 64
       OR length(trim(coalesce(v_account->>'accountStatus',''))) NOT BETWEEN 1 AND 64 THEN
      RAISE EXCEPTION 'invalid Xero account directory';
    END IF;
    INSERT INTO xero_v1.account_directories(connection_id,retrieved_at,account_id,account_name,account_type,account_status)
      VALUES(v_connection,p_directory_retrieved_at,trim(v_account->>'accountId'),trim(v_account->>'accountName'),trim(v_account->>'accountType'),trim(v_account->>'accountStatus'));
    v_directory_count:=v_directory_count+1;
  END LOOP;
  IF v_directory_count=0 OR v_directory_count>1000 THEN RAISE EXCEPTION 'bounded Xero account directory required'; END IF;

  INSERT INTO xero_v1.mapping_versions(connection_id,version,effective_from,confirmed_by,confirmed_at,directory_retrieved_at)
    VALUES(v_connection,1,p_effective_from,p_owner_id,now(),p_directory_retrieved_at) RETURNING id INTO v_mapping;
  FOR v_selection IN SELECT value FROM jsonb_array_elements(p_mapping) LOOP
    IF jsonb_typeof(v_selection)<>'object' OR (v_selection ?& ARRAY['category','accountId']) IS FALSE
       OR jsonb_object_length(v_selection)<>2 THEN RAISE EXCEPTION 'invalid Xero mapping selection'; END IF;
    v_category:=v_selection->>'category'; v_account_id:=trim(coalesce(v_selection->>'accountId',''));
    IF v_category NOT IN ('revenue','processingFee','advertising','software','includedCash')
       OR length(v_account_id) NOT BETWEEN 1 AND 256
       OR NOT EXISTS (SELECT 1 FROM xero_v1.account_directories WHERE connection_id=v_connection AND retrieved_at=p_directory_retrieved_at AND account_id=v_account_id AND account_status='ACTIVE') THEN
      RAISE EXCEPTION 'invalid active Xero mapping selection';
    END IF;
    INSERT INTO xero_v1.mapping_selections(mapping_version_id,category,account_id) VALUES(v_mapping,v_category,v_account_id);
    v_mapping_count:=v_mapping_count+1;
  END LOOP;
  IF v_mapping_count<5 OR v_mapping_count>100
     OR (SELECT count(DISTINCT category) FROM xero_v1.mapping_selections WHERE mapping_version_id=v_mapping)<>5 THEN
    RAISE EXCEPTION 'complete Xero mapping required';
  END IF;
  INSERT INTO xero_v1.mapping_audit(connection_id,mapping_version_id,action,actor_id)
    VALUES(v_connection,v_mapping,'confirmed',p_owner_id);
  INSERT INTO xero_v1.credential_envelopes(connection_id,ciphertext,encrypted_dek,key_version,algorithm,version,rotated_at)
    VALUES(v_connection,p_ciphertext,p_encrypted_dek,trim(p_key_version),p_algorithm,1,now());
  INSERT INTO xero_v1.credential_audit(connection_id,actor_id,action) VALUES(v_connection,p_owner_id,'credential_stored');
  RETURN QUERY SELECT v_connection,v_mapping;
END
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA xero_v1 FROM night_scout_xero_bootstrap_login;
REVOKE ALL ON FUNCTION xero_v1.bootstrap_create_initial_connection(uuid,text,uuid,date,timestamptz,jsonb,jsonb,bytea,bytea,text,text) FROM PUBLIC,anon,authenticated,night_scout_import_login;
GRANT USAGE ON SCHEMA xero_v1 TO night_scout_xero_bootstrap_login;
GRANT EXECUTE ON FUNCTION xero_v1.bootstrap_create_initial_connection(uuid,text,uuid,date,timestamptz,jsonb,jsonb,bytea,bytea,text,text) TO night_scout_xero_bootstrap_login;

COMMIT;
