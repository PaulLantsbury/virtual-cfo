-- STAGING-ONLY follow-up for the applied Xero bootstrap capability.
-- Preallocating the connection UUID lets the trusted host bind the encrypted
-- refresh credential to the same connection ID used by the refresh worker.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog,xero_v1;

DO $$
DECLARE old_oid oid;
BEGIN
 IF current_user IN ('night_scout_import_login','night_scout_xero_bootstrap_login') THEN
  RAISE EXCEPTION 'run as the staging migration owner, never as an application login';
 END IF;
 old_oid:=to_regprocedure('xero_v1.bootstrap_create_initial_connection(uuid,text,uuid,date,timestamptz,jsonb,jsonb,bytea,bytea,text,text)');
 IF old_oid IS NULL OR NOT EXISTS(
  SELECT 1 FROM pg_proc WHERE oid=old_oid AND prosecdef
   AND pg_get_userbyid(proowner)=current_user
   AND proconfig=ARRAY['search_path=pg_catalog, xero_v1']
 ) THEN RAISE EXCEPTION 'reviewed applied Xero bootstrap function is missing or changed'; END IF;
 IF to_regprocedure('xero_v1.bootstrap_create_initial_connection(uuid,uuid,text,uuid,date,timestamptz,jsonb,jsonb,bytea,bytea,text,text)') IS NOT NULL THEN
  RAISE EXCEPTION 'connection-bound Xero bootstrap function already exists; stop and review';
 END IF;
END $$;

