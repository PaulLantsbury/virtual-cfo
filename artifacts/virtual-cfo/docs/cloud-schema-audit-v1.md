# Cloud Supabase Schema Audit — Phase 1
**Date:** 2026-04-29  
**Cloud project:** `futkktdebdygsdrcknpr.supabase.co` (EU North 1)  
**Reference migrations:**
- `supabase/migrations/20260429000000_phase1_shopify_tables.sql`
- `supabase/migrations/20260429000001_phase1_metric_functions.sql`

**Legend:** ✅ Matches migration · ⚠️ Present but drifted · ❌ Missing / wrong

---

## Summary

| Category | Required | Present & correct | Drifted | Missing |
|---|---|---|---|---|
| Tables | 14 | 8 | 1 (`variants`) | 5 |
| Columns (core tables) | ~100 | ~60 | ~25 | ~15 |
| Generated columns | 7 | 3 (`orders`) | 0 | 4 |
| Indexes (non-PK) | 10 | 2 | 0 | 8 |
| Unique constraints | 10 | 4 | 5 (wrong cols) | 1 |
| Foreign keys | 14 | 11 | 5 (wrong delete rule) | 3 |
| RLS enabled | per-table | 6 tables | — | 3 |
| RLS policies | ≥1 per RLS table | 1 | — | 5 |
| RPC functions | 9 | 9 | 0 | 0 |

**Bottom line:** The cloud has a pre-existing schema (~3 tables built before Phase 1) that was partially patched yesterday. The 9 RPC functions are fully deployed and callable. The metric query layer works correctly (all return 0 with no data, matching local behaviour). However, significant structural drift remains — primarily missing tables, wrong column types, missing multi-tenant uniqueness constraints, and absent query-path indexes. RLS coverage is also incomplete.

---

## 1. Tables

### 1.1 Present (9 found, 1 wrong name)

| Migration name | Cloud name | Status |
|---|---|---|
| `stores` | `stores` | ✅ |
| `store_settings` | `store_settings` | ✅ |
| `store_cost_assumptions` | `store_cost_assumptions` | ✅ |
| `customers` | `customers` | ⚠️ column drift |
| `products` | `products` | ⚠️ column drift |
| `product_variants` | `variants` | ⚠️ **wrong name** + column drift |
| `orders` | `orders` | ⚠️ column drift |
| `order_line_items` | `order_line_items` | ⚠️ column drift |
| `refunds` | `refunds` | ⚠️ column drift |

### 1.2 Missing (5 of 14)

| Migration table | Cloud | Note |
|---|---|---|
| `refund_line_items` | ❌ absent | Prevents double-count DQ check (§7.4) |
| `discounts` | ❌ absent | Shopify price rules |
| `discount_codes` | ❌ absent | Code → rule mapping |
| `opportunities` | ❌ absent | CFO opportunity engine |
| `cfo_alerts` | ❌ absent | Alert persistence |

---

## 2. Column Drift

### `customers`

| Column | Migration | Cloud | Status |
|---|---|---|---|
| `id` | `uuid NOT NULL PK` | `uuid NOT NULL PK` | ✅ |
| `store_id` | `uuid NOT NULL FK→stores` | `uuid NULLABLE FK→stores` | ⚠️ nullable |
| `shopify_customer_id` | `bigint NOT NULL` | `text NULLABLE` | ⚠️ wrong type + nullable |
| `email` | `text` | `text` | ✅ |
| `first_order_at` | `timestamptz` | `timestamptz` | ✅ |
| `total_orders` | `int NOT NULL DEFAULT 0` | `int NOT NULL DEFAULT 0` | ✅ |
| `is_guest` | `boolean NOT NULL DEFAULT false` | `boolean NOT NULL DEFAULT false` | ✅ |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | `timestamptz NULLABLE` | ⚠️ nullable, no default |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | `timestamptz NULLABLE` | ⚠️ nullable, no default |
| `first_name` | absent | `text` | ⚠️ extra col |
| `last_name` | absent | `text` | ⚠️ extra col |

### `products`

