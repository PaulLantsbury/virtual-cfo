# Supabase Cloud Schema Authority — Phase 1

## Cloud project details

| Property | Value |
|---|---|
| **Project ID** | `futkktdebdygsdrcknpr` |
| **Region** | `eu-north-1` (Stockholm) |
| **Dev store UUID** | `10000000-0000-0000-0000-000000000001` |
| **Dev store name** | Bloom & Co. (`bloom-and-co.myshopify.com`) |

---

## Source of truth

**The cloud Supabase schema is the authoritative source of truth for Phase 1.**

All table definitions, column names, data types, and RPC function signatures must be inferred from the cloud state — not from the original `seed.sql` file, and not from the Phase 1 table migration (`20260429000000`) alone. Several Phase 1 tables existed in the cloud before the migrations were applied. Because those `CREATE TABLE IF NOT EXISTS` statements were silently skipped, the pre-existing cloud column names take precedence in those tables. The seed migration (`20260429000004`) was written to match the actual cloud column names, not the migration-ideal names, and is therefore the authoritative record of the current cloud schema for those tables.

**When in doubt, treat the seed migration as a living schema reference.** It was written to insert against the real cloud schema and has been tested to pass.

### Migration history

| File | Purpose |
|---|---|
| `20260429000000_phase1_shopify_tables.sql` | Defines the full Phase 1 target schema. Applied via `CREATE TABLE IF NOT EXISTS`. Pre-existing tables were skipped; see drift section below. |
| `20260429000001_phase1_metric_functions.sql` | Creates 9 Phase 1 RPC functions as SECURITY INVOKER. |
| `20260429000002_cloud_schema_remediation.sql` | Converts all 9 RPCs to SECURITY DEFINER; adds missing tables; fixes multi-tenant unique constraints; adds composite indexes; adds `created_at` to `refunds`. |
| `20260429000003_contribution_margin_pct.sql` | Creates `v_current_cost_assumptions` view and `contribution_margin_pct()` RPC. Seeds dev store cost assumptions. |
| `20260429000004_cloud_seed.sql` | Seeds the 108-order "Bloom & Co." Phase 1 test dataset. Written against the actual cloud column names — authoritative for drift items. |
| `20260429000005_recoverable_contribution_range.sql` | Creates `recoverable_contribution_range()` RPC. |

---

## Phase 1 tables

All tables live in the `public` schema. All monetary columns are `numeric(14,2)`. All rate/ratio columns are `numeric(8,5)`. All PKs are UUID using `gen_random_uuid()`. All tenant rows carry `store_id NOT NULL REFERENCES stores(id)`.

### Core tables (creation order matches FK dependency)

| # | Table | Primary role |
|---|---|---|
| 1 | `stores` | Root tenant table. One row per connected Shopify merchant. |
| 2 | `store_settings` | Per-store alert thresholds and feature flags. One row per store. |
| 3 | `store_cost_assumptions` | Versioned variable cost rates used by `contribution_margin_pct()`. |
| 4 | `customers` | One row per Shopify customer. `first_order_at` drives repeat-rate classification. |
| 5 | `products` | One row per Shopify product. |
| 6 | `product_variants` | One row per Shopify variant. `cost` is expected NULL at Phase 1. |
| 7 | `orders` | Central revenue fact table. Feeds all 8 Supabase-backed KPI tiles. |
| 8 | `order_line_items` | One row per line item. See drift notes for actual cloud columns. |
| 9 | `refunds` | One row per Shopify refund event. See drift notes for actual cloud columns. |
| 10 | `refund_line_items` | Line-item detail within a refund. Prevents double-counting. |
| 11 | `discounts` | One row per Shopify price rule (parent of discount codes). |
| 12 | `discount_codes` | One row per Shopify discount code. `code` is lowercase-normalised at ingest. |
| 13 | `opportunities` | CFO-identified improvement opportunities. Feeds `recoverable_contribution_range()`. |
| 14 | `cfo_alerts` | Persisted alert events for the CFO Alerts sidebar. |

### Key column details — `orders`

The `orders` table is the foundation of all Phase 1 metric functions. Its column names are used directly in every SQL query.

