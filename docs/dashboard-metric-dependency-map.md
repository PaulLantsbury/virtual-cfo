# Dashboard Metric Dependency Map

**Project:** Virtual CFO  
**Last updated:** 2026-04-30  
**Scope:** Every KPI tile on the main Dashboard plus metrics used by the six
analysis pages. Derived from a direct audit of source code — not from
documentation alone.

---

## How to read this document

| Column | Meaning |
|---|---|
| **Tile / Page** | Internal tile ID (for KPI tiles) or page route |
| **Current data source** | What the UI actually reads *today* |
| **Supabase fn / table** | RPC function or table name if a live source exists |
| **Fallback** | What is shown if the primary source is unavailable |
| **Status** | See legend below |
| **Integration dependency** | External service required before this metric can go live |
| **Notes** | Known limitations, formula mismatches, caveats |

### Status legend

| Status | Meaning |
|---|---|
| **Live** | Wired to a Phase 1 Supabase RPC; Shopify seed data populates it |
| **Partial** | RPC exists but a known formula gap or missing cost-assumption row can cause silent fallback to the DEV-ONLY tier |
| **Mock** | Hardcoded snapshot constant only; no RPC wiring; do not ship to production |
| **Phase 2** | Planned live wiring; requires Xero (or prior-period delta functions) |
| **Phase 3** | Planned live wiring; requires a third-party API (Meta Ads, Google Ads) |

---

## Part 1 — Dashboard KPI tiles

The dashboard renders 11 KPI tiles via `KPI_CARDS` in `dashboard.tsx`.  
Each tile uses a three-tier fallback pattern:

- **Tier 1 (canonical):** Phase 1 Supabase RPC via `getPhase1Metrics()` in `phase1Metrics.ts`
- **Tier 2 (DEV-ONLY fallback):** `commerceMetrics` (all-time, no date filter, sometimes different formula)
- **Tier 3 (static sentinel):** Constant from a data file — visible only while both async sources are loading

Tiles `cr`, `ae`, and `np` have no live wiring; they are fully mock.

---

### KPI Tile: Net Sales

| Field | Value |
|---|---|
| **Metric name** | `net_sales` |
| **Canonical key** | `METRIC.NET_SALES` |
| **Tile ID** | `ns` |
| **Tile / Page** | Dashboard — Business Health Summary row |
| **Current data source** | `phase1Metrics.data.netSales` (Tier 1) |
| **Supabase fn / table** | `net_sales(p_store_id, p_date_from, p_date_to)` — reads `orders`, `order_line_items`, `refunds` |
| **Fallback** | Tier 2: `commerceMetrics.netSales` (all-time, no date filter) → Tier 3: static `"£0"` sentinel |
| **Status** | **Live** |
| **Integration dependency** | Shopify (already seeded) |
| **Notes** | Formula: `SUM(gross_sales − discounts − refunds − tax)` excluding cancelled orders. The Tier 2 `commerceMetrics` fallback uses the same formula but over all time — it will show a much larger figure than the monthly Tier 1 value. Change string (`""`) is intentionally empty — no prior-period delta RPC exists yet (Phase 2). |

---

### KPI Tile: Monthly Revenue

| Field | Value |
|---|---|
| **Metric name** | `monthly_revenue` |
| **Canonical key** | `METRIC.MONTHLY_REVENUE` |
| **Tile ID** | `mr` |
| **Tile / Page** | Dashboard — Revenue Quality Diagnostics row |
| **Current data source** | `phase1Metrics.data.grossRevenue` (Tier 1) |
| **Supabase fn / table** | `gross_revenue(p_store_id, p_date_from, p_date_to)` — reads `orders` |
| **Fallback** | Tier 2: `commerceMetrics.totalRevenue` (all-time) → Tier 3: `MONTHLY_REVENUE` constant (£124,500, `business-snapshot.ts`) |
| **Status** | **Live** |
| **Integration dependency** | Shopify (already seeded) |
| **Notes** | Formula: `SUM(gross_sales)` excluding cancelled orders. Tier 2 fallback is all-time gross revenue — will differ significantly from the calendar-month figure. Change string (`"↑ 12.4% vs last month"`) is a hardcoded snapshot — no prior-period RPC exists yet (Phase 2). |

