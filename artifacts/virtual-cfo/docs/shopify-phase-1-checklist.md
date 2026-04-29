# Virtual CFO — Shopify Phase 1 Implementation Checklist

> **Status:** Pre-build · April 2026 · Planning only — no integration has been built yet.
> **Purpose:** Actionable checklist derived from `data-dictionary-v1.md`, `shopify-phase-1-schema.md`, `supabase-schema-v1.md` and `metric-status-v1.md`.
> **How to use:** Work through each section in order. Tick items off as they are completed. Add a date and owner initials when each item is done.

---

## 1. Tables to Create in Supabase

Tables must be created in dependency order. Foreign keys are noted where they constrain creation sequence.

### 1.1 Foundation (no dependencies — create first)

- [ ] `stores` — one row per connected merchant; root of all multi-tenant queries
  - Required before any other table — all tables FK to `stores.id`
  - Enable RLS; add `UNIQUE` on `shopify_domain` and `shopify_store_id`

- [ ] `store_settings` — per-store configuration, thresholds, Xero account tags
  - FK → `stores.id`; `UNIQUE (store_id)` — one row per store
  - Seed with defaults at first connection

- [ ] `store_cost_assumptions` — per-store variable cost rates and benchmarks
  - FK → `stores.id`; versioned by `effective_from date`
  - Seed with current `costAssumptions.ts` defaults at first connection
  - Unblocks live contribution margin and live recoverable leakage estimate

### 1.2 Shopify Revenue Tables (depend on `stores`)

- [ ] `customers` — one row per Shopify customer; `first_order_at` is critical for repeat-rate
  - FK → `stores.id`
  - Must be populated before `orders` if `customer_id` FK is enforced, OR allow nullable FK on orders during backfill
  - Index: `(store_id, shopify_customer_id)` unique; `(store_id, first_order_at)`

- [ ] `orders` — central revenue fact table; one row per Shopify order
  - FK → `stores.id`, nullable FK → `customers.id`
  - Computed columns: `gross_price`, `is_guest_checkout`, `has_discount`, `is_cancelled`
  - Index: `(store_id, shopify_order_id)` unique; `(store_id, created_at)`; `(store_id, financial_status)`; `(store_id, updated_at)`

- [ ] `refunds` — one row per refund event; a single order can have multiple
  - FK → `stores.id`, `orders.id`
  - Index: `(store_id, shopify_refund_id)` unique; `(store_id, order_id)`; `(store_id, created_at)`

- [ ] `refund_line_items` — line-item detail within a refund; prevents double-counting
  - FK → `stores.id`, `refunds.id`, `order_line_items.id`

- [ ] `order_line_items` — one row per line item; required for ASP and silent-markdown detection
  - FK → `stores.id`, `orders.id`, nullable FK → `product_variants.id`, `products.id`
  - Computed columns: `gross_line_total`, `is_markdown`

### 1.3 Shopify Product Catalogue (depend on `stores`, `orders`)

- [ ] `products` — one row per Shopify product; required for variant cost coverage check
  - FK → `stores.id`
  - Index: `(store_id, shopify_product_id)` unique; `(store_id, status)`

- [ ] `product_variants` — one row per variant; contains `cost` (COGS — often NULL)
  - FK → `stores.id`, `products.id`
  - Computed column: `cost_populated boolean`
  - `cost` field will be NULL for most stores at Phase 1; this is expected

### 1.4 Discount Catalogue (depend on `stores`, `orders`)

- [ ] `discounts` — one row per Shopify price rule (parent of discount codes)
  - FK → `stores.id`
  - `category` column (loyalty / promotional / referral) populated by merchant at onboarding

- [ ] `discount_codes` — one row per individual discount code under a price rule
  - FK → `stores.id`, `discounts.id`
  - Linked to orders via `orders.discount_codes JSONB` using `LOWER(code)` join

### 1.5 Internal Engine Tables (depend on `stores`, `store_settings`)

