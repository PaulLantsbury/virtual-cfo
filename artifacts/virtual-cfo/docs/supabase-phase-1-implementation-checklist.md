# Virtual CFO — Supabase Phase 1 Implementation Checklist

> **Status:** Pre-build · April 2026 · Planning only — no Supabase schema has been deployed yet.
> **Purpose:** Actionable implementation checklist for the Supabase Phase 1 build. Organised into the seven steps needed to move from mock data to live dashboard metrics.
> **Companion documents:**
> - `docs/data-dictionary-v1.md` — canonical metric definitions, formulas, and data quality flags
> - `docs/shopify-phase-1-checklist.md` — broader schema design notes and open questions
> - `src/lib/metrics.ts` — TypeScript canonical metric name registry (`METRIC.*`, `TILE_METRIC_MAP`)
> **How to use:** Work through each section in order. Tick each item when done. Add a date and owner when complete.

---

## 1. Tables to Create

Create in dependency order. Items marked **(Phase 1)** are required for go-live. Items marked **(Phase 1 — seed only)** must exist but can start empty or with seed data.

### 1.1 Foundation — create first (no foreign-key dependencies)

- [ ] **`stores`** — one row per connected merchant; root of all multi-tenant data **(Phase 1)**
  - Columns: `id uuid PK`, `shopify_domain text UNIQUE NOT NULL`, `shopify_store_id text UNIQUE NOT NULL`, `name text`, `currency_code char(3) NOT NULL DEFAULT 'GBP'`, `timezone text`, `created_at timestamptz`, `is_active boolean DEFAULT true`
  - Constraint: `UNIQUE (shopify_domain)`, `UNIQUE (shopify_store_id)`
  - Enables RLS — every other table's RLS policy filters on `store_id = current_setting('app.current_store_id')::uuid`
  - ⚠ Must exist before any other table is created

- [ ] **`store_settings`** — per-store thresholds, feature flags, and alert configuration **(Phase 1 — seed only)**
  - Columns: `id uuid PK`, `store_id uuid FK → stores.id NOT NULL`, `cm_target_pct numeric`, `runway_warn_months numeric`, `repeat_rate_target_pct numeric`, `created_at timestamptz`, `updated_at timestamptz`
  - Constraint: `UNIQUE (store_id)` — exactly one row per store
  - Seed: one row per store at first connection using app defaults

- [ ] **`store_cost_assumptions`** — per-store variable cost rates used by `commerceMetrics.ts` **(Phase 1)**
  - Columns: `id uuid PK`, `store_id uuid FK → stores.id NOT NULL`, `payment_fee_rate numeric NOT NULL`, `fulfilment_cost_per_order numeric NOT NULL`, `packaging_cost_per_order numeric NOT NULL`, `return_handling_rate numeric NOT NULL`, `effective_from date NOT NULL`, `created_at timestamptz`
  - Constraint: `UNIQUE (store_id, effective_from)` — versioned by date; use `DISTINCT ON (store_id)` for current
  - Seed: one row per store using the current `costAssumptions.ts` defaults (payment 2.5%, fulfilment £3.50, packaging £1.20, return handling 15%)
  - Unblocks live `contribution_margin_pct` (`METRIC.CONTRIBUTION_MARGIN_PCT`) immediately

### 1.2 Shopify Revenue Tables (depend on `stores`)

- [ ] **`customers`** — one row per Shopify customer; required for repeat-rate computation **(Phase 1)**
  - Columns: `id uuid PK`, `store_id uuid FK → stores.id NOT NULL`, `shopify_customer_id bigint NOT NULL`, `email text`, `first_order_at timestamptz`, `total_orders int DEFAULT 0`, `is_guest boolean DEFAULT false`, `created_at timestamptz`
  - Index: `UNIQUE (store_id, shopify_customer_id)`, `(store_id, first_order_at)`
  - ⚠ Must be populated before `orders` if `customer_id` FK is enforced; allow nullable FK during backfill
  - Feeds: `repeat_purchase_rate` (`METRIC.REPEAT_PURCHASE_RATE`)

