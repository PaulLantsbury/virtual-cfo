# Virtual CFO — Supabase Schema v1

> **Status:** Design only · April 2026 · No tables built yet beyond the development `orders` stub.
> **Scope:** Minimum schema needed to support all dashboard metrics in a production-ready, multi-tenant Supabase/PostgreSQL database.
> **This document covers:** Tables that are NOT in `shopify-phase-1-schema.md` — specifically the settings, opportunity, alert, marketing spend, and metric snapshot layers. Read both documents together for the complete picture.
> **Companion documents:**
> - `docs/shopify-phase-1-schema.md` — Shopify raw entity tables (orders, customers, refunds, products, discounts)
> - `docs/data-dictionary-v1.md` — Detailed formula and confidence documentation per metric
> - `docs/metric-status-v1.md` — Per-metric current state (live / hardcoded / mock / future)

---

## Contents

1. [Design Principles](#1-design-principles)
2. [Tables Covered Here vs Phase 1](#2-tables-covered-here-vs-phase-1)
3. [Table Schemas](#3-table-schemas)
   - 3.1 [store_cost_assumptions](#31-store_cost_assumptions)
   - 3.2 [store_settings](#32-store_settings)
   - 3.3 [opportunities](#33-opportunities)
   - 3.4 [cfo_alerts](#34-cfo_alerts)
   - 3.5 [marketing_spend](#35-marketing_spend)
   - 3.6 [metric_snapshots](#36-metric_snapshots)
4. [Derived Views](#4-derived-views)
5. [Row-Level Security](#5-row-level-security)
6. [Migration Sequence](#6-migration-sequence)

---

## 1. Design Principles

**All principles from `shopify-phase-1-schema.md` §1 apply here.** Key ones repeated for reference:

- Every table has `store_id uuid NOT NULL REFERENCES stores(id)` as the first column after the primary key.
- Internal UUIDs are primary keys. External IDs (Shopify, Meta) are stored in separate columns.
- All `*_at` columns are `timestamptz`. All monetary amounts are `numeric(12,2)` in the store's base currency.
- Source data is stored immutably. Computed values live in views or application code, not in base table columns.
- Row-Level Security (RLS) must be enabled on every table. See §5.

**Additional principles for this layer:**

- **Settings are versioned.** `store_cost_assumptions` and `store_settings` rows are never updated in place. A new row is inserted when values change, with an `effective_from` date. This preserves historical metric accuracy.
- **Opportunities are mutable.** An opportunity changes `status` over its lifecycle (`draft → active → resolved / dismissed`). Status changes are the primary trigger for recomputing `RECOVERABLE_LOW` / `RECOVERABLE_HIGH`.
- **Alerts are stateful.** A `cfo_alerts` row tracks whether an alert is currently triggered, when it last fired, and whether the merchant has acknowledged it.
- **Marketing spend is append-only.** A new row is inserted for each day × channel × store combination. Existing rows are never mutated; gaps (days with no spend) have no row rather than a zero row.

---

## 2. Tables Covered Here vs Phase 1

### In `shopify-phase-1-schema.md` (do not redefine here)

| Table | Purpose |
|---|---|
| `stores` | Merchant identity, Shopify OAuth, sync status |
| `orders` | Revenue fact table — all order-level monetary data |
| `order_line_items` | Line item detail for SKU-level margin |
| `refunds` | Refund events per order |
| `refund_line_items` | Line item detail within a refund |
| `customers` | Customer identity and first-order date |
| `discounts` | Shopify price rules |
| `discount_codes` | Individual discount codes under each price rule |
| `products` | Shopify product catalogue |
| `product_variants` | SKU-level variant data including `cost` |

### Defined in this document

| Table | Purpose | Unlocks |
|---|---|---|
| `store_cost_assumptions` | Per-store variable cost rates (payment fees, fulfilment, packaging, return handling) and benchmark thresholds | Live contribution margin, recoverable contribution |
| `store_settings` | Per-store configuration (VAT rate, reporting timezone, CM target, alert thresholds, Xero account tags) | Alert triggers, health score thresholds, future Xero integration |
| `opportunities` | Recoverable contribution opportunities with uplift estimates | `RECOVERABLE_LOW`, `RECOVERABLE_HIGH`, weekly priorities block |
| `cfo_alerts` | Alert definitions, trigger state, and acknowledgement | CFO Alerts page, dashboard status bar |
| `marketing_spend` | Daily channel spend (Meta, Google, Email) | Meta CAC, BLENDED_ROAS, BLENDED_CAC, Growth Quality score |
| `metric_snapshots` | Cached computed metric values per store per period | MoM comparisons, prior-period badges, alert delta checks |

---

## 3. Table Schemas

### 3.1 `store_cost_assumptions`

Stores per-store variable cost rates and benchmark thresholds used by `commerceMetrics.ts` to compute contribution margin and recoverable contribution. Replaces the hardcoded `costAssumptions.ts` constants.

**Why versioned:** Changing a fulfilment cost rate changes all historical contribution calculations. Insert a new row with a new `effective_from` date — do not update in place.

```sql
CREATE TABLE store_cost_assumptions (
  id                            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                      uuid          NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Variable cost rates (applied to net sales or order count)
  payment_fee_rate              numeric(6,4)  NOT NULL DEFAULT 0.025,   -- e.g. 0.025 = 2.5%
  fulfilment_cost_per_order     numeric(10,2) NOT NULL DEFAULT 4.00,    -- £ per order
  packaging_cost_per_order      numeric(10,2) NOT NULL DEFAULT 1.00,    -- £ per order
  return_handling_cost_per_refund numeric(10,2) NOT NULL DEFAULT 2.00,  -- £ per returned order

  -- Benchmark thresholds (used to compute recoverable contribution)
  benchmark_discount_rate       numeric(6,4)  NOT NULL DEFAULT 0.10,    -- 10%
  benchmark_refund_rate         numeric(6,4)  NOT NULL DEFAULT 0.05,    -- 5%
  benchmark_payment_fee_rate    numeric(6,4)  NOT NULL DEFAULT 0.02,    -- 2%

  -- VAT / sales tax handling
  vat_rate                      numeric(6,4)  NOT NULL DEFAULT 0.20,    -- 20% UK VAT
  vat_inclusive_pricing         boolean       NOT NULL DEFAULT true,     -- true = prices include VAT

  -- Versioning
  effective_from                date          NOT NULL DEFAULT CURRENT_DATE,
  notes                         text,         -- e.g. "Updated after 3PL contract renegotiation"

  created_at                    timestamptz   NOT NULL DEFAULT now(),
  created_by                    text          -- user ID or 'system' for default seed
);
```

**Indexes:**
```sql
INDEX idx_store_cost_assumptions_store_period
  ON store_cost_assumptions (store_id, effective_from DESC);
```

**Query pattern — fetch current assumptions for a store:**
```sql
SELECT * FROM store_cost_assumptions
WHERE store_id = $1
ORDER BY effective_from DESC
LIMIT 1;
```

**Metrics supported:**

| Metric | How |
|---|---|
| `contributionMarginPercent` | `(net_sales - (net_sales × payment_fee_rate) - (order_count × fulfilment_cost_per_order) - (order_count × packaging_cost_per_order)) / net_sales` |
| `recoverableContribution` | Excess discount loss + excess refund loss + excess payment fees above respective benchmark rates |
| `netSales` | `gross_sales - discounts - refunds - (gross_sales × vat_rate)` when `vat_inclusive_pricing = true` |

**Pages consuming:** All pages via `commerceMetrics.ts`

**Transition from hardcoded:** Seed one row per store with the current `costAssumptions.ts` defaults at first launch. Merchant can update via a Settings page.

---

### 3.2 `store_settings`

Per-store configuration that does not belong in cost assumptions. Covers reporting preferences, alert thresholds, health score targets, and future integration metadata (Xero bank account tags, nominal code classifications).

```sql
CREATE TABLE store_settings (
  id                            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                      uuid          NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,

  -- Reporting preferences
  reporting_currency            text          NOT NULL DEFAULT 'GBP',  -- ISO 4217
  reporting_timezone            text          NOT NULL DEFAULT 'Europe/London', -- IANA tz

  -- Health score targets (used to compute health pill status)
  cm_target_pct                 numeric(5,2)  NOT NULL DEFAULT 45.00,  -- % contribution margin target
  cash_runway_amber_months      numeric(4,1)  NOT NULL DEFAULT 3.0,    -- below this → amber
  cash_runway_red_months        numeric(4,1)  NOT NULL DEFAULT 1.5,    -- below this → red

  -- Alert thresholds
  discount_dep_alert_threshold  numeric(5,2)  NOT NULL DEFAULT 40.00,  -- % — fire alert above this
  refund_rate_alert_threshold   numeric(5,2)  NOT NULL DEFAULT 8.00,   -- %
  cac_increase_alert_pct        numeric(5,2)  NOT NULL DEFAULT 15.00,  -- % MoM increase

  -- Xero integration (Phase 2) — populated on Xero connection
  xero_tenant_id                text,
  xero_operating_account_ids    text[],       -- bank account IDs tagged as 'operating'
  xero_fixed_nominal_codes      text[],       -- nominal codes classified as fixed costs
  xero_variable_nominal_codes   text[],       -- nominal codes classified as variable costs
  xero_last_sync_at             timestamptz,

  -- Merchant onboarding completion flags
  onboarding_cost_assumptions_confirmed  boolean NOT NULL DEFAULT false,
  onboarding_discount_categories_set     boolean NOT NULL DEFAULT false,
  onboarding_bank_accounts_tagged        boolean NOT NULL DEFAULT false,

  created_at                    timestamptz   NOT NULL DEFAULT now(),
  updated_at                    timestamptz   NOT NULL DEFAULT now()
);
```

**Indexes:**
```sql
UNIQUE INDEX idx_store_settings_store_id ON store_settings (store_id);
```

**Trigger — auto-update `updated_at`:**
```sql
CREATE TRIGGER trg_store_settings_updated_at
BEFORE UPDATE ON store_settings
FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

**Metrics supported:**

| Metric | How |
|---|---|
| Health pill status | Compare KPI value against `cm_target_pct`, `cash_runway_amber_months`, etc. |
| Alert trigger logic | Compare live metric vs `discount_dep_alert_threshold`, `refund_rate_alert_threshold`, `cac_increase_alert_pct` |
| `netSales` (VAT-exclusive) | Use `store_cost_assumptions.vat_rate` and `vat_inclusive_pricing` |

**Pages consuming:** Dashboard (health score), CFO Alerts, all pages for threshold-based coloring, Settings (future)

---

### 3.3 `opportunities`

Each row represents one identified recoverable contribution opportunity. The sum of active opportunities drives `RECOVERABLE_LOW` and `RECOVERABLE_HIGH` on the dashboard. The top-ranked active opportunities become the "What to focus on this week" rows.

```sql
CREATE TABLE opportunities (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              uuid          NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Identity
  title                 text          NOT NULL,   -- e.g. "Fulfilment cost optimisation"
  category              text          NOT NULL,   -- 'margin' | 'marketing' | 'fulfilment' | 'pricing' | 'retention'
  description           text          NOT NULL,   -- one-sentence summary for the opportunity card

  -- Weekly priority block fields
  action_label          text          NOT NULL,   -- short action text for Action column (max ~80 chars)
  why_label             text          NOT NULL,   -- why it matters (max ~120 chars)

  -- Uplift estimates (monthly contribution £)
  uplift_low            numeric(12,2) NOT NULL,   -- conservative estimate
  uplift_high           numeric(12,2) NOT NULL,   -- optimistic estimate
  confidence            text          NOT NULL DEFAULT 'Medium',  -- 'Low' | 'Medium' | 'Medium-High' | 'High'
  estimated_payback_days integer,                 -- days to recover cost of implementation, if applicable

  -- Recovery timeline
  recoverable_within_days integer     NOT NULL DEFAULT 60,  -- e.g. 30, 60, 90

  -- Priority ordering (lower = higher priority)
  priority_rank         integer       NOT NULL DEFAULT 99,

  -- Lifecycle
  status                text          NOT NULL DEFAULT 'active',
  -- 'draft'     — created but not yet surfaced to the merchant
  -- 'active'    — visible; contributes to RECOVERABLE_LOW / RECOVERABLE_HIGH sum
  -- 'in_progress' — merchant has marked as working on it
  -- 'resolved'  — merchant confirmed the fix was applied
  -- 'dismissed' — merchant chose to ignore

  -- Data quality
  data_staleness_days   integer,                 -- days since the underlying data was refreshed
  source_metric         text,                    -- e.g. 'discount_dependency', 'refund_rate', 'meta_cac'
  source_value          numeric(12,4),           -- the actual metric value that triggered this opportunity

  -- Timestamps
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now(),
  resolved_at           timestamptz,             -- NULL until resolved or dismissed
  dismissed_at          timestamptz
);
```

**Indexes:**
```sql
INDEX idx_opportunities_store_active
  ON opportunities (store_id, status, priority_rank)
  WHERE status = 'active';

INDEX idx_opportunities_store_category
  ON opportunities (store_id, category, status);

INDEX idx_opportunities_created_at
  ON opportunities (store_id, created_at DESC);
```

**Query pattern — compute `RECOVERABLE_LOW` / `RECOVERABLE_HIGH`:**
```sql
SELECT
  SUM(uplift_low)  AS recoverable_low,
  SUM(uplift_high) AS recoverable_high
FROM opportunities
WHERE store_id = $1
  AND status = 'active';
```

**Query pattern — weekly priorities (top 3 by rank):**
```sql
SELECT title, action_label, why_label, uplift_low, uplift_high
FROM opportunities
WHERE store_id = $1
  AND status = 'active'
ORDER BY priority_rank ASC
LIMIT 3;
```

**Metrics supported:**

| Metric | How |
|---|---|
| `RECOVERABLE_LOW` / `RECOVERABLE_HIGH` | `SUM(uplift_low / uplift_high) WHERE status = 'active'` |
| Weekly priorities (What to focus on this week) | Top 3 by `priority_rank` |
| Opportunity sources list | All active opportunities for a store |

**Pages consuming:** Dashboard, Profit Opportunities

---

### 3.4 `cfo_alerts`

One row per alert definition per store. Alert state is updated whenever the underlying metric is recomputed. The merchant can acknowledge (snooze) an alert; it re-triggers on the next compute cycle if the condition is still met.

```sql
CREATE TABLE cfo_alerts (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              uuid          NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Alert identity
  alert_key             text          NOT NULL,
  -- Standardised keys:
  -- 'margin_below_target'         — MONTHLY_CM_PCT < cm_target_pct
  -- 'cash_runway_low'             — CASH_RUNWAY < cash_runway_amber_months
  -- 'discount_dep_high'           — DISCOUNT_DEP > discount_dep_alert_threshold
  -- 'cac_increasing'              — CAC MoM delta > cac_increase_alert_pct
  -- 'refund_rate_high'            — REFUND_RATE > refund_rate_alert_threshold
  -- 'contribution_declining'      — MONTHLY_CM_PCT MoM delta < -2pp
  -- 'repeat_rate_declining'       — REPEAT_RATE MoM delta < -2pp

  title                 text          NOT NULL,  -- merchant-facing title
  description           text          NOT NULL,  -- explanation of why the alert fired
  severity              text          NOT NULL DEFAULT 'warning',  -- 'info' | 'warning' | 'critical'
  category              text          NOT NULL,  -- 'margin' | 'cash' | 'growth' | 'marketing'

  -- Trigger state
  is_triggered          boolean       NOT NULL DEFAULT false,
  trigger_value         numeric(12,4),           -- the metric value that triggered the alert
  trigger_threshold     numeric(12,4),           -- the threshold it crossed
  first_triggered_at    timestamptz,             -- when alert first became active
  last_triggered_at     timestamptz,             -- most recent trigger time
  last_computed_at      timestamptz,             -- when the underlying metric was last checked

  -- Acknowledgement / snooze
  acknowledged_at       timestamptz,             -- NULL = unacknowledged
  snoozed_until         timestamptz,             -- NULL = not snoozed; suppress display until this time
  acknowledged_by       text,                    -- user ID

  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now(),

  UNIQUE (store_id, alert_key)  -- one row per alert type per store
);
```

**Indexes:**
```sql
INDEX idx_cfo_alerts_store_triggered
  ON cfo_alerts (store_id, is_triggered, severity)
  WHERE is_triggered = true;

INDEX idx_cfo_alerts_store_key ON cfo_alerts (store_id, alert_key);
```

**Query pattern — fetch active, unacknowledged alerts for dashboard status bar:**
```sql
SELECT alert_key, title, severity, trigger_value, trigger_threshold
FROM cfo_alerts
WHERE store_id = $1
  AND is_triggered = true
  AND (snoozed_until IS NULL OR snoozed_until < now())
ORDER BY
  CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
  last_triggered_at DESC;
```

**Metrics supported:** Dashboard status bar alert count, CFO Alerts page full list

**Pages consuming:** Dashboard (status bar), CFO Alerts

---

### 3.5 `marketing_spend`

One row per day per channel per store. Append-only — no rows are updated after insertion. Missing days = zero spend (do not insert zero rows; handle in query).

Covers Meta (Facebook/Instagram), Google Ads, and Email (Klaviyo platform cost, allocated daily).

```sql
CREATE TABLE marketing_spend (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              uuid          NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Period
  spend_date            date          NOT NULL,  -- the calendar day this spend occurred

  -- Channel
  channel               text          NOT NULL,
  -- 'meta'    — Facebook/Instagram paid ads
  -- 'google'  — Google Shopping/Search
  -- 'email'   — Klaviyo/email platform cost (daily allocation of monthly fee)
  -- 'other'   — any other channel

  -- Spend
  spend_amount          numeric(12,2) NOT NULL,  -- total spend for this channel on this day
  currency_code         text          NOT NULL DEFAULT 'GBP',

  -- Attribution (platform-reported — not authoritative for revenue)
  platform_attributed_revenue  numeric(12,2),   -- platform's own reported attributed revenue
  platform_attributed_orders   integer,          -- platform's own reported attributed order count
  platform_roas                numeric(8,4),     -- platform-reported ROAS (spend / attributed revenue)

  -- New customer signal (Phase 4 — requires Conversions API or enhanced conversions)
  new_customer_count    integer,                 -- platform-reported new customer acquisitions

  -- Sync metadata
  external_account_id   text,                    -- Meta Ad Account ID or Google Ads Customer ID
  synced_at             timestamptz   NOT NULL DEFAULT now(),
  data_source           text          NOT NULL DEFAULT 'api',  -- 'api' | 'manual' | 'import'

  created_at            timestamptz   NOT NULL DEFAULT now(),

  UNIQUE (store_id, spend_date, channel)
);
```

**Indexes:**
```sql
INDEX idx_marketing_spend_store_date
  ON marketing_spend (store_id, spend_date DESC);

INDEX idx_marketing_spend_store_channel_date
  ON marketing_spend (store_id, channel, spend_date DESC);
```

**Query pattern — blended CAC for a period:**
```sql
WITH period_spend AS (
  SELECT SUM(spend_amount) AS total_spend
  FROM marketing_spend
  WHERE store_id = $1
    AND spend_date BETWEEN $period_start AND $period_end
),
new_customers AS (
  SELECT COUNT(*) AS count
  FROM customers
  WHERE store_id = $1
    AND first_order_at BETWEEN $period_start AND $period_end
)
SELECT
  period_spend.total_spend / NULLIF(new_customers.count, 0) AS blended_cac
FROM period_spend, new_customers;
```

**Query pattern — Meta CAC MoM delta:**
```sql
SELECT
  channel,
  SUM(spend_amount) FILTER (WHERE spend_date >= $this_month_start) AS this_month_spend,
  SUM(spend_amount) FILTER (WHERE spend_date >= $last_month_start AND spend_date < $this_month_start) AS last_month_spend
FROM marketing_spend
WHERE store_id = $1 AND channel = 'meta'
GROUP BY channel;
-- Then join with new customer counts per period from customers table
```

**Metrics supported:**

| Metric | How |
|---|---|
| `BLENDED_CAC` | `SUM(spend_amount) / new_customer_count` for the period |
| `CAC_BY_CHANNEL` (Meta) | `SUM(spend_amount WHERE channel = 'meta') / meta_new_customer_count` |
| `BLENDED_ROAS` | `shopify_attributed_revenue / SUM(spend_amount)` — uses Shopify `orders` as revenue source, not `platform_attributed_revenue` |
| Meta CAC MoM trend (dashboard pill) | Delta between current and prior period Meta CAC |

**Pages consuming:** Marketing Efficiency, Dashboard (Meta CAC tile), Growth Quality (CAC payback)

---

### 3.6 `metric_snapshots`

Caches computed metric values per store per period. Eliminates the need to re-run expensive Supabase aggregations on every page load. Also enables MoM comparison without a full recalculation of the prior period.

This table is written by a background compute job, not by the frontend. It is never written by the user.

```sql
CREATE TABLE metric_snapshots (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              uuid          NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Period
  period_start          date          NOT NULL,
  period_end            date          NOT NULL,
  period_label          text          NOT NULL,  -- e.g. 'March 2026', '2025-Q4', 'trailing-90d'
  period_type           text          NOT NULL,  -- 'monthly' | 'quarterly' | 'annual' | 'trailing_30d' | 'trailing_90d'

  -- Revenue metrics
  gross_revenue         numeric(12,2),
  total_discounts       numeric(12,2),
  total_refunds         numeric(12,2),
  net_sales             numeric(12,2),           -- gross - discounts - refunds - VAT
  order_count           integer,

  -- Contribution metrics
  contribution_margin   numeric(12,2),
  contribution_margin_pct  numeric(6,4),         -- e.g. 0.423 = 42.3%
  contribution_per_order   numeric(10,2),

  -- Cash metrics (Xero — Phase 2)
  cash_balance          numeric(12,2),
  monthly_fixed_costs   numeric(12,2),
  cash_runway_months    numeric(5,2),

  -- Growth quality metrics
  repeat_purchase_rate  numeric(6,4),            -- 0.28 = 28%
  discount_dependency   numeric(6,4),            -- 0.38 = 38%
  average_order_value   numeric(10,2),
  refund_rate           numeric(6,4),

  -- Marketing efficiency (Phase 4)
  blended_cac           numeric(10,2),
  meta_cac              numeric(10,2),
  blended_roas          numeric(8,4),

  -- Recoverable contribution
  recoverable_low       numeric(12,2),
  recoverable_high      numeric(12,2),

  -- Compute metadata
  computed_at           timestamptz   NOT NULL DEFAULT now(),
  computation_version   text          NOT NULL DEFAULT '1',   -- increment when formula changes
  data_quality          text          NOT NULL DEFAULT 'full', -- 'full' | 'partial' | 'estimated'
  -- 'full'      — all source data available for the period
  -- 'partial'   — some source data missing (e.g. Xero not yet connected)
  -- 'estimated' — period not yet closed; figures are month-to-date

  created_at            timestamptz   NOT NULL DEFAULT now()
);
```

**Indexes:**
```sql
INDEX idx_metric_snapshots_store_period
  ON metric_snapshots (store_id, period_type, period_start DESC);

UNIQUE INDEX idx_metric_snapshots_store_period_version
  ON metric_snapshots (store_id, period_start, period_type, computation_version);
```

**Query pattern — fetch current and prior month for MoM badges:**
```sql
SELECT *
FROM metric_snapshots
WHERE store_id = $1
  AND period_type = 'monthly'
ORDER BY period_start DESC
LIMIT 2;
-- Row 0 = current month, Row 1 = prior month
-- Delta: (row0.contribution_margin_pct - row1.contribution_margin_pct) * 100 = MoM change in pp
```

**Metrics supported:**

| Metric | How |
|---|---|
| All MoM change badges | Current row vs prior row for any metric field |
| Alert delta checks | `contribution_margin_pct` delta, `repeat_purchase_rate` delta, etc. |
| Dashboard top-line numbers (fast path) | Read from snapshot instead of aggregating `orders` table |

**Pages consuming:** Dashboard, Margin Analysis, Growth Quality, CFO Alerts (delta triggers)

---

## 4. Derived Views

These views simplify the most common queries and hide the join complexity from application code.

### 4.1 `v_active_opportunities`

```sql
CREATE VIEW v_active_opportunities AS
SELECT
  o.*,
  s.currency_code
FROM opportunities o
JOIN stores s ON o.store_id = s.id
WHERE o.status = 'active';
```

### 4.2 `v_recoverable_contribution`

Returns one row per store with the current RECOVERABLE_LOW and RECOVERABLE_HIGH.

```sql
CREATE VIEW v_recoverable_contribution AS
SELECT
  store_id,
  COALESCE(SUM(uplift_low),  0) AS recoverable_low,
  COALESCE(SUM(uplift_high), 0) AS recoverable_high,
  COUNT(*)                       AS opportunity_count
FROM opportunities
WHERE status = 'active'
GROUP BY store_id;
```

### 4.3 `v_current_cost_assumptions`

Returns the currently effective cost assumptions for each store (latest `effective_from` row).

```sql
CREATE VIEW v_current_cost_assumptions AS
SELECT DISTINCT ON (store_id)
  *
FROM store_cost_assumptions
ORDER BY store_id, effective_from DESC;
```

### 4.4 `v_net_sales`

Returns net sales per order, excluding VAT, for use in contribution margin queries.

```sql
CREATE VIEW v_net_sales AS
SELECT
  o.id,
  o.store_id,
  o.created_at,
  o.customer_id,
  o.gross_sales,
  o.discounts,
  o.refunds,
  o.tax,
  -- Net sales = gross minus discounts, refunds, and VAT
  (o.gross_sales - o.discounts - o.refunds - o.tax) AS net_sales,
  o.customer_id IS NULL AS is_guest_checkout
FROM orders o
WHERE o.financial_status IN ('paid', 'partially_refunded');
```

---

## 5. Row-Level Security

All tables must have RLS enabled. The pattern is identical for every table.

```sql
-- Enable RLS
ALTER TABLE store_cost_assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfo_alerts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_spend         ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_snapshots        ENABLE ROW LEVEL SECURITY;

-- Policy: users can only access rows where store_id matches their authenticated store
-- (Assumes a custom JWT claim `store_id` is set on the Supabase auth token at login)

CREATE POLICY rls_store_cost_assumptions ON store_cost_assumptions
  USING (store_id = (current_setting('app.current_store_id'))::uuid);

CREATE POLICY rls_store_settings ON store_settings
  USING (store_id = (current_setting('app.current_store_id'))::uuid);

CREATE POLICY rls_opportunities ON opportunities
  USING (store_id = (current_setting('app.current_store_id'))::uuid);

CREATE POLICY rls_cfo_alerts ON cfo_alerts
  USING (store_id = (current_setting('app.current_store_id'))::uuid);

CREATE POLICY rls_marketing_spend ON marketing_spend
  USING (store_id = (current_setting('app.current_store_id'))::uuid);

CREATE POLICY rls_metric_snapshots ON metric_snapshots
  USING (store_id = (current_setting('app.current_store_id'))::uuid);
```

**Note:** The `app.current_store_id` session variable must be set at the start of each connection (or in the Supabase edge function before running any query). This is the standard pattern for multi-tenant RLS in Supabase.

---

## 6. Migration Sequence

Tables should be created in this order to satisfy foreign key dependencies.

| Step | Table | Depends On | Unblocks |
|---|---|---|---|
| 1 | `stores` | — (in Phase 1 schema) | Everything |
| 2 | `store_settings` | `stores` | Alert thresholds, health score targets |
| 3 | `store_cost_assumptions` | `stores` | Live contribution margin, recoverable contribution |
| 4 | `orders`, `customers` | `stores` (in Phase 1 schema) | Revenue metrics, repeat rate |
| 5 | `opportunities` | `stores` | `RECOVERABLE_LOW / HIGH`, weekly priorities |
| 6 | `cfo_alerts` | `stores`, `store_settings` | CFO Alerts page |
| 7 | `marketing_spend` | `stores` | Meta CAC, BLENDED_CAC, BLENDED_ROAS |
| 8 | `metric_snapshots` | `stores`, all other tables | MoM badges, fast-path dashboard reads |

**Immediate priority (before any integration work):**

Steps 2, 3, and 5 can be created and seeded with mock values today without any external integration. This moves `Recoverable Contribution`, `Contribution Margin`, and the weekly priorities off hardcoded/mock data and onto the database — making them store-configurable without code changes.

```sql
-- Seed default cost assumptions for the development store
INSERT INTO store_cost_assumptions (store_id, payment_fee_rate, fulfilment_cost_per_order, packaging_cost_per_order, return_handling_cost_per_refund)
VALUES ($dev_store_id, 0.025, 4.00, 1.00, 2.00);

-- Seed store settings
INSERT INTO store_settings (store_id)
VALUES ($dev_store_id);

-- Seed initial opportunities (replaces hardcoded CFO_INSIGHT.weeklyPriorities)
INSERT INTO opportunities (store_id, title, category, description, action_label, why_label, uplift_low, uplift_high, confidence, priority_rank) VALUES
($dev_store_id, 'Fulfilment cost optimisation',      'fulfilment', 'Fulfilment costs are above the £4/order benchmark.', 'Audit fulfilment rates and renegotiate 3PL contract', 'Fulfilment costs grew 12% — now the largest margin drag', 6000, 14000, 'Medium-High', 1),
($dev_store_id, 'Discount discipline improvement',    'pricing',    'Discount dependency is above the 10% benchmark.',     'Remove blanket discount codes and test AOV-based offers', 'Excess discounting is diluting contribution by ~£4.2k/month', 5000, 15000, 'Medium',      2),
($dev_store_id, 'Marketing channel reallocation',     'marketing',  'Meta CAC is rising while ROAS is declining.',         'Shift budget from prospecting to retargeting campaigns',  'Meta CAC rose 14% MoM — payback period now > 1.4 orders',  7000, 13000, 'Medium',      3);
```

---

*Document version: 1.0 · Created: April 2026*
*Companion to `docs/shopify-phase-1-schema.md` — read both documents for the complete v1 schema.*
*Next review: When Phase 1 Shopify integration begins — validate column names against actual Shopify API response shapes.*
