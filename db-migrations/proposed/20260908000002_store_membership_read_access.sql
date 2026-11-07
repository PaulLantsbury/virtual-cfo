-- LOCAL PROPOSAL: Supabase Auth membership-based READ access, not applied live.
-- Apply only after the monthly-contribution correction and baseline review.
-- No membership backfill or application sign-in flow is included.
BEGIN;
-- Fail on a changed object inventory or existing policies rather than combine
-- this proposal with unreviewed permissive policies or unhandled functions.
DO $baseline$
BEGIN
 IF (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace) <> 24
 OR (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r') <> 22
 OR (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='v') <> 5
 OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public') THEN
  RAISE EXCEPTION 'Public baseline changed; review store-access proposal before applying';
 END IF;
END;
$baseline$;
CREATE TABLE public.store_memberships (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
 PRIMARY KEY(user_id,store_id)
);
ALTER TABLE public.store_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_memberships FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.store_memberships TO authenticated;
CREATE POLICY membership_self_read ON public.store_memberships FOR SELECT TO authenticated
 USING (user_id = (SELECT auth.uid()));
-- Membership provisioning is an administrator operation; no client writes.
GRANT USAGE ON SCHEMA public TO authenticated;
ALTER TABLE public.cac_trend_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cac_trend_snapshots FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cac_trend_snapshots TO authenticated;
CREATE POLICY member_read ON public.cac_trend_snapshots FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.cash_balance_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cash_balance_snapshots FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cash_balance_snapshots TO authenticated;
CREATE POLICY member_read ON public.cash_balance_snapshots FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.cfo_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cfo_alerts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cfo_alerts TO authenticated;
CREATE POLICY member_read ON public.cfo_alerts FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.channel_opportunity_scores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.channel_opportunity_scores FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.channel_opportunity_scores TO authenticated;
CREATE POLICY member_read ON public.channel_opportunity_scores FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customers FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.customers TO authenticated;
CREATE POLICY member_read ON public.customers FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.discount_codes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.discount_codes TO authenticated;
CREATE POLICY member_read ON public.discount_codes FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.discounts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.discounts TO authenticated;
CREATE POLICY member_read ON public.discounts FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.marketing_blended_monthly ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_blended_monthly FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.marketing_blended_monthly TO authenticated;
CREATE POLICY member_read ON public.marketing_blended_monthly FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.marketing_channel_daily_metrics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_channel_daily_metrics FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.marketing_channel_daily_metrics TO authenticated;
CREATE POLICY member_read ON public.marketing_channel_daily_metrics FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.marketing_channel_monthly_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_channel_monthly_snapshots FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.marketing_channel_monthly_snapshots TO authenticated;
CREATE POLICY member_read ON public.marketing_channel_monthly_snapshots FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunities FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.opportunities TO authenticated;
CREATE POLICY member_read ON public.opportunities FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.order_line_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_line_items FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.order_line_items TO authenticated;
CREATE POLICY member_read ON public.order_line_items FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orders FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.orders TO authenticated;
CREATE POLICY member_read ON public.orders FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.overhead_categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.overhead_categories FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.overhead_categories TO authenticated;
CREATE POLICY member_read ON public.overhead_categories FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.overhead_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.overhead_entries FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.overhead_entries TO authenticated;
CREATE POLICY member_read ON public.overhead_entries FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_variants FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.product_variants TO authenticated;
CREATE POLICY member_read ON public.product_variants FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.products FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.products TO authenticated;
CREATE POLICY member_read ON public.products FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.refund_line_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.refund_line_items FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.refund_line_items TO authenticated;
CREATE POLICY member_read ON public.refund_line_items FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.refunds FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.refunds TO authenticated;
CREATE POLICY member_read ON public.refunds FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.store_cost_assumptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_cost_assumptions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.store_cost_assumptions TO authenticated;
CREATE POLICY member_read ON public.store_cost_assumptions FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.store_settings TO authenticated;
CREATE POLICY member_read ON public.store_settings FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stores FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.stores TO authenticated;
CREATE POLICY member_read ON public.stores FOR SELECT TO authenticated
 USING (id IN (SELECT store_id FROM public.store_memberships WHERE user_id = (SELECT auth.uid())));
ALTER VIEW public.v_current_cash_balance SET (security_invoker = true);
REVOKE ALL ON public.v_current_cash_balance FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.v_current_cash_balance TO authenticated;
ALTER VIEW public.v_current_cost_assumptions SET (security_invoker = true);
REVOKE ALL ON public.v_current_cost_assumptions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.v_current_cost_assumptions TO authenticated;
ALTER VIEW public.v_month_on_month SET (security_invoker = true);
REVOKE ALL ON public.v_month_on_month FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.v_month_on_month TO authenticated;
ALTER VIEW public.v_monthly_metrics SET (security_invoker = true);
REVOKE ALL ON public.v_monthly_metrics FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.v_monthly_metrics TO authenticated;
ALTER VIEW public.v_monthly_overhead_summary SET (security_invoker = true);
REVOKE ALL ON public.v_monthly_overhead_summary FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.v_monthly_overhead_summary TO authenticated;
ALTER FUNCTION public.average_order_value(p_store_id uuid, p_date_from date, p_date_to date) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.average_order_value(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.average_order_value(p_store_id uuid, p_date_from date, p_date_to date) TO authenticated;
ALTER FUNCTION public.blended_marketing_performance(p_store_id uuid, p_date_from date, p_date_to date) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.blended_marketing_performance(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.blended_marketing_performance(p_store_id uuid, p_date_from date, p_date_to date) TO authenticated;
ALTER FUNCTION public.cac_trend_by_channel(p_store_id uuid, p_up_to_date date, p_months_back integer) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.cac_trend_by_channel(p_store_id uuid, p_up_to_date date, p_months_back integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cac_trend_by_channel(p_store_id uuid, p_up_to_date date, p_months_back integer) TO authenticated;
ALTER FUNCTION public.cash_runway_months(p_store_id uuid) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.cash_runway_months(p_store_id uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cash_runway_months(p_store_id uuid) TO authenticated;
ALTER FUNCTION public.cfo_alerts(p_store_id uuid, p_date_from date, p_date_to date) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.cfo_alerts(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cfo_alerts(p_store_id uuid, p_date_from date, p_date_to date) TO authenticated;
ALTER FUNCTION public.channel_metrics_monthly(p_store_id uuid, p_date_from date, p_date_to date) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.channel_metrics_monthly(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.channel_metrics_monthly(p_store_id uuid, p_date_from date, p_date_to date) TO authenticated;
ALTER FUNCTION public.channel_opportunities_active(p_store_id uuid) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.channel_opportunities_active(p_store_id uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.channel_opportunities_active(p_store_id uuid) TO authenticated;
ALTER FUNCTION public.contribution_margin_pct(p_store_id uuid, p_date_from date, p_date_to date) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.contribution_margin_pct(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.contribution_margin_pct(p_store_id uuid, p_date_from date, p_date_to date) TO authenticated;
ALTER FUNCTION public.discount_cost(p_store_id uuid, p_date_from date, p_date_to date) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.discount_cost(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.discount_cost(p_store_id uuid, p_date_from date, p_date_to date) TO authenticated;
ALTER FUNCTION public.discount_dependency(p_store_id uuid, p_date_from date, p_date_to date) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.discount_dependency(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.discount_dependency(p_store_id uuid, p_date_from date, p_date_to date) TO authenticated;
ALTER FUNCTION public.get_marketing_spend_rate(p_store_id uuid, p_date_from date) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.get_marketing_spend_rate(p_store_id uuid, p_date_from date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_marketing_spend_rate(p_store_id uuid, p_date_from date) TO authenticated;
ALTER FUNCTION public.gross_revenue(p_store_id uuid, p_date_from date, p_date_to date) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.gross_revenue(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gross_revenue(p_store_id uuid, p_date_from date, p_date_to date) TO authenticated;
ALTER FUNCTION public.month_on_month_delta(p_store_id uuid, p_date_from date, p_date_to date) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.month_on_month_delta(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.month_on_month_delta(p_store_id uuid, p_date_from date, p_date_to date) TO authenticated;
ALTER FUNCTION public.monthly_overhead_total(p_store_id uuid, p_date_from date, p_date_to date, p_entry_type text) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.monthly_overhead_total(p_store_id uuid, p_date_from date, p_date_to date, p_entry_type text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.monthly_overhead_total(p_store_id uuid, p_date_from date, p_date_to date, p_entry_type text) TO authenticated;
ALTER FUNCTION public.net_sales(p_store_id uuid, p_date_from date, p_date_to date) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.net_sales(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.net_sales(p_store_id uuid, p_date_from date, p_date_to date) TO authenticated;
ALTER FUNCTION public.operating_profit_monthly(p_store_id uuid, p_date_from date, p_date_to date) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.operating_profit_monthly(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.operating_profit_monthly(p_store_id uuid, p_date_from date, p_date_to date) TO authenticated;
ALTER FUNCTION public.opportunity_breakdown(p_store_id uuid) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.opportunity_breakdown(p_store_id uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.opportunity_breakdown(p_store_id uuid) TO authenticated;
ALTER FUNCTION public.order_count(p_store_id uuid, p_date_from date, p_date_to date) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.order_count(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.order_count(p_store_id uuid, p_date_from date, p_date_to date) TO authenticated;
ALTER FUNCTION public.recoverable_contribution_range(p_store_id uuid) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.recoverable_contribution_range(p_store_id uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.recoverable_contribution_range(p_store_id uuid) TO authenticated;
ALTER FUNCTION public.refund_rate(p_store_id uuid, p_date_from date, p_date_to date) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.refund_rate(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.refund_rate(p_store_id uuid, p_date_from date, p_date_to date) TO authenticated;
ALTER FUNCTION public.repeat_purchase_rate(p_store_id uuid, p_date_from date, p_date_to date) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.repeat_purchase_rate(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.repeat_purchase_rate(p_store_id uuid, p_date_from date, p_date_to date) TO authenticated;
ALTER FUNCTION public.return_amount(p_store_id uuid, p_date_from date, p_date_to date) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.return_amount(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.return_amount(p_store_id uuid, p_date_from date, p_date_to date) TO authenticated;
ALTER FUNCTION public.rolling_3m_averages(p_store_id uuid, p_date_from date) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.rolling_3m_averages(p_store_id uuid, p_date_from date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rolling_3m_averages(p_store_id uuid, p_date_from date) TO authenticated;
ALTER FUNCTION public.trailing_12m_cm_avg(p_store_id uuid, p_date_from date) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.trailing_12m_cm_avg(p_store_id uuid, p_date_from date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.trailing_12m_cm_avg(p_store_id uuid, p_date_from date) TO authenticated;
COMMIT;
