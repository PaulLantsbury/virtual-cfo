-- Night Scout Staging bootstrap, prepared 9 September 2026.
-- Intended target: bioalckltvkhlczusdvl ONLY. Verify the dashboard project first.
-- Recreates observed public structure and hardens access in ONE transaction.
-- No business rows, users, passwords, memberships or old migration ledger copied.
-- Never run on the existing futkktdebdygsdrcknpr project.
BEGIN;
DO $empty$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','v','m','S','f','p'))
 OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace) THEN
  RAISE EXCEPTION 'Bootstrap requires an empty public schema; nothing was replaced';
 END IF;
 IF to_regprocedure('auth.uid()') IS NULL OR to_regclass('auth.users') IS NULL THEN
  RAISE EXCEPTION 'Supabase Auth must already exist';
 END IF;
END;
$empty$;
SET check_function_bodies = false;

CREATE TABLE public."cac_trend_snapshots" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"store_id" uuid NOT NULL,"channel" text NOT NULL,"snapshot_date" date NOT NULL,"cac" numeric(10,2) NOT NULL,"trailing_30d_cac" numeric(10,2),"trailing_90d_cac" numeric(10,2),"mom_change_pct" numeric(8,4),"attributed_new_customers" integer DEFAULT 0 NOT NULL,"spend" numeric(12,2) DEFAULT 0 NOT NULL,"calculation_version" text DEFAULT 'v1'::text NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public."cash_balance_snapshots" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"store_id" uuid NOT NULL,"snapshot_date" date NOT NULL,"cash_balance" numeric(14,2) NOT NULL,"account_key" text DEFAULT 'main'::text NOT NULL,"account_display_name" text DEFAULT 'Main Account'::text NOT NULL,"currency_code" text DEFAULT 'GBP'::text NOT NULL,"source" text DEFAULT 'manual'::text NOT NULL,"external_ref" text,"notes" text,"created_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public."cfo_alerts" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"store_id" uuid NOT NULL,"alert_type" text NOT NULL,"severity" text DEFAULT 'warning'::text NOT NULL,"title" text NOT NULL,"body" text,"is_read" boolean DEFAULT false NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public."channel_opportunity_scores" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"store_id" uuid NOT NULL,"channel" text NOT NULL,"assessed_at" date NOT NULL,"opportunity_type" text NOT NULL,"score" integer DEFAULT 0 NOT NULL,"estimated_uplift_low" numeric(12,2) DEFAULT 0 NOT NULL,"estimated_uplift_high" numeric(12,2) DEFAULT 0 NOT NULL,"rationale" text,"status" text DEFAULT 'active'::text NOT NULL,"calculation_version" text DEFAULT 'v1'::text NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public."customers" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"shopify_customer_id" text,"email" text,"first_name" text,"last_name" text,"created_at" timestamp with time zone,"updated_at" timestamp with time zone,"store_id" uuid NOT NULL,"first_order_at" timestamp with time zone,"total_orders" integer DEFAULT 0 NOT NULL,"is_guest" boolean DEFAULT false NOT NULL);

CREATE TABLE public."discount_codes" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"store_id" uuid NOT NULL,"discount_id" uuid NOT NULL,"code" text NOT NULL,"usage_count" integer DEFAULT 0 NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public."discounts" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"store_id" uuid NOT NULL,"shopify_price_rule_id" text NOT NULL,"title" text,"value_type" text,"value" numeric(10,4),"category" text,"created_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public."marketing_blended_monthly" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"store_id" uuid NOT NULL,"period_start" date NOT NULL,"period_end" date NOT NULL,"total_spend" numeric(12,2) DEFAULT 0 NOT NULL,"overhead_content_spend" numeric(12,2) DEFAULT 0 NOT NULL,"total_attributed_revenue" numeric(12,2) DEFAULT 0 NOT NULL,"total_attributed_orders" integer DEFAULT 0 NOT NULL,"total_new_customers" integer DEFAULT 0 NOT NULL,"blended_cac" numeric(10,2),"blended_roas" numeric(10,4),"blended_mer" numeric(10,4),"blended_contribution_margin_pct" numeric(8,4),"total_contribution_profit" numeric(12,2) DEFAULT 0 NOT NULL,"total_attributed_net_sales" numeric(12,2) DEFAULT 0 NOT NULL,"calculation_version" text DEFAULT 'v1'::text NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public."marketing_channel_daily_metrics" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"store_id" uuid NOT NULL,"channel" text NOT NULL,"metric_date" date NOT NULL,"spend" numeric(12,2) DEFAULT 0 NOT NULL,"impressions" bigint DEFAULT 0 NOT NULL,"clicks" bigint DEFAULT 0 NOT NULL,"sessions" bigint DEFAULT 0 NOT NULL,"attributed_orders" integer DEFAULT 0 NOT NULL,"attributed_new_customers" integer DEFAULT 0 NOT NULL,"attributed_gross_sales" numeric(12,2) DEFAULT 0 NOT NULL,"discount_impact" numeric(12,2) DEFAULT 0 NOT NULL,"returns_impact" numeric(12,2) DEFAULT 0 NOT NULL,"shipping_subsidy_impact" numeric(12,2) DEFAULT 0 NOT NULL,"data_source" text DEFAULT 'estimated'::text NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public."marketing_channel_monthly_snapshots" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"store_id" uuid NOT NULL,"channel" text NOT NULL,"period_start" date NOT NULL,"period_end" date NOT NULL,"spend" numeric(12,2) DEFAULT 0 NOT NULL,"impressions" bigint DEFAULT 0 NOT NULL,"clicks" bigint DEFAULT 0 NOT NULL,"sessions" bigint DEFAULT 0 NOT NULL,"attributed_orders" integer DEFAULT 0 NOT NULL,"attributed_new_customers" integer DEFAULT 0 NOT NULL,"attributed_gross_sales" numeric(12,2) DEFAULT 0 NOT NULL,"discount_impact" numeric(12,2) DEFAULT 0 NOT NULL,"returns_impact" numeric(12,2) DEFAULT 0 NOT NULL,"shipping_subsidy_impact" numeric(12,2) DEFAULT 0 NOT NULL,"attributed_net_sales" numeric(12,2) DEFAULT 0 NOT NULL,"contribution_profit" numeric(12,2) DEFAULT 0 NOT NULL,"contribution_margin_pct" numeric(8,4) DEFAULT 0 NOT NULL,"cac" numeric(10,2),"roas" numeric(10,4),"mer" numeric(10,4),"cac_payback_orders" numeric(8,4),"opportunity_score" integer DEFAULT 0 NOT NULL,"data_freshness" text DEFAULT 'estimated'::text NOT NULL,"calculation_version" text DEFAULT 'v1'::text NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public."opportunities" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"store_id" uuid NOT NULL,"category" text NOT NULL,"title" text NOT NULL,"description" text,"impact_low" numeric(14,2),"impact_high" numeric(14,2),"priority" integer DEFAULT 0 NOT NULL,"status" text DEFAULT 'open'::text NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"confidence" text,"effort" text,"timing" text,"implementation_type" text,"recommended_action" text,"linked_page" text,"linked_page_label" text,"impact_type" text);

CREATE TABLE public."order_line_items" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"order_id" uuid,"product_id" uuid,"variant_id" uuid,"shopify_line_item_id" text,"quantity" integer,"price" numeric(12,2),"discount" numeric(12,2),"total" numeric(12,2),"store_id" uuid NOT NULL);

CREATE TABLE public."orders" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"shopify_order_id" text NOT NULL,"customer_id" uuid,"order_number" text,"order_date" timestamp with time zone,"currency" text,"gross_sales" numeric(12,2) DEFAULT 0 NOT NULL,"discounts" numeric(12,2) DEFAULT 0 NOT NULL,"refunds" numeric(12,2) DEFAULT 0 NOT NULL,"net_sales" numeric(12,2),"tax" numeric(12,2) DEFAULT 0 NOT NULL,"shipping" numeric(12,2),"total_sales" numeric(12,2) DEFAULT 0 NOT NULL,"created_at" timestamp with time zone DEFAULT now(),"store_id" uuid NOT NULL,"financial_status" text DEFAULT 'paid'::text NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"discount_codes" jsonb,"is_guest_checkout" boolean GENERATED ALWAYS AS ((customer_id IS NULL)) STORED,"has_discount" boolean GENERATED ALWAYS AS ((discounts > (0)::numeric)) STORED,"is_cancelled" boolean GENERATED ALWAYS AS ((financial_status = 'cancelled'::text)) STORED,"refund_ex_vat" numeric DEFAULT 0 NOT NULL,"refund_tax" numeric DEFAULT 0 NOT NULL);

CREATE TABLE public."overhead_categories" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"store_id" uuid NOT NULL,"name" text NOT NULL,"category_type" text DEFAULT 'other'::text NOT NULL,"is_fixed" boolean DEFAULT true NOT NULL,"external_account_code" text,"sort_order" integer DEFAULT 0 NOT NULL,"is_active" boolean DEFAULT true NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public."overhead_entries" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"store_id" uuid NOT NULL,"category_id" uuid NOT NULL,"period_start" date NOT NULL,"period_end" date NOT NULL,"amount" numeric(14,2) NOT NULL,"currency_code" text DEFAULT 'GBP'::text NOT NULL,"entry_type" text DEFAULT 'actual'::text NOT NULL,"is_recurring" boolean DEFAULT true NOT NULL,"source" text DEFAULT 'manual'::text NOT NULL,"external_ref" text,"notes" text,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public."product_variants" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"shopify_variant_id" text NOT NULL,"product_id" uuid,"title" text,"sku" text,"price" numeric(12,2),"created_at" timestamp with time zone,"updated_at" timestamp with time zone,"store_id" uuid NOT NULL,"compare_at_price" numeric(12,2),"cost" numeric(12,2),"inventory_quantity" integer DEFAULT 0 NOT NULL,"cost_populated" boolean GENERATED ALWAYS AS ((cost IS NOT NULL)) STORED);

