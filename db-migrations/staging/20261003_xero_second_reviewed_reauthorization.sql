-- STAGING ONLY. One-shot second reauthorization, bound to the latest exact
-- reconnect_required connection-preflight receipt. Existing connection,
-- mapping, evidence, authorization and audit history remains immutable.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';SET LOCAL search_path=pg_catalog,xero_v1,public;
DO $$
DECLARE v_connection uuid;v_owner uuid;v_preflight uuid;v_version integer;v_matches integer;v_prior integer;v_consumed integer;v_retries integer;v_retries_consumed integer;
BEGIN
 IF current_user IN ('night_scout_import_login','night_scout_xero_bootstrap_login') THEN RAISE EXCEPTION 'migration owner required'; END IF;
 IF to_regclass('xero_v1.xero_second_reauthorization_authorizations') IS NOT NULL THEN RAISE EXCEPTION 'second Xero reauthorization already installed'; END IF;
 SELECT count(*),(array_agg(pe.connection_id))[1],(array_agg(pe.id))[1],(array_agg(pe.credential_version))[1],(array_agg(mv.confirmed_by))[1]
 INTO v_matches,v_connection,v_preflight,v_version,v_owner
 FROM xero_v1.connection_preflight_evidence pe
 JOIN xero_v1.connections c ON c.id=pe.connection_id AND c.retired_at IS NULL
 JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id AND ce.version=pe.credential_version AND (ce.lease_expires_at IS NULL OR ce.lease_expires_at<=clock_timestamp())
 JOIN xero_v1.mapping_versions mv ON mv.connection_id=c.id AND mv.version=(SELECT max(n.version) FROM xero_v1.mapping_versions n WHERE n.connection_id=c.id)
 WHERE pe.outcome='failed' AND pe.phase='connection' AND pe.reason='reconnect_required' AND pe.tenant_visible=false
  AND pe.id=(SELECT n.id FROM xero_v1.connection_preflight_evidence n WHERE n.connection_id=pe.connection_id ORDER BY n.checked_at DESC,n.id DESC LIMIT 1)
  AND NOT EXISTS(SELECT 1 FROM xero_v1.connection_preflight_evidence n WHERE n.connection_id=pe.connection_id AND n.outcome='connected' AND (n.checked_at,n.id)>(pe.checked_at,pe.id));
 IF v_matches<>1 OR v_owner IS NULL OR v_version<2 THEN RAISE EXCEPTION 'reviewed reconnect preflight unavailable'; END IF;
 SELECT count(*),count(*) FILTER(WHERE consumed_at IS NOT NULL) INTO v_prior,v_consumed FROM xero_v1.xero_reauthorization_authorizations WHERE connection_id=v_connection;
 IF v_prior<>1 OR v_consumed<>1 THEN RAISE EXCEPTION 'prior Xero reauthorization unavailable'; END IF;
 SELECT count(*),count(*) FILTER(WHERE consumed_at IS NOT NULL) INTO v_retries,v_retries_consumed FROM xero_v1.accounting_evidence_retry_authorizations;
 IF v_retries<>3 OR v_retries_consumed<>3 THEN RAISE EXCEPTION 'reviewed Xero retries unavailable'; END IF;
 CREATE TABLE xero_v1.xero_second_reauthorization_authorizations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),connection_id uuid NOT NULL UNIQUE REFERENCES xero_v1.connections(id),
  preflight_evidence_id uuid NOT NULL UNIQUE REFERENCES xero_v1.connection_preflight_evidence(id),allowed_owner_id uuid NOT NULL REFERENCES auth.users(id),
  target_credential_version integer NOT NULL CHECK(target_credential_version>1),authorized_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  consumed_at timestamptz,replacement_version integer CHECK(replacement_version IS NULL OR replacement_version=target_credential_version+1),
  CHECK((consumed_at IS NULL AND replacement_version IS NULL) OR (consumed_at IS NOT NULL AND replacement_version IS NOT NULL)));
 INSERT INTO xero_v1.xero_second_reauthorization_authorizations(connection_id,preflight_evidence_id,allowed_owner_id,target_credential_version) VALUES(v_connection,v_preflight,v_owner,v_version);
END $$;
ALTER TABLE xero_v1.xero_second_reauthorization_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON xero_v1.xero_second_reauthorization_authorizations FROM PUBLIC,anon,authenticated,service_role,night_scout_import_login,night_scout_xero_bootstrap_login;

CREATE OR REPLACE FUNCTION xero_v1.bootstrap_get_reauthorization_target(p_store_id uuid,p_tenant_id text,p_owner_id uuid)
RETURNS TABLE(connection_id uuid,credential_version integer) LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=pg_catalog,xero_v1,public AS $$
BEGIN
 IF session_user<>'night_scout_xero_bootstrap_login' THEN RAISE EXCEPTION 'Xero bootstrap capability required'; END IF;
 IF p_store_id IS NULL OR p_owner_id IS NULL OR length(trim(coalesce(p_tenant_id,''))) NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION 'invalid Xero reauthorization target'; END IF;
 RETURN QUERY SELECT c.id,ce.version FROM xero_v1.xero_second_reauthorization_authorizations ra
 JOIN xero_v1.connections c ON c.id=ra.connection_id AND c.retired_at IS NULL
 JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id AND ce.version=ra.target_credential_version AND (ce.lease_expires_at IS NULL OR ce.lease_expires_at<=clock_timestamp())
 WHERE ra.consumed_at IS NULL AND ra.allowed_owner_id=p_owner_id AND c.store_id=p_store_id AND c.tenant_id=trim(p_tenant_id)
  AND EXISTS(SELECT 1 FROM public.store_memberships sm WHERE sm.user_id=p_owner_id AND sm.store_id=p_store_id);
