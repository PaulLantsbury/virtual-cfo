-- =============================================================================
-- Virtual CFO — Cloud Schema Remediation
-- Migration: 20260429000002
-- Ref audit: docs/cloud-schema-audit-v1.md
--
-- Brings the cloud Supabase schema into alignment with Phase 1 migrations
-- 20260429000000 (tables) and 20260429000001 (metric functions) before any
-- Shopify data ingestion.
--
-- SAFE TO APPLY: all existing rows retained; NULLs back-filled from the single
-- existing store row before NOT NULL constraints are added.
--
-- APPLIES IN ORDER:
--   P0  — RLS / SECURITY DEFINER   (unblocks metric data from RPC)
--   P0  — orders.store_id NOT NULL  (after NULL back-fill)
--   P1  — 5 missing tables
--   P1  — Rename variants → product_variants
--   P1  — Fix multi-tenant unique constraints (add store_id)
--   P1  — Shopify ID column types: STAY TEXT (documented)
--   P2  — Composite query-path indexes
--   P2  — FK delete rule alignment
--   P2  — Revenue columns NOT NULL DEFAULT 0
-- =============================================================================

-- ── Helpers ───────────────────────────────────────────────────────────────────
SET search_path TO public, pg_temp;


-- =============================================================================
-- P0.1  Convert all 9 metric functions to SECURITY DEFINER
-- =============================================================================
-- Rationale: functions are called by the anon key via Supabase RPC.
-- As SECURITY INVOKER they run as 'anon' which has no RLS policy on
-- customers, order_line_items, or refunds → those tables return 0 rows.
-- SECURITY DEFINER + locked search_path = functions run as the defining role
-- (postgres) and read all tenant data irrespective of caller permissions.
-- search_path is locked to public, pg_temp to prevent search-path injection.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.gross_revenue(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(gross_sales), 0)
  FROM   public.orders
  WHERE  store_id         = p_store_id
    AND  created_at::date BETWEEN p_date_from AND p_date_to
    AND  financial_status <> 'cancelled';
$$;

COMMENT ON FUNCTION public.gross_revenue(uuid, date, date) IS
  'Gross revenue: SUM(gross_sales) excluding cancelled orders. SECURITY DEFINER.';

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.discount_cost(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(discounts), 0)
  FROM   public.orders
  WHERE  store_id         = p_store_id
    AND  created_at::date BETWEEN p_date_from AND p_date_to
    AND  financial_status <> 'cancelled';
$$;

COMMENT ON FUNCTION public.discount_cost(uuid, date, date) IS
  'Total discount value for non-cancelled orders. SECURITY DEFINER.';

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.return_amount(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(refunds), 0)
  FROM   public.orders
  WHERE  store_id         = p_store_id
    AND  created_at::date BETWEEN p_date_from AND p_date_to
    AND  financial_status <> 'cancelled';
$$;

COMMENT ON FUNCTION public.return_amount(uuid, date, date) IS
  'Total refund value attributed to original order date. SECURITY DEFINER.';

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.net_sales(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(gross_sales - discounts - refunds - tax), 0)
  FROM   public.orders
  WHERE  store_id         = p_store_id
    AND  created_at::date BETWEEN p_date_from AND p_date_to
    AND  financial_status <> 'cancelled';
$$;

COMMENT ON FUNCTION public.net_sales(uuid, date, date) IS
  'Net Sales = gross_sales - discounts - refunds - tax. SECURITY DEFINER.';

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.order_count(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)
  FROM   public.orders
  WHERE  store_id         = p_store_id
    AND  created_at::date BETWEEN p_date_from AND p_date_to
    AND  financial_status NOT IN ('cancelled', 'refunded');
$$;

COMMENT ON FUNCTION public.order_count(uuid, date, date) IS
  'Qualifying order count: excludes cancelled and fully refunded. SECURITY DEFINER.';

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.average_order_value(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    SUM(gross_sales - discounts - refunds - tax)
    / NULLIF(COUNT(*) FILTER (WHERE financial_status <> 'refunded'), 0),
    0
  )
  FROM   public.orders
  WHERE  store_id         = p_store_id
    AND  created_at::date BETWEEN p_date_from AND p_date_to
    AND  financial_status <> 'cancelled';