CREATE FUNCTION xero_v1.bootstrap_create_initial_connection(
 p_connection_id uuid,p_store_id uuid,p_tenant_id text,p_owner_id uuid,p_effective_from date,
 p_directory_retrieved_at timestamptz,p_accounts jsonb,p_mapping jsonb,
 p_ciphertext bytea,p_encrypted_dek bytea,p_key_version text,p_algorithm text
) RETURNS TABLE(connection_id uuid,mapping_version_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,xero_v1 AS $$
DECLARE v_mapping uuid;v_account jsonb;v_selection jsonb;v_category text;v_account_id text;
 v_directory_count integer:=0;v_mapping_count integer:=0;
BEGIN
 IF session_user<>'night_scout_xero_bootstrap_login' THEN RAISE EXCEPTION 'Xero bootstrap capability required'; END IF;
 IF p_connection_id IS NULL OR p_store_id IS NULL OR p_owner_id IS NULL OR p_effective_from IS NULL
  OR p_directory_retrieved_at IS NULL OR p_accounts IS NULL OR p_mapping IS NULL
  OR jsonb_typeof(p_accounts)<>'array' OR jsonb_typeof(p_mapping)<>'array'
  OR jsonb_array_length(p_accounts) NOT BETWEEN 1 AND 1000
  OR jsonb_array_length(p_mapping) NOT BETWEEN 5 AND 100
  OR length(trim(coalesce(p_tenant_id,''))) NOT BETWEEN 1 AND 256
  OR p_algorithm<>'AES-256-GCM' OR octet_length(p_ciphertext) NOT BETWEEN 1 AND 16384
  OR octet_length(p_encrypted_dek) NOT BETWEEN 1 AND 16384
  OR p_key_version !~ '^[A-Za-z0-9._-]{1,128}$' THEN RAISE EXCEPTION 'invalid Xero bootstrap input'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.store_memberships WHERE user_id=p_owner_id AND store_id=p_store_id) THEN
  RAISE EXCEPTION 'Xero bootstrap store membership required'; END IF;
 IF EXISTS(SELECT 1 FROM xero_v1.connections WHERE id=p_connection_id) THEN RAISE EXCEPTION 'Xero connection identifier already exists'; END IF;
 IF EXISTS(SELECT 1 FROM xero_v1.connections WHERE store_id=p_store_id AND retired_at IS NULL) THEN RAISE EXCEPTION 'active Xero connection already exists for store'; END IF;
 IF EXISTS(SELECT 1 FROM xero_v1.connections WHERE tenant_id=trim(p_tenant_id) AND retired_at IS NULL) THEN RAISE EXCEPTION 'active Xero tenant already belongs to a store'; END IF;
 INSERT INTO xero_v1.connections(id,store_id,tenant_id) VALUES(p_connection_id,p_store_id,trim(p_tenant_id));
 FOR v_account IN SELECT value FROM jsonb_array_elements(p_accounts) LOOP
  IF jsonb_typeof(v_account)<>'object' OR (v_account ?& ARRAY['accountId','accountName','accountType','accountStatus']) IS FALSE
   OR (SELECT count(*) FROM jsonb_object_keys(v_account))<>4
   OR length(trim(coalesce(v_account->>'accountId',''))) NOT BETWEEN 1 AND 256
   OR length(trim(coalesce(v_account->>'accountName',''))) NOT BETWEEN 1 AND 256
   OR length(trim(coalesce(v_account->>'accountType',''))) NOT BETWEEN 1 AND 64
   OR length(trim(coalesce(v_account->>'accountStatus',''))) NOT BETWEEN 1 AND 64 THEN RAISE EXCEPTION 'invalid Xero account directory'; END IF;
  INSERT INTO xero_v1.account_directories(connection_id,retrieved_at,account_id,account_name,account_type,account_status)
   VALUES(p_connection_id,p_directory_retrieved_at,trim(v_account->>'accountId'),trim(v_account->>'accountName'),trim(v_account->>'accountType'),trim(v_account->>'accountStatus'));
  v_directory_count:=v_directory_count+1;
 END LOOP;
 IF v_directory_count=0 OR v_directory_count>1000 THEN RAISE EXCEPTION 'bounded Xero account directory required'; END IF;
 INSERT INTO xero_v1.mapping_versions(connection_id,version,effective_from,confirmed_by,confirmed_at,directory_retrieved_at)
  VALUES(p_connection_id,1,p_effective_from,p_owner_id,now(),p_directory_retrieved_at) RETURNING id INTO v_mapping;
 FOR v_selection IN SELECT value FROM jsonb_array_elements(p_mapping) LOOP
  IF jsonb_typeof(v_selection)<>'object' OR (v_selection ?& ARRAY['category','accountId']) IS FALSE
   OR (SELECT count(*) FROM jsonb_object_keys(v_selection))<>2 THEN RAISE EXCEPTION 'invalid Xero mapping selection'; END IF;
  v_category:=v_selection->>'category';v_account_id:=trim(coalesce(v_selection->>'accountId',''));
  IF v_category NOT IN ('revenue','processingFee','advertising','software','includedCash') OR length(v_account_id) NOT BETWEEN 1 AND 256
   OR NOT EXISTS(SELECT 1 FROM xero_v1.account_directories ad WHERE ad.connection_id=p_connection_id AND ad.retrieved_at=p_directory_retrieved_at AND ad.account_id=v_account_id AND ad.account_status='ACTIVE')
   THEN RAISE EXCEPTION 'invalid active Xero mapping selection'; END IF;
  INSERT INTO xero_v1.mapping_selections(mapping_version_id,category,account_id) VALUES(v_mapping,v_category,v_account_id);v_mapping_count:=v_mapping_count+1;
 END LOOP;
 IF v_mapping_count<5 OR v_mapping_count>100 OR (SELECT count(DISTINCT ms.category) FROM xero_v1.mapping_selections ms WHERE ms.mapping_version_id=v_mapping)<>5
  THEN RAISE EXCEPTION 'complete Xero mapping required'; END IF;
 INSERT INTO xero_v1.mapping_audit(connection_id,mapping_version_id,action,actor_id) VALUES(p_connection_id,v_mapping,'confirmed',p_owner_id);
 INSERT INTO xero_v1.credential_envelopes(connection_id,ciphertext,encrypted_dek,key_version,algorithm,version,rotated_at)
  VALUES(p_connection_id,p_ciphertext,p_encrypted_dek,p_key_version,p_algorithm,1,now());
 INSERT INTO xero_v1.credential_audit(connection_id,actor_id,action) VALUES(p_connection_id,p_owner_id,'credential_stored');
 RETURN QUERY SELECT p_connection_id,v_mapping;
END $$;

REVOKE ALL ON FUNCTION xero_v1.bootstrap_create_initial_connection(uuid,uuid,text,uuid,date,timestamptz,jsonb,jsonb,bytea,bytea,text,text) FROM PUBLIC,anon,authenticated,night_scout_import_login;
GRANT EXECUTE ON FUNCTION xero_v1.bootstrap_create_initial_connection(uuid,uuid,text,uuid,date,timestamptz,jsonb,jsonb,bytea,bytea,text,text) TO night_scout_xero_bootstrap_login;
REVOKE ALL ON FUNCTION xero_v1.bootstrap_create_initial_connection(uuid,text,uuid,date,timestamptz,jsonb,jsonb,bytea,bytea,text,text) FROM night_scout_xero_bootstrap_login;
DROP FUNCTION xero_v1.bootstrap_create_initial_connection(uuid,text,uuid,date,timestamptz,jsonb,jsonb,bytea,bytea,text,text);

