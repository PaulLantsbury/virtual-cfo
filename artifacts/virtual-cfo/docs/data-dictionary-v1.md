# Virtual CFO — Data Dictionary v1

> **Status:** Draft · April 2026
> **Scope:** Covers all metrics in the five central mock data files. No integrations are built yet — this document defines what will replace the static mock values when live data is connected.
> **Companion documents:** `src/lib/data/business-snapshot.ts`, `cash-snapshot.ts`, `growth-metrics.ts`, `channel-metrics.ts`, `pricing-metrics.ts`

---

## Contents

1. [Source Systems](#1-source-systems)
2. [Raw Entities Required](#2-raw-entities-required)
3. [Derived Metric Layer](#3-derived-metric-layer)
4. [Integration Sequence](#4-integration-sequence)
5. [Open Questions and Setup Requirements](#5-open-questions-and-setup-requirements)

---

## 1. Source Systems

### 1.1 Shopify

Primary source of truth for all revenue, order, customer, discount, refund and inventory data.

| Property | Detail |
|---|---|
| API version | 2024-04 (minimum; use latest stable) |
| Auth method | OAuth 2.0 — merchant installs app via Shopify Partner |
| Rate limits | REST: 2 requests/s (leaky bucket, burst 40); GraphQL: 1000 cost units/s |
| Webhook support | Yes — `orders/create`, `orders/updated`, `refunds/create`, `customers/create` |
| Currency | Returns in shop currency; must store `currency_code` alongside all monetary fields |
| Time zone | All `created_at` timestamps are UTC — convert to merchant local timezone for period grouping |

**Key limitations:**
- `total_price` on an order is post-discount. Gross revenue requires `subtotal_price + total_discounts`.
- Guest checkouts do not create a `customer_id`. Repeat-purchase detection is impaired for unlinked guests.
- `variant.cost` (COGS per SKU) is optional and often unpopulated — must prompt merchant to complete.
- Shopify's own attribution (source_name, landing_site_ref) is last-click only.

---

### 1.2 Xero

Primary source of truth for cost structure, cash position, accounts payable, and fixed overhead classification.

| Property | Detail |
|---|---|
| API version | Xero API v2 |
| Auth method | OAuth 2.0 with offline access (refresh token) |
| Rate limits | 60 requests/min per app per tenant; daily limit 5,000 calls |
| Webhook support | Yes — limited to invoice/contact/bank transaction events |
| Multi-currency | Supported; normalise all values to base currency before storage |
| Reconciliation date | Expose `LastReconciliatedDate` per bank account — critical for cash confidence scoring |

**Key limitations:**
- Xero does not distinguish fixed from variable costs automatically. Nominal code mapping is required at setup (see §5.1).
- Payroll may be processed outside Xero (via Sage, ADP, or Gusto). If so, payroll entries may be absent from the P&L unless manually journalled in.
- Multiple bank accounts are common (operating, savings, credit card). Only tagged operating accounts should contribute to `CASH_BALANCE`.
- Timing differences between Shopify (cash received at order) and Xero (revenue recognised at invoice) will cause revenue reconciliation gaps.

---

### 1.3 Meta Ads

Source of channel spend, attributed revenue, and new-vs-returning customer signals for Meta (Facebook/Instagram) campaigns.

| Property | Detail |
|---|---|
| API | Marketing API v20.0 |
| Auth method | OAuth 2.0 — user-level or system user token |
| Rate limits | Tier-based on ad account spend; typically 200 calls/hour for standard accounts |
| Attribution windows | Default: 7-day click + 1-day view. Must be set consistently for cross-channel comparisons |
| Conversions API | Required for HIGH confidence — sends server-side purchase events with `new_customer` signal |

**Key limitations:**
- iOS 14.5+ signal loss means pixel-reported ROAS can deviate ±20–40% from actual Shopify revenue. Meta's modelled conversions partially compensate but are estimates.
- Without Conversions API, new vs returning customer split is unavailable — falls back to Shopify-side first-order detection.
- Platform-reported revenue (ROAS numerator) must not be used as the revenue source of truth. Shopify is authoritative; Meta figures are efficiency signals only.

---

### 1.4 Google Ads

Source of channel spend and attributed revenue for Google Shopping and Search campaigns.

| Property | Detail |
|---|---|
| API | Google Ads API v17 |
| Auth method | OAuth 2.0 — requires Google Ads Manager Account (MCC) access or direct account access |
| Rate limits | Standard: 15,000 operations/day per developer token; streaming reports have separate limits |
| Attribution windows | Default: 30-day click. Must be aligned to 7-day click for cross-channel consistency |
| Conversion tracking | Requires Google tag or Google Ads conversion import from GA4 |

**Key limitations:**
- Default 30-day attribution window will overstate Google's contribution vs Meta's 7-day window unless standardised.
- Google does not natively split new vs returning customer conversions without enhanced conversions or Customer Match.
- Campaign type matters — Shopping, Search, and Performance Max use different bidding signals; should be tracked separately.

---

### 1.5 Klaviyo / Email Platform

Source of email marketing spend (platform cost) and email-attributed order revenue.

| Property | Detail |
|---|---|
| Primary platform | Klaviyo (most common for Shopify DTC). Mailchimp and Omnisend are alternatives with similar APIs |
| API version | Klaviyo API v2024-02 |
| Auth method | API key (private key for server-side) |
| Revenue attribution | Klaviyo attributes an order if a customer clicks/opens an email within a configurable window (default 5-day click / 1-day open) |
| Rate limits | 3 requests/s; burst handling per endpoint |

**Key limitations:**
- Platform cost (monthly subscription fee) must be allocated across campaigns by revenue share or send volume — not available as a per-campaign field from the API.
- Attribution window for email (5-day click) is longer than typical ad-channel windows — email revenue can double-count with Meta/Google if same customer is attributed by multiple platforms.
- Klaviyo flow (automation) revenue should be separated from campaign (broadcast) revenue for accurate channel analysis.

---

### 1.6 Internal Opportunity Engine

Source for `RECOVERABLE_LOW` and `RECOVERABLE_HIGH` — the estimated monthly contribution improvement range shown on the Dashboard and Profit Opportunities page.

| Property | Detail |
|---|---|
| Type | Internal computed values — not an external API |
| Inputs | Active opportunity records with `uplift_low` and `uplift_high` fields |
| Update trigger | Recomputed whenever an opportunity is marked active, resolved, or dismissed |
| Current state | Static mock values (£18k low, £42k high) in `business-snapshot.ts` |

**Key limitations:**
- The opportunity uplift methodology must be documented per opportunity type (margin, marketing, fulfilment, etc.) to be credible.
- Estimates degrade over time if the underlying data feeding each opportunity model is stale.

---

## 2. Raw Entities Required

### 2.1 Shopify

| Entity | Key Fields | Used For |
|---|---|---|
| `orders` | `id`, `created_at`, `financial_status`, `subtotal_price`, `total_price`, `total_discounts`, `source_name`, `landing_site_ref`, `referring_site`, `customer_id`, `discount_codes[]` | Revenue, discount dependency, channel attribution |
| `refunds` | `id`, `order_id`, `created_at`, `refund_line_items[].subtotal`, `transactions[].amount` | Returns impact, net retained revenue |
| `customers` | `id`, `created_at`, `orders_count`, `total_spent`, `first_order_id` | Repeat purchase rate, new vs returning |
| `products.variants` | `id`, `product_id`, `sku`, `cost`, `inventory_item_id` | Inventory cost / COGS per unit |
| `inventory_levels` | `inventory_item_id`, `location_id`, `available` | Inventory value, inventory days |
| `payouts` | `id`, `amount`, `currency`, `status`, `date` | Pending settlement (working capital drag) |
| `discount_codes` / `price_rules` | `code`, `value_type`, `value`, `usage_count`, `title` | Discount categorisation |
| `marketing_events` | `channel`, `event_type`, `started_at`, `budget`, `currency` | Shopify-native channel tagging |

---

### 2.2 Xero

| Entity | Key Fields | Used For |
|---|---|---|
| `profit_and_loss` report | `date_from`, `date_to`, income lines, COGS lines, expense lines by `AccountCode` | Revenue recognition, variable costs, fixed overheads |
| `accounts` | `AccountID`, `Code`, `Name`, `Type`, `Class` | Nominal code classification (fixed vs variable) |
| `tracking_categories` | `TrackingCategoryID`, `Name`, `Options[]` | Department / cost-type tagging |
| `bank_accounts` | `AccountID`, `Name`, `Type`, `CurrencyCode`, `Balance` | Cash balance |
| `bank_transactions` | `BankTransactionID`, `Date`, `Amount`, `AccountID`, `IsReconciled` | Cash movement, reconciliation status |
| `bills` (accounts payable) | `InvoiceID`, `Contact`, `Date`, `DueDate`, `AmountDue`, `AmountPaid`, `LineItems[]` | Outstanding AP, supplier days |
| `invoices` (accounts receivable) | `InvoiceID`, `Date`, `DueDate`, `AmountDue`, `Status` | Outstanding AR (if applicable) |
| `credit_notes` | `CreditNoteID`, `Date`, `SubTotal`, `Contact` | Returns revenue reversal |

---

### 2.3 Meta Ads

| Entity | Key Fields | Used For |
|---|---|---|
| `ad_insights` | `campaign_id`, `campaign_name`, `date_start`, `date_stop`, `spend`, `purchase_roas`, `action_values[purchase]`, `actions[purchase]` | Channel spend, attributed revenue, ROAS |
| `conversions` (Conversions API) | `event_name`, `event_time`, `user_data`, `custom_data.value`, `custom_data.currency`, `custom_data.new_customer` | New vs returning customer split |
| `campaigns` | `id`, `name`, `status`, `objective`, `daily_budget`, `lifetime_budget` | Campaign structure / spend allocation |

---

### 2.4 Google Ads

| Entity | Key Fields | Used For |
|---|---|---|
| `campaign_performance_report` | `CampaignId`, `CampaignName`, `CampaignType`, `Cost`, `Conversions`, `ConversionValue`, `Date` | Channel spend, attributed revenue |
| `customer_acquisition` (new customer goal) | `new_customer_life_time_value`, `new_customer_percentage` | New vs returning split (if configured) |
| `ad_group_performance_report` | `AdGroupId`, `CampaignId`, `Impressions`, `Clicks`, `Cost`, `Conversions` | Sub-campaign efficiency |

---

### 2.5 Klaviyo

| Entity | Key Fields | Used For |
|---|---|---|
| `metrics` (Placed Order) | `metric_id`, `datetime`, `value`, `properties.OrderId`, `properties.$attributed_message` | Email-attributed order revenue |
| `campaigns` | `campaign_id`, `name`, `send_time`, `status`, `lists[]` | Campaign-level revenue grouping |
| `flows` | `flow_id`, `name`, `status` | Automation vs broadcast separation |
| `events` | `event_id`, `metric_id`, `timestamp`, `person_id`, `value` | Individual attributed conversions |

---

### 2.6 Internal Opportunity Engine

| Entity | Key Fields | Used For |
|---|---|---|
| `opportunities` | `id`, `title`, `category`, `status`, `uplift_low`, `uplift_high`, `confidence`, `created_at`, `resolved_at` | Recoverable contribution range (RECOVERABLE_LOW / RECOVERABLE_HIGH) |

---

## 3. Derived Metric Layer

### 3.1 `business-snapshot.ts` — P&L and Margin Metrics

> **Period note:** This file serves two period bases. The annual basis (520k revenue) feeds Profit Engine and Cash Control. The monthly snapshot (124.5k) feeds Dashboard and Margin Analysis. In production both derive from the same Shopify orders dataset filtered by a date-range parameter — they are not separate datasets.

---

#### `ANNUAL_REVENUE`

| Property | Detail |
|---|---|
| Formula | `sum(orders.subtotal_price + orders.total_discounts)` for the annual period |
| Source fields | `orders.subtotal_price`, `orders.total_discounts`, `orders.created_at`, `orders.financial_status` |
| Consuming pages | Profit Engine, Cash Control (simulator denominator) |
| Confidence risks | Shopify `total_price` is post-discount; must reconstruct gross using both fields or use Shopify Gross Sales report |
| Data quality flags | Assert `ANNUAL_REVENUE == ANNUAL_NET_REVENUE + ANNUAL_DISCOUNTS + ANNUAL_RETURNS` after computation |

---

#### `ANNUAL_DISCOUNTS`

| Property | Detail |
|---|---|
| Formula | `sum(orders.total_discounts)` for the annual period |
| Source fields | `orders.total_discounts`, `orders.created_at` |
| Consuming pages | Profit Engine |
| Confidence risks | Discount amounts only — does not include promotional pricing (markdowns baked into product price). Those are invisible to this metric |
| Data quality flags | Cross-check against Xero revenue adjustments if discounts are journalled |

---

#### `ANNUAL_RETURNS`

| Property | Detail |
|---|---|
| Formula | `sum(refunds.refund_line_items.subtotal) + (refund_count × avg_return_fulfilment_cost)` |
| Source fields | `refunds.refund_line_items[].subtotal`, `refunds.created_at`; `avg_return_fulfilment_cost` from Xero |
| Consuming pages | Profit Engine |
| Confidence risks | Returns fulfilment cost requires Xero data — if absent, RETURNS is understated |
| Data quality flags | Partial refunds: deduplicate by `refund_id`; track cumulative refunded amount per `order_id` to avoid double-counting |

---

#### `ANNUAL_NET_REVENUE`

| Property | Detail |
|---|---|
| Formula | `ANNUAL_REVENUE − ANNUAL_DISCOUNTS − ANNUAL_RETURNS` |
| Source fields | Derived |
| Consuming pages | Profit Engine |
| Confidence risks | Inherits risks from all three inputs |
| Data quality flags | None beyond inputs |

---

#### `ANNUAL_VARIABLE_COSTS`

| Property | Detail |
|---|---|
| Formula | `xero.COGS + xero.fulfilment_costs + xero.payment_processing_fees` for the annual period |
| Source fields | Xero P&L lines tagged to nominal codes in the variable-cost category |
| Consuming pages | Profit Engine, pricing-metrics (variable cost rate) |
| Confidence risks | Requires one-time nominal code mapping at Xero setup. Payment fees may arrive as bank feed entries rather than P&L lines |
| Data quality flags | Surface count of unmapped nominal codes; flag LOW confidence if any COGS-adjacent code is unclassified |

---

#### `CONTRIBUTION`

| Property | Detail |
|---|---|
| Formula | `ANNUAL_NET_REVENUE − ANNUAL_VARIABLE_COSTS` |
| Source fields | Derived |
| Consuming pages | Profit Engine, Cash Control |
| Confidence risks | Inherits from ANNUAL_NET_REVENUE and ANNUAL_VARIABLE_COSTS |
| Data quality flags | None beyond inputs |

---

#### `CONTRIBUTION_MARGIN_PCT`

| Property | Detail |
|---|---|
| Formula | `CONTRIBUTION / ANNUAL_REVENUE × 100` |
| Source fields | Derived |
| Consuming pages | Profit Engine |
| Confidence risks | Denominator uses gross annual revenue — if gross reconstruction is off, this % shifts |
| Data quality flags | None beyond inputs |

---

#### `BASE_EBITDA`

| Property | Detail |
|---|---|
| Formula | `CONTRIBUTION − MONTHLY_FIXED_COSTS` (MONTHLY_FIXED_COSTS imported from cash-snapshot) |
| Source fields | Derived; `MONTHLY_FIXED_COSTS` from Xero P&L fixed overhead categories |
| Consuming pages | Profit Engine, Scenario Lab |
| Confidence risks | Inherits confidence risks from both CONTRIBUTION and MONTHLY_FIXED_COSTS |
| Data quality flags | None beyond inputs |

---

#### `MONTHLY_REVENUE`

| Property | Detail |
|---|---|
| Formula | `sum(orders.subtotal_price + orders.total_discounts)` for the current calendar month |
| Source fields | `orders.subtotal_price`, `orders.total_discounts`, `orders.created_at` |
| Consuming pages | Dashboard, Margin Analysis |
| Confidence risks | Month-to-date figures will shift until the month closes; treat as a snapshot not a final |
| Data quality flags | Flag if pulled mid-month: "Month-to-date — final figure available after [month end date]" |

---

#### `MONTHLY_CM_PCT`

| Property | Detail |
|---|---|
| Formula | `(MONTHLY_NET_REVENUE − MONTHLY_VARIABLE_COSTS) / MONTHLY_REVENUE × 100` |
| Source fields | Derived from monthly Shopify revenue + Xero variable costs for the same month |
| Consuming pages | Dashboard, Margin Analysis, CFO Alerts |
| Confidence risks | Monthly Xero actuals may lag — final cost figures often not available until 5–10 days after month end. Mid-month values use a run-rate estimate |
| Data quality flags | Flag as estimate if Xero period has not been closed/locked |

---

#### `MONTHLY_CM_VALUE`

| Property | Detail |
|---|---|
| Formula | `MONTHLY_REVENUE × (MONTHLY_CM_PCT / 100)` |
| Source fields | Derived |
| Consuming pages | Margin Analysis |
| Confidence risks | Inherits from MONTHLY_CM_PCT |
| Data quality flags | None beyond inputs |

---

#### `CONTRIBUTION_PER_ORDER` (monthly basis)

| Property | Detail |
|---|---|
| Formula | `MONTHLY_CM_VALUE / MONTHLY_ORDER_VOLUME` |
| Source fields | Derived |
| Consuming pages | Margin Analysis |
| Confidence risks | Sensitive to order mix — if a month has unusually large or small orders, per-order contribution shifts independently of the margin structure |
| Data quality flags | Cross-check against pricing-metrics `CONTRIBUTION_PER_ORDER` (pricing-period basis) — large divergence signals period-mix differences worth surfacing |

---

#### `MONTHLY_ORDER_VOLUME`

| Property | Detail |
|---|---|
| Formula | `count(orders WHERE financial_status IN ("paid","partially_refunded") AND created_at WITHIN month)` |
| Source fields | `orders.financial_status`, `orders.created_at` |
| Consuming pages | Margin Analysis |
| Confidence risks | Excludes voided and fully refunded orders. Pending orders at month-end are excluded until finalised |
| Data quality flags | Surface count of pending orders at snapshot time |

---

#### `RECOVERABLE_LOW` / `RECOVERABLE_HIGH`

| Property | Detail |
|---|---|
| Formula | `sum(opportunities.uplift_low WHERE status = "active")` / `sum(opportunities.uplift_high WHERE status = "active")` |
| Source fields | Internal opportunity engine — `opportunities.uplift_low`, `uplift_high`, `status` |
| Consuming pages | Dashboard (CFO insight upside card), Profit Opportunities (TOTAL_LOW / TOTAL_HIGH) |
| Confidence risks | Opportunity uplifts are estimates — methodology must be documented per opportunity type to be credible |
| Data quality flags | Flag if no active opportunities exist (range would be £0–£0); flag if any opportunity's underlying data is stale |

---

### 3.2 `cash-snapshot.ts` — Cash Position and Working Capital

---

#### `CASH_BALANCE`

| Property | Detail |
|---|---|
| Formula | `sum(bank_accounts.balance WHERE account_tag = "operating")` |
| Source fields | Xero `bank_accounts.Balance`, filtered to merchant-tagged operating accounts |
| Consuming pages | Cash Control, Scenario Lab |
| Confidence risks | Unreconciled transactions inflate or deflate the balance — `LastReconciledDate` must be within 1 day for HIGH confidence |
| Data quality flags | Surface "Last reconciled: N days ago" warning when >1 day; flag credit card accounts if included accidentally |

---

#### `MONTHLY_FIXED_COSTS`

| Property | Detail |
|---|---|
| Formula | `sum(xero.expenses WHERE nominal_tag = "fixed") / period_months` |
| Source fields | Xero P&L `AccountCode` lines tagged as fixed (payroll, rent, software, insurance, accountancy) |
| Consuming pages | Cash Control, Profit Engine (via business-snapshot import), Scenario Lab |
| Confidence risks | Trailing-average smooths seasonal spikes (e.g. annual insurance renewal) — use 3-month rolling average rather than single-month actuals |
| Data quality flags | Flag if payroll category is absent from fixed costs (may indicate payroll processed externally) |

---

#### `CASH_RUNWAY`

| Property | Detail |
|---|---|
| Formula | `CASH_BALANCE / MONTHLY_FIXED_COSTS` |
| Source fields | Derived |
| Consuming pages | Cash Control, Dashboard, CFO Alerts |
| Confidence risks | Inherits from both inputs. Most sensitive to MONTHLY_FIXED_COSTS accuracy |
| Data quality flags | Alert threshold: flag in CFO Alerts if CASH_RUNWAY < 3 months |

---

#### `WORKING_CAPITAL_DRAG`

| Property | Detail |
|---|---|
| Formula | `INVENTORY_VALUE + PENDING_SETTLEMENT − OUTSTANDING_AP` |
| Sub-formulas | `INVENTORY_VALUE = sum(inventory_levels.available × variant.cost)` · `PENDING_SETTLEMENT = sum(payouts WHERE status = "in_transit")` · `OUTSTANDING_AP = sum(bills.amount_due WHERE due_date >= today)` |
| Source fields | Shopify `inventory_levels`, `products.variants.cost`, `payouts`; Xero `bills` |
| Consuming pages | Cash Control, Scenario Lab |
| Confidence risks | INVENTORY_VALUE is unreliable if `variant.cost` is unpopulated. PENDING_SETTLEMENT may not include all payment processors if merchant uses multiple gateways |
| Data quality flags | Badge: "Inventory cost set for X% of active SKUs." Flag LOW confidence if <70% |

---

#### `NET_CASH_MOVEMENT`

| Property | Detail |
|---|---|
| Formula | `CASH_BALANCE[period_end] − CASH_BALANCE[prior_period_end]` |
| Source fields | Xero `bank_accounts.Balance` at two dates |
| Consuming pages | Cash Control |
| Confidence risks | Meaningful only if both snapshots are reconciled |
| Data quality flags | Flag if either snapshot is unreconciled |

---

#### `INVENTORY_DAYS`

| Property | Detail |
|---|---|
| Formula | `INVENTORY_VALUE / (ANNUAL_VARIABLE_COSTS / 365)` |
| Source fields | Shopify `inventory_levels`, `variant.cost`; Xero annual COGS |
| Consuming pages | Cash Control |
| Confidence risks | Uses annual COGS as denominator — if COGS is unavailable, falls back to gross margin rate estimate |
| Data quality flags | Flag if variant.cost coverage <70% (INVENTORY_VALUE unreliable) |

---

#### `SUPPLIER_DAYS`

| Property | Detail |
|---|---|
| Formula | `rolling_average(bills.amount_due, 90_days) / (ANNUAL_PURCHASES / 365)` |
| Source fields | Xero `bills.amount_due`, `bills.contact` tagged as stock suppliers |
| Consuming pages | Cash Control |
| Confidence risks | Requires Xero bills to be separated by contact type (stock supplier vs service provider). Capex purchases will inflate this figure if included |
| Data quality flags | Flag if Xero AP is empty (bills may not be entered) |

---

#### `CASH_CONVERSION_CYCLE`

| Property | Detail |
|---|---|
| Formula | `INVENTORY_DAYS − SUPPLIER_DAYS + RECEIVABLE_DAYS` · `RECEIVABLE_DAYS = PENDING_SETTLEMENT / (MONTHLY_REVENUE / 30)` |
| Source fields | Derived from all three sub-metrics above |
| Consuming pages | Cash Control |
| Confidence risks | Inherits all risks from component metrics; most sensitive to INVENTORY_DAYS |
| Data quality flags | Flag individual component confidence separately; surface which component is LOW |

---

### 3.3 `growth-metrics.ts` — Retention and Growth Quality

---

#### `REPEAT_RATE`

| Property | Detail |
|---|---|
| Formula | `count(orders WHERE customer.first_order_date < period_start) / count(all_paid_orders) × 100` |
| Source fields | `orders.customer_id`, `customers.created_at`, `orders.created_at`, `orders.financial_status` |
| Consuming pages | Growth Quality, Dashboard |
| Confidence risks | Guest checkouts (no `customer_id`) cannot be classified as repeat or new — they must be excluded from both numerator and denominator. High guest checkout rate degrades reliability |
| Data quality flags | Surface guest checkout rate as a data quality metric: "X% of orders are guest checkouts and excluded from repeat rate calculation" |

---

#### `REPEAT_RATE_PREV`

| Property | Detail |
|---|---|
| Formula | Same as REPEAT_RATE applied to the prior period |
| Source fields | Same as above, prior period date range |
| Consuming pages | Growth Quality (MoM change badge), RETENTION_STATUS computation |
| Confidence risks | Same as REPEAT_RATE; additionally, prior-period guest checkout rate may differ |
| Data quality flags | Flag if sample size (paid orders) in prior period is <100 |

---

#### `DISCOUNT_DEP`

| Property | Detail |
|---|---|
| Formula | `count(orders WHERE length(discount_codes) > 0) / count(all_paid_orders) × 100` |
| Source fields | `orders.discount_codes[]`, `orders.financial_status`, `orders.created_at` |
| Consuming pages | Growth Quality, Dashboard, CFO Alerts |
| Confidence risks | Does not distinguish strategic discount codes (loyalty, ambassador) from margin-diluting blanket promotions. All discounts are treated equally |
| Data quality flags | Allow merchant to tag discount code categories (loyalty / promotional / referral). Show breakdown by category as a secondary metric |

---

#### `DISCOUNT_DEP_PREV`

| Property | Detail |
|---|---|
| Formula | Same as DISCOUNT_DEP applied to prior period |
| Source fields | Same as above, prior period date range |
| Consuming pages | Growth Quality (MoM trend) |
| Confidence risks | Same as DISCOUNT_DEP |
| Data quality flags | Same as DISCOUNT_DEP_PREV |

---

#### `CAC_PAYBACK`

| Property | Detail |
|---|---|
| Formula | `BLENDED_CAC / CONTRIBUTION_PER_ORDER` |
| Source fields | `channel-metrics.BLENDED_CAC`; `business-snapshot.CONTRIBUTION_PER_ORDER` |
| Consuming pages | Growth Quality, Margin Analysis, Marketing Efficiency |
| Confidence risks | Inherits confidence from both channel-metrics (attribution quality) and business-snapshot (monthly margin accuracy). A LOW confidence on either input degrades payback reliability |
| Data quality flags | Propagate the minimum confidence of BLENDED_CAC and CONTRIBUTION_PER_ORDER as the CAC_PAYBACK confidence score |

---

#### `GQ_SCORE`

| Property | Detail |
|---|---|
| Formula | Composite weighted grade: `repeatScore × 0.40 + discountScore × 0.35 + paybackScore × 0.25` · Each sub-score maps: `≥ 35% repeat → 4` · `≤ 25% discount → 4` · `≤ 1.0 payback → 4` (see scaling below) |
| Grade mapping | Score 3.5–4.0 → A · 2.5–3.4 → B · 1.5–2.4 → C · <1.5 → D · Suffix +/- from fractional position within band |
| Source fields | Derived from REPEAT_RATE, DISCOUNT_DEP, CAC_PAYBACK |
| Consuming pages | Growth Quality |
| Confidence risks | Grade thresholds are benchmark assumptions — must document the basis and allow future calibration by industry vertical |
| Data quality flags | Suppress GQ_SCORE and show "Insufficient data" if period order volume < 100 or any input is LOW confidence |

---

#### `RETENTION_STATUS`

| Property | Detail |
|---|---|
| Formula | `REPEAT_RATE − REPEAT_RATE_PREV > 2 → "strengthening"` · `abs(delta) ≤ 2 → "stable"` · `REPEAT_RATE − REPEAT_RATE_PREV < −2 → "weakening"` |
| Source fields | REPEAT_RATE, REPEAT_RATE_PREV |
| Consuming pages | Dashboard scorecard, Growth Quality |
| Confidence risks | A 2pp threshold is arbitrary — low order volumes can move this metric by >2pp by chance. Apply minimum sample size filter before computing |
| Data quality flags | Flag as "trend unclear" if either period's order count < 100 |

---

### 3.4 `channel-metrics.ts` — Marketing Channel Performance

---

#### `BLENDED_CAC`

| Property | Detail |
|---|---|
| Formula | `(meta.spend + google.cost + klaviyo.platform_cost) / count(new_customers)` |
| Source fields | Meta `ad_insights.spend`; Google `campaign_performance_report.Cost`; Klaviyo platform fee (manual or invoiced); Shopify `customers.created_at` for new customer count |
| Consuming pages | Marketing Efficiency, Growth Quality (via CAC_PAYBACK) |
| Confidence risks | New customer count from Shopify may differ from platform-reported new customer count. Use Shopify as the authoritative count |
| Data quality flags | Flag if any ad platform connection is stale >48h — BLENDED_CAC will be understated |

---

#### `BLENDED_ROAS`

| Property | Detail |
|---|---|
| Formula | `totalAttributedRevenue / totalMarketingSpend` — where attributed revenue is Shopify-sourced, not platform-reported |
| Source fields | Shopify orders by channel attribution; Meta/Google spend totals |
| Consuming pages | Marketing Efficiency |
| Confidence risks | Attribution gaps (unattributed orders falling to organic residual) reduce the attributed revenue numerator — ROAS will appear lower than it truly is |
| Data quality flags | Display platform-reported ROAS alongside Shopify-attributed ROAS so the merchant can see the gap |

---

#### `CHANNEL_CM_PCT` (per channel)

| Property | Detail |
|---|---|
| Formula | `(channelRevenue − channelVariableCosts − channelSpend) / channelRevenue × 100` · `channelVariableCosts = channelRevenue × (ANNUAL_VARIABLE_COSTS / ANNUAL_REVENUE)` |
| Source fields | Channel revenue from Shopify order attribution; channel spend from ad platform APIs; variable cost rate from business-snapshot |
| Consuming pages | Margin Analysis, Marketing Efficiency |
| Confidence risks | Assumes uniform variable cost rate across all channels. Channels with different SKU mix (e.g. organic drives higher-AOV products) will have different true margins. This is a simplification until SKU-level margin data is available |
| Data quality flags | Surface the assumption: "Variable cost rate assumed uniform across channels" |

---

#### `CAC_BY_CHANNEL`

| Property | Detail |
|---|---|
| Formula | `channelSpend / channelNewCustomers` per channel |
| Source fields | Ad platform spend; new customer count per channel from Shopify attribution or Conversions API |
| Consuming pages | Marketing Efficiency, Dashboard (Meta CAC headline) |
| Confidence risks | Organic CAC is undefined (no spend) — shown as £0 or "N/A". Email CAC uses platform subscription cost allocated proportionally |
| Data quality flags | Flag if channel new customer count is zero (division by zero — show "N/A" not an error) |

---

#### `PAYBACK_BY_CHANNEL`

| Property | Detail |
|---|---|
| Formula | `CAC_BY_CHANNEL[channel] / CONTRIBUTION_PER_ORDER` |
| Source fields | Derived from CAC_BY_CHANNEL and CONTRIBUTION_PER_ORDER (business-snapshot) |
| Consuming pages | Marketing Efficiency |
| Confidence risks | Uses a single blended CONTRIBUTION_PER_ORDER across all channels. Channels with different product mixes may have materially different CPO |
| Data quality flags | Note the blended CPO assumption in the tooltip |

---

### 3.5 `pricing-metrics.ts` — Pricing, Discount and Order-Level Metrics

> **Period note:** Currently uses a separate 420k revenue basis (the "pricing period"). In production this must be a date-range parameterised view of the same Shopify orders dataset used by business-snapshot and cash-snapshot. The three period constants must be unified before go-live.

---

#### `GROSS_REVENUE` (pricing period)

| Property | Detail |
|---|---|
| Formula | `sum(orders.subtotal_price + orders.total_discounts)` for the pricing period |
| Source fields | `orders.subtotal_price`, `orders.total_discounts`, `orders.created_at` |
| Consuming pages | Pricing Optimisation, Scenario Lab |
| Confidence risks | Shopify `total_price` is post-discount — must reconstruct from both fields |
| Data quality flags | Assert `GROSS_REVENUE == NET_REVENUE + DISCOUNT_COST` after computation; flag if assertion fails by >£10 |

---

#### `DISCOUNT_COST`

| Property | Detail |
|---|---|
| Formula | `sum(orders.total_discounts)` for the pricing period |
| Source fields | `orders.total_discounts`, `orders.created_at` |
| Consuming pages | Pricing Optimisation |
| Confidence risks | Only captures explicit code-based discounts — promotional pricing (permanent markdowns) is invisible |
| Data quality flags | Cross-check `DISCOUNT_COST / GROSS_REVENUE × 100` against `AVG_DISCOUNT_PCT`; flag if they differ by >0.5pp |

---

#### `RETURNS_IMPACT`

| Property | Detail |
|---|---|
| Formula | `sum(refunds.refund_line_items.subtotal) + (refund_count × avg_return_fulfilment_cost)` |
| Source fields | `refunds.refund_line_items[].subtotal`; `avg_return_fulfilment_cost` from Xero or manual input |
| Consuming pages | Pricing Optimisation |
| Confidence risks | Partial refunds require line-item level handling — sum by `order_id` to prevent double-counting. Returns fulfilment cost defaults to zero if Xero is unavailable |
| Data quality flags | Flag "Returns fulfilment cost estimated" if Xero mapping absent |

---

#### `ORDERS`

| Property | Detail |
|---|---|
| Formula | `count(orders WHERE financial_status IN ("paid","partially_refunded")) − count(fully_refunded_orders)` for the pricing period |
| Source fields | `orders.financial_status`, `orders.created_at` |
| Consuming pages | Pricing Optimisation, Scenario Lab |
| Confidence risks | Pending orders at the snapshot time will shift the count when finalised |
| Data quality flags | Surface pending order count at snapshot time |

---

#### `BASE_CONTRIBUTION` (pricing period)

| Property | Detail |
|---|---|
| Formula | `NET_RETAINED × (1 − variableCostRate)` · `variableCostRate = ANNUAL_VARIABLE_COSTS / ANNUAL_REVENUE` |
| Source fields | Derived; variable cost rate from business-snapshot |
| Consuming pages | Pricing Optimisation, Scenario Lab |
| Confidence risks | Applies a global variable cost rate to the pricing period — if the pricing period has a different channel or product mix, the true variable cost rate will differ |
| Data quality flags | Flag if pricing period date range differs significantly from the annual period used for the variable cost rate |

---

#### `AVG_DISCOUNT_PCT`

| Property | Detail |
|---|---|
| Formula | `DISCOUNT_COST / GROSS_REVENUE × 100` |
| Source fields | Derived |
| Consuming pages | Pricing Optimisation |
| Confidence risks | Revenue-weighted average — correctly accounts for high-value vs low-value orders. No material risk beyond inputs |
| Data quality flags | None beyond inputs |

---

#### `CONTRIBUTION_PER_ORDER` (pricing period)

| Property | Detail |
|---|---|
| Formula | `BASE_CONTRIBUTION / ORDERS` |
| Source fields | Derived |
| Consuming pages | Pricing Optimisation, Scenario Lab |
| Confidence risks | This figure (currently £12.40) differs from the monthly basis figure in business-snapshot (£35.00) — the two are intentionally from different periods and revenue definitions. They must remain distinct with clear labelling |
| Data quality flags | Surface period basis in the UI tooltip: "Based on [pricing period date range]" |

---

## 4. Integration Sequence

| Phase | Integration | Unlocks |
|---|---|---|
| **Phase 1** | **Shopify** — Orders, Customers, Refunds, Discount Codes | `ANNUAL_REVENUE`, `ANNUAL_DISCOUNTS`, `ANNUAL_RETURNS`, `MONTHLY_REVENUE`, `MONTHLY_ORDER_VOLUME`, `GROSS_REVENUE`, `DISCOUNT_COST`, `RETURNS_IMPACT`, `ORDERS`, `REPEAT_RATE`, `DISCOUNT_DEP` |
| **Phase 2** | **Xero** — P&L, Bank Accounts, Bills, Accounts | `ANNUAL_VARIABLE_COSTS`, `CONTRIBUTION`, `BASE_EBITDA`, `MONTHLY_CM_PCT`, `MONTHLY_FIXED_COSTS`, `CASH_BALANCE`, `CASH_RUNWAY`, `NET_CASH_MOVEMENT`, `OUTSTANDING_AP`, `SUPPLIER_DAYS` |
| **Phase 3** | **Shopify variant costs** — Merchant completes `variant.cost` for all active SKUs | `INVENTORY_VALUE`, `INVENTORY_DAYS`, `WORKING_CAPITAL_DRAG`, `CASH_CONVERSION_CYCLE` |
| **Phase 4** | **Meta Ads API + Google Ads API** | `BLENDED_CAC`, `BLENDED_ROAS`, `CAC_BY_CHANNEL` (Meta, Google), `CHANNEL_CM_PCT` (Meta, Google), `PAYBACK_BY_CHANNEL`, `CAC_PAYBACK`, `GQ_SCORE`, `RETENTION_STATUS` |
| **Phase 5** | **Klaviyo / email platform** | `CAC_BY_CHANNEL` (Email), `CHANNEL_CM_PCT` (Email) — completes channel attribution |
| **Phase 6** | **Internal opportunity engine** | `RECOVERABLE_LOW`, `RECOVERABLE_HIGH` — replaces static £18k–£42k mock values |

---

## 5. Open Questions and Setup Requirements

### 5.1 Xero Nominal Code Mapping

**Problem:** Xero does not natively classify nominal codes as fixed or variable. Without this mapping, MONTHLY_FIXED_COSTS and ANNUAL_VARIABLE_COSTS cannot be reliably computed.

**Required setup step:** On first Xero connection, present the merchant with a list of their active nominal codes and ask them to classify each as:
- `fixed` — costs that do not vary with order volume (payroll, rent, software subscriptions, insurance, accountancy)
- `variable` — costs that vary directly with orders (COGS, pick-and-pack, shipping, payment processing fees)
- `semi-fixed` — costs with both components (merchant can split by estimated variable fraction)
- `exclude` — capital expenditure, owner drawings, inter-company transfers

**Default mapping suggestions** (to reduce setup friction):
- Nominal codes in Xero `Class = DIRECTCOSTS` → suggest `variable`
- Nominal codes in Xero `Class = OVERHEADS` → suggest `fixed`
- Merchant confirms or overrides each suggestion

**Risk if skipped:** MONTHLY_FIXED_COSTS will include variable costs (overstated) and ANNUAL_VARIABLE_COSTS will be incomplete (understated). All downstream metrics — CONTRIBUTION, BASE_EBITDA, CASH_RUNWAY — will be wrong.

---

### 5.2 Shopify Discount Code Recognition

**Problem:** Not all discounts reduce margin equally. A 10% loyalty reward for repeat customers has a different strategic value than a 10% blanket site-wide promotion.

**Required setup step:** After Shopify connection, surface the merchant's active price rules and discount codes with their usage counts. Ask them to categorise each:
- `loyalty` — rewards for repeat customers or programme members
- `referral` — codes issued through referral campaigns
- `promotional` — site-wide or seasonal promotions that substitute for full-price revenue
- `wholesale` — trade/B2B codes
- `other`

**Usage:** The `DISCOUNT_DEP` metric currently counts all discount types equally. With categorisation, the Pricing Optimisation page can show discount dependency broken down by type, allowing the merchant to distinguish healthy from margin-diluting discount use.

**Risk if skipped:** `DISCOUNT_DEP = 38%` is shown as a single number. Without categorisation, the merchant cannot tell how much is structural (loyalty) vs discretionary (promotion). The CFO Alert threshold may fire on healthy discount use.

---

### 5.3 Returns Fulfilment Cost Estimation

**Problem:** `RETURNS_IMPACT` has two components: lost revenue (from Shopify refunds) and the cost of processing the return (reverse logistics, restocking). The revenue component comes from Shopify. The fulfilment cost component requires Xero or a manual input.

**Estimation approach (fallback hierarchy):**
1. **Best:** Map a Xero nominal code to "returns fulfilment cost" — compute average cost per return from Xero bills for that code over the last 90 days.
2. **Fallback:** Ask merchant for an average cost per return at setup (£ per returned order). Store as a manual override. Re-prompt every 90 days.
3. **Default if nothing provided:** Use zero — and flag `RETURNS_IMPACT` as understated with a data quality warning.

**Risk if skipped:** RETURNS_IMPACT understates true cost. NET_RETAINED is overstated. BASE_CONTRIBUTION is overstated. Pricing Optimisation and Scenario Lab will show rosier numbers than reality.

---

### 5.4 Operating Bank Account Tagging

**Problem:** Xero often holds multiple bank accounts: a main operating current account, a savings account, a credit card account, and potentially foreign currency accounts. `CASH_BALANCE` must only sum accounts the merchant considers "available operating cash."

**Required setup step:** On Xero connection, list all bank accounts from `GET /BankAccounts` and ask the merchant to tag each as:
- `operating` — included in CASH_BALANCE (e.g. main current account)
- `savings` — included in CASH_BALANCE if merchant considers it available (merchant chooses)
- `credit` — excluded (credit card balances are liabilities, not assets)
- `exclude` — foreign currency, inter-company, or dormant accounts

**Risk if skipped:** Including a credit card account inflates CASH_BALANCE. Including a foreign currency account without conversion introduces exchange rate error. CASH_RUNWAY would be misleadingly long in either case.

---

### 5.5 Attribution Confidence Handling

**Problem:** Channel attribution is inherently imperfect. The same order may be claimed by Meta, Google, and Klaviyo simultaneously. Platform-reported revenue will exceed Shopify actual revenue. Decisions made from unqualified attribution data can misdirect budget.

**Proposed approach:**

1. **Shopify as revenue authority.** All revenue totals shown in the app use Shopify order data. Platform-reported revenue (Meta ROAS, Google conversion value, Klaviyo attributed revenue) is shown separately as a "platform view" with an explicit label.

2. **Attribution gap metric.** Compute and display: `Attributed revenue (all platforms) / Shopify revenue × 100`. If this ratio exceeds 130%, flag an attribution overlap warning. If it falls below 70%, flag an attribution gap warning (suggesting significant dark social or direct traffic).

3. **Confidence score propagation.** Each channel metric carries one of three confidence ratings:
   - `HIGH` — Conversions API active; platform data <6h old; attribution gap 85–115%
   - `MEDIUM` — Pixel-only (no Conversions API); platform data 6–48h old; attribution gap 70–85% or 115–130%
   - `LOW` — Platform connection stale >48h; attribution gap <70% or >130%
   
   The confidence rating is displayed as a badge on each channel card and propagates to any derived metric (BLENDED_CAC, CAC_PAYBACK, GQ_SCORE) that depends on channel data.

4. **Minimum spend threshold.** Channels with fewer than 50 attributed orders or less than £500 spend in the period are labelled "low volume — data may be unreliable" rather than being suppressed entirely.

---

*Document version: 1.0 · Created: April 2026 · Owner: Virtual CFO product team*
*Next review: When Phase 1 (Shopify) integration is built — update §3 with confirmed field mappings and any formula corrections.*

---

## Appendix A — Dashboard KPI Tile Coverage

> **Purpose:** One entry per Dashboard KPI tile. Documents exactly what each tile shows today (live vs mock), what the canonical formula will be when live, and where definitional ambiguities must be resolved before go-live.
> **Row order:** Matches the three diagnostic rows on the Dashboard — Business Health Summary / Revenue Quality Diagnostics / Efficiency and Profit Leakage.
> **Status definitions:**
> - `LIVE` — formula runs against real Supabase data; tile reflects actual orders (returns £0 when table is empty, not a fallback string)
> - `PARTIAL` — formula runs against Supabase but uses at least one hardcoded assumption (e.g. cost rates from `costAssumptions.ts` instead of Xero) — or the live formula definition diverges from the canonical metric definition
> - `MOCK` — value is a static constant or hardcoded string from a TypeScript data file; no formula runs against real data
> - `FUTURE` — metric cannot be computed until a Phase 3+ integration is built

---

### Quick Reference — Dashboard KPI Status Summary

| KPI Name | Canonical Metric Name | Source System | Status | Confidence | Notes |
|---|---|---|---|---|---|
| Net Sales | `net_sales` | Shopify (tax-adjusted reconstruction) | **Live** | Medium | Requires explicit VAT/sales-tax separation from Shopify `total_price` |
| Contribution Margin | `contribution_margin_pct` | Shopify + assumptions (future Xero) | **Partial** | Medium | Variable cost assumptions hardcoded until Xero integration |
| Recoverable Contribution | `recoverable_contribution_range` | Opportunity engine (`RECOVERABLE_LOW` / `RECOVERABLE_HIGH`) | **Live** | Medium–High | Not derived from `commerceMetrics.ts` diagnostic leakage formula |
| Cash Runway | `cash_runway_months` | Xero + assumptions layer | **Partial** | Medium | Confidence improves after nominal code mapping is complete |
| Monthly Revenue | `monthly_revenue` | Shopify | **Live** | High | Derived from reconstructed gross sales |
| Average Order Value | `average_order_value` | Shopify | **Live** | High | Defined as Net Sales / Order Count |
| Repeat Purchase Rate | `repeat_purchase_rate` | Shopify customers / orders | **Live** | Medium | Guest checkout rate directly affects accuracy |
| Discount Dependency | `discount_dependency_ratio` | Shopify discounts | **Live** | High | Defined as Discount Value / Gross Sales |
| Acquisition Efficiency | `meta_cac_trend` | Meta Ads + Shopify attribution | **Partial** | Medium | Channel-level trend signal only — not blended CAC, CAC payback, or ROAS |
| Refund Rate | `refund_rate_pct` | Shopify refunds | **Live** | High | Defined as Refund Value / Gross Sales |
| Net Profit (Estimate) | `operating_profit_estimate` | Shopify + assumptions (future Xero) | **Partial** | Medium | Contribution minus fixed operating costs — not statutory net profit |

> **Confidence level definitions:** `High` — formula, source and denominator are fully confirmed; no known ingest risks · `Medium` — formula confirmed but one or more inputs use assumptions, have an unresolved ingest risk, or depend on a partially connected source · `Low` — significant definitional, ingest or source uncertainty that materially affects the displayed value.

---

### A.1 Net Sales

| Property | Detail |
|---|---|
| **Dashboard label** | Net Sales |
| **Canonical metric name** | `NET_SALES` |
| **Canonical definition** | `Net Sales = Gross Sales − Discounts − Refunds/Returns − VAT/Sales Tax` |
| **Current formula (live)** | `SUM(gross_sales − discounts − refunds − tax)` per order row · `commerceMetrics.netSales` |
| **Intended formula (production)** | Same structure — confirmed correct. Tax must be stored as a separate column at ingest and deducted explicitly so that the dashboard always presents net sales excluding VAT/sales tax, regardless of the merchant's Shopify tax configuration |
| **Tax handling note** | Shopify `total_price` can include tax (tax-inclusive pricing) or exclude it (tax-exclusive). The ingest pipeline must read `orders.taxes_included` at the store level and store tax as a separate `tax` column in all cases. This ensures the deduction `− tax` in the formula is always valid and never double-counts |
| **Source system** | Supabase |
| **Source table / view** | `orders` (columns: `gross_sales`, `discounts`, `refunds`, `tax`) |
| **Current status** | **LIVE** — tile shows real data when `orders` table is populated; shows £0 when empty |
| **Mock fallback** | None — tile initialises to £0, not a string constant |
| **Confidence risk** | Until the tax-inclusive/exclusive handling is confirmed at ingest, the `tax` deduction may double-count VAT in tax-inclusive stores, understating net sales. Flag at ingest time if `SUM(tax) / SUM(gross_sales) > 30%` — likely a double-deduction signal |
| **Data quality flag** | Flag if `SUM(tax)` represents more than 30% of `SUM(gross_sales)` — likely indicates double-deduction from tax-inclusive pricing |

---

### A.2 Contribution Margin

| Property | Detail |
|---|---|
| **Dashboard label** | Contribution Margin |
| **Canonical metric name** | `MONTHLY_CM_PCT` |
| **Current formula (mock init)** | Static constant: `MONTHLY_CM_PCT = 42.3` from `business-snapshot.ts` — shown until Supabase loads |
| **Current formula (live override)** | `(netSales − paymentFees − fulfilmentCosts − packagingCosts − returnHandlingCosts) / netSales × 100` · `commerceMetrics.contributionMarginPercent` |
| **Cost rates used in live formula** | All hardcoded in `costAssumptions.ts`: payment fee rate 2.5%, fulfilment £3.50/order, packaging £1.20/order, return handling 15% of refund value |
| **Intended formula (production)** | `(MONTHLY_NET_REVENUE − MONTHLY_VARIABLE_COSTS) / MONTHLY_REVENUE × 100` · where `MONTHLY_VARIABLE_COSTS` comes from Xero P&L for the period, not hardcoded rates |
| **Source system** | Shopify (numerator) + Xero (denominator) — Xero not yet connected |
| **Source table / view** | `orders` (live cost approximation) → future: `store_cost_assumptions` + Xero P&L integration |
| **Current status** | **PARTIAL** — formula runs against live order data but variable cost rates are hardcoded per-merchant assumptions, not actual Xero costs. The tile will show a plausible number but not the merchant's true margin |
| **Confidence risk** | Hardcoded cost rates will not reflect individual merchant's actual payment fee negotiation, pick-and-pack contracts, or seasonal cost variation. The gap between the live approximation and Xero actuals may be material (±5–10pp) |
| **Data quality flag** | Add "Cost rates estimated" badge until `store_cost_assumptions` is populated from Xero |

---

### A.3 Recoverable Contribution

| Property | Detail |
|---|---|
| **Dashboard label** | Recoverable Contribution |
| **Canonical metric name** | `RECOVERABLE_RANGE` (displayed as a range: `RECOVERABLE_LOW` – `RECOVERABLE_HIGH`) |
| **Current formula** | Conditional display: `£18k–£42k` if both constants > 0, otherwise "Opportunity being calculated" · Source: `RECOVERABLE_LOW = 18_000` / `RECOVERABLE_HIGH = 42_000` in `business-snapshot.ts` |
| **Intended formula** | `SUM(opportunities.uplift_low WHERE status = 'active')` → `SUM(opportunities.uplift_high WHERE status = 'active')` · Exposed via `v_recoverable_contribution` view |
| **Source system** | Internal opportunity engine — the same source that feeds the opportunity panel |
| **Source table / view** | Current: `RECOVERABLE_LOW` / `RECOVERABLE_HIGH` constants in `business-snapshot.ts` · Future: `opportunities` table → `v_recoverable_contribution` view |
| **Current status** | **MOCK** — both endpoints of the range are static constants |
| **Source confirmation** | The dashboard KPI tile must use `RECOVERABLE_LOW` / `RECOVERABLE_HIGH` from the internal opportunity engine (currently `business-snapshot.ts`, future: `opportunities` table). It must **not** use `diagnosticLeakageEstimate`, `liveOrderLeakageEstimate`, or any formula from `commerceMetrics.ts`. Those are internal diagnostic signals, not the headline opportunity range |
| **Distinction from liveOrderLeakageEstimate** | `metrics.liveOrderLeakageEstimate` in `commerceMetrics.ts` computes excess discount + refund + payment fee leakage order-by-order from Supabase data. It is a diagnostic tool for the engineering layer and future Profit Opportunities detail pages — it does not power the KPI tile. The KPI tile value is the strategic opportunity range from the opportunity engine. See `commerceMetrics.ts` type header for the full distinction |
| **Confidence risk** | Opportunity uplift methodology is not yet documented per opportunity type. Once live, each opportunity row should carry a `confidence` field (`HIGH / MEDIUM / LOW`) and the range should be labelled accordingly |
| **Data quality flag** | Surface "Opportunity being calculated" when no active opportunities exist; alert if any active opportunity's underlying data is stale > 7 days |

---

### A.4 Cash Runway

| Property | Detail |
|---|---|
| **Dashboard label** | Cash Runway |
| **Canonical metric name** | `CASH_RUNWAY` |
| **Current formula** | Static constant: `CASH_RUNWAY = 3.4` from `cash-snapshot.ts` |
| **Intended formula** | `CASH_BALANCE / MONTHLY_FIXED_COSTS` · `CASH_BALANCE` from Xero tagged operating bank accounts; `MONTHLY_FIXED_COSTS` from Xero P&L fixed overhead nominal codes |
| **Source system** | Xero (Phase 2) |
| **Source table / view** | Future: Xero `bank_accounts` + `profit_and_loss` report via Xero API |
| **Current status** | **MOCK** — static constant; no formula runs against real data |
| **Confidence risk** | Both inputs depend on Xero setup quality: (1) bank account tagging must distinguish operating from credit/savings; (2) nominal code classification must separate fixed from variable costs. Either error yields a misleading runway figure |
| **Data quality flag** | Alert in CFO Alerts if `CASH_RUNWAY < 3 months`; add "Last reconciled: N days ago" badge when Xero is connected |

---

### A.5 Monthly Revenue

| Property | Detail |
|---|---|
| **Dashboard label** | Monthly Revenue |
| **Canonical metric name** | `MONTHLY_REVENUE` |
| **Current formula (mock init)** | Static constant: `MONTHLY_REVENUE = 124_500` from `business-snapshot.ts` |
| **Current formula (live override)** | `SUM(orders.total_sales)` · `commerceMetrics.totalRevenue` |
| **Intended formula** | `SUM(orders.subtotal_price + orders.total_discounts)` for the calendar month — Shopify gross revenue reconstruction (pre-discount, pre-tax) |
| **Formula ambiguity** | The live code uses `total_sales` (Shopify `total_price` — post-discount, includes tax in some configurations). The data dictionary §3.1 and the schema define gross revenue as `subtotal_price + total_discounts` (pre-discount, pre-tax). These two figures will differ by the discount amount and potentially tax. The formula should be aligned to the canonical gross revenue reconstruction before Phase 1 goes live |
| **Source system** | Supabase / Shopify |
| **Source table / view** | `orders` (column: `total_sales` current → `gross_sales + discounts` intended) |
| **Current status** | **LIVE** — tile shows real Supabase data; formula uses `total_sales` rather than the canonical gross revenue reconstruction |
| **Confidence risk** | Month-to-date figures shift until month close; tile should carry a "Month to date" label when current month data is shown |
| **Data quality flag** | Flag if pulled mid-month. Add period label: "Month to date — final figure after [month end date]" |

---

### A.6 Average Order Value

| Property | Detail |
|---|---|
| **Dashboard label** | Average Order Value |
| **Canonical metric name** | `AOV` |
| **Canonical definition** | `AOV = Net Sales / Order Count` |
| **Rationale** | Net Sales (after discounts, refunds/returns and VAT/sales tax) is the appropriate numerator because it represents revenue the merchant actually retains before variable costs. Using net sales aligns AOV with the Net Sales tile and makes the two figures internally consistent. The formula mirrors `commerceMetrics.netSales / commerceMetrics.orderCount` |
| **Current formula (live)** | `SUM(orders.total_sales) / count(orders)` · `commerceMetrics.averageOrderValue` — currently uses `total_sales` (post-discount, tax-varies) rather than `netSales`. To be corrected before Phase 1 go-live |
| **Intended formula (production)** | `commerceMetrics.netSales / commerceMetrics.orderCount` — aligns to the canonical definition |
| **Future secondary metric** | Gross AOV (`SUM(gross_sales) / orderCount`) may be added as a secondary figure on the Margin Analysis drill-down page for benchmarking against industry averages, where pre-discount figures are the norm |
| **Source system** | Supabase |
| **Source table / view** | `orders` (columns: `gross_sales`, `discounts`, `refunds`, `tax` for net; current code uses `total_sales`) |
| **Current status** | **PARTIAL** — formula runs against live Supabase data but uses `total_sales` rather than `netSales`. Initialises to £0 when orders table is empty |
| **Confidence risk** | Current implementation using `total_sales` produces a different figure from the canonical `netSales / orderCount` definition — the gap equals discounts, refunds and tax treatment. Until corrected, AOV will be overstated vs the canonical definition in stores with significant discounting or high-value returns |
| **Data quality flag** | Add UI tooltip: "Average net revenue per order (after discounts, returns and VAT), showing [period]" |

---

### A.7 Repeat Purchase Rate

| Property | Detail |
|---|---|
| **Dashboard label** | Repeat Purchase Rate |
| **Canonical metric name** | `REPEAT_RATE` |
| **Current formula (mock init)** | Static constant: `REPEAT_RATE` from `growth-metrics.ts` |
| **Current formula (live override)** | `count(customer_ids with more than one order in dataset) / count(all distinct customer_ids) × 100` · `commerceMetrics.repeatPurchaseRate` |
| **Canonical formula (intended)** | `count(orders WHERE customer.first_order_at < period_start) / count(all_paid_orders in period) × 100` — orders in the period from customers who had already purchased before the period began |
| **Formula divergence** | The live code measures "repeat customer rate" — what fraction of all customers (ever) have placed more than one order. This is not the same as the canonical repeat purchase rate (what fraction of orders in the period came from returning customers). The two figures will differ materially in growing businesses where most customers are new |
| **Source system** | Supabase |
| **Source table / view** | `orders` (column: `customer_id`) → future: requires `customers` table with `first_order_at` for canonical formula |
| **Current status** | **PARTIAL** — a live formula runs against Supabase but it measures repeat customer ratio not repeat purchase rate. The canonical formula requires the `customers` table with `first_order_at` populated |
| **Confidence risk** | Guest checkouts (no `customer_id`) are silently excluded from both numerator and denominator. If the merchant has a high guest rate, this figure overstates repeat purchasing. The guest rate itself is not surfaced on the tile |
| **Data quality flag** | Require guest checkout rate check (§4.1 in `shopify-phase-1-schema.md`); surface badge: "X% of orders excluded (guest checkouts)" |

---

### A.8 Discount Dependency

| Property | Detail |
|---|---|
| **Dashboard label** | Discount Dependency |
| **Canonical metric name** | `DISCOUNT_DEP` |
| **Current formula (mock init)** | Static constant: `DISCOUNT_DEP` from `growth-metrics.ts` |
| **Current formula (live override)** | `SUM(discounts) / SUM(gross_sales) × 100` · `commerceMetrics.discountRate` — **value-based rate: revenue surrendered as a % of gross revenue** |
| **Canonical formula (intended)** | `count(orders WHERE has_discount = true) / count(all_paid_orders) × 100` — **count-based rate: % of orders that included any discount code** |
| **Formula divergence** | The live code computes a discount revenue rate (what % of gross revenue was given away). The canonical `DISCOUNT_DEP` defined in §3.3 and used across Growth Quality and CFO Alerts is a count-based order rate (what % of orders used a code). These produce different numbers and have different strategic meanings: a few very deep discounts on small orders could produce a low count rate but a high revenue rate |
| **Source system** | Supabase |
| **Source table / view** | `orders` (columns: `discounts`, `gross_sales` current) → future: `orders.has_discount` computed column for canonical formula |
| **Current status** | **PARTIAL** — a live formula runs but it computes discount rate (revenue-weighted) rather than the canonical discount dependency (order-count-weighted). Both are valid metrics but they are different and must be labelled distinctly |
| **Confidence risk** | Does not distinguish loyalty codes from promotional codes. Silent markdowns (price reductions without a code) are invisible to both formulas |
| **Data quality flag** | Check 4.3 (silent markdowns) in `shopify-phase-1-schema.md`; surface badge if markdown value > 0. Add discount categorisation step at onboarding (see §5.2 of this document) |

---

### A.9 Acquisition Efficiency

| Property | Detail |
|---|---|
| **Dashboard label** | Acquisition Efficiency |
| **Canonical metric name** | `META_CAC_TREND` |
| **Definition for v1** | This tile is defined as a **Meta CAC trend / channel acquisition efficiency signal**. It shows whether Meta acquisition cost is improving or deteriorating relative to the prior period. It is not blended CAC, CAC payback, or ROAS — those remain separate metrics on the Marketing Efficiency page |
| **Canonical formula** | `Meta CAC (current period) vs Meta CAC (prior period)` expressed as a percentage change · `Meta CAC = Meta spend / new customers attributed to Meta` |
| **Current value** | Hardcoded string: `"Meta CAC +14%"` — representing a +14% increase in Meta CAC from prior period (£24 → £28) |
| **Current value source** | `CAC_BY_CHANNEL[Meta].changeLabel` from `channel-metrics.ts` — static mock |
| **What this tile is not** | — Not blended CAC (`BLENDED_CAC` — total spend / all new customers) · — Not CAC payback (`CAC_PAYBACK` — orders to recover acquisition cost) · — Not ROAS (attributed revenue / spend) · All three are available in the Marketing Efficiency page and carry their own definitions in §3.4 |
| **Source system** | Meta Ads API (Phase 4) |
| **Source table / view** | Future: `marketing_spend` table → `CAC_BY_CHANNEL` computed from Meta Ads API spend + Shopify new customer attribution |
| **Current status** | **MOCK** — hardcoded string; no formula runs against real data |
| **Confidence risk** | Meta CAC accuracy depends on new customer attribution quality. Without Conversions API (server-side events), iOS 14.5+ signal loss means Meta-reported new customer counts may understate true acquisition, overstating CAC. See §5.5 for confidence tier framework |
| **Data quality flag** | Flag if Meta Ads connection is stale > 48h; suppress tile with "Integration required" if no ad platform is connected |

---

### A.10 Refund Rate

| Property | Detail |
|---|---|
| **Dashboard label** | Refund Rate |
| **Canonical metric name** | `REFUND_RATE` |
| **Canonical definition** | `Refund Rate = Refund Value / Gross Sales` |
| **Components** | **Refund Value** — sum of refunded order/subtotal value in the selected period (revenue reversed, not fulfilment cost) · **Gross Sales** — sales before discounts, refunds and VAT/sales tax (pre-deduction revenue) |
| **Rationale** | Using Gross Sales as the denominator measures the proportion of full-price revenue potential that was lost to returns. This is the correct basis for a financial leakage metric and aligns with the `liveOrderLeakageEstimate` diagnostic in `commerceMetrics.ts` |
| **Current formula (live)** | `SUM(orders.refunds) / SUM(orders.gross_sales) × 100` · `commerceMetrics.refundRate` — matches the canonical definition |
| **Future operational view** | A future view may also surface **Refunded Orders / Total Orders** (count-based rate) as a secondary operational metric on the Profit Opportunities or Pricing Optimisation pages, to distinguish high-frequency low-value returns from low-frequency high-value returns |
| **Source system** | Supabase |
| **Source table / view** | `orders` (columns: `refunds`, `gross_sales`) |
| **Current status** | **LIVE** — formula runs against Supabase. Initialises to 0% when orders table is empty |
| **Confidence risk** | Partial refunds: if a single order is refunded in two events, the `refunds` column must store a cumulative total (not individual event amounts) to avoid double-counting. This must be confirmed as part of the ingest design. See data quality check 4.4 in `shopify-phase-1-schema.md` |
| **Data quality flag** | Confirm cumulative vs event-level refund storage before Phase 1 launch; add UI tooltip: "Refund value as a percentage of gross sales (before discounts and VAT), showing [period]" |

---

### A.11 Net Profit

| Property | Detail |
|---|---|
| **Dashboard label** | Net Profit |
| **Canonical metric name** | `OPERATING_PROFIT_ESTIMATE` |
| **Definition for v1** | This tile is defined as an **Operating Profit Estimate**, not statutory or accounting net profit. It does not include depreciation, interest, or corporation tax. The label on the tile should read "Net Profit (est.)" or "Operating Profit (est.)" until Xero integration is complete |
| **Canonical formula** | `Operating Profit Estimate = Contribution − Fixed Operating Costs` · where Contribution = Net Sales − Variable Costs; Fixed Operating Costs = monthly fixed overheads from Xero nominal codes |
| **Data sources** | Shopify revenue and order data → Net Sales and Contribution (variable costs applied) · Xero P&L fixed overhead lines → Fixed Operating Costs · Temporary hardcoded cost assumptions where Xero is not yet connected |
| **Current value** | Hardcoded string: `"£56,300"` — this is a mock placeholder with no formula basis. It does not correspond to any computed value in the codebase (`BASE_EBITDA = CONTRIBUTION − MONTHLY_FIXED_COSTS = £78,000`; `MONTHLY_CM_VALUE = £52,913`). It will be replaced once the formula is wired to real data |
| **Confidence note** | This figure must be labelled as an estimate on the dashboard until Xero P&L integration is live and nominal code mapping is complete. Where Xero is not yet connected, the value uses temporary cost assumptions and should carry a visible "Estimated" badge |
| **What this tile is not** | — Not statutory net profit (no depreciation, interest or tax deducted) · — Not EBITDA (a formal accounting concept requiring full P&L classification) · These measures will require Xero P&L integration and additional mapping beyond Phase 2 scope |
| **Source system** | Shopify (revenue component) + Xero (fixed costs component) — Xero not yet connected |
| **Source table / view** | Future: `orders` (Supabase) + Xero `profit_and_loss` report → `CONTRIBUTION − MONTHLY_FIXED_COSTS` |
| **Current status** | **MOCK** — hardcoded string; no formula; placeholder value does not match any derived computation in the codebase |
| **Confidence risk** | Accuracy depends on two inputs: (1) Xero nominal code classification separating fixed from variable costs (§5.1) — misclassification will over- or understate the figure; (2) the monthly Contribution estimate, which itself uses hardcoded variable cost rates until Xero is connected (see A.2) |
| **Data quality flag** | Show "Estimated" badge until Xero P&L is connected and nominal codes are mapped; flag LOW confidence if either `CONTRIBUTION` or `MONTHLY_FIXED_COSTS` carries a LOW confidence rating from their respective sources |

---

### Summary Table

| Tile | Canonical Name | Formula (resolved) | Current Status | Confidence Risk (summary) | Next Action |
|---|---|---|---|---|---|
| Net Sales | `NET_SALES` | `Gross Sales − Discounts − Refunds − VAT/Tax` | **LIVE** | Tax-inclusive/exclusive handling at ingest | Confirm `taxes_included` handling at Phase 1 ingest |
| Contribution Margin | `MONTHLY_CM_PCT` | `(Net Sales − Variable Costs) / Net Sales × 100` | **PARTIAL** | Variable cost rates hardcoded, not from Xero | Replace `costAssumptions.ts` rates with `store_cost_assumptions` (Phase 2) |
| Recoverable Contribution | `RECOVERABLE_RANGE` | `SUM(opportunities.uplift_low/high WHERE active)` — from opportunity engine only, never from `commerceMetrics.ts` | **MOCK** | Uplift methodology undocumented | Seed `opportunities` table; document per-type methodology |
| Cash Runway | `CASH_RUNWAY` | `Cash Balance / Monthly Fixed Costs` | **MOCK** | Both inputs from Xero — not yet connected | Phase 2; bank account tagging setup step |
| Monthly Revenue | `MONTHLY_REVENUE` | `SUM(gross_sales + discounts)` for calendar month | **LIVE** | `total_sales` vs gross reconstruction gap | Align `totalRevenue` formula to gross revenue reconstruction |
| Average Order Value | `AOV` | `Net Sales / Order Count` | **PARTIAL** | Current impl uses `total_sales`; overstates vs canonical | Update `averageOrderValue` to use `netSales / orderCount` before Phase 1 |
| Repeat Purchase Rate | `REPEAT_RATE` | `Orders from returning customers / Total orders in period` | **PARTIAL** | Live formula measures repeat customer ratio, not rate | Populate `customers` table; fix period-bound formula |
| Discount Dependency | `DISCOUNT_DEP` | `Count(orders with discount) / Count(all orders) × 100` | **PARTIAL** | Live formula uses revenue rate, not count rate | Add `has_discount` column at ingest; align label to live formula or fix formula |
| Acquisition Efficiency | `META_CAC_TREND` | `Meta CAC (current period) vs Meta CAC (prior period) — Meta CAC = Meta spend / new customers attributed to Meta` | **MOCK** | Attribution quality; Conversions API required for HIGH confidence | Phase 4 (Meta Ads API); not blended CAC or payback |
| Refund Rate | `REFUND_RATE` | `Refund Value / Gross Sales × 100` | **LIVE** | Partial refund storage model unconfirmed | Confirm cumulative refund storage at ingest; add UI tooltip |
| Net Profit | `OPERATING_PROFIT_ESTIMATE` | `Contribution − Fixed Operating Costs` — estimate only; not accounting net profit | **MOCK** | Xero not connected; nominal codes not mapped | Phase 2 (Xero P&L); label as "est." until fully live |

*Appendix version: 1.1 · Amended April 2026 · All four v1 ambiguities resolved (AOV, Acquisition Efficiency, Refund Rate, Net Profit). Net Sales and Recoverable Contribution definitions tightened.*
*Derived from: dashboard.tsx, commerceMetrics.ts, business-snapshot.ts, cash-snapshot.ts, growth-metrics.ts, channel-metrics.ts.*
