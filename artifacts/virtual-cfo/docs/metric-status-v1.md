# Virtual CFO — Metric Status Dictionary v1

> **Status:** April 2026 · Living document — update when a metric transitions from mock/hardcoded to live.
> **Purpose:** Per-metric record of what each KPI is, where its value currently comes from, and what it needs to go live.
> **Companion documents:**
> - `docs/data-dictionary-v1.md` — detailed formula documentation and confidence risk notes
> - `docs/shopify-phase-1-schema.md` — raw Shopify table schemas
> - `docs/supabase-schema-v1.md` — full minimum v1 schema including non-Shopify tables

---

## How to read this document

**Current state** can be one of four values:

| State | Meaning |
|---|---|
| `LIVE` | Value is computed at runtime from a real Supabase query. Shows real data when the orders table has rows. |
| `HARDCODED` | Value is a static constant in a TypeScript data file. Never changes at runtime regardless of DB state. |
| `MOCK` | Value is assembled from representative placeholder data (e.g. a fixed percentage or narrative string). Structurally correct but not real. |
| `FUTURE` | Metric exists in the UI design but has no computation or data source yet. Blocked on an integration not yet built. |

---

## 1. Dashboard KPI Tiles

These are the eleven tiles on the Business Control Centre dashboard, rendered via `liveKpiCards` in `dashboard.tsx`. Static fallback values are declared in `KPI_CARDS`; a Supabase query result via `getCommerceMetrics()` overrides them when data is present.

| # | Metric | Definition | Current State | Current Source | Future Source | Supabase Table | Key Fields Required |
|---|---|---|---|---|---|---|---|
| 1 | **Net Sales** | Gross sales minus discounts, refunds, and VAT/tax | `LIVE` | `orders` table → `commerceMetrics.netSales` | Shopify → `orders` | `orders` | `gross_sales`, `discounts`, `refunds`, `tax` |
| 2 | **Contribution Margin %** | Net sales minus variable costs, as a % of net sales | `LIVE` | `orders` table → `commerceMetrics.contributionMarginPercent` via `costAssumptions.ts` | Shopify + Xero variable costs | `orders`, `store_cost_assumptions` | `gross_sales`, `discounts`, `refunds`, `tax`, `payment_fee_rate`, `fulfilment_cost_per_order` |
| 3 | **Recoverable Contribution** | Estimated monthly contribution recovery from fixing identified margin leakage | `HARDCODED` | `business-snapshot.ts` → `RECOVERABLE_LOW` / `RECOVERABLE_HIGH` (£18k–£42k) | Internal opportunity engine → sum of active `opportunities.uplift_low / uplift_high` | `opportunities` | `uplift_low`, `uplift_high`, `status`, `store_id` |
| 4 | **Cash Runway** | Months of fixed costs covered by current cash balance | `HARDCODED` | `cash-snapshot.ts` → `CASH_RUNWAY` (3.4 months) | Xero bank balance + P&L fixed costs | `store_settings` (Xero data — Phase 2) | `cash_balance`, `monthly_fixed_costs` |
| 5 | **Monthly Revenue** | Gross sales total for the current calendar month | `LIVE` | `orders` table → `commerceMetrics.totalRevenue` | Shopify → `orders` | `orders` | `total_sales`, `created_at` |
| 6 | **Average Order Value** | Total revenue divided by order count | `LIVE` | `orders` table → `commerceMetrics.averageOrderValue` | Shopify → `orders` | `orders` | `total_sales` |
| 7 | **Repeat Purchase Rate** | % of paying customers who have placed more than one order | `LIVE` | `orders` table → `commerceMetrics.repeatPurchaseRate` via `customer_id` grouping | Shopify → `orders` + `customers` | `orders`, `customers` | `customer_id`, `customers.first_order_at` |
| 8 | **Discount Dependency** | % of orders that include a discount code | `LIVE` | `orders` table → `commerceMetrics.discountRate` | Shopify → `orders` | `orders` | `discounts` (amount > 0 flag) |
| 9 | **Acquisition Efficiency (Meta CAC)** | Meta customer acquisition cost trend vs prior period | `HARDCODED` | Inline string in `KPI_CARDS` ("Meta CAC +14%") | Meta Ads API → `marketing_spend` table | `marketing_spend`, `customers` | `channel`, `spend`, `new_customer_count`, `period_start`, `period_end` |
| 10 | **Refund Rate** | Refund value as a % of gross sales | `LIVE` | `orders` table → `commerceMetrics.refundRate` | Shopify → `orders` (refund amounts) | `orders` | `gross_sales`, `refunds` |
| 11 | **Net Profit** | EBITDA / trading profit after all costs | `HARDCODED` | Inline string in `KPI_CARDS` ("£56,300") | Xero P&L — contribution minus fixed overheads | `store_settings` (Xero data — Phase 2) | `contribution`, `monthly_fixed_costs` |