| Column | Type | Notes |
|---|---|---|
| `gross_sales` | `numeric(14,2)` | Pre-discount revenue. Feeds `gross_revenue()`. |
| `discounts` | `numeric(14,2)` | Total discount value on the order. Feeds `discount_dependency()`. |
| `refunds` | `numeric(14,2)` | Total refund value on the order (pre-aggregated). Feeds `refund_rate()` and `return_amount()`. |
| `tax` | `numeric(14,2)` | Tax amount. Deducted from gross to compute `net_sales()`. |
| `total_sales` | `numeric(14,2)` | Shopify `total_price`. Feeds `commerceMetrics.totalRevenue` (Tier 2 fallback for `mr` tile). |
| `financial_status` | `text` | `'paid' \| 'refunded' \| 'partially_refunded' \| 'cancelled'`. Cancelled orders excluded from all metric queries. |
| `customer_id` | `uuid` (nullable) | NULL for guest checkouts. Drives `is_guest_checkout` generated column. |
| `is_guest_checkout` | `boolean GENERATED` | `customer_id IS NULL`. Guests excluded from `repeat_purchase_rate()`. |
| `has_discount` | `boolean GENERATED` | `discounts > 0`. Value-based. Aligns with discount_dependency_ratio definition. |
| `is_cancelled` | `boolean GENERATED` | `financial_status = 'cancelled'`. Index-friendly. |

### Key column details — `order_line_items` (cloud-actual)

> See the legacy drift section and the "Do not reintroduce" warning below.
> The actual cloud column names differ from migration `20260429000000`.

| Column | Type | Notes |
|---|---|---|
| `shopify_line_item_id` | `text` | GID-format string — matches Shopify GraphQL API. |
| `price` | `numeric(12,2)` | Unit selling price. |
| `discount` | `numeric(12,2)` | Line-level discount value. **Cloud name.** The migration-file name (`total_discount`) does not exist in cloud. |
| `total` | `numeric(12,2)` | `price − discount` (computed at ingest). **Cloud name.** Not a PostgreSQL generated column. |
| `quantity` | `int` | Line item quantity. |
| `gross_line_total` | *see note* | `price × quantity`. Defined as a GENERATED column in `20260429000000` but that migration was skipped; may not exist in cloud. Do not rely on it without verifying. |

### Key column details — `refunds` (cloud-actual)

> See the legacy drift section and the "Do not reintroduce" warning below.

| Column | Type | Notes |
|---|---|---|
| `amount` | `numeric(14,2)` (nullable) | Refund value. **Cloud name.** The migration-file name (`refund_subtotal`) does not exist in cloud. |
| `refund_date` | `timestamptz` (nullable) | Legacy cloud column. Retained; do not drop without a data audit. |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Added by migration `20260429000002`. Use this column for `created_at`-based queries. |

### Key column details — `opportunities` (cloud-actual)

| Column | Type | Notes |
|---|---|---|
| `impact_low` | `numeric(14,2)` | Lower bound of monthly £ opportunity. **Cloud name.** |
| `impact_high` | `numeric(14,2)` | Upper bound of monthly £ opportunity. **Cloud name.** |
| `priority` | `int NOT NULL DEFAULT 0` | Ordering field. **Cloud name.** |
| `status` | `text NOT NULL DEFAULT 'open'` | `'open' \| 'actioned' \| 'dismissed' \| 'archived'`. Archived rows are excluded from `recoverable_contribution_range()`. |

### Key column details — `cfo_alerts` (cloud-actual)

| Column | Type | Notes |
|---|---|---|
| `alert_type` | `text NOT NULL` | Alert classifier, e.g. `'low_runway'`, `'high_discount_dep'`. **Cloud name.** |
| `title` | `text NOT NULL` | Alert headline. NOT NULL — must be supplied on INSERT. |
| `severity` | `text NOT NULL DEFAULT 'warning'` | `'info' \| 'warning' \| 'critical'`. |
| `body` | `text` (nullable) | Optional longer description. |
| `is_read` | `boolean NOT NULL DEFAULT false` | Read/unread state. |

---

## Phase 1 RPC functions

All functions live in the `public` schema. All are `STABLE SECURITY DEFINER SET search_path = public, pg_temp`.

Functions that accept a date range use inclusive ISO date strings for both bounds:
- `p_date_from` = first day of period (e.g. `'2026-04-01'`)
- `p_date_to` = last day of period (e.g. `'2026-04-30'`)

### Date-range functions (take `p_store_id`, `p_date_from`, `p_date_to`)

| Function | Returns | Canonical metric | Dashboard tile |
|---|---|---|---|
| `gross_revenue(uuid, date, date)` | `numeric` | `monthly_revenue` | `mr` |
| `discount_cost(uuid, date, date)` | `numeric` | *(feeds discount_dependency numerator — no direct tile)* | internal |
| `return_amount(uuid, date, date)` | `numeric` | *(feeds refund_rate numerator and cm cost model — no direct tile)* | internal |
| `net_sales(uuid, date, date)` | `numeric` | `net_sales` | `ns` |
| `order_count(uuid, date, date)` | `bigint` | *(feeds aov denominator — no direct tile)* | internal |
| `average_order_value(uuid, date, date)` | `numeric` | `average_order_value` | `aov` |
| `repeat_purchase_rate(uuid, date, date)` | `numeric [0,1]` | `repeat_purchase_rate` | `rpr` |
| `discount_dependency(uuid, date, date)` | `numeric [0,1]` | `discount_dependency_ratio` | `dd` |
| `refund_rate(uuid, date, date)` | `numeric [0,1]` | `refund_rate_pct` | `rr` |
| `contribution_margin_pct(uuid, date, date)` | `numeric [0,1] \| NULL` | `contribution_margin_pct` | `cm` |