END $$;

CREATE OR REPLACE FUNCTION xero_v1.bootstrap_reauthorize_connection(p_connection_id uuid,p_store_id uuid,p_tenant_id text,p_owner_id uuid,p_expected_version integer,p_ciphertext bytea,p_encrypted_dek bytea,p_key_version text,p_algorithm text)
RETURNS TABLE(connection_id uuid,credential_version integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,xero_v1,public AS $$
DECLARE v_authorization uuid;v_new_version integer;
BEGIN
 IF session_user<>'night_scout_xero_bootstrap_login' THEN RAISE EXCEPTION 'Xero bootstrap capability required'; END IF;
 IF p_connection_id IS NULL OR p_store_id IS NULL OR p_owner_id IS NULL OR p_expected_version<2 OR length(trim(coalesce(p_tenant_id,''))) NOT BETWEEN 1 AND 256 OR p_algorithm<>'AES-256-GCM' OR octet_length(p_ciphertext) NOT BETWEEN 1 AND 16384 OR octet_length(p_encrypted_dek) NOT BETWEEN 1 AND 16384 OR p_key_version !~ '^[A-Za-z0-9._-]{1,128}$' THEN RAISE EXCEPTION 'invalid Xero reauthorization input'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.store_memberships WHERE user_id=p_owner_id AND store_id=p_store_id) THEN RAISE EXCEPTION 'Xero reauthorization store membership required'; END IF;
 SELECT ra.id INTO v_authorization FROM xero_v1.xero_second_reauthorization_authorizations ra JOIN xero_v1.connections c ON c.id=ra.connection_id
 WHERE ra.connection_id=p_connection_id AND ra.allowed_owner_id=p_owner_id AND ra.consumed_at IS NULL AND ra.target_credential_version=p_expected_version
  AND c.store_id=p_store_id AND c.tenant_id=trim(p_tenant_id) AND c.retired_at IS NULL FOR UPDATE OF ra;
 IF v_authorization IS NULL THEN RAISE EXCEPTION 'Xero reauthorization unavailable'; END IF;
 v_new_version:=p_expected_version+1;
 UPDATE xero_v1.credential_envelopes ce SET ciphertext=p_ciphertext,encrypted_dek=p_encrypted_dek,key_version=p_key_version,algorithm=p_algorithm,version=v_new_version,rotated_at=clock_timestamp(),lease_expires_at=NULL
 WHERE ce.connection_id=p_connection_id AND ce.version=p_expected_version AND (ce.lease_expires_at IS NULL OR ce.lease_expires_at<=clock_timestamp());
 IF NOT FOUND THEN RAISE EXCEPTION 'Xero reauthorization unavailable'; END IF;
 UPDATE xero_v1.xero_second_reauthorization_authorizations SET consumed_at=clock_timestamp(),replacement_version=v_new_version WHERE id=v_authorization AND consumed_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Xero reauthorization unavailable'; END IF;
 INSERT INTO xero_v1.credential_audit(connection_id,actor_id,action) VALUES(p_connection_id,p_owner_id,'credential_rotated');
 RETURN QUERY SELECT p_connection_id,v_new_version;
END $$;
REVOKE ALL ON FUNCTION xero_v1.bootstrap_get_reauthorization_target(uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role,night_scout_import_login;
REVOKE ALL ON FUNCTION xero_v1.bootstrap_reauthorize_connection(uuid,uuid,text,uuid,integer,bytea,bytea,text,text) FROM PUBLIC,anon,authenticated,service_role,night_scout_import_login;
GRANT EXECUTE ON FUNCTION xero_v1.bootstrap_get_reauthorization_target(uuid,text,uuid) TO night_scout_xero_bootstrap_login;
GRANT EXECUTE ON FUNCTION xero_v1.bootstrap_reauthorize_connection(uuid,uuid,text,uuid,integer,bytea,bytea,text,text) TO night_scout_xero_bootstrap_login;

DO $$ DECLARE d text;BEGIN d:=pg_get_functiondef('public.xero_merchant_readiness(uuid)'::regprocedure);d:=replace(d,'FROM xero_v1.xero_reauthorization_authorizations ra WHERE ra.connection_id=v_connection.id AND ra.consumed_at IS NULL','FROM xero_v1.xero_reauthorization_authorizations ra WHERE ra.connection_id=v_connection.id AND ra.consumed_at IS NULL) OR EXISTS(SELECT 1 FROM xero_v1.xero_second_reauthorization_authorizations ra WHERE ra.connection_id=v_connection.id AND ra.consumed_at IS NULL');IF strpos(d,'xero_second_reauthorization_authorizations')=0 THEN RAISE EXCEPTION 'readiness definition mismatch';END IF;EXECUTE d;END $$;
REVOKE ALL ON FUNCTION public.xero_merchant_readiness(uuid) FROM PUBLIC,anon,authenticated,service_role,night_scout_xero_bootstrap_login,night_scout_import_login;GRANT EXECUTE ON FUNCTION public.xero_merchant_readiness(uuid) TO authenticated;
COMMIT;
