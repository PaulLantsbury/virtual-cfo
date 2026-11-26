-- PROPOSAL ONLY — companion to google-ads-spend-store-2026-11-21.sql.
-- Requires separately preprovisioned exact roles:
-- night_scout_google_ads_api_group (NOLOGIN) + night_scout_google_ads_api_login,
-- night_scout_google_ads_collector_group (NOLOGIN) +
-- night_scout_google_ads_collector_login. Each login is the exclusive member of
-- its matching group. Do not give these roles to browser/service roles or let
-- them own Google Ads objects. The logins get no direct table privileges; fixed
-- RPC grants are split by API and collector capability. Do not apply before review.
-- All callable functions are fixed-name SECURITY DEFINER RPCs. Browser roles
-- get no EXECUTE privileges.
BEGIN;

DO $$
BEGIN
  IF to_regclass('google_ads_v1.connections') IS NULL
     OR to_regclass('google_ads_v1.oauth_states') IS NULL
     OR to_regclass('google_ads_v1.credential_envelopes') IS NULL
     OR to_regclass('google_ads_v1.ad_accounts') IS NULL
     OR to_regclass('google_ads_v1.collection_runs') IS NULL
     OR to_regclass('google_ads_v1.daily_spend_observations') IS NULL
     OR to_regclass('google_ads_v1.credential_audit') IS NULL
     OR to_regclass('public.store_memberships') IS NULL THEN
    RAISE EXCEPTION 'Google Ads base schema prerequisites unavailable';
  END IF;
  IF to_regrole('anon') IS NULL OR to_regrole('authenticated') IS NULL THEN
    RAISE EXCEPTION 'Expected Supabase browser roles unavailable';
  END IF;
END $$;

DO $$
DECLARE api_group_oid oid; api_login_oid oid; collector_group_oid oid; collector_login_oid oid;
BEGIN
  SELECT oid INTO api_group_oid FROM pg_catalog.pg_roles WHERE rolname='night_scout_google_ads_api_group';
  SELECT oid INTO api_login_oid FROM pg_catalog.pg_roles WHERE rolname='night_scout_google_ads_api_login';
  SELECT oid INTO collector_group_oid FROM pg_catalog.pg_roles WHERE rolname='night_scout_google_ads_collector_group';
  SELECT oid INTO collector_login_oid FROM pg_catalog.pg_roles WHERE rolname='night_scout_google_ads_collector_login';
  IF api_group_oid IS NULL OR api_login_oid IS NULL OR collector_group_oid IS NULL OR collector_login_oid IS NULL THEN
    RAISE EXCEPTION 'Dedicated Google Ads API and collector roles must be provisioned before this proposal';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE oid IN (api_group_oid,collector_group_oid)
    AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Google Ads API/collector group role attributes are unsafe';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_roles WHERE oid IN (api_login_oid,collector_login_oid)
      AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
      AND NOT rolreplication AND NOT rolbypassrls AND rolinherit)<>2 THEN
    RAISE EXCEPTION 'Google Ads API/collector login role attributes are unsafe';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE roleid=api_group_oid AND member=api_login_oid)
    OR (SELECT count(*) FROM pg_catalog.pg_auth_members WHERE roleid=api_group_oid)<>1
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=api_login_oid AND roleid<>api_group_oid)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE roleid=collector_group_oid AND member=collector_login_oid)
    OR (SELECT count(*) FROM pg_catalog.pg_auth_members WHERE roleid=collector_group_oid)<>1
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=collector_login_oid AND roleid<>collector_group_oid)
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member IN (api_group_oid,collector_group_oid))
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE roleid IN (api_group_oid,collector_group_oid)
      AND member NOT IN (api_login_oid,collector_login_oid)) THEN
    RAISE EXCEPTION 'Google Ads API/collector role memberships are not exclusive';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspname='google_ads_v1'
      AND n.nspowner IN (api_group_oid,api_login_oid,collector_group_oid,collector_login_oid))
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='google_ads_v1' AND c.relowner IN (api_group_oid,api_login_oid,collector_group_oid,collector_login_oid))
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='google_ads_v1' AND p.proowner IN (api_group_oid,api_login_oid,collector_group_oid,collector_login_oid)) THEN
    RAISE EXCEPTION 'Google Ads API/collector roles must not own schema objects';
  END IF;
END $$;

-- Remove any access left by a prior draft's combined worker identity.
DO $$
BEGIN
  IF to_regrole('night_scout_google_ads_worker_group') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON SCHEMA google_ads_v1 FROM night_scout_google_ads_worker_group';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA google_ads_v1 FROM night_scout_google_ads_worker_group';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA google_ads_v1 FROM night_scout_google_ads_worker_group';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA google_ads_v1 FROM night_scout_google_ads_worker_group';
  END IF;
  IF to_regrole('night_scout_google_ads_worker_login') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON SCHEMA google_ads_v1 FROM night_scout_google_ads_worker_login';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA google_ads_v1 FROM night_scout_google_ads_worker_login';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA google_ads_v1 FROM night_scout_google_ads_worker_login';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA google_ads_v1 FROM night_scout_google_ads_worker_login';
  END IF;
END $$;

-- Neither login has direct object privileges. Schema usage is inherited only
-- through its own NOLOGIN group membership.
REVOKE CREATE ON SCHEMA google_ads_v1 FROM PUBLIC,night_scout_google_ads_api_group,night_scout_google_ads_api_login,
  night_scout_google_ads_collector_group,night_scout_google_ads_collector_login;
REVOKE ALL ON SCHEMA google_ads_v1 FROM night_scout_google_ads_api_group,night_scout_google_ads_api_login,
  night_scout_google_ads_collector_group,night_scout_google_ads_collector_login;
REVOKE ALL ON ALL TABLES IN SCHEMA google_ads_v1 FROM PUBLIC,night_scout_google_ads_api_group,night_scout_google_ads_api_login,
  night_scout_google_ads_collector_group,night_scout_google_ads_collector_login;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA google_ads_v1 FROM PUBLIC,night_scout_google_ads_api_group,night_scout_google_ads_api_login,
  night_scout_google_ads_collector_group,night_scout_google_ads_collector_login;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA google_ads_v1 FROM PUBLIC,night_scout_google_ads_api_group,night_scout_google_ads_api_login,
  night_scout_google_ads_collector_group,night_scout_google_ads_collector_login;
GRANT USAGE ON SCHEMA google_ads_v1 TO night_scout_google_ads_api_group,night_scout_google_ads_collector_group;

CREATE OR REPLACE FUNCTION google_ads_v1.worker_assert_login()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path=pg_catalog,google_ads_v1 AS $$
BEGIN
  IF NOT (
    (session_user='night_scout_google_ads_api_login'
      AND pg_has_role(session_user,'night_scout_google_ads_api_group','member'))
    OR
    (session_user='night_scout_google_ads_collector_login'
      AND pg_has_role(session_user,'night_scout_google_ads_collector_group','member'))
  ) THEN
    RAISE EXCEPTION 'Google Ads API or collector capability required';
  END IF;
END $$;
REVOKE ALL ON FUNCTION google_ads_v1.worker_assert_login()
  FROM PUBLIC,anon,authenticated,night_scout_google_ads_api_group,night_scout_google_ads_api_login,
    night_scout_google_ads_collector_group,night_scout_google_ads_collector_login;