### Store-level functions (take `p_store_id` only — no date range)

| Function | Returns | Canonical metric | Dashboard tile |
|---|---|---|---|
| `recoverable_contribution_range(uuid)` | `TABLE(recoverable_low numeric, recoverable_high numeric)` | `recoverable_contribution_range` | `rc` |

### Function behaviour notes

- All ratio-returning functions return values in the range `[0, 1]`. Multiply by 100 for percentage display.
- `contribution_margin_pct()` returns `NULL` when no `store_cost_assumptions` row exists for the store (not configured). Callers must treat `NULL` as "not configured" and fall back to `commerceMetrics`. A return of `0` means net_sales was zero in the period — a distinct state from NULL.
- `recoverable_contribution_range()` returns `(0, 0)` (not NULL) when no non-archived opportunities exist for the store.
- `order_count()` excludes both `'cancelled'` AND `'refunded'` orders from the count. All other date-range functions only exclude `'cancelled'`.
- All nine date-range functions are called in parallel by `getPhase1Metrics()` in `src/lib/analytics/phase1Metrics.ts`.

---

## Phase 1 views

| View | Schema | Purpose |
|---|---|---|
| `v_current_cost_assumptions` | `public` | Returns the most recent `store_cost_assumptions` row per store where `effective_from <= CURRENT_DATE`. Used by `contribution_margin_pct()`. Created by migration `20260429000003`. |

---

## Legacy seed.sql drift — items to ignore

The table below records where the actual cloud schema diverges from migration `20260429000000` (the Phase 1 table creation migration). The divergence arose because those tables already existed in the cloud when the `CREATE TABLE IF NOT EXISTS` migration ran, so the migration body was silently skipped for pre-existing tables.

The cloud-seed migration (`20260429000004`) records these divergences in its header block. They are reproduced here for reference.

| Table | Migration `000000` column | Actual cloud column | Action |
|---|---|---|---|
| `order_line_items` | `total_discount` | `discount` | Use `discount`; `total_discount` does not exist in cloud |
| `order_line_items` | `title` (present) | *(absent)* | Do not query; column does not exist in cloud |
| `order_line_items` | `compare_at_price` (present) | *(absent in base table; see note)* | Silent markdown detection may not be available |
| `refunds` | `refund_subtotal` | `amount` | Use `amount`; `refund_subtotal` does not exist in cloud |
| `refunds` | `created_at` (as primary timestamp) | `refund_date` (legacy) + `created_at` (added by `000002`) | Use `created_at` for index-based queries; `refund_date` is retained but legacy |
| `opportunities` | `uplift_low` | `impact_low` | Use `impact_low` |
| `opportunities` | `uplift_high` | `impact_high` | Use `impact_high` |
| `opportunities` | `priority_rank` | `priority` | Use `priority` |
| `opportunities` | `action_label`, `why_label` | *(absent)* | Columns do not exist in cloud; do not add without a migration |
| `cfo_alerts` | `alert_key` | `alert_type` | Use `alert_type` |
| `cfo_alerts` | `is_triggered` | *(absent)* | Column does not exist in cloud |
| `cfo_alerts` | `title` (nullable) | `title NOT NULL` | Always supply a title value on INSERT |

**The old seed.sql file should not be used as a column-name reference.** It predates the cloud schema audit and contains many of the legacy column names listed above. Future work must reference the cloud-seed migration (`20260429000004`) or the production schema directly.

---

## Future migration rules

All schema changes from Phase 2 onwards must follow these rules:

1. **Target the cloud schema, not migration `20260429000000`.** When adding columns or constraints to `order_line_items`, `refunds`, `opportunities`, or `cfo_alerts`, use the actual cloud column names listed above.

2. **Verify before assuming.** Before referencing any column from those four tables in a new RPC or query, confirm the column name against the cloud schema in the Supabase dashboard (project `futkktdebdygsdrcknpr`) or the seed migration (`20260429000004`).

3. **All new migrations are numbered sequentially** after `20260429000005`. Use the format `YYYYMMDDNNNNNN_description.sql`.

4. **Never DROP or RENAME existing columns without a data audit.** The `refunds.refund_date` column is explicitly retained for this reason. Any removal must be a separate P3 migration with a documented audit.

5. **Every new RPC must be `SECURITY DEFINER SET search_path = public, pg_temp`** and qualify all table references with the `public.` schema prefix. This pattern is established by migration `20260429000002` and must not be relaxed.