CREATE TABLE public."products" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"shopify_product_id" text NOT NULL,"title" text,"product_type" text,"vendor" text,"created_at" timestamp with time zone,"updated_at" timestamp with time zone,"store_id" uuid NOT NULL,"status" text);

CREATE TABLE public."refund_line_items" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"store_id" uuid NOT NULL,"refund_id" uuid NOT NULL,"order_line_item_id" uuid NOT NULL,"quantity" integer NOT NULL,"subtotal" numeric(12,2) NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public."refunds" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"order_id" uuid,"shopify_refund_id" text,"refund_date" timestamp with time zone,"amount" numeric(12,2),"reason" text,"store_id" uuid NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public."store_cost_assumptions" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"store_id" uuid NOT NULL,"payment_fee_rate" numeric(8,5) NOT NULL,"fulfilment_cost_per_order" numeric(10,2) NOT NULL,"packaging_cost_per_order" numeric(10,2) NOT NULL,"return_handling_rate" numeric(8,5) NOT NULL,"effective_from" date NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"vat_rate" numeric DEFAULT 0.20 NOT NULL,"shipping_cost_per_order" numeric DEFAULT 0 NOT NULL,"marketing_spend_rate" numeric DEFAULT 0 NOT NULL);

CREATE TABLE public."store_settings" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"store_id" uuid NOT NULL,"cm_target_pct" numeric(6,2),"runway_warn_months" numeric(6,2),"repeat_rate_target_pct" numeric(6,2),"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public."stores" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"shopify_domain" text NOT NULL,"shopify_store_id" text NOT NULL,"name" text,"currency_code" character(3) DEFAULT 'GBP'::bpchar NOT NULL,"timezone" text DEFAULT 'Europe/London'::text NOT NULL,"is_active" boolean DEFAULT true NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL);

ALTER TABLE public."cac_trend_snapshots" ADD CONSTRAINT "cac_trend_snapshots_pkey" PRIMARY KEY (id);

ALTER TABLE public."cac_trend_snapshots" ADD CONSTRAINT "cts_calc_version_check" CHECK ((calculation_version ~ '^v[0-9]+$'::text));

ALTER TABLE public."cac_trend_snapshots" ADD CONSTRAINT "cts_channel_check" CHECK ((channel = ANY (ARRAY['meta'::text, 'google_shopping'::text, 'email'::text, 'organic'::text, 'direct'::text, 'other'::text])));

ALTER TABLE public."cac_trend_snapshots" ADD CONSTRAINT "cts_unique" UNIQUE (store_id, channel, snapshot_date);

ALTER TABLE public."cash_balance_snapshots" ADD CONSTRAINT "cash_balance_snapshots_pkey" PRIMARY KEY (id);

ALTER TABLE public."cash_balance_snapshots" ADD CONSTRAINT "chk_cash_balance_snapshots_source" CHECK ((source = ANY (ARRAY['manual'::text, 'xero'::text, 'quickbooks'::text, 'open_banking'::text, 'csv_import'::text])));

ALTER TABLE public."cash_balance_snapshots" ADD CONSTRAINT "uq_cash_balance_snapshots_store_date_account" UNIQUE (store_id, snapshot_date, account_key);

ALTER TABLE public."cfo_alerts" ADD CONSTRAINT "cfo_alerts_pkey" PRIMARY KEY (id);

ALTER TABLE public."channel_opportunity_scores" ADD CONSTRAINT "channel_opportunity_scores_pkey" PRIMARY KEY (id);

ALTER TABLE public."channel_opportunity_scores" ADD CONSTRAINT "cos_calc_version_check" CHECK ((calculation_version ~ '^v[0-9]+$'::text));

ALTER TABLE public."channel_opportunity_scores" ADD CONSTRAINT "cos_channel_check" CHECK ((channel = ANY (ARRAY['meta'::text, 'google_shopping'::text, 'email'::text, 'organic'::text, 'direct'::text, 'other'::text, 'blended'::text])));

ALTER TABLE public."channel_opportunity_scores" ADD CONSTRAINT "cos_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'dismissed'::text, 'implemented'::text, 'monitoring'::text])));

ALTER TABLE public."channel_opportunity_scores" ADD CONSTRAINT "cos_type_check" CHECK ((opportunity_type = ANY (ARRAY['contribution_gap'::text, 'cac_reduction'::text, 'budget_reallocation'::text, 'roas_improvement'::text, 'channel_mix'::text])));

ALTER TABLE public."customers" ADD CONSTRAINT "customers_pkey" PRIMARY KEY (id);

ALTER TABLE public."customers" ADD CONSTRAINT "uq_customers_store_shopify" UNIQUE (store_id, shopify_customer_id);

ALTER TABLE public."discount_codes" ADD CONSTRAINT "discount_codes_pkey" PRIMARY KEY (id);

ALTER TABLE public."discount_codes" ADD CONSTRAINT "uq_discount_codes_store_code" UNIQUE (store_id, code);

ALTER TABLE public."discounts" ADD CONSTRAINT "discounts_pkey" PRIMARY KEY (id);

ALTER TABLE public."discounts" ADD CONSTRAINT "uq_discounts_store_shopify" UNIQUE (store_id, shopify_price_rule_id);

ALTER TABLE public."marketing_blended_monthly" ADD CONSTRAINT "marketing_blended_monthly_pkey" PRIMARY KEY (id);

ALTER TABLE public."marketing_blended_monthly" ADD CONSTRAINT "mbm_calc_version_check" CHECK ((calculation_version ~ '^v[0-9]+$'::text));

ALTER TABLE public."marketing_blended_monthly" ADD CONSTRAINT "mbm_unique" UNIQUE (store_id, period_start);

ALTER TABLE public."marketing_channel_daily_metrics" ADD CONSTRAINT "marketing_channel_daily_metrics_pkey" PRIMARY KEY (id);

ALTER TABLE public."marketing_channel_daily_metrics" ADD CONSTRAINT "mcdm_channel_check" CHECK ((channel = ANY (ARRAY['meta'::text, 'google_shopping'::text, 'email'::text, 'organic'::text, 'direct'::text, 'other'::text])));

ALTER TABLE public."marketing_channel_daily_metrics" ADD CONSTRAINT "mcdm_source_check" CHECK ((data_source = ANY (ARRAY['meta_api'::text, 'google_api'::text, 'manual'::text, 'estimated'::text, 'shopify'::text])));

ALTER TABLE public."marketing_channel_daily_metrics" ADD CONSTRAINT "mcdm_unique" UNIQUE (store_id, channel, metric_date);

ALTER TABLE public."marketing_channel_monthly_snapshots" ADD CONSTRAINT "marketing_channel_monthly_snapshots_pkey" PRIMARY KEY (id);

ALTER TABLE public."marketing_channel_monthly_snapshots" ADD CONSTRAINT "mcms_calc_version_check" CHECK ((calculation_version ~ '^v[0-9]+$'::text));

ALTER TABLE public."marketing_channel_monthly_snapshots" ADD CONSTRAINT "mcms_channel_check" CHECK ((channel = ANY (ARRAY['meta'::text, 'google_shopping'::text, 'email'::text, 'organic'::text, 'direct'::text, 'other'::text])));

ALTER TABLE public."marketing_channel_monthly_snapshots" ADD CONSTRAINT "mcms_freshness_check" CHECK ((data_freshness = ANY (ARRAY['live'::text, 'estimated'::text, 'stale'::text])));

ALTER TABLE public."marketing_channel_monthly_snapshots" ADD CONSTRAINT "mcms_unique" UNIQUE (store_id, channel, period_start);

ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_pkey" PRIMARY KEY (id);

ALTER TABLE public."order_line_items" ADD CONSTRAINT "order_line_items_pkey" PRIMARY KEY (id);

ALTER TABLE public."order_line_items" ADD CONSTRAINT "uq_order_line_items_store_shopify" UNIQUE (store_id, shopify_line_item_id);

ALTER TABLE public."orders" ADD CONSTRAINT "orders_pkey" PRIMARY KEY (id);

ALTER TABLE public."orders" ADD CONSTRAINT "uq_orders_store_shopify" UNIQUE (store_id, shopify_order_id);

ALTER TABLE public."overhead_categories" ADD CONSTRAINT "chk_overhead_categories_type" CHECK ((category_type = ANY (ARRAY['payroll'::text, 'facilities'::text, 'technology'::text, 'marketing_fixed'::text, 'logistics_fixed'::text, 'finance'::text, 'other'::text])));

ALTER TABLE public."overhead_categories" ADD CONSTRAINT "overhead_categories_pkey" PRIMARY KEY (id);

ALTER TABLE public."overhead_categories" ADD CONSTRAINT "uq_overhead_categories_store_name" UNIQUE (store_id, name);

ALTER TABLE public."overhead_entries" ADD CONSTRAINT "chk_overhead_entries_entry_type" CHECK ((entry_type = ANY (ARRAY['actual'::text, 'budget'::text, 'forecast'::text])));

ALTER TABLE public."overhead_entries" ADD CONSTRAINT "chk_overhead_entries_source" CHECK ((source = ANY (ARRAY['manual'::text, 'xero'::text, 'quickbooks'::text, 'csv_import'::text])));

ALTER TABLE public."overhead_entries" ADD CONSTRAINT "overhead_entries_pkey" PRIMARY KEY (id);

ALTER TABLE public."overhead_entries" ADD CONSTRAINT "uq_overhead_entries_store_cat_period_type_recurring" UNIQUE (store_id, category_id, period_start, entry_type, is_recurring);

ALTER TABLE public."product_variants" ADD CONSTRAINT "product_variants_pkey" PRIMARY KEY (id);

ALTER TABLE public."product_variants" ADD CONSTRAINT "uq_product_variants_store_shopify" UNIQUE (store_id, shopify_variant_id);

ALTER TABLE public."products" ADD CONSTRAINT "products_pkey" PRIMARY KEY (id);