| Column | Migration | Cloud | Status |
|---|---|---|---|
| `id` | `uuid NOT NULL PK` | `uuid NOT NULL PK` | ✅ |
| `store_id` | `uuid NOT NULL FK→stores` | `uuid NULLABLE FK→stores` | ⚠️ nullable |
| `shopify_product_id` | `bigint NOT NULL` | `text NOT NULL` | ⚠️ wrong type |
| `title` | `text` | `text` | ✅ |
| `status` | `text` | `text` | ✅ |
| `created_at` | `timestamptz NOT NULL` | `timestamptz NULLABLE` | ⚠️ nullable |
| `updated_at` | `timestamptz NOT NULL` | `timestamptz NULLABLE` | ⚠️ nullable |
| `product_type` | absent | `text` | ⚠️ extra col |
| `vendor` | absent | `text` | ⚠️ extra col |

### `product_variants` (cloud: `variants`)

| Column | Migration | Cloud (`variants`) | Status |
|---|---|---|---|
| `id` | `uuid NOT NULL PK` | `uuid NOT NULL PK` | ✅ |
| `store_id` | `uuid NOT NULL FK→stores` | ❌ absent | ❌ |
| `product_id` | `uuid NOT NULL FK→products` | `uuid NULLABLE FK→products` | ⚠️ nullable + wrong delete rule |
| `shopify_variant_id` | `bigint NOT NULL` | `text NOT NULL` | ⚠️ wrong type |
| `title` | `text` | `text` | ✅ |
| `sku` | `text` | `text` | ✅ |
| `price` | `numeric(12,2) NOT NULL` | `numeric NULLABLE` | ⚠️ nullable, no precision |
| `compare_at_price` | `numeric(12,2)` | ❌ absent | ❌ |
| `cost` | `numeric(12,2)` (nullable) | ❌ absent | ❌ |
| `cost_populated` | `boolean GENERATED` | ❌ absent | ❌ |
| `inventory_quantity` | `int NOT NULL DEFAULT 0` | ❌ absent | ❌ |
| `created_at` | `timestamptz NOT NULL` | `timestamptz NULLABLE` | ⚠️ nullable |
| `updated_at` | `timestamptz NOT NULL` | `timestamptz NULLABLE` | ⚠️ nullable |

### `orders`

| Column | Migration | Cloud | Status |
|---|---|---|---|
| `id` | `uuid NOT NULL PK` | `uuid NOT NULL PK` | ✅ |
| `store_id` | `uuid NOT NULL FK→stores CASCADE` | `uuid NULLABLE FK→stores CASCADE` | ⚠️ nullable |
| `shopify_order_id` | `bigint NOT NULL` | `text NOT NULL` | ⚠️ wrong type |
| `customer_id` | `uuid → customers SET NULL` | `uuid → customers NO ACTION` | ⚠️ wrong delete rule |
| `created_at` | `timestamptz NOT NULL` | `timestamptz NULLABLE` | ⚠️ nullable |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | `timestamptz NOT NULL DEFAULT now()` | ✅ |
| `financial_status` | `text NOT NULL` | `text NOT NULL DEFAULT 'paid'` | ✅ (extra default OK) |
| `gross_sales` | `numeric(14,2) NOT NULL DEFAULT 0` | `numeric NULLABLE` | ⚠️ nullable, no precision, no default |
| `discounts` | `numeric(14,2) NOT NULL DEFAULT 0` | `numeric NULLABLE` | ⚠️ same |
| `refunds` | `numeric(14,2) NOT NULL DEFAULT 0` | `numeric NULLABLE` | ⚠️ same |
| `tax` | `numeric(14,2) NOT NULL DEFAULT 0` | `numeric NULLABLE` | ⚠️ same |
| `total_sales` | `numeric(14,2) NOT NULL DEFAULT 0` | `numeric NULLABLE` | ⚠️ same |
| `discount_codes` | `jsonb` | `jsonb` | ✅ |
| `is_guest_checkout` | `boolean GENERATED (customer_id IS NULL)` | ✅ GENERATED | ✅ |
| `has_discount` | `boolean GENERATED (discounts > 0)` | ✅ GENERATED | ✅ |
| `is_cancelled` | `boolean GENERATED (financial_status = 'cancelled')` | ✅ GENERATED | ✅ |
| `order_number` | absent | `text` | ⚠️ extra col |
| `order_date` | absent | `timestamptz` | ⚠️ extra col (overlaps `created_at`) |
| `currency` | absent | `text` | ⚠️ extra col |
| `net_sales` | absent (computed by function) | `numeric` | ⚠️ extra col (pre-computed denorm) |
| `shipping` | absent | `numeric` | ⚠️ extra col |

