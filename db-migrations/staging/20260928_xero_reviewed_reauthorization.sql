-- STAGING ONLY. Operator-reviewed, one-shot replacement of the encrypted
-- credential on the existing Xero connection after the live tenant preflight
-- returned reconnect_required. Existing connection, mapping, evidence and
-- audit rows remain in place.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog,xero_v1,public;

DO $$
DECLARE v_connection uuid;v_owner uuid;v_failure uuid;v_failures integer;v_retries integer;v_consumed integer;
BEGIN
 IF current_user IN ('night_scout_import_login','night_scout_xero_bootstrap_login') THEN
  RAISE EXCEPTION 'run as the staging migration owner, never as an application login';
 END IF;
 IF to_regclass('xero_v1.xero_reauthorization_authorizations') IS NOT NULL
  OR to_regprocedure('xero_v1.bootstrap_get_reauthorization_target(uuid,text,uuid)') IS NOT NULL
  OR to_regprocedure('xero_v1.bootstrap_reauthorize_connection(uuid,uuid,text,uuid,integer,bytea,bytea,text,text)') IS NOT NULL THEN
  RAISE EXCEPTION 'reviewed Xero reauthorization already installed; stop and review';
 END IF;
 SELECT count(*),(array_agg(ae.connection_id))[1],(array_agg(ae.id))[1],(array_agg(mv.confirmed_by))[1]
 INTO v_failures,v_connection,v_failure,v_owner
 FROM xero_v1.accounting_evidence ae
 JOIN xero_v1.connections c ON c.id=ae.connection_id AND c.retired_at IS NULL
 JOIN xero_v1.mapping_versions mv ON mv.id=ae.mapping_version_id AND mv.connection_id=ae.connection_id
 WHERE ae.scope_from=date '2026-09-01' AND ae.scope_to=date '2026-09-25'
  AND ae.currency='GBP' AND ae.closed_period=false AND ae.state='failed'
  AND ae.reason='source_refresh_failed'
  AND ae.id=(SELECT newest.id FROM xero_v1.accounting_evidence newest
             WHERE newest.connection_id=ae.connection_id AND newest.mapping_version_id=ae.mapping_version_id
              AND newest.scope_from=ae.scope_from AND newest.scope_to=ae.scope_to
              AND newest.currency=ae.currency AND newest.closed_period=ae.closed_period
             ORDER BY newest.created_at DESC,newest.id DESC LIMIT 1);
 IF v_failures<>1 OR v_owner IS NULL THEN RAISE EXCEPTION 'reviewed Xero reconnect target unavailable'; END IF;
 SELECT count(*),count(*) FILTER(WHERE consumed_at IS NOT NULL)
 INTO v_retries,v_consumed FROM xero_v1.accounting_evidence_retry_authorizations;
 IF v_retries<>2 OR v_consumed<>2 THEN RAISE EXCEPTION 'reviewed Xero retries are not fully consumed'; END IF;
 CREATE TABLE xero_v1.xero_reauthorization_authorizations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),connection_id uuid NOT NULL REFERENCES xero_v1.connections(id),
  failure_evidence_id uuid NOT NULL UNIQUE REFERENCES xero_v1.accounting_evidence(id),
  allowed_owner_id uuid NOT NULL REFERENCES auth.users(id),authorized_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  consumed_at timestamptz,replacement_version integer CHECK(replacement_version IS NULL OR replacement_version>1),
  UNIQUE(connection_id),CHECK((consumed_at IS NULL AND replacement_version IS NULL) OR (consumed_at IS NOT NULL AND replacement_version IS NOT NULL))
 );
 INSERT INTO xero_v1.xero_reauthorization_authorizations(connection_id,failure_evidence_id,allowed_owner_id)
 VALUES(v_connection,v_failure,v_owner);
END $$;

ALTER TABLE xero_v1.xero_reauthorization_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON xero_v1.xero_reauthorization_authorizations FROM PUBLIC,anon,authenticated,night_scout_import_login,night_scout_xero_bootstrap_login;