ALTER TABLE public."products" ADD CONSTRAINT "uq_products_store_shopify" UNIQUE (store_id, shopify_product_id);

ALTER TABLE public."refund_line_items" ADD CONSTRAINT "refund_line_items_pkey" PRIMARY KEY (id);

ALTER TABLE public."refunds" ADD CONSTRAINT "refunds_pkey" PRIMARY KEY (id);

ALTER TABLE public."refunds" ADD CONSTRAINT "uq_refunds_store_shopify" UNIQUE (store_id, shopify_refund_id);

ALTER TABLE public."store_cost_assumptions" ADD CONSTRAINT "store_cost_assumptions_pkey" PRIMARY KEY (id);

ALTER TABLE public."store_cost_assumptions" ADD CONSTRAINT "uq_store_cost_assumptions_store_date" UNIQUE (store_id, effective_from);

ALTER TABLE public."store_settings" ADD CONSTRAINT "store_settings_pkey" PRIMARY KEY (id);

ALTER TABLE public."store_settings" ADD CONSTRAINT "uq_store_settings_store" UNIQUE (store_id);

ALTER TABLE public."stores" ADD CONSTRAINT "stores_pkey" PRIMARY KEY (id);

ALTER TABLE public."stores" ADD CONSTRAINT "uq_stores_shopify_domain" UNIQUE (shopify_domain);

ALTER TABLE public."stores" ADD CONSTRAINT "uq_stores_shopify_store_id" UNIQUE (shopify_store_id);

ALTER TABLE public."cac_trend_snapshots" ADD CONSTRAINT "cac_trend_snapshots_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id);

ALTER TABLE public."cash_balance_snapshots" ADD CONSTRAINT "cash_balance_snapshots_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE public."cfo_alerts" ADD CONSTRAINT "cfo_alerts_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE public."channel_opportunity_scores" ADD CONSTRAINT "channel_opportunity_scores_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id);

ALTER TABLE public."customers" ADD CONSTRAINT "customers_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE public."discount_codes" ADD CONSTRAINT "discount_codes_discount_id_fkey" FOREIGN KEY (discount_id) REFERENCES discounts(id) ON DELETE CASCADE;

ALTER TABLE public."discount_codes" ADD CONSTRAINT "discount_codes_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE public."discounts" ADD CONSTRAINT "discounts_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE public."marketing_blended_monthly" ADD CONSTRAINT "marketing_blended_monthly_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id);

ALTER TABLE public."marketing_channel_daily_metrics" ADD CONSTRAINT "marketing_channel_daily_metrics_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id);

ALTER TABLE public."marketing_channel_monthly_snapshots" ADD CONSTRAINT "marketing_channel_monthly_snapshots_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id);

ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE public."order_line_items" ADD CONSTRAINT "order_line_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE public."order_line_items" ADD CONSTRAINT "order_line_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

ALTER TABLE public."order_line_items" ADD CONSTRAINT "order_line_items_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE public."order_line_items" ADD CONSTRAINT "order_line_items_variant_id_fkey" FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;

ALTER TABLE public."orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public."orders" ADD CONSTRAINT "orders_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE public."overhead_categories" ADD CONSTRAINT "overhead_categories_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE public."overhead_entries" ADD CONSTRAINT "overhead_entries_category_id_fkey" FOREIGN KEY (category_id) REFERENCES overhead_categories(id) ON DELETE RESTRICT;

ALTER TABLE public."overhead_entries" ADD CONSTRAINT "overhead_entries_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE public."product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE public."product_variants" ADD CONSTRAINT "product_variants_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE public."products" ADD CONSTRAINT "products_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE public."refund_line_items" ADD CONSTRAINT "refund_line_items_order_line_item_id_fkey" FOREIGN KEY (order_line_item_id) REFERENCES order_line_items(id) ON DELETE CASCADE;

ALTER TABLE public."refund_line_items" ADD CONSTRAINT "refund_line_items_refund_id_fkey" FOREIGN KEY (refund_id) REFERENCES refunds(id) ON DELETE CASCADE;

ALTER TABLE public."refund_line_items" ADD CONSTRAINT "refund_line_items_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE public."refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE public."refunds" ADD CONSTRAINT "refunds_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE public."store_cost_assumptions" ADD CONSTRAINT "store_cost_assumptions_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE public."store_settings" ADD CONSTRAINT "store_settings_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

CREATE INDEX idx_cash_balance_snapshots_store_date ON public.cash_balance_snapshots USING btree (store_id, snapshot_date DESC);

CREATE INDEX idx_cfo_alerts_store_read ON public.cfo_alerts USING btree (store_id, is_read, created_at DESC);

CREATE INDEX idx_customers_store_first_order ON public.customers USING btree (store_id, first_order_at);

CREATE INDEX idx_discount_codes_store_discount ON public.discount_codes USING btree (store_id, discount_id);

CREATE INDEX idx_opportunities_store_status ON public.opportunities USING btree (store_id, status);

CREATE INDEX idx_order_line_items_store_order ON public.order_line_items USING btree (store_id, order_id);

CREATE INDEX idx_orders_store_created ON public.orders USING btree (store_id, created_at);

CREATE INDEX idx_orders_store_financial_status ON public.orders USING btree (store_id, financial_status);

CREATE INDEX idx_orders_store_updated ON public.orders USING btree (store_id, updated_at);

CREATE INDEX idx_overhead_entries_store_category_period ON public.overhead_entries USING btree (store_id, category_id, period_start);

CREATE INDEX idx_overhead_entries_store_period_type ON public.overhead_entries USING btree (store_id, period_start, entry_type);

CREATE INDEX idx_products_store_status ON public.products USING btree (store_id, status);

CREATE INDEX idx_refund_line_items_refund ON public.refund_line_items USING btree (store_id, refund_id);

CREATE INDEX idx_refunds_store_created ON public.refunds USING btree (store_id, created_at);

CREATE INDEX idx_refunds_store_order ON public.refunds USING btree (store_id, order_id);

