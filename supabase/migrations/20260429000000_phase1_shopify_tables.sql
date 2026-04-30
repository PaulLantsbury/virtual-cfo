-- =============================================================================
-- Virtual CFO — Supabase Phase 1 Migration
-- Phase 1 Shopify Tables
--
-- Created:  April 2026
-- Checklist: docs/supabase-phase-1-implementation-checklist.md
-- Metrics:   src/lib/metrics.ts (canonical names via METRIC.* and TILE_METRIC_MAP)
--
-- Tables created in foreign-key dependency order so each CREATE TABLE can
-- reference already-existing parents:
--
--   1.  stores                (root — no FK dependencies)
--   2.  store_settings        → stores
--   3.  store_cost_assumptions → stores
--   4.  customers             → stores
--   5.  products              → stores
--   6.  product_variants      → stores, products
--   7.  orders                → stores, customers (nullable FK)
--   8.  order_line_items      → stores, orders, products?, product_variants?
--   9.  refunds               → stores, orders
--  10.  refund_line_items     → stores, refunds, order_line_items
--  11.  discounts             → stores
--  12.  discount_codes        → stores, discounts
--  13.  opportunities         → stores
--  14.  cfo_alerts            → stores
--
-- All monetary columns use numeric(14,2) (up to 12 digits before decimal).
-- All rate/ratio columns use numeric(8,5) (e.g. 0.02500 = 2.5%).
-- All PKs are UUID using gen_random_uuid().
-- All tenant tables carry store_id NOT NULL → stores(id).
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. stores
--    Root table. All other tenant tables reference this.
--    One row per connected Shopify merchant.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stores (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_domain    text        NOT NULL,
  shopify_store_id  text        NOT NULL,
  name              text,
  currency_code     char(3)     NOT NULL DEFAULT 'GBP',
  timezone          text        NOT NULL DEFAULT 'Europe/London',
  is_active         boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_stores_shopify_domain    UNIQUE (shopify_domain),
  CONSTRAINT uq_stores_shopify_store_id  UNIQUE (shopify_store_id)
);

COMMENT ON TABLE  stores IS 'One row per connected Shopify merchant. Root of all multi-tenant data.';
COMMENT ON COLUMN stores.shopify_domain   IS 'Shopify store domain, e.g. my-store.myshopify.com';
COMMENT ON COLUMN stores.shopify_store_id IS 'Shopify internal store/shop ID from the API';
COMMENT ON COLUMN stores.currency_code    IS 'ISO 4217 currency code for all monetary values in this store';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. store_settings
--    Per-store configuration: alert thresholds and feature flags.
--    Exactly one row per store (UNIQUE store_id).
--    Seed with app defaults on first Shopify connection.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_settings (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  cm_target_pct           numeric(6,2),          -- contribution margin target %
  runway_warn_months      numeric(6,2),          -- alert when runway falls below N months
  repeat_rate_target_pct  numeric(6,2),          -- repeat purchase rate target %
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_store_settings_store UNIQUE (store_id)
);

COMMENT ON TABLE  store_settings IS 'Per-store thresholds and feature flags. One row per store.';
COMMENT ON COLUMN store_settings.cm_target_pct IS 'Contribution margin % below which the cm tile shows warning status';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. store_cost_assumptions
--    Variable cost rates used by commerceMetrics.ts to compute contribution margin.
--    Versioned by effective_from date — use DISTINCT ON (store_id) ORDER BY
--    store_id, effective_from DESC to get the current rates.
--    Replaces hardcoded costAssumptions.ts constants.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_cost_assumptions (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                    uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  payment_fee_rate            numeric(8,5) NOT NULL,   -- e.g. 0.02500 = 2.5%
  fulfilment_cost_per_order   numeric(10,2) NOT NULL,  -- £ per order
  packaging_cost_per_order    numeric(10,2) NOT NULL,  -- £ per order
  return_handling_rate        numeric(8,5) NOT NULL,   -- e.g. 0.15000 = 15% of refund value
  effective_from              date        NOT NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_store_cost_assumptions_store_date UNIQUE (store_id, effective_from)
);