CREATE FUNCTION xero_v1.bootstrap_get_reauthorization_target(p_store_id uuid,p_tenant_id text,p_owner_id uuid)
RETURNS TABLE(connection_id uuid,credential_version integer)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=pg_catalog,xero_v1,public AS $$
BEGIN
 IF session_user<>'night_scout_xero_bootstrap_login' THEN RAISE EXCEPTION 'Xero bootstrap capability required'; END IF;
 IF p_store_id IS NULL OR p_owner_id IS NULL OR length(trim(coalesce(p_tenant_id,''))) NOT BETWEEN 1 AND 256 THEN
  RAISE EXCEPTION 'invalid Xero reauthorization target'; END IF;
 RETURN QUERY SELECT c.id,ce.version
 FROM xero_v1.xero_reauthorization_authorizations ra
 JOIN xero_v1.connections c ON c.id=ra.connection_id AND c.retired_at IS NULL
 JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id
 WHERE ra.consumed_at IS NULL AND ra.allowed_owner_id=p_owner_id
  AND c.store_id=p_store_id AND c.tenant_id=trim(p_tenant_id)
  AND EXISTS(SELECT 1 FROM public.store_memberships sm WHERE sm.user_id=p_owner_id AND sm.store_id=p_store_id);
END $$;

CREATE FUNCTION xero_v1.bootstrap_reauthorize_connection(
 p_connection_id uuid,p_store_id uuid,p_tenant_id text,p_owner_id uuid,p_expected_version integer,
 p_ciphertext bytea,p_encrypted_dek bytea,p_key_version text,p_algorithm text)
RETURNS TABLE(connection_id uuid,credential_version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,xero_v1,public AS $$
DECLARE v_authorization uuid;v_new_version integer;
BEGIN
 IF session_user<>'night_scout_xero_bootstrap_login' THEN RAISE EXCEPTION 'Xero bootstrap capability required'; END IF;
 IF p_connection_id IS NULL OR p_store_id IS NULL OR p_owner_id IS NULL OR p_expected_version<1
  OR length(trim(coalesce(p_tenant_id,''))) NOT BETWEEN 1 AND 256 OR p_algorithm<>'AES-256-GCM'
  OR octet_length(p_ciphertext) NOT BETWEEN 1 AND 16384 OR octet_length(p_encrypted_dek) NOT BETWEEN 1 AND 16384
  OR p_key_version !~ '^[A-Za-z0-9._-]{1,128}$' THEN RAISE EXCEPTION 'invalid Xero reauthorization input'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.store_memberships sm WHERE sm.user_id=p_owner_id AND sm.store_id=p_store_id) THEN
  RAISE EXCEPTION 'Xero reauthorization store membership required'; END IF;
 SELECT ra.id INTO v_authorization FROM xero_v1.xero_reauthorization_authorizations ra
 JOIN xero_v1.connections c ON c.id=ra.connection_id
 WHERE ra.connection_id=p_connection_id AND ra.allowed_owner_id=p_owner_id AND ra.consumed_at IS NULL
  AND c.store_id=p_store_id AND c.tenant_id=trim(p_tenant_id) AND c.retired_at IS NULL FOR UPDATE OF ra;
 IF v_authorization IS NULL THEN RAISE EXCEPTION 'Xero reauthorization unavailable'; END IF;
 v_new_version:=p_expected_version+1;
 UPDATE xero_v1.credential_envelopes ce SET ciphertext=p_ciphertext,encrypted_dek=p_encrypted_dek,
  key_version=p_key_version,algorithm=p_algorithm,version=v_new_version,rotated_at=clock_timestamp(),lease_expires_at=NULL
 WHERE ce.connection_id=p_connection_id AND ce.version=p_expected_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Xero reauthorization unavailable'; END IF;
 UPDATE xero_v1.xero_reauthorization_authorizations SET consumed_at=clock_timestamp(),replacement_version=v_new_version
 WHERE id=v_authorization AND consumed_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Xero reauthorization unavailable'; END IF;
 INSERT INTO xero_v1.credential_audit(connection_id,actor_id,action)
 VALUES(p_connection_id,p_owner_id,'credential_rotated');
 RETURN QUERY SELECT p_connection_id,v_new_version;