- [ ] **`orders`** — central revenue fact table; one row per Shopify order **(Phase 1)**
  - Columns: `id uuid PK`, `store_id uuid FK → stores.id NOT NULL`, `shopify_order_id bigint NOT NULL`, `customer_id uuid FK → customers.id NULLABLE`, `created_at timestamptz NOT NULL`, `updated_at timestamptz NOT NULL`, `financial_status text NOT NULL`, `gross_sales numeric NOT NULL DEFAULT 0`, `discounts numeric NOT NULL DEFAULT 0`, `refunds numeric NOT NULL DEFAULT 0`, `tax numeric NOT NULL DEFAULT 0`, `total_sales numeric NOT NULL DEFAULT 0`, `discount_codes jsonb`, `is_guest_checkout boolean GENERATED ALWAYS AS (customer_id IS NULL) STORED`, `has_discount boolean GENERATED ALWAYS AS (discounts > 0) STORED`, `is_cancelled boolean GENERATED ALWAYS AS (financial_status = 'cancelled') STORED`
  - Index: `UNIQUE (store_id, shopify_order_id)`, `(store_id, created_at)`, `(store_id, financial_status)`, `(store_id, updated_at)`
  - Feeds: `net_sales`, `monthly_revenue`, `average_order_value`, `discount_dependency_ratio`, `refund_rate_pct`, `contribution_margin_pct`, `live_order_leakage_estimate` — all dashboard tiles in rows 1 and 2

- [ ] **`refunds`** — one row per refund event; a single order may have multiple **(Phase 1)**
  - Columns: `id uuid PK`, `store_id uuid FK → stores.id NOT NULL`, `order_id uuid FK → orders.id NOT NULL`, `shopify_refund_id bigint NOT NULL`, `refund_subtotal numeric NOT NULL DEFAULT 0`, `created_at timestamptz NOT NULL`
  - Index: `UNIQUE (store_id, shopify_refund_id)`, `(store_id, order_id)`, `(store_id, created_at)`
  - Needed to prevent double-counting on partially-refunded orders

- [ ] **`order_line_items`** — one row per line item; required for AOV per-unit and markdown detection **(Phase 1)**
  - Columns: `id uuid PK`, `store_id uuid FK → stores.id NOT NULL`, `order_id uuid FK → orders.id NOT NULL`, `product_id uuid FK → products.id NULLABLE`, `variant_id uuid FK → product_variants.id NULLABLE`, `shopify_line_item_id bigint NOT NULL`, `title text`, `quantity int NOT NULL`, `price numeric NOT NULL`, `compare_at_price numeric NULLABLE`, `total_discount numeric NOT NULL DEFAULT 0`, `gross_line_total numeric GENERATED ALWAYS AS (price * quantity) STORED`, `is_markdown boolean GENERATED ALWAYS AS (compare_at_price IS NOT NULL AND compare_at_price > price) STORED`
  - ⚠ Must be created before `refund_line_items` — `refund_line_items.order_line_item_id` FK references this table

- [ ] **`refund_line_items`** — line-item detail within a refund; prevents double-counting **(Phase 1)**
  - Columns: `id uuid PK`, `store_id uuid FK → stores.id NOT NULL`, `refund_id uuid FK → refunds.id NOT NULL`, `order_line_item_id uuid FK → order_line_items.id NOT NULL`, `quantity int NOT NULL`, `subtotal numeric NOT NULL`
  - Required to correctly attribute refund amounts to specific line items

### 1.3 Shopify Product Catalogue (depend on `stores`)

- [ ] **`products`** — one row per Shopify product; required for variant cost coverage DQ check **(Phase 1)**
  - Columns: `id uuid PK`, `store_id uuid FK → stores.id NOT NULL`, `shopify_product_id bigint NOT NULL`, `title text`, `status text`, `created_at timestamptz`
  - Index: `UNIQUE (store_id, shopify_product_id)`, `(store_id, status)`

- [ ] **`product_variants`** — one row per variant; `cost` is frequently NULL at Phase 1 **(Phase 1)**
  - Columns: `id uuid PK`, `store_id uuid FK → stores.id NOT NULL`, `product_id uuid FK → products.id NOT NULL`, `shopify_variant_id bigint NOT NULL`, `title text`, `sku text`, `price numeric NOT NULL`, `compare_at_price numeric NULLABLE`, `cost numeric NULLABLE`, `inventory_quantity int DEFAULT 0`, `cost_populated boolean GENERATED ALWAYS AS (cost IS NOT NULL) STORED`
  - ⚠ `cost` will be NULL for most stores at Phase 1; this is expected and documented

### 1.4 Discount Catalogue (depend on `stores`)

- [ ] **`discounts`** — one row per Shopify price rule **(Phase 1 — seed only)**
  - Columns: `id uuid PK`, `store_id uuid FK → stores.id NOT NULL`, `shopify_price_rule_id bigint NOT NULL`, `title text`, `value_type text`, `value numeric`, `category text CHECK (category IN ('loyalty','promotional','referral','wholesale','other')) DEFAULT NULL`
  - Note: `category` populated by merchant at onboarding; NULL until then — affects discount-by-category breakdown (not the headline dependency ratio)