---

## 2. Opportunity / Action Blocks

The three narrative blocks beneath the AI CFO card that form the diagnostic flow: opportunity → priorities → impact.

| Block | Title | Current State | Current Source | Future Source | Supabase Table | Key Fields Required |
|---|---|---|---|---|---|---|
| 1 | **Recoverable Contribution Identified** (£18k–£42k headline) | `HARDCODED` | `business-snapshot.ts` `RECOVERABLE_LOW` / `RECOVERABLE_HIGH` | `opportunities` table — sum of active `uplift_low` / `uplift_high` | `opportunities` | `store_id`, `status`, `uplift_low`, `uplift_high` |
| 2 | **What to Focus on This Week** (three priority rows) | `MOCK` | `CFO_INSIGHT.weeklyPriorities` array in `dashboard.tsx` — static text | Derived from top-ranked active opportunities by `estimated_impact_low DESC` | `opportunities` | `store_id`, `title`, `action_label`, `why`, `estimated_impact_low`, `priority_rank` |
| 3 | **Expected Impact if Implemented** (metric chips) | `MOCK` | Hardcoded chip values in `dashboard.tsx` (+£42k, +£64k, +0.8 months, +4.2pp) | Computed from active opportunities and Xero P&L projections | `opportunities`, `store_settings` | Contribution uplift sum, cash improvement estimate, runway extension |

---

## 3. Business Health Scorecard

The amber/green/red status panel at the top of the dashboard.

| Component | Current State | Current Source | Future Source | Supabase Table |
|---|---|---|---|---|
| **Overall status** (AMBER — Moderate Risk) | `MOCK` | Hardcoded string in `dashboard.tsx` | Computed from weighted risk scores across all metric categories | `metric_snapshots` or computed at query time |
| **Profitability** health pill | `MOCK` | `TOP_DRIVERS` array — static text | Derived from `MONTHLY_CM_PCT` vs target threshold | `store_settings` (target CM%), `orders` |
| **Margin Quality** health pill | `MOCK` | `TOP_DRIVERS` array — static text | Derived from `MONTHLY_CM_PCT` MoM delta | `metric_snapshots` (prior period CM%) |
| **Cash Runway** health pill | `MOCK` | Hardcoded | Derived from `CASH_RUNWAY` < 3 → red, 3–6 → amber, >6 → green | `store_settings` (Xero Phase 2) |
| **Acquisition Efficiency** health pill | `MOCK` | Hardcoded | Derived from Meta CAC MoM delta | `marketing_spend` |
| **Retention** health pill | `MOCK` | `RETENTION_STATUS` constant in `growth-metrics.ts` | Derived from `REPEAT_RATE` − `REPEAT_RATE_PREV` threshold logic | `orders`, `customers` |

---

## 4. CFO Alert Signals

Alerts displayed in the CFO Alerts page and the dashboard status bar.

| Alert | Trigger Condition | Current State | Current Source | Future Source | Supabase Table |
|---|---|---|---|---|---|
| Margin alert | `MONTHLY_CM_PCT` below target | `MOCK` | Hardcoded in `CFO_INSIGHT.body` | Computed at query time vs `store_settings.cm_target_pct` | `orders`, `store_settings` |
| Cash runway alert | `CASH_RUNWAY` < 3 months | `MOCK` | Hardcoded | Computed from Xero bank + fixed costs | `store_settings` |
| Discount dependency alert | `DISCOUNT_DEP` > threshold | `MOCK` | `DISCOUNT_DEP = 38.0` from `growth-metrics.ts` | Computed from `orders` vs `store_settings.discount_dep_alert_threshold` | `orders`, `store_settings` |
| CAC efficiency alert | Meta CAC rising vs prior period | `MOCK` | Hardcoded "+14%" string | Computed from `marketing_spend` MoM delta | `marketing_spend` |
| Contribution decline alert | Month-on-month contribution drop | `MOCK` | Hardcoded in driver text | Computed from `metric_snapshots` prior vs current period | `metric_snapshots` |

---

## 5. Cost Assumptions — Current vs Target