- [ ] `opportunities` — one row per identified recoverable contribution opportunity
  - FK → `stores.id`
  - Status lifecycle: `draft → active → in_progress → resolved / dismissed`
  - Seed the three current mock weekly priorities as real rows immediately (no integration needed)
  - Unblocks `RECOVERABLE_LOW` / `RECOVERABLE_HIGH` from DB instead of `business-snapshot.ts`

- [ ] `cfo_alerts` — one row per alert type per store; tracks trigger state and acknowledgement
  - FK → `stores.id`
  - `UNIQUE (store_id, alert_key)` — one row per alert type per store
  - Seed standard alert definitions at onboarding

### 1.6 Marketing and Snapshot Tables (Phase 4+)

- [ ] `marketing_spend` — one row per day × channel; append-only
  - FK → `stores.id`
  - `UNIQUE (store_id, spend_date, channel)`
  - Blocked on Meta Ads API / Google Ads API connection (Phase 4)

- [ ] `metric_snapshots` — cached computed metric values per store per period
  - FK → `stores.id`
  - Populated by a background compute job, not the frontend
  - Unblocks MoM comparison badges and fast-path dashboard reads

### RLS — apply to every table

- [ ] Enable Row-Level Security on all tables
- [ ] Create policy on each table: `USING (store_id = current_setting('app.current_store_id')::uuid)`
- [ ] Verify that `app.current_store_id` session variable is set before every connection in the API layer

---

## 2. Views and Functions to Create

All parameterised functions take `(store_id UUID, date_from TIMESTAMPTZ, date_to TIMESTAMPTZ)`.
All functions exclude cancelled orders and limit to `financial_status IN ('paid', 'partially_refunded')`.

### 2.1 Revenue Functions

- [ ] `gross_revenue(store_id, date_from, date_to)` — pre-discount revenue reconstructed as `SUM(subtotal_price + total_discounts)`
  - Feeds: `ANNUAL_REVENUE`, `MONTHLY_REVENUE`, `GROSS_REVENUE` (pricing period)
  - Add post-compute assertion: `gross_revenue ≈ net_revenue + discount_cost + return_amount`

- [ ] `net_revenue(store_id, date_from, date_to)` — gross minus discounts and refund subtotals
  - Feeds: `ANNUAL_NET_REVENUE`, `NET_RETAINED`
  - Uses LEFT JOIN to `refunds` aggregated by `order_id` to prevent double-counting

- [ ] `discount_cost(store_id, date_from, date_to)` — total revenue surrendered via discount codes
  - Feeds: `ANNUAL_DISCOUNTS`, `DISCOUNT_COST`
  - Note: does NOT capture silent markdowns (items sold below compare_at without a code)

- [ ] `average_discount_pct(store_id, date_from, date_to)` — revenue-weighted average discount rate
  - Feeds: `AVG_DISCOUNT_PCT`
  - Add assertion: result ≈ `DISCOUNT_COST / GROSS_REVENUE × 100 ± 0.1pp`

- [ ] `return_amount(store_id, date_from, date_to)` — total refunded value, attributed to order's period
  - Feeds: `ANNUAL_RETURNS`, `RETURNS_IMPACT` (revenue component only — fulfilment cost added Phase 2)
  - Uses `orders.created_at` for period attribution, not `refunds.created_at`

### 2.2 Order Volume Functions

- [ ] `order_count(store_id, date_from, date_to)` — count of revenue-generating orders
  - Feeds: `MONTHLY_ORDER_VOLUME`, `ORDERS` (pricing period)
  - Excludes cancelled and fully-refunded orders

- [ ] `average_selling_price(store_id, date_from, date_to)` — total revenue / total units sold
  - Joins `order_line_items` for unit count; excludes gift cards from denominator

### 2.3 Customer Quality Functions

