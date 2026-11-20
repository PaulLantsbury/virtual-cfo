-- UNAPPROVED SOURCE-ONLY PROPOSAL. No provider consent, passwords, schedules or
-- generation enabled. Dedicated demo store/schema/capabilities only; never modify
-- existing xero_v1 objects/roles/credentials/jobs or test-writer programmes.
-- Reviewed legacy function bodies are expanded below with explicit schema/login
-- substitutions and bounded new-demo guards; see the SQL contract document.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=pg_catalog,public;
LOCK TABLE public.stores,public.store_memberships IN SHARE ROW EXCLUSIVE MODE;
DO $guard$ BEGIN
 IF clock_timestamp()>='2026-11-06T03:00:00Z'::timestamptz THEN RAISE EXCEPTION 'Demo setup proposal expired; fresh review required'; END IF;
 IF current_setting('server_version_num')::integer<170000 OR to_regprocedure('auth.uid()') IS NULL
  OR to_regclass('auth.users') IS NULL OR to_regclass('xero_v1.connections') IS NULL
  OR to_regprocedure('xero_v1.worker_get_single_connection_preflight_job()') IS NULL
  OR to_regprocedure('xero_v1.worker_get_single_refresh_job(date,date,text,boolean)') IS NULL
 THEN RAISE EXCEPTION 'Existing staging reader prerequisites required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.stores WHERE id='56d92f8a-746e-4b4f-b408-81fc98c4aa17' AND shopify_domain='pocketlaunchpad1.myshopify.com' AND shopify_store_id='95601983836' AND currency_code='GBP' AND timezone='Europe/London')
  OR (SELECT count(*) FROM public.store_memberships WHERE store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17')<>1
  OR NOT EXISTS(SELECT 1 FROM public.store_memberships m JOIN auth.users u ON u.id=m.user_id WHERE m.store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17')
 THEN RAISE EXCEPTION 'Exact original store and sole existing owner required'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid IN ('public.stores'::regclass,'public.store_memberships'::regclass) AND NOT relrowsecurity) THEN RAISE EXCEPTION 'Existing member RLS required'; END IF;
 IF to_regnamespace('xero_demo_v1') IS NOT NULL
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ('night_scout_demo_import_login','night_scout_demo_import_service','night_scout_demo_bootstrap_login','night_scout_demo_bootstrap_service'))
  OR EXISTS(SELECT 1 FROM public.stores WHERE id='f59e3a44-7106-4df8-9c08-52da30c9de30' OR shopify_domain='xero-demo-only.invalid' OR shopify_store_id='night-scout-xero-demo-only')
  OR to_regprocedure('public.xero_demo_member_active_tenant_binding_v1(uuid)') IS NOT NULL
  OR to_regprocedure('public.xero_demo_reader_status_v1(uuid)') IS NOT NULL
 THEN RAISE EXCEPTION 'New demo target occupied; inspect without resetting'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='anon') OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='authenticated') THEN RAISE EXCEPTION 'Existing auth roles required'; END IF;
END $guard$;
-- Reserved .invalid metadata identifies a non-Shopify synthetic logical store.
-- It is not a real Shopify identity, connection or collector target.
INSERT INTO public.stores(id,name,shopify_domain,shopify_store_id,currency_code,timezone,is_active)
VALUES('f59e3a44-7106-4df8-9c08-52da30c9de30','Night Scout — isolated Xero Demo','xero-demo-only.invalid','night-scout-xero-demo-only','GBP','Europe/London',true);
INSERT INTO public.store_memberships(user_id,store_id)
SELECT user_id,'f59e3a44-7106-4df8-9c08-52da30c9de30'::uuid FROM public.store_memberships WHERE store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17';
CREATE ROLE night_scout_demo_import_service NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE night_scout_demo_bootstrap_service NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE night_scout_demo_import_login LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 1 PASSWORD NULL;
CREATE ROLE night_scout_demo_bootstrap_login LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 1 PASSWORD NULL;
GRANT night_scout_demo_import_service TO night_scout_demo_import_login WITH ADMIN FALSE,INHERIT FALSE,SET TRUE;
GRANT night_scout_demo_bootstrap_service TO night_scout_demo_bootstrap_login WITH ADMIN FALSE,INHERIT FALSE,SET TRUE;

-- EXPANDED REVIEWED TABLE/FUNCTION CLONES FOLLOW. No DDL targets xero_v1.
CREATE SCHEMA xero_demo_v1;

CREATE TABLE xero_demo_v1.connections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES public.stores(id) CHECK(store_id='f59e3a44-7106-4df8-9c08-52da30c9de30'),
 tenant_id text NOT NULL CHECK (length(trim(tenant_id)) BETWEEN 1 AND 256),
 created_at timestamptz NOT NULL DEFAULT now(),
 retired_at timestamptz,
 UNIQUE (store_id,tenant_id),
 CHECK (retired_at IS NULL OR retired_at>=created_at)
);
-- A tenant may be connected to only one active Night Scout store.  Retiring a
-- connection frees that tenant for an explicitly new staging connection while
-- preserving the old mapping/audit provenance.
CREATE UNIQUE INDEX xero_connections_active_tenant_unique
 ON xero_demo_v1.connections (tenant_id) WHERE retired_at IS NULL;
CREATE TABLE xero_demo_v1.account_directories (
 connection_id uuid NOT NULL REFERENCES xero_demo_v1.connections(id),
 retrieved_at timestamptz NOT NULL,
 account_id text NOT NULL CHECK (length(trim(account_id)) BETWEEN 1 AND 256),
 account_name text NOT NULL CHECK (length(trim(account_name)) BETWEEN 1 AND 256),
 account_type text NOT NULL CHECK (length(trim(account_type)) BETWEEN 1 AND 64),
 account_status text NOT NULL CHECK (length(trim(account_status)) BETWEEN 1 AND 64),
 PRIMARY KEY (connection_id,retrieved_at,account_id)
);
CREATE TABLE xero_demo_v1.mapping_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 connection_id uuid NOT NULL REFERENCES xero_demo_v1.connections(id),
 version integer NOT NULL CHECK (version>0), effective_from date NOT NULL,
 confirmed_by uuid NOT NULL REFERENCES auth.users(id), confirmed_at timestamptz NOT NULL,
 directory_retrieved_at timestamptz NOT NULL,
 supersedes_id uuid REFERENCES xero_demo_v1.mapping_versions(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(connection_id,version), UNIQUE(id,connection_id), UNIQUE(supersedes_id),
 CHECK ((version=1 AND supersedes_id IS NULL) OR (version>1 AND supersedes_id IS NOT NULL)),
 FOREIGN KEY(supersedes_id,connection_id) REFERENCES xero_demo_v1.mapping_versions(id,connection_id)
);
CREATE TABLE xero_demo_v1.mapping_selections (
 mapping_version_id uuid NOT NULL REFERENCES xero_demo_v1.mapping_versions(id),
 category text NOT NULL CHECK (category IN ('revenue','processingFee','advertising','software','includedCash')),
 account_id text NOT NULL CHECK (length(trim(account_id)) BETWEEN 1 AND 256),
 PRIMARY KEY(mapping_version_id,category,account_id), UNIQUE(mapping_version_id,account_id)
);
CREATE TABLE xero_demo_v1.mapping_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), connection_id uuid NOT NULL REFERENCES xero_demo_v1.connections(id),
 mapping_version_id uuid REFERENCES xero_demo_v1.mapping_versions(id),
 action text NOT NULL CHECK (action IN ('confirmed','superseded','review_required')),
 reason text CHECK (reason IS NULL OR reason IN ('account_missing','account_inactive','account_wrong_type','directory_changed','currency_or_cutoff_review_required')),
 actor_id uuid REFERENCES auth.users(id), occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE xero_demo_v1.credential_envelopes (
 connection_id uuid PRIMARY KEY REFERENCES xero_demo_v1.connections(id) ON DELETE CASCADE,
 ciphertext bytea NOT NULL CHECK (octet_length(ciphertext) BETWEEN 1 AND 16384),
 encrypted_dek bytea NOT NULL CHECK (octet_length(encrypted_dek) BETWEEN 1 AND 16384),
 key_version text NOT NULL CHECK (length(trim(key_version)) BETWEEN 1 AND 128),
 algorithm text NOT NULL CHECK (algorithm IN ('AES-256-GCM')),
 version integer NOT NULL CHECK (version > 0), created_at timestamptz NOT NULL DEFAULT now(),
 rotated_at timestamptz, lease_expires_at timestamptz,
 CHECK (rotated_at IS NULL OR rotated_at >= created_at)
);
CREATE TABLE xero_demo_v1.credential_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), connection_id uuid REFERENCES xero_demo_v1.connections(id) ON DELETE SET NULL,
 actor_id uuid REFERENCES auth.users(id),
 action text NOT NULL CHECK (action IN ('credential_stored','credential_rotated','credential_refresh_failed','credential_deleted')),
 safe_reason text CHECK (safe_reason IS NULL OR safe_reason IN ('invalid_grant','provider_unavailable','refresh_failed','scope_changed','tenant_unavailable')),
 occurred_at timestamptz NOT NULL DEFAULT now()
);