CREATE OR REPLACE FUNCTION public.average_order_value(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT COALESCE(
SUM(
COALESCE(o.gross_sales, 0)
- COALESCE(o.discounts, 0)
- COALESCE(o.refunds, 0)
- COALESCE(o.tax, 0)
)
/ NULLIF(
COUNT(*) FILTER (WHERE o.financial_status <> 'refunded'),
0
),
0
)
FROM public.orders o
WHERE o.store_id = p_store_id
AND o.created_at::date BETWEEN p_date_from AND p_date_to
AND o.financial_status <> 'cancelled';
$function$
;

CREATE OR REPLACE FUNCTION public.blended_marketing_performance(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS TABLE(period_start date, period_end date, total_spend numeric, overhead_content_spend numeric, total_attributed_revenue numeric, total_attributed_orders integer, total_new_customers integer, blended_cac numeric, blended_roas numeric, blended_mer numeric, blended_contribution_margin_pct numeric, total_contribution_profit numeric, total_attributed_net_sales numeric, calculation_version text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    b.period_start, b.period_end, b.total_spend, b.overhead_content_spend,
    b.total_attributed_revenue, b.total_attributed_orders, b.total_new_customers,
    b.blended_cac, b.blended_roas, b.blended_mer,
    b.blended_contribution_margin_pct, b.total_contribution_profit,
    b.total_attributed_net_sales, b.calculation_version
  FROM public.marketing_blended_monthly b
  WHERE b.store_id    = p_store_id
    AND b.period_start >= p_date_from
    AND b.period_end   <= p_date_to
  ORDER BY b.period_start DESC
  LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.cac_trend_by_channel(p_store_id uuid, p_up_to_date date DEFAULT CURRENT_DATE, p_months_back integer DEFAULT 6)
 RETURNS TABLE(channel text, snapshot_date date, cac numeric, trailing_30d_cac numeric, trailing_90d_cac numeric, mom_change_pct numeric, attributed_new_customers integer, spend numeric, calculation_version text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    c.channel, c.snapshot_date, c.cac, c.trailing_30d_cac, c.trailing_90d_cac,
    c.mom_change_pct, c.attributed_new_customers, c.spend, c.calculation_version
  FROM public.cac_trend_snapshots c
  WHERE c.store_id      = p_store_id
    AND c.snapshot_date <= p_up_to_date
    AND c.snapshot_date >= (p_up_to_date - (p_months_back || ' months')::interval)::date
  ORDER BY c.channel ASC, c.snapshot_date ASC;
$function$
;

CREATE OR REPLACE FUNCTION public.cash_runway_months(p_store_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_total_cash    numeric;
  v_monthly_fixed numeric;
  v_period_from   date;
  v_period_to     date;
BEGIN
  -- Step 1: aggregate cash balance across all accounts at the latest snapshot
  SELECT SUM(cash_balance)
  INTO   v_total_cash
  FROM   public.cash_balance_snapshots
  WHERE  store_id      = p_store_id
    AND  snapshot_date = (
           SELECT MAX(s2.snapshot_date)
           FROM   public.cash_balance_snapshots s2
           WHERE  s2.store_id = p_store_id
         );

  -- Return NULL if no snapshot exists for this store
  IF v_total_cash IS NULL THEN
    RETURN NULL;
  END IF;

  -- Step 2: current calendar month bounds
  v_period_from := date_trunc('month', CURRENT_DATE)::date;
  v_period_to   := (date_trunc('month', CURRENT_DATE) + interval '1 month')::date - 1;

  -- Step 3: actual overhead total for the current month
  v_monthly_fixed := public.monthly_overhead_total(
    p_store_id,
    v_period_from,
    v_period_to,
    'actual'
  );

  -- Step 4: runway in months (NULLIF guards against zero denominator)
  RETURN v_total_cash / NULLIF(v_monthly_fixed, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cfo_alerts(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS TABLE(alert_key text, severity text, metric text, current_val numeric, threshold numeric, triggered boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  -- ── Named threshold constants ──────────────────────────────────────────────
  c_revenue_decline_pct     constant numeric :=  -5.0;
  c_margin_fall_pp          constant numeric :=  -0.5;
  c_margin_critical_floor   constant numeric :=  70.0;   -- percent (cm_pct × 100)
  c_refund_rise_pp          constant numeric :=   0.5;
  c_refund_critical_floor   constant numeric :=   8.0;   -- percent (refund_rate × 100)
  c_discount_rise_pp        constant numeric :=   1.0;
  c_discount_critical_floor constant numeric :=  15.0;   -- percent (discount_dep × 100)
  c_overhead_outpace_gap    constant numeric :=   5.0;   -- percentage-point gap
  c_profit_deteriorate_pct  constant numeric := -10.0;
  c_runway_low_months       constant numeric :=   1.0;
  c_runway_tighten_months   constant numeric :=   2.0;
  c_runway_decline_months   constant numeric :=  -0.25;

  -- ── Delta row from month_on_month_delta() ──────────────────────────────────
  r  record;
BEGIN
  -- Single call to month_on_month_delta — all 13 rules share this fetch
  SELECT * INTO r
  FROM public.month_on_month_delta(p_store_id, p_date_from, p_date_to);

  IF NOT FOUND THEN
    RETURN; -- no data for this period — return empty set
  END IF;

  RETURN QUERY

  -- ── 1. revenue_declining ───────────────────────────────────────────────────
  SELECT
    'revenue_declining'::text,
    'warning'::text,
    'gross_revenue'::text,
    r.gross_revenue_delta_pct,
    c_revenue_decline_pct::numeric,
    (r.gross_revenue_delta_pct IS NOT NULL
     AND r.gross_revenue_delta_pct < c_revenue_decline_pct)::boolean

  UNION ALL

  -- ── 2. revenue_stall (growth between decline threshold and 0%) ─────────────
  SELECT
    'revenue_stall',
    'info',
    'gross_revenue',
    r.gross_revenue_delta_pct,
    0.0,
    (r.gross_revenue_delta_pct IS NOT NULL
     AND r.gross_revenue_delta_pct >= c_revenue_decline_pct
     AND r.gross_revenue_delta_pct <= 0.0)::boolean

  UNION ALL

  -- ── 3. margin_falling (cm pp delta below warning threshold) ───────────────
  SELECT
    'margin_falling',
    'warning',
    'contribution_margin_pct',
    r.cm_pct_delta_pp,
    c_margin_fall_pp::numeric,
    (r.cm_pct_delta_pp IS NOT NULL
     AND r.cm_pct_delta_pp < c_margin_fall_pp)::boolean

  UNION ALL

  -- ── 4. margin_critical (absolute cm below 70% floor) ──────────────────────
  SELECT
    'margin_critical',
    'critical',
    'contribution_margin_pct',
    ROUND(r.cm_pct_cur * 100, 2),
    c_margin_critical_floor::numeric,
    (r.cm_pct_cur IS NOT NULL
     AND r.cm_pct_cur * 100 < c_margin_critical_floor)::boolean

  UNION ALL

  -- ── 5. refunds_rising (refund rate pp delta above warning threshold) ───────
  SELECT
    'refunds_rising',
    'warning',
    'refund_rate',
    r.refund_rate_delta_pp,
    c_refund_rise_pp::numeric,
    (r.refund_rate_delta_pp IS NOT NULL
     AND r.refund_rate_delta_pp > c_refund_rise_pp)::boolean

  UNION ALL

  -- ── 6. refunds_critical (absolute refund rate above 8% floor) ─────────────
  SELECT
    'refunds_critical',
    'critical',
    'refund_rate',
    ROUND(r.refund_rate_cur * 100, 2),
    c_refund_critical_floor::numeric,
    (r.refund_rate_cur IS NOT NULL
     AND r.refund_rate_cur * 100 > c_refund_critical_floor)::boolean

  UNION ALL

  -- ── 7. discounts_rising (discount dep pp delta above warning threshold) ────
  SELECT
    'discounts_rising',
    'warning',
    'discount_dependency',
    r.discount_dep_delta_pp,
    c_discount_rise_pp::numeric,
    (r.discount_dep_delta_pp IS NOT NULL
     AND r.discount_dep_delta_pp > c_discount_rise_pp)::boolean

  UNION ALL

  -- ── 8. discounts_critical (absolute discount dep above 15% floor) ──────────
  SELECT
    'discounts_critical',
    'critical',
    'discount_dependency',
    ROUND(r.discount_dep_cur * 100, 2),
    c_discount_critical_floor::numeric,
    (r.discount_dep_cur IS NOT NULL
     AND r.discount_dep_cur * 100 > c_discount_critical_floor)::boolean

  UNION ALL

  -- ── 9. overhead_outpacing_revenue ─────────────────────────────────────────
  -- Overhead is growing faster than revenue by more than the gap threshold.
  -- current_val = (overhead_delta_pct − gross_revenue_delta_pct).
  SELECT
    'overhead_outpacing_revenue',
    'warning',
    'fixed_overhead_actual',
    ROUND(COALESCE(r.overhead_delta_pct, 0) - COALESCE(r.gross_revenue_delta_pct, 0), 1),
    c_overhead_outpace_gap::numeric,
    (r.overhead_delta_pct IS NOT NULL
     AND r.gross_revenue_delta_pct IS NOT NULL
     AND (r.overhead_delta_pct - r.gross_revenue_delta_pct) > c_overhead_outpace_gap)::boolean

  UNION ALL

  -- ── 10. profit_deteriorating (op_profit delta worse than −10%) ─────────────
  SELECT
    'profit_deteriorating',
    'warning',
    'operating_profit',
    r.op_profit_delta_pct,
    c_profit_deteriorate_pct::numeric,
    (r.op_profit_delta_pct IS NOT NULL
     AND r.op_profit_delta_pct < c_profit_deteriorate_pct)::boolean

  UNION ALL

  -- ── 11. runway_low (cash runway below 1.0-month critical floor) ────────────
  SELECT
    'runway_low',
    'critical',
    'cash_runway_months',
    r.runway_cur,
    c_runway_low_months::numeric,
    (r.runway_cur IS NOT NULL
     AND r.runway_cur < c_runway_low_months)::boolean

  UNION ALL

  -- ── 12. runway_tightening (runway in the 1.0–2.0 month warning band) ───────
  SELECT
    'runway_tightening',
    'warning',
    'cash_runway_months',
    r.runway_cur,
    c_runway_tighten_months::numeric,
    (r.runway_cur IS NOT NULL
     AND r.runway_cur >= c_runway_low_months
     AND r.runway_cur < c_runway_tighten_months)::boolean

  UNION ALL

  -- ── 13. runway_declining (runway shrinking by > 0.25 months MoM) ──────────
  SELECT
    'runway_declining',
    'info',
    'cash_runway_months',
    r.runway_delta_months,
    c_runway_decline_months::numeric,
    (r.runway_delta_months IS NOT NULL
     AND r.runway_delta_months < c_runway_decline_months)::boolean;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.channel_metrics_monthly(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS TABLE(channel text, period_start date, period_end date, spend numeric, impressions bigint, clicks bigint, sessions bigint, attributed_orders integer, attributed_new_customers integer, attributed_gross_sales numeric, discount_impact numeric, returns_impact numeric, shipping_subsidy_impact numeric, attributed_net_sales numeric, contribution_profit numeric, contribution_margin_pct numeric, cac numeric, roas numeric, mer numeric, cac_payback_orders numeric, opportunity_score integer, data_freshness text, calculation_version text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    s.channel, s.period_start, s.period_end, s.spend, s.impressions,
    s.clicks, s.sessions, s.attributed_orders, s.attributed_new_customers,
    s.attributed_gross_sales, s.discount_impact, s.returns_impact,
    s.shipping_subsidy_impact, s.attributed_net_sales, s.contribution_profit,
    s.contribution_margin_pct, s.cac, s.roas, s.mer, s.cac_payback_orders,
    s.opportunity_score, s.data_freshness, s.calculation_version
  FROM public.marketing_channel_monthly_snapshots s
  WHERE s.store_id    = p_store_id
    AND s.period_start >= p_date_from
    AND s.period_end   <= p_date_to
  ORDER BY s.opportunity_score DESC, s.spend DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.channel_opportunities_active(p_store_id uuid)
 RETURNS TABLE(channel text, assessed_at date, opportunity_type text, score integer, estimated_uplift_low numeric, estimated_uplift_high numeric, rationale text, status text, calculation_version text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    c.channel, c.assessed_at, c.opportunity_type, c.score,
    c.estimated_uplift_low, c.estimated_uplift_high,
    c.rationale, c.status, c.calculation_version
  FROM public.channel_opportunity_scores c
  WHERE c.store_id = p_store_id
    AND c.status   = 'active'
  ORDER BY c.score DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.contribution_margin_pct(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_payment_fee_rate        numeric;
  v_fulfilment_cost_per_ord numeric;
  v_packaging_cost_per_ord  numeric;
  v_return_handling_rate    numeric;
  v_shipping_cost_per_ord   numeric;
  v_marketing_spend_rate    numeric;
  v_net_sales               numeric;
  v_gross_revenue           numeric;
  v_order_count             bigint;
  v_return_amount           numeric;
BEGIN
  -- Most recent cost assumptions effective at or before the period start.
  -- ORDER BY is required: multiple rows may exist per store (e.g. annual reviews).
  -- effective_from <= p_date_from ensures future-dated rows are excluded from
  -- historical period calculations.
  SELECT payment_fee_rate,
         fulfilment_cost_per_order,
         packaging_cost_per_order,
         return_handling_rate,
         shipping_cost_per_order,
         marketing_spend_rate
  INTO   v_payment_fee_rate,
         v_fulfilment_cost_per_ord,
         v_packaging_cost_per_ord,
         v_return_handling_rate,
         v_shipping_cost_per_ord,
         v_marketing_spend_rate
  FROM   public.store_cost_assumptions
  WHERE  store_id       = p_store_id
    AND  effective_from <= p_date_from
  ORDER  BY effective_from DESC
  LIMIT  1;

  -- NULL signals "store not configured" — frontend falls back to commerceMetrics.
  -- Distinct from 0 which means "configured but no orders in period".
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Delegate to existing Phase 1 helper functions for consistency.
  -- These functions each use COALESCE(..., 0) so they never return NULL.
  v_net_sales     := public.net_sales(p_store_id, p_date_from, p_date_to);
  v_gross_revenue := public.gross_revenue(p_store_id, p_date_from, p_date_to);
  v_order_count   := public.order_count(p_store_id, p_date_from, p_date_to);
  v_return_amount := public.return_amount(p_store_id, p_date_from, p_date_to);

  -- Return 0 when no orders in the period.
  -- Distinct from NULL ("not configured") — caller should treat 0 as
  -- "data exists but period is empty" and show the static fallback value.
  IF v_net_sales = 0 THEN RETURN 0; END IF;

  -- Full six-component variable cost formula.
  --
  --   CM = (net_sales
  --         − payment_fees     [net_sales    × payment_fee_rate]
  --         − fulfilment       [order_count  × fulfilment_cost_per_order]
  --         − packaging        [order_count  × packaging_cost_per_order]
  --         − shipping         [order_count  × shipping_cost_per_order]
  --         − return_handling  [return_amount × return_handling_rate]
  --         − marketing_spend  [gross_revenue × marketing_spend_rate]
  --        ) / net_sales
  --
  -- Denominator: net_sales (after discounts and refunds, excluding VAT).
  -- VAT is NOT deducted — it is already excluded from net_sales.
  --
  -- gross_revenue is used only for the marketing deduction: performance
  -- marketing spend scales with revenue, not order count.
  --
  -- shipping_cost_per_order and marketing_spend_rate default to 0 for stores
  -- that have not yet been configured, preserving backward compatibility.
  RETURN ROUND(
    (
        v_net_sales
      - (v_net_sales     * v_payment_fee_rate)
      - (v_order_count   * v_fulfilment_cost_per_ord)
      - (v_order_count   * v_packaging_cost_per_ord)
      - (v_order_count   * v_shipping_cost_per_ord)
      - (v_return_amount * v_return_handling_rate)
      - (v_gross_revenue * v_marketing_spend_rate)
    ) / v_net_sales,
    4
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.discount_cost(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(SUM(discounts), 0) FROM public.orders
  WHERE store_id = p_store_id AND created_at::date BETWEEN p_date_from AND p_date_to
    AND financial_status <> 'cancelled';
$function$
;

CREATE OR REPLACE FUNCTION public.discount_dependency(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(SUM(discounts) / NULLIF(SUM(gross_sales), 0), 0) FROM public.orders
  WHERE store_id = p_store_id AND created_at::date BETWEEN p_date_from AND p_date_to
    AND financial_status <> 'cancelled';
$function$
;

CREATE OR REPLACE FUNCTION public.get_marketing_spend_rate(p_store_id uuid, p_date_from date DEFAULT CURRENT_DATE)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_store text;
  v_rate         numeric;
BEGIN
  -- ── Tenant isolation guard ───────────────────────────────────────────────
  -- Read app.current_store_id from the caller's JWT claim (set by Supabase's
  -- RLS infrastructure).  Raise an error if it does not match p_store_id.
  -- When the setting is absent or empty (service_role / admin calls), skip
  -- the check — consistent with all other Phase 1 SECURITY DEFINER functions.
  v_caller_store := current_setting('app.current_store_id', true);
  IF v_caller_store IS NOT NULL
     AND v_caller_store <> ''
     AND v_caller_store::uuid <> p_store_id
  THEN
    RAISE EXCEPTION 'Unauthorized: caller store_id does not match requested store_id';
  END IF;

  -- ── Data fetch ───────────────────────────────────────────────────────────
  SELECT marketing_spend_rate
  INTO   v_rate
  FROM   public.store_cost_assumptions
  WHERE  store_id       = p_store_id
    AND  effective_from <= p_date_from
  ORDER  BY effective_from DESC
  LIMIT  1;

  -- NULL when store not configured — caller falls back to static constant.
  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN v_rate;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.gross_revenue(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(SUM(gross_sales), 0) FROM public.orders
  WHERE store_id = p_store_id AND created_at::date BETWEEN p_date_from AND p_date_to
    AND financial_status <> 'cancelled';
$function$
;

CREATE OR REPLACE FUNCTION public.month_on_month_delta(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS TABLE(gross_revenue_cur numeric, gross_revenue_prv numeric, gross_revenue_delta_pct numeric, net_sales_cur numeric, net_sales_prv numeric, net_sales_delta_pct numeric, aov_cur numeric, aov_prv numeric, aov_delta_pct numeric, refund_rate_cur numeric, refund_rate_prv numeric, refund_rate_delta_pp numeric, discount_dep_cur numeric, discount_dep_prv numeric, discount_dep_delta_pp numeric, rpr_cur numeric, rpr_prv numeric, rpr_delta_pp numeric, cm_pct_cur numeric, cm_pct_prv numeric, cm_pct_delta_pp numeric, op_profit_cur numeric, op_profit_prv numeric, op_profit_delta_pct numeric, overhead_cur numeric, overhead_prv numeric, overhead_delta_pct numeric, runway_cur numeric, runway_prv numeric, runway_delta_months numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row        record;
  v_prior_from date;
  v_prior_to   date;
  v_prior_cash numeric;
  v_prior_ovhd numeric;
  v_runway_cur numeric;
  v_runway_prv numeric;
BEGIN
  -- ── 1. Load the delta row from the view ────────────────────────────────────
  SELECT *
  INTO   v_row
  FROM   public.v_month_on_month
  WHERE  store_id     = p_store_id
    AND  period_start = p_date_from;

  IF NOT FOUND THEN
    RETURN; -- empty result set — caller receives zero rows
  END IF;

  -- ── 2. Current runway (live, always reads CURRENT_DATE snapshot) ───────────
  v_runway_cur := public.cash_runway_months(p_store_id);

  -- ── 3. Prior-month runway: cash at end of prior month / prior overhead ──────
  v_prior_from := date_trunc('month', p_date_from - interval '1 month')::date;
  v_prior_to   := (v_prior_from + interval '1 month')::date - 1;

  -- Most recent snapshot on or before the last day of the prior month
  SELECT COALESCE(SUM(s.cash_balance), 0)
  INTO   v_prior_cash
  FROM   public.cash_balance_snapshots s
  WHERE  s.store_id     = p_store_id
    AND  s.snapshot_date = (
           SELECT MAX(s2.snapshot_date)
           FROM   public.cash_balance_snapshots s2
           WHERE  s2.store_id     = p_store_id
             AND  s2.snapshot_date <= v_prior_to
         );

  v_prior_ovhd := public.monthly_overhead_total(
    p_store_id, v_prior_from, v_prior_to, 'actual'
  );

  v_runway_prv := v_prior_cash / NULLIF(v_prior_ovhd, 0);

  -- ── 4. Return the combined row ─────────────────────────────────────────────
  RETURN QUERY
  SELECT
    v_row.gross_revenue_cur,
    v_row.gross_revenue_prv,
    v_row.gross_revenue_delta_pct,
    v_row.net_sales_cur,
    v_row.net_sales_prv,
    v_row.net_sales_delta_pct,
    v_row.aov_cur,
    v_row.aov_prv,
    v_row.aov_delta_pct,
    v_row.refund_rate_cur,
    v_row.refund_rate_prv,
    v_row.refund_rate_delta_pp,
    v_row.discount_dep_cur,
    v_row.discount_dep_prv,
    v_row.discount_dep_delta_pp,
    v_row.rpr_cur,
    v_row.rpr_prv,
    v_row.rpr_delta_pp,
    v_row.cm_pct_cur,
    v_row.cm_pct_prv,
    v_row.cm_pct_delta_pp,
    v_row.op_profit_cur,
    v_row.op_profit_prv,
    v_row.op_profit_delta_pct,
    v_row.overhead_cur,
    v_row.overhead_prv,
    v_row.overhead_delta_pct,
    v_runway_cur,
    v_runway_prv,
    v_runway_cur - v_runway_prv;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.monthly_overhead_total(p_store_id uuid, p_date_from date, p_date_to date, p_entry_type text DEFAULT 'actual'::text)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_total numeric;
BEGIN
  SELECT COALESCE(SUM(oe.amount), 0)
  INTO   v_total
  FROM   public.overhead_entries    oe
  JOIN   public.overhead_categories oc
    ON   oc.id        = oe.category_id
   AND   oc.is_active = true
  WHERE  oe.store_id     = p_store_id
    AND  oe.period_start >= p_date_from
    AND  oe.period_end   <= p_date_to
    AND  oe.entry_type   = p_entry_type;

  RETURN v_total;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.net_sales(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT COALESCE(
SUM(
COALESCE(o.gross_sales, 0)
- COALESCE(o.discounts, 0)
- COALESCE(o.refunds, 0)
- COALESCE(o.tax, 0)
),
0
)
FROM public.orders o
WHERE o.store_id = p_store_id
AND o.created_at::date BETWEEN p_date_from AND p_date_to
AND o.financial_status <> 'cancelled';
$function$
;

CREATE OR REPLACE FUNCTION public.operating_profit_monthly(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cm_pct      numeric;
  v_net_sales   numeric;
  v_fixed_costs numeric;
BEGIN
  v_cm_pct := public.contribution_margin_pct(p_store_id, p_date_from, p_date_to);

  IF v_cm_pct IS NULL THEN
    RETURN NULL;
  END IF;

  v_net_sales := public.net_sales(p_store_id, p_date_from, p_date_to);

  v_fixed_costs := public.monthly_overhead_total(
    p_store_id,
    p_date_from,
    p_date_to,
    'actual'
  );

  RETURN (v_net_sales * v_cm_pct) - v_fixed_costs;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.opportunity_breakdown(p_store_id uuid)
 RETURNS TABLE(id uuid, title text, description text, category text, impact_low numeric, impact_high numeric, impact_mid numeric, priority integer, confidence text, effort text, timing text, implementation_type text, recommended_action text, linked_page text, linked_page_label text, impact_type text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    o.id,
    o.title,
    o.description,
    o.category,
    o.impact_low,
    o.impact_high,
    CASE
      WHEN o.impact_low IS NOT NULL AND o.impact_high IS NOT NULL
      THEN (o.impact_low + o.impact_high) / 2
      ELSE NULL
    END AS impact_mid,
    o.priority,
    o.confidence,
    o.effort,
    o.timing,
    o.implementation_type,
    o.recommended_action,
    o.linked_page,
    o.linked_page_label,
    o.impact_type,
    o.created_at,
    o.updated_at
  FROM public.opportunities o
  WHERE o.store_id = p_store_id
    AND COALESCE(o.status, '') <> 'archived'
  ORDER BY
    o.priority ASC NULLS LAST,
    o.impact_high DESC NULLS LAST,
    o.created_at ASC;
$function$
;

CREATE OR REPLACE FUNCTION public.order_count(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COUNT(*) FROM public.orders
  WHERE store_id = p_store_id AND created_at::date BETWEEN p_date_from AND p_date_to
    AND financial_status NOT IN ('cancelled','refunded');
$function$
;

CREATE OR REPLACE FUNCTION public.recoverable_contribution_range(p_store_id uuid)
 RETURNS TABLE(recoverable_low numeric, recoverable_high numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    COALESCE(SUM(impact_low),  0) AS recoverable_low,
    COALESCE(SUM(impact_high), 0) AS recoverable_high
  FROM opportunities
  WHERE store_id = p_store_id
    AND status   <> 'archived';
$function$
;

CREATE OR REPLACE FUNCTION public.refund_rate(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(SUM(refunds) / NULLIF(SUM(gross_sales), 0), 0) FROM public.orders
  WHERE store_id = p_store_id AND created_at::date BETWEEN p_date_from AND p_date_to
    AND financial_status <> 'cancelled';
$function$
;

CREATE OR REPLACE FUNCTION public.repeat_purchase_rate(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH period_customers AS (
    SELECT o.customer_id, c.first_order_at
    FROM   public.orders o
    JOIN   public.customers c ON c.id = o.customer_id AND c.store_id = p_store_id
    WHERE  o.store_id = p_store_id AND o.created_at::date BETWEEN p_date_from AND p_date_to
      AND  o.financial_status <> 'cancelled' AND o.customer_id IS NOT NULL
    GROUP  BY o.customer_id, c.first_order_at
  )
  SELECT COALESCE(
    COUNT(*) FILTER (WHERE first_order_at < p_date_from::timestamptz)::numeric
    / NULLIF(COUNT(*)::numeric, 0), 0)
  FROM period_customers;
$function$
;

CREATE OR REPLACE FUNCTION public.return_amount(p_store_id uuid, p_date_from date, p_date_to date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(SUM(refund_ex_vat), 0)
  FROM   orders
  WHERE  store_id         = p_store_id
    AND  created_at::date BETWEEN p_date_from AND p_date_to
    AND  financial_status <> 'cancelled';
$function$
;

CREATE OR REPLACE FUNCTION public.rolling_3m_averages(p_store_id uuid, p_date_from date)
 RETURNS TABLE(months_included integer, gross_revenue_3m_avg numeric, net_sales_3m_avg numeric, aov_3m_avg numeric, cm_pct_3m_avg numeric, fixed_overhead_3m_avg numeric, operating_profit_3m_avg numeric, runway_3m_avg numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_m0         date := p_date_from;
  v_m1         date := (p_date_from - interval '1 month')::date;
  v_m2         date := (p_date_from - interval '2 months')::date;
  v_runway_avg numeric;
  v_months_inc int;
BEGIN
  -- ── Per-month runway (only for months with trading data) ──────────────────
  -- For each of T, T-1, T-2: compute (cash at month-end) / (monthly overhead).
  -- The JOIN to v_monthly_metrics applies the gross_revenue > 0 filter so
  -- the runway denominator matches the commerce metric denominator exactly.
  SELECT
    AVG(
      (SELECT COALESCE(SUM(s.cash_balance), 0)
       FROM   public.cash_balance_snapshots s
       WHERE  s.store_id     = p_store_id
         AND  s.snapshot_date = (
                SELECT MAX(s2.snapshot_date)
                FROM   public.cash_balance_snapshots s2
                WHERE  s2.store_id     = p_store_id
                  AND  s2.snapshot_date <= (m.month_start + interval '1 month')::date - 1
              )
      ) / NULLIF(
        public.monthly_overhead_total(
          p_store_id,
          m.month_start,
          (m.month_start + interval '1 month')::date - 1,
          'actual'
        ),
        0
      )
    )
  INTO v_runway_avg
  FROM (VALUES (v_m0), (v_m1), (v_m2)) AS m(month_start)
  -- Only include months that passed the gross_revenue > 0 filter
  WHERE EXISTS (
    SELECT 1
    FROM   public.v_monthly_metrics mm
    WHERE  mm.store_id     = p_store_id
      AND  mm.period_start = m.month_start
      AND  mm.gross_revenue > 0
  );

  -- ── Commerce metric averages (gross_revenue > 0 months only) ──────────────
  RETURN QUERY
  SELECT
    COUNT(*)::int                          AS months_included,
    ROUND(AVG(mm.gross_revenue),       2)  AS gross_revenue_3m_avg,
    ROUND(AVG(mm.net_sales),           2)  AS net_sales_3m_avg,
    ROUND(AVG(mm.average_order_value), 2)  AS aov_3m_avg,
    ROUND(AVG(mm.contribution_margin_pct), 6) AS cm_pct_3m_avg,
    ROUND(AVG(mm.fixed_overhead_actual), 2) AS fixed_overhead_3m_avg,
    ROUND(AVG(mm.operating_profit),    2)  AS operating_profit_3m_avg,
    v_runway_avg                           AS runway_3m_avg
  FROM public.v_monthly_metrics mm
  WHERE mm.store_id     = p_store_id
    AND mm.period_start IN (v_m0, v_m1, v_m2)
    AND mm.gross_revenue > 0;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trailing_12m_cm_avg(p_store_id uuid, p_date_from date)
 RETURNS TABLE(cm_pct_12m_avg numeric, months_included integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_total      numeric := 0;
  v_count      integer := 0;
  v_cm         numeric;
  v_rev        numeric;
  v_month_from date;
  v_month_to   date;
  i            integer;
BEGIN
  -- Iterate T-1 through T-12 (the 12 calendar months before the anchor).
  -- gross_revenue() and contribution_margin_pct() both accept inclusive date
  -- ranges and use COALESCE(..., 0), so they never raise when a month is empty.
  FOR i IN 1..12 LOOP
    -- First day of month T-i
    v_month_from := (date_trunc('month', p_date_from::timestamp)
                     - (i || ' month')::interval)::date;
    -- Last day of month T-i (day 0 of T-i+1 = last day of T-i)
    v_month_to   := (v_month_from + interval '1 month' - interval '1 day')::date;

    -- Skip months with no order data to avoid dragging the average toward 0.
    v_rev := public.gross_revenue(p_store_id, v_month_from, v_month_to);
    CONTINUE WHEN v_rev = 0;

    -- contribution_margin_pct() returns NULL when store has no cost assumptions.
    -- NULL months are excluded from the running total.
    v_cm := public.contribution_margin_pct(p_store_id, v_month_from, v_month_to);
    CONTINUE WHEN v_cm IS NULL;

    v_total := v_total + v_cm;
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    -- No months with live data found — caller should show "—" or fall back.
    RETURN QUERY SELECT NULL::numeric, 0;
  ELSE
    RETURN QUERY SELECT ROUND(v_total / v_count, 4), v_count;
  END IF;
END;
$function$
;

CREATE VIEW public."v_current_cash_balance" WITH (security_invoker=true) AS  SELECT store_id,
    snapshot_date,
    sum(cash_balance) AS total_cash_balance
   FROM cash_balance_snapshots
  WHERE snapshot_date = (( SELECT max(s2.snapshot_date) AS max
           FROM cash_balance_snapshots s2
          WHERE s2.store_id = cash_balance_snapshots.store_id))
  GROUP BY store_id, snapshot_date;

CREATE VIEW public."v_current_cost_assumptions" WITH (security_invoker=true) AS  SELECT DISTINCT ON (store_id) id,
    store_id,
    payment_fee_rate,
    fulfilment_cost_per_order,
    packaging_cost_per_order,
    return_handling_rate,
    effective_from,
    created_at,
    vat_rate
   FROM store_cost_assumptions
  WHERE effective_from <= CURRENT_DATE
  ORDER BY store_id, effective_from DESC;

CREATE VIEW public."v_monthly_metrics" WITH (security_invoker=true) AS  WITH months AS (
         SELECT generate_series('2026-01-01'::date::timestamp with time zone, '2026-06-01'::date::timestamp with time zone, '1 mon'::interval)::date AS month_start
        ), stores_list AS (
         SELECT stores.id AS store_id
           FROM stores
        )
 SELECT s.store_id,
    m.month_start AS period_start,
    (m.month_start + '1 mon'::interval)::date - 1 AS period_end,
    gross_revenue(s.store_id, m.month_start, (m.month_start + '1 mon'::interval)::date - 1) AS gross_revenue,
    net_sales(s.store_id, m.month_start, (m.month_start + '1 mon'::interval)::date - 1) AS net_sales,
    average_order_value(s.store_id, m.month_start, (m.month_start + '1 mon'::interval)::date - 1) AS average_order_value,
    refund_rate(s.store_id, m.month_start, (m.month_start + '1 mon'::interval)::date - 1) AS refund_rate,
    discount_dependency(s.store_id, m.month_start, (m.month_start + '1 mon'::interval)::date - 1) AS discount_dependency,
    repeat_purchase_rate(s.store_id, m.month_start, (m.month_start + '1 mon'::interval)::date - 1) AS repeat_purchase_rate,
    contribution_margin_pct(s.store_id, m.month_start, (m.month_start + '1 mon'::interval)::date - 1) AS contribution_margin_pct,
    operating_profit_monthly(s.store_id, m.month_start, (m.month_start + '1 mon'::interval)::date - 1) AS operating_profit,
    monthly_overhead_total(s.store_id, m.month_start, (m.month_start + '1 mon'::interval)::date - 1, 'actual'::text) AS fixed_overhead_actual
   FROM months m
     CROSS JOIN stores_list s;

CREATE VIEW public."v_monthly_overhead_summary" WITH (security_invoker=true) AS  SELECT oe.store_id,
    oc.category_type,
    oc.name AS category_name,
    oe.period_start,
    oe.period_end,
    oe.entry_type,
    oe.is_recurring,
    sum(oe.amount) AS total_amount,
    count(*) AS entry_count
   FROM overhead_entries oe
     JOIN overhead_categories oc ON oc.id = oe.category_id AND oc.is_active = true
  GROUP BY oe.store_id, oc.category_type, oc.name, oe.period_start, oe.period_end, oe.entry_type, oe.is_recurring;

CREATE VIEW public."v_month_on_month" WITH (security_invoker=true) AS  SELECT cur.store_id,
    cur.period_start,
    cur.period_end,
    cur.gross_revenue AS gross_revenue_cur,
    cur.net_sales AS net_sales_cur,
    cur.average_order_value AS aov_cur,
    cur.refund_rate AS refund_rate_cur,
    cur.discount_dependency AS discount_dep_cur,
    cur.repeat_purchase_rate AS rpr_cur,
    cur.contribution_margin_pct AS cm_pct_cur,
    cur.operating_profit AS op_profit_cur,
    cur.fixed_overhead_actual AS overhead_cur,
    prv.gross_revenue AS gross_revenue_prv,
    prv.net_sales AS net_sales_prv,
    prv.average_order_value AS aov_prv,
    prv.refund_rate AS refund_rate_prv,
    prv.discount_dependency AS discount_dep_prv,
    prv.repeat_purchase_rate AS rpr_prv,
    prv.contribution_margin_pct AS cm_pct_prv,
    prv.operating_profit AS op_profit_prv,
    prv.fixed_overhead_actual AS overhead_prv,
    round((cur.gross_revenue - prv.gross_revenue) / NULLIF(abs(prv.gross_revenue), 0::numeric) * 100::numeric, 1) AS gross_revenue_delta_pct,
    round((cur.net_sales - prv.net_sales) / NULLIF(abs(prv.net_sales), 0::numeric) * 100::numeric, 1) AS net_sales_delta_pct,
    round((cur.average_order_value - prv.average_order_value) / NULLIF(abs(prv.average_order_value), 0::numeric) * 100::numeric, 1) AS aov_delta_pct,
    round((cur.operating_profit - prv.operating_profit) / NULLIF(abs(prv.operating_profit), 0::numeric) * 100::numeric, 1) AS op_profit_delta_pct,
    round((cur.fixed_overhead_actual - prv.fixed_overhead_actual) / NULLIF(abs(prv.fixed_overhead_actual), 0::numeric) * 100::numeric, 1) AS overhead_delta_pct,
    round((cur.refund_rate - prv.refund_rate) * 100::numeric, 2) AS refund_rate_delta_pp,
    round((cur.discount_dependency - prv.discount_dependency) * 100::numeric, 2) AS discount_dep_delta_pp,
    round((cur.repeat_purchase_rate - prv.repeat_purchase_rate) * 100::numeric, 1) AS rpr_delta_pp,
    round((cur.contribution_margin_pct - prv.contribution_margin_pct) * 100::numeric, 2) AS cm_pct_delta_pp
   FROM v_monthly_metrics cur
     LEFT JOIN v_monthly_metrics prv ON prv.store_id = cur.store_id AND prv.period_start = (cur.period_start - '1 mon'::interval)::date;

ALTER TABLE public."cac_trend_snapshots" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."cash_balance_snapshots" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."cfo_alerts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."channel_opportunity_scores" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."customers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."discount_codes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."discounts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."marketing_blended_monthly" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."marketing_channel_daily_metrics" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."marketing_channel_monthly_snapshots" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."opportunities" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."order_line_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."orders" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."overhead_categories" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."overhead_entries" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."product_variants" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."products" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."refund_line_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."refunds" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."store_cost_assumptions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."store_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."stores" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."cac_trend_snapshots" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."cash_balance_snapshots" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."cfo_alerts" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."channel_opportunity_scores" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."customers" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."discount_codes" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."discounts" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."marketing_blended_monthly" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."marketing_channel_daily_metrics" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."marketing_channel_monthly_snapshots" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."opportunities" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."order_line_items" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."orders" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."overhead_categories" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."overhead_entries" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."product_variants" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."products" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."refund_line_items" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."refunds" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."store_cost_assumptions" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."store_settings" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."stores" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."v_current_cash_balance" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."v_current_cost_assumptions" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."v_month_on_month" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."v_monthly_metrics" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON TABLE public."v_monthly_overhead_summary" FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."average_order_value"(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."blended_marketing_performance"(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."cac_trend_by_channel"(p_store_id uuid, p_up_to_date date, p_months_back integer) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."cash_runway_months"(p_store_id uuid) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."cfo_alerts"(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."channel_metrics_monthly"(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."channel_opportunities_active"(p_store_id uuid) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."contribution_margin_pct"(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."discount_cost"(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."discount_dependency"(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."get_marketing_spend_rate"(p_store_id uuid, p_date_from date) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."gross_revenue"(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."month_on_month_delta"(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."monthly_overhead_total"(p_store_id uuid, p_date_from date, p_date_to date, p_entry_type text) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."net_sales"(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."operating_profit_monthly"(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."opportunity_breakdown"(p_store_id uuid) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."order_count"(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."recoverable_contribution_range"(p_store_id uuid) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."refund_rate"(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."repeat_purchase_rate"(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."return_amount"(p_store_id uuid, p_date_from date, p_date_to date) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."rolling_3m_averages"(p_store_id uuid, p_date_from date) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public."trailing_12m_cm_avg"(p_store_id uuid, p_date_from date) FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public."average_order_value"(p_store_id uuid, p_date_from date, p_date_to date) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."average_order_value"(p_store_id uuid, p_date_from date, p_date_to date) TO "anon";

GRANT EXECUTE ON FUNCTION public."average_order_value"(p_store_id uuid, p_date_from date, p_date_to date) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."average_order_value"(p_store_id uuid, p_date_from date, p_date_to date) TO "service_role";

GRANT EXECUTE ON FUNCTION public."blended_marketing_performance"(p_store_id uuid, p_date_from date, p_date_to date) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."blended_marketing_performance"(p_store_id uuid, p_date_from date, p_date_to date) TO "anon";

GRANT EXECUTE ON FUNCTION public."blended_marketing_performance"(p_store_id uuid, p_date_from date, p_date_to date) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."blended_marketing_performance"(p_store_id uuid, p_date_from date, p_date_to date) TO "service_role";

GRANT EXECUTE ON FUNCTION public."cac_trend_by_channel"(p_store_id uuid, p_up_to_date date, p_months_back integer) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."cac_trend_by_channel"(p_store_id uuid, p_up_to_date date, p_months_back integer) TO "anon";

GRANT EXECUTE ON FUNCTION public."cac_trend_by_channel"(p_store_id uuid, p_up_to_date date, p_months_back integer) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."cac_trend_by_channel"(p_store_id uuid, p_up_to_date date, p_months_back integer) TO "service_role";

GRANT EXECUTE ON FUNCTION public."cash_runway_months"(p_store_id uuid) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."cash_runway_months"(p_store_id uuid) TO "anon";

GRANT EXECUTE ON FUNCTION public."cash_runway_months"(p_store_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."cash_runway_months"(p_store_id uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION public."cfo_alerts"(p_store_id uuid, p_date_from date, p_date_to date) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."cfo_alerts"(p_store_id uuid, p_date_from date, p_date_to date) TO "anon";

GRANT EXECUTE ON FUNCTION public."cfo_alerts"(p_store_id uuid, p_date_from date, p_date_to date) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."cfo_alerts"(p_store_id uuid, p_date_from date, p_date_to date) TO "service_role";

GRANT EXECUTE ON FUNCTION public."channel_metrics_monthly"(p_store_id uuid, p_date_from date, p_date_to date) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."channel_metrics_monthly"(p_store_id uuid, p_date_from date, p_date_to date) TO "anon";

GRANT EXECUTE ON FUNCTION public."channel_metrics_monthly"(p_store_id uuid, p_date_from date, p_date_to date) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."channel_metrics_monthly"(p_store_id uuid, p_date_from date, p_date_to date) TO "service_role";

GRANT EXECUTE ON FUNCTION public."channel_opportunities_active"(p_store_id uuid) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."channel_opportunities_active"(p_store_id uuid) TO "anon";

GRANT EXECUTE ON FUNCTION public."channel_opportunities_active"(p_store_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."channel_opportunities_active"(p_store_id uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION public."contribution_margin_pct"(p_store_id uuid, p_date_from date, p_date_to date) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."contribution_margin_pct"(p_store_id uuid, p_date_from date, p_date_to date) TO "anon";

GRANT EXECUTE ON FUNCTION public."contribution_margin_pct"(p_store_id uuid, p_date_from date, p_date_to date) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."contribution_margin_pct"(p_store_id uuid, p_date_from date, p_date_to date) TO "service_role";

GRANT EXECUTE ON FUNCTION public."discount_cost"(p_store_id uuid, p_date_from date, p_date_to date) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."discount_cost"(p_store_id uuid, p_date_from date, p_date_to date) TO "anon";

GRANT EXECUTE ON FUNCTION public."discount_cost"(p_store_id uuid, p_date_from date, p_date_to date) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."discount_cost"(p_store_id uuid, p_date_from date, p_date_to date) TO "service_role";

GRANT EXECUTE ON FUNCTION public."discount_dependency"(p_store_id uuid, p_date_from date, p_date_to date) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."discount_dependency"(p_store_id uuid, p_date_from date, p_date_to date) TO "anon";

GRANT EXECUTE ON FUNCTION public."discount_dependency"(p_store_id uuid, p_date_from date, p_date_to date) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."discount_dependency"(p_store_id uuid, p_date_from date, p_date_to date) TO "service_role";

GRANT EXECUTE ON FUNCTION public."get_marketing_spend_rate"(p_store_id uuid, p_date_from date) TO "anon";

GRANT EXECUTE ON FUNCTION public."get_marketing_spend_rate"(p_store_id uuid, p_date_from date) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."get_marketing_spend_rate"(p_store_id uuid, p_date_from date) TO "service_role";

GRANT EXECUTE ON FUNCTION public."gross_revenue"(p_store_id uuid, p_date_from date, p_date_to date) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."gross_revenue"(p_store_id uuid, p_date_from date, p_date_to date) TO "anon";

GRANT EXECUTE ON FUNCTION public."gross_revenue"(p_store_id uuid, p_date_from date, p_date_to date) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."gross_revenue"(p_store_id uuid, p_date_from date, p_date_to date) TO "service_role";

GRANT EXECUTE ON FUNCTION public."month_on_month_delta"(p_store_id uuid, p_date_from date, p_date_to date) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."month_on_month_delta"(p_store_id uuid, p_date_from date, p_date_to date) TO "anon";

GRANT EXECUTE ON FUNCTION public."month_on_month_delta"(p_store_id uuid, p_date_from date, p_date_to date) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."month_on_month_delta"(p_store_id uuid, p_date_from date, p_date_to date) TO "service_role";

GRANT EXECUTE ON FUNCTION public."monthly_overhead_total"(p_store_id uuid, p_date_from date, p_date_to date, p_entry_type text) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."monthly_overhead_total"(p_store_id uuid, p_date_from date, p_date_to date, p_entry_type text) TO "anon";

GRANT EXECUTE ON FUNCTION public."monthly_overhead_total"(p_store_id uuid, p_date_from date, p_date_to date, p_entry_type text) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."monthly_overhead_total"(p_store_id uuid, p_date_from date, p_date_to date, p_entry_type text) TO "service_role";

GRANT EXECUTE ON FUNCTION public."net_sales"(p_store_id uuid, p_date_from date, p_date_to date) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."net_sales"(p_store_id uuid, p_date_from date, p_date_to date) TO "anon";

GRANT EXECUTE ON FUNCTION public."net_sales"(p_store_id uuid, p_date_from date, p_date_to date) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."net_sales"(p_store_id uuid, p_date_from date, p_date_to date) TO "service_role";

GRANT EXECUTE ON FUNCTION public."operating_profit_monthly"(p_store_id uuid, p_date_from date, p_date_to date) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."operating_profit_monthly"(p_store_id uuid, p_date_from date, p_date_to date) TO "anon";

GRANT EXECUTE ON FUNCTION public."operating_profit_monthly"(p_store_id uuid, p_date_from date, p_date_to date) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."operating_profit_monthly"(p_store_id uuid, p_date_from date, p_date_to date) TO "service_role";

GRANT EXECUTE ON FUNCTION public."opportunity_breakdown"(p_store_id uuid) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."opportunity_breakdown"(p_store_id uuid) TO "anon";

GRANT EXECUTE ON FUNCTION public."opportunity_breakdown"(p_store_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."opportunity_breakdown"(p_store_id uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION public."order_count"(p_store_id uuid, p_date_from date, p_date_to date) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."order_count"(p_store_id uuid, p_date_from date, p_date_to date) TO "anon";

GRANT EXECUTE ON FUNCTION public."order_count"(p_store_id uuid, p_date_from date, p_date_to date) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."order_count"(p_store_id uuid, p_date_from date, p_date_to date) TO "service_role";

GRANT EXECUTE ON FUNCTION public."recoverable_contribution_range"(p_store_id uuid) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."recoverable_contribution_range"(p_store_id uuid) TO "anon";

GRANT EXECUTE ON FUNCTION public."recoverable_contribution_range"(p_store_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."recoverable_contribution_range"(p_store_id uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION public."refund_rate"(p_store_id uuid, p_date_from date, p_date_to date) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."refund_rate"(p_store_id uuid, p_date_from date, p_date_to date) TO "anon";

GRANT EXECUTE ON FUNCTION public."refund_rate"(p_store_id uuid, p_date_from date, p_date_to date) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."refund_rate"(p_store_id uuid, p_date_from date, p_date_to date) TO "service_role";

GRANT EXECUTE ON FUNCTION public."repeat_purchase_rate"(p_store_id uuid, p_date_from date, p_date_to date) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."repeat_purchase_rate"(p_store_id uuid, p_date_from date, p_date_to date) TO "anon";

GRANT EXECUTE ON FUNCTION public."repeat_purchase_rate"(p_store_id uuid, p_date_from date, p_date_to date) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."repeat_purchase_rate"(p_store_id uuid, p_date_from date, p_date_to date) TO "service_role";

GRANT EXECUTE ON FUNCTION public."return_amount"(p_store_id uuid, p_date_from date, p_date_to date) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."return_amount"(p_store_id uuid, p_date_from date, p_date_to date) TO "anon";

GRANT EXECUTE ON FUNCTION public."return_amount"(p_store_id uuid, p_date_from date, p_date_to date) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."return_amount"(p_store_id uuid, p_date_from date, p_date_to date) TO "service_role";

GRANT EXECUTE ON FUNCTION public."rolling_3m_averages"(p_store_id uuid, p_date_from date) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."rolling_3m_averages"(p_store_id uuid, p_date_from date) TO "anon";

GRANT EXECUTE ON FUNCTION public."rolling_3m_averages"(p_store_id uuid, p_date_from date) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."rolling_3m_averages"(p_store_id uuid, p_date_from date) TO "service_role";

GRANT EXECUTE ON FUNCTION public."trailing_12m_cm_avg"(p_store_id uuid, p_date_from date) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public."trailing_12m_cm_avg"(p_store_id uuid, p_date_from date) TO "anon";

GRANT EXECUTE ON FUNCTION public."trailing_12m_cm_avg"(p_store_id uuid, p_date_from date) TO "authenticated";

GRANT EXECUTE ON FUNCTION public."trailing_12m_cm_avg"(p_store_id uuid, p_date_from date) TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."cac_trend_snapshots" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."cac_trend_snapshots" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."cac_trend_snapshots" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."cash_balance_snapshots" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."cash_balance_snapshots" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."cash_balance_snapshots" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."cfo_alerts" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."cfo_alerts" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."cfo_alerts" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."channel_opportunity_scores" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."channel_opportunity_scores" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."channel_opportunity_scores" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."customers" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."customers" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."customers" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."discount_codes" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."discount_codes" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."discount_codes" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."discounts" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."discounts" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."discounts" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."marketing_blended_monthly" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."marketing_blended_monthly" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."marketing_blended_monthly" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."marketing_channel_daily_metrics" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."marketing_channel_daily_metrics" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."marketing_channel_daily_metrics" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."marketing_channel_monthly_snapshots" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."marketing_channel_monthly_snapshots" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."marketing_channel_monthly_snapshots" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."opportunities" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."opportunities" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."opportunities" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."order_line_items" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."order_line_items" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."order_line_items" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."orders" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."orders" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."orders" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."overhead_categories" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."overhead_categories" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."overhead_categories" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."overhead_entries" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."overhead_entries" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."overhead_entries" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."product_variants" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."product_variants" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."product_variants" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."products" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."products" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."products" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."refund_line_items" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."refund_line_items" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."refund_line_items" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."refunds" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."refunds" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."refunds" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."store_cost_assumptions" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."store_cost_assumptions" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."store_cost_assumptions" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."store_settings" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."store_settings" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."store_settings" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."stores" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."stores" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."stores" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."v_current_cash_balance" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."v_current_cash_balance" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."v_current_cash_balance" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."v_current_cost_assumptions" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."v_current_cost_assumptions" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."v_current_cost_assumptions" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."v_month_on_month" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."v_month_on_month" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."v_month_on_month" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."v_monthly_metrics" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."v_monthly_metrics" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."v_monthly_metrics" TO "service_role";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."v_monthly_overhead_summary" TO "anon";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."v_monthly_overhead_summary" TO "authenticated";

GRANT DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON TABLE public."v_monthly_overhead_summary" TO "service_role";

SET check_function_bodies = true;

-- Proposed correction only; not registered with a migration runner or applied live.
-- Separate monthly contribution from cash/other impacts without replaying seed data.
-- Preserve the observed signature, volatility, security mode and search path.
-- Existing SECURITY DEFINER access still requires the separate authorisation review.
DO $precondition$
BEGIN
  IF to_regprocedure('public.recoverable_contribution_range(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Expected existing recoverable_contribution_range(uuid); reconcile baseline first';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.recoverable_contribution_range(uuid)'::regprocedure) THEN
    RAISE EXCEPTION 'Security mode changed; do not overwrite subsequent store-access hardening';
  END IF;
END;
$precondition$;

CREATE OR REPLACE FUNCTION public.recoverable_contribution_range(p_store_id uuid)
 RETURNS TABLE(recoverable_low numeric, recoverable_high numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    COALESCE(SUM(impact_low),  0) AS recoverable_low,
    COALESCE(SUM(impact_high), 0) AS recoverable_high
  FROM public.opportunities
  WHERE store_id = p_store_id
    AND status <> 'archived'
    AND impact_type = 'monthly_contribution';
$function$;


-- LOCAL PROPOSAL: Supabase Auth membership-based READ access, not applied live.
-- Apply only after the monthly-contribution correction and baseline review.
-- No membership backfill or application sign-in flow is included.
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


-- An authenticated client must not create objects in the public search path.
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
COMMIT;