These values power the contribution margin calculation in `commerceMetrics.ts`. Currently hardcoded in `costAssumptions.ts`. Must become per-store configurable.

| Assumption | Current Value | Current Source | Target Source | Supabase Table | Column |
|---|---|---|---|---|---|
| Payment fee rate | 2.5% of net sales | `costAssumptions.ts` `paymentFeeRate` | Merchant input at onboarding (or Xero bank fee data) | `store_cost_assumptions` | `payment_fee_rate` |
| Fulfilment cost per order | £4.00 | `costAssumptions.ts` `fulfilmentCostPerOrder` | Merchant input or Xero nominal code mapping | `store_cost_assumptions` | `fulfilment_cost_per_order` |
| Packaging cost per order | £1.00 | `costAssumptions.ts` `packagingCostPerOrder` | Merchant input | `store_cost_assumptions` | `packaging_cost_per_order` |
| Return handling cost per refund | £2.00 | `costAssumptions.ts` `returnHandlingCostPerRefund` | Xero or merchant manual input | `store_cost_assumptions` | `return_handling_cost_per_refund` |
| Benchmark discount rate | 10% | Hardcoded in `commerceMetrics.ts` | Configurable per merchant or industry | `store_cost_assumptions` | `benchmark_discount_rate` |
| Benchmark refund rate | 5% | Hardcoded in `commerceMetrics.ts` | Configurable per merchant or industry | `store_cost_assumptions` | `benchmark_refund_rate` |
| Benchmark payment fee rate | 2% | Hardcoded in `commerceMetrics.ts` | Configurable per merchant or industry | `store_cost_assumptions` | `benchmark_payment_fee_rate` |

---

## 6. Mock Data Files — Transition Tracker

Summary of each static data file and its migration status.

| File | Values It Holds | All Pages Using It | Migration Phase | Blocks On |
|---|---|---|---|---|
| `business-snapshot.ts` | `ANNUAL_REVENUE`, `MONTHLY_REVENUE`, `MONTHLY_CM_PCT`, `MONTHLY_CM_VALUE`, `CONTRIBUTION_PER_ORDER`, `MONTHLY_ORDER_VOLUME`, `RECOVERABLE_LOW`, `RECOVERABLE_HIGH`, `CONTRIBUTION`, `BASE_EBITDA` | Dashboard, Margin Analysis, Profit Engine, Cash Control, Scenario Lab | Phase 1 (Shopify) + Phase 2 (Xero) | `orders` + `store_cost_assumptions` tables live |
| `cash-snapshot.ts` | `CASH_BALANCE`, `CASH_RUNWAY`, `MONTHLY_FIXED_COSTS`, `WORKING_CAPITAL_DRAG`, `NET_CASH_MOVEMENT`, `INVENTORY_DAYS`, `SUPPLIER_DAYS`, `CASH_CONVERSION_CYCLE` | Cash Control, Scenario Lab, Dashboard | Phase 2 (Xero) | Xero bank + P&L integration |
| `growth-metrics.ts` | `REPEAT_RATE`, `DISCOUNT_DEP`, `CAC_PAYBACK`, `GQ_SCORE`, `RETENTION_STATUS` | Growth Quality, Dashboard, Marketing Efficiency, Margin Analysis | Phase 1 (Shopify orders + customers) + Phase 4 (Meta) | `orders`, `customers`, `marketing_spend` tables live |
| `channel-metrics.ts` | `BLENDED_CAC`, `BLENDED_ROAS`, `META_CAC`, `CHANNEL_BREAKDOWN` | Marketing Efficiency, Dashboard | Phase 4 (Meta + Google Ads APIs) | `marketing_spend` table live |
| `pricing-metrics.ts` | `GROSS_REVENUE`, `DISCOUNT_COST`, `NET_RETAINED`, `BASE_CONTRIBUTION`, `AVG_DISCOUNT_PCT`, `CONTRIBUTION_PER_ORDER` (pricing basis) | Pricing Optimisation, Scenario Lab | Phase 1 (Shopify) | `orders` table live |
| `costAssumptions.ts` | `paymentFeeRate`, `fulfilmentCostPerOrder`, `packagingCostPerOrder`, `returnHandlingCostPerRefund` | `commerceMetrics.ts` (all pages via computed metrics) | Any phase — these are merchant settings | `store_cost_assumptions` table live |

---

*Document version: 1.0 · Created: April 2026*
*Update trigger: When any metric transitions state (hardcoded → live, mock → live), update the Current State column and add a transition date note.*