- [ ] `repeat_purchase_rate(store_id, date_from, date_to)` — % of orders from returning customers
  - Uses `customers.first_order_at < date_from` to classify "returning"
  - Returns companion fields: `total_orders`, `guest_orders`, `guest_rate_pct`
  - Excludes guest orders (`is_guest_checkout = true`) from both numerator and denominator

- [ ] `discount_dependency(store_id, date_from, date_to)` — discount value as a % of gross revenue (value-based)
  - Formula: `SUM(discounts) / SUM(gross_sales) × 100`
  - Excludes cancelled orders; includes partially_refunded and fully refunded
  - Returns single rate; category breakdown available once `discounts.category` is populated
  - See also: `discount_usage_rate` (Phase 1+ secondary diagnostic — count-based, not a replacement for this metric)

- [ ] `full_price_order_ratio(store_id, date_from, date_to)` — % of orders at full price (count-based)
  - Complement of `discount_usage_rate` (both count-based); does NOT sum to 100% with value-based `discount_dependency`

### 2.4 Materialised Views (static, refreshed on demand)

- [ ] `v_active_opportunities` — active opportunities with store currency code
  - Simple filter + join on `opportunities WHERE status = 'active'`

- [ ] `v_recoverable_contribution` — one row per store; `SUM(uplift_low)` and `SUM(uplift_high)` where active
  - Replaces `RECOVERABLE_LOW` / `RECOVERABLE_HIGH` from `business-snapshot.ts`

- [ ] `v_current_cost_assumptions` — latest `store_cost_assumptions` row per store (`DISTINCT ON (store_id)`)
  - Used by `commerceMetrics.ts` instead of hardcoded `costAssumptions.ts`

- [ ] `v_net_sales` — per-order net sales excluding VAT
  - Formula: `gross_sales - discounts - refunds - tax` for `paid` / `partially_refunded` orders

---

## 3. Metrics Currently Supported (Live from Supabase)

These metrics are already computed at runtime from the Supabase `orders` table via `commerceMetrics.ts`. They will show real values as soon as Shopify order data is ingested.

| Metric | Computed Via | Dashboard Tile |
|---|---|---|
| **Net Sales** | `commerceMetrics.netSales` — `gross_sales - discounts - refunds - tax` per order | Yes (row 1) |
| **Contribution Margin %** | `commerceMetrics.contributionMarginPercent` — net sales minus variable costs from `store_cost_assumptions` | Yes (row 1) |
| **Monthly Revenue** | `commerceMetrics.totalRevenue` — `SUM(total_sales)` | Yes (row 2) |
| **Average Order Value** | `commerceMetrics.averageOrderValue` — `totalRevenue / orderCount` ⚠️ **formula mismatch:** frontend uses `total_sales / count(*)` (all orders); Supabase function `average_order_value()` uses `net_sales / qualifying_order_count` (canonical). Dashboard tile shows frontend figure until wiring step. Do not change frontend formula before wiring | Yes (row 2) |
| **Repeat Purchase Rate** | `commerceMetrics.repeatPurchaseRate` — multi-order customer ratio from `customer_id` grouping | Yes (row 2) |
| **Discount Dependency** | `commerceMetrics.discountRate` — `totalDiscounts / grossSales` | Yes (row 2) |
| **Refund Rate** | `commerceMetrics.refundRate` — `totalRefunds / grossSales` | Yes (row 3) |
| **Live Order Leakage Estimate** | `commerceMetrics.liveOrderLeakageEstimate` — excess discount + refund + payment fee losses above benchmarks | Internal diagnostic only — not shown in a KPI tile |

**Note:** These metrics return zero when the `orders` table is empty. They do not fall back to mock values — they show what the data actually contains.

---

## 4. Metrics Still Mock / Hardcoded

These metrics cannot go live until the corresponding integration or table is connected.

### Hardcoded in TypeScript data files — require Supabase tables