END $$;

REVOKE ALL ON FUNCTION xero_v1.bootstrap_get_reauthorization_target(uuid,text,uuid) FROM PUBLIC,anon,authenticated,night_scout_import_login;
REVOKE ALL ON FUNCTION xero_v1.bootstrap_reauthorize_connection(uuid,uuid,text,uuid,integer,bytea,bytea,text,text) FROM PUBLIC,anon,authenticated,night_scout_import_login;
GRANT EXECUTE ON FUNCTION xero_v1.bootstrap_get_reauthorization_target(uuid,text,uuid) TO night_scout_xero_bootstrap_login;
GRANT EXECUTE ON FUNCTION xero_v1.bootstrap_reauthorize_connection(uuid,uuid,text,uuid,integer,bytea,bytea,text,text) TO night_scout_xero_bootstrap_login;

-- Preserve the established merchant JSON contract while making the pending
-- reviewed reauthorization visible to its owning store. Merely retaining an
-- old envelope must not make a provider-rejected connection appear active.
CREATE OR REPLACE FUNCTION public.xero_merchant_readiness(p_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path=pg_catalog,public,xero_v1 AS $$
DECLARE v_user uuid:=(SELECT auth.uid());v_connection xero_v1.connections%ROWTYPE;v_mapping xero_v1.mapping_versions%ROWTYPE;
 v_last_success timestamptz;v_last_failure timestamptz;v_latest_state text;v_latest_at timestamptz;v_review boolean:=false;v_reauthorization boolean:=false;
BEGIN
 IF v_user IS NULL OR p_store_id IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.store_memberships sm WHERE sm.user_id=v_user AND sm.store_id=p_store_id
 ) THEN RAISE EXCEPTION 'Xero readiness access denied'; END IF;
 SELECT * INTO v_connection FROM xero_v1.connections c WHERE c.store_id=p_store_id AND c.retired_at IS NULL ORDER BY c.created_at DESC LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('storeId',p_store_id,'connection',NULL,'evidenceState',NULL,'evidenceRetrievedAt',NULL); END IF;
 SELECT * INTO v_mapping FROM xero_v1.mapping_versions mv WHERE mv.connection_id=v_connection.id ORDER BY mv.version DESC LIMIT 1;
 v_review:=v_mapping.id IS NULL OR EXISTS(SELECT 1 FROM xero_v1.mapping_audit ma WHERE ma.connection_id=v_connection.id AND ma.action='review_required' AND ma.occurred_at>coalesce(v_mapping.confirmed_at,'-infinity'::timestamptz));
 v_reauthorization:=EXISTS(SELECT 1 FROM xero_v1.xero_reauthorization_authorizations ra WHERE ra.connection_id=v_connection.id AND ra.consumed_at IS NULL);
 SELECT max(ae.retrieved_at) FILTER(WHERE ae.state='supported'),max(ae.retrieved_at) FILTER(WHERE ae.state<>'supported')
 INTO v_last_success,v_last_failure FROM xero_v1.accounting_evidence ae WHERE ae.connection_id=v_connection.id;
 SELECT ae.state,ae.retrieved_at INTO v_latest_state,v_latest_at FROM xero_v1.accounting_evidence ae WHERE ae.connection_id=v_connection.id ORDER BY ae.created_at DESC LIMIT 1;
 RETURN jsonb_build_object(
  'storeId',p_store_id,
  'connection',jsonb_build_object('status',CASE WHEN v_reauthorization THEN 'reauthorization_required' WHEN EXISTS(SELECT 1 FROM xero_v1.credential_envelopes ce WHERE ce.connection_id=v_connection.id) THEN 'active' ELSE 'reauthorization_required' END,
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