CREATE OR REPLACE FUNCTION google_ads_v1.worker_create_oauth_state(
  p_state_digest bytea,p_user_id uuid,p_store_id uuid,p_expires_at timestamptz
) RETURNS TABLE(created boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,google_ads_v1 AS $$
BEGIN
  PERFORM google_ads_v1.worker_assert_login();
  IF p_state_digest IS NULL OR octet_length(p_state_digest)<>32 OR p_user_id IS NULL OR p_store_id IS NULL
    OR p_expires_at IS NULL OR p_expires_at<=clock_timestamp()
    OR p_expires_at>clock_timestamp()+interval '10 minutes 30 seconds'
    OR NOT EXISTS(SELECT 1 FROM public.store_memberships sm WHERE sm.user_id=p_user_id AND sm.store_id=p_store_id) THEN
    RAISE EXCEPTION 'Google Ads OAuth state unavailable';
  END IF;
  INSERT INTO google_ads_v1.oauth_states(state_digest,user_id,store_id,expires_at)
  VALUES(p_state_digest,p_user_id,p_store_id,p_expires_at);
  RETURN QUERY SELECT true;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Google Ads OAuth state unavailable';
END $$;

CREATE OR REPLACE FUNCTION google_ads_v1.worker_consume_oauth_state(
  p_state_digest bytea,p_now timestamptz
) RETURNS TABLE(user_id uuid,store_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,google_ads_v1 AS $$
BEGIN
  PERFORM google_ads_v1.worker_assert_login();
  IF p_state_digest IS NULL OR octet_length(p_state_digest)<>32 OR p_now IS NULL
    OR abs(extract(epoch FROM (clock_timestamp()-p_now)))>60 THEN
    RAISE EXCEPTION 'Google Ads OAuth state unavailable';
  END IF;
  RETURN QUERY
    UPDATE google_ads_v1.oauth_states s SET consumed_at=clock_timestamp()
    WHERE s.state_digest=p_state_digest AND s.consumed_at IS NULL AND s.expires_at>clock_timestamp()
      AND EXISTS(SELECT 1 FROM public.store_memberships sm WHERE sm.user_id=s.user_id AND sm.store_id=s.store_id)
    RETURNING s.user_id,s.store_id;
END $$;

CREATE OR REPLACE FUNCTION google_ads_v1.worker_create_pending_connection(
  p_connection_id uuid,p_user_id uuid,p_store_id uuid,p_granted_scope text[],p_oauth_app_publishing_status text,
  p_ciphertext bytea,p_encrypted_dek bytea,p_key_version text,p_algorithm text,
  p_selection_handle_digest bytea,p_selection_expires_at timestamptz,p_accounts jsonb
) RETURNS TABLE(created boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,google_ads_v1 AS $$
DECLARE account_count integer; distinct_count integer; actual_now timestamptz;
  credential_expiry timestamptz; reauth_deadline timestamptz;
BEGIN
  PERFORM google_ads_v1.worker_assert_login();
  IF p_connection_id IS NULL OR p_user_id IS NULL OR p_store_id IS NULL
    OR p_granted_scope IS DISTINCT FROM ARRAY['https://www.googleapis.com/auth/adwords']::text[]
    OR p_oauth_app_publishing_status IS NULL OR p_oauth_app_publishing_status NOT IN ('testing','production')
    OR p_ciphertext IS NULL OR octet_length(p_ciphertext) NOT BETWEEN 1 AND 16384
    OR p_encrypted_dek IS NULL OR octet_length(p_encrypted_dek) NOT BETWEEN 1 AND 16384
    OR p_key_version IS NULL OR p_key_version !~ '^[A-Za-z0-9._-]{1,128}$'
    OR p_algorithm IS DISTINCT FROM 'AES-256-GCM'
    OR p_selection_handle_digest IS NULL OR octet_length(p_selection_handle_digest)<>32
    OR p_selection_expires_at IS NULL OR p_selection_expires_at<=clock_timestamp()
    OR p_selection_expires_at>clock_timestamp()+interval '15 minutes 30 seconds'
    OR p_accounts IS NULL OR jsonb_typeof(p_accounts)<>'array'
    OR NOT EXISTS(SELECT 1 FROM public.store_memberships sm WHERE sm.user_id=p_user_id AND sm.store_id=p_store_id) THEN
    RAISE EXCEPTION 'Google Ads pending connection unavailable';
  END IF;
  IF jsonb_array_length(p_accounts)<1 OR jsonb_array_length(p_accounts)>5000 THEN
    RAISE EXCEPTION 'Google Ads pending connection unavailable';
  END IF;
  actual_now:=clock_timestamp();
  IF p_oauth_app_publishing_status='testing' THEN
    -- Google refresh tokens issued while the OAuth app is in Testing expire
    -- after seven days; surface a reconnect prompt one day earlier.
    credential_expiry:=actual_now+interval '7 days';
    reauth_deadline:=actual_now+interval '6 days';
  ELSE
    -- Production-mode refresh tokens have no fixed expiry to infer here; they
    -- can still be revoked and must be handled from refresh/API failures.
    credential_expiry:=NULL;
    reauth_deadline:=NULL;
  END IF;

  SELECT count(*)::integer,count(DISTINCT ((e.value->>'customerId')||':'||coalesce(e.value->>'loginCustomerId','')))::integer
    INTO account_count,distinct_count
  FROM jsonb_array_elements(p_accounts) e(value)
  WHERE jsonb_typeof(e.value)='object' AND (e.value - ARRAY['customerId','loginCustomerId'])='{}'::jsonb
    AND e.value ?& ARRAY['customerId','loginCustomerId']
    AND e.value->>'customerId' ~ '^[0-9]{10}$'
    AND (e.value->'loginCustomerId'='null'::jsonb OR e.value->>'loginCustomerId' ~ '^[0-9]{10}$');
  IF account_count<>jsonb_array_length(p_accounts) OR distinct_count<>account_count THEN
    RAISE EXCEPTION 'Google Ads pending connection unavailable';
  END IF;

  INSERT INTO google_ads_v1.connections(
    id,store_id,created_by,status,granted_scope,oauth_app_publishing_status,reauthorize_by,credential_expires_at,
    pending_selection_digest,pending_selection_expires_at
  ) VALUES(
    p_connection_id,p_store_id,p_user_id,'pending',p_granted_scope,p_oauth_app_publishing_status,reauth_deadline,credential_expiry,
    p_selection_handle_digest,p_selection_expires_at
  );
  INSERT INTO google_ads_v1.credential_envelopes(
    connection_id,ciphertext,encrypted_dek,key_version,algorithm,version,credential_expires_at
  ) VALUES(p_connection_id,p_ciphertext,p_encrypted_dek,p_key_version,p_algorithm,1,credential_expiry);
  INSERT INTO google_ads_v1.ad_accounts(connection_id,store_id,customer_id,login_customer_id,active)
    SELECT p_connection_id,p_store_id,e.value->>'customerId',nullif(e.value->>'loginCustomerId',''),false
    FROM jsonb_array_elements(p_accounts) e(value);
  INSERT INTO google_ads_v1.credential_audit(connection_id,actor_id,action)
    VALUES(p_connection_id,p_user_id,'credential_stored');
  RETURN QUERY SELECT true;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Google Ads pending connection unavailable';
END $$;

CREATE OR REPLACE FUNCTION google_ads_v1.worker_assert_api_login()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path=pg_catalog,google_ads_v1 AS $$
BEGIN
  IF session_user<>'night_scout_google_ads_api_login'
     OR NOT pg_has_role(session_user,'night_scout_google_ads_api_group','member') THEN
    RAISE EXCEPTION 'Google Ads API capability required';
  END IF;
END $$;
REVOKE ALL ON FUNCTION google_ads_v1.worker_assert_api_login()
  FROM PUBLIC,anon,authenticated,night_scout_google_ads_api_group,night_scout_google_ads_api_login,
    night_scout_google_ads_collector_group,night_scout_google_ads_collector_login;

CREATE OR REPLACE FUNCTION google_ads_v1.worker_read_pending_selection(
  p_selection_handle_digest bytea,p_user_id uuid,p_store_id uuid,p_now timestamptz
) RETURNS TABLE(accounts jsonb,expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=pg_catalog,google_ads_v1 AS $$
BEGIN
  PERFORM google_ads_v1.worker_assert_login();
  IF p_selection_handle_digest IS NULL OR octet_length(p_selection_handle_digest)<>32
    OR p_user_id IS NULL OR p_store_id IS NULL OR p_now IS NULL
    OR abs(extract(epoch FROM (clock_timestamp()-p_now)))>60 THEN
    RAISE EXCEPTION 'Google Ads selection unavailable';
  END IF;
  RETURN QUERY
  SELECT jsonb_agg(jsonb_build_object('customerId',a.customer_id,'loginCustomerId',a.login_customer_id)
                   ORDER BY a.customer_id,a.login_customer_id NULLS FIRST),c.pending_selection_expires_at
  FROM google_ads_v1.connections c
  JOIN google_ads_v1.ad_accounts a ON a.connection_id=c.id AND a.store_id=c.store_id
  WHERE c.pending_selection_digest=p_selection_handle_digest AND c.created_by=p_user_id AND c.store_id=p_store_id
    AND c.status='pending' AND c.pending_selection_expires_at>clock_timestamp()
    AND EXISTS(SELECT 1 FROM public.store_memberships sm WHERE sm.user_id=p_user_id AND sm.store_id=p_store_id)
  GROUP BY c.id,c.pending_selection_expires_at;
END $$;

-- The OAuth/API service can retrieve only the encrypted pending refresh-token
-- envelope for a live state-bound selection. It must decrypt server-side and
-- immediately obtain account metadata; raw credential tables remain ungranted.
CREATE OR REPLACE FUNCTION google_ads_v1.worker_read_pending_credential(
  p_selection_handle_digest bytea,p_user_id uuid,p_store_id uuid,p_now timestamptz
) RETURNS TABLE(connection_id uuid,oauth_app_publishing_status text,reauthorize_by timestamptz,
  credential_expires_at timestamptz,ciphertext bytea,encrypted_dek bytea,key_version text,
  algorithm text,credential_version integer,selection_expires_at timestamptz,account_selections jsonb)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=pg_catalog,google_ads_v1 AS $$
BEGIN
  PERFORM google_ads_v1.worker_assert_api_login();
  IF p_selection_handle_digest IS NULL OR octet_length(p_selection_handle_digest)<>32
    OR p_user_id IS NULL OR p_store_id IS NULL OR p_now IS NULL
    OR abs(extract(epoch FROM (clock_timestamp()-p_now)))>60 THEN
    RAISE EXCEPTION 'Google Ads pending credential unavailable';
  END IF;
  RETURN QUERY
  SELECT c.id,c.oauth_app_publishing_status,c.reauthorize_by,c.credential_expires_at,
    e.ciphertext,e.encrypted_dek,e.key_version,e.algorithm,e.version,c.pending_selection_expires_at,
    coalesce(candidate_rows.selections,'[]'::jsonb)
  FROM google_ads_v1.connections c
  JOIN google_ads_v1.credential_envelopes e ON e.connection_id=c.id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('customerId',a.customer_id,'loginCustomerId',a.login_customer_id)
      ORDER BY a.customer_id,a.login_customer_id NULLS FIRST) AS selections
    FROM google_ads_v1.ad_accounts a WHERE a.connection_id=c.id AND a.store_id=c.store_id
  ) candidate_rows ON true
  WHERE c.pending_selection_digest=p_selection_handle_digest AND c.created_by=p_user_id AND c.store_id=p_store_id
    AND c.status='pending' AND c.pending_selection_expires_at>clock_timestamp()
    AND (c.credential_expires_at IS NULL OR c.credential_expires_at>clock_timestamp())
    AND e.algorithm='AES-256-GCM' AND e.version>0
    AND e.credential_expires_at IS NOT DISTINCT FROM c.credential_expires_at
    AND EXISTS(SELECT 1 FROM public.store_memberships sm WHERE sm.user_id=p_user_id AND sm.store_id=p_store_id);
END $$;

CREATE OR REPLACE FUNCTION google_ads_v1.worker_activate_selected_account(
  p_selection_handle_digest bytea,p_user_id uuid,p_store_id uuid,p_customer_id text,
  p_login_customer_id text,p_currency text,p_timezone_name text,p_now timestamptz
) RETURNS TABLE(customer_id text,login_customer_id text,currency text,timezone_name text,connected_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,google_ads_v1 AS $$
DECLARE target_connection uuid; target_currency char(3); target_timezone text; target_login_customer_id text; activated_at timestamptz;
BEGIN
  PERFORM google_ads_v1.worker_assert_login();
  IF p_selection_handle_digest IS NULL OR octet_length(p_selection_handle_digest)<>32
    OR p_user_id IS NULL OR p_store_id IS NULL OR p_customer_id IS NULL OR p_customer_id !~ '^[0-9]{10}$'
    OR (p_login_customer_id IS NOT NULL AND p_login_customer_id !~ '^[0-9]{10}$')
    OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$'
    OR p_timezone_name IS NULL OR length(p_timezone_name) NOT BETWEEN 1 AND 128
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name=p_timezone_name)
    OR p_now IS NULL OR abs(extract(epoch FROM (clock_timestamp()-p_now)))>60 THEN
    RAISE EXCEPTION 'Google Ads selection unavailable';
  END IF;
  -- Serialize the single selected Google account per store, including reconnects.
  PERFORM 1 FROM public.stores s WHERE s.id=p_store_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  -- Lock any currently active account rows in stable order before locking the
  -- pending target. Collection claims lock only their account row, so this
  -- store -> active account -> pending connection/account order avoids a lock
  -- cycle and serializes replacement even if the provider account ID changes.
  PERFORM a.id
  FROM google_ads_v1.ad_accounts a
  WHERE a.store_id=p_store_id AND a.active
  ORDER BY a.id
  FOR UPDATE OF a;
  SELECT c.id,a.currency,a.timezone_name,a.login_customer_id
    INTO target_connection,target_currency,target_timezone,target_login_customer_id
  FROM google_ads_v1.connections c
  JOIN google_ads_v1.ad_accounts a ON a.connection_id=c.id AND a.store_id=c.store_id
  WHERE c.pending_selection_digest=p_selection_handle_digest AND c.created_by=p_user_id AND c.store_id=p_store_id
    AND c.status='pending' AND c.pending_selection_expires_at>clock_timestamp()
    AND a.customer_id=p_customer_id AND a.login_customer_id IS NOT DISTINCT FROM p_login_customer_id AND NOT a.active
    AND EXISTS(SELECT 1 FROM public.store_memberships sm WHERE sm.user_id=p_user_id AND sm.store_id=p_store_id)
  FOR UPDATE OF c,a;
  IF target_connection IS NULL THEN RETURN; END IF;
  target_currency:=p_currency;
  target_timezone:=p_timezone_name;

  activated_at:=clock_timestamp();
  -- Retire the previous selected account and connection for this store before
  -- activating the replacement, regardless of whether its provider account ID
  -- matches the new selection. The base partial unique index permits one active
  -- account row per store; all changes remain atomic in this transaction.
  INSERT INTO google_ads_v1.credential_audit(connection_id,actor_id,action)
  SELECT c.id,c.created_by,'credential_deleted'
  FROM google_ads_v1.connections c
  JOIN google_ads_v1.credential_envelopes e ON e.connection_id=c.id
  WHERE c.store_id=p_store_id AND c.id<>target_connection
    AND c.status IN ('connected','reauthorization_required');
  DELETE FROM google_ads_v1.credential_envelopes e
  USING google_ads_v1.connections c
  WHERE e.connection_id=c.id AND c.store_id=p_store_id AND c.id<>target_connection
    AND c.status IN ('connected','reauthorization_required');
  INSERT INTO google_ads_v1.credential_audit(connection_id,actor_id,action)
  SELECT c.id,c.created_by,'connection_disconnected'
  FROM google_ads_v1.connections c
  WHERE c.store_id=p_store_id AND c.id<>target_connection
    AND c.status IN ('connected','reauthorization_required');
  UPDATE google_ads_v1.ad_accounts SET active=false
    WHERE store_id=p_store_id AND active AND connection_id<>target_connection;
  UPDATE google_ads_v1.connections SET status='disconnected',disconnected_at=activated_at,updated_at=activated_at
    WHERE store_id=p_store_id AND id<>target_connection
      AND status IN ('connected','reauthorization_required');

  UPDATE google_ads_v1.ad_accounts SET active=false
    WHERE connection_id=target_connection AND store_id=p_store_id;
  UPDATE google_ads_v1.ad_accounts SET active=true,selected_at=activated_at,currency=p_currency,timezone_name=p_timezone_name
    WHERE connection_id=target_connection AND store_id=p_store_id AND customer_id=p_customer_id
      AND login_customer_id IS NOT DISTINCT FROM p_login_customer_id;
  UPDATE google_ads_v1.connections SET status='connected',connected_at=activated_at,disconnected_at=NULL,
    pending_selection_digest=NULL,pending_selection_expires_at=NULL,updated_at=activated_at
    WHERE id=target_connection AND store_id=p_store_id AND created_by=p_user_id
      AND status='pending' AND pending_selection_expires_at>activated_at;
  IF NOT FOUND THEN RAISE EXCEPTION 'Google Ads selection unavailable'; END IF;
  RETURN QUERY SELECT p_customer_id,target_login_customer_id,target_currency::text,target_timezone,activated_at;
END $$;

CREATE OR REPLACE FUNCTION google_ads_v1.worker_expire_pending_connections(p_now timestamptz)
RETURNS TABLE(completed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,google_ads_v1 AS $$
DECLARE store_row record; actual_now timestamptz;
BEGIN
  PERFORM google_ads_v1.worker_assert_login();
  IF p_now IS NULL OR abs(extract(epoch FROM (clock_timestamp()-p_now)))>60 THEN
    RAISE EXCEPTION 'Google Ads pending cleanup unavailable';
  END IF;
  actual_now:=clock_timestamp();
  -- Lock every affected store first, in stable ID order, to match activation
  -- and disconnect's store-first lock discipline before deleting/cascading.
  FOR store_row IN
    SELECT s.id
    FROM public.stores s
    WHERE EXISTS(SELECT 1 FROM google_ads_v1.connections c
      WHERE c.store_id=s.id AND c.status='pending' AND c.pending_selection_expires_at<=actual_now)
    ORDER BY s.id
    FOR UPDATE OF s
  LOOP
    NULL;
  END LOOP;
  INSERT INTO google_ads_v1.credential_audit(connection_id,actor_id,action)
    SELECT c.id,c.created_by,'credential_deleted'
    FROM google_ads_v1.connections c
    WHERE c.status='pending' AND c.pending_selection_expires_at<=actual_now;
  DELETE FROM google_ads_v1.connections c
    WHERE c.status='pending' AND c.pending_selection_expires_at<=actual_now;
  -- OAuth state is a short-lived one-time nonce, not a long-term audit record.
  -- Purge consumed and expired digests on this same periodic maintenance pass.
  DELETE FROM google_ads_v1.oauth_states s
    WHERE s.consumed_at IS NOT NULL OR s.expires_at<=actual_now;
  RETURN QUERY SELECT true;
END $$;

CREATE OR REPLACE FUNCTION google_ads_v1.worker_disconnect_connection(
  p_connection_id uuid,p_user_id uuid,p_store_id uuid,p_now timestamptz
) RETURNS TABLE(completed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,google_ads_v1 AS $$
DECLARE actual_now timestamptz; owned_connection boolean;
BEGIN
  PERFORM google_ads_v1.worker_assert_login();
  IF p_connection_id IS NULL OR p_user_id IS NULL OR p_store_id IS NULL
    OR p_now IS NULL OR abs(extract(epoch FROM (clock_timestamp()-p_now)))>60 THEN
    RAISE EXCEPTION 'Google Ads disconnect unavailable';
  END IF;

  -- Match activation's lock order: store, active account rows in stable order,
  -- then connection. The store lock serializes disconnect/reconnect while the
  -- account locks coordinate with collection claims.
  PERFORM 1 FROM public.stores s WHERE s.id=p_store_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false; RETURN; END IF;
  PERFORM 1 FROM public.store_memberships sm
  WHERE sm.user_id=p_user_id AND sm.store_id=p_store_id
  FOR KEY SHARE OF sm;
  IF NOT FOUND THEN RETURN QUERY SELECT false; RETURN; END IF;
  PERFORM a.id
  FROM google_ads_v1.ad_accounts a
  WHERE a.store_id=p_store_id AND a.active
  ORDER BY a.id
  FOR UPDATE OF a;

  SELECT true INTO owned_connection
  FROM google_ads_v1.connections c
  WHERE c.id=p_connection_id AND c.store_id=p_store_id AND c.created_by=p_user_id
  FOR UPDATE OF c;
  IF owned_connection IS DISTINCT FROM true THEN
    RETURN QUERY SELECT false;
    RETURN;
  END IF;

  actual_now:=clock_timestamp();
  INSERT INTO google_ads_v1.credential_audit(connection_id,actor_id,action)
  SELECT c.id,p_user_id,'credential_deleted'
  FROM google_ads_v1.connections c
  WHERE c.id=p_connection_id AND c.store_id=p_store_id AND c.created_by=p_user_id
    AND EXISTS(SELECT 1 FROM google_ads_v1.credential_envelopes e WHERE e.connection_id=c.id);
  DELETE FROM google_ads_v1.credential_envelopes e WHERE e.connection_id=p_connection_id;
  UPDATE google_ads_v1.ad_accounts a SET active=false
  WHERE a.connection_id=p_connection_id AND a.store_id=p_store_id AND a.active;
  UPDATE google_ads_v1.connections c SET status='disconnected',disconnected_at=actual_now,
    pending_selection_digest=NULL,pending_selection_expires_at=NULL,updated_at=actual_now
  WHERE c.id=p_connection_id AND c.store_id=p_store_id AND c.created_by=p_user_id;
  INSERT INTO google_ads_v1.credential_audit(connection_id,actor_id,action)
  VALUES(p_connection_id,p_user_id,'connection_disconnected');

  -- Daily spend observations and completed collection runs are historical data
  -- and remain intact; this RPC only removes credentials and disables access.
  RETURN QUERY SELECT true;
END $$;

CREATE OR REPLACE FUNCTION google_ads_v1.worker_mark_expired_connections(
  p_store_id uuid,p_now timestamptz
) RETURNS TABLE(changed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,google_ads_v1 AS $$
DECLARE actual_now timestamptz; n integer;
BEGIN
  PERFORM google_ads_v1.worker_assert_login();
  IF p_store_id IS NULL OR p_now IS NULL
    OR abs(extract(epoch FROM (clock_timestamp()-p_now)))>60 THEN
    RAISE EXCEPTION 'Google Ads connection unavailable';
  END IF;
  actual_now:=clock_timestamp();
  PERFORM 1 FROM public.stores s WHERE s.id=p_store_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false; RETURN; END IF;

  -- Lock selected accounts before their connection rows, matching activation,
  -- disconnect and the collection claim lock order.
  PERFORM a.id
  FROM google_ads_v1.ad_accounts a
  JOIN google_ads_v1.connections c ON c.id=a.connection_id AND c.store_id=a.store_id
  WHERE a.store_id=p_store_id AND a.active AND c.status='connected'
    AND c.credential_expires_at IS NOT NULL AND c.credential_expires_at<=actual_now
  ORDER BY a.id
  FOR UPDATE OF a;
  INSERT INTO google_ads_v1.credential_audit(connection_id,actor_id,action)
  SELECT c.id,c.created_by,'credential_deleted'
  FROM google_ads_v1.connections c
  JOIN google_ads_v1.credential_envelopes e ON e.connection_id=c.id
  WHERE c.store_id=p_store_id AND c.status='connected'
    AND c.credential_expires_at IS NOT NULL AND c.credential_expires_at<=actual_now;
  DELETE FROM google_ads_v1.credential_envelopes e
  USING google_ads_v1.connections c
  WHERE e.connection_id=c.id AND c.store_id=p_store_id AND c.status='connected'
    AND c.credential_expires_at IS NOT NULL AND c.credential_expires_at<=actual_now;
  INSERT INTO google_ads_v1.credential_audit(connection_id,actor_id,action,safe_reason)
  SELECT c.id,c.created_by,'connection_reauthorization_required','token_expired'
  FROM google_ads_v1.connections c
  WHERE c.store_id=p_store_id AND c.status='connected'
    AND c.credential_expires_at IS NOT NULL AND c.credential_expires_at<=actual_now;
  UPDATE google_ads_v1.ad_accounts a SET active=false
  FROM google_ads_v1.connections c
  WHERE a.connection_id=c.id AND a.store_id=c.store_id AND a.store_id=p_store_id AND a.active
    AND c.status='connected' AND c.credential_expires_at IS NOT NULL AND c.credential_expires_at<=actual_now;
  UPDATE google_ads_v1.connections c SET status='reauthorization_required',updated_at=actual_now
  WHERE c.store_id=p_store_id AND c.status='connected'
    AND c.credential_expires_at IS NOT NULL AND c.credential_expires_at<=actual_now;
  GET DIAGNOSTICS n=ROW_COUNT;
  RETURN QUERY SELECT (n>0);
END $$;

CREATE OR REPLACE FUNCTION google_ads_v1.worker_list_active_accounts(p_now timestamptz)
RETURNS TABLE(store_id uuid,connection_id uuid,customer_id text,login_customer_id text,currency text,timezone_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,google_ads_v1 AS $$
DECLARE actual_now timestamptz; affected_store record;
BEGIN
  PERFORM google_ads_v1.worker_assert_login();
  IF p_now IS NULL OR abs(extract(epoch FROM (clock_timestamp()-p_now)))>60 THEN
    RAISE EXCEPTION 'Google Ads account enumeration unavailable';
  END IF;
  actual_now:=clock_timestamp();
  FOR affected_store IN
    SELECT DISTINCT c.store_id FROM google_ads_v1.connections c
    WHERE c.status='connected' AND c.credential_expires_at IS NOT NULL AND c.credential_expires_at<=actual_now
    ORDER BY c.store_id
  LOOP
    PERFORM google_ads_v1.worker_mark_expired_connections(affected_store.store_id,clock_timestamp());
  END LOOP;
  RETURN QUERY
  SELECT a.store_id,a.connection_id,a.customer_id,a.login_customer_id,a.currency::text,a.timezone_name
  FROM google_ads_v1.ad_accounts a
  JOIN google_ads_v1.connections c ON c.id=a.connection_id AND c.store_id=a.store_id
  WHERE a.active AND c.status='connected'
  ORDER BY a.store_id,a.connection_id,a.customer_id;
END $$;

CREATE OR REPLACE FUNCTION google_ads_v1.worker_read_store_status(
  p_user_id uuid,p_store_id uuid,p_now timestamptz
) RETURNS TABLE(
  connection_id uuid,connection_status text,connected_at timestamptz,disconnected_at timestamptz,
  oauth_app_publishing_status text,reauthorize_by timestamptz,credential_expires_at timestamptz,
  customer_id text,login_customer_id text,currency text,timezone_name text,
  latest_run_id uuid,latest_run_status text,latest_run_started_at timestamptz,
  latest_run_finished_at timestamptz,latest_run_requested_from date,
  latest_run_requested_to date,latest_run_safe_failure text,latest_run_pages_read integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,google_ads_v1 AS $$
BEGIN
  PERFORM google_ads_v1.worker_assert_login();
  IF p_user_id IS NULL OR p_store_id IS NULL OR p_now IS NULL
    OR abs(extract(epoch FROM (clock_timestamp()-p_now)))>60 THEN
    RAISE EXCEPTION 'Google Ads status unavailable';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.store_memberships sm
    WHERE sm.user_id=p_user_id AND sm.store_id=p_store_id) THEN
    RETURN;
  END IF;
  PERFORM google_ads_v1.worker_mark_expired_connections(p_store_id,clock_timestamp());
  RETURN QUERY
  SELECT c.id,c.status,c.connected_at,c.disconnected_at,c.oauth_app_publishing_status,c.reauthorize_by,
    c.credential_expires_at,a.customer_id,a.login_customer_id,a.currency::text,a.timezone_name,
    r.id,r.status,r.started_at,r.finished_at,r.requested_from,r.requested_to,r.safe_failure,r.pages_read
  FROM google_ads_v1.connections c
  LEFT JOIN LATERAL (
    SELECT aa.customer_id,aa.login_customer_id,aa.currency,aa.timezone_name
    FROM google_ads_v1.ad_accounts aa WHERE aa.connection_id=c.id AND aa.store_id=c.store_id
    ORDER BY aa.active DESC,aa.selected_at DESC NULLS LAST,aa.id LIMIT 1
  ) a ON true
  LEFT JOIN LATERAL (
    SELECT cr.id,cr.status,cr.started_at,cr.finished_at,cr.requested_from,cr.requested_to,
      cr.safe_failure,cr.pages_read
    FROM google_ads_v1.collection_runs cr WHERE cr.connection_id=c.id AND cr.store_id=c.store_id
    ORDER BY cr.started_at DESC,cr.id DESC LIMIT 1
  ) r ON true
  WHERE c.store_id=p_store_id AND c.created_by=p_user_id
  ORDER BY c.created_at DESC,c.id;
END $$;

CREATE OR REPLACE FUNCTION google_ads_v1.worker_get_selected_account(
  p_store_id uuid,p_connection_id uuid,p_customer_id text
) RETURNS TABLE(customer_id text,login_customer_id text,store_id uuid,connection_id uuid,active boolean,currency text,timezone_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,google_ads_v1 AS $$
BEGIN
  PERFORM google_ads_v1.worker_assert_login();
  IF p_store_id IS NULL OR p_connection_id IS NULL OR p_customer_id IS NULL OR p_customer_id !~ '^[0-9]{10}$' THEN
    RAISE EXCEPTION 'Google Ads account unavailable';
  END IF;
  PERFORM google_ads_v1.worker_mark_expired_connections(p_store_id,clock_timestamp());
  RETURN QUERY SELECT a.customer_id,a.login_customer_id,a.store_id,a.connection_id,a.active,a.currency::text,a.timezone_name
  FROM google_ads_v1.ad_accounts a
  JOIN google_ads_v1.connections c ON c.id=a.connection_id AND c.store_id=a.store_id
  WHERE a.store_id=p_store_id AND a.connection_id=p_connection_id AND a.customer_id=p_customer_id
    AND a.active AND c.status='connected';
END $$;

CREATE OR REPLACE FUNCTION google_ads_v1.worker_get_credential_envelope(
  p_store_id uuid,p_connection_id uuid,p_customer_id text
) RETURNS TABLE(store_id uuid,connection_id uuid,customer_id text,login_customer_id text,active boolean,
  credential_expires_at timestamptz,ciphertext bytea,encrypted_dek bytea,key_version text,algorithm text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,google_ads_v1 AS $$
BEGIN
  PERFORM google_ads_v1.worker_assert_login();
  IF p_store_id IS NULL OR p_connection_id IS NULL OR p_customer_id IS NULL OR p_customer_id !~ '^[0-9]{10}$' THEN
    RAISE EXCEPTION 'Google Ads credential unavailable';
  END IF;
  PERFORM google_ads_v1.worker_mark_expired_connections(p_store_id,clock_timestamp());
  RETURN QUERY
  SELECT a.store_id,a.connection_id,a.customer_id,a.login_customer_id,a.active,e.credential_expires_at,
    e.ciphertext,e.encrypted_dek,e.key_version,e.algorithm
  FROM google_ads_v1.ad_accounts a
  JOIN google_ads_v1.connections c ON c.id=a.connection_id AND c.store_id=a.store_id
  JOIN google_ads_v1.credential_envelopes e ON e.connection_id=c.id
  WHERE a.store_id=p_store_id AND a.connection_id=p_connection_id AND a.customer_id=p_customer_id
    AND a.active AND c.status='connected'
    AND e.algorithm='AES-256-GCM' AND e.credential_expires_at IS NOT DISTINCT FROM c.credential_expires_at AND e.version>0;
END $$;

CREATE OR REPLACE FUNCTION google_ads_v1.worker_begin_collection_run(
  p_idempotency_key text,p_store_id uuid,p_connection_id uuid,p_customer_id text,
  p_requested_from date,p_requested_to date,p_currency text,p_timezone text,p_api_version text,p_started_at timestamptz
) RETURNS TABLE(run_id uuid,already_complete boolean,already_running boolean,claimed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,google_ads_v1 AS $$
DECLARE account_row google_ads_v1.ad_accounts%ROWTYPE; run_row google_ads_v1.collection_runs%ROWTYPE;
  actual_now timestamptz; new_id uuid; changed integer;
BEGIN
  PERFORM google_ads_v1.worker_assert_login();
  IF p_idempotency_key IS NULL OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,200}$' OR p_store_id IS NULL OR p_connection_id IS NULL
    OR p_customer_id IS NULL OR p_customer_id !~ '^[0-9]{10}$' OR p_requested_from IS NULL OR p_requested_to IS NULL
    OR p_requested_from>p_requested_to OR p_requested_to-p_requested_from>92
    OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' OR p_timezone IS NULL OR p_api_version IS NULL OR p_api_version !~ '^v[0-9]+$'
    OR p_started_at IS NULL THEN RAISE EXCEPTION 'Google Ads collection unavailable'; END IF;
  actual_now:=clock_timestamp();
  IF abs(extract(epoch FROM (actual_now-p_started_at)))>120 THEN RAISE EXCEPTION 'Google Ads collection unavailable'; END IF;

  -- Commit expiration/reauthorization before returning an unavailable claim;
  -- a later collection attempt cannot silently use the expired token.
  IF (SELECT x.changed FROM google_ads_v1.worker_mark_expired_connections(p_store_id,actual_now) x) THEN
    RETURN QUERY SELECT NULL::uuid,false,false,false;
    RETURN;
  END IF;

  SELECT a.* INTO account_row
  FROM google_ads_v1.ad_accounts a JOIN google_ads_v1.connections c ON c.id=a.connection_id AND c.store_id=a.store_id
  WHERE a.store_id=p_store_id AND a.connection_id=p_connection_id AND a.customer_id=p_customer_id
    AND a.active AND c.status='connected'
  FOR UPDATE OF a;
  IF account_row.id IS NULL OR account_row.currency::text<>p_currency OR account_row.timezone_name<>p_timezone
    OR p_requested_to>(actual_now AT TIME ZONE account_row.timezone_name)::date-1 THEN
    RAISE EXCEPTION 'Google Ads collection unavailable';
  END IF;

  SELECT r.* INTO run_row FROM google_ads_v1.collection_runs r
    WHERE r.account_id=account_row.id AND r.idempotency_key=p_idempotency_key
    FOR UPDATE;
  IF run_row.id IS NOT NULL THEN
    IF run_row.requested_from<>p_requested_from OR run_row.requested_to<>p_requested_to
      OR run_row.api_version<>p_api_version THEN
      RAISE EXCEPTION 'Google Ads collection unavailable';
    END IF;
    IF run_row.status IN ('complete','partial') THEN
      RETURN QUERY SELECT run_row.id,true,false,false; RETURN;
    ELSIF run_row.status='running' AND run_row.lease_expires_at>actual_now THEN
      RETURN QUERY SELECT run_row.id,false,true,false; RETURN;
    ELSIF run_row.status='running' AND run_row.lease_expires_at<=actual_now THEN
      -- A running attempt has not committed observations (completion writes
      -- observations and terminal state atomically). Rotate its ID so a stale
      -- worker holding the old run ID cannot complete or fail the reclaimed run.
      IF EXISTS(SELECT 1 FROM google_ads_v1.daily_spend_observations o WHERE o.run_id=run_row.id) THEN
        RAISE EXCEPTION 'Google Ads collection unavailable';
      END IF;
      new_id:=gen_random_uuid();
      UPDATE google_ads_v1.collection_runs r SET id=new_id,status='running',
        attempt_number=attempt_number+1,started_at=actual_now,finished_at=NULL,
        safe_failure=NULL,lease_expires_at=actual_now+interval '15 minutes',pages_read=0
      WHERE r.id=run_row.id AND r.status='running' AND r.lease_expires_at<=actual_now;
      GET DIAGNOSTICS changed=ROW_COUNT;
      IF changed<>1 THEN RAISE EXCEPTION 'Google Ads collection unavailable'; END IF;
      RETURN QUERY SELECT new_id,false,false,true; RETURN;
    ELSE
      RAISE EXCEPTION 'Google Ads collection unavailable';
    END IF;
  END IF;

  -- Expire unrelated crashed claims before checking for another live run.
  -- This retains history while allowing the exact expired idempotency key above
  -- to reclaim its attempt with a fresh run ID.
  UPDATE google_ads_v1.collection_runs r SET status='failed',safe_failure='provider_unavailable',
    finished_at=actual_now,lease_expires_at=NULL
  WHERE r.account_id=account_row.id AND r.status='running' AND r.lease_expires_at<=actual_now;
  SELECT r.* INTO run_row FROM google_ads_v1.collection_runs r
    WHERE r.account_id=account_row.id AND r.status='running' AND r.lease_expires_at>actual_now
    ORDER BY r.started_at DESC LIMIT 1;
  IF run_row.id IS NOT NULL THEN
    RETURN QUERY SELECT run_row.id,false,true,false; RETURN;
  END IF;

  new_id:=gen_random_uuid();
  INSERT INTO google_ads_v1.collection_runs(
    id,account_id,connection_id,store_id,requested_from,requested_to,idempotency_key,api_version,
    status,attempt_number,lease_expires_at,pages_read,started_at
  ) VALUES(new_id,account_row.id,p_connection_id,p_store_id,p_requested_from,p_requested_to,
    p_idempotency_key,p_api_version,'running',1,actual_now+interval '15 minutes',0,actual_now);
  RETURN QUERY SELECT new_id,false,false,true;
END $$;

CREATE OR REPLACE FUNCTION google_ads_v1.worker_complete_collection_run(
  p_run_id uuid,p_idempotency_key text,p_status text,p_requested_from date,p_requested_to date,
  p_observed_at timestamptz,p_pages_read integer,p_source jsonb,p_coverage jsonb
) RETURNS TABLE(completed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,google_ads_v1 AS $$
DECLARE r google_ads_v1.collection_runs%ROWTYPE; a google_ads_v1.ad_accounts%ROWTYPE;
  actual_now timestamptz; expected_days integer; count_days integer; missing_days integer;
BEGIN
  PERFORM google_ads_v1.worker_assert_login();
  IF p_run_id IS NULL OR p_idempotency_key IS NULL OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,200}$'
    OR p_status IS NULL OR p_status NOT IN ('complete','partial') OR p_requested_from IS NULL OR p_requested_to IS NULL
    OR p_observed_at IS NULL OR p_pages_read IS NULL OR p_pages_read NOT BETWEEN 1 AND 100
    OR p_source IS NULL OR jsonb_typeof(p_source)<>'object' OR p_coverage IS NULL OR jsonb_typeof(p_coverage)<>'array' THEN
    RAISE EXCEPTION 'Google Ads collection unavailable';
  END IF;
  actual_now:=clock_timestamp();
  SELECT * INTO r FROM google_ads_v1.collection_runs WHERE id=p_run_id;
  IF r.id IS NULL OR r.status<>'running' OR r.lease_expires_at<=actual_now
    OR r.idempotency_key<>p_idempotency_key OR r.requested_from<>p_requested_from OR r.requested_to<>p_requested_to
    OR p_observed_at<r.started_at THEN
    RAISE EXCEPTION 'Google Ads collection unavailable';
  END IF;
  SELECT * INTO a FROM google_ads_v1.ad_accounts
    WHERE id=r.account_id AND connection_id=r.connection_id AND store_id=r.store_id AND active FOR UPDATE;
  IF a.id IS NULL OR NOT EXISTS(SELECT 1 FROM google_ads_v1.connections c WHERE c.id=r.connection_id
    AND c.store_id=r.store_id AND c.status='connected'
    AND (c.credential_expires_at IS NULL OR c.credential_expires_at>actual_now)) THEN
    RAISE EXCEPTION 'Google Ads collection unavailable';
  END IF;
  -- Lock order is account then run, matching begin_collection_run. This avoids
  -- a deadlock between a completing read and an expiring/reclaimed run claim.
  SELECT * INTO r FROM google_ads_v1.collection_runs WHERE id=p_run_id FOR UPDATE;
  IF r.id IS NULL OR r.status<>'running' OR r.lease_expires_at<=actual_now
    OR r.idempotency_key<>p_idempotency_key OR r.requested_from<>p_requested_from OR r.requested_to<>p_requested_to THEN
    RAISE EXCEPTION 'Google Ads collection unavailable';
  END IF;
  IF p_source IS DISTINCT FROM jsonb_build_object(
      'provider','google_ads','customerId',a.customer_id,'loginCustomerId',a.login_customer_id,
      'storeId',r.store_id::text,'connectionId',r.connection_id::text,
      'currency',a.currency::text,'timeZone',a.timezone_name,'apiVersion',r.api_version)
    OR p_observed_at>actual_now+interval '1 minute' THEN
    RAISE EXCEPTION 'Google Ads collection unavailable';
  END IF;

  expected_days:=p_requested_to-p_requested_from+1;
  SELECT count(*)::integer,count(*) FILTER(WHERE e.value->>'coverageState'<>'provider_row')::integer
    INTO count_days,missing_days
  FROM jsonb_array_elements(p_coverage) WITH ORDINALITY AS e(value,ordinality)
  WHERE jsonb_typeof(e.value)='object' AND (e.value - ARRAY['date','coverageState','spendMicros'])='{}'::jsonb
    AND e.value ?& ARRAY['date','coverageState','spendMicros']
    AND e.value->>'date' ~ '^\d{4}-\d{2}-\d{2}$'
    AND (e.value->>'date')::date=p_requested_from+(e.ordinality::integer-1)
    AND e.value->>'coverageState' IN ('provider_row','no_row','partial','failed')
    AND ((e.value->>'coverageState'='provider_row' AND jsonb_typeof(e.value->'spendMicros')='string'
          AND e.value->>'spendMicros' ~ '^\d{1,19}$'
          AND (e.value->>'spendMicros')::numeric<=9223372036854775807)
      OR (e.value->>'coverageState'<>'provider_row' AND e.value->'spendMicros'='null'::jsonb));
  IF count_days<>expected_days OR jsonb_array_length(p_coverage)<>expected_days
    OR (p_status='partial')<>(missing_days>0) THEN
    RAISE EXCEPTION 'Google Ads collection unavailable';
  END IF;
  IF p_requested_to>(actual_now AT TIME ZONE a.timezone_name)::date-1
    OR p_requested_to-p_requested_from>92 THEN RAISE EXCEPTION 'Google Ads collection unavailable'; END IF;

  INSERT INTO google_ads_v1.daily_spend_observations(run_id,account_id,spend_date,coverage_state,spend_micros,observed_at)
    SELECT p_run_id,r.account_id,(e.value->>'date')::date,e.value->>'coverageState',
      CASE WHEN e.value->>'coverageState'='provider_row' THEN (e.value->>'spendMicros')::numeric ELSE NULL END,
      p_observed_at
    FROM jsonb_array_elements(p_coverage) e(value);
  UPDATE google_ads_v1.collection_runs SET status=p_status,pages_read=p_pages_read,finished_at=actual_now,
    lease_expires_at=NULL,safe_failure=NULL
  WHERE id=p_run_id AND status='running' AND lease_expires_at>actual_now;
  IF NOT FOUND THEN RAISE EXCEPTION 'Google Ads collection unavailable'; END IF;
  RETURN QUERY SELECT true;
END $$;

CREATE OR REPLACE FUNCTION google_ads_v1.worker_fail_collection_run(
  p_run_id uuid,p_safe_failure text,p_finished_at timestamptz
) RETURNS TABLE(completed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,google_ads_v1 AS $$
DECLARE changed integer; target_store uuid; target_connection uuid; target_account uuid;
BEGIN
  PERFORM google_ads_v1.worker_assert_login();
  IF p_run_id IS NULL OR p_safe_failure IS NULL OR p_safe_failure NOT IN ('token_expired','access_revoked','provider_unavailable','invalid_response','scope_missing')
    OR p_finished_at IS NULL OR abs(extract(epoch FROM (clock_timestamp()-p_finished_at)))>60 THEN
    RAISE EXCEPTION 'Google Ads collection unavailable';
  END IF;
  SELECT r.store_id,r.connection_id,r.account_id
    INTO target_store,target_connection,target_account
  FROM google_ads_v1.collection_runs r WHERE r.id=p_run_id AND r.status='running';
  IF target_store IS NULL THEN RETURN QUERY SELECT false; RETURN; END IF;
  PERFORM 1 FROM public.stores s WHERE s.id=target_store FOR UPDATE;
  PERFORM 1 FROM google_ads_v1.ad_accounts a
    WHERE a.id=target_account AND a.store_id=target_store AND a.connection_id=target_connection
    FOR UPDATE OF a;
  UPDATE google_ads_v1.collection_runs SET status='failed',safe_failure=p_safe_failure,
    finished_at=p_finished_at,lease_expires_at=NULL
  WHERE id=p_run_id AND status='running' AND started_at<=p_finished_at AND lease_expires_at>clock_timestamp();
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed=1 AND p_safe_failure IN ('token_expired','access_revoked') THEN
    INSERT INTO google_ads_v1.credential_audit(connection_id,actor_id,action,safe_reason)
    SELECT c.id,c.created_by,'credential_deleted',p_safe_failure
    FROM google_ads_v1.connections c
    WHERE c.id=target_connection AND c.store_id=target_store
      AND EXISTS(SELECT 1 FROM google_ads_v1.credential_envelopes e WHERE e.connection_id=c.id);
    DELETE FROM google_ads_v1.credential_envelopes e WHERE e.connection_id=target_connection;
    UPDATE google_ads_v1.ad_accounts SET active=false
      WHERE id=target_account AND store_id=target_store AND connection_id=target_connection AND active;
    UPDATE google_ads_v1.connections SET status='reauthorization_required',updated_at=clock_timestamp()
      WHERE id=target_connection AND store_id=target_store AND status='connected';
    INSERT INTO google_ads_v1.credential_audit(connection_id,actor_id,action,safe_reason)
    SELECT c.id,c.created_by,'connection_reauthorization_required',p_safe_failure
    FROM google_ads_v1.connections c
    WHERE c.id=target_connection AND c.store_id=target_store AND c.status='reauthorization_required';
  END IF;
  RETURN QUERY SELECT (changed=1);
END $$;

-- The fixed RPC adapter expects exactly one row from every non-empty operation.
-- No worker RPC is directly callable by browser roles or PUBLIC.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA google_ads_v1 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA google_ads_v1
  FROM night_scout_google_ads_api_login,night_scout_google_ads_api_group,
    night_scout_google_ads_collector_login,night_scout_google_ads_collector_group;

-- Owner API / OAuth capability set.
GRANT EXECUTE ON FUNCTION google_ads_v1.worker_create_oauth_state(bytea,uuid,uuid,timestamptz) TO night_scout_google_ads_api_group;
GRANT EXECUTE ON FUNCTION google_ads_v1.worker_consume_oauth_state(bytea,timestamptz) TO night_scout_google_ads_api_group;
GRANT EXECUTE ON FUNCTION google_ads_v1.worker_create_pending_connection(uuid,uuid,uuid,text[],text,bytea,bytea,text,text,bytea,timestamptz,jsonb) TO night_scout_google_ads_api_group;
GRANT EXECUTE ON FUNCTION google_ads_v1.worker_read_pending_selection(bytea,uuid,uuid,timestamptz) TO night_scout_google_ads_api_group;
GRANT EXECUTE ON FUNCTION google_ads_v1.worker_read_pending_credential(bytea,uuid,uuid,timestamptz) TO night_scout_google_ads_api_group;
GRANT EXECUTE ON FUNCTION google_ads_v1.worker_activate_selected_account(bytea,uuid,uuid,text,text,text,text,timestamptz) TO night_scout_google_ads_api_group;
GRANT EXECUTE ON FUNCTION google_ads_v1.worker_disconnect_connection(uuid,uuid,uuid,timestamptz) TO night_scout_google_ads_api_group;
GRANT EXECUTE ON FUNCTION google_ads_v1.worker_read_store_status(uuid,uuid,timestamptz) TO night_scout_google_ads_api_group;

-- Scheduled collector / daily extraction capability set.
GRANT EXECUTE ON FUNCTION google_ads_v1.worker_expire_pending_connections(timestamptz) TO night_scout_google_ads_collector_group;
GRANT EXECUTE ON FUNCTION google_ads_v1.worker_list_active_accounts(timestamptz) TO night_scout_google_ads_collector_group;
GRANT EXECUTE ON FUNCTION google_ads_v1.worker_get_selected_account(uuid,uuid,text) TO night_scout_google_ads_collector_group;
GRANT EXECUTE ON FUNCTION google_ads_v1.worker_get_credential_envelope(uuid,uuid,text) TO night_scout_google_ads_collector_group;
GRANT EXECUTE ON FUNCTION google_ads_v1.worker_begin_collection_run(text,uuid,uuid,text,date,date,text,text,text,timestamptz) TO night_scout_google_ads_collector_group;
GRANT EXECUTE ON FUNCTION google_ads_v1.worker_complete_collection_run(uuid,text,text,date,date,timestamptz,integer,jsonb,jsonb) TO night_scout_google_ads_collector_group;
GRANT EXECUTE ON FUNCTION google_ads_v1.worker_fail_collection_run(uuid,text,timestamptz) TO night_scout_google_ads_collector_group;

-- Verify effective ACLs after role inheritance, without depending on
-- version-specific pg_auth_members columns. Any missing inherited grant or
-- cross-capability access aborts the proposal transaction.
DO $$
DECLARE api_rpc text; collector_rpc text;
  api_rpcs text[]:=ARRAY[
    'google_ads_v1.worker_create_oauth_state(bytea,uuid,uuid,timestamptz)',
    'google_ads_v1.worker_consume_oauth_state(bytea,timestamptz)',
    'google_ads_v1.worker_create_pending_connection(uuid,uuid,uuid,text[],text,bytea,bytea,text,text,bytea,timestamptz,jsonb)',
    'google_ads_v1.worker_read_pending_selection(bytea,uuid,uuid,timestamptz)',
    'google_ads_v1.worker_read_pending_credential(bytea,uuid,uuid,timestamptz)',
    'google_ads_v1.worker_activate_selected_account(bytea,uuid,uuid,text,text,text,text,timestamptz)',
    'google_ads_v1.worker_disconnect_connection(uuid,uuid,uuid,timestamptz)',
    'google_ads_v1.worker_read_store_status(uuid,uuid,timestamptz)'
  ];
  collector_rpcs text[]:=ARRAY[
    'google_ads_v1.worker_expire_pending_connections(timestamptz)',
    'google_ads_v1.worker_list_active_accounts(timestamptz)',
    'google_ads_v1.worker_get_selected_account(uuid,uuid,text)',
    'google_ads_v1.worker_get_credential_envelope(uuid,uuid,text)',
    'google_ads_v1.worker_begin_collection_run(text,uuid,uuid,text,date,date,text,text,text,timestamptz)',
    'google_ads_v1.worker_complete_collection_run(uuid,text,text,date,date,timestamptz,integer,jsonb,jsonb)',
    'google_ads_v1.worker_fail_collection_run(uuid,text,timestamptz)'
  ];
BEGIN
  FOREACH api_rpc IN ARRAY api_rpcs LOOP
    IF NOT has_function_privilege('night_scout_google_ads_api_login',api_rpc,'EXECUTE') THEN
      RAISE EXCEPTION 'Google Ads API login is missing an inherited RPC grant';
    END IF;
    IF has_function_privilege('night_scout_google_ads_collector_login',api_rpc,'EXECUTE') THEN
      RAISE EXCEPTION 'Google Ads collector login has an API RPC grant';
    END IF;
  END LOOP;
  FOREACH collector_rpc IN ARRAY collector_rpcs LOOP
    IF NOT has_function_privilege('night_scout_google_ads_collector_login',collector_rpc,'EXECUTE') THEN
      RAISE EXCEPTION 'Google Ads collector login is missing an inherited RPC grant';
    END IF;
    IF has_function_privilege('night_scout_google_ads_api_login',collector_rpc,'EXECUTE') THEN
      RAISE EXCEPTION 'Google Ads API login has a collector RPC grant';
    END IF;
  END LOOP;
END $$;

COMMIT;