---

### KPI Tile: Average Order Value

| Field | Value |
|---|---|
| **Metric name** | `average_order_value` |
| **Canonical key** | `METRIC.AVERAGE_ORDER_VALUE` |
| **Tile ID** | `aov` |
| **Tile / Page** | Dashboard — Revenue Quality Diagnostics row |
| **Current data source** | `phase1Metrics.data.averageOrderValue` (Tier 1) |
| **Supabase fn / table** | `average_order_value(p_store_id, p_date_from, p_date_to)` — reads `orders` |
| **Fallback** | Tier 2: `commerceMetrics.averageOrderValue` (formula differs — see notes) → Tier 3: static `"£0"` sentinel |
| **Status** | **Live** |
| **Integration dependency** | Shopify (already seeded) |
| **Notes** | **Formula mismatch with Tier 2:** Tier 1 formula = `net_sales / qualifying_order_count` (excluding cancelled and fully-refunded orders from denominator). Tier 2 formula = `total_sales / COUNT(*)` (all orders, no exclusions). Both produce different numbers. See `docs/data-dictionary-v1.md §A.6` for full record. Change string is empty — no prior-period delta RPC yet (Phase 2). |

---

### KPI Tile: Refund Rate

| Field | Value |
|---|---|
| **Metric name** | `refund_rate_pct` |
| **Canonical key** | `METRIC.REFUND_RATE_PCT` |
| **Tile ID** | `rr` |
| **Tile / Page** | Dashboard — Revenue Quality Diagnostics row |
| **Current data source** | `phase1Metrics.data.refundRate` (Tier 1) — ratio [0, 1] × 100 for display |
| **Supabase fn / table** | `refund_rate(p_store_id, p_date_from, p_date_to)` — reads `orders`, `refunds` |
| **Fallback** | Tier 2: `commerceMetrics.refundRate` (all-time, ratio [0,1]) → Tier 3: static `"0%"` sentinel |
| **Status** | **Live** |
| **Integration dependency** | Shopify (already seeded) |
| **Notes** | Formula: `SUM(refunds) / SUM(gross_sales)` excluding cancelled orders. Refunds are attributed to the *original order's* `created_at` date, not the refund event date. Change string is empty — no prior-period delta RPC yet (Phase 2). |

---

### KPI Tile: Discount Dependency

| Field | Value |
|---|---|
| **Metric name** | `discount_dependency_ratio` |
| **Canonical key** | `METRIC.DISCOUNT_DEPENDENCY_RATIO` |
| **Tile ID** | `dd` |
| **Tile / Page** | Dashboard — Revenue Quality Diagnostics row; also Growth Quality page, CFO Insight panel |
| **Current data source** | `phase1Metrics.data.discountDependency` (Tier 1) — ratio [0, 1] × 100 for display |
| **Supabase fn / table** | `discount_dependency(p_store_id, p_date_from, p_date_to)` — reads `orders` |
| **Fallback** | Tier 2: `commerceMetrics.discountRate` (all-time, ratio [0,1]) → Tier 3: `DISCOUNT_DEP` constant (38.0%, `growth-metrics.ts`) |
| **Status** | **Live** |
| **Integration dependency** | Shopify (already seeded) |
| **Notes** | **Formula note:** Tier 1 is value-based (`SUM(discounts) / SUM(gross_sales)`). The `DISCOUNT_DEP` Tier 3 constant and the snapshot text "38%" in `CFO_INSIGHT.weeklyPriorities[0].why` are count-based mock figures — different concept. The CFO Insight "38%" string is hardcoded and does not yet react to the live RPC value. Change string (`"↑ 11% vs last month"`) is hardcoded — no prior-period delta RPC exists yet (Phase 2). `DISCOUNT_DEP_PREV = 36.2%` is also a mock constant with no live wiring. |

---

### KPI Tile: Repeat Purchase Rate