COMMENT ON TABLE  store_cost_assumptions IS 'Variable cost rate assumptions per store, versioned by date. Replaces hardcoded costAssumptions.ts.';
COMMENT ON COLUMN store_cost_assumptions.payment_fee_rate         IS 'Blended payment processing fee as a rate (not %). Seed: 0.025.';
COMMENT ON COLUMN store_cost_assumptions.return_handling_rate     IS 'Return handling cost as a fraction of refund value. Seed: 0.15.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. customers
--    One row per Shopify customer. first_order_at is critical for
--    repeat_purchase_rate computation (METRIC.REPEAT_PURCHASE_RATE).
--    Must be populated before orders if customer_id FK is enforced;
--    allow nullable FK on orders during backfill.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  shopify_customer_id bigint      NOT NULL,
  email               text,                        -- PII — encrypt at rest if required
  first_order_at      timestamptz,                 -- NULL until first order is synced
  total_orders        int         NOT NULL DEFAULT 0,
  is_guest            boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_customers_store_shopify UNIQUE (store_id, shopify_customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customers_store_first_order
  ON customers (store_id, first_order_at);

COMMENT ON TABLE  customers IS 'One row per Shopify customer. first_order_at drives repeat-rate classification.';
COMMENT ON COLUMN customers.email         IS 'PII — consider encryption at rest per merchant data processing agreement';
COMMENT ON COLUMN customers.first_order_at IS 'Timestamp of the customer''s first ever order. Used to classify orders as repeat vs new.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. products
--    One row per Shopify product. Required before product_variants and
--    order_line_items (nullable FKs).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  shopify_product_id  bigint      NOT NULL,
  title               text,
  status              text,                        -- 'active' | 'archived' | 'draft'
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_products_store_shopify UNIQUE (store_id, shopify_product_id)
);

CREATE INDEX IF NOT EXISTS idx_products_store_status
  ON products (store_id, status);

COMMENT ON TABLE products IS 'One row per Shopify product. Required for variant cost coverage DQ check.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. product_variants
--    One row per Shopify product variant.
--    cost column: frequently NULL at Phase 1 — this is expected.
--    cost_populated: generated boolean; drives the variant cost coverage DQ check.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_variants (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id          uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  shopify_variant_id  bigint      NOT NULL,
  title               text,
  sku                 text,
  price               numeric(12,2) NOT NULL,
  compare_at_price    numeric(12,2),               -- NULL if no compare-at price set
  cost                numeric(12,2),               -- COGS — NULL for most stores at Phase 1

  -- Generated column: true when COGS is populated.
  -- Powers the variant cost coverage DQ check (Section 7.5 of checklist).
  cost_populated      boolean     GENERATED ALWAYS AS (cost IS NOT NULL) STORED,

  inventory_quantity  int         NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_product_variants_store_shopify UNIQUE (store_id, shopify_variant_id)
);