- [ ] **`discount_codes`** — one row per individual code under a price rule **(Phase 1)**
  - Columns: `id uuid PK`, `store_id uuid FK → stores.id NOT NULL`, `discount_id uuid FK → discounts.id NOT NULL`, `code text NOT NULL`, `usage_count int DEFAULT 0`
  - Index: `UNIQUE (store_id, LOWER(code))` — join to `orders.discount_codes JSONB` using `LOWER(code)`

### 1.5 Internal Engine Tables (depend on `stores`, `store_settings`)

- [ ] **`opportunities`** — one row per identified margin recovery opportunity **(Phase 1 — seed only)**
  - Columns: `id uuid PK`, `store_id uuid FK → stores.id NOT NULL`, `title text NOT NULL`, `description text`, `category text`, `status text CHECK (status IN ('draft','active','in_progress','resolved','dismissed')) DEFAULT 'active'`, `uplift_low numeric NOT NULL DEFAULT 0`, `uplift_high numeric NOT NULL DEFAULT 0`, `action_label text`, `why_label text`, `priority_rank int`, `created_at timestamptz`, `updated_at timestamptz`
  - Seed immediately: the three current mock weekly priorities from `dashboard.tsx` as real rows
  - Once seeded, `v_recoverable_contribution` view replaces `RECOVERABLE_LOW` / `RECOVERABLE_HIGH` from `business-snapshot.ts` — the tile becomes **database-backed**
  - The values remain **seeded/mock** until the opportunity engine calculates real opportunity rows from live Shopify data; the tile is not fully live until then

- [ ] **`cfo_alerts`** — one row per alert type per store; tracks trigger state **(Phase 1 — seed only)**
  - Columns: `id uuid PK`, `store_id uuid FK → stores.id NOT NULL`, `alert_key text NOT NULL`, `is_triggered boolean DEFAULT false`, `triggered_at timestamptz NULLABLE`, `acknowledged_at timestamptz NULLABLE`, `severity text CHECK (severity IN ('info','warn','danger'))`
  - Constraint: `UNIQUE (store_id, alert_key)` — one row per alert type per store
  - Seed standard alert keys at onboarding: `low_runway`, `high_discount_dep`, `falling_repeat_rate`, `rising_cac`, `high_refund_rate`

---

## 2. Views and Functions to Create

All parameterised functions take `(p_store_id UUID, p_date_from TIMESTAMPTZ, p_date_to TIMESTAMPTZ)`.
All functions exclude `financial_status = 'cancelled'` and limit to `financial_status IN ('paid', 'partially_refunded')` unless stated.

### 2.1 Revenue Functions

- [ ] **`gross_revenue(p_store_id, p_date_from, p_date_to)`** — pre-discount revenue
  - Formula: `SUM(subtotal_price + total_discounts)` on `orders` for the period
  - Feeds: `monthly_revenue` (`METRIC.MONTHLY_REVENUE`) — replaces current `total_sales` approximation
  - Post-compute assertion: result ≈ `net_revenue() + discount_cost() + return_amount() ± £10`

- [ ] **`net_revenue(p_store_id, p_date_from, p_date_to)`** — gross minus discounts and refunds
  - Formula: `gross_revenue − discount_cost − return_amount`
  - Uses LEFT JOIN to `refunds` aggregated per `order_id` to prevent double-counting
  - Feeds: underlying component of `net_sales` (`METRIC.NET_SALES`)

- [ ] **`net_sales(p_store_id, p_date_from, p_date_to)`** — net sales excluding VAT
  - Formula: `gross_sales − discounts − refunds − tax` per order, summed
  - Feeds: `net_sales` (`METRIC.NET_SALES`) — already approximated in `commerceMetrics.ts`; this function is the production replacement
  - ⚠ Tax deduction is only correct if `tax` column is stored as a separate ingest field; confirm `orders.taxes_included` flag at ingest time

- [ ] **`discount_cost(p_store_id, p_date_from, p_date_to)`** — total revenue surrendered via discount codes
  - Formula: `SUM(orders.discounts)` for the period
  - Note: does NOT capture silent markdowns (items at `price < compare_at_price` without a code)
  - Assertion: result ≈ `gross_revenue × AVG_DISCOUNT_PCT / 100 ± 5%`

- [ ] **`return_amount(p_store_id, p_date_from, p_date_to)`** — total refunded revenue
  - Formula: `SUM(refunds.refund_subtotal)` attributed to the original order's period (`orders.created_at`)
  - Period attribution: use `orders.created_at`, not `refunds.created_at`
  - Feeds: refund component of `refund_rate_pct` (`METRIC.REFUND_RATE_PCT`)