### `order_line_items`

| Column | Migration | Cloud | Status |
|---|---|---|---|
| `id` | `uuid NOT NULL PK` | `uuid NOT NULL PK` | ✅ |
| `store_id` | `uuid NOT NULL FK→stores CASCADE` | ❌ absent | ❌ |
| `order_id` | `uuid NOT NULL FK→orders CASCADE` | `uuid NULLABLE FK→orders NO ACTION` | ⚠️ nullable + wrong delete |
| `product_id` | `uuid FK→products SET NULL` | `uuid FK→products NO ACTION` | ⚠️ wrong delete rule |
| `variant_id` | `uuid FK→product_variants SET NULL` | `uuid FK→variants NO ACTION` | ⚠️ wrong table + delete rule |
| `shopify_line_item_id` | `bigint NOT NULL` | `text NULLABLE` | ⚠️ wrong type + nullable |
| `title` | `text` | ❌ absent | ❌ |
| `quantity` | `int NOT NULL` | `int NULLABLE` | ⚠️ nullable |
| `price` | `numeric(12,2) NOT NULL` | `numeric NULLABLE` | ⚠️ nullable, no precision |
| `compare_at_price` | `numeric(12,2)` | ❌ absent | ❌ |
| `total_discount` | `numeric(12,2) NOT NULL DEFAULT 0` | `discount numeric` | ⚠️ wrong name, nullable |
| `gross_line_total` | `numeric(14,2) GENERATED (price * quantity)` | ❌ absent | ❌ |
| `is_markdown` | `boolean GENERATED` | ❌ absent | ❌ |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | ❌ absent | ❌ |
| `total` | absent | `numeric` | ⚠️ extra col |

### `refunds`

| Column | Migration | Cloud | Status |
|---|---|---|---|
| `id` | `uuid NOT NULL PK` | `uuid NOT NULL PK` | ✅ |
| `store_id` | `uuid NOT NULL FK→stores CASCADE` | ❌ absent | ❌ |
| `order_id` | `uuid NOT NULL FK→orders CASCADE` | `uuid NULLABLE FK→orders NO ACTION` | ⚠️ nullable + wrong delete |
| `shopify_refund_id` | `bigint NOT NULL` | `text NULLABLE` | ⚠️ wrong type + nullable |
| `refund_subtotal` | `numeric(14,2) NOT NULL DEFAULT 0` | `amount numeric` | ⚠️ wrong name, nullable |
| `created_at` | `timestamptz NOT NULL` | `refund_date timestamptz` | ⚠️ wrong name |
| `reason` | absent | `text` | ⚠️ extra col |

---

## 3. Indexes

### Present ✅
| Index | Table | Columns |
|---|---|---|
| `uq_stores_shopify_domain` | `stores` | `(shopify_domain)` |
| `uq_stores_shopify_store_id` | `stores` | `(shopify_store_id)` |
| `uq_store_settings_store` | `store_settings` | `(store_id)` |
| `uq_store_cost_assumptions_store_date` | `store_cost_assumptions` | `(store_id, effective_from)` |

### Missing ❌ (8 indexes from migration not present)
| Index | Table | Columns | Purpose |
|---|---|---|---|
| `idx_customers_store_first_order` | `customers` | `(store_id, first_order_at)` | repeat_purchase_rate query |
| `idx_products_store_status` | `products` | `(store_id, status)` | product filtering |
| `idx_orders_store_created` | `orders` | `(store_id, created_at)` | date-range metric queries |
| `idx_orders_store_financial_status` | `orders` | `(store_id, financial_status)` | cancellation filter |
| `idx_orders_store_updated` | `orders` | `(store_id, updated_at)` | incremental sync |
| `idx_order_line_items_order` | `order_line_items` | `(store_id, order_id)` | line item lookups |
| `idx_refunds_store_order` | `refunds` | `(store_id, order_id)` | refund joins |
| `idx_refunds_store_created` | `refunds` | `(store_id, created_at)` | date-range refund queries |

---

## 4. Unique Constraints