| Metric | Current Source | Blocked On | Target Table |
|---|---|---|---|
| **Recoverable Contribution** (KPI tile) | `business-snapshot.ts` `RECOVERABLE_LOW = 18000`, `RECOVERABLE_HIGH = 42000` | `opportunities` table seeded with active rows | `v_recoverable_contribution` view |
| **Weekly priorities** (action rows) | `CFO_INSIGHT.weeklyPriorities` static array in `dashboard.tsx` | `opportunities` table with `action_label`, `why_label`, `priority_rank` | `opportunities` |
| **Impact metric chips** (+£42k, +£64k, +0.8 months, +4.2pp) | Hardcoded in `dashboard.tsx` | Computed from active opportunities + settings | `opportunities`, `store_settings` |
| **Cost assumptions** (payment fees, fulfilment, packaging, return handling) | `costAssumptions.ts` static constants | `store_cost_assumptions` table | `store_cost_assumptions` |

### Hardcoded — require Xero integration (Phase 2)

| Metric | Current Source | Blocked On |
|---|---|---|
| **Cash Runway** | `cash-snapshot.ts` `CASH_RUNWAY = 3.4` | Xero bank balance + P&L fixed costs |
| **Net Profit** | KPI_CARDS inline string `"£56,300"` | Xero P&L — contribution minus fixed overheads |
| **Cash Balance** | `cash-snapshot.ts` `CASH_BALANCE = 186000` | Xero bank account reconciliation |
| **Monthly Fixed Costs** | `cash-snapshot.ts` `MONTHLY_FIXED_COSTS = 120000` | Xero nominal code mapping |
| **Working Capital Drag** | `cash-snapshot.ts` `WORKING_CAPITAL_DRAG = 74000` | Shopify inventory + Xero AP |
| **Inventory Days** | `cash-snapshot.ts` `INVENTORY_DAYS = 82` | `product_variants.cost` + inventory levels |
| **Supplier Days** | `cash-snapshot.ts` `SUPPLIER_DAYS = 42` | Xero bills / AP ageing |
| **Returns Fulfilment Cost** | Zero / absent | Xero nominal code mapping or manual merchant input |

### Mock / static text — require Phase 4 (Meta / Google Ads)

| Metric | Current Source | Blocked On |
|---|---|---|
| **Acquisition Efficiency (Meta CAC)** | KPI_CARDS inline string `"Meta CAC +14%"` | `marketing_spend` table + Meta Ads API |
| **Blended CAC** | `channel-metrics.ts` static constant | `marketing_spend` + `customers` |
| **Blended ROAS** | `channel-metrics.ts` static constant | `marketing_spend` + Shopify order attribution |
| **CAC Payback** | `growth-metrics.ts` `CAC_PAYBACK = 1.4` | Blended CAC + contribution per order |
| **GQ Score** | `growth-metrics.ts` `GQ_SCORE = "B-"` | Repeat rate + discount dependency + CAC payback (all live) |

### Mock — Business Health Scorecard and CFO Alerts

| Component | Current Source | Blocked On |
|---|---|---|
| **Overall health status** (AMBER — Moderate Risk) | Hardcoded string | Weighted risk score across all metric categories |
| **Health pills** (Profitability, Margin Quality, Runway, etc.) | Hardcoded text in `TOP_DRIVERS` | Live metric values vs `store_settings` thresholds |
| **All CFO Alerts** | Hardcoded narrative | `cfo_alerts` table + live metric compute cycle |
| **Retention status** (Strengthening / Stable / Weakening) | `growth-metrics.ts` `RETENTION_STATUS` constant | `REPEAT_RATE` MoM delta from `metric_snapshots` |

---

## 5. Data Quality Checks Required

Run these checks after every sync. Results should be stored in a `data_quality_flags` table (schema TBD in Phase 2) and surfaced as badges or warnings on affected pages.

