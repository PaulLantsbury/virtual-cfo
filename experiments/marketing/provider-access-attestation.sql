-- Read-only metadata attestation. $1 must be absent, installed or disabled.
-- No user rows, passwords, definitions, credentials or private bindings returned.
WITH expected_pairs AS (
 SELECT provider,capability,provider||'_ads_v1' AS schema_name,
   'night_scout_'||provider||'_ads_'||capability||'_group' AS group_name,
   'night_scout_'||provider||'_ads_'||capability||'_login' AS login_name
 FROM (VALUES ('meta'),('google')) p(provider)
 CROSS JOIN (VALUES ('api'),('report'),('collector')) c(capability)
), expected_roles AS (
 SELECT schema_name,group_name AS role_name,group_name,false AS is_login FROM expected_pairs
 UNION ALL SELECT schema_name,login_name,group_name,true FROM expected_pairs
), roles AS (
 SELECT e.*,r.oid,r.rolcanlogin,r.rolinherit,r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolbypassrls
 FROM expected_roles e LEFT JOIN pg_catalog.pg_roles r ON r.rolname=e.role_name
), namespaces AS (
 SELECT oid,nspname FROM pg_catalog.pg_namespace WHERE nspname IN ('meta_ads_v1','google_ads_v1')
), expected_rpcs(signature,group_name) AS (VALUES
  ('google_ads_v1.worker_activate_selected_account(bytea,uuid,uuid,text,text,text,text,timestamptz)','night_scout_google_ads_api_group'),
  ('google_ads_v1.worker_begin_collection_run(text,uuid,uuid,text,date,date,text,text,text,timestamptz)','night_scout_google_ads_collector_group'),
  ('google_ads_v1.worker_complete_collection_run(uuid,text,text,date,date,timestamptz,integer,jsonb,jsonb)','night_scout_google_ads_collector_group'),
  ('google_ads_v1.worker_consume_oauth_state(bytea,timestamptz)','night_scout_google_ads_api_group'),
  ('google_ads_v1.worker_create_oauth_state(bytea,uuid,uuid,timestamptz)','night_scout_google_ads_api_group'),
  ('google_ads_v1.worker_create_pending_connection(uuid,uuid,uuid,text[],text,bytea,bytea,text,text,bytea,timestamptz,jsonb)','night_scout_google_ads_api_group'),
  ('google_ads_v1.worker_disconnect_connection(uuid,uuid,uuid,timestamptz)','night_scout_google_ads_api_group'),
  ('google_ads_v1.worker_expire_pending_connections(timestamptz)','night_scout_google_ads_collector_group'),
  ('google_ads_v1.worker_fail_collection_run(uuid,text,timestamptz)','night_scout_google_ads_collector_group'),
  ('google_ads_v1.worker_get_credential_envelope(uuid,uuid,text)','night_scout_google_ads_collector_group'),
  ('google_ads_v1.worker_get_selected_account(uuid,uuid,text)','night_scout_google_ads_collector_group'),
  ('google_ads_v1.worker_list_active_accounts(timestamptz)','night_scout_google_ads_collector_group'),
  ('google_ads_v1.worker_read_daily_spend(uuid,uuid,date,date,timestamptz)','night_scout_google_ads_report_group'),
  ('google_ads_v1.worker_read_pending_credential(bytea,uuid,uuid,timestamptz)','night_scout_google_ads_api_group'),
  ('google_ads_v1.worker_read_pending_selection(bytea,uuid,uuid,timestamptz)','night_scout_google_ads_api_group'),
  ('google_ads_v1.worker_read_store_status(uuid,uuid,timestamptz)','night_scout_google_ads_api_group'),
  ('meta_ads_v1.worker_activate_selected_account(bytea,uuid,uuid,text,timestamptz)','night_scout_meta_ads_api_group'),
  ('meta_ads_v1.worker_begin_collection_run(text,uuid,uuid,text,date,date,text,text,text,timestamptz)','night_scout_meta_ads_collector_group'),
  ('meta_ads_v1.worker_cancel_pending_selection(bytea,uuid,uuid,timestamptz)','night_scout_meta_ads_api_group'),
  ('meta_ads_v1.worker_complete_collection_run(uuid,text,text,date,date,timestamptz,integer,jsonb,jsonb)','night_scout_meta_ads_collector_group'),
  ('meta_ads_v1.worker_consume_oauth_state(bytea,timestamptz)','night_scout_meta_ads_api_group'),
  ('meta_ads_v1.worker_create_oauth_state(bytea,uuid,uuid,timestamptz)','night_scout_meta_ads_api_group'),
  ('meta_ads_v1.worker_create_pending_connection(uuid,uuid,uuid,text[],timestamptz,bytea,bytea,text,text,bytea,timestamptz,jsonb)','night_scout_meta_ads_api_group'),
  ('meta_ads_v1.worker_disconnect_connection(uuid,uuid,uuid,timestamptz)','night_scout_meta_ads_api_group'),
  ('meta_ads_v1.worker_expire_pending_connections(timestamptz)','night_scout_meta_ads_collector_group'),
  ('meta_ads_v1.worker_fail_collection_run(uuid,text,timestamptz)','night_scout_meta_ads_collector_group'),
  ('meta_ads_v1.worker_get_credential_envelope(uuid,uuid,text)','night_scout_meta_ads_collector_group'),
  ('meta_ads_v1.worker_get_selected_account(uuid,uuid,text)','night_scout_meta_ads_collector_group'),
  ('meta_ads_v1.worker_list_active_accounts(timestamptz)','night_scout_meta_ads_collector_group'),
  ('meta_ads_v1.worker_read_daily_spend(uuid,uuid,date,date,timestamptz)','night_scout_meta_ads_report_group'),
  ('meta_ads_v1.worker_read_pending_selection(bytea,uuid,uuid,timestamptz)','night_scout_meta_ads_api_group'),
  ('meta_ads_v1.worker_read_store_status(uuid,uuid,timestamptz)','night_scout_meta_ads_api_group')
), resolved_rpcs AS (
 SELECT signature,group_name,pg_catalog.to_regprocedure(signature)::oid AS oid FROM expected_rpcs
), expected_reports(signature,result_contract) AS (VALUES
 ('meta_ads_v1.worker_read_daily_spend(uuid,uuid,date,date,timestamptz)','TABLE(provider_account_id text, currency text, timezone_name text, spend_date date, coverage_state text, spend_minor numeric, observed_at timestamp with time zone, run_id uuid, run_status text, run_started_at timestamp with time zone, connection_id uuid, account_selection_id uuid, selected_at text, connection_status text, reauthorization_required boolean)'),
 ('google_ads_v1.worker_read_daily_spend(uuid,uuid,date,date,timestamptz)','TABLE(customer_id text, login_customer_id text, currency text, timezone_name text, spend_date date, coverage_state text, spend_micros numeric, observed_at timestamp with time zone, run_id uuid, run_status text, run_started_at timestamp with time zone)')
), provider_functions AS (
 SELECT p.oid,p.pronamespace,p.prosecdef,p.proconfig FROM pg_catalog.pg_proc p JOIN namespaces n ON n.oid=p.pronamespace
), application_namespaces AS (
 SELECT oid,nspname FROM pg_catalog.pg_namespace WHERE nspname<>'information_schema' AND nspname !~ '^pg_'
), provider_tables AS (
 SELECT c.oid FROM pg_catalog.pg_class c JOIN namespaces n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p','v','m','f')
), provider_sequences AS (
 SELECT c.oid FROM pg_catalog.pg_class c JOIN namespaces n ON n.oid=c.relnamespace WHERE c.relkind='S'
), application_tables AS (
 SELECT c.oid FROM pg_catalog.pg_class c JOIN application_namespaces n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p','v','m','f')
), application_sequences AS (
 SELECT c.oid FROM pg_catalog.pg_class c JOIN application_namespaces n ON n.oid=c.relnamespace WHERE c.relkind='S'
), checked_roles AS (
 SELECT role_name,group_name,oid FROM roles WHERE oid IS NOT NULL
 UNION ALL SELECT rolname,NULL::text,oid FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated')
), checks AS (
 SELECT
  $1::text IN ('absent','installed','disabled') AS mode_valid,
  (SELECT pg_catalog.count(*)::integer FROM namespaces) AS schema_count,
  (SELECT pg_catalog.count(*)::integer FROM pg_catalog.pg_roles WHERE rolname ~ '^night_scout_(meta|google)_ads_') AS role_count,
  (SELECT pg_catalog.count(*)::integer FROM resolved_rpcs WHERE oid IS NOT NULL) AS rpc_count,
  NOT EXISTS(SELECT 1 FROM roles WHERE oid IS NULL) AS roles_complete,
  NOT EXISTS(SELECT 1 FROM roles WHERE oid IS NULL OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls
    OR (is_login AND (NOT rolinherit OR rolcanlogin<>($1::text='installed'))) OR (NOT is_login AND rolcanlogin)) AS role_flags_safe,
  NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m
    WHERE (m.member IN (SELECT oid FROM roles) OR m.roleid IN (SELECT oid FROM roles))
      AND (m.admin_option OR NOT EXISTS(SELECT 1 FROM expected_pairs e JOIN pg_catalog.pg_roles g ON g.rolname=e.group_name
        JOIN pg_catalog.pg_roles l ON l.rolname=e.login_name WHERE m.roleid=g.oid AND m.member=l.oid)))
   AND NOT EXISTS(SELECT 1 FROM expected_pairs e WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m
     JOIN pg_catalog.pg_roles g ON g.oid=m.roleid JOIN pg_catalog.pg_roles l ON l.oid=m.member
     WHERE g.rolname=e.group_name AND l.rolname=e.login_name AND NOT m.admin_option)) AS memberships_safe,
  NOT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspowner IN (SELECT oid FROM roles))
   AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE relowner IN (SELECT oid FROM roles))
   AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE proowner IN (SELECT oid FROM roles))
   AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_database WHERE datdba IN (SELECT oid FROM roles)) AS ownership_safe,
  NOT EXISTS(SELECT 1 FROM checked_roles r CROSS JOIN provider_tables t
    WHERE pg_catalog.has_table_privilege(r.oid,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
   AND NOT EXISTS(SELECT 1 FROM roles r CROSS JOIN application_tables t WHERE r.oid IS NOT NULL
     AND pg_catalog.has_table_privilege(r.oid,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) AS tables_safe,
  NOT EXISTS(SELECT 1 FROM checked_roles r CROSS JOIN provider_sequences s
    WHERE pg_catalog.has_sequence_privilege(r.oid,s.oid,'USAGE,SELECT,UPDATE'))
   AND NOT EXISTS(SELECT 1 FROM roles r CROSS JOIN application_sequences s WHERE r.oid IS NOT NULL
     AND pg_catalog.has_sequence_privilege(r.oid,s.oid,'USAGE,SELECT,UPDATE')) AS sequences_safe,
  NOT EXISTS(SELECT 1 FROM roles r CROSS JOIN namespaces n WHERE r.oid IS NOT NULL
    AND (pg_catalog.has_schema_privilege(r.oid,n.oid,'CREATE') OR pg_catalog.has_schema_privilege(r.oid,n.oid,'USAGE')<>(r.schema_name=n.nspname)))
   AND NOT EXISTS(SELECT 1 FROM checked_roles r CROSS JOIN namespaces n WHERE r.group_name IS NULL
    AND pg_catalog.has_schema_privilege(r.oid,n.oid,'USAGE,CREATE'))
   AND NOT EXISTS(SELECT 1 FROM roles r CROSS JOIN application_namespaces n WHERE r.oid IS NOT NULL
     AND pg_catalog.has_schema_privilege(r.oid,n.oid,'CREATE')) AS schemas_safe,
  NOT EXISTS(SELECT 1 FROM resolved_rpcs WHERE oid IS NULL)
   AND NOT EXISTS(SELECT 1 FROM checked_roles r CROSS JOIN provider_functions p
    WHERE pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE')<>EXISTS(SELECT 1 FROM resolved_rpcs e WHERE e.oid=p.oid AND e.group_name=r.group_name)) AS rpc_matrix_safe,
  NOT EXISTS(SELECT 1 FROM resolved_rpcs e JOIN provider_functions p ON p.oid=e.oid
    JOIN namespaces n ON n.oid=p.pronamespace
    WHERE NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, '||n.nspname]) AS function_config_safe,
  NOT EXISTS(SELECT 1 FROM expected_reports e WHERE pg_catalog.to_regprocedure(e.signature) IS NULL
    OR pg_catalog.pg_get_function_result(pg_catalog.to_regprocedure(e.signature)) IS DISTINCT FROM e.result_contract) AS report_contracts_safe,
  NOT EXISTS(SELECT 1 FROM pg_catalog.pg_default_acl d CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
    WHERE (d.defaclnamespace=0 OR d.defaclnamespace IN (SELECT oid FROM application_namespaces))
      AND ((d.defaclobjtype IN ('r','S') AND (a.grantee=0 OR a.grantee IN (SELECT oid FROM roles)))
        OR ((d.defaclnamespace=0 OR d.defaclnamespace IN (SELECT oid FROM namespaces)) AND d.defaclobjtype IN ('r','S','f')
          AND (a.grantee=0 OR a.grantee IN (SELECT oid FROM checked_roles))))) AS default_acls_safe,
  NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN application_namespaces n ON n.oid=p.pronamespace
    CROSS JOIN roles r WHERE r.oid IS NOT NULL AND p.prosecdef
      AND n.oid NOT IN (SELECT oid FROM namespaces)
      AND pg_catalog.has_schema_privilege(r.oid,n.oid,'USAGE')
      AND pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE')) AS external_definers_safe,
  NOT EXISTS(SELECT 1 FROM pg_catalog.pg_stat_activity WHERE usename IN (SELECT role_name FROM roles)) AS no_provider_sessions
)
SELECT *,CASE WHEN $1::text='absent' THEN mode_valid AND schema_count=0 AND role_count=0 AND rpc_count=0
 ELSE mode_valid AND schema_count=2 AND role_count=12 AND rpc_count=32 AND roles_complete AND role_flags_safe
 AND memberships_safe AND ownership_safe AND tables_safe AND sequences_safe AND schemas_safe
 AND rpc_matrix_safe AND function_config_safe AND report_contracts_safe AND default_acls_safe AND external_definers_safe AND ($1::text<>'disabled' OR no_provider_sessions) END AS accepted
FROM checks;