| Constraint | Migration columns | Cloud columns | Status |
|---|---|---|---|
| `uq_stores_shopify_domain` | `(shopify_domain)` | `(shopify_domain)` | ✅ |
| `uq_stores_shopify_store_id` | `(shopify_store_id)` | `(shopify_store_id)` | ✅ |
| `uq_store_settings_store` | `(store_id)` | `(store_id)` | ✅ |
| `uq_store_cost_assumptions_store_date` | `(store_id, effective_from)` | `(store_id, effective_from)` | ✅ |
| `uq_customers_store_shopify` | `(store_id, shopify_customer_id)` | `(shopify_customer_id)` only | ⚠️ missing `store_id` — wrong for multi-tenant |
| `uq_orders_store_shopify` | `(store_id, shopify_order_id)` | `(shopify_order_id)` only | ⚠️ same |
| `uq_products_store_shopify` | `(store_id, shopify_product_id)` | `(shopify_product_id)` only | ⚠️ same |
| `uq_product_variants_store_shopify` | `(store_id, shopify_variant_id)` | `(shopify_variant_id)` only on `variants` | ⚠️ wrong table + missing `store_id` |
| `uq_order_line_items_store_shopify` | `(store_id, shopify_line_item_id)` | `(shopify_line_item_id)` only | ⚠️ missing `store_id` |
| `uq_refunds_store_shopify` | `(store_id, shopify_refund_id)` | `(shopify_refund_id)` only | ⚠️ missing `store_id` |

**Risk:** The current single-column uniques would allow two different stores to both ingest the same Shopify order ID, which would not be caught. Multi-tenant uniqueness only works with `(store_id, shopify_*_id)`.

---

## 5. Foreign Keys

### Present ✅
| Table | Column | → | Delete rule |
|---|---|---|---|
| `customers` | `store_id` | `stores.id` | CASCADE ✅ |
| `orders` | `store_id` | `stores.id` | CASCADE ✅ |
| `products` | `store_id` | `stores.id` | CASCADE ✅ |
| `store_settings` | `store_id` | `stores.id` | CASCADE ✅ |
| `store_cost_assumptions` | `store_id` | `stores.id` | CASCADE ✅ |

### Wrong delete rule ⚠️
| Table | Column | → | Cloud rule | Migration rule |
|---|---|---|---|---|
| `orders` | `customer_id` | `customers.id` | NO ACTION | SET NULL |
| `order_line_items` | `order_id` | `orders.id` | NO ACTION | CASCADE |
| `order_line_items` | `product_id` | `products.id` | NO ACTION | SET NULL |
| `order_line_items` | `variant_id` | `variants.id` | NO ACTION | SET NULL (wrong table too) |
| `refunds` | `order_id` | `orders.id` | NO ACTION | CASCADE |
| `variants` | `product_id` | `products.id` | NO ACTION | CASCADE |

### Missing entirely ❌
- `order_line_items.store_id → stores.id`
- `refunds.store_id → stores.id`
- All FKs on the 5 missing tables

---

## 6. Row Level Security

| Table | RLS enabled | Policies | Status |
|---|---|---|---|
| `stores` | ❌ off | none | ⚠️ expected OFF (root table, service-layer only) |
| `store_settings` | ❌ off | none | ⚠️ see note |
| `store_cost_assumptions` | ❌ off | none | ⚠️ see note |
| `customers` | ✅ on | none | ❌ enabled but no policies → anon reads 0 rows |
| `products` | ✅ on | none | ❌ same |
| `variants` | ✅ on | none | ❌ same |
| `orders` | ✅ on | **1 policy** `Allow temporary read access to orders` (anon, SELECT, `USING true`) | ⚠️ functional but open |
| `order_line_items` | ✅ on | none | ❌ enabled but no policies |
| `refunds` | ✅ on | none | ❌ enabled but no policies |

**Critical note:** Because the 9 RPC functions are `SECURITY INVOKER`, they run as the calling role (`anon` from the browser). If RLS is enabled on `customers`, `products`, etc. with no permissive policies, those tables return 0 rows to the anon caller — which means `repeat_purchase_rate` will always return 0 even with real data, because the `customers` JOIN returns nothing.

`orders` has a temporary open policy (`USING true`) which is why the numeric functions currently work. The other tables need matching policies before their data is visible through RPC calls.

The migration files do not define any RLS or policies — this area needs a follow-on migration.