- [ ] **4.1 Guest checkout rate**
  - Compute: `guest_orders / total_orders × 100`
  - Threshold: < 10% = OK · 10–25% = WARN badge on Repeat Rate · > 25% = LOW confidence, alert
  - Surface on: Dashboard (Repeat Purchase Rate tile), Growth Quality page
  - Action if triggered: Recommend enabling Shopify customer accounts

- [ ] **4.2 Pending `financial_status` orders**
  - Compute: count and value of orders with `financial_status = 'pending'`
  - Threshold: 0 = OK · 1–5 or < 1% of value = INFO · > 5 or > 1% of value = WARN
  - Surface on: All revenue pages — flag period totals as "preliminary"
  - Action if triggered: Show "N orders pending — totals may shift when payments settle"

- [ ] **4.3 Silent markdowns (compare_at_price > price without a discount code)**
  - Compute: `SUM((compare_at_price - price) × quantity)` for `is_markdown = true` line items
  - Threshold: > £0 = WARN
  - Surface on: Pricing Optimisation page
  - Action if triggered: Show "An estimated £X in markdowns are not captured in your discount codes"

- [ ] **4.4 Partial refund double-counting check**
  - Compute: orders with `financial_status = 'partially_refunded'` and multiple refund events; compare cumulative refund total vs `orders.total_price`
  - Threshold: internal only — not surfaced to merchant
  - Action if triggered: Engineering alert; auto-reconcile `orders.total_refunded` field

- [ ] **4.5 Variant cost coverage**
  - Compute: `variants_with_cost / total_active_variants × 100`
  - Threshold: ≥ 90% = OK · 70–89% = WARN · < 70% = ALERT, LOW confidence on inventory metrics
  - Surface on: Cash Control page (inventory value card)
  - Action if triggered: Prompt merchant to complete variant costs via Shopify admin bulk edit

- [ ] **4.6 Gross revenue assertion** *(add at query time)*
  - Assert: `gross_revenue() ≈ net_revenue() + discount_cost() + return_amount() ± £10`
  - Action if assertion fails: Log discrepancy; flag revenue totals as "reconciliation in progress"

- [ ] **4.7 Average discount % cross-check** *(add at query time)*
  - Assert: `average_discount_pct()` ≈ `discount_cost() / gross_revenue() × 100 ± 0.1pp`
  - Action if assertion fails: Log; surface "Discount figures may include rounding differences"

---

## 6. Open Questions Before Shopify Integration

These must be answered — or provisional decisions documented — before the Phase 1 ingestion pipeline is built. They are drawn from `data-dictionary-v1.md §5`.

### 6.1 Xero Nominal Code Mapping — provisional decision required

**Question:** Xero does not classify nominal codes as fixed or variable automatically. The `MONTHLY_FIXED_COSTS` and `ANNUAL_VARIABLE_COSTS` figures are currently hardcoded. How will this classification be handled at onboarding?

- [ ] Decide: present all active nominal codes at onboarding and ask merchant to classify each, OR use Xero `Class = DIRECTCOSTS` → `variable` / `OVERHEADS` → `fixed` as defaults with merchant override
- [ ] Decide: what to show if merchant skips this step (fall back to hardcoded values with a WARN badge, or block dashboard until done?)
- [ ] Design the onboarding UI step for nominal code classification before Phase 2

### 6.2 Shopify Discount Code Categorisation — setup step design

**Question:** `DISCOUNT_DEP` currently treats all discount codes equally. Loyalty codes are strategically different from margin-diluting promotions. The `discounts.category` column is in the schema but requires a merchant setup step.

- [ ] Decide: is discount categorisation required at Phase 1 launch or can it be deferred?
- [ ] If deferred: what does `DISCOUNT_DEP` show and what WARN badge is displayed?
- [ ] Design the onboarding step that lists active price rules and lets the merchant tag each as `loyalty / promotional / referral / wholesale / other`

### 6.3 Returns Fulfilment Cost — fallback value

**Question:** `RETURNS_IMPACT` has two components: lost revenue (from Shopify) and reverse-logistics cost (from Xero or manual input). The fulfilment cost component is unavailable in Phase 1.