-- Bounded, append-only calculated evidence. Raw Xero reports, OAuth material,
-- transactions and Shopify values never enter these relations.
CREATE TABLE xero_demo_v1.accounting_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 connection_id uuid NOT NULL REFERENCES xero_demo_v1.connections(id),
 mapping_version_id uuid NOT NULL,
 scope_from date NOT NULL, scope_to date NOT NULL,
 currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'), closed_period boolean NOT NULL DEFAULT false,
 state text NOT NULL CHECK (state IN ('supported','failed','review_required','invalidated')),
 reason text CHECK (reason IS NULL OR reason IN ('source_refresh_failed','source_review_required','account_mapping_review_required','later_posting_review_required','accounting_evidence_unavailable','connection_disconnected')),
 report_as_of date, retrieved_at timestamptz NOT NULL,
 source_fingerprint text CHECK (source_fingerprint IS NULL OR source_fingerprint ~ '^[a-f0-9]{64}$'),
 booked_revenue_minor bigint, processing_fee_minor bigint, advertising_minor bigint, software_minor bigint, included_cash_minor bigint,
 created_at timestamptz NOT NULL DEFAULT now(), CHECK (scope_from <= scope_to),
 CHECK ((state='supported' AND reason IS NULL AND report_as_of IS NOT NULL AND source_fingerprint IS NOT NULL
  AND booked_revenue_minor IS NOT NULL AND processing_fee_minor IS NOT NULL AND advertising_minor IS NOT NULL AND software_minor IS NOT NULL AND included_cash_minor IS NOT NULL)
  OR (state<>'supported' AND report_as_of IS NULL AND source_fingerprint IS NULL AND booked_revenue_minor IS NULL AND processing_fee_minor IS NULL AND advertising_minor IS NULL AND software_minor IS NULL AND included_cash_minor IS NULL)),
 FOREIGN KEY(mapping_version_id,connection_id) REFERENCES xero_demo_v1.mapping_versions(id,connection_id)
);
CREATE INDEX xero_accounting_evidence_lookup ON xero_demo_v1.accounting_evidence(connection_id,scope_from,scope_to,currency,closed_period,created_at DESC);
CREATE FUNCTION xero_demo_v1.reject_accounting_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'xero accounting evidence is append-only'; END $$;
CREATE TRIGGER xero_accounting_evidence_append_only BEFORE UPDATE OR DELETE ON xero_demo_v1.accounting_evidence FOR EACH ROW EXECUTE FUNCTION xero_demo_v1.reject_accounting_evidence_mutation();
CREATE TABLE xero_demo_v1.accounting_evidence_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), evidence_id uuid NOT NULL REFERENCES xero_demo_v1.accounting_evidence(id),
 action text NOT NULL CHECK (action IN ('recorded','served_stale','review_required')),
 actor_kind text NOT NULL CHECK (actor_kind IN ('worker','server')), occurred_at timestamptz NOT NULL DEFAULT now(), UNIQUE(evidence_id,action)
);


CREATE UNIQUE INDEX xero_demo_one_active_store ON xero_demo_v1.connections(store_id) WHERE retired_at IS NULL;
CREATE TABLE xero_demo_v1.connection_preflight_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 connection_id uuid NOT NULL REFERENCES xero_demo_v1.connections(id),
 checked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 outcome text NOT NULL CHECK(outcome IN ('connected','failed')),
 phase text NOT NULL CHECK(phase IN ('token','connection','organisation')),
 reason text NOT NULL CHECK(reason IN (
  'ok','invalid_grant','refresh_failed','insufficient_scope','unauthorized',
  'forbidden','reconnect_required','rate_limited','upstream_unavailable',
  'provider_unavailable','malformed_response','non_demo_organisation','unsupported_currency'
 )),
 provider_status smallint CHECK(provider_status IN (401,403,429,500,502,503,504)),
 tenant_visible boolean,
 credential_version integer NOT NULL CHECK(credential_version>0),
 CHECK(
  (outcome='connected' AND phase='organisation' AND reason='ok'
   AND provider_status IS NULL AND tenant_visible=true)
  OR
  (outcome='failed' AND reason<>'ok')
 )
);