---

## 7. RPC Functions

All 9 functions are present and correct.

| Function | Signature | Return type | Volatility | search_path | Status |
|---|---|---|---|---|---|
| `gross_revenue` | `(uuid, date, date)` | `numeric` | STABLE | `public, pg_temp` | ✅ |
| `discount_cost` | `(uuid, date, date)` | `numeric` | STABLE | `public, pg_temp` | ✅ |
| `return_amount` | `(uuid, date, date)` | `numeric` | STABLE | `public, pg_temp` | ✅ |
| `net_sales` | `(uuid, date, date)` | `numeric` | STABLE | `public, pg_temp` | ✅ |
| `order_count` | `(uuid, date, date)` | `bigint` | STABLE | `public, pg_temp` | ✅ |
| `average_order_value` | `(uuid, date, date)` | `numeric` | STABLE | `public, pg_temp` | ✅ |
| `repeat_purchase_rate` | `(uuid, date, date)` | `numeric` | STABLE | `public, pg_temp` | ✅ |
| `discount_dependency` | `(uuid, date, date)` | `numeric` | STABLE | `public, pg_temp` | ✅ |
| `refund_rate` | `(uuid, date, date)` | `numeric` | STABLE | `public, pg_temp` | ✅ |

---

## 8. Function Outputs — Zero-Row Baseline

Called with `store_id = '10000000-0000-0000-0000-000000000001'`, `2026-04-01` → `2026-04-30` (no order data in cloud).

| Function | Cloud result | Expected (no rows) | Match |
|---|---|---|---|
| `gross_revenue` | `0` | `0` | ✅ |
| `discount_cost` | `0` | `0` | ✅ |
| `return_amount` | `0` | `0` | ✅ |
| `net_sales` | `0` | `0` | ✅ |
| `order_count` | `0` | `0` | ✅ |
| `average_order_value` | `0` | `0` | ✅ |
| `repeat_purchase_rate` | `0` | `0` | ✅ |
| `discount_dependency` | `0` | `0` | ✅ |
| `refund_rate` | `0` | `0` | ✅ |

All functions match local behaviour for the zero-row case. ✅

---

## Drift Summary by Priority

### P0 — Blocks metric data appearing in production
1. **RLS: no policies on `customers`, `order_line_items`, `refunds`** — `repeat_purchase_rate` will return 0 even with real data because the customers JOIN returns nothing to the anon role. Needs a migration adding permissive read policies or converting functions to SECURITY DEFINER.
2. **`orders.store_id` is nullable** — a single NOT NULL constraint failure during ingest would silently route rows without a store, making all metric functions return 0 for the actual store.

### P1 — Causes ingest failure / data corruption
3. **5 tables missing** — `refund_line_items`, `discounts`, `discount_codes`, `opportunities`, `cfo_alerts`
4. **`product_variants` named `variants`** — FK references from `order_line_items.variant_id` point to `variants`, not `product_variants`
5. **Multi-tenant unique constraints missing `store_id`** — all 5 tenant-scoped uniques are single-column; cross-store collisions are possible
6. **Wrong column types (`bigint` → `text`)** — `shopify_order_id`, `shopify_customer_id`, `shopify_product_id`, `shopify_variant_id`, `shopify_refund_id`, `shopify_line_item_id` — numeric comparisons and range queries will fail or silently miscompare

### P2 — Query performance / correctness degradation
7. **8 indexes missing** — all multi-column `(store_id, *)` query-path indexes absent; metric functions will do full table scans
8. **Wrong FK delete rules** — `CASCADE` should propagate deletes from orders → line items and refunds; `NO ACTION` will block deletes
9. **Nullable columns that should be NOT NULL** — `orders.gross_sales/discounts/refunds/tax`, `customers.created_at`, etc.

### P3 — Schema cleanliness
10. **Extra columns on `orders`** — `order_number`, `order_date`, `currency`, `net_sales` (denormalised), `shipping` not in migration
11. **Extra columns on `customers`** — `first_name`, `last_name`
12. **Extra columns on `products`** — `product_type`, `vendor`
13. **`order_line_items.discount`** should be `total_discount`; **`order_line_items.total`** is not in migration
14. **`refunds.amount`** should be `refund_subtotal`; **`refunds.refund_date`** should be `created_at`