- [ ] **`average_discount_pct(p_store_id, p_date_from, p_date_to)`** — revenue-weighted average discount rate
  - Formula: `discount_cost() / gross_revenue() × 100`
  - Assertion: result ≈ `discount_cost() / gross_revenue() × 100 ± 0.1pp`

### 2.2 Order Volume and Pricing Functions

- [ ] **`order_count(p_store_id, p_date_from, p_date_to)`** — count of revenue-generating orders
  - Excludes cancelled and fully-refunded orders
  - Feeds: denominator of `average_order_value` (`METRIC.AVERAGE_ORDER_VALUE`) and `repeat_purchase_rate` (`METRIC.REPEAT_PURCHASE_RATE`)

- [x] **`average_order_value(p_store_id, p_date_from, p_date_to)`** — net sales per qualifying order ✓ **DONE**
  - Formula: `SUM(gross_sales − discounts − refunds − tax) / COUNT(*) FILTER (financial_status NOT IN ('cancelled','refunded'))`
  - Supabase function is implemented and uses the canonical definition
  - **Frontend mismatch (open):** `commerceMetrics.averageOrderValue` still computes `total_sales / count(*)` — a different numerator (includes discounts, refunds, tax) and a different denominator (all orders regardless of status). The dashboard tile currently shows the frontend figure, not the Supabase function result
  - **Do not change frontend logic in isolation.** The frontend formula will be replaced when the dashboard tile is wired to this Supabase function as part of the dashboard wiring step
  - Feeds: `average_order_value` (`METRIC.AVERAGE_ORDER_VALUE`)

### 2.3 Customer Quality Functions

- [ ] **`repeat_purchase_rate(p_store_id, p_date_from, p_date_to)`** — % of orders from returning customers
  - Formula: `orders WHERE customer_id IS NOT NULL AND customers.first_order_at < p_date_from` / `order_count()`
  - Returns companion fields: `total_orders`, `guest_orders`, `guest_rate_pct`
  - Excludes guest orders (`is_guest_checkout = true`) from both numerator and denominator
  - Feeds: `repeat_purchase_rate` (`METRIC.REPEAT_PURCHASE_RATE`)

- [ ] **`discount_dependency(p_store_id, p_date_from, p_date_to)`** — discount value as a share of gross sales
  - Formula: `discount_cost() / gross_revenue() × 100` (value-based: £ discounts surrendered / £ gross sales)
  - Returns: headline rate + optional breakdown by `discounts.category` when populated
  - Feeds: `discount_dependency_ratio` (`METRIC.DISCOUNT_DEPENDENCY_RATIO`)
  - Aligns with: `commerceMetrics.discountRate` — both use the value-based formula; no formula alignment gap

- [ ] **`discount_usage_rate(p_store_id, p_date_from, p_date_to)`** — secondary diagnostic: frequency of discount code use **(Phase 1+, not required for go-live)**
  - Formula: `COUNT(*) FILTER (WHERE has_discount = true) / order_count() × 100` (count-based: orders that applied a discount code / total orders)
  - Status: future / secondary diagnostic — this is NOT `discount_dependency_ratio` and must not be used in its place
  - Purpose: shows how often customers apply codes, regardless of the value surrendered; useful for understanding promotional behaviour alongside the headline value-based ratio
  - Implement after `discount_dependency()` is live and the distinction between the two signals is documented in the merchant-facing UI

- [ ] **`refund_rate(p_store_id, p_date_from, p_date_to)`** — share of gross sales refunded
  - Formula: `return_amount() / gross_revenue() × 100`
  - Feeds: `refund_rate_pct` (`METRIC.REFUND_RATE_PCT`)

### 2.4 Views

- [ ] **`v_net_sales`** — per-order net sales view; base for revenue queries
  - Formula: `gross_sales − discounts − refunds − tax` for paid / partially-refunded orders
  - Used by: `commerceMetrics.ts` and any future metric query that needs order-level net revenue

- [ ] **`v_recoverable_contribution`** — one row per store with active opportunity range
  - Formula: `SELECT store_id, SUM(uplift_low) AS recoverable_low, SUM(uplift_high) AS recoverable_high FROM opportunities WHERE status = 'active' GROUP BY store_id`
  - Replaces: `RECOVERABLE_LOW` / `RECOVERABLE_HIGH` static constants in `business-snapshot.ts`
  - Once created, `dashboard.tsx` KPI tile `rc` reads from this view — the tile becomes **database-backed** rather than reading a TypeScript constant
  - ⚠ The range values remain **seeded/mock** until the opportunity engine derives `uplift_low` / `uplift_high` from live Shopify data; being database-backed is not the same as being live