-- The scheduled worker derives its complete refresh context from persisted,
-- reviewed state rather than environment-supplied mapping values.
CREATE FUNCTION xero_v1.worker_get_refresh_context(p_connection_id uuid,p_mapping_version_id uuid)
RETURNS TABLE(connection_id uuid,tenant_id text,mapping_version_id uuid,mapping jsonb,
 ciphertext bytea,encrypted_dek bytea,key_version text,algorithm text,version integer,lease_expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=pg_catalog,xero_v1 AS $$
BEGIN
 IF session_user<>'night_scout_import_login' THEN RAISE EXCEPTION 'Xero worker capability required'; END IF;
 RETURN QUERY
 SELECT c.id,c.tenant_id,mv.id,
  (SELECT jsonb_object_agg(grouped.category,grouped.account_ids) FROM
    (SELECT ms.category,jsonb_agg(ms.account_id ORDER BY ms.account_id) account_ids
     FROM xero_v1.mapping_selections ms WHERE ms.mapping_version_id=mv.id GROUP BY ms.category) grouped),
  ce.ciphertext,ce.encrypted_dek,ce.key_version,ce.algorithm,ce.version,ce.lease_expires_at
 FROM xero_v1.connections c JOIN xero_v1.mapping_versions mv ON mv.connection_id=c.id
 JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id
 WHERE c.id=p_connection_id AND mv.id=p_mapping_version_id AND c.retired_at IS NULL;
END $$;

CREATE FUNCTION xero_v1.worker_get_latest_supported_evidence(
 p_connection_id uuid,p_mapping_version_id uuid,p_scope_from date,p_scope_to date,
 p_currency text,p_closed_period boolean)
RETURNS TABLE(evidence_id uuid,report_as_of date,retrieved_at timestamptz,source_fingerprint text,
 booked_revenue_minor bigint,processing_fee_minor bigint,advertising_minor bigint,software_minor bigint,included_cash_minor bigint)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=pg_catalog,xero_v1 AS $$
BEGIN
 IF session_user<>'night_scout_import_login' THEN RAISE EXCEPTION 'Xero worker capability required'; END IF;
 RETURN QUERY SELECT ae.id,ae.report_as_of,ae.retrieved_at,ae.source_fingerprint,
  ae.booked_revenue_minor,ae.processing_fee_minor,ae.advertising_minor,ae.software_minor,ae.included_cash_minor
 FROM xero_v1.accounting_evidence ae
 WHERE ae.connection_id=p_connection_id AND ae.mapping_version_id=p_mapping_version_id
  AND ae.scope_from=p_scope_from AND ae.scope_to=p_scope_to AND ae.currency=p_currency
  AND ae.closed_period=p_closed_period AND ae.state='supported'
 ORDER BY ae.created_at DESC,ae.id DESC LIMIT 1;
END $$;

-- A single atomic update closes the read/refresh/rotate race. The scheduled
-- worker must acquire before decrypting and release after any pre-rotation
-- failure. The fenced rotation below advances exactly one version and clears
-- the lease. Millisecond precision survives node-postgres Date round-trips.
CREATE FUNCTION xero_v1.worker_acquire_refresh_lease(
 p_connection_id uuid,p_expected_version integer,p_lease_seconds integer)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,xero_v1 AS $$
DECLARE acquired_until timestamptz;
BEGIN
 IF session_user<>'night_scout_import_login' THEN RAISE EXCEPTION 'Xero worker capability required'; END IF;
 IF p_connection_id IS NULL OR p_expected_version<1 OR p_lease_seconds NOT BETWEEN 30 AND 300 THEN
  RAISE EXCEPTION 'invalid Xero refresh lease request'; END IF;
 UPDATE xero_v1.credential_envelopes e SET lease_expires_at=date_trunc('milliseconds',clock_timestamp()+make_interval(secs=>p_lease_seconds))
 FROM xero_v1.connections c
 WHERE e.connection_id=p_connection_id AND e.version=p_expected_version
  AND c.id=e.connection_id AND c.retired_at IS NULL
  AND (e.lease_expires_at IS NULL OR e.lease_expires_at<=clock_timestamp())
 RETURNING e.lease_expires_at INTO acquired_until;
 RETURN acquired_until;
END $$;

CREATE FUNCTION xero_v1.worker_release_refresh_lease(
 p_connection_id uuid,p_expected_version integer,p_expected_lease_expires_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,xero_v1 AS $$
DECLARE released uuid;
BEGIN
 IF session_user<>'night_scout_import_login' THEN RAISE EXCEPTION 'Xero worker capability required'; END IF;
 IF p_connection_id IS NULL OR p_expected_version<1 OR p_expected_lease_expires_at IS NULL THEN RAISE EXCEPTION 'invalid Xero refresh lease request'; END IF;
 UPDATE xero_v1.credential_envelopes SET lease_expires_at=NULL
 WHERE connection_id=p_connection_id AND version=p_expected_version AND lease_expires_at=p_expected_lease_expires_at
 RETURNING connection_id INTO released;
 RETURN released IS NOT NULL;
END $$;

CREATE FUNCTION xero_v1.worker_store_refresh_envelope_leased(
 p_connection_id uuid,p_ciphertext bytea,p_encrypted_dek bytea,p_key_version text,p_algorithm text,
 p_expected_version integer,p_new_version integer,p_expected_lease_expires_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,xero_v1 AS $$
DECLARE stored uuid;
BEGIN
 IF session_user<>'night_scout_import_login' THEN RAISE EXCEPTION 'Xero worker capability required'; END IF;
 IF p_connection_id IS NULL OR p_algorithm<>'AES-256-GCM'
  OR octet_length(p_ciphertext) NOT BETWEEN 1 AND 16384 OR octet_length(p_encrypted_dek) NOT BETWEEN 1 AND 16384
  OR p_key_version !~ '^[A-Za-z0-9._-]{1,128}$' OR p_expected_version<1
  OR p_new_version<>p_expected_version+1 OR p_expected_lease_expires_at IS NULL THEN
  RAISE EXCEPTION 'invalid encrypted credential envelope'; END IF;
 UPDATE xero_v1.credential_envelopes e SET ciphertext=p_ciphertext,encrypted_dek=p_encrypted_dek,
  key_version=p_key_version,algorithm=p_algorithm,version=p_new_version,rotated_at=now(),lease_expires_at=NULL
 FROM xero_v1.connections c WHERE e.connection_id=p_connection_id AND c.id=e.connection_id AND c.retired_at IS NULL
  AND e.version=p_expected_version AND e.lease_expires_at=p_expected_lease_expires_at
  AND e.lease_expires_at>clock_timestamp() RETURNING e.connection_id INTO stored;
 IF stored IS NOT NULL THEN
  INSERT INTO xero_v1.credential_audit(connection_id,action) VALUES(p_connection_id,'credential_rotated');
 END IF;
 RETURN stored IS NOT NULL;
END $$;

REVOKE ALL ON FUNCTION xero_v1.worker_get_refresh_context(uuid,uuid) FROM PUBLIC,anon,authenticated,night_scout_xero_bootstrap_login;
REVOKE ALL ON FUNCTION xero_v1.worker_get_latest_supported_evidence(uuid,uuid,date,date,text,boolean) FROM PUBLIC,anon,authenticated,night_scout_xero_bootstrap_login;
REVOKE ALL ON FUNCTION xero_v1.worker_acquire_refresh_lease(uuid,integer,integer) FROM PUBLIC,anon,authenticated,night_scout_xero_bootstrap_login;
REVOKE ALL ON FUNCTION xero_v1.worker_release_refresh_lease(uuid,integer,timestamptz) FROM PUBLIC,anon,authenticated,night_scout_xero_bootstrap_login;
REVOKE ALL ON FUNCTION xero_v1.worker_store_refresh_envelope_leased(uuid,bytea,bytea,text,text,integer,integer,timestamptz) FROM PUBLIC,anon,authenticated,night_scout_xero_bootstrap_login;
REVOKE EXECUTE ON FUNCTION xero_v1.worker_store_refresh_envelope(uuid,bytea,bytea,text,text,integer,timestamptz) FROM night_scout_import_login;
GRANT EXECUTE ON FUNCTION xero_v1.worker_get_refresh_context(uuid,uuid) TO night_scout_import_login;
GRANT EXECUTE ON FUNCTION xero_v1.worker_get_latest_supported_evidence(uuid,uuid,date,date,text,boolean) TO night_scout_import_login;
GRANT EXECUTE ON FUNCTION xero_v1.worker_acquire_refresh_lease(uuid,integer,integer) TO night_scout_import_login;
GRANT EXECUTE ON FUNCTION xero_v1.worker_release_refresh_lease(uuid,integer,timestamptz) TO night_scout_import_login;
GRANT EXECUTE ON FUNCTION xero_v1.worker_store_refresh_envelope_leased(uuid,bytea,bytea,text,text,integer,integer,timestamptz) TO night_scout_import_login;
COMMIT;