COMMENT ON TABLE  product_variants IS 'One row per Shopify variant. cost is expected to be NULL for most stores at Phase 1.';
COMMENT ON COLUMN product_variants.cost           IS 'COGS from Shopify. NULL is expected and handled gracefully.';
COMMENT ON COLUMN product_variants.cost_populated IS 'Generated: true when cost IS NOT NULL. Used in DQ check 7.5.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. orders
--    Central revenue fact table. One row per Shopify order.
--
--    Column naming matches exactly what commerceMetrics.ts selects:
--      gross_sales, discounts, refunds, tax, total_sales, customer_id
--
--    Generated columns:
--      is_guest_checkout — true when customer_id IS NULL (guest checkout)
--      has_discount      — true when discounts > 0 (value-based; aligns with
--                          discount_dependency_ratio = Discount Value / Gross Sales)
--      is_cancelled      — true when financial_status = 'cancelled'
--
--    updated_at: must be set from Shopify's order.updated_at at ingest.
--    The index on (store_id, updated_at) is used for incremental sync:
--      WHERE store_id = $1 AND updated_at > $last_sync_at
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  shopify_order_id  bigint      NOT NULL,
  customer_id       uuid        REFERENCES customers(id) ON DELETE SET NULL,  -- nullable: guest orders
  created_at        timestamptz NOT NULL,            -- from Shopify order.created_at
  updated_at        timestamptz NOT NULL DEFAULT now(), -- from Shopify order.updated_at; used for incremental sync
  financial_status  text        NOT NULL,
  gross_sales       numeric(14,2) NOT NULL DEFAULT 0,
  discounts         numeric(14,2) NOT NULL DEFAULT 0,
  refunds           numeric(14,2) NOT NULL DEFAULT 0,
  tax               numeric(14,2) NOT NULL DEFAULT 0,
  total_sales       numeric(14,2) NOT NULL DEFAULT 0,
  discount_codes    jsonb,                           -- raw Shopify discount code array

  -- Generated columns
  -- is_guest_checkout: true when customer_id IS NULL.
  -- Guest orders are excluded from repeat_purchase_rate numerator and denominator.
  is_guest_checkout boolean     GENERATED ALWAYS AS (customer_id IS NULL) STORED,

  -- has_discount: true when the order has a non-zero discount value.
  -- Value-based — aligns with discount_dependency_ratio (METRIC.DISCOUNT_DEPENDENCY_RATIO)
  -- = Discount Value / Gross Sales. Do not conflate with count-based discount_usage_rate.
  has_discount      boolean     GENERATED ALWAYS AS (discounts > 0) STORED,

  -- is_cancelled: true when financial_status = 'cancelled'.
  -- Cancelled orders are excluded from all revenue metric queries.
  is_cancelled      boolean     GENERATED ALWAYS AS (financial_status = 'cancelled') STORED,

  CONSTRAINT uq_orders_store_shopify UNIQUE (store_id, shopify_order_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_store_created
  ON orders (store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_store_financial_status
  ON orders (store_id, financial_status);
CREATE INDEX IF NOT EXISTS idx_orders_store_updated
  ON orders (store_id, updated_at);

COMMENT ON TABLE  orders IS 'Central revenue fact table. One row per Shopify order. Feeds net_sales, monthly_revenue, aov, dd, rr, cm, live_order_leakage_estimate tiles.';
COMMENT ON COLUMN orders.created_at        IS 'Set from Shopify order.created_at at ingest. Used for period attribution of refunds.';
COMMENT ON COLUMN orders.updated_at        IS 'Set from Shopify order.updated_at at ingest. Indexed for incremental sync.';
COMMENT ON COLUMN orders.gross_sales       IS 'Pre-discount revenue. Reconstruction: subtotal_price + total_discounts from Shopify API.';
COMMENT ON COLUMN orders.discounts         IS 'Total discount value on the order. Feeds discount_dependency_ratio (value-based).';
COMMENT ON COLUMN orders.refunds           IS 'Total refund value attributed to this order. Feeds refund_rate_pct.';
COMMENT ON COLUMN orders.tax               IS 'Tax amount. Must be a separate column — deducted from gross_sales to compute net_sales.';
COMMENT ON COLUMN orders.total_sales       IS 'Shopify total_price (post-discount, may include tax). Feeds monthly_revenue until gross_revenue() function is wired.';
COMMENT ON COLUMN orders.discount_codes    IS 'Raw Shopify discount_codes array as JSONB. Join to discount_codes table via LOWER(code).';
COMMENT ON COLUMN orders.is_guest_checkout IS 'Generated: customer_id IS NULL. Guest orders are excluded from repeat_purchase_rate.';
COMMENT ON COLUMN orders.has_discount      IS 'Generated: discounts > 0. Value-based — aligns with discount_dependency_ratio definition.';
COMMENT ON COLUMN orders.is_cancelled      IS 'Generated: financial_status = ''cancelled''. Cancelled orders excluded from all revenue queries.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. order_line_items
--    One row per line item within an order.
--    Created BEFORE refund_line_items because refund_line_items.order_line_item_id
--    is a FK to this table.
--
--    Generated columns:
--      gross_line_total — price × quantity (before discounts)
--      is_markdown      — true when compare_at_price > price and no discount code
--                         used (silent markdown detection for DQ check 7.3)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_line_items (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id              uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id            uuid        REFERENCES products(id) ON DELETE SET NULL,
  variant_id            uuid        REFERENCES product_variants(id) ON DELETE SET NULL,
  shopify_line_item_id  bigint      NOT NULL,
  title                 text,
  quantity              int         NOT NULL,
  price                 numeric(12,2) NOT NULL,
  compare_at_price      numeric(12,2),             -- NULL if no compare-at price set
  total_discount        numeric(12,2) NOT NULL DEFAULT 0,

  -- Generated columns
  -- gross_line_total: price × quantity (pre-discount revenue for this line).
  gross_line_total      numeric(14,2) GENERATED ALWAYS AS (price * quantity) STORED,

  -- is_markdown: true when the item was sold below its compare_at_price without
  -- a discount code — a "silent markdown". Powers DQ check 7.3.
  is_markdown           boolean     GENERATED ALWAYS AS (
                          compare_at_price IS NOT NULL AND compare_at_price > price
                        ) STORED,

  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_order_line_items_store_shopify UNIQUE (store_id, shopify_line_item_id)
);

CREATE INDEX IF NOT EXISTS idx_order_line_items_order
  ON order_line_items (store_id, order_id);

COMMENT ON TABLE  order_line_items IS 'One row per line item. Required for AOV per-unit analysis and silent markdown detection (DQ check 7.3).';
COMMENT ON COLUMN order_line_items.gross_line_total IS 'Generated: price × quantity. Pre-discount gross revenue for this line.';
COMMENT ON COLUMN order_line_items.is_markdown      IS 'Generated: compare_at_price IS NOT NULL AND compare_at_price > price. True = sold below RRP without a code.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. refunds
--    One row per refund event. A single order may have multiple refund rows
--    (Shopify allows partial refunds). The multi-refund case is covered by
--    DQ check 7.4 (partial refund double-counting).
--
--    created_at: set from Shopify refund.created_at at ingest.
--    Period attribution for refund_rate_pct uses orders.created_at, not
--    refunds.created_at — joins via order_id to get the order period.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refunds (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id            uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shopify_refund_id   bigint      NOT NULL,
  refund_subtotal     numeric(14,2) NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL,          -- from Shopify refund.created_at

  CONSTRAINT uq_refunds_store_shopify UNIQUE (store_id, shopify_refund_id)
);

CREATE INDEX IF NOT EXISTS idx_refunds_store_order
  ON refunds (store_id, order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_store_created
  ON refunds (store_id, created_at);

COMMENT ON TABLE  refunds IS 'One row per Shopify refund event. One order may have multiple refunds. See DQ check 7.4.';
COMMENT ON COLUMN refunds.refund_subtotal IS 'Value refunded (excluding tax if stored separately). Sum across all refund rows per order = total order refund value.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. refund_line_items
--     One row per line item within a refund.
--     Prevents double-counting when computing refund amounts by ensuring each
--     refunded quantity is attributed to a specific order_line_item.
--
--     Created AFTER order_line_items (FK dependency).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refund_line_items (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  refund_id           uuid        NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
  order_line_item_id  uuid        NOT NULL REFERENCES order_line_items(id) ON DELETE CASCADE,
  quantity            int         NOT NULL,
  subtotal            numeric(12,2) NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refund_line_items_refund
  ON refund_line_items (store_id, refund_id);

COMMENT ON TABLE  refund_line_items IS 'Line-item detail within a refund. Prevents double-counting for partially-refunded orders.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 11. discounts
--     One row per Shopify price rule (the parent of discount codes).
--     category: populated by merchant at onboarding; NULL until then.
--     NULL category means discount is uncategorised — the headline
--     discount_dependency_ratio (value-based) still works; only the
--     category breakdown on Pricing pages is affected.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discounts (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  shopify_price_rule_id bigint      NOT NULL,
  title                 text,
  value_type            text,                        -- 'percentage' | 'fixed_amount'
  value                 numeric(10,4),
  -- category: merchant-supplied at onboarding. NULL = uncategorised.
  -- Does NOT affect headline discount_dependency_ratio (value-based: discounts / gross_sales).
  -- Only affects per-category breakdown on the Pricing Optimisation page.
  category              text        CHECK (category IN ('loyalty','promotional','referral','wholesale','other')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_discounts_store_shopify UNIQUE (store_id, shopify_price_rule_id)
);

COMMENT ON TABLE  discounts IS 'One row per Shopify price rule. category populated by merchant at onboarding.';
COMMENT ON COLUMN discounts.category IS 'Merchant-supplied category. NULL until onboarding step is completed. Does not affect headline discount_dependency_ratio.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 12. discount_codes
--     One row per individual Shopify discount code under a price rule.
--     Joined to orders.discount_codes JSONB by normalising to LOWER(code).
--
--     The unique index is on LOWER(code) to enforce case-insensitive uniqueness
--     and match the join convention used at ingest time.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discount_codes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  discount_id  uuid        NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
  code         text        NOT NULL,
  usage_count  int         NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive unique index (DISABLED — see note below).
-- Migration 20260429000002 (cloud_schema_remediation) supersedes this table
-- definition with CONSTRAINT uq_discount_codes_store_code UNIQUE (store_id, code),
-- which provides equivalent uniqueness because codes are lowercase-normalised at
-- ingest time.  The functional index below is therefore redundant.
--
-- Additionally, Replit's deployment validator normalises the functional index DDL
-- to add explicit operator classes and incorrectly assigns text_ops to the uuid
-- store_id column, producing invalid SQL that blocks every publish.  Production
-- already has uq_discount_codes_store_code; this index has never existed there.
--
-- DO NOT RE-ENABLE without also fixing the operator-class handling in the
-- deployment validator.
--
-- CREATE UNIQUE INDEX IF NOT EXISTS "uq_discount_codes_store_lower_code"
--   ON "discount_codes" (store_id, lower(code));

COMMENT ON TABLE  discount_codes IS 'One row per Shopify discount code. Joined to orders.discount_codes JSONB via LOWER(code).';
COMMENT ON COLUMN discount_codes.code IS 'Stored as-is from Shopify. Unique index enforces case-insensitive uniqueness per store.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 13. opportunities
--     One row per identified margin recovery opportunity.
--     Once seeded with 3 rows, v_recoverable_contribution (Phase 1 view, not
--     created in this migration) will replace RECOVERABLE_LOW / RECOVERABLE_HIGH
--     from business-snapshot.ts.
--
--     Status: seeding these rows makes tile rc "database-backed".
--     The values remain seeded/mock until the opportunity engine computes
--     uplift_low / uplift_high from live Shopify data.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS opportunities (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title         text        NOT NULL,
  description   text,
  category      text,
  status        text        NOT NULL DEFAULT 'active'
                CHECK (status IN ('draft','active','in_progress','resolved','dismissed')),
  uplift_low    numeric(14,2) NOT NULL DEFAULT 0,   -- conservative uplift estimate (£/month)
  uplift_high   numeric(14,2) NOT NULL DEFAULT 0,   -- optimistic uplift estimate (£/month)
  action_label  text,                               -- short action text for the dashboard priority row
  why_label     text,                               -- explanation text for the dashboard priority row
  priority_rank int,                                -- display order; lower = higher priority
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_store_status
  ON opportunities (store_id, status);

COMMENT ON TABLE  opportunities IS 'One row per margin recovery opportunity. Feeds recoverable_contribution_range (METRIC.RECOVERABLE_CONTRIBUTION_RANGE) via v_recoverable_contribution view.';
COMMENT ON COLUMN opportunities.uplift_low  IS 'Conservative monthly uplift estimate (£). Seed from mock RECOVERABLE_LOW. Future: computed by opportunity engine from live data.';
COMMENT ON COLUMN opportunities.uplift_high IS 'Optimistic monthly uplift estimate (£). Seed from mock RECOVERABLE_HIGH. Future: computed by opportunity engine from live data.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 14. cfo_alerts
--     One row per alert type per store. Tracks trigger state and acknowledgement.
--     Seed with standard alert keys at onboarding.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cfo_alerts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  alert_key       text        NOT NULL,              -- e.g. 'low_runway', 'high_discount_dep'
  is_triggered    boolean     NOT NULL DEFAULT false,
  triggered_at    timestamptz,
  acknowledged_at timestamptz,
  severity        text        NOT NULL DEFAULT 'info'
                  CHECK (severity IN ('info','warn','danger')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_cfo_alerts_store_key UNIQUE (store_id, alert_key)
);

COMMENT ON TABLE  cfo_alerts IS 'One alert state row per alert type per store. Seed keys: low_runway, high_discount_dep, falling_repeat_rate, rising_cac, high_refund_rate.';
COMMENT ON COLUMN cfo_alerts.alert_key IS 'Stable identifier for the alert type. One row per key per store.';


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
--
-- RLS is enabled on all tables below.
-- The service role key (used in the API server and migrations) bypasses RLS
-- automatically — no policy changes are needed for backend operations.
-- The anon key (used by the Supabase JS client in the frontend) respects RLS.
-- With RLS enabled and no active policy, anon-key queries return zero rows,
-- which is the safe default for these new empty tables.
--
-- ─── Store isolation policies ─────────────────────────────────────────────────
-- PREREQUISITE before uncommenting: the Express API server must set the
-- session variable before every Supabase connection it makes:
--
--   SET LOCAL app.current_store_id = '<store_uuid>';
--
-- Until that middleware exists, the policies below remain commented out.
-- Enabling them without the middleware would silently deny all anon-key queries
-- and break the live metric tiles on the dashboard.
--
-- To activate policies:
--   1. Add SET LOCAL middleware to the Express API layer (api-server/src/)
--   2. Uncomment all CREATE POLICY blocks in this file
--   3. Verify: SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
-- =============================================================================

ALTER TABLE stores                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_cost_assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_line_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds                ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_line_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfo_alerts             ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- STORE ISOLATION POLICIES (commented out — see prerequisite above)
--
-- Pattern: every table filters on store_id = current_setting(...).
-- Exception: stores uses 'id' (not 'store_id') as the filter column.
-- current_setting(..., true): the second arg 'true' means "return NULL if
-- the setting is missing" rather than throwing an error. When NULL,
-- store_id = NULL evaluates to NULL (not TRUE), so no rows are returned.
-- ─────────────────────────────────────────────────────────────────────────────

-- stores (filters on 'id', not 'store_id'):
-- CREATE POLICY store_isolation ON stores
--   FOR ALL USING (id = current_setting('app.current_store_id', true)::uuid);

-- Standard store_id isolation — apply to all remaining tables:
-- CREATE POLICY store_isolation ON store_settings
--   FOR ALL USING (store_id = current_setting('app.current_store_id', true)::uuid);
-- CREATE POLICY store_isolation ON store_cost_assumptions
--   FOR ALL USING (store_id = current_setting('app.current_store_id', true)::uuid);
-- CREATE POLICY store_isolation ON customers
--   FOR ALL USING (store_id = current_setting('app.current_store_id', true)::uuid);
-- CREATE POLICY store_isolation ON products
--   FOR ALL USING (store_id = current_setting('app.current_store_id', true)::uuid);
-- CREATE POLICY store_isolation ON product_variants
--   FOR ALL USING (store_id = current_setting('app.current_store_id', true)::uuid);
-- CREATE POLICY store_isolation ON orders
--   FOR ALL USING (store_id = current_setting('app.current_store_id', true)::uuid);
-- CREATE POLICY store_isolation ON order_line_items
--   FOR ALL USING (store_id = current_setting('app.current_store_id', true)::uuid);
-- CREATE POLICY store_isolation ON refunds
--   FOR ALL USING (store_id = current_setting('app.current_store_id', true)::uuid);
-- CREATE POLICY store_isolation ON refund_line_items
--   FOR ALL USING (store_id = current_setting('app.current_store_id', true)::uuid);
-- CREATE POLICY store_isolation ON discounts
--   FOR ALL USING (store_id = current_setting('app.current_store_id', true)::uuid);
-- CREATE POLICY store_isolation ON discount_codes
--   FOR ALL USING (store_id = current_setting('app.current_store_id', true)::uuid);
-- CREATE POLICY store_isolation ON opportunities
--   FOR ALL USING (store_id = current_setting('app.current_store_id', true)::uuid);
-- CREATE POLICY store_isolation ON cfo_alerts
--   FOR ALL USING (store_id = current_setting('app.current_store_id', true)::uuid);
