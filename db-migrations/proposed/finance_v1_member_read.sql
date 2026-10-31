-- Apply only after finance_v1_sales_evidence.sql, on reviewed staging.
-- No evidence write privileges or security-definer functions.
BEGIN;
REVOKE ALL ON SCHEMA finance_v1 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA finance_v1 FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA finance_v1 TO authenticated;
GRANT SELECT ON finance_v1.order_evidence,finance_v1.refund_evidence,finance_v1.coverage_evidence,
 finance_v1.order_mapping,finance_v1.refund_mapping TO authenticated;
CREATE POLICY member_read ON finance_v1.order_evidence FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id=(SELECT auth.uid())));
CREATE POLICY member_read ON finance_v1.refund_evidence FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id=(SELECT auth.uid())));
CREATE POLICY member_read ON finance_v1.coverage_evidence FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id=(SELECT auth.uid())));
CREATE FUNCTION public.verified_sales_source(p_store_id uuid,p_date_from date,p_date_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp AS $fn$
BEGIN
 IF p_date_from IS NULL OR p_date_to IS NULL OR p_date_to<p_date_from THEN
  RAISE EXCEPTION 'Invalid reporting period' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.store_memberships WHERE user_id=(SELECT auth.uid()) AND store_id=p_store_id) THEN
  RAISE EXCEPTION 'Store access unavailable' USING ERRCODE='42501';
 END IF;
 RETURN jsonb_build_object(
  'version',1,'storeId',p_store_id,'from',p_date_from,'to',p_date_to,
  'coverage',COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM finance_v1.coverage_evidence c WHERE store_id=p_store_id AND date_from=p_date_from AND date_to=p_date_to),'[]'::jsonb),
  'orders',COALESCE((SELECT jsonb_agg(to_jsonb(o)) FROM finance_v1.order_mapping o WHERE store_id=p_store_id),'[]'::jsonb),
  'refunds',COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM finance_v1.refund_mapping r WHERE store_id=p_store_id),'[]'::jsonb));
END;
$fn$;
REVOKE ALL ON FUNCTION public.verified_sales_source(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.verified_sales_source(uuid,date,date) TO authenticated;
COMMIT;