| Field | Value |
|---|---|
| **Metric name** | `repeat_purchase_rate` |
| **Canonical key** | `METRIC.REPEAT_PURCHASE_RATE` |
| **Tile ID** | `rpr` |
| **Tile / Page** | Dashboard — Revenue Quality Diagnostics row; also Growth Quality page |
| **Current data source** | `phase1Metrics.data.repeatPurchaseRate` (Tier 1) — ratio [0, 1] × 100 for display |
| **Supabase fn / table** | `repeat_purchase_rate(p_store_id, p_date_from, p_date_to)` — reads `orders`, `customers` |
| **Fallback** | Tier 2: `commerceMetrics.repeatPurchaseRate` (all-time, different denominator) → Tier 3: `REPEAT_RATE` constant (28.0%, `growth-metrics.ts`) |
| **Status** | **Live** |
| **Integration dependency** | Shopify (already seeded) |
| **Notes** | **Formula:** returning customers (those whose `customers.first_order_at` precedes the period start) / all period customers. Guest checkouts (`customer_id IS NULL`) excluded from both numerator and denominator. Tier 2 `commerceMetrics` uses a different denominator (customers with > 1 order all-time). Change string (`"↑ 4.2% vs last month"`) is hardcoded — no prior-period delta RPC exists yet (Phase 2). `REPEAT_RATE_PREV = 24.6%` is also a mock constant with no live wiring. |

---

### KPI Tile: Contribution Margin

| Field | Value |
|---|---|
| **Metric name** | `contribution_margin_pct` |
| **Canonical key** | `METRIC.CONTRIBUTION_MARGIN_PCT` |
| **Tile ID** | `cm` |
| **Tile / Page** | Dashboard — Business Health Summary row; Margin Analysis page |
| **Current data source** | `phase1Metrics.data.contributionMarginPct` (Tier 1) — ratio [0, 1] \| null × 100 for display |
| **Supabase fn / table** | `contribution_margin_pct(p_store_id, p_date_from, p_date_to)` — reads `orders`, `refunds`, `v_current_cost_assumptions` |
| **Fallback** | Tier 2: `commerceMetrics.contributionMarginPercent` (estimated from static costs, not store-personalised) → Tier 3: `MONTHLY_CM_PCT` constant (42.3%, `business-snapshot.ts`) |
| **Status** | **Partial** |
| **Integration dependency** | Shopify (already seeded); Xero (for validated cost assumptions) |
| **Notes** | The RPC returns **NULL** when no row exists in `v_current_cost_assumptions` for the store — the tile then silently falls back to Tier 2 without surfacing an error to the user. Cost rates must be seeded into `cost_assumptions` before this tile can return a store-personalised value. Formula: `(net_sales − payment_fees − fulfilment − packaging − return_handling) / net_sales`. The Margin Analysis page uses `MONTHLY_CM_PCT` (42.3%) and `CONTRIBUTION_MARGIN_PCT` (38.08% annual basis) from snapshot files — neither is wired to the live RPC yet. Change string (`"↓ 2.8% vs last month"`) is hardcoded — no prior-period delta RPC exists yet (Phase 2). |

---

### KPI Tile: Recoverable Contribution

| Field | Value |
|---|---|
| **Metric name** | `recoverable_contribution_range` |
| **Canonical key** | `METRIC.RECOVERABLE_CONTRIBUTION_RANGE` |
| **Tile ID** | `rc` |
| **Tile / Page** | Dashboard — Business Health Summary row; CFO Insight panel (upside range); Expected Impact panel; Scenario Lab / Opportunities page |
| **Current data source** | `phase1Metrics.data.recoverableLow` / `recoverableHigh` (Tier 1) |
| **Supabase fn / table** | `recoverable_contribution_range(p_store_id)` — reads `opportunities` table; returns `TABLE(recoverable_low numeric, recoverable_high numeric)` |
| **Fallback** | Tier 2 (RPC error): `RECOVERABLE_LOW` / `RECOVERABLE_HIGH` constants (£18k/£42k, `business-snapshot.ts`) → Tier 3 (still loading): same constants via `RECOVERABLE_TILE_VALUE` |
| **Status** | **Live** |
| **Integration dependency** | None (opportunities are store-level, managed in Supabase) |
| **Notes** | **No date filter** — opportunities are store-level signals, not period-bound. The RPC sums `impact_low` / `impact_high` across all non-archived `opportunities` rows for the store. The £18k/£42k Tier 3 constants also appear hardcoded in two places in the JSX body (the Pro panel and Free panel) and in the Expected Impact panel projection array — these four literal strings are not yet wired to the live RPC result and must be replaced before production. `CFO_INSIGHT.upside` already uses the constants reactively; the JSX bodies do not. |

