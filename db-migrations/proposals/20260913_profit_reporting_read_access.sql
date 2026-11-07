-- PROPOSAL ONLY: requires explicit approval before applying in STAGING.
-- Uses the existing restricted review login/service; no login, password,
-- memberships, writes, public RPC or anonymous/authenticated grants added.
-- Identity is set LOCAL by the trusted service after remote Auth verification.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='night_scout_review_service'
 AND NOT (rolcanlogin OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication OR rolinherit))
 THEN RAISE EXCEPTION 'Restricted existing review service required'; END IF;
END $$;
GRANT SELECT ON public.order_line_items,public.overhead_entries,public.overhead_categories,
 public.marketing_channel_daily_metrics,
 finance_v1.profit_evidence_versions,finance_v1.line_cost_evidence,
 finance_v1.stock_return_evidence,finance_v1.expense_evidence,
 finance_v1.profit_component_coverage TO night_scout_review_service;
DO $$ DECLARE relation text; BEGIN
 FOREACH relation IN ARRAY ARRAY['public.order_line_items','public.overhead_entries','public.overhead_categories',
 'public.marketing_channel_daily_metrics','finance_v1.profit_evidence_versions','finance_v1.line_cost_evidence',
 'finance_v1.stock_return_evidence','finance_v1.expense_evidence'] LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=relation::regclass AND relrowsecurity) THEN
 RAISE EXCEPTION 'RLS must already be enabled on %',relation; END IF;
 EXECUTE format('CREATE POLICY profit_member_read ON %s FOR SELECT TO night_scout_review_service USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id=nullif(current_setting(''night_scout.profit_user_id'',true),'''')::uuid))',relation);
 END LOOP;
END $$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='finance_v1.profit_component_coverage'::regclass AND relrowsecurity) THEN
 RAISE EXCEPTION 'Coverage RLS must already be enabled'; END IF;
END $$;
CREATE POLICY profit_member_read ON finance_v1.profit_component_coverage
 FOR SELECT TO night_scout_review_service USING (EXISTS (
 SELECT 1 FROM finance_v1.profit_evidence_versions v WHERE v.id=version_id
 AND v.store_id IN (SELECT store_id FROM public.store_memberships
 WHERE user_id=nullif(current_setting('night_scout.profit_user_id',true),'')::uuid)));
COMMIT;