- [ ] **`v_current_cost_assumptions`** — latest cost assumption row per store
  - Formula: `DISTINCT ON (store_id) ... ORDER BY store_id, effective_from DESC`
  - Used by: `commerceMetrics.ts` to replace hardcoded `costAssumptions.ts` constants

- [ ] **`v_active_opportunities`** — active opportunities enriched with store currency code
  - Formula: `opportunities JOIN stores ON store_id WHERE status = 'active'`
  - Used by: Profit Opportunities panel and weekly priorities in `dashboard.tsx`

---

## 3. Row-Level Security Requirements

RLS is the multi-tenant isolation layer. Every table must have it enabled and a matching policy applied before any data is written. The policy pattern is consistent across all tables.

### 3.1 Global RLS rules

- [ ] Enable RLS on every table listed in Section 1 without exception
  ```sql
  ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
  ```

- [ ] Create the standard isolation policy on every table
  ```sql
  CREATE POLICY store_isolation ON <table_name>
    USING (store_id = current_setting('app.current_store_id')::uuid);
  ```

- [ ] Verify the API layer sets `app.current_store_id` before every Supabase connection
  - This must happen in the Express middleware layer, not in the frontend
  - Pattern: `SET LOCAL app.current_store_id = '<store_uuid>'` at the start of each request

### 3.2 Per-table RLS notes

| Table | Additional RLS note |
|---|---|
| `stores` | Policy uses `id` not `store_id`: `USING (id = current_setting('app.current_store_id')::uuid)` |
| `store_settings` | Same isolation pattern; single-row UNIQUE constraint is enforced by the application, not RLS |
| `store_cost_assumptions` | Standard policy; the effective version is selected by date at query time, not by RLS |
| `customers` | Standard policy; email field should be considered PII — encrypt at rest if required by merchant's data processing agreement |
| `orders` | Standard policy; guest orders (`customer_id IS NULL`) still have `store_id` and are covered |
| `refunds` | Standard policy; `order_id` FK implicitly scoped to the store via the `orders` RLS policy, but `store_id` must still be stored and filtered directly |
| `opportunities` | Standard policy; seed rows must be inserted with the correct `store_id` |
| `cfo_alerts` | Standard policy; `alert_key` is unique per store — the UNIQUE constraint must include `store_id` |

### 3.3 Service role vs anon key

- [ ] The Supabase service role key must NEVER be exposed in frontend code
- [ ] All writes (order ingest, opportunity updates, alert triggers) use the service role key in the API server only
- [ ] The frontend Supabase client uses the anon key; RLS restricts what it can read
- [ ] Add an assertion: if `SELECT COUNT(*) FROM orders` returns rows for a different `store_id`, RLS is misconfigured — add this as a CI sanity check

---

## 4. Seed and Test Data Required

Seed data populates tables immediately after creation so the app is functional from day one. Test data is used in the development/staging environment to exercise all metric paths.

### 4.1 Required seed data (production — on first merchant connection)

- [ ] **`stores`** — one row per connected merchant
  - Populate from Shopify OAuth callback: `shopify_domain`, `shopify_store_id`, `name`, `currency_code`
  - `currency_code` must be read from the Shopify store API, not assumed to be GBP

- [ ] **`store_settings`** — one row per store with application defaults
  - `cm_target_pct = 40.0`
  - `runway_warn_months = 3.0`
  - `repeat_rate_target_pct = 30.0`

- [ ] **`store_cost_assumptions`** — one row per store, `effective_from = onboarding date`
  - `payment_fee_rate = 0.025` (2.5%)
  - `fulfilment_cost_per_order = 3.50`
  - `packaging_cost_per_order = 1.20`
  - `return_handling_rate = 0.15` (15% of refund value)
  - Source: current hardcoded values in `costAssumptions.ts` — migrate these at onboarding

- [ ] **`opportunities`** — seed the three current mock weekly priorities from `dashboard.tsx` as real rows
  - Row 1: margin improvement opportunity (maps to `CFO_INSIGHT.weeklyPriorities[0]`)
  - Row 2: repeat rate / retention opportunity
  - Row 3: ad spend efficiency opportunity
  - Set `status = 'active'`, `uplift_low` / `uplift_high` matching current mock values (£18k–£42k total)
  - Once seeded and `v_recoverable_contribution` is created, the `rc` tile becomes **database-backed** — it reads from the DB rather than a TypeScript constant
  - The tile remains **seeded/mock** until the opportunity engine replaces these rows with values computed from live Shopify data