---

### KPI Tile: Cash Runway

| Field | Value |
|---|---|
| **Metric name** | `cash_runway_months` |
| **Canonical key** | `METRIC.CASH_RUNWAY_MONTHS` |
| **Tile ID** | `cr` |
| **Tile / Page** | Dashboard — Business Health Summary row; Cash Control page |
| **Current data source** | `CASH_RUNWAY` constant (3.4 months, `cash-snapshot.ts`) — **only** source |
| **Supabase fn / table** | None (not yet created) |
| **Fallback** | None — constant is the only source |
| **Status** | **Mock** |
| **Integration dependency** | **Xero** (cash balance from bank feed; monthly fixed costs from nominal ledger) |
| **Notes** | There is no Tier 1 or Tier 2 override. The tile shows the static snapshot constant unconditionally. Formula (planned): `cash_balance / monthly_fixed_costs`. Both inputs require Xero. The qualitative change string `"Moderate"` is also hardcoded. Do not ship this tile to production without the Xero integration (Phase 2). |

---

### KPI Tile: Net Profit / Operating Profit

| Field | Value |
|---|---|
| **Metric name** | `operating_profit_estimate` |
| **Canonical key** | `METRIC.OPERATING_PROFIT_ESTIMATE` |
| **Tile ID** | `np` |
| **Tile / Page** | Dashboard — Efficiency and Profit Leakage row; Profit Engine page (annual `BASE_EBITDA`) |
| **Current data source** | Hardcoded literal `"£56,300"` in `dashboard.tsx` — **only** source |
| **Supabase fn / table** | None (not yet created) |
| **Fallback** | None — hardcoded literal |
| **Status** | **Mock** |
| **Integration dependency** | **Xero** (P&L — monthly fixed costs required) |
| **Notes** | The `£56,300` figure is an inline JSX string in `KPI_CARDS`. It is not derived from `BASE_EBITDA` in `business-snapshot.ts` (which uses an annual basis = £78,000). No `MONTHLY_OPERATING_PROFIT` constant exists yet. Formula (planned): `monthly_contribution − monthly_fixed_costs`. Both inputs require Xero-sourced fixed costs. The change string `"↑ 18.7% vs last month"` is also hardcoded. Do not ship this tile to production without Xero (Phase 2). |

---

### KPI Tile: Acquisition Efficiency (Meta CAC)

| Field | Value |
|---|---|
| **Metric name** | `meta_cac_trend` |
| **Canonical key** | `METRIC.META_CAC_TREND` |
| **Tile ID** | `ae` |
| **Tile / Page** | Dashboard — Efficiency and Profit Leakage row; Marketing Efficiency page |
| **Current data source** | Hardcoded literal `"Meta CAC +14%"` in `dashboard.tsx` — **only** source |
| **Supabase fn / table** | None (not yet created) |
| **Fallback** | None — hardcoded literal |
| **Status** | **Phase 3** |
| **Integration dependency** | **Meta Ads API** (spend ingestion + customer acquisition source attribution) |
| **Notes** | The `"Meta CAC +14%"` value and `"↓ efficiency"` change string are both inline JSX literals. No RPC, no constant, no Tier 2 fallback. The `"14%"` figure also appears in `CFO_INSIGHT.weeklyPriorities[1].why` as a hardcoded string. Both will need replacing when `meta_cac_trend()` RPC is built (Phase 3). The Marketing Efficiency page currently uses `CAC_PAYBACK` (1.4 orders, `growth-metrics.ts`) as a related mock metric. |

---

## Part 2 — Analysis page metrics

The six analysis pages use snapshot constants from the data files as their primary data source. None of the analysis pages currently call `getPhase1Metrics()` directly.

---

### Margin Analysis (`/margin-analysis`)

