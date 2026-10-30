-- PROPOSAL ONLY: bounded same-connection Demo reader reauthorization.
-- No connection, tenant, mapping, evidence, schedule or writer changes.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE FUNCTION xero_demo_v1.bootstrap_get_reauthorization_context(p_owner_id uuid)
RETURNS TABLE(connection_id uuid,tenant_id text,key_version text,credential_version integer,mapping_version_id uuid,mapping jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,xero_demo_v1 AS $$
BEGIN
 IF session_user<>'night_scout_demo_bootstrap_login' OR p_owner_id IS NULL
 OR clock_timestamp()<'2026-10-30T00:00:00Z'::timestamptz OR clock_timestamp()>='2026-11-06T03:00:00Z'::timestamptz
 OR (SELECT count(*) FROM xero_demo_v1.connections c WHERE c.store_id='f59e3a44-7106-4df8-9c08-52da30c9de30'::uuid AND c.retired_at IS NULL)<>1
 OR (SELECT count(*) FROM public.store_memberships sm WHERE sm.store_id='f59e3a44-7106-4df8-9c08-52da30c9de30'::uuid)<>1
 OR NOT EXISTS(SELECT 1 FROM public.store_memberships sm WHERE sm.store_id='f59e3a44-7106-4df8-9c08-52da30c9de30'::uuid AND sm.user_id=p_owner_id)
 THEN RAISE EXCEPTION 'Demo reader reconnect unavailable'; END IF;
 RETURN QUERY SELECT c.id,c.tenant_id,e.key_version,e.version,m.id,
 (SELECT jsonb_agg(jsonb_build_object('category',s.category,'accountId',s.account_id) ORDER BY s.category,s.account_id) FROM xero_demo_v1.mapping_selections s WHERE s.mapping_version_id=m.id)
 FROM xero_demo_v1.connections c JOIN xero_demo_v1.credential_envelopes e ON e.connection_id=c.id
 JOIN LATERAL(SELECT mv.* FROM xero_demo_v1.mapping_versions mv WHERE mv.connection_id=c.id AND mv.effective_from<=current_date ORDER BY mv.effective_from DESC,mv.version DESC,mv.id DESC LIMIT 1) m ON true
 JOIN LATERAL(SELECT pe.* FROM xero_demo_v1.connection_preflight_evidence pe WHERE pe.connection_id=c.id ORDER BY pe.checked_at DESC,pe.id DESC LIMIT 1) p ON true
 WHERE c.store_id='f59e3a44-7106-4df8-9c08-52da30c9de30'::uuid AND c.retired_at IS NULL
 AND (e.lease_expires_at IS NULL OR e.lease_expires_at<=clock_timestamp())
 AND p.credential_version=e.version AND p.outcome='failed' AND p.phase='connection' AND p.reason='reconnect_required' AND p.tenant_visible IS FALSE
 AND isfinite(p.checked_at) AND p.checked_at<=clock_timestamp() AND p.checked_at>=clock_timestamp()-interval '1 hour'
 AND NOT EXISTS(SELECT 1 FROM xero_demo_v1.connection_preflight_evidence tied WHERE tied.connection_id=c.id AND tied.checked_at=p.checked_at AND (tied.outcome<>'failed' OR tied.phase<>'connection' OR tied.reason<>'reconnect_required' OR tied.credential_version<>e.version OR tied.tenant_visible IS DISTINCT FROM false));
END $$;
CREATE FUNCTION xero_demo_v1.bootstrap_replace_reauthorized_envelope(p_owner_id uuid,p_connection_id uuid,p_tenant_id text,p_expected_version integer,p_mapping_version_id uuid,p_ciphertext bytea,p_encrypted_dek bytea,p_key_version text,p_algorithm text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,xero_demo_v1 AS $$
DECLARE ctx record; proof jsonb; observed timestamptz;
BEGIN
 IF p_connection_id IS NULL OR p_tenant_id IS NULL OR p_expected_version IS NULL OR p_expected_version<1 OR p_mapping_version_id IS NULL
 OR p_algorithm IS DISTINCT FROM 'AES-256-GCM' OR p_key_version IS NULL OR p_key_version !~ '^[A-Za-z0-9._-]{1,128}$'
 OR p_ciphertext IS NULL OR octet_length(p_ciphertext) NOT BETWEEN 30 AND 16384 OR p_encrypted_dek IS NULL OR octet_length(p_encrypted_dek) NOT BETWEEN 30 AND 16384 THEN RAISE EXCEPTION 'Demo reader reconnect unavailable'; END IF;
 -- Serialize with the worker's existing envelope lease/version fences.
 PERFORM 1 FROM xero_demo_v1.credential_envelopes e WHERE e.connection_id=p_connection_id FOR UPDATE;
 SELECT * INTO STRICT ctx FROM xero_demo_v1.bootstrap_get_reauthorization_context(p_owner_id);
 IF ctx.connection_id<>p_connection_id OR ctx.tenant_id<>p_tenant_id OR ctx.credential_version<>p_expected_version OR ctx.mapping_version_id<>p_mapping_version_id OR ctx.key_version<>p_key_version THEN RAISE EXCEPTION 'Demo reader reconnect unavailable'; END IF;
 proof:=nullif(current_setting('night_scout.demo_reader_reauthorization_receipt',true),'')::jsonb;
 IF proof IS NULL OR jsonb_typeof(proof)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(proof))<>9
 OR proof->>'connectionId' IS DISTINCT FROM p_connection_id::text OR proof->>'storeId' IS DISTINCT FROM 'f59e3a44-7106-4df8-9c08-52da30c9de30'
 OR proof->>'ownerId' IS DISTINCT FROM p_owner_id::text OR proof->>'tenantId' IS DISTINCT FROM p_tenant_id
 OR proof->'isDemoCompany' IS DISTINCT FROM 'true'::jsonb OR proof->>'baseCurrency' IS DISTINCT FROM 'GBP'
 OR proof->>'expectedVersion' IS DISTINCT FROM p_expected_version::text OR proof->>'mappingVersionId' IS DISTINCT FROM p_mapping_version_id::text
 OR jsonb_typeof(proof->'observedAt') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Fresh same Demo source receipt required'; END IF;
 observed:=(proof->>'observedAt')::timestamptz;
 IF NOT isfinite(observed) OR observed>clock_timestamp() OR observed<clock_timestamp()-interval '5 minutes' THEN RAISE EXCEPTION 'Fresh same Demo source receipt required'; END IF;
 UPDATE xero_demo_v1.credential_envelopes SET ciphertext=p_ciphertext,encrypted_dek=p_encrypted_dek,algorithm=p_algorithm,version=p_expected_version+1,rotated_at=clock_timestamp()
 WHERE connection_id=p_connection_id AND version=p_expected_version AND key_version=p_key_version AND (lease_expires_at IS NULL OR lease_expires_at<=clock_timestamp());
 IF NOT FOUND THEN RAISE EXCEPTION 'Demo reader reconnect unavailable'; END IF;
 INSERT INTO xero_demo_v1.credential_audit(connection_id,actor_id,action) VALUES(p_connection_id,p_owner_id,'credential_rotated');
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION xero_demo_v1.bootstrap_get_reauthorization_context(uuid),xero_demo_v1.bootstrap_replace_reauthorized_envelope(uuid,uuid,text,integer,uuid,bytea,bytea,text,text) FROM PUBLIC,anon,authenticated,service_role,night_scout_demo_bootstrap_login,night_scout_demo_import_login,night_scout_demo_import_service;
GRANT EXECUTE ON FUNCTION xero_demo_v1.bootstrap_get_reauthorization_context(uuid),xero_demo_v1.bootstrap_replace_reauthorized_envelope(uuid,uuid,text,integer,uuid,bytea,bytea,text,text) TO night_scout_demo_bootstrap_service;
COMMIT;