- [ ] **`cfo_alerts`** — seed one row per alert key per store with `is_triggered = false`
  - Alert keys: `low_runway`, `high_discount_dep`, `falling_repeat_rate`, `rising_cac`, `high_refund_rate`

### 4.2 Test data (development / staging environment only)

- [ ] **Minimum viable test order set** — at least 100 orders covering all financial status variants
  - Include `paid`, `partially_refunded`, `refunded`, `cancelled` orders in realistic proportions
  - Include orders with and without discount codes (`has_discount = true` and `false`)
  - Include orders with and without `customer_id` (guest checkout simulation)
  - Include at least 20% repeat customers (`customers.total_orders ≥ 2`)
  - Include at least one order with a `compare_at_price > price` line item (silent markdown test)

- [ ] **Test date range** — orders spread across at least 3 calendar months
  - Required for MoM comparison logic and period-parameterised function testing
  - At least 13 months of data if `metric_snapshots` MoM badges are tested

- [ ] **Refund test data** — at least 5 orders with refund events
  - Include at least one order with two separate partial refund events (double-counting check)
  - Include one fully refunded order (`financial_status = 'refunded'`) to verify exclusion from revenue metrics

- [ ] **Guest checkout test data** — at least 15% of test orders without `customer_id`
  - Exercises the guest checkout DQ check (Section 7 check 7.1) and repeat-rate exclusion logic

- [ ] **Product and variant data** — sufficient to test variant cost coverage DQ check
  - Include at least one variant with `cost IS NULL` (unpopulated COGS)
  - Include at least one variant with `cost IS NOT NULL` (populated COGS)
  - Target ≥ 90% cost coverage in the test set so the DQ check passes; add a separate test scenario with < 70% coverage to verify the ALERT fires

---

## 5. Dashboard Metrics That Can Be Wired Immediately

These metrics are already computed at runtime from the Supabase `orders` table via `commerceMetrics.ts`. They will display real values as soon as:
(a) the `orders` table exists and is populated, and
(b) `store_cost_assumptions` is seeded (for `cm` and the leakage diagnostic).

No additional integration is required.

| Tile ID | Canonical Metric | `METRIC.*` Key | Current Path | Wire-Up Action Required |
|---|---|---|---|---|
| `ns` | `net_sales` | `METRIC.NET_SALES` | `commerceMetrics.netSales` | Ensure `tax` column is populated correctly at ingest; confirm `taxes_included` flag handling |
| `cm` | `contribution_margin_pct` | `METRIC.CONTRIBUTION_MARGIN_PCT` | `commerceMetrics.contributionMarginPercent` | Seed `store_cost_assumptions` table; update `commerceMetrics.ts` to read cost rates from `v_current_cost_assumptions` instead of `costAssumptions.ts` |
| `mr` | `monthly_revenue` | `METRIC.MONTHLY_REVENUE` | `commerceMetrics.totalRevenue` | Works on `orders` ingest. Future: align formula to `gross_revenue()` function for canonical pre-discount revenue |
| `aov` | `average_order_value` | `METRIC.AVERAGE_ORDER_VALUE` | `commerceMetrics.averageOrderValue` | Works immediately on `orders` ingest. Confirm denominator excludes cancelled/refunded orders |
| `rpr` | `repeat_purchase_rate` | `METRIC.REPEAT_PURCHASE_RATE` | `commerceMetrics.repeatPurchaseRate` | Requires `customers` table with `first_order_at` populated; wire `repeat_purchase_rate()` SQL function and surface guest checkout rate alongside tile |
| `dd` | `discount_dependency_ratio` | `METRIC.DISCOUNT_DEPENDENCY_RATIO` | `commerceMetrics.discountRate` | Works immediately. Formula is value-based (Discount Value / Gross Sales) — matches the product definition and `commerceMetrics.discountRate`; no alignment badge required |
| `rr` | `refund_rate_pct` | `METRIC.REFUND_RATE_PCT` | `commerceMetrics.refundRate` | Works immediately. Confirm period attribution uses `orders.created_at`, not `refunds.created_at` |

**Also wirable immediately (internal diagnostic — not a KPI tile):**

| Metric | `METRIC.*` Key | Current Path | Wire-Up Action |
|---|---|---|---|
| `live_order_leakage_estimate` | `METRIC.LIVE_ORDER_LEAKAGE_ESTIMATE` | `commerceMetrics.liveOrderLeakageEstimate` | Seed `store_cost_assumptions`; this then runs automatically — diagnostic only, not shown on a KPI tile |

