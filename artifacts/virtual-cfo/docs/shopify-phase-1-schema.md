# Virtual CFO — Shopify Phase 1 Schema Design

> **Status:** Design only · April 2026 · No integration built yet
> **Scope:** Defines the internal database schema for storing Shopify data ingested during Phase 1 of the integration sequence. All tables are multi-tenant — every row is scoped to a `store_id`.
> **Companion documents:** `docs/data-dictionary-v1.md` § 2.1 (raw entities), § 3.1, § 3.3, § 3.5 (derived metrics)
> **DB target:** PostgreSQL 15+ (UUID primary keys, JSONB for variable-shape arrays, timestamptz for all datetimes)

---

## Contents

1. [Design Principles](#1-design-principles)
2. [Table Schemas](#2-table-schemas)
   - 2.1 [stores](#21-stores)
   - 2.2 [orders](#22-orders)
   - 2.3 [order_line_items](#23-order_line_items)
   - 2.4 [refunds](#24-refunds)
   - 2.5 [refund_line_items](#25-refund_line_items)
   - 2.6 [customers](#26-customers)
   - 2.7 [discounts](#27-discounts-price-rules)
   - 2.8 [discount_codes](#28-discount_codes)
   - 2.9 [products](#29-products)
   - 2.10 [product_variants](#210-product_variants)
3. [Derived Views and Functions](#3-derived-views-and-functions)
4. [Data Quality Checks](#4-data-quality-checks)
5. [Sync Strategy Notes](#5-sync-strategy-notes)

---

## 1. Design Principles

**Multi-tenancy first.** Every table has a `store_id` column as the first column after the primary key. All queries must be filtered by `store_id`. No cross-tenant data leakage is possible if row-level security is applied at the DB layer.

**Shopify IDs are not primary keys.** Internal UUIDs are used as primary keys. Shopify numeric IDs are stored in dedicated `shopify_*_id` columns and indexed for fast lookups during sync. This allows the schema to be extended to other sources in future phases without structural changes.

**Gross revenue requires reconstruction.** Shopify's `total_price` field is post-discount. The formula `subtotal_price + total_discounts` reconstructs the true pre-discount gross. Both fields are stored separately so the assertion `gross == net + discounts` can be verified at query time.

**Immutable source fields.** Shopify source fields are stored exactly as received — no transformations in storage. Derived values (e.g. `is_guest_checkout`, `has_discount`) are computed columns or materialised view fields, not overwritten source data.

**Currency.** All monetary fields are stored in the shop's base currency (from `stores.currency_code`). Multi-currency is out of scope for Phase 1. The `currency_code` is stored on each order to support future normalisation.

**Timestamps are UTC.** All `*_at` columns are `timestamptz`. Period grouping (monthly, annual) is performed in queries using the merchant's `iana_timezone` from the `stores` table.

---

## 2. Table Schemas

### 2.1 `stores`

One row per connected merchant. The root of all multi-tenant queries.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid` | NO | **Primary key** — internal |
| `shopify_domain` | `text` | NO | e.g. `my-shop.myshopify.com` — unique across all tenants |
| `shopify_store_id` | `bigint` | NO | Shopify's numeric shop ID |
| `shop_name` | `text` | NO | Human-readable shop name |
| `currency_code` | `text` | NO | ISO 4217, e.g. `GBP` — shop base currency |
| `iana_timezone` | `text` | NO | e.g. `Europe/London` — used for period grouping |
| `plan_name` | `text` | YES | Shopify plan (Basic/Shopify/Advanced/Plus) |
| `connected_at` | `timestamptz` | NO | When OAuth was first completed |
| `access_token` | `text` | NO | Encrypted Shopify OAuth token — never expose in API responses |
| `scope` | `text` | NO | Comma-separated Shopify permission scopes granted |
| `webhook_api_version` | `text` | NO | Shopify API version used for webhooks, e.g. `2024-04` |
| `last_full_sync_at` | `timestamptz` | YES | Last completed historical backfill |
| `last_incremental_sync_at` | `timestamptz` | YES | Last webhook or polling sync |
| `sync_status` | `text` | NO | `pending / syncing / ready / error` |
| `sync_error_message` | `text` | YES | Last error message if sync_status = error |
| `created_at` | `timestamptz` | NO | Row creation timestamp |
| `updated_at` | `timestamptz` | NO | Row last modified timestamp |

**Indexes:**
```sql
UNIQUE INDEX idx_stores_shopify_domain ON stores (shopify_domain);
UNIQUE INDEX idx_stores_shopify_store_id ON stores (shopify_store_id);
INDEX idx_stores_sync_status ON stores (sync_status);
```

**Metrics supported:** All metrics — `store_id` is the root filter for every query.

**Pages:** All pages — the store record gates authentication and data scope.

---

### 2.2 `orders`

One row per Shopify order. The central fact table for all revenue and transactional metrics.

#### Required fields

| Column | Type | Nullable | Source field | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | — | **Primary key** — internal |
| `store_id` | `uuid` | NO | — | FK → `stores.id` |
| `shopify_order_id` | `bigint` | NO | `id` | Shopify numeric order ID |
| `shopify_order_number` | `integer` | NO | `order_number` | Human-readable, e.g. `1234` |
| `financial_status` | `text` | NO | `financial_status` | `pending / authorized / partially_paid / paid / partially_refunded / refunded / voided` |
| `subtotal_price` | `numeric(12,2)` | NO | `subtotal_price` | Line item total before discounts and after tax |
| `total_discounts` | `numeric(12,2)` | NO | `total_discounts` | Total discount amount on this order (explicit codes only) |
| `total_price` | `numeric(12,2)` | NO | `total_price` | Final charge to customer (post-discount, post-tax) |
| `currency_code` | `text` | NO | `currency` | Order currency (usually matches store base currency) |
| `created_at` | `timestamptz` | NO | `created_at` | Order creation timestamp (UTC) |
| `synced_at` | `timestamptz` | NO | — | When this row was last written from Shopify |

#### Optional fields

| Column | Type | Nullable | Source field | Notes |
|---|---|---|---|---|
| `customer_id` | `uuid` | YES | `customer.id` | FK → `customers.id`. NULL for guest checkouts |
| `shopify_customer_id` | `bigint` | YES | `customer.id` | Shopify numeric customer ID (for join before customers table is populated) |
| `email` | `text` | YES | `email` | Order email — used for guest linkage heuristics |
| `fulfillment_status` | `text` | YES | `fulfillment_status` | `null / fulfilled / partial / restocked` |
| `total_tax` | `numeric(12,2)` | YES | `total_tax` | Tax collected |
| `total_shipping` | `numeric(12,2)` | YES | `total_shipping_price_set.shop_money.amount` | Shipping charged |
| `total_refunded` | `numeric(12,2)` | YES | `total_price_set.shop_money.amount` (from refunds) | Running total of refunds applied |
| `source_name` | `text` | YES | `source_name` | `web / pos / iphone / android / api / [custom]` |
| `landing_site_ref` | `text` | YES | `landing_site_ref` | UTM ref on first landing |
| `referring_site` | `text` | YES | `referring_site` | Referring URL |
| `tags` | `jsonb` | YES | `tags` | Merchant-assigned order tags |
| `discount_codes` | `jsonb` | YES | `discount_codes` | Array of `{code, amount, type}` objects |
| `note` | `text` | YES | `note` | Merchant order note |

#### Date fields

| Column | Type | Notes |
|---|---|---|
| `created_at` | `timestamptz` | **Primary period field** — used for all date-range filters |
| `processed_at` | `timestamptz` | When payment was captured (may differ from created_at) |
| `updated_at` | `timestamptz` | Last Shopify update (used for incremental sync cursor) |
| `cancelled_at` | `timestamptz` | NULL if not cancelled |
| `closed_at` | `timestamptz` | NULL if order still open |
| `synced_at` | `timestamptz` | Internal sync timestamp |

#### Computed columns

```sql
-- True gross revenue (pre-discount). Shopify total_price is post-discount.
gross_price NUMERIC GENERATED ALWAYS AS (subtotal_price + total_discounts) STORED;

-- Convenience flags for filtering
is_guest_checkout  BOOLEAN GENERATED ALWAYS AS (customer_id IS NULL) STORED;
has_discount       BOOLEAN GENERATED ALWAYS AS (total_discounts > 0) STORED;
is_cancelled       BOOLEAN GENERATED ALWAYS AS (cancelled_at IS NOT NULL) STORED;
```

#### Indexes

```sql
UNIQUE INDEX idx_orders_shopify_id     ON orders (store_id, shopify_order_id);
INDEX        idx_orders_created_at     ON orders (store_id, created_at);
INDEX        idx_orders_customer_id    ON orders (store_id, customer_id) WHERE customer_id IS NOT NULL;
INDEX        idx_orders_financial_st   ON orders (store_id, financial_status);
INDEX        idx_orders_has_discount   ON orders (store_id, has_discount);
INDEX        idx_orders_updated_at     ON orders (store_id, updated_at);  -- incremental sync cursor
```

#### Metrics supported

| Metric | How |
|---|---|
| `ANNUAL_REVENUE` / `MONTHLY_REVENUE` / `GROSS_REVENUE` | `SUM(gross_price)` filtered by period |
| `ANNUAL_DISCOUNTS` / `DISCOUNT_COST` | `SUM(total_discounts)` |
| `ORDER_COUNT` / `ORDERS` | `COUNT(*)` |
| `DISCOUNT_DEP` | `SUM(discounts) / SUM(gross_sales)` — value-based revenue rate |
| `DISCOUNT_USAGE_RATE` | `COUNT(*) FILTER (has_discount) / COUNT(*)` — count-based, future secondary diagnostic |
| `AVERAGE_SELLING_PRICE` | `SUM(total_price) / SUM(item_quantity)` (joined to line items) |
| `FULL_PRICE_ORDER_RATIO` | `COUNT(*) FILTER (NOT has_discount) / COUNT(*)` |
| `REPEAT_RATE` | Joined with `customers.first_order_at < period_start` |

#### Pages consuming

Dashboard, Profit Engine, Cash Control, Margin Analysis, Pricing Optimisation, Growth Quality, Scenario Lab, CFO Alerts

---

### 2.3 `order_line_items`

One row per line item on each order. Used for SKU-level margin, inventory, and order-item analysis.

#### Required fields

| Column | Type | Nullable | Source field | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | — | **Primary key** — internal |
| `store_id` | `uuid` | NO | — | FK → `stores.id` |
| `order_id` | `uuid` | NO | — | FK → `orders.id` |
| `shopify_line_item_id` | `bigint` | NO | `id` | Shopify numeric line item ID |
| `title` | `text` | NO | `title` | Product title at time of order (snapshot) |
| `quantity` | `integer` | NO | `quantity` | Number of units |
| `price` | `numeric(12,2)` | NO | `price` | Unit price at time of order (post-line-item-discount) |
| `total_discount` | `numeric(12,2)` | NO | `total_discount` | Discount applied to this specific line item |

#### Optional fields

| Column | Type | Nullable | Source field | Notes |
|---|---|---|---|---|
| `variant_id` | `uuid` | YES | — | FK → `product_variants.id` (nullable if variant deleted) |
| `product_id` | `uuid` | YES | — | FK → `products.id` (nullable if product deleted) |
| `shopify_variant_id` | `bigint` | YES | `variant_id` | Raw Shopify variant ID for reconciliation |
| `shopify_product_id` | `bigint` | YES | `product_id` | Raw Shopify product ID |
| `variant_title` | `text` | YES | `variant_title` | e.g. `Red / Large` |
| `sku` | `text` | YES | `sku` | Snapshot of SKU at time of order |
| `vendor` | `text` | YES | `vendor` | Product vendor at time of order |
| `compare_at_price` | `numeric(12,2)` | YES | `properties` or enriched | RRP/compare-at price — used for hidden-discount detection |
| `requires_shipping` | `boolean` | YES | `requires_shipping` | Distinguishes physical from digital |
| `is_gift_card` | `boolean` | YES | `gift_card` | Exclude from margin calculations |
| `fulfillment_status` | `text` | YES | `fulfillment_status` | Line-item level fulfilment state |
| `synced_at` | `timestamptz` | NO | — | Last sync timestamp |

#### Date fields

| Column | Type | Notes |
|---|---|---|
| `synced_at` | `timestamptz` | Internal only |

#### Computed columns

```sql
-- Gross line item revenue (pre-discount)
gross_line_total NUMERIC GENERATED ALWAYS AS ((price * quantity) + total_discount) STORED;

-- Detects items sold below compare_at price without a discount code
is_markdown BOOLEAN GENERATED ALWAYS AS (
  compare_at_price IS NOT NULL AND price < compare_at_price AND total_discount = 0
) STORED;
```

#### Indexes

```sql
UNIQUE INDEX idx_oli_shopify_id   ON order_line_items (store_id, shopify_line_item_id);
INDEX        idx_oli_order_id     ON order_line_items (store_id, order_id);
INDEX        idx_oli_variant_id   ON order_line_items (store_id, variant_id) WHERE variant_id IS NOT NULL;
INDEX        idx_oli_product_id   ON order_line_items (store_id, product_id) WHERE product_id IS NOT NULL;
INDEX        idx_oli_is_markdown  ON order_line_items (store_id, is_markdown) WHERE is_markdown = true;
```

#### Metrics supported

| Metric | How |
|---|---|
| `AVERAGE_SELLING_PRICE` | `SUM(price * quantity) / SUM(quantity)` |
| Hidden discount detection | `WHERE is_markdown = true` |
| SKU-level margin (Phase 3+) | Joined with `product_variants.cost` |

#### Pages consuming

Margin Analysis, Pricing Optimisation

---

### 2.4 `refunds`

One row per refund event. A single order can have multiple refunds (partial refunds over time).

#### Required fields

| Column | Type | Nullable | Source field | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | — | **Primary key** — internal |
| `store_id` | `uuid` | NO | — | FK → `stores.id` |
| `order_id` | `uuid` | NO | — | FK → `orders.id` |
| `shopify_refund_id` | `bigint` | NO | `id` | Shopify numeric refund ID |
| `refund_subtotal` | `numeric(12,2)` | NO | `refund_line_items[].subtotal` sum | Revenue refunded on line items |
| `refund_total` | `numeric(12,2)` | NO | `transactions[].amount` sum | Total cash refunded (includes shipping) |
| `created_at` | `timestamptz` | NO | `created_at` | When refund was issued |
| `synced_at` | `timestamptz` | NO | — | Last sync timestamp |

#### Optional fields

| Column | Type | Nullable | Source field | Notes |
|---|---|---|---|---|
| `note` | `text` | YES | `note` | Merchant's refund reason |
| `refund_tax` | `numeric(12,2)` | YES | From transactions | Tax portion refunded |
| `refund_shipping` | `numeric(12,2)` | YES | From transactions | Shipping portion refunded |
| `restock` | `boolean` | YES | `restock` | Whether inventory was restocked |
| `processed_at` | `timestamptz` | YES | `processed_at` | When refund was processed (may differ from created_at) |
| `return_fulfilment_cost` | `numeric(12,2)` | YES | Xero (Phase 2) | Reverse-logistics cost — NULL until Xero connected |

#### Computed columns

```sql
-- Marks whether this refund fully covered the remaining order balance
is_full_refund BOOLEAN;  -- computed at ingestion time by comparing cumulative refunds vs order total_price
```

#### Indexes

```sql
UNIQUE INDEX idx_refunds_shopify_id  ON refunds (store_id, shopify_refund_id);
INDEX        idx_refunds_order_id    ON refunds (store_id, order_id);
INDEX        idx_refunds_created_at  ON refunds (store_id, created_at);
```

#### Metrics supported

| Metric | How |
|---|---|
| `ANNUAL_RETURNS` / `RETURNS_IMPACT` | `SUM(refund_subtotal)` + fulfilment cost (Phase 2) |
| `RETURN_AMOUNT` | `SUM(refund_subtotal)` filtered by period |
| `NET_REVENUE` / `NET_RETAINED` | Subtracted from gross revenue |

#### Pages consuming

Profit Engine, Pricing Optimisation, Margin Analysis

---

### 2.5 `refund_line_items`

One row per line item within a refund. Required for partial-refund tracking and preventing double-counting.

#### Required fields

| Column | Type | Nullable | Source field | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | — | **Primary key** — internal |
| `store_id` | `uuid` | NO | — | FK → `stores.id` |
| `refund_id` | `uuid` | NO | — | FK → `refunds.id` |
| `order_line_item_id` | `uuid` | NO | — | FK → `order_line_items.id` |
| `shopify_refund_line_item_id` | `bigint` | NO | `id` | Shopify numeric refund line item ID |
| `quantity` | `integer` | NO | `quantity` | Units returned |
| `subtotal` | `numeric(12,2)` | NO | `subtotal` | Revenue refunded for this line |
| `synced_at` | `timestamptz` | NO | — | Last sync timestamp |

#### Optional fields

| Column | Type | Nullable | Source field | Notes |
|---|---|---|---|---|
| `total_tax` | `numeric(12,2)` | YES | `total_tax` | Tax refunded on this line |
| `restock_type` | `text` | YES | `restock_type` | `no_restock / cancel / return / legacy_restock` |

#### Indexes

```sql
UNIQUE INDEX idx_rli_shopify_id     ON refund_line_items (store_id, shopify_refund_line_item_id);
INDEX        idx_rli_refund_id      ON refund_line_items (store_id, refund_id);
INDEX        idx_rli_line_item_id   ON refund_line_items (store_id, order_line_item_id);
```

#### Metrics supported

Partial refund deduplication — queried via `SUM(refund_line_items.subtotal) GROUP BY order_id` to produce a clean per-order total-refunded figure without double-counting multiple refund events.

---

### 2.6 `customers`

One row per Shopify customer. Used for repeat purchase rate and new-vs-returning classification.

#### Required fields

| Column | Type | Nullable | Source field | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | — | **Primary key** — internal |
| `store_id` | `uuid` | NO | — | FK → `stores.id` |
| `shopify_customer_id` | `bigint` | NO | `id` | Shopify numeric customer ID |
| `orders_count_all_time` | `integer` | NO | `orders_count` | Shopify's all-time order count for this customer |
| `total_spent_all_time` | `numeric(12,2)` | NO | `total_spent` | Shopify's all-time total spend |
| `created_at` | `timestamptz` | NO | `created_at` | Shopify customer creation date (first account registration) |
| `first_order_at` | `timestamptz` | NO | Derived from `orders` | Date of first ever order — **critical for repeat-rate queries** |
| `synced_at` | `timestamptz` | NO | — | Last sync timestamp |

#### Optional fields

| Column | Type | Nullable | Source field | Notes |
|---|---|---|---|---|
| `email_hash` | `text` | YES | SHA-256 of `email` | Hashed for PII compliance — do not store plaintext email |
| `accepts_marketing` | `boolean` | YES | `accepts_marketing` | Email marketing opt-in |
| `tags` | `jsonb` | YES | `tags` | Merchant-assigned customer tags |
| `last_order_at` | `timestamptz` | YES | Derived from `orders` | Date of most recent order |
| `last_order_id` | `uuid` | YES | — | FK → `orders.id` |
| `updated_at` | `timestamptz` | YES | `updated_at` | Shopify customer updated_at |

#### Date fields

| Column | Type | Notes |
|---|---|---|
| `created_at` | `timestamptz` | Customer account creation — used to determine "new" vs "returning" |
| `first_order_at` | `timestamptz` | **Primary repeat-rate field** — customer is "repeat" in a period if `first_order_at < period_start` |
| `last_order_at` | `timestamptz` | Recency for dormancy analysis |

#### Indexes

```sql
UNIQUE INDEX idx_customers_shopify_id   ON customers (store_id, shopify_customer_id);
INDEX        idx_customers_first_order  ON customers (store_id, first_order_at);
INDEX        idx_customers_email_hash   ON customers (store_id, email_hash) WHERE email_hash IS NOT NULL;
INDEX        idx_customers_created_at   ON customers (store_id, created_at);
```

#### Metrics supported

| Metric | How |
|---|---|
| `REPEAT_RATE` | `orders JOIN customers ON first_order_at < period_start` |
| `RETENTION_STATUS` | Compare REPEAT_RATE across two consecutive periods |
| New customer count (for CAC, Phase 4) | `customers WHERE first_order_at BETWEEN period_start AND period_end` |

#### Pages consuming

Growth Quality, Dashboard

---

### 2.7 `discounts` (Price Rules)

One row per Shopify price rule. The parent record for all discount codes under that rule. Supports discount categorisation (loyalty vs promotional vs referral).

#### Required fields

| Column | Type | Nullable | Source field | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | — | **Primary key** — internal |
| `store_id` | `uuid` | NO | — | FK → `stores.id` |
| `shopify_price_rule_id` | `bigint` | NO | `id` | Shopify numeric price rule ID |
| `title` | `text` | NO | `title` | Merchant-assigned rule name |
| `value_type` | `text` | NO | `value_type` | `percentage / fixed_amount / buy_x_get_y` |
| `value` | `numeric(10,4)` | NO | `value` | Negative number = discount (e.g. `-10.0` = 10% off) |
| `target_type` | `text` | NO | `target_type` | `line_item / shipping_line` |
| `created_at` | `timestamptz` | NO | `created_at` | Rule creation date |
| `synced_at` | `timestamptz` | NO | — | Last sync timestamp |

#### Optional fields

| Column | Type | Nullable | Source field | Notes |
|---|---|---|---|---|
| `allocation_method` | `text` | YES | `allocation_method` | `across / each` |
| `starts_at` | `timestamptz` | YES | `starts_at` | Rule activation date |
| `ends_at` | `timestamptz` | YES | `ends_at` | Rule expiry — NULL = no expiry |
| `usage_limit` | `integer` | YES | `usage_limit` | Max total uses — NULL = unlimited |
| `once_per_customer` | `boolean` | YES | `once_per_customer` | Whether each customer can use it once only |
| `category` | `text` | YES | Merchant-assigned | `loyalty / promotional / referral / wholesale / other` — set during onboarding setup step |
| `updated_at` | `timestamptz` | YES | `updated_at` | |

#### Indexes

```sql
UNIQUE INDEX idx_discounts_shopify_id  ON discounts (store_id, shopify_price_rule_id);
INDEX        idx_discounts_category    ON discounts (store_id, category) WHERE category IS NOT NULL;
INDEX        idx_discounts_value_type  ON discounts (store_id, value_type);
```

#### Metrics supported

Discount categorisation — enables `DISCOUNT_DEP` breakdown by type (§ 5.2 of data dictionary). Supports future "margin-safe discount dependency" metric that excludes loyalty codes.

#### Pages consuming

Pricing Optimisation (discount breakdown), CFO Alerts (discount dependency threshold)

---

### 2.8 `discount_codes`

One row per individual discount code (a price rule can have many codes). Linked to orders via `orders.discount_codes JSONB` field.

#### Required fields

| Column | Type | Nullable | Source field | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | — | **Primary key** — internal |
| `store_id` | `uuid` | NO | — | FK → `stores.id` |
| `price_rule_id` | `uuid` | NO | — | FK → `discounts.id` |
| `shopify_discount_code_id` | `bigint` | NO | `id` | Shopify numeric code ID |
| `code` | `text` | NO | `code` | The actual code string, e.g. `SUMMER20` |
| `usage_count` | `integer` | NO | `usage_count` | Total times used (all time) |
| `created_at` | `timestamptz` | NO | `created_at` | |
| `synced_at` | `timestamptz` | NO | — | |

#### Optional fields

| Column | Type | Nullable | Source field | Notes |
|---|---|---|---|---|
| `updated_at` | `timestamptz` | YES | `updated_at` | |
| `errors` | `jsonb` | YES | `errors` | Validation errors from Shopify |

#### Indexes

```sql
UNIQUE INDEX idx_discount_codes_shopify_id ON discount_codes (store_id, shopify_discount_code_id);
INDEX        idx_discount_codes_code       ON discount_codes (store_id, LOWER(code));
INDEX        idx_discount_codes_rule_id    ON discount_codes (store_id, price_rule_id);
```

#### Metrics supported

Code-level attribution — join `LOWER(discount_codes.code) = LOWER(orders.discount_codes[*].code)` to look up the parent price rule and its merchant-assigned category.

---

### 2.9 `products`

One row per Shopify product. Parent record for variants.

#### Required fields

| Column | Type | Nullable | Source field | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | — | **Primary key** — internal |
| `store_id` | `uuid` | NO | — | FK → `stores.id` |
| `shopify_product_id` | `bigint` | NO | `id` | Shopify numeric product ID |
| `title` | `text` | NO | `title` | Product name |
| `status` | `text` | NO | `status` | `active / archived / draft` |
| `created_at` | `timestamptz` | NO | `created_at` | |
| `updated_at` | `timestamptz` | NO | `updated_at` | Used as incremental sync cursor |
| `synced_at` | `timestamptz` | NO | — | |

#### Optional fields

| Column | Type | Nullable | Source field | Notes |
|---|---|---|---|---|
| `vendor` | `text` | YES | `vendor` | Supplier / brand |
| `product_type` | `text` | YES | `product_type` | Merchant-defined category |
| `handle` | `text` | YES | `handle` | URL slug |
| `tags` | `jsonb` | YES | `tags` | Product tags |
| `published_at` | `timestamptz` | YES | `published_at` | NULL = unpublished |

#### Indexes

```sql
UNIQUE INDEX idx_products_shopify_id  ON products (store_id, shopify_product_id);
INDEX        idx_products_status      ON products (store_id, status);
INDEX        idx_products_updated_at  ON products (store_id, updated_at);
```

#### Metrics supported

Product status filtering — `WHERE status = 'active'` is used in the variant cost coverage data quality check.

---

### 2.10 `product_variants`

One row per product variant (size, colour, etc.). Contains the `cost` field (COGS per unit) which is critical for inventory value and margin calculations — but is frequently missing.

#### Required fields

| Column | Type | Nullable | Source field | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | — | **Primary key** — internal |
| `store_id` | `uuid` | NO | — | FK → `stores.id` |
| `product_id` | `uuid` | NO | — | FK → `products.id` |
| `shopify_variant_id` | `bigint` | NO | `id` | Shopify numeric variant ID |
| `shopify_product_id` | `bigint` | NO | `product_id` | Shopify numeric product ID (for direct lookups) |
| `title` | `text` | NO | `title` | Variant name, e.g. `Red / Large` |
| `price` | `numeric(12,2)` | NO | `price` | Current listed selling price |
| `inventory_item_id` | `bigint` | NO | `inventory_item_id` | Links to inventory level queries |
| `updated_at` | `timestamptz` | NO | `updated_at` | Sync cursor |
| `synced_at` | `timestamptz` | NO | — | |

#### Optional fields

| Column | Type | Nullable | Source field | Notes |
|---|---|---|---|---|
| `cost` | `numeric(12,2)` | YES | `cost` (via InventoryItem) | **COGS per unit — often NULL.** Requires merchant to populate in Shopify admin |
| `compare_at_price` | `numeric(12,2)` | YES | `compare_at_price` | Original / RRP price. Used for markdown detection |
| `sku` | `text` | YES | `sku` | Merchant SKU |
| `barcode` | `text` | YES | `barcode` | EAN / UPC |
| `inventory_quantity` | `integer` | YES | `inventory_quantity` | Snapshot at last sync — use inventory_levels for live data |
| `weight` | `numeric(8,3)` | YES | `weight` | Used for shipping cost estimation |
| `weight_unit` | `text` | YES | `weight_unit` | `kg / g / lb / oz` |
| `taxable` | `boolean` | YES | `taxable` | |
| `requires_shipping` | `boolean` | YES | `requires_shipping` | Distinguishes physical from digital |

#### Computed columns

```sql
-- Flags whether a usable cost is present. Used by data quality checks.
cost_populated BOOLEAN GENERATED ALWAYS AS (cost IS NOT NULL AND cost > 0) STORED;
```

#### Indexes

```sql
UNIQUE INDEX idx_variants_shopify_id         ON product_variants (store_id, shopify_variant_id);
INDEX        idx_variants_product_id         ON product_variants (store_id, product_id);
INDEX        idx_variants_inventory_item_id  ON product_variants (store_id, inventory_item_id);
INDEX        idx_variants_cost_populated     ON product_variants (store_id, cost_populated);
INDEX        idx_variants_updated_at         ON product_variants (store_id, updated_at);
```

#### Metrics supported

| Metric | How |
|---|---|
| `INVENTORY_VALUE` (Phase 3) | `SUM(inventory_quantity × cost)` per active SKU |
| `INVENTORY_DAYS` (Phase 3) | `INVENTORY_VALUE / (ANNUAL_VARIABLE_COSTS / 365)` |
| SKU-level contribution (future) | `(price − cost) / price` per variant |

#### Pages consuming

Cash Control (inventory value, Phase 3), Margin Analysis (future SKU drill-down)

---

## 3. Derived Views and Functions

All functions accept `(store_id UUID, date_from TIMESTAMPTZ, date_to TIMESTAMPTZ)` as parameters. Dates are used with `AT TIME ZONE stores.iana_timezone` for period grouping. The base filter on all revenue queries excludes cancelled orders (`cancelled_at IS NULL`) and limits to finalised financial statuses (`financial_status IN ('paid', 'partially_refunded')`).

> **Pending orders:** Orders with `financial_status = 'pending'` are intentionally excluded from all metric functions. They are surfaced separately by the data quality check in §4.2.

---

### 3.1 `gross_revenue(store_id, date_from, date_to)`

Pre-discount revenue. Reconstructed because Shopify `total_price` is post-discount.

```sql
SELECT
  SUM(o.subtotal_price + o.total_discounts) AS gross_revenue
FROM orders o
WHERE o.store_id     = $store_id
  AND o.created_at   BETWEEN $date_from AND $date_to
  AND o.financial_status IN ('paid', 'partially_refunded')
  AND o.cancelled_at IS NULL;

-- Feeds: ANNUAL_REVENUE, MONTHLY_REVENUE, GROSS_REVENUE (pricing period)
-- Assertion: gross_revenue = net_revenue()+discount_cost()+return_amount() ± rounding
-- Pages: Profit Engine, Margin Analysis, Pricing Optimisation, Scenario Lab, Dashboard
```

---

### 3.2 `net_revenue(store_id, date_from, date_to)`

Gross revenue minus discount cost and return amounts.

```sql
SELECT
  SUM(o.subtotal_price + o.total_discounts)   -- gross
  - SUM(o.total_discounts)                     -- minus discounts
  - COALESCE(SUM(r.refund_subtotal_total), 0)  -- minus returns
  AS net_revenue
FROM orders o
LEFT JOIN (
  SELECT order_id, SUM(refund_subtotal) AS refund_subtotal_total
  FROM refunds
  WHERE store_id = $store_id
  GROUP BY order_id
) r ON r.order_id = o.id
WHERE o.store_id     = $store_id
  AND o.created_at   BETWEEN $date_from AND $date_to
  AND o.financial_status IN ('paid', 'partially_refunded')
  AND o.cancelled_at IS NULL;

-- Feeds: ANNUAL_NET_REVENUE, NET_REVENUE (pricing), NET_RETAINED
-- Pages: Profit Engine, Pricing Optimisation
```

---

### 3.3 `discount_cost(store_id, date_from, date_to)`

Total revenue surrendered through explicit discount codes.

```sql
SELECT
  SUM(total_discounts) AS discount_cost
FROM orders
WHERE store_id        = $store_id
  AND created_at      BETWEEN $date_from AND $date_to
  AND financial_status IN ('paid', 'partially_refunded')
  AND cancelled_at    IS NULL;

-- Feeds: ANNUAL_DISCOUNTS, DISCOUNT_COST
-- Note: Does NOT capture silent markdowns (items sold below compare_at without a code).
--       Those are surfaced by the is_markdown data quality check.
-- Pages: Profit Engine, Pricing Optimisation
```

---

### 3.4 `average_discount_pct(store_id, date_from, date_to)`

Revenue-weighted average discount rate. Correctly accounts for order size variation.

```sql
SELECT
  SUM(total_discounts) / NULLIF(SUM(subtotal_price + total_discounts), 0) * 100
  AS avg_discount_pct
FROM orders
WHERE store_id        = $store_id
  AND created_at      BETWEEN $date_from AND $date_to
  AND financial_status IN ('paid', 'partially_refunded')
  AND cancelled_at    IS NULL;

-- Feeds: AVG_DISCOUNT_PCT
-- Assertion: result should approximately equal DISCOUNT_COST / GROSS_REVENUE * 100 ± 0.1pp
-- Pages: Pricing Optimisation
```

---

### 3.5 `order_count(store_id, date_from, date_to)`

Count of revenue-generating orders in the period. Fully refunded orders are excluded.

```sql
SELECT
  COUNT(*) AS order_count
FROM orders
WHERE store_id        = $store_id
  AND created_at      BETWEEN $date_from AND $date_to
  AND financial_status IN ('paid', 'partially_refunded')
  AND cancelled_at    IS NULL;

-- Feeds: MONTHLY_ORDER_VOLUME, ORDERS (pricing period)
-- Pages: Margin Analysis, Pricing Optimisation, Scenario Lab
```

---

### 3.6 `repeat_purchase_rate(store_id, date_from, date_to)`

Percentage of orders in the period placed by customers who had already ordered before the period start.

```sql
SELECT
  COUNT(CASE WHEN c.first_order_at < $date_from THEN 1 END)::float
  / NULLIF(COUNT(o.id), 0) * 100
  AS repeat_purchase_rate,

  -- Companion fields for the data quality badge
  COUNT(o.id)                                          AS total_orders,
  COUNT(CASE WHEN o.is_guest_checkout THEN 1 END)      AS guest_orders,
  COUNT(CASE WHEN o.is_guest_checkout THEN 1 END)::float
    / NULLIF(COUNT(o.id), 0) * 100                     AS guest_rate_pct

FROM orders o
LEFT JOIN customers c
  ON c.id = o.customer_id AND c.store_id = o.store_id
WHERE o.store_id        = $store_id
  AND o.created_at      BETWEEN $date_from AND $date_to
  AND o.financial_status IN ('paid', 'partially_refunded')
  AND o.cancelled_at    IS NULL
  AND o.is_guest_checkout = false;  -- exclude guests: unclassifiable

-- Feeds: REPEAT_RATE, REPEAT_RATE_PREV
-- Warning: Exclude guest orders from both numerator and denominator.
--          Surface guest_rate_pct as a data quality badge.
-- Pages: Growth Quality, Dashboard
```

---

### 3.7 `discount_dependency(store_id, date_from, date_to)`

Discount value surrendered as a percentage of gross revenue.

**Definition:** `Discount Dependency = Discount Value / Gross Revenue`

This is a **value-based revenue rate** — it measures how much gross revenue was given away as discounts, not how many orders contained a code. A few very deep discounts will produce a high dependency even if most orders are full-price. This is the more financially meaningful signal for a CFO context.

```sql
SELECT
  COALESCE(SUM(discounts), 0)
  / NULLIF(SUM(gross_sales), 0) * 100
  AS discount_dependency
FROM orders
WHERE store_id        = $store_id
  AND created_at      BETWEEN $date_from AND $date_to
  AND financial_status NOT IN ('cancelled');

-- Feeds: DISCOUNT_DEP, DISCOUNT_DEP_PREV
-- Note: Value-based. Includes ALL discount types (loyalty, promotional, referral).
--       Category breakdown available if discounts.category is populated.
--       Excludes cancelled orders; includes partially_refunded and fully refunded.
-- Pages: Growth Quality, Dashboard, CFO Alerts
```

#### 3.7a `discount_usage_rate(store_id, date_from, date_to)` — future secondary diagnostic

Percentage of orders that include any discount code, regardless of value. This is the **count-based complement** to `discount_dependency`. It answers "how often do customers use a code?" rather than "how much revenue is being given away?".

**Status:** Future / secondary diagnostic. Not required for Phase 1 go-live. Planned for the Pricing Optimisation secondary panel. Must not be used in place of `DISCOUNT_DEP`.

```sql
-- Phase 1+ only — implement after discount_dependency() is live
SELECT
  COUNT(CASE WHEN has_discount THEN 1 END)::float
  / NULLIF(COUNT(*), 0) * 100
  AS discount_usage_rate
FROM orders
WHERE store_id        = $store_id
  AND created_at      BETWEEN $date_from AND $date_to
  AND financial_status IN ('paid', 'partially_refunded')
  AND cancelled_at    IS NULL;

-- Feeds: DISCOUNT_USAGE_RATE (secondary diagnostic only — NOT DISCOUNT_DEP)
-- Note: Count-based. Requires has_discount computed column to be populated.
-- Pages: Pricing Optimisation (secondary panel)
```

---

### 3.8 `return_amount(store_id, date_from, date_to)`

Total revenue refunded on orders created within the period.

```sql
SELECT
  COALESCE(SUM(r.refund_subtotal), 0) AS return_amount,
  COUNT(DISTINCT r.order_id)           AS return_order_count
FROM refunds r
JOIN orders o ON o.id = r.order_id AND o.store_id = r.store_id
WHERE r.store_id  = $store_id
  AND o.created_at BETWEEN $date_from AND $date_to
  AND o.cancelled_at IS NULL;

-- Feeds: ANNUAL_RETURNS, RETURNS_IMPACT (revenue component — fulfilment cost added in Phase 2)
-- Note: Uses order.created_at for period attribution, not refund.created_at.
--       This aligns the return to the revenue period in which the sale occurred.
-- Pages: Profit Engine, Pricing Optimisation
```

---

### 3.9 `full_price_order_ratio(store_id, date_from, date_to)`

Percentage of orders where the customer paid full price (no discount applied).

```sql
SELECT
  COUNT(CASE WHEN NOT has_discount THEN 1 END)::float
  / NULLIF(COUNT(*), 0) * 100
  AS full_price_order_ratio
FROM orders
WHERE store_id        = $store_id
  AND created_at      BETWEEN $date_from AND $date_to
  AND financial_status IN ('paid', 'partially_refunded')
  AND cancelled_at    IS NULL;

-- Note: full_price_order_ratio is the count-based complement of discount_usage_rate
--       (both count-based), not the value-based complement of discount_dependency.
-- Feeds: Full-price order ratio (Pricing Optimisation KPI)
-- Note: Does NOT detect silent markdowns (items sold below compare_at without a code).
--       Those are surfaced separately by the is_markdown data quality check.
-- Pages: Pricing Optimisation
```

---

### 3.10 `average_selling_price(store_id, date_from, date_to)`

Average revenue per unit sold. Uses line-item data for unit count.

```sql
SELECT
  SUM(o.total_price) / NULLIF(SUM(li.unit_count), 0) AS avg_selling_price
FROM orders o
JOIN (
  SELECT order_id, SUM(quantity) AS unit_count
  FROM order_line_items
  WHERE store_id = $store_id
    AND is_gift_card IS DISTINCT FROM true  -- exclude gift cards
  GROUP BY order_id
) li ON li.order_id = o.id
WHERE o.store_id        = $store_id
  AND o.created_at      BETWEEN $date_from AND $date_to
  AND o.financial_status IN ('paid', 'partially_refunded')
  AND o.cancelled_at    IS NULL;

-- Feeds: Average selling price (Pricing Optimisation, Scenario Lab)
-- Note: Excludes gift cards from unit count (they skew ASP significantly).
-- Pages: Pricing Optimisation, Scenario Lab
```

---

## 4. Data Quality Checks

These checks are run after each sync and their results are stored in a `data_quality_flags` table (schema TBD in Phase 2). Flags are surfaced as badges or warnings on affected UI pages.

---

### 4.1 Missing `customer_id` — Guest Checkout Rate

**Risk:** Guest checkouts (no `customer_id`) cannot be classified as new or returning customers. If the rate is high, `REPEAT_RATE` is unreliable.

**Check:**
```sql
SELECT
  COUNT(*)                                                            AS total_orders,
  COUNT(*) FILTER (WHERE is_guest_checkout = true)                   AS guest_orders,
  ROUND(
    COUNT(*) FILTER (WHERE is_guest_checkout = true)::numeric
    / NULLIF(COUNT(*), 0) * 100, 1
  )                                                                   AS guest_rate_pct
FROM orders
WHERE store_id        = $store_id
  AND created_at      BETWEEN $date_from AND $date_to
  AND financial_status IN ('paid', 'partially_refunded')
  AND cancelled_at    IS NULL;
```

**Thresholds:**

| guest_rate_pct | Flag | Action |
|---|---|---|
| < 10% | None | Repeat rate is reliable |
| 10–25% | `WARN` | Show badge: "X% of orders are guest checkouts and excluded from repeat-rate calculation" |
| > 25% | `ALERT` | Repeat rate marked LOW confidence. Recommend enabling Shopify customer accounts |

---

### 4.2 Pending `financial_status`

**Risk:** Orders with `financial_status = 'pending'` are excluded from revenue totals but their final status is unknown. If there are many, the period totals will shift once they settle.

**Check:**
```sql
SELECT
  COUNT(*) AS pending_order_count,
  SUM(total_price) AS pending_order_value
FROM orders
WHERE store_id        = $store_id
  AND created_at      BETWEEN $date_from AND $date_to
  AND financial_status = 'pending';
```

**Thresholds:**

| Condition | Flag | Action |
|---|---|---|
| 0 pending orders | None | |
| 1–5 pending orders OR < 1% of order value | `INFO` | Show "N orders pending — totals may shift" |
| > 5 pending orders OR > 1% of order value | `WARN` | Flag period totals as preliminary; show pending count |

---

### 4.3 Discounts Recorded as Price Changes (Silent Markdowns)

**Risk:** When merchants reduce prices directly on the product (without a discount code), the revenue reduction is invisible to `DISCOUNT_COST`. These show as `compare_at_price > price` on a line item with `total_discount = 0`.

**Check:**
```sql
SELECT
  COUNT(DISTINCT oli.order_id)                                        AS affected_orders,
  SUM(
    (oli.compare_at_price - oli.price) * oli.quantity
  )                                                                   AS estimated_markdown_value
FROM order_line_items oli
JOIN orders o ON o.id = oli.order_id
WHERE oli.store_id       = $store_id
  AND o.created_at       BETWEEN $date_from AND $date_to
  AND o.financial_status IN ('paid', 'partially_refunded')
  AND o.cancelled_at     IS NULL
  AND oli.is_markdown    = true;
```

**Thresholds:**

| Condition | Flag | Action |
|---|---|---|
| estimated_markdown_value = 0 | None | |
| > 0 | `WARN` | Show: "An estimated £X in markdown discounts are not captured in your discount codes. Your true discount dependency may be higher than shown." |

---

### 4.4 Partial Refunds — Double-Counting Risk

**Risk:** A single order can have multiple refund events (e.g. customer returns two items in separate shipments). Summing `refunds.refund_total` directly without grouping by `order_id` will double-count the order in return rate calculations.

**Check:**
```sql
SELECT
  o.id                      AS order_id,
  o.shopify_order_number,
  o.total_price,
  SUM(r.refund_total)       AS cumulative_refunded,
  COUNT(r.id)               AS refund_event_count,
  CASE
    WHEN SUM(r.refund_total) >= o.total_price THEN 'fully_refunded'
    ELSE 'partially_refunded'
  END                       AS effective_refund_status
FROM orders o
JOIN refunds r ON r.order_id = o.id AND r.store_id = o.store_id
WHERE o.store_id = $store_id
  AND o.financial_status = 'partially_refunded'
GROUP BY o.id, o.shopify_order_number, o.total_price
HAVING COUNT(r.id) > 1;
```

**Action:** This check does not produce a user-facing flag — it is an internal data integrity assertion. Alert the engineering team if `effective_refund_status = 'fully_refunded'` does not match `orders.financial_status`. Log and reconcile discrepancies automatically.

---

### 4.5 Missing Variant Cost (`cost` field)

**Risk:** `product_variants.cost` is optional in Shopify and frequently not populated. Without it, inventory value and inventory days cannot be computed (required in Phase 3). It also blocks SKU-level margin analysis.

**Check:**
```sql
SELECT
  COUNT(*) FILTER (WHERE pv.cost_populated = true)   AS variants_with_cost,
  COUNT(*) FILTER (WHERE pv.cost_populated = false)  AS variants_missing_cost,
  COUNT(*)                                            AS total_active_variants,
  ROUND(
    COUNT(*) FILTER (WHERE pv.cost_populated = true)::numeric
    / NULLIF(COUNT(*), 0) * 100, 1
  )                                                   AS cost_coverage_pct
FROM product_variants pv
JOIN products p ON p.id = pv.product_id AND p.store_id = pv.store_id
WHERE pv.store_id = $store_id
  AND p.status   = 'active';
```

**Thresholds:**

| cost_coverage_pct | Flag | Action |
|---|---|---|
| ≥ 90% | None | Inventory value is reliable |
| 70–89% | `WARN` | Show: "Cost data missing for N variants — inventory value is approximate" |
| < 70% | `ALERT` | Inventory-related metrics marked LOW confidence. Prompt merchant to complete variant costs in Shopify admin. Link to bulk edit instructions |

---

## 5. Sync Strategy Notes

These notes are design decisions for the engineering team when building the Phase 1 ingestion pipeline. No code is required now.

### 5.1 Initial Historical Backfill

On first connection, pull the full order history using Shopify's `GET /orders.json` endpoint with `status=any`, paginating with the `since_id` cursor. Process oldest-first so that `customers.first_order_at` is correctly established before repeat-rate queries run.

Recommended backfill period: 24 months (configurable). Orders older than 24 months are archived for historical charts but excluded from rolling-metric calculations by default.

### 5.2 Incremental Sync

After the backfill, maintain currency using:
- **Webhooks** for `orders/create`, `orders/updated`, `orders/cancelled`, `refunds/create`, `customers/create`, `customers/update`, `products/update` — real-time updates with < 30s latency.
- **Polling fallback** — every 15 minutes, query `GET /orders.json?updated_at_min={last_sync_at}` to catch any webhooks that were missed. Use `updated_at` as the incremental cursor.

### 5.3 Rate Limit Management

The REST API allows 2 requests/second (burst to 40). For the initial backfill of a large store (100k+ orders), use GraphQL bulk operations (`bulkOperationRunQuery`) which stream a JSONL file without rate-limit constraints.

### 5.4 Webhook Verification

All incoming webhooks must be verified using the `X-Shopify-Hmac-Sha256` header before processing. Reject unverified payloads with a `401` response.

### 5.5 Data Retention

Store raw Shopify JSON payloads in an `ingestion_events` log table for 90 days. This allows reprocessing if schema changes are made without requiring a full re-sync from Shopify. After 90 days, raw payloads can be pruned; normalised row data is kept indefinitely.

---

*Document version: 1.0 · Created: April 2026*
*Next update: When Phase 1 ingestion pipeline is scoped for development — add sequence diagrams for webhook handling and backfill job design.*