| Metric | Current source | Supabase fn | Fallback | Status | Integration | Notes |
|---|---|---|---|---|---|---|
| Contribution Margin % (monthly) | `MONTHLY_CM_PCT` (42.3%) `business-snapshot.ts` | `contribution_margin_pct()` (not wired to this page yet) | — | **Mock** | Shopify + Xero | Page does not call the Phase 1 RPC; uses snapshot constant unconditionally |
| Contribution Margin % (annual) | `CONTRIBUTION_MARGIN_PCT` (38.08%) `business-snapshot.ts` | — | — | **Mock** | Xero | Derived: `CONTRIBUTION / ANNUAL_REVENUE`; annual P&L basis |
| Monthly Revenue | `MONTHLY_REVENUE` (£124,500) `business-snapshot.ts` | `gross_revenue()` (not wired here) | — | **Mock** | Shopify | Same RPC exists but page does not call it |
| Monthly Contribution £ | `MONTHLY_CM_VALUE` (£52,913) `business-snapshot.ts` | — | — | **Mock** | Shopify + Xero | Hardcoded; not derived from live RPC |
| Contribution per Order | `CONTRIBUTION_PER_ORDER` (£35.00) `business-snapshot.ts` | — | — | **Mock** | Shopify + Xero | Different basis from Scenario Lab `CONTRIBUTION_PER_ORDER` = £12.40 |
| Discount Dependency | `DISCOUNT_DEP` (38.0%) `growth-metrics.ts` | `discount_dependency()` (not wired here) | — | **Mock** | Shopify | |
| Repeat Purchase Rate | `REPEAT_RATE` (28.0%) `growth-metrics.ts` | `repeat_purchase_rate()` (not wired here) | — | **Mock** | Shopify | |
| EBITDA / Operating Profit (annual) | `BASE_EBITDA` (£78,000) `business-snapshot.ts` | — | — | **Mock** | Xero | `CONTRIBUTION − MONTHLY_FIXED_COSTS` (£198k − £120k); different from dashboard `np` tile £56,300 |
| Fixed Costs | `MONTHLY_FIXED_COSTS` (£120,000) `cash-snapshot.ts` | — | — | **Mock** | Xero | |

---

### Growth Quality (`/growth-quality`)

| Metric | Current source | Supabase fn | Fallback | Status | Integration | Notes |
|---|---|---|---|---|---|---|
| Repeat Purchase Rate | `REPEAT_RATE` (28.0%) `growth-metrics.ts` | `repeat_purchase_rate()` (not wired here) | — | **Mock** | Shopify | |
| Discount Dependency | `DISCOUNT_DEP` (38.0%) `growth-metrics.ts` | `discount_dependency()` (not wired here) | — | **Mock** | Shopify | |
| CAC Payback | `CAC_PAYBACK` (1.4 orders) `growth-metrics.ts` | — | — | **Mock** | Meta / Google | Requires blended ad spend data |
| Growth Quality Score | `GQ_SCORE` ("B-") `growth-metrics.ts` | — | — | **Mock** | None | Composite score; formula not yet defined for live computation |
| Retention Status | `RETENTION_STATUS` ("strengthening") `growth-metrics.ts` | — | — | **Mock** | None | Qualitative label; derived from repeat rate trend |

---

### Marketing / Acquisition Efficiency (`/marketing-efficiency`)

| Metric | Current source | Supabase fn | Fallback | Status | Integration | Notes |
|---|---|---|---|---|---|---|
| Meta CAC Trend | Hardcoded `"+14%"` literal | `meta_cac_trend()` (not yet built) | — | **Phase 3** | **Meta Ads API** | |
| CAC Payback | `CAC_PAYBACK` (1.4 orders) `growth-metrics.ts` | — | — | **Mock** | Meta / Google | |
| Blended ROAS | Snapshot constant (page-local) | — | — | **Mock** | Meta / Google | |
| Channel contribution mix | Snapshot data (page-local) | — | — | **Mock** | Meta / Google / Shopify | |

---

### Cash Control (`/cash-control`)