---

## 6. Metrics That Must Remain Mock or Partial

These tiles cannot be wired to live data in Phase 1. The table states exactly what is blocking each one.

### 6.1 Requires internal tables (buildable in Phase 1, but not yet wired)

| Tile ID | Canonical Metric | `METRIC.*` Key | Blocker | Unblock Action |
|---|---|---|---|---|
| `rc` | `recoverable_contribution_range` | `METRIC.RECOVERABLE_CONTRIBUTION_RANGE` | `opportunities` table not yet created and seeded | Create `opportunities` table → seed 3 rows → create `v_recoverable_contribution` view → update `dashboard.tsx` tile `rc` to query the view. Result: tile becomes **database-backed** but values remain **seeded/mock** until the opportunity engine computes rows from live Shopify data |

### 6.2 Requires Xero integration (Phase 2)

| Tile ID | Canonical Metric | `METRIC.*` Key | Current Source | Phase 2 Action |
|---|---|---|---|---|
| `cr` | `cash_runway_months` | `METRIC.CASH_RUNWAY_MONTHS` | `cash-snapshot.ts` `CASH_RUNWAY = 3.4` | Connect Xero → read operating bank balance → read fixed overhead nominal codes → compute `CASH_BALANCE / MONTHLY_FIXED_COSTS` |
| `np` | `operating_profit_estimate` | `METRIC.OPERATING_PROFIT_ESTIMATE` | Hardcoded `"£56,300"` in `dashboard.tsx` ⚠ | Phase 1 quick-win: introduce `MONTHLY_OPERATING_PROFIT = MONTHLY_CM_VALUE − MONTHLY_FIXED_COSTS` constant to replace the hardcode. Full fix in Phase 2 once Xero P&L is connected |

**Other Xero-dependent values used across non-KPI pages (remain mock in Phase 1):**

| Metric | Current Source | Phase 2 Action |
|---|---|---|
| Cash Balance | `cash-snapshot.ts` `CASH_BALANCE = 186_000` | Xero bank account reconciliation |
| Monthly Fixed Costs | `cash-snapshot.ts` `MONTHLY_FIXED_COSTS = 120_000` | Xero nominal code mapping |
| Working Capital Drag | `cash-snapshot.ts` `WORKING_CAPITAL_DRAG = 74_000` | Shopify inventory + Xero AP |
| Inventory Days | `cash-snapshot.ts` `INVENTORY_DAYS = 82` | `product_variants.cost` + inventory levels |
| Supplier Days | `cash-snapshot.ts` `SUPPLIER_DAYS = 42` | Xero bills / AP ageing |
| Returns Fulfilment Cost | Zero / absent | Xero nominal code or manual merchant input |

### 6.3 Requires Phase 4 (Meta Ads / Google Ads integration)

| Tile ID | Canonical Metric | `METRIC.*` Key | Blocker |
|---|---|---|---|
| `ae` | `meta_cac_trend` | `METRIC.META_CAC_TREND` | `marketing_spend` table + Meta Ads API. Currently hardcoded as `"Meta CAC +14%"` in `dashboard.tsx` |

**Other Phase 4+ channel metrics (non-KPI-tile, used on Marketing Efficiency and Growth Quality pages):**

| Metric | Current Source | Blocked On |
|---|---|---|
| Blended CAC | `channel-metrics.ts` static constant | `marketing_spend` + `customers` |
| Blended ROAS | `channel-metrics.ts` static constant | `marketing_spend` + Shopify attribution |
| CAC Payback | `growth-metrics.ts` `CAC_PAYBACK = 1.4` | Blended CAC + contribution per order (live) |
| GQ Score | `growth-metrics.ts` `GQ_SCORE = "B-"` | Requires `repeat_purchase_rate`, `discount_dependency_ratio`, and `meta_cac_trend` all live |

### 6.4 Requires compute infrastructure (Phase 2–3)

| Component | Current Source | Blocker |
|---|---|---|
| Overall health status (AMBER — Moderate Risk) | Hardcoded string | Weighted risk score across all live metric categories |
| Health pills (Profitability, Margin Quality, Runway, etc.) | Hardcoded in `TOP_DRIVERS` | Live metrics vs `store_settings` thresholds |
| All CFO Alerts | Hardcoded narrative | `cfo_alerts` table + live metric compute cycle |
| Retention status (Strengthening / Stable / Weakening) | `growth-metrics.ts` `RETENTION_STATUS` | `METRIC.REPEAT_PURCHASE_RATE` MoM delta from `metric_snapshots` |
| MoM change badges on KPI tiles | Absent / hardcoded strings | `metric_snapshots` table populated by background compute job |