-- Source-reviewed clone: 20260924_bind_xero_bootstrap_connection_id.sql / bootstrap_create_initial_connection (new-schema/login substitutions only except documented demo guards).
CREATE FUNCTION xero_demo_v1.bootstrap_create_initial_connection(
 p_connection_id uuid,p_store_id uuid,p_tenant_id text,p_owner_id uuid,p_effective_from date,
 p_directory_retrieved_at timestamptz,p_accounts jsonb,p_mapping jsonb,
 p_ciphertext bytea,p_encrypted_dek bytea,p_key_version text,p_algorithm text
) RETURNS TABLE(connection_id uuid,mapping_version_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,xero_demo_v1 AS $$
DECLARE v_mapping uuid;v_account jsonb;v_selection jsonb;v_category text;v_account_id text;
 v_directory_count integer:=0;v_mapping_count integer:=0;
BEGIN
 IF clock_timestamp()<'2026-10-30T00:00:00Z'::timestamptz OR clock_timestamp()>='2026-11-06T03:00:00Z'::timestamptz THEN RAISE EXCEPTION 'Demo reader trial outside approved window'; END IF;
 IF session_user<>'night_scout_demo_bootstrap_login' THEN RAISE EXCEPTION 'Xero bootstrap capability required'; END IF;
 IF p_store_id IS DISTINCT FROM 'f59e3a44-7106-4df8-9c08-52da30c9de30'::uuid
  OR p_tenant_id IS NULL OR p_tenant_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  OR p_algorithm IS DISTINCT FROM 'AES-256-GCM' OR p_key_version IS NULL
  OR p_ciphertext IS NULL OR p_encrypted_dek IS NULL OR octet_length(p_ciphertext)<30 OR octet_length(p_encrypted_dek)<30
  OR p_directory_retrieved_at IS NULL OR NOT isfinite(p_directory_retrieved_at) OR p_directory_retrieved_at>clock_timestamp() OR p_directory_retrieved_at<clock_timestamp()-interval '5 minutes'
  OR p_effective_from IS NULL OR NOT isfinite(p_effective_from) OR p_effective_from>current_date
  OR (SELECT count(*) FROM public.store_memberships WHERE store_id=p_store_id)<>1
 THEN RAISE EXCEPTION 'Exact isolated demo bootstrap required'; END IF;
 DECLARE proof jsonb; observed timestamptz;
 BEGIN
  proof:=nullif(current_setting('night_scout.demo_reader_source_receipt',true),'')::jsonb;
  IF proof IS NULL OR jsonb_typeof(proof)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(proof))<>7
   OR proof->>'connectionId' IS DISTINCT FROM p_connection_id::text OR proof->>'storeId' IS DISTINCT FROM p_store_id::text
   OR proof->>'ownerId' IS DISTINCT FROM p_owner_id::text OR proof->>'tenantId' IS DISTINCT FROM p_tenant_id
   OR proof->'isDemoCompany' IS DISTINCT FROM 'true'::jsonb OR proof->>'baseCurrency' IS DISTINCT FROM 'GBP'
   OR jsonb_typeof(proof->'observedAt') IS DISTINCT FROM 'string'
  THEN RAISE EXCEPTION 'Fresh actual GBP demo source receipt required'; END IF;
  observed:=(proof->>'observedAt')::timestamptz;
  IF NOT isfinite(observed) OR observed>clock_timestamp() OR observed<clock_timestamp()-interval '5 minutes' THEN RAISE EXCEPTION 'Fresh actual GBP demo source receipt required'; END IF;
 END;

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
 IF EXISTS(SELECT 1 FROM xero_demo_v1.connections WHERE id=p_connection_id) THEN RAISE EXCEPTION 'Xero connection identifier already exists'; END IF;
 IF EXISTS(SELECT 1 FROM xero_demo_v1.connections WHERE store_id=p_store_id AND retired_at IS NULL) THEN RAISE EXCEPTION 'active Xero connection already exists for store'; END IF;
 IF EXISTS(SELECT 1 FROM xero_demo_v1.connections WHERE tenant_id=trim(p_tenant_id) AND retired_at IS NULL) THEN RAISE EXCEPTION 'active Xero tenant already belongs to a store'; END IF;
 INSERT INTO xero_demo_v1.connections(id,store_id,tenant_id) VALUES(p_connection_id,p_store_id,trim(p_tenant_id));
 FOR v_account IN SELECT value FROM jsonb_array_elements(p_accounts) LOOP
  IF jsonb_typeof(v_account)<>'object' OR (v_account ?& ARRAY['accountId','accountName','accountType','accountStatus']) IS FALSE
   OR (SELECT count(*) FROM jsonb_object_keys(v_account))<>4
   OR coalesce(v_account->>'accountId','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   OR length(trim(coalesce(v_account->>'accountName',''))) NOT BETWEEN 1 AND 256
   OR length(trim(coalesce(v_account->>'accountType',''))) NOT BETWEEN 1 AND 64
   OR length(trim(coalesce(v_account->>'accountStatus',''))) NOT BETWEEN 1 AND 64 THEN RAISE EXCEPTION 'invalid Xero account directory'; END IF;
  INSERT INTO xero_demo_v1.account_directories(connection_id,retrieved_at,account_id,account_name,account_type,account_status)
   VALUES(p_connection_id,p_directory_retrieved_at,trim(v_account->>'accountId'),trim(v_account->>'accountName'),trim(v_account->>'accountType'),trim(v_account->>'accountStatus'));
  v_directory_count:=v_directory_count+1;
 END LOOP;
 IF v_directory_count=0 OR v_directory_count>1000 THEN RAISE EXCEPTION 'bounded Xero account directory required'; END IF;
 INSERT INTO xero_demo_v1.mapping_versions(connection_id,version,effective_from,confirmed_by,confirmed_at,directory_retrieved_at)
  VALUES(p_connection_id,1,p_effective_from,p_owner_id,now(),p_directory_retrieved_at) RETURNING id INTO v_mapping;
 FOR v_selection IN SELECT value FROM jsonb_array_elements(p_mapping) LOOP
  IF jsonb_typeof(v_selection)<>'object' OR (v_selection ?& ARRAY['category','accountId']) IS FALSE
   OR (SELECT count(*) FROM jsonb_object_keys(v_selection))<>2 THEN RAISE EXCEPTION 'invalid Xero mapping selection'; END IF;
  v_category:=v_selection->>'category';v_account_id:=trim(coalesce(v_selection->>'accountId',''));
  IF v_category NOT IN ('revenue','processingFee','advertising','software','includedCash') OR length(v_account_id) NOT BETWEEN 1 AND 256
   OR NOT EXISTS(SELECT 1 FROM xero_demo_v1.account_directories ad WHERE ad.connection_id=p_connection_id AND ad.retrieved_at=p_directory_retrieved_at AND ad.account_id=v_account_id AND ad.account_status='ACTIVE'
    AND ((v_category='revenue' AND ad.account_type IN ('REVENUE','SALES')) OR (v_category IN ('processingFee','advertising','software') AND ad.account_type IN ('EXPENSE','OVERHEADS')) OR (v_category='includedCash' AND ad.account_type='BANK')))
   THEN RAISE EXCEPTION 'invalid active Xero mapping selection'; END IF;
  INSERT INTO xero_demo_v1.mapping_selections(mapping_version_id,category,account_id) VALUES(v_mapping,v_category,v_account_id);v_mapping_count:=v_mapping_count+1;
 END LOOP;
 IF v_mapping_count<5 OR v_mapping_count>100 OR (SELECT count(DISTINCT ms.category) FROM xero_demo_v1.mapping_selections ms WHERE ms.mapping_version_id=v_mapping)<>5
  THEN RAISE EXCEPTION 'complete Xero mapping required'; END IF;
 INSERT INTO xero_demo_v1.mapping_audit(connection_id,mapping_version_id,action,actor_id) VALUES(p_connection_id,v_mapping,'confirmed',p_owner_id);
 INSERT INTO xero_demo_v1.credential_envelopes(connection_id,ciphertext,encrypted_dek,key_version,algorithm,version,rotated_at)
  VALUES(p_connection_id,p_ciphertext,p_encrypted_dek,p_key_version,p_algorithm,1,now());
 INSERT INTO xero_demo_v1.credential_audit(connection_id,actor_id,action) VALUES(p_connection_id,p_owner_id,'credential_stored');
 RETURN QUERY SELECT p_connection_id,v_mapping;
END $$;

-- Source-reviewed clone: 20260924_bind_xero_bootstrap_connection_id.sql / worker_get_refresh_context (new-schema/login substitutions only except documented demo guards).
CREATE FUNCTION xero_demo_v1.worker_get_refresh_context(p_connection_id uuid,p_mapping_version_id uuid)
RETURNS TABLE(connection_id uuid,tenant_id text,mapping_version_id uuid,mapping jsonb,
 ciphertext bytea,encrypted_dek bytea,key_version text,algorithm text,version integer,lease_expires_at timestamptz,store_id uuid)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=pg_catalog,xero_demo_v1 AS $$
BEGIN
 IF clock_timestamp()<'2026-10-30T00:00:00Z'::timestamptz OR clock_timestamp()>='2026-11-06T03:00:00Z'::timestamptz THEN RAISE EXCEPTION 'Demo reader trial outside approved window'; END IF;
 IF session_user<>'night_scout_demo_import_login' THEN RAISE EXCEPTION 'Xero worker capability required'; END IF;
 RETURN QUERY
 SELECT c.id,c.tenant_id,mv.id,
  (SELECT jsonb_object_agg(grouped.category,grouped.account_ids) FROM
    (SELECT ms.category,jsonb_agg(ms.account_id ORDER BY ms.account_id) account_ids
     FROM xero_demo_v1.mapping_selections ms WHERE ms.mapping_version_id=mv.id GROUP BY ms.category) grouped),
  ce.ciphertext,ce.encrypted_dek,ce.key_version,ce.algorithm,ce.version,ce.lease_expires_at,c.store_id
 FROM xero_demo_v1.connections c JOIN xero_demo_v1.mapping_versions mv ON mv.connection_id=c.id
 JOIN xero_demo_v1.credential_envelopes ce ON ce.connection_id=c.id
 WHERE c.id=p_connection_id AND mv.id=p_mapping_version_id AND c.retired_at IS NULL;
END $$;

-- Source-reviewed clone: 20260924_bind_xero_bootstrap_connection_id.sql / worker_get_latest_supported_evidence (new-schema/login substitutions only except documented demo guards).
CREATE FUNCTION xero_demo_v1.worker_get_latest_supported_evidence(
 p_connection_id uuid,p_mapping_version_id uuid,p_scope_from date,p_scope_to date,
 p_currency text,p_closed_period boolean)
RETURNS TABLE(evidence_id uuid,report_as_of text,retrieved_at timestamptz,source_fingerprint text,
 booked_revenue_minor bigint,processing_fee_minor bigint,advertising_minor bigint,software_minor bigint,included_cash_minor bigint)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=pg_catalog,xero_demo_v1 AS $$
BEGIN
 IF session_user<>'night_scout_demo_import_login' THEN RAISE EXCEPTION 'Xero worker capability required'; END IF;
 RETURN QUERY SELECT ae.id,ae.report_as_of::text,ae.retrieved_at,ae.source_fingerprint,
  ae.booked_revenue_minor,ae.processing_fee_minor,ae.advertising_minor,ae.software_minor,ae.included_cash_minor
 FROM xero_demo_v1.accounting_evidence ae
 WHERE ae.connection_id=p_connection_id AND ae.mapping_version_id=p_mapping_version_id
  AND ae.scope_from=p_scope_from AND ae.scope_to=p_scope_to AND ae.currency=p_currency
  AND ae.closed_period=p_closed_period AND ae.state='supported'
 ORDER BY ae.created_at DESC,ae.id DESC LIMIT 1;
END $$;

-- Source-reviewed clone: 20260924_bind_xero_bootstrap_connection_id.sql / worker_acquire_refresh_lease (new-schema/login substitutions only except documented demo guards).
CREATE FUNCTION xero_demo_v1.worker_acquire_refresh_lease(
 p_connection_id uuid,p_expected_version integer,p_lease_seconds integer)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,xero_demo_v1 AS $$
DECLARE acquired_until timestamptz;
BEGIN
 IF clock_timestamp()<'2026-10-30T00:00:00Z'::timestamptz OR clock_timestamp()>='2026-11-06T03:00:00Z'::timestamptz THEN RETURN NULL; END IF;
 IF session_user<>'night_scout_demo_import_login' THEN RAISE EXCEPTION 'Xero worker capability required'; END IF;
 IF p_connection_id IS NULL OR p_expected_version<1 OR p_lease_seconds NOT BETWEEN 30 AND 300 THEN
  RAISE EXCEPTION 'invalid Xero refresh lease request'; END IF;
 UPDATE xero_demo_v1.credential_envelopes e SET lease_expires_at=date_trunc('milliseconds',clock_timestamp()+make_interval(secs=>p_lease_seconds))
 FROM xero_demo_v1.connections c
 WHERE e.connection_id=p_connection_id AND e.version=p_expected_version
  AND c.id=e.connection_id AND c.retired_at IS NULL
  AND (e.lease_expires_at IS NULL OR e.lease_expires_at<=clock_timestamp())
 RETURNING e.lease_expires_at INTO acquired_until;
 RETURN acquired_until;
END $$;

-- Source-reviewed clone: 20260924_bind_xero_bootstrap_connection_id.sql / worker_release_refresh_lease (new-schema/login substitutions only except documented demo guards).
CREATE FUNCTION xero_demo_v1.worker_release_refresh_lease(
 p_connection_id uuid,p_expected_version integer,p_expected_lease_expires_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,xero_demo_v1 AS $$
DECLARE released uuid;
BEGIN
 IF session_user<>'night_scout_demo_import_login' THEN RAISE EXCEPTION 'Xero worker capability required'; END IF;
 IF p_connection_id IS NULL OR p_expected_version<1 OR p_expected_lease_expires_at IS NULL THEN RAISE EXCEPTION 'invalid Xero refresh lease request'; END IF;
 UPDATE xero_demo_v1.credential_envelopes SET lease_expires_at=NULL
 WHERE connection_id=p_connection_id AND version=p_expected_version AND lease_expires_at=p_expected_lease_expires_at
 RETURNING connection_id INTO released;
 RETURN released IS NOT NULL;
END $$;

-- Source-reviewed clone: 20260925_xero_single_refresh_job.sql / worker_get_single_refresh_job (new-schema/login substitutions only except documented demo guards).
CREATE FUNCTION xero_demo_v1.worker_get_single_refresh_job(
 p_scope_from date,p_scope_to date,p_currency text,p_closed_period boolean)
RETURNS TABLE(connection_id uuid,mapping_version_id uuid)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path=pg_catalog,xero_demo_v1 AS $$
DECLARE candidate_count integer;
BEGIN
 IF clock_timestamp()<'2026-10-30T00:00:00Z'::timestamptz OR clock_timestamp()>='2026-11-06T03:00:00Z'::timestamptz THEN RAISE EXCEPTION 'Demo reader trial outside approved window'; END IF;
 IF session_user<>'night_scout_demo_import_login' THEN
  RAISE EXCEPTION 'Xero worker capability required';
 END IF;
 IF p_currency IS DISTINCT FROM 'GBP' OR p_closed_period IS DISTINCT FROM false OR NOT isfinite(p_scope_from) OR NOT isfinite(p_scope_to) OR p_scope_from IS NULL OR p_scope_to IS NULL OR p_scope_from>p_scope_to OR p_scope_to>current_date
  OR p_scope_to-p_scope_from>=31 OR p_currency!~'^[A-Z]{3}$' OR p_closed_period IS NULL THEN
  RAISE EXCEPTION 'invalid Xero refresh scope';
 END IF;

 WITH candidates AS (
  SELECT c.id connection_id,current_mapping.id mapping_version_id
  FROM xero_demo_v1.connections c
  JOIN xero_demo_v1.credential_envelopes ce ON ce.connection_id=c.id
  CROSS JOIN LATERAL (
   SELECT mv.id,mv.effective_from
   FROM xero_demo_v1.mapping_versions mv
   WHERE mv.connection_id=c.id AND mv.effective_from<=current_date
   ORDER BY mv.effective_from DESC,mv.version DESC,mv.id DESC
   LIMIT 1
  ) current_mapping
  WHERE c.retired_at IS NULL
   AND current_mapping.effective_from<=p_scope_from
   AND ce.algorithm='AES-256-GCM' AND ce.version>0
   AND (SELECT count(DISTINCT ms.category) FROM xero_demo_v1.mapping_selections ms
        WHERE ms.mapping_version_id=current_mapping.id)=5
   AND NOT EXISTS (
    SELECT 1 FROM xero_demo_v1.mapping_selections ms
    LEFT JOIN xero_demo_v1.account_directories ad
      ON ad.connection_id=c.id
     AND ad.retrieved_at=(SELECT mv.directory_retrieved_at FROM xero_demo_v1.mapping_versions mv WHERE mv.id=current_mapping.id)
     AND ad.account_id=ms.account_id AND ad.account_status='ACTIVE'
    WHERE ms.mapping_version_id=current_mapping.id AND ad.account_id IS NULL
   )
   AND NOT EXISTS (
    SELECT 1 FROM xero_demo_v1.accounting_evidence ae
    WHERE ae.connection_id=c.id AND ae.mapping_version_id=current_mapping.id
     AND ae.scope_from=p_scope_from AND ae.scope_to=p_scope_to
     AND ae.currency=p_currency AND ae.closed_period=p_closed_period
   )
 )
 SELECT count(*)::integer INTO candidate_count FROM candidates;

 IF candidate_count<>1 THEN
  RAISE EXCEPTION 'Xero staging refresh job unavailable';
 END IF;

 RETURN QUERY
 WITH candidates AS (
  SELECT c.id connection_id,current_mapping.id mapping_version_id
  FROM xero_demo_v1.connections c
  JOIN xero_demo_v1.credential_envelopes ce ON ce.connection_id=c.id
  CROSS JOIN LATERAL (
   SELECT mv.id,mv.effective_from
   FROM xero_demo_v1.mapping_versions mv
   WHERE mv.connection_id=c.id AND mv.effective_from<=current_date
   ORDER BY mv.effective_from DESC,mv.version DESC,mv.id DESC
   LIMIT 1
  ) current_mapping
  WHERE c.retired_at IS NULL
   AND current_mapping.effective_from<=p_scope_from
   AND ce.algorithm='AES-256-GCM' AND ce.version>0
   AND (SELECT count(DISTINCT ms.category) FROM xero_demo_v1.mapping_selections ms
        WHERE ms.mapping_version_id=current_mapping.id)=5
   AND NOT EXISTS (
    SELECT 1 FROM xero_demo_v1.mapping_selections ms
    LEFT JOIN xero_demo_v1.account_directories ad
      ON ad.connection_id=c.id
     AND ad.retrieved_at=(SELECT mv.directory_retrieved_at FROM xero_demo_v1.mapping_versions mv WHERE mv.id=current_mapping.id)
     AND ad.account_id=ms.account_id AND ad.account_status='ACTIVE'
    WHERE ms.mapping_version_id=current_mapping.id AND ad.account_id IS NULL
   )
   AND NOT EXISTS (
    SELECT 1 FROM xero_demo_v1.accounting_evidence ae
    WHERE ae.connection_id=c.id AND ae.mapping_version_id=current_mapping.id
     AND ae.scope_from=p_scope_from AND ae.scope_to=p_scope_to
     AND ae.currency=p_currency AND ae.closed_period=p_closed_period
   )
 ) SELECT candidates.connection_id,candidates.mapping_version_id FROM candidates;
END $$;

-- Source-reviewed clone: 20260925_xero_single_refresh_job.sql / worker_store_refresh_envelope_leased (new-schema/login substitutions only except documented demo guards).
CREATE FUNCTION xero_demo_v1.worker_store_refresh_envelope_leased(
 p_connection_id uuid,p_ciphertext bytea,p_encrypted_dek bytea,p_key_version text,p_algorithm text,
 p_expected_version integer,p_new_version integer,p_expected_lease_expires_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,xero_demo_v1 AS $$
DECLARE stored uuid;
BEGIN
 IF session_user<>'night_scout_demo_import_login' THEN RAISE EXCEPTION 'Xero worker capability required'; END IF;
 IF p_connection_id IS NULL OR p_algorithm<>'AES-256-GCM'
  OR octet_length(p_ciphertext) NOT BETWEEN 1 AND 16384 OR octet_length(p_encrypted_dek) NOT BETWEEN 1 AND 16384
  OR p_key_version !~ '^[A-Za-z0-9._-]{1,128}$' OR p_expected_version<1
  OR p_new_version<>p_expected_version+1 OR p_expected_lease_expires_at IS NULL THEN
  RAISE EXCEPTION 'invalid encrypted credential envelope'; END IF;
 UPDATE xero_demo_v1.credential_envelopes e SET ciphertext=p_ciphertext,encrypted_dek=p_encrypted_dek,
  key_version=p_key_version,algorithm=p_algorithm,version=p_new_version,rotated_at=now()
 FROM xero_demo_v1.connections c WHERE e.connection_id=p_connection_id AND c.id=e.connection_id AND c.retired_at IS NULL
  AND e.version=p_expected_version AND e.lease_expires_at=p_expected_lease_expires_at
  AND e.lease_expires_at>clock_timestamp() RETURNING e.connection_id INTO stored;
 IF stored IS NOT NULL THEN
  INSERT INTO xero_demo_v1.credential_audit(connection_id,action) VALUES(p_connection_id,'credential_rotated');
 END IF;
 RETURN stored IS NOT NULL;
END $$;

-- Source-reviewed clone: 20260925_xero_single_refresh_job.sql / worker_record_accounting_evidence_leased (new-schema/login substitutions only except documented demo guards).
CREATE FUNCTION xero_demo_v1.worker_record_accounting_evidence_leased(
 p_connection_id uuid,p_mapping_version_id uuid,p_scope_from date,p_scope_to date,
 p_currency text,p_closed_period boolean,p_state text,p_reason text,
 p_report_as_of date,p_retrieved_at timestamptz,p_source_fingerprint text,
 p_booked_revenue_minor bigint,p_processing_fee_minor bigint,p_advertising_minor bigint,
 p_software_minor bigint,p_included_cash_minor bigint,p_expected_version integer,
 p_expected_lease_expires_at timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,xero_demo_v1 AS $$
DECLARE evidence_id uuid; released uuid;
BEGIN
 IF clock_timestamp()<'2026-10-30T00:00:00Z'::timestamptz OR clock_timestamp()>='2026-11-06T03:00:00Z'::timestamptz THEN RAISE EXCEPTION 'Demo reader trial outside approved window'; END IF;
 IF session_user<>'night_scout_demo_import_login' THEN RAISE EXCEPTION 'Xero worker capability required'; END IF;
 IF p_scope_from IS NULL OR p_scope_to IS NULL OR NOT isfinite(p_scope_from) OR NOT isfinite(p_scope_to) OR p_scope_from>p_scope_to OR p_scope_to>current_date OR p_scope_to-p_scope_from>=31 OR p_currency IS DISTINCT FROM 'GBP' OR p_closed_period IS DISTINCT FROM false THEN RAISE EXCEPTION 'Invalid bounded demo accounting scope'; END IF;
 IF p_connection_id IS NULL OR p_mapping_version_id IS NULL OR p_expected_version<1
  OR p_expected_lease_expires_at IS NULL THEN RAISE EXCEPTION 'invalid Xero refresh completion'; END IF;
 IF (p_state='supported' AND p_expected_version<2)
  OR (p_state<>'supported' AND p_expected_version<1) THEN
  RAISE EXCEPTION 'invalid Xero refresh completion';
 END IF;
 IF p_expected_version=1 AND (p_state<>'failed' OR p_source_fingerprint IS NOT NULL OR p_report_as_of IS NOT NULL
  OR p_booked_revenue_minor IS NOT NULL OR p_processing_fee_minor IS NOT NULL OR p_advertising_minor IS NOT NULL
  OR p_software_minor IS NOT NULL OR p_included_cash_minor IS NOT NULL) THEN
  RAISE EXCEPTION 'pre-rotation completion must be value-free failure';
 END IF;
 PERFORM 1 FROM xero_demo_v1.credential_envelopes ce JOIN xero_demo_v1.connections c ON c.id=ce.connection_id
  JOIN xero_demo_v1.mapping_versions mv ON mv.id=p_mapping_version_id AND mv.connection_id=c.id
  WHERE ce.connection_id=p_connection_id AND c.retired_at IS NULL AND ce.version=p_expected_version
   AND mv.effective_from<=p_scope_from
   AND mv.id=(SELECT current_mapping.id FROM xero_demo_v1.mapping_versions current_mapping WHERE current_mapping.connection_id=c.id AND current_mapping.effective_from<=current_date ORDER BY current_mapping.effective_from DESC,current_mapping.version DESC,current_mapping.id DESC LIMIT 1)
   AND ce.lease_expires_at=p_expected_lease_expires_at AND ce.lease_expires_at>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'Xero refresh fence unavailable'; END IF;
 INSERT INTO xero_demo_v1.accounting_evidence(
  connection_id,mapping_version_id,scope_from,scope_to,currency,closed_period,state,reason,
  report_as_of,retrieved_at,source_fingerprint,booked_revenue_minor,processing_fee_minor,
  advertising_minor,software_minor,included_cash_minor)
 VALUES(p_connection_id,p_mapping_version_id,p_scope_from,p_scope_to,p_currency,p_closed_period,p_state,p_reason,
  p_report_as_of,p_retrieved_at,p_source_fingerprint,p_booked_revenue_minor,p_processing_fee_minor,
  p_advertising_minor,p_software_minor,p_included_cash_minor) RETURNING id INTO evidence_id;
 INSERT INTO xero_demo_v1.accounting_evidence_audit(evidence_id,action,actor_kind) VALUES(evidence_id,'recorded','worker');
 UPDATE xero_demo_v1.credential_envelopes SET lease_expires_at=NULL
  WHERE connection_id=p_connection_id AND version=p_expected_version
   AND lease_expires_at=p_expected_lease_expires_at AND lease_expires_at>clock_timestamp()
  RETURNING connection_id INTO released;
 IF released IS NULL THEN RAISE EXCEPTION 'Xero refresh fence unavailable'; END IF;
 RETURN evidence_id;
END $$;

-- Source-reviewed clone: 20261003_xero_connection_preflight_evidence.sql / worker_record_connection_preflight (new-schema/login substitutions only except documented demo guards).
CREATE FUNCTION xero_demo_v1.worker_record_connection_preflight(
 p_connection_id uuid,p_credential_version integer,p_outcome text,p_phase text,p_reason text,
 p_provider_status smallint,p_tenant_visible boolean,p_lease_expires_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER VOLATILE
SET search_path=pg_catalog,xero_demo_v1 AS $$
BEGIN
 IF p_outcome IS DISTINCT FROM 'failed' AND (clock_timestamp()<'2026-10-30T00:00:00Z'::timestamptz OR clock_timestamp()>='2026-11-06T03:00:00Z'::timestamptz) THEN RAISE EXCEPTION 'Demo reader trial outside approved window'; END IF;
 IF session_user<>'night_scout_demo_import_login' THEN
  RAISE EXCEPTION 'Xero worker capability required';
 END IF;
 IF p_connection_id IS NULL OR p_credential_version<1 OR p_lease_expires_at IS NULL THEN
  RAISE EXCEPTION 'invalid Xero preflight evidence';
 END IF;
 IF NOT EXISTS(
  SELECT 1
  FROM xero_demo_v1.connections c
  JOIN xero_demo_v1.credential_envelopes ce ON ce.connection_id=c.id
  WHERE c.id=p_connection_id AND c.retired_at IS NULL
   AND ce.version=p_credential_version
   AND ce.lease_expires_at=p_lease_expires_at
   AND ce.lease_expires_at>clock_timestamp()
 ) THEN
  RAISE EXCEPTION 'Xero preflight credential lease unavailable';
 END IF;
 INSERT INTO xero_demo_v1.connection_preflight_evidence(
  connection_id,credential_version,outcome,phase,reason,provider_status,tenant_visible)
 VALUES(p_connection_id,p_credential_version,p_outcome,p_phase,p_reason,p_provider_status,p_tenant_visible);
 RETURN true;
END $$;

-- Source-reviewed clone: 20261003_xero_connection_preflight_job.sql / worker_get_single_connection_preflight_job (new-schema/login substitutions only except documented demo guards).
CREATE FUNCTION xero_demo_v1.worker_get_single_connection_preflight_job()
RETURNS TABLE(connection_id uuid,mapping_version_id uuid)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path=pg_catalog,xero_demo_v1 AS $$
DECLARE candidate_count integer;
BEGIN
 IF clock_timestamp()<'2026-10-30T00:00:00Z'::timestamptz OR clock_timestamp()>='2026-11-06T03:00:00Z'::timestamptz THEN RAISE EXCEPTION 'Demo reader trial outside approved window'; END IF;
 IF session_user<>'night_scout_demo_import_login' THEN
  RAISE EXCEPTION 'Xero worker capability required';
 END IF;

 WITH candidates AS (
  SELECT c.id connection_id,current_mapping.id mapping_version_id
  FROM xero_demo_v1.connections c
  JOIN xero_demo_v1.credential_envelopes ce ON ce.connection_id=c.id
  CROSS JOIN LATERAL (
   SELECT mv.id,mv.directory_retrieved_at
   FROM xero_demo_v1.mapping_versions mv
   WHERE mv.connection_id=c.id AND mv.effective_from<=current_date
   ORDER BY mv.effective_from DESC,mv.version DESC,mv.id DESC
   LIMIT 1
  ) current_mapping
  WHERE c.retired_at IS NULL
   AND ce.algorithm='AES-256-GCM' AND ce.version>0
   AND (SELECT count(DISTINCT ms.category) FROM xero_demo_v1.mapping_selections ms
        WHERE ms.mapping_version_id=current_mapping.id)=5
   AND NOT EXISTS (
    SELECT 1 FROM xero_demo_v1.mapping_selections ms
    LEFT JOIN xero_demo_v1.account_directories ad
      ON ad.connection_id=c.id
     AND ad.retrieved_at=current_mapping.directory_retrieved_at
     AND ad.account_id=ms.account_id AND ad.account_status='ACTIVE'
    WHERE ms.mapping_version_id=current_mapping.id AND ad.account_id IS NULL
   )
 )
 SELECT count(*)::integer INTO candidate_count FROM candidates;

 IF candidate_count<>1 THEN
  RAISE EXCEPTION 'Xero staging preflight job unavailable';
 END IF;

 RETURN QUERY
 WITH candidates AS (
  SELECT c.id connection_id,current_mapping.id mapping_version_id
  FROM xero_demo_v1.connections c
  JOIN xero_demo_v1.credential_envelopes ce ON ce.connection_id=c.id
  CROSS JOIN LATERAL (
   SELECT mv.id,mv.directory_retrieved_at
   FROM xero_demo_v1.mapping_versions mv
   WHERE mv.connection_id=c.id AND mv.effective_from<=current_date
   ORDER BY mv.effective_from DESC,mv.version DESC,mv.id DESC
   LIMIT 1
  ) current_mapping
  WHERE c.retired_at IS NULL
   AND ce.algorithm='AES-256-GCM' AND ce.version>0
   AND (SELECT count(DISTINCT ms.category) FROM xero_demo_v1.mapping_selections ms
        WHERE ms.mapping_version_id=current_mapping.id)=5
   AND NOT EXISTS (
    SELECT 1 FROM xero_demo_v1.mapping_selections ms
    LEFT JOIN xero_demo_v1.account_directories ad
      ON ad.connection_id=c.id
     AND ad.retrieved_at=current_mapping.directory_retrieved_at
     AND ad.account_id=ms.account_id AND ad.account_status='ACTIVE'
    WHERE ms.mapping_version_id=current_mapping.id AND ad.account_id IS NULL
   )
 )
 SELECT candidates.connection_id,candidates.mapping_version_id FROM candidates;
END $$;

-- Source-reviewed clone: 20260918_grant_xero_worker_access.sql / worker_record_credential_refresh_failure (new-schema/login substitutions only except documented demo guards).
CREATE FUNCTION xero_demo_v1.worker_record_credential_refresh_failure(
  p_connection_id uuid, p_safe_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, xero_demo_v1
AS $$
BEGIN
 IF session_user<>'night_scout_demo_import_login' THEN RAISE EXCEPTION 'Xero demo reader capability required'; END IF;
  IF p_safe_reason NOT IN ('invalid_grant','provider_unavailable','refresh_failed','scope_changed','tenant_unavailable') THEN
    RAISE EXCEPTION 'unsafe credential failure reason';
  END IF;
  PERFORM 1 FROM xero_demo_v1.connections WHERE id = p_connection_id AND retired_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'active Xero connection is required'; END IF;
  INSERT INTO xero_demo_v1.credential_audit(connection_id,action,safe_reason)
  VALUES (p_connection_id,'credential_refresh_failed',p_safe_reason);
END
$$;

-- Dedicated member metadata. Does not expose either private schema.
CREATE FUNCTION public.xero_demo_member_active_tenant_binding_v1(p_store_id uuid)
RETURNS TABLE(store_id uuid,tenant_id text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE member_id uuid:=auth.uid(); r xero_demo_v1.connections%ROWTYPE;
BEGIN
 IF member_id IS NULL OR p_store_id IS DISTINCT FROM 'f59e3a44-7106-4df8-9c08-52da30c9de30'::uuid
  OR NOT EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.user_id=member_id AND m.store_id=p_store_id)
 THEN RAISE EXCEPTION 'Xero demo binding unavailable'; END IF;
 IF (SELECT count(*) FROM xero_demo_v1.connections c WHERE c.store_id=p_store_id AND c.retired_at IS NULL)<>1 THEN RAISE EXCEPTION 'Xero demo binding unavailable'; END IF;
 SELECT * INTO r FROM xero_demo_v1.connections c WHERE c.store_id=p_store_id AND c.retired_at IS NULL;
 IF r.tenant_id IS NULL OR r.tenant_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  OR r.created_at IS NULL OR NOT isfinite(r.created_at) OR r.created_at>transaction_timestamp() THEN RAISE EXCEPTION 'Xero demo binding unavailable'; END IF;
 RETURN QUERY SELECT r.store_id,r.tenant_id;
END $$;

CREATE FUNCTION public.xero_demo_reader_status_v1(p_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE member_id uuid:=auth.uid(); c xero_demo_v1.connections%ROWTYPE; mv xero_demo_v1.mapping_versions%ROWTYPE;
 pe xero_demo_v1.connection_preflight_evidence%ROWTYPE; ae xero_demo_v1.accounting_evidence%ROWTYPE;
 binding_state text:='unavailable'; mapping_state text:='unavailable'; ids jsonb:='[]'::jsonb;
 health_state text:='unavailable'; version_matches boolean:=false; supported jsonb:=NULL; active_count integer; version_number integer;
BEGIN
 IF member_id IS NULL OR p_store_id IS DISTINCT FROM 'f59e3a44-7106-4df8-9c08-52da30c9de30'::uuid
  OR NOT EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.user_id=member_id AND m.store_id=p_store_id)
 THEN RAISE EXCEPTION 'Xero demo status unavailable'; END IF;
 SELECT count(*) INTO active_count FROM xero_demo_v1.connections x WHERE x.store_id=p_store_id AND x.retired_at IS NULL;
 IF active_count>1 THEN binding_state:='ambiguous'; END IF;
 IF active_count=1 THEN
  SELECT * INTO c FROM xero_demo_v1.connections x WHERE x.store_id=p_store_id AND x.retired_at IS NULL;
  IF c.tenant_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' AND isfinite(c.created_at) AND c.created_at<=transaction_timestamp() THEN
   binding_state:='active';
   SELECT * INTO mv FROM xero_demo_v1.mapping_versions v WHERE v.connection_id=c.id AND v.effective_from<=current_date ORDER BY v.effective_from DESC,v.version DESC,v.id DESC LIMIT 1;
   IF mv.id IS NOT NULL THEN
    mapping_state:='review_required';
    IF EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.store_id=p_store_id AND m.user_id=mv.confirmed_by)
     AND (SELECT count(DISTINCT s.category) FROM xero_demo_v1.mapping_selections s WHERE s.mapping_version_id=mv.id)=5
     AND NOT EXISTS(SELECT 1 FROM xero_demo_v1.mapping_audit a WHERE a.connection_id=c.id AND a.action='review_required' AND a.occurred_at>=mv.confirmed_at)
     AND NOT EXISTS(SELECT 1 FROM xero_demo_v1.mapping_selections s LEFT JOIN xero_demo_v1.account_directories d ON d.connection_id=c.id AND d.retrieved_at=mv.directory_retrieved_at AND d.account_id=s.account_id AND d.account_status='ACTIVE' WHERE s.mapping_version_id=mv.id AND d.account_id IS NULL)
    THEN
     mapping_state:='current';
     SELECT COALESCE(jsonb_agg(s.account_id ORDER BY s.account_id),'[]'::jsonb) INTO ids FROM (SELECT account_id FROM xero_demo_v1.mapping_selections WHERE mapping_version_id=mv.id AND category='revenue' ORDER BY account_id LIMIT 100) s;
    END IF;
   END IF;
   IF mapping_state='current' AND EXISTS(SELECT 1 FROM (SELECT e.reason,e.state FROM xero_demo_v1.accounting_evidence e WHERE e.connection_id=c.id AND e.mapping_version_id=mv.id ORDER BY e.created_at DESC,e.id DESC LIMIT 1) latest WHERE latest.reason='account_mapping_review_required' OR latest.state='invalidated') THEN mapping_state:='review_required';ids:='[]'::jsonb; END IF;
   SELECT version INTO version_number FROM xero_demo_v1.credential_envelopes WHERE connection_id=c.id;
   SELECT * INTO pe FROM xero_demo_v1.connection_preflight_evidence p WHERE p.connection_id=c.id ORDER BY p.checked_at DESC,p.id DESC LIMIT 1;
   IF pe.id IS NOT NULL THEN
    version_matches:=COALESCE(pe.credential_version=version_number,false);
    IF NOT isfinite(pe.checked_at) OR pe.checked_at>transaction_timestamp() THEN health_state:='unavailable';
    ELSIF pe.checked_at<transaction_timestamp()-interval '1 hour' OR NOT version_matches THEN health_state:='stale';
    ELSIF pe.outcome='connected' AND pe.phase='organisation' AND pe.reason='ok' AND pe.tenant_visible IS TRUE
     AND NOT EXISTS(SELECT 1 FROM xero_demo_v1.connection_preflight_evidence t WHERE t.connection_id=c.id AND t.checked_at=pe.checked_at AND (t.outcome<>'connected' OR t.phase<>'organisation' OR t.reason<>'ok' OR t.tenant_visible IS DISTINCT FROM true)) THEN health_state:='connected';
    ELSE health_state:='failed'; END IF;
   END IF;
   IF mapping_state='current' THEN
    SELECT * INTO ae FROM xero_demo_v1.accounting_evidence e WHERE e.connection_id=c.id AND e.mapping_version_id=mv.id AND e.state='supported' AND e.currency='GBP' AND e.scope_from>=mv.effective_from ORDER BY e.scope_to DESC,e.retrieved_at DESC,e.created_at DESC,e.id DESC LIMIT 1;
    IF ae.id IS NOT NULL AND ae.booked_revenue_minor BETWEEN -9007199254740991 AND 9007199254740991 AND ae.processing_fee_minor BETWEEN -9007199254740991 AND 9007199254740991 AND ae.advertising_minor BETWEEN -9007199254740991 AND 9007199254740991 AND ae.software_minor BETWEEN -9007199254740991 AND 9007199254740991 AND ae.included_cash_minor BETWEEN -9007199254740991 AND 9007199254740991 THEN
     supported:=jsonb_build_object('from',ae.scope_from,'to',ae.scope_to,'currency',ae.currency,'reportAsOf',ae.report_as_of,'retrievedAt',to_char(ae.retrieved_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'values',jsonb_build_object('bookedRevenueMinor',ae.booked_revenue_minor,'processingFeeMinor',ae.processing_fee_minor,'advertisingMinor',ae.advertising_minor,'softwareMinor',ae.software_minor,'includedCashMinor',ae.included_cash_minor));
    END IF;
   END IF;
  END IF;
 END IF;
 RETURN jsonb_build_object('storeId',p_store_id,'tenantId',CASE WHEN binding_state='active' THEN c.tenant_id ELSE NULL END,'bindingState',binding_state,
  'mappingState',mapping_state,'mappingVersion',mv.version,'mappingEffectiveFrom',mv.effective_from,'revenueAccountIds',ids,
  'readerHealth',jsonb_build_object('state',health_state,'checkedAt',CASE WHEN pe.id IS NOT NULL AND isfinite(pe.checked_at) THEN to_char(pe.checked_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') ELSE NULL END,'matchesCurrentCredential',version_matches),
  'latestSupportedPeriod',supported);
END $$;

-- All tables private/RLS; capability roles get no direct SELECT/INSERT/UPDATE/DELETE.
DO $acl$ DECLARE r record; BEGIN
 FOR r IN SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='xero_demo_v1' AND c.relkind='r'
 LOOP EXECUTE format('ALTER TABLE xero_demo_v1.%I ENABLE ROW LEVEL SECURITY',r.relname); END LOOP;
END $acl$;
REVOKE ALL ON SCHEMA xero_demo_v1 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA xero_demo_v1 FROM PUBLIC,anon,authenticated,night_scout_demo_import_login,night_scout_demo_import_service,night_scout_demo_bootstrap_login,night_scout_demo_bootstrap_service;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA xero_demo_v1 FROM PUBLIC,anon,authenticated,night_scout_demo_import_login,night_scout_demo_bootstrap_login;
GRANT USAGE ON SCHEMA xero_demo_v1 TO night_scout_demo_import_service,night_scout_demo_bootstrap_service;
GRANT EXECUTE ON FUNCTION xero_demo_v1.bootstrap_create_initial_connection(uuid,uuid,text,uuid,date,timestamptz,jsonb,jsonb,bytea,bytea,text,text) TO night_scout_demo_bootstrap_service;
GRANT EXECUTE ON FUNCTION xero_demo_v1.worker_get_single_connection_preflight_job(),xero_demo_v1.worker_get_single_refresh_job(date,date,text,boolean),xero_demo_v1.worker_get_refresh_context(uuid,uuid),xero_demo_v1.worker_get_latest_supported_evidence(uuid,uuid,date,date,text,boolean),xero_demo_v1.worker_acquire_refresh_lease(uuid,integer,integer),xero_demo_v1.worker_release_refresh_lease(uuid,integer,timestamptz),xero_demo_v1.worker_store_refresh_envelope_leased(uuid,bytea,bytea,text,text,integer,integer,timestamptz),xero_demo_v1.worker_record_accounting_evidence_leased(uuid,uuid,date,date,text,boolean,text,text,date,timestamptz,text,bigint,bigint,bigint,bigint,bigint,integer,timestamptz),xero_demo_v1.worker_record_connection_preflight(uuid,integer,text,text,text,smallint,boolean,timestamptz),xero_demo_v1.worker_record_credential_refresh_failure(uuid,text) TO night_scout_demo_import_service;
REVOKE ALL ON FUNCTION public.xero_demo_member_active_tenant_binding_v1(uuid),public.xero_demo_reader_status_v1(uuid) FROM PUBLIC,anon,authenticated;
DO $deny$ DECLARE r text; BEGIN
 FOR r IN SELECT rolname FROM pg_catalog.pg_roles WHERE rolname IN ('service_role','night_scout_import_login','night_scout_xero_bootstrap_login','night_scout_test_writer','night_scout_test_writer_service') LOOP
  EXECUTE format('REVOKE ALL ON SCHEMA xero_demo_v1 FROM %I',r);
  EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA xero_demo_v1 FROM %I',r);
  EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA xero_demo_v1 FROM %I',r);
  EXECUTE format('REVOKE ALL ON FUNCTION public.xero_demo_member_active_tenant_binding_v1(uuid),public.xero_demo_reader_status_v1(uuid) FROM %I',r);
 END LOOP;
END $deny$;
GRANT EXECUTE ON FUNCTION public.xero_demo_member_active_tenant_binding_v1(uuid),public.xero_demo_reader_status_v1(uuid) TO authenticated;
COMMIT;
