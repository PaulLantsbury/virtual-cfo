-- PROPOSAL ONLY — apply after reviewing and applying the Meta Ads base schema
-- and RPC proposal. This adds a bounded, read-only merchant report capability.
-- Provision night_scout_meta_ads_report_group (NOLOGIN) and
-- night_scout_meta_ads_report_login separately. The report login must be the
-- exclusive member of this group; it gets no direct table grants. Do not apply
-- before reviewing roles, ownership, function ACLs and the read contract.
BEGIN;

DO $$
DECLARE report_group_oid oid; report_login_oid oid;
BEGIN
  IF to_regclass('meta_ads_v1.connections') IS NULL
     OR to_regclass('meta_ads_v1.ad_accounts') IS NULL
     OR to_regclass('meta_ads_v1.collection_runs') IS NULL
     OR to_regclass('meta_ads_v1.daily_spend_observations') IS NULL
     OR to_regclass('public.store_memberships') IS NULL THEN
    RAISE EXCEPTION 'Meta Ads spend report prerequisites unavailable';
  END IF;
  SELECT oid INTO report_group_oid FROM pg_catalog.pg_roles WHERE rolname='night_scout_meta_ads_report_group';
  SELECT oid INTO report_login_oid FROM pg_catalog.pg_roles WHERE rolname='night_scout_meta_ads_report_login';
  IF report_group_oid IS NULL OR report_login_oid IS NULL THEN
    RAISE EXCEPTION 'Dedicated Meta Ads report group and login must be provisioned first';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE oid=report_group_oid
      AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
     OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE oid=report_login_oid
      AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
      AND NOT rolreplication AND NOT rolbypassrls AND rolinherit) THEN
    RAISE EXCEPTION 'Meta Ads report role attributes are unsafe';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE roleid=report_group_oid AND member=report_login_oid)
     OR (SELECT count(*) FROM pg_catalog.pg_auth_members WHERE roleid=report_group_oid)<>1
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=report_login_oid AND roleid<>report_group_oid)
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=report_group_oid)
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspname='meta_ads_v1'
       AND n.nspowner IN (report_group_oid,report_login_oid))
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='meta_ads_v1' AND c.relowner IN (report_group_oid,report_login_oid))
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='meta_ads_v1' AND p.proowner IN (report_group_oid,report_login_oid)) THEN
    RAISE EXCEPTION 'Meta Ads report role membership or ownership is unsafe';
  END IF;
END $$;

-- Report role can call only this function. It cannot call OAuth or collection
-- RPCs and cannot read tables directly. Remove any accidental direct grants.
REVOKE CREATE ON SCHEMA meta_ads_v1 FROM night_scout_meta_ads_report_group,night_scout_meta_ads_report_login;
REVOKE ALL ON SCHEMA meta_ads_v1 FROM night_scout_meta_ads_report_group,night_scout_meta_ads_report_login;
GRANT USAGE ON SCHEMA meta_ads_v1 TO night_scout_meta_ads_report_group;
REVOKE ALL ON ALL TABLES IN SCHEMA meta_ads_v1 FROM night_scout_meta_ads_report_group,night_scout_meta_ads_report_login;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA meta_ads_v1 FROM night_scout_meta_ads_report_group,night_scout_meta_ads_report_login;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA meta_ads_v1 FROM night_scout_meta_ads_report_group,night_scout_meta_ads_report_login;

-- No raw browser-table reads: all merchant reporting crosses this bounded RPC.
REVOKE ALL ON meta_ads_v1.connections,meta_ads_v1.ad_accounts,
  meta_ads_v1.collection_runs,meta_ads_v1.daily_spend_observations FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SCHEMA meta_ads_v1 FROM authenticated;

CREATE OR REPLACE FUNCTION meta_ads_v1.report_assert_login()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path=pg_catalog,meta_ads_v1 AS $$
BEGIN
  IF session_user<>'night_scout_meta_ads_report_login'
     OR NOT pg_has_role(session_user,'night_scout_meta_ads_report_group','member') THEN
    RAISE EXCEPTION 'Meta Ads report capability required';
  END IF;
END $$;
REVOKE ALL ON FUNCTION meta_ads_v1.report_assert_login()
  FROM PUBLIC,anon,authenticated,night_scout_meta_ads_api_group,night_scout_meta_ads_api_login,
    night_scout_meta_ads_collector_group,night_scout_meta_ads_collector_login,
    night_scout_meta_ads_report_group,night_scout_meta_ads_report_login;

