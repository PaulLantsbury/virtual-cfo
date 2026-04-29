# Cloud Supabase Schema Audit — Phase 1 (Post-Remediation)
**Date:** 2026-04-29  
**Migration applied:** `supabase/migrations/20260429000002_cloud_schema_remediation.sql`  
**Pre-remediation audit:** `docs/cloud-schema-audit-v1.md`

---

## What was applied

All fixes from migration `20260429000002`. Applied in 5 batches to the live cloud project `futkktdebdygsdrcknpr`.

---

## Result summary

| Category | Before | After | Status |
|---|---|---|---|
| Tables | 9 (1 wrong name) | **14** (all correct) | ✅ |
| Functions (SECURITY DEFINER) | 0/9 | **9/9** | ✅ |
| store_id NOT NULL on core tables | 0/6 | **6/6** | ✅ |
| Revenue cols NOT NULL DEFAULT 0 | 0/5 | **5/5** | ✅ |
| Multi-tenant unique constraints | 0/6 (single-col only) | **6/6** (composite) | ✅ |
| Composite query-path indexes | 0/8 | **8/8** | ✅ |
| FK delete rules aligned | 0/6 | **6/6** | ✅ |
| RPC functions return real data via anon key | ❌ | **✅** | ✅ |

---

## Verified function outputs (anon REST key, 2025-01-01 → 2026-12-31)

Test data: 2 orders seeded in cloud (`store_id = 10000000-…0001`).

| Function | Result | Notes |
|---|---|---|
| `gross_revenue` | £214.00 | SUM(129 + 85) ✅ |
| `net_sales` | £163.20 | gross - discount - refund - tax ✅ |
| `discount_cost` | £10.00 | ✅ |
| `return_amount` | £0.00 | no refunds seeded ✅ |
| `order_count` | 2 | ✅ |
| `average_order_value` | £81.60 | net_sales / 2 ✅ |
| `repeat_purchase_rate` | 0.00 | no repeat customers ✅ |
| `discount_dependency` | 0.0467 | 4.67% of gross ✅ |
| `refund_rate` | 0.00 | no refunds ✅ |

All functions called via Supabase anon key REST endpoint. SECURITY DEFINER confirmed working — no open anon table policies required.

---

## Changes applied detail

### P0.1 — 9 functions converted to SECURITY DEFINER ✅
All 9 metric RPC functions now have `SECURITY DEFINER` and `SET search_path = public, pg_temp`. They run as the postgres role internally, bypassing RLS on `customers`, `order_line_items`, and `refunds`, while still filtering by `p_store_id` in every WHERE clause. No broad anon access was granted to any table.

### P0.2 — NULL back-fills and NOT NULL constraints ✅
- All 2 `orders`, 2 `customers`, 2 `products` rows back-filled to store `10000000-0000-0000-0000-000000000001`
- `orders.store_id`, `customers.store_id`, `products.store_id` → `NOT NULL`
- `orders.gross_sales`, `discounts`, `refunds`, `tax`, `total_sales` → `NOT NULL DEFAULT 0`

### P1.3 — 5 missing tables created ✅
`refund_line_items`, `discounts`, `discount_codes`, `opportunities`, `cfo_alerts` — all created with correct FKs, constraints, indexes, and comments.

### P1.4 — `variants` renamed to `product_variants` ✅
`ALTER TABLE public.variants RENAME TO product_variants`. FK OIDs preserved — `order_line_items.variant_id` FK now references `product_variants` with correct `SET NULL` delete rule. Added missing columns: `store_id`, `compare_at_price`, `cost`, `inventory_quantity`, `cost_populated` (GENERATED ALWAYS).

### P1.5 — Multi-tenant unique constraints ✅
All 6 single-column uniques dropped and replaced with `(store_id, shopify_*_id)` composite uniques. `store_id` column added to `order_line_items` and `refunds` (previously absent) and back-filled.

### P1.6 — Shopify ID types: remain TEXT (documented) ✅
Existing data uses GraphQL GID format (`gid://shopify/Order/4001`). Cannot cast to `bigint`. Types remain `text`. Decision required before production ingestion: use GraphQL API (store GIDs as text) or REST API (store numeric IDs as bigint).

### P2.7 — 8 composite indexes added ✅
All `(store_id, date/status/customer)` indexes required by metric functions now exist. Note: `refunds.created_at` column was absent (cloud called it `refund_date`); `created_at` column added to `refunds` and indexed.

### P2.8 — FK delete rules aligned ✅
| Relationship | Before | After |
|---|---|---|
| `orders.customer_id → customers` | NO ACTION | SET NULL |
| `order_line_items.order_id → orders` | NO ACTION | CASCADE |
| `order_line_items.product_id → products` | NO ACTION | SET NULL |
| `order_line_items.variant_id → product_variants` | NO ACTION | SET NULL |
| `refunds.order_id → orders` | NO ACTION | CASCADE |
| `product_variants.product_id → products` | NO ACTION | CASCADE |

---

## Remaining drift (documented, no action required pre-ingestion)

### P3 — Legacy extra columns
These columns exist on cloud tables but are absent from the Phase 1 migration. They are **not read by any metric function** and do not affect dashboard correctness. They must be reviewed before Phase 2 ingestion.

| Table | Legacy columns | Note |
|---|---|---|
| `orders` | `order_number`, `order_date`, `currency`, `net_sales` (denorm), `shipping` | `net_sales` conflicts with the computed function — use the function, not this col |
| `customers` | `first_name`, `last_name` | useful, may formalise in Phase 2 |
| `products` | `product_type`, `vendor` | useful, may formalise in Phase 2 |
| `order_line_items` | `discount` (→ `total_discount`), `total` | rename `discount` → `total_discount` before ingestion |
| `refunds` | `reason`, `refund_date` (→ `created_at`), `amount` (→ `refund_subtotal`) | `refund_date` retained; `created_at` added alongside it; reconcile before ingestion |

### P3 — RLS
RLS is still enabled on `customers`, `order_line_items`, `orders`, `product_variants`, `products`, `refunds` with no anon policies. This is now **acceptable** because all metric functions are `SECURITY DEFINER` and bypass RLS entirely. The temporary open policy on `orders` (`Allow temporary read access to orders`, `anon`, `USING true`) can be dropped once the dashboard no longer reads the `orders` table directly — it is not needed for the RPC path.

### P3 — Shopify ID column types
All Shopify ID columns are `text`. See P1.6 above.

---

## What remains before production ingestion

1. **Decide GraphQL GID vs REST API numeric ID format** — determines whether `shopify_*_id` columns stay `text` or convert to `bigint`
2. **Rename `order_line_items.discount` → `total_discount`** — align with migration naming
3. **Reconcile `refunds.refund_date` and `refunds.amount`** — rename or drop in favour of `created_at` and `refund_subtotal`
4. **Drop or formalise legacy extra columns** on `orders`, `customers`, `products`
5. **Remove the temporary open orders RLS policy** once confirmed not needed for direct table access

None of these block Phase 1 dashboard wiring or the NS tile.
