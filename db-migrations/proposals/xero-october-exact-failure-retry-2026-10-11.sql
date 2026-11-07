-- PROPOSAL ONLY. Exact reviewed Oct1-10 failed receipt; no function replacement.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog,xero_v1,public;
DO $$
DECLARE v_id uuid;v_count integer;v_before text;v_after text;
BEGIN
 IF current_user IN ('night_scout_import_login','night_scout_xero_bootstrap_login','authenticated','anon','service_role') THEN RAISE EXCEPTION 'staging migration owner required';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('xero_v1.worker_get_single_refresh_job(date,date,text,boolean)') AND md5(prosrc)='49ce2e40f7e68ca613e638ba78f1f460' AND prosecdef AND provolatile='v' AND proconfig=ARRAY['search_path=pg_catalog, xero_v1']) THEN RAISE EXCEPTION 'reviewed fifth worker function differs';END IF;
 LOCK TABLE xero_v1.connections,xero_v1.credential_envelopes,xero_v1.mapping_versions,xero_v1.mapping_selections,xero_v1.account_directories,xero_v1.accounting_evidence,xero_v1.connection_preflight_evidence,public.stores,public.store_memberships IN SHARE MODE;
 LOCK TABLE xero_v1.accounting_evidence_retry_authorizations IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM xero_v1.accounting_evidence_retry_authorizations WHERE consumed_at IS NULL) THEN RAISE EXCEPTION 'pending retry exists';END IF;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.evidence_id)::text,'[]')) INTO v_before FROM xero_v1.accounting_evidence_retry_authorizations r;
 SELECT count(*),(array_agg(ae.id))[1] INTO v_count,v_id
 FROM xero_v1.accounting_evidence ae
 JOIN xero_v1.connections c ON c.id=ae.connection_id AND c.retired_at IS NULL
 JOIN public.stores s ON s.id=c.store_id AND s.id='56d92f8a-746e-4b4f-b408-81fc98c4aa17'::uuid AND s.shopify_domain='pocketlaunchpad1.myshopify.com' AND s.shopify_store_id='95601983836' AND s.currency_code='GBP' AND s.timezone='Europe/London'
 JOIN xero_v1.credential_envelopes ce ON ce.connection_id=c.id AND ce.algorithm='AES-256-GCM' AND ce.version>0 AND (ce.lease_expires_at IS NULL OR ce.lease_expires_at<=clock_timestamp())
 JOIN LATERAL(SELECT * FROM xero_v1.mapping_versions m WHERE m.connection_id=c.id AND m.effective_from<=current_date ORDER BY m.effective_from DESC,m.version DESC,m.id DESC LIMIT 1) mv ON mv.id=ae.mapping_version_id AND mv.effective_from<=date '2026-10-01'
 JOIN LATERAL(SELECT * FROM xero_v1.connection_preflight_evidence p WHERE p.connection_id=c.id ORDER BY p.checked_at DESC,p.id DESC LIMIT 1) pe ON pe.credential_version=ce.version
 WHERE ae.scope_from=date '2026-10-01' AND ae.scope_to=date '2026-10-10' AND ae.currency='GBP' AND ae.closed_period=false
 AND ae.state='failed' AND ae.reason='accounting_evidence_unavailable' AND ae.retrieved_at=timestamptz '2026-10-11T16:04:16.227Z'
 AND pe.outcome='connected' AND pe.phase='organisation' AND pe.reason='ok' AND pe.tenant_visible=true AND pe.provider_status IS NULL
 AND pe.checked_at>ae.created_at AND pe.checked_at>ae.retrieved_at AND pe.checked_at<=clock_timestamp() AND pe.checked_at>=clock_timestamp()-interval '24 hours'
 AND ae.id=(SELECT newest.id FROM xero_v1.accounting_evidence newest WHERE newest.connection_id=c.id AND newest.mapping_version_id=mv.id AND newest.scope_from=ae.scope_from AND newest.scope_to=ae.scope_to AND newest.currency=ae.currency AND newest.closed_period=ae.closed_period ORDER BY newest.created_at DESC,newest.id DESC LIMIT 1)
 AND EXISTS(SELECT 1 FROM public.store_memberships sm WHERE sm.store_id=c.store_id AND sm.user_id=mv.confirmed_by)
 AND (SELECT count(DISTINCT category) FROM xero_v1.mapping_selections WHERE mapping_version_id=mv.id)=5
 AND NOT EXISTS(SELECT 1 FROM xero_v1.mapping_selections ms LEFT JOIN xero_v1.account_directories ad ON ad.connection_id=c.id AND ad.retrieved_at=mv.directory_retrieved_at AND ad.account_id=ms.account_id AND ad.account_status='ACTIVE' WHERE ms.mapping_version_id=mv.id AND ad.account_id IS NULL);
 IF v_count<>1 THEN RAISE EXCEPTION 'exact reviewed October failure unavailable';END IF;
 IF EXISTS(SELECT 1 FROM xero_v1.accounting_evidence_retry_authorizations WHERE evidence_id=v_id) THEN RAISE EXCEPTION 'reviewed failure already authorized';END IF;
 INSERT INTO xero_v1.accounting_evidence_retry_authorizations(evidence_id) VALUES(v_id);
 SELECT md5(coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.evidence_id)::text,'[]')) INTO v_after FROM xero_v1.accounting_evidence_retry_authorizations r WHERE evidence_id<>v_id;
 IF v_after<>v_before THEN RAISE EXCEPTION 'prior retry history changed';END IF;
END $$;
SELECT 'october_exact_failure_retry_authorized' AS status;
COMMIT;