---

## 7. Data Quality Checks Required Before Go-Live

Run after every Shopify sync. Failures should be stored in a `data_quality_flags` table (schema TBD in Phase 2) and surfaced as warning badges on affected pages. Items marked **blocking** must pass before the affected metric is shown to the merchant.

### 7.1 Guest checkout rate — affects `repeat_purchase_rate`

- [ ] Compute: `guest_orders / total_orders × 100` for the period
- Threshold: < 10% = OK · 10–25% = WARN badge on tile `rpr` · > 25% = LOW confidence label, alert
- Surface on: Dashboard Repeat Purchase Rate tile (`rpr`), Growth Quality page
- **Blocking?** No — show metric with confidence badge; do not suppress
- Action if triggered: Surface recommendation to enable Shopify customer accounts

### 7.2 Pending orders — affects all revenue metrics

- [ ] Compute: count and value of orders with `financial_status = 'pending'`
- Threshold: 0 = OK · 1–5 or < 1% of period value = INFO · > 5 or > 1% of period value = WARN
- Surface on: all revenue pages — period totals should carry a "preliminary" label
- **Blocking?** No — show metrics with "N orders pending — totals may shift" label
- Action if triggered: Show inline label; recompute automatically when status settles

### 7.3 Silent markdowns — affects `discount_dependency_ratio` completeness

- [ ] Compute: `SUM((compare_at_price − price) × quantity)` for `is_markdown = true` line items
- Threshold: > £0 = WARN (this will almost always fire)
- Surface on: Pricing Optimisation page
- **Blocking?** No — KPI tile `dd` is unaffected; surface note on Pricing page only
- Action if triggered: Show "An estimated £X in markdowns are not captured in your discount codes"

### 7.4 Partial refund double-counting — affects `refund_rate_pct` and `net_sales`

- [ ] Compute: for each order with `financial_status = 'partially_refunded'` and multiple refund rows, compare `SUM(refunds.refund_subtotal)` vs `orders.total_price`; flag if cumulative refund exceeds order total
- Threshold: internal only — do not surface to merchant
- **Blocking?** Yes if any order is over-refunded — log and fix at ingest
- Action if triggered: Engineering alert; auto-reconcile `orders.total_refunded` field

### 7.5 Variant cost coverage — affects `live_order_leakage_estimate` confidence

- [ ] Compute: `COUNT(*) FILTER (WHERE cost IS NOT NULL) / COUNT(*) × 100` on active variants
- Threshold: ≥ 90% = OK · 70–89% = WARN badge on Cash Control inventory card · < 70% = ALERT, LOW confidence on inventory metrics
- Surface on: Cash Control page (inventory value card)
- **Blocking?** No for Phase 1 (COGS is not yet used in any KPI tile formula)
- Action if triggered: Prompt merchant to complete variant costs via Shopify admin bulk edit

### 7.6 Gross revenue assertion — run at query time

- [ ] Assert: `gross_revenue() ≈ net_revenue() + discount_cost() + return_amount() ± £10`
- **Blocking?** Yes if assertion fails — log discrepancy; flag revenue totals as "reconciliation in progress"; do not display until resolved
- Action if triggered: Engineering alert; check ingest pipeline for dropped or duplicated rows

### 7.7 Average discount cross-check — run at query time

- [ ] Assert: `average_discount_pct() ≈ discount_cost() / gross_revenue() × 100 ± 0.1pp`
- **Blocking?** No — surface as "Discount figures may include rounding differences" if assertion fails
- Action if triggered: Log discrepancy; surface badge on Pricing Optimisation page

### 7.8 Tax deduction sanity check — affects `net_sales`

- [ ] Compute: `SUM(tax) / SUM(gross_sales)` for all orders
- Threshold: > 30% = WARN — likely indicates double-deduction from tax-inclusive store configuration
- Surface on: internal engineering alert only (not merchant-facing until confirmed)
- **Blocking?** Yes — if tax > 30% of gross sales, halt `net_sales` tile go-live until `taxes_included` flag is verified at ingest
- Action if triggered: Engineering review of Shopify `taxes_included` store setting and ingest pipeline

---

*Document version: 1.0 · Created: April 2026*
*Derived from: `docs/data-dictionary-v1.md` (Appendix A), `docs/shopify-phase-1-checklist.md`, `src/lib/metrics.ts`*
*Owner: Virtual CFO product / engineering team*
*Update trigger: When a checklist item is completed, a blocker is resolved, or an open question from `shopify-phase-1-checklist.md` is answered.*