| Metric | Current source | Supabase fn | Fallback | Status | Integration | Notes |
|---|---|---|---|---|---|---|
| Cash Runway | `CASH_RUNWAY` (3.4 months) `cash-snapshot.ts` | `cash_runway_months()` (not yet built) | — | **Mock** | **Xero** | Same as `cr` dashboard tile |
| Cash Balance | `CASH_BALANCE` (£186,000) `cash-snapshot.ts` | — | — | **Mock** | **Xero** | Bank feed required |
| Monthly Fixed Costs | `MONTHLY_FIXED_COSTS` (£120,000) `cash-snapshot.ts` | — | — | **Mock** | **Xero** | Nominal ledger required |
| Working Capital Drag | `WORKING_CAPITAL_DRAG` (£74,000) `cash-snapshot.ts` | — | — | **Mock** | Shopify + Xero | Inventory + AR − AP |
| Net Cash Movement | `NET_CASH_MOVEMENT` (£14,000) `cash-snapshot.ts` | — | — | **Mock** | Xero | |
| Inventory Days | `INVENTORY_DAYS` (82 days) `cash-snapshot.ts` | — | — | **Mock** | Shopify | Inventory value ÷ COGS per day |
| Cash Conversion Cycle | `CASH_CONVERSION_CYCLE` (47 days) `cash-snapshot.ts` | — | — | **Mock** | Shopify + Xero | Inventory days − Supplier days + Receivable days |

---

### Profit Engine (`/profit-engine`)

| Metric | Current source | Supabase fn | Fallback | Status | Integration | Notes |
|---|---|---|---|---|---|---|
| Annual Revenue | `ANNUAL_REVENUE` (£520,000) `business-snapshot.ts` | — | — | **Mock** | Shopify | Annual P&L basis, not calendar-month |
| Annual Discounts | `ANNUAL_DISCOUNTS` (£82,000) `business-snapshot.ts` | — | — | **Mock** | Shopify | |
| Annual Returns | `ANNUAL_RETURNS` (£41,000) `business-snapshot.ts` | — | — | **Mock** | Shopify | |
| Annual Net Revenue | `ANNUAL_NET_REVENUE` (£397,000) `business-snapshot.ts` | — | — | **Mock** | Shopify | Derived: Revenue − Discounts − Returns |
| Annual Variable Costs | `ANNUAL_VARIABLE_COSTS` (£199,000) `business-snapshot.ts` | — | — | **Mock** | Shopify + Xero | |
| Annual Contribution | `CONTRIBUTION` (£198,000) `business-snapshot.ts` | — | — | **Mock** | Shopify + Xero | Net Revenue − Variable Costs |
| EBITDA | `BASE_EBITDA` (£78,000) `business-snapshot.ts` | — | — | **Mock** | Xero | Contribution − Fixed Costs |
| Fixed Costs | `MONTHLY_FIXED_COSTS` (£120,000) `cash-snapshot.ts` | — | — | **Mock** | Xero | |

---

### Scenario Lab / Opportunities (`/scenario-lab`, `/opportunities`)

| Metric | Current source | Supabase fn | Fallback | Status | Integration | Notes |
|---|---|---|---|---|---|---|
| Recoverable Contribution (low) | `RECOVERABLE_LOW` (£18,000) `business-snapshot.ts` — **or** live RPC result when available | `recoverable_contribution_range()` (live on Dashboard; not yet independently wired on this page) | `RECOVERABLE_LOW` constant | **Partial** | None | The Dashboard tile reads the live RPC; the Scenario Lab/Opportunities page currently reads the snapshot constants directly |
| Recoverable Contribution (high) | `RECOVERABLE_HIGH` (£42,000) `business-snapshot.ts` | Same as above | `RECOVERABLE_HIGH` constant | **Partial** | None | Same caveat as above |
| CAC Payback | `CAC_PAYBACK` (1.4 orders) `growth-metrics.ts` | — | — | **Mock** | Meta / Google | |
| Contribution per Order | `CONTRIBUTION_PER_ORDER` (£12.40, `pricing-metrics.ts`) | — | — | **Mock** | Shopify + Xero | Note: different basis from Margin Analysis page (£35.00) |

---

## Part 3 — Summary by status

| Status | Tile / metric count | Tiles / metrics |
|---|---|---|
| **Live** | 7 | `ns`, `mr`, `aov`, `rr`, `dd`, `rpr`, `rc` (dashboard) |
| **Partial** | 1 | `cm` — live RPC exists but returns NULL without a `cost_assumptions` seed row |
| **Mock** | 3 | `cr`, `np`, `ae` (dashboard); all analysis page metrics |
| **Phase 2** | 3 | `cr` (Xero cash), `np` (Xero P&L), prior-period delta strings for all 11 tiles |
| **Phase 3** | 1 | `ae` (Meta Ads API) |