- [ ] Decide: show `RETURNS_IMPACT` as revenue-only in Phase 1 with a "Fulfilment cost excluded" badge?
- [ ] OR: add a manual override field at onboarding ("Average cost per returned order: £___")
- [ ] Document which approach is taken in `metric-status-v1.md`

### 6.4 Operating Bank Account Tagging — Xero Phase 2 preparation

**Question:** Xero often holds multiple bank accounts (operating, savings, credit card, foreign currency). `CASH_BALANCE` must only sum accounts the merchant considers "available operating cash."

- [ ] Decide: design the bank account tagging UI step for when Xero is connected (Phase 2)
- [ ] Document which account types default to `operating` vs `excluded`
- [ ] Confirm: is this step blocking for `CASH_RUNWAY` to display, or does it fall back to sum-all-accounts?

### 6.5 Attribution Confidence Framework

**Question:** Channel attribution is inherently imperfect. The same order may be claimed by Meta, Google, and Klaviyo. Without a defined confidence framework, marketing metrics are untrustworthy.

- [ ] Decide: adopt the three-tier confidence framework (`HIGH / MEDIUM / LOW`) as designed in `data-dictionary-v1.md §5.5`
- [ ] Decide: minimum attribution gap ratio before an `ALERT` fires (`< 70%` or `> 130%` of Shopify revenue attributed)
- [ ] Decide: is Conversions API required for Phase 4 launch, or is pixel-only (`MEDIUM` confidence) acceptable at launch?

### 6.6 Backfill Period

**Question:** On first Shopify connection, how much order history should be backfilled?

- [ ] Decide: recommended default is 24 months; confirm this is acceptable for all planned metrics (MoM comparisons need 13 months minimum; GQ_SCORE trend needs 12 months)
- [ ] Decide: what happens to stores with < 12 months of history? Suppress MoM comparisons or show partial data with a badge?

### 6.7 Guest Checkout Handling — first-order detection

**Question:** Guest checkouts create orders without a `customer_id`. Repeat-rate detection is impossible for unlinked guests. This may materially affect stores with high guest checkout rates.

- [ ] Decide: should the app attempt email-based guest linkage heuristics (match guest email to existing customer email) at ingest time?
- [ ] If yes: document the heuristic and its confidence level; add `customer_id` after matching
- [ ] If no: surface guest rate prominently during onboarding so merchants understand the repeat-rate limitation

### 6.8 Multi-Currency Stores

**Question:** `shopify-phase-1-schema.md` explicitly defers multi-currency to a future phase. However, some merchants will have international orders in non-base currencies.

- [ ] Confirm: Phase 1 will store and display all monetary values in the store's base currency only (`stores.currency_code`)
- [ ] Decide: how should orders in non-base currencies be handled? Convert at ingest time using the Shopify `presentment_money` → `shop_money` conversion? Or exclude them with a badge?

### 6.9 Period Basis Unification

**Question:** The three TypeScript mock data files currently use three different revenue period bases:
- `business-snapshot.ts` — 520k annual / 124.5k monthly
- `pricing-metrics.ts` — 420k "pricing period"
- `cash-snapshot.ts` — annual basis

`data-dictionary-v1.md §3.5` notes: *"the three period constants must be unified before go-live."*

- [ ] Decide: unify to a single date-range parameterised function before Phase 1 goes live, OR ship with the split and address it in Phase 2
- [ ] If unified: update `commerceMetrics.ts` to accept `date_from` / `date_to` and remove the hardcoded period constants from all data files

---

*Document version: 1.0 · Created: April 2026*
*Derived from: `data-dictionary-v1.md`, `shopify-phase-1-schema.md`, `supabase-schema-v1.md`, `metric-status-v1.md`*
*Owner: Virtual CFO product / engineering team*
*Update trigger: When a checklist item is completed or an open question is resolved.*