$$;

COMMENT ON FUNCTION public.average_order_value(uuid, date, date) IS
  'AOV = net_sales / qualifying order count. SECURITY DEFINER.';

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.repeat_purchase_rate(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH period_customers AS (
    SELECT o.customer_id, c.first_order_at
    FROM   public.orders     o
    JOIN   public.customers  c
           ON  c.id       = o.customer_id
           AND c.store_id = p_store_id
    WHERE  o.store_id         = p_store_id
      AND  o.created_at::date BETWEEN p_date_from AND p_date_to
      AND  o.financial_status <> 'cancelled'
      AND  o.customer_id IS NOT NULL
    GROUP  BY o.customer_id, c.first_order_at
  )
  SELECT COALESCE(
    COUNT(*) FILTER (WHERE first_order_at < p_date_from::timestamptz)::numeric
    / NULLIF(COUNT(*)::numeric, 0),
    0
  )
  FROM period_customers;
$$;

COMMENT ON FUNCTION public.repeat_purchase_rate(uuid, date, date) IS
  'Repeat purchase rate (returning / all customers in period). SECURITY DEFINER.';

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.discount_dependency(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    SUM(discounts) / NULLIF(SUM(gross_sales), 0),
    0
  )
  FROM   public.orders
  WHERE  store_id         = p_store_id
    AND  created_at::date BETWEEN p_date_from AND p_date_to
    AND  financial_status <> 'cancelled';
$$;

COMMENT ON FUNCTION public.discount_dependency(uuid, date, date) IS
  'Discount dependency ratio = SUM(discounts)/SUM(gross_sales). SECURITY DEFINER.';

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.refund_rate(
  p_store_id  uuid,
  p_date_from date,
  p_date_to   date
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    SUM(refunds) / NULLIF(SUM(gross_sales), 0),
    0
  )
  FROM   public.orders
  WHERE  store_id         = p_store_id
    AND  created_at::date BETWEEN p_date_from AND p_date_to
    AND  financial_status <> 'cancelled';
$$;

COMMENT ON FUNCTION public.refund_rate(uuid, date, date) IS
  'Refund rate = SUM(refunds)/SUM(gross_sales). SECURITY DEFINER.';


-- =============================================================================
-- P0.2  Back-fill NULL store_id on existing rows, then enforce NOT NULL
-- =============================================================================
-- Audit result: 2 orders, 2 customers, 2 products all have store_id IS NULL.
-- Only one store exists in the database. Safe to assign all orphans to it.
-- =============================================================================

-- Back-fill orders.store_id
UPDATE public.orders
SET    store_id = '10000000-0000-0000-0000-000000000001'
WHERE  store_id IS NULL;

-- Back-fill customers.store_id
UPDATE public.customers
SET    store_id = '10000000-0000-0000-0000-000000000001'
WHERE  store_id IS NULL;

-- Back-fill products.store_id
UPDATE public.products
SET    store_id = '10000000-0000-0000-0000-000000000001'
WHERE  store_id IS NULL;

-- Enforce NOT NULL
ALTER TABLE public.orders    ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.customers ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.products  ALTER COLUMN store_id SET NOT NULL;


-- =============================================================================
-- P0.2 (cont.)  Revenue columns: enforce NOT NULL DEFAULT 0
-- =============================================================================
-- Audit result: 0 NULL rows in gross_sales/discounts/refunds/tax/total_sales.
-- Safe to add constraint.
-- =============================================================================

ALTER TABLE public.orders
  ALTER COLUMN gross_sales  SET NOT NULL,
  ALTER COLUMN gross_sales  SET DEFAULT 0,
  ALTER COLUMN discounts    SET NOT NULL,
  ALTER COLUMN discounts    SET DEFAULT 0,
  ALTER COLUMN refunds      SET NOT NULL,
  ALTER COLUMN refunds      SET DEFAULT 0,
  ALTER COLUMN tax          SET NOT NULL,
  ALTER COLUMN tax          SET DEFAULT 0,
  ALTER COLUMN total_sales  SET NOT NULL,
  ALTER COLUMN total_sales  SET DEFAULT 0;


-- =============================================================================
-- P1.3  Create 5 missing tables
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- refund_line_items
-- Created after order_line_items (FK dependency).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.refund_line_items (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  refund_id           uuid        NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
  order_line_item_id  uuid        NOT NULL REFERENCES public.order_line_items(id) ON DELETE CASCADE,
  quantity            int         NOT NULL,
  subtotal            numeric(12,2) NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refund_line_items_refund
  ON public.refund_line_items (store_id, refund_id);

COMMENT ON TABLE public.refund_line_items IS
  'Line-item detail within a refund. Prevents double-counting for partially-refunded orders.';

-- ─────────────────────────────────────────────────────────────────────────────
-- discounts
-- One row per Shopify price rule (parent of discount codes).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.discounts (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  shopify_price_rule_id text        NOT NULL,   -- GID format: gid://shopify/PriceRule/…
  title                 text,
  value_type            text,                   -- 'percentage' | 'fixed_amount'
  value                 numeric(10,4),
  -- category: merchant-supplied at onboarding. NULL = uncategorised.
  -- Does NOT affect headline discount_dependency_ratio (value-based).
  category              text,
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_discounts_store_shopify UNIQUE (store_id, shopify_price_rule_id)
);

COMMENT ON TABLE public.discounts IS
  'One row per Shopify price rule. category is merchant-supplied and may be NULL.';

-- ─────────────────────────────────────────────────────────────────────────────
-- discount_codes
-- One row per Shopify discount code (child of a price rule / discounts row).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  discount_id           uuid        NOT NULL REFERENCES public.discounts(id) ON DELETE CASCADE,
  code                  text        NOT NULL,   -- lowercase-normalised at ingest
  usage_count           int         NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_discount_codes_store_code UNIQUE (store_id, code)
);

CREATE INDEX IF NOT EXISTS idx_discount_codes_store_discount
  ON public.discount_codes (store_id, discount_id);

COMMENT ON TABLE public.discount_codes IS
  'One row per Shopify discount code. code is lowercase-normalised.';

-- ─────────────────────────────────────────────────────────────────────────────
-- opportunities
-- CFO-identified improvement opportunities for the store.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.opportunities (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  category        text        NOT NULL,   -- 'margin' | 'retention' | 'pricing' | etc.
  title           text        NOT NULL,
  description     text,
  impact_low      numeric(14,2),          -- lower bound monthly £ impact
  impact_high     numeric(14,2),          -- upper bound monthly £ impact
  priority        int         NOT NULL DEFAULT 0,
  status          text        NOT NULL DEFAULT 'open',   -- 'open' | 'actioned' | 'dismissed'
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_store_status
  ON public.opportunities (store_id, status);

COMMENT ON TABLE public.opportunities IS
  'CFO-identified improvement opportunities. Feeds the recovery roadmap section.';

-- ─────────────────────────────────────────────────────────────────────────────
-- cfo_alerts
-- Persisted alert events shown in the CFO Alerts sidebar.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cfo_alerts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  alert_type      text        NOT NULL,   -- 'margin_drop' | 'refund_spike' | etc.
  severity        text        NOT NULL DEFAULT 'warning',  -- 'info' | 'warning' | 'critical'
  title           text        NOT NULL,
  body            text,
  is_read         boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cfo_alerts_store_read
  ON public.cfo_alerts (store_id, is_read, created_at DESC);

COMMENT ON TABLE public.cfo_alerts IS
  'Persisted alert events for the CFO Alerts sidebar. One row per alert event.';


-- =============================================================================
-- P1.4  Rename variants → product_variants
-- =============================================================================
-- Audit result: table is named 'variants' in cloud, 'product_variants' in migration.
-- PostgreSQL preserves FK OIDs across RENAME, so order_line_items.variant_id FK
-- continues to work after the rename. No data loss.
-- =============================================================================

ALTER TABLE public.variants RENAME TO product_variants;

-- Rename the primary key index to match new convention
ALTER INDEX IF EXISTS variants_pkey                    RENAME TO product_variants_pkey;
ALTER INDEX IF EXISTS variants_shopify_variant_id_key  RENAME TO uq_product_variants_shopify_variant_id_old;

-- Add missing store_id column to product_variants (it has no store_id yet)
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;

-- Back-fill store_id on the single existing variant row
UPDATE public.product_variants
SET    store_id = '10000000-0000-0000-0000-000000000001'
WHERE  store_id IS NULL;

ALTER TABLE public.product_variants
  ALTER COLUMN store_id SET NOT NULL;

-- Add missing columns to product_variants
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS compare_at_price   numeric(12,2),
  ADD COLUMN IF NOT EXISTS cost               numeric(12,2),
  ADD COLUMN IF NOT EXISTS inventory_quantity int NOT NULL DEFAULT 0;

-- Add generated column cost_populated (only if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'product_variants'
      AND column_name  = 'cost_populated'
  ) THEN
    ALTER TABLE public.product_variants
      ADD COLUMN cost_populated boolean GENERATED ALWAYS AS (cost IS NOT NULL) STORED;
  END IF;
END $$;


-- =============================================================================
-- P1.5  Fix multi-tenant unique constraints (add store_id)
-- =============================================================================
-- The existing single-column uniques allow cross-store ID collisions.
-- Replace each with a (store_id, shopify_*_id) composite unique.
-- NOTE: shopify IDs are GID strings (gid://shopify/…), kept as text (see P1.6).
-- =============================================================================

-- customers
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_shopify_customer_id_key;
ALTER TABLE public.customers
  ADD CONSTRAINT uq_customers_store_shopify
    UNIQUE (store_id, shopify_customer_id);

-- products
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_shopify_product_id_key;
ALTER TABLE public.products
  ADD CONSTRAINT uq_products_store_shopify
    UNIQUE (store_id, shopify_product_id);

-- product_variants (was variants)
ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS uq_product_variants_shopify_variant_id_old,
  DROP CONSTRAINT IF EXISTS variants_shopify_variant_id_key;
ALTER TABLE public.product_variants
  ADD CONSTRAINT uq_product_variants_store_shopify
    UNIQUE (store_id, shopify_variant_id);

-- orders
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_shopify_order_id_key;
ALTER TABLE public.orders
  ADD CONSTRAINT uq_orders_store_shopify
    UNIQUE (store_id, shopify_order_id);

-- order_line_items
ALTER TABLE public.order_line_items
  DROP CONSTRAINT IF EXISTS order_line_items_shopify_line_item_id_key;
ALTER TABLE public.order_line_items
  ADD CONSTRAINT uq_order_line_items_store_shopify
    UNIQUE (store_id, shopify_line_item_id);

-- refunds
ALTER TABLE public.refunds
  DROP CONSTRAINT IF EXISTS refunds_shopify_refund_id_key;
ALTER TABLE public.refunds
  ADD CONSTRAINT uq_refunds_store_shopify
    UNIQUE (store_id, shopify_refund_id);

-- add store_id to order_line_items and refunds (currently missing)
ALTER TABLE public.order_line_items
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;

ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;

-- Back-fill store_id for existing rows
UPDATE public.order_line_items
SET    store_id = '10000000-0000-0000-0000-000000000001'
WHERE  store_id IS NULL;

UPDATE public.refunds
SET    store_id = '10000000-0000-0000-0000-000000000001'
WHERE  store_id IS NULL;

-- Enforce NOT NULL now that rows are back-filled (refunds is empty so safe)
ALTER TABLE public.order_line_items ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.refunds          ALTER COLUMN store_id SET NOT NULL;


-- =============================================================================
-- P1.6  Shopify ID column types — REMAIN AS TEXT
-- =============================================================================
-- Audit result: all Shopify ID columns contain GraphQL Global ID (GID) strings:
--   gid://shopify/Order/4001, gid://shopify/Customer/1001, etc.
-- These are NOT castable to bigint.
--
-- Decision: column types stay as TEXT. The Shopify ingestion layer must
-- normalise GIDs to either:
--   (a) store raw GIDs as text (current approach, consistent with GraphQL API)
--   (b) extract the numeric suffix (e.g. '4001') if using the REST API
-- This decision must be made before any production ingestion is built.
-- Tracked in: docs/cloud-schema-audit-v1.md §P1.6
-- =============================================================================
-- No DDL changes in this block — documented only.


-- =============================================================================
-- P2.7  Add composite query-path indexes
-- =============================================================================

-- customers: repeat_purchase_rate uses (store_id, first_order_at)
CREATE INDEX IF NOT EXISTS idx_customers_store_first_order
  ON public.customers (store_id, first_order_at);

-- products
CREATE INDEX IF NOT EXISTS idx_products_store_status
  ON public.products (store_id, status);

-- orders: all three metric query predicates
CREATE INDEX IF NOT EXISTS idx_orders_store_created
  ON public.orders (store_id, created_at);

CREATE INDEX IF NOT EXISTS idx_orders_store_financial_status
  ON public.orders (store_id, financial_status);

CREATE INDEX IF NOT EXISTS idx_orders_store_updated
  ON public.orders (store_id, updated_at);

-- order_line_items
CREATE INDEX IF NOT EXISTS idx_order_line_items_store_order
  ON public.order_line_items (store_id, order_id);

-- refunds
-- Note: cloud schema uses 'refund_date' (legacy) instead of 'created_at'.
-- Add the canonical created_at column alongside the legacy column so the index
-- and any future ingestion code can use the standard name.
-- The legacy 'refund_date' column is retained (P3 — do not drop without data audit).
ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_refunds_store_order
  ON public.refunds (store_id, order_id);

CREATE INDEX IF NOT EXISTS idx_refunds_store_created
  ON public.refunds (store_id, created_at);


-- =============================================================================
-- P2.8  Align FK delete rules
-- =============================================================================
-- Migration specifies CASCADE/SET NULL; cloud pre-existing schema uses NO ACTION.
-- Fix on the tables that have writable data paths (orders → child tables).
-- =============================================================================

-- orders.customer_id should be SET NULL (guest-safe; not CASCADE)
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

-- order_line_items.order_id should CASCADE (line items are meaningless without an order)
ALTER TABLE public.order_line_items
  DROP CONSTRAINT IF EXISTS order_line_items_order_id_fkey;
ALTER TABLE public.order_line_items
  ADD CONSTRAINT order_line_items_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

-- order_line_items.product_id should SET NULL (line item survives product deletion)
ALTER TABLE public.order_line_items
  DROP CONSTRAINT IF EXISTS order_line_items_product_id_fkey;
ALTER TABLE public.order_line_items
  ADD CONSTRAINT order_line_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

-- order_line_items.variant_id should SET NULL
ALTER TABLE public.order_line_items
  DROP CONSTRAINT IF EXISTS order_line_items_variant_id_fkey;
ALTER TABLE public.order_line_items
  ADD CONSTRAINT order_line_items_variant_id_fkey
    FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- refunds.order_id should CASCADE
ALTER TABLE public.refunds
  DROP CONSTRAINT IF EXISTS refunds_order_id_fkey;
ALTER TABLE public.refunds
  ADD CONSTRAINT refunds_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

-- product_variants.product_id should CASCADE
ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_product_id_fkey,
  DROP CONSTRAINT IF EXISTS variants_product_id_fkey;
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


-- =============================================================================
-- P3  Legacy columns — documented, not removed
-- =============================================================================
-- The following columns exist on cloud tables but are absent from the migration.
-- They are left in place to avoid data loss and are NOT read by any metric
-- function. They should be reviewed and either formalised or dropped before
-- Phase 2 ingestion.
--
-- orders        : order_number, order_date, currency, net_sales (denorm), shipping
-- customers     : first_name, last_name
-- products      : product_type, vendor
-- order_line_items: discount (rename candidate → total_discount), total
-- refunds       : reason, refund_date (rename candidate → created_at), amount (→ refund_subtotal)
-- =============================================================================
-- No DDL changes in this block — documented only.


-- =============================================================================
-- End of remediation migration 20260429000002
-- =============================================================================