---

## Part 4 — Before Phase 2 checklist (hardcoded values to remove)

These values exist in production-bound code paths and must be replaced before real merchants onboard:

| Value | Location | Replace with |
|---|---|---|
| `PHASE1_STORE_ID = "10000000-..."` | `dashboard.tsx:32` | Auth session → `stores.id` lookup |
| `"Meta CAC +14%"` tile value | `dashboard.tsx:172` | `meta_cac_trend()` RPC (Phase 3) |
| `"£56,300"` net profit tile | `dashboard.tsx:201` | `operating_profit()` RPC (Phase 2, Xero) |
| `"38%"` in CFO Insight panel text | `dashboard.tsx:52` | Interpolated live `discountDependency × 100` |
| `"14%"` in CFO Insight panel text | `dashboard.tsx:62` | `meta_cac_trend()` result (Phase 3) |
| `"£18k–£42k"` in Recoverable Contribution Pro JSX | `dashboard.tsx` | `phase1Metrics.data.recoverableLow/High` |
| `"£18k–£42k"` in Recoverable Contribution Free JSX | `dashboard.tsx` | Same as above |
| `"£12k within 30 days"` sub-range pill | `dashboard.tsx` | Opportunity-engine sub-range (Phase 2) |
| `"£30k within 90 days"` sub-range pill | `dashboard.tsx` | Opportunity-engine sub-range (Phase 2) |
| Expected Impact `"+£42k"` projection | `dashboard.tsx` | `recoverableHigh` from live RPC |
| Expected Impact `"+£64k"` projection | `dashboard.tsx` | Xero cash improvement model (Phase 2) |
| Expected Impact `"+0.8 months"` projection | `dashboard.tsx` | Computed from cash improvement ÷ fixed costs |
| Expected Impact `"+4.2pp"` projection | `dashboard.tsx` | `target_cm_pct − contributionMarginPct` |
| All 11 tile `change` strings | `dashboard.tsx` | Prior-period delta SQL functions (Phase 2) |

---

## Part 5 — Supabase functions reference

All Phase 1 functions are `SECURITY DEFINER` and live in migration `20260429000001`.
The `contribution_margin_pct` function is in migration `20260429000003`.
The `recoverable_contribution_range` function is in migration `20260429000005`.

| Function | Signature | Returns | Tile |
|---|---|---|---|
| `gross_revenue` | `(p_store_id uuid, p_date_from date, p_date_to date)` | `numeric` | `mr` |
| `discount_cost` | `(p_store_id uuid, p_date_from date, p_date_to date)` | `numeric` | internal (feeds `dd`) |
| `return_amount` | `(p_store_id uuid, p_date_from date, p_date_to date)` | `numeric` | internal (feeds `rr`) |
| `net_sales` | `(p_store_id uuid, p_date_from date, p_date_to date)` | `numeric` | `ns` |
| `order_count` | `(p_store_id uuid, p_date_from date, p_date_to date)` | `numeric` | internal (feeds `aov`) |
| `average_order_value` | `(p_store_id uuid, p_date_from date, p_date_to date)` | `numeric` | `aov` |
| `repeat_purchase_rate` | `(p_store_id uuid, p_date_from date, p_date_to date)` | `numeric [0,1]` | `rpr` |
| `discount_dependency` | `(p_store_id uuid, p_date_from date, p_date_to date)` | `numeric [0,1]` | `dd` |
| `refund_rate` | `(p_store_id uuid, p_date_from date, p_date_to date)` | `numeric [0,1]` | `rr` |
| `contribution_margin_pct` | `(p_store_id uuid, p_date_from date, p_date_to date)` | `numeric [0,1] \| NULL` | `cm` |
| `recoverable_contribution_range` | `(p_store_id uuid)` — **no date params** | `TABLE(recoverable_low numeric, recoverable_high numeric)` | `rc` |

**Tables / views read by Phase 1 functions:**
`orders`, `order_line_items`, `refunds`, `customers`, `cost_assumptions`, `v_current_cost_assumptions`, `opportunities`

---

*This document is generated from source code audit. Keep in sync when new RPCs, migrations, or wiring blocks are added.*