-- Returns one row per date for the authoritative latest selected account.
-- Selection precedes eligibility; never fall back to an older grant. Null account metadata means not_connected;
-- for an active account, null coverage means not_collected. Every date with an
-- observation uses the most recent accepted run, never a sum across reruns.
-- Numeric minor units are returned exactly; the Node pg driver must retain
-- numeric(30,0) as a decimal string and the UI must not cast it to JS Number.
CREATE OR REPLACE FUNCTION meta_ads_v1.worker_read_daily_spend(
  p_user_id uuid,p_store_id uuid,p_from date,p_to date,p_now timestamptz
) RETURNS TABLE(
  provider_account_id text,currency text,timezone_name text,spend_date date,
  coverage_state text,spend_minor numeric(30,0),observed_at timestamptz,
  run_id uuid,run_status text,run_started_at timestamptz,
  connection_id uuid,account_selection_id uuid,selected_at text,
  connection_status text,reauthorization_required boolean
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,meta_ads_v1 AS $$
BEGIN
  PERFORM meta_ads_v1.report_assert_login();
  IF p_user_id IS NULL OR p_store_id IS NULL OR p_from IS NULL OR p_to IS NULL OR p_now IS NULL
     OR p_from>p_to OR p_to-p_from>92
     OR abs(extract(epoch FROM (clock_timestamp()-p_now)))>60 THEN
    RAISE EXCEPTION 'Meta Ads spend report unavailable';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.store_memberships sm
    WHERE sm.user_id=p_user_id AND sm.store_id=p_store_id) THEN
    RAISE EXCEPTION 'Meta Ads spend report unavailable';
  END IF;

  RETURN QUERY
  WITH latest_selection AS MATERIALIZED (
    SELECT a.*,c.created_by,c.status AS connection_status,c.disconnected_at,c.token_expires_at
    FROM meta_ads_v1.ad_accounts a
    JOIN meta_ads_v1.connections c ON c.id=a.connection_id AND c.store_id=a.store_id
    WHERE a.store_id=p_store_id AND a.selected_at IS NOT NULL
      AND a.selected_at=(SELECT max(latest.selected_at) FROM meta_ads_v1.ad_accounts latest WHERE latest.store_id=p_store_id)
  ), selected_account AS MATERIALIZED (
    SELECT a.id,a.connection_id,a.store_id,a.provider_account_id,a.currency::text AS currency,
      a.timezone_name,to_char(a.selected_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS selected_at,
      a.connection_status,
      (a.connection_status='reauthorization_required' OR a.token_expires_at IS NULL OR a.token_expires_at<=p_now) AS reauthorization_required
    FROM latest_selection a
    WHERE (SELECT count(*) FROM latest_selection)=1
      AND a.created_by=p_user_id AND a.disconnected_at IS NULL
      AND (a.connection_status='reauthorization_required' OR (a.connection_status='connected' AND a.active))
  ), latest_day AS (
    SELECT DISTINCT ON (o.spend_date)
      o.spend_date,o.coverage_state,o.spend_minor,o.observed_at,r.id AS run_id,
      r.status AS run_status,r.started_at AS run_started_at
    FROM selected_account a
    JOIN meta_ads_v1.collection_runs r
      ON r.account_id=a.id AND r.connection_id=a.connection_id AND r.store_id=a.store_id
    JOIN meta_ads_v1.daily_spend_observations o ON o.run_id=r.id AND o.account_id=a.id
    WHERE o.spend_date BETWEEN p_from AND p_to
      AND r.status IN ('complete','partial') AND r.finished_at IS NOT NULL AND r.finished_at<=p_now
    ORDER BY o.spend_date,o.observed_at DESC,r.started_at DESC,r.id DESC
  ), calendar AS (
    SELECT generate_series(p_from::timestamp without time zone,
      p_to::timestamp without time zone,interval '1 day')::date AS spend_date
  )
  SELECT a.provider_account_id,a.currency,a.timezone_name,cal.spend_date,l.coverage_state,
    l.spend_minor,l.observed_at,l.run_id,l.run_status,l.run_started_at,
    a.connection_id,a.id,a.selected_at,a.connection_status,a.reauthorization_required
  FROM selected_account a CROSS JOIN calendar cal
  LEFT JOIN latest_day l ON l.spend_date=cal.spend_date
  UNION ALL
  SELECT NULL::text,NULL::text,NULL::text,cal.spend_date,NULL::text,NULL::numeric,
    NULL::timestamptz,NULL::uuid,NULL::text,NULL::timestamptz,
    NULL::uuid,NULL::uuid,NULL::text,NULL::text,NULL::boolean
  FROM calendar cal WHERE NOT EXISTS(SELECT 1 FROM selected_account)
  ORDER BY 4;
END $$;

REVOKE ALL ON FUNCTION meta_ads_v1.worker_read_daily_spend(uuid,uuid,date,date,timestamptz)
  FROM PUBLIC,anon,authenticated,night_scout_meta_ads_api_group,night_scout_meta_ads_api_login,
    night_scout_meta_ads_collector_group,night_scout_meta_ads_collector_login,
    night_scout_meta_ads_report_group,night_scout_meta_ads_report_login;
GRANT EXECUTE ON FUNCTION meta_ads_v1.worker_read_daily_spend(uuid,uuid,date,date,timestamptz)
  TO night_scout_meta_ads_report_group;

DO $$
BEGIN
  IF has_function_privilege('night_scout_meta_ads_api_login',
      'meta_ads_v1.report_assert_login()','EXECUTE')
     OR has_function_privilege('night_scout_meta_ads_api_group',
      'meta_ads_v1.report_assert_login()','EXECUTE')
     OR has_function_privilege('night_scout_meta_ads_collector_login',
      'meta_ads_v1.report_assert_login()','EXECUTE')
     OR has_function_privilege('night_scout_meta_ads_collector_group',
      'meta_ads_v1.report_assert_login()','EXECUTE')
     OR has_function_privilege('night_scout_meta_ads_report_login',
      'meta_ads_v1.report_assert_login()','EXECUTE')
     OR has_function_privilege('night_scout_meta_ads_report_group',
      'meta_ads_v1.report_assert_login()','EXECUTE')
     OR has_function_privilege('authenticated','meta_ads_v1.report_assert_login()','EXECUTE')
     OR has_function_privilege('anon','meta_ads_v1.report_assert_login()','EXECUTE') THEN
    RAISE EXCEPTION 'Meta Ads report login assertion must stay private to its definer';
  END IF;
  IF NOT has_function_privilege('night_scout_meta_ads_report_login',
      'meta_ads_v1.worker_read_daily_spend(uuid,uuid,date,date,timestamptz)','EXECUTE')
     OR has_function_privilege('night_scout_meta_ads_api_login',
      'meta_ads_v1.worker_read_daily_spend(uuid,uuid,date,date,timestamptz)','EXECUTE')
     OR has_function_privilege('night_scout_meta_ads_collector_login',
      'meta_ads_v1.worker_read_daily_spend(uuid,uuid,date,date,timestamptz)','EXECUTE')
     OR has_function_privilege('authenticated',
      'meta_ads_v1.worker_read_daily_spend(uuid,uuid,date,date,timestamptz)','EXECUTE')
     OR has_function_privilege('anon',
      'meta_ads_v1.worker_read_daily_spend(uuid,uuid,date,date,timestamptz)','EXECUTE') THEN
    RAISE EXCEPTION 'Meta Ads report RPC permissions are unsafe';
  END IF;
  IF has_table_privilege('night_scout_meta_ads_report_login','meta_ads_v1.connections','SELECT')
     OR has_table_privilege('night_scout_meta_ads_report_login','meta_ads_v1.oauth_states','SELECT')
     OR has_table_privilege('night_scout_meta_ads_report_login','meta_ads_v1.credential_envelopes','SELECT')
     OR has_table_privilege('night_scout_meta_ads_report_login','meta_ads_v1.ad_accounts','SELECT')
     OR has_table_privilege('night_scout_meta_ads_report_login','meta_ads_v1.collection_runs','SELECT')
     OR has_table_privilege('night_scout_meta_ads_report_login','meta_ads_v1.daily_spend_observations','SELECT')
     OR has_table_privilege('night_scout_meta_ads_report_login','meta_ads_v1.credential_audit','SELECT')
     OR has_table_privilege('authenticated','meta_ads_v1.connections','SELECT')
     OR has_table_privilege('authenticated','meta_ads_v1.ad_accounts','SELECT')
     OR has_table_privilege('authenticated','meta_ads_v1.collection_runs','SELECT')
     OR has_table_privilege('authenticated','meta_ads_v1.daily_spend_observations','SELECT') THEN
    RAISE EXCEPTION 'Meta Ads report must not expose raw table reads';
  END IF;
END $$;

COMMIT;