6. **Shopify ID columns must remain `text`.** All `shopify_*_id` columns were audited in migration `20260429000002` §P1.6 and confirmed to contain GraphQL Global IDs (`gid://shopify/...`). These are not castable to `bigint`. Do not change them.

7. **Do not add the old seed.sql file back** as a migration source. It is an artefact of pre-cloud development and is structurally inconsistent with the live schema.

---

## Do not reintroduce legacy columns

The following columns appeared in the original `seed.sql` or the `20260429000000` migration but **do not exist in the cloud schema**. They must never be added back to existing tables or referenced in new SQL without a deliberate, reviewed migration that reconciles the naming with the cloud-actual columns.

### `order_line_items.title`

- **Why it does not exist:** The cloud `order_line_items` table predates migration `20260429000000`. The `CREATE TABLE IF NOT EXISTS` skipped it entirely, including the `title` column.
- **Risk if reintroduced:** Any query that adds `title` to existing rows will silently add a nullable column that cannot be back-filled from current data. Queries expecting `title` from the Shopify ingestion layer will return NULL for all historical rows.
- **Correct approach:** If product-name display is needed at the line-item level, join to `product_variants.title` or `products.title` via the existing FKs.

### `order_line_items.compare_at_price`

- **Why it does not exist:** Same skip as `title` — absent from the pre-existing cloud table.
- **Risk if reintroduced:** The `is_markdown` generated column (defined in migration `20260429000000`) depends on `compare_at_price`. Neither column exists in the cloud. Adding one without the other will create a broken generated-column definition.
- **Correct approach:** If silent markdown detection is required, add both `compare_at_price` and the `is_markdown` generated column in a single migration after verifying the cloud table's current column list.

### `order_line_items.total_discount`

- **Why it does not exist:** The cloud column is named `discount`. The migration-file name `total_discount` was never applied.
- **Risk if reintroduced:** Adding a column named `total_discount` would create a second discount column alongside the existing `discount`. Any query or ingestion job using `total_discount` would write to one column while read queries on `discount` see different data.
- **Correct approach:** Always use `discount`. Never add `total_discount`.

### `refunds.refund_subtotal`

- **Why it does not exist:** The cloud column is named `amount`. The migration `20260429000004` explicitly documents this mapping (`refund_subtotal → amount`).
- **Risk if reintroduced:** Adding `refund_subtotal` alongside `amount` would create dual-source ambiguity. The `return_amount()` RPC reads `orders.refunds` (a pre-aggregated column on the orders table), not the `refunds.amount` column directly — but future RPCs that read the `refunds` table directly must use `amount`.
- **Correct approach:** Always use `amount` for the refund value column on the `refunds` table.

### `opportunities.uplift_low` / `opportunities.uplift_high`

- **Why they do not exist:** The cloud schema uses `impact_low` / `impact_high`. Migration `20260429000002` created the `opportunities` table fresh (it did not pre-exist), using `impact_low` / `impact_high`.
- **Risk if reintroduced:** The `recoverable_contribution_range()` RPC explicitly queries `SUM(impact_low)` and `SUM(impact_high)`. Adding `uplift_low` / `uplift_high` as aliases or additional columns would create a naming inconsistency between the RPC, the seed data, and the frontend constants `RECOVERABLE_LOW` / `RECOVERABLE_HIGH`.
- **Correct approach:** Always use `impact_low` / `impact_high`. Never use `uplift_low` / `uplift_high`.

### `cfo_alerts.alert_key`

- **Why it does not exist:** The cloud column is named `alert_type`. Migration `20260429000002` created `cfo_alerts` fresh with `alert_type NOT NULL`.
- **Risk if reintroduced:** Any ingestion or alert-engine code using `alert_key` would fail at runtime with a column-not-found error and silently prevent alerts from being written.
- **Correct approach:** Always use `alert_type`. Never use `alert_key`.

### `cfo_alerts.is_triggered`

- **Why it does not exist:** The column was present in the pre-cloud seed.sql but was dropped during the cloud schema design. The `cfo_alerts` table records persisted alert *events* — each row is itself a triggered alert. A boolean `is_triggered` flag on an event row is semantically redundant.
- **Risk if reintroduced:** Adds ambiguity: does `is_triggered = false` mean a pending/deferred alert? The current model has no such concept; all rows represent fired events. Adding the column would require clarifying its lifecycle semantics across the ingestion layer, the alerts page, and any future alert-scheduling code.
- **Correct approach:** Do not add `is_triggered`. Use `is_read` (already present, `DEFAULT false`) for read/unread state. If alert deduplication or pending-state tracking is required, introduce a separate `status` column with a defined lifecycle in a deliberate, reviewed migration.

---

*Last updated: 2026-04-30. Update this file whenever a new migration is applied to the cloud project.*
