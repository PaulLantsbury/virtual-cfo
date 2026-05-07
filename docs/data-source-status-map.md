# Data Source Status Map

Internal reference tracking which metrics are wired to live Supabase RPCs, seeded RPCs,
or static mock files. Updated after Phase 5 (Opportunities live orchestration wiring).

**Status key**

| Status | Meaning |
|---|---|
| **Seeded RPC** | Supabase function exists and is called in code; data is synthetic dev seed (not real customer data) |
| **Static Mock** | Hardcoded constant in `src/lib/data/*.ts`; no DB call |
| **Partial** | Some metrics on this page/section are Seeded RPC; others remain Static Mock |
| **Planned** | No wiring yet; blocked on an external integration (Shopify, Xero, Meta Ads API) or a future phase |

---

## 1. Dashboard (`/dashboard`)

### KPI Tiles

| Metric / Tile | Current Source | Status | Notes / Next action |
|---|---|---|---|
| Net Sales (`ns`) | `net_sales()` Phase 1 RPC | **Seeded RPC** | MoM delta % from Phase 2 delta RPC. Change string uses live pp diff. |
| Contribution Margin % (`cm`) | `contribution_margin_pct()` Phase 1 RPC | **Seeded RPC** | Change string still static — no prior-period CM% RPC yet. |
| Recoverable Contribution (`rc`) | `recoverable_contribution_range()` Phase 1 RPC | **Seeded RPC** | Returns low/high bounds. Change string static. |
| Average Order Value (`aov`) | `average_order_value()` Phase 1 RPC | **Seeded RPC** | Change string still static. |
| Refund Rate (`rr`) | `refund_rate()` Phase 1 RPC | **Seeded RPC** | Change string still static. |
| Repeat Purchase Rate (`rpr`) | `repeat_purchase_rate()` Phase 1 RPC | **Seeded RPC** | Change string still static. |
| Discount Dependency (`dd`) | `discount_dependency()` Phase 1 RPC | **Seeded RPC** | Change string still static. |
| Net / Operating Profit (`np`) | `operating_profit_monthly()` Phase 2a RPC | **Seeded RPC** | Change string still static — no prior-period operating profit RPC yet. |
| Cash Runway (`cr`) | Static snapshot constant | **Static Mock** | Requires Xero integration. Planned Phase 2 / Xero connection. |
| Meta CAC tile | Static snapshot constant | **Static Mock** | Requires Meta Ads API. Planned Phase 3 / ad-platform integration. |
| **All KPI change strings** | Hardcoded in `KPI_CARDS[]` array | **Static Mock** | No prior-period RPCs exist for any tile yet. Add prior-period SQL functions to eliminate. |

### Supporting UI

| Metric / Component | Current Source | Status | Notes / Next action |
|---|---|---|---|
| CFO Insight copy (why/narrative) | Hardcoded string in `CFO_INSIGHT` constant | **Static Mock** | Planned: generate from live metric comparison once deltas are live. |
| Cash Flow chart (Recharts) | Hardcoded `CASH_FLOW_DATA[]` array | **Static Mock** | Requires Xero cash-flow feed. |
| Net Profit Margin chart (Recharts) | Hardcoded `PROFIT_MARGIN_DATA[]` array | **Static Mock** | Requires monthly profit RPC with 12-month history. |
| Recent Transactions table | Express API `/api/dashboard/transactions` | **Seeded RPC** | Served from API server; seeded Drizzle/Postgres data. |
| Opportunity uplift banner | `recoverable_contribution_range()` Phase 1 RPC | **Seeded RPC** | Shares the `rc` tile RPC call. |

---

## 2. Margin Analysis (`/margin-analysis`)

| Metric / Component | Current Source | Status | Notes / Next action |
|---|---|---|---|
| CM% (current period) | `contribution_margin_pct()` Phase 1 RPC | **Seeded RPC** | Falls back to `MONTHLY_CM_PCT` snapshot on error. |
| Gross Revenue | `gross_revenue()` Phase 1 RPC | **Seeded RPC** | Falls back to `£124,500` snapshot. |
| CM Value (£) | Derived: live gross revenue × live CM% | **Seeded RPC** | Computed inside component; no direct RPC. |
| Average Discount % | `discount_dependency()` Phase 1 RPC | **Seeded RPC** | Falls back to snapshot. Prior-period variant static. |
| Returns % | `refund_rate()` Phase 1 RPC | **Seeded RPC** | Falls back to snapshot. Prior-period variant static. |
| AOV | `average_order_value()` Phase 1 RPC | **Seeded RPC** | Used to derive order volume. |
| Trailing 12-month CM% avg | `trailing_12m_cm_avg()` Phase 2a RPC | **Seeded RPC** | Falls back to `TREND_DATA`-derived average. |
| CM MoM delta (pp) | Phase 2 delta RPC (`usePhase2Deltas`) | **Seeded RPC** | `maDeltas` — fires after period resolves. |
| Prior-period CM value (£) | Static snapshot `CM_VALUE_PREV_M` | **Static Mock** | No live prior-period gross revenue × CM% RPC yet. |
| Prior-period CM% | Static snapshot `CM_PREV = 45.8` | **Static Mock** | No live prior-period CM% RPC yet. |
| Contribution per order — prior month | Static snapshot `CONTRIBUTION_PER_ORDER_PREV_M` | **Static Mock** | No live prior-period CPO RPC. |
| Contribution per order — same month LY | Static snapshot `CONTRIBUTION_PER_ORDER_LY` | **Static Mock** | No live LY comparison RPC. |
| Channel CM% bar chart | Static array `CHANNEL_CM_PCT` from `channel-metrics.ts` | **Static Mock** | Phase 3 data exists in DB — wire in next phase. |
| Discount impact table | Static mock arrays | **Static Mock** | No live discount-band breakdown yet. |
| Returns analysis | Static mock arrays | **Static Mock** | Requires returns-reason data from Shopify. |
| Trend chart (12-month) | Static `TREND_DATA[]` array | **Static Mock** | Needs monthly historical RPC with 12 rows. |
| Driver impact narrative | Hardcoded `DRIVERS[]` array | **Static Mock** | Planned: derive from live metric deltas. |

---

## 3. Marketing Efficiency (`/marketing-efficiency`)

> Phase 4 complete. This page is now partially live — see breakdown below.

| Metric / Component | Current Source | Status | Notes / Next action |
|---|---|---|---|
| Blended CAC (current period) | `blended_marketing_performance` Phase 3 RPC | **Seeded RPC** | MoM delta computed from a second prior-period fetch. |
| Blended CAC MoM delta | Second fetch of `blended_marketing_performance` (prior calendar month) | **Seeded RPC** | Falls back to static `BLENDED_CAC_CHANGE` if no prior data. |
| CAC by channel (all 4 channels) | `channel_metrics_monthly` Phase 3 RPC | **Seeded RPC** | Meta, Google Shopping, Email, Organic. MoM % delta from `cac_trend_by_channel`. |
| Channel Contribution Margin % | `channel_metrics_monthly` Phase 3 RPC | **Seeded RPC** | `contributionMarginPct` [0,1] multiplied ×100 for display. |
| Contribution Profit by channel | `channel_metrics_monthly` Phase 3 RPC | **Seeded RPC** | `netAttributedRevenue × contributionMarginPct`; chart + table + interpretation text. |
| Revenue Share by channel | `channel_metrics_monthly` Phase 3 RPC | **Seeded RPC** | Derived from `netAttributedRevenue` per channel. |
| Estimated Contribution Uplift (hero) | `channel_opportunities_active` Phase 3 RPC | **Seeded RPC** | `totalOpportunityUplift().high`; annualised figure also derived. |
| CAC Payback by channel | `cac_trend_by_channel` Phase 3 RPC | **Seeded RPC** | `cacPaybackMonths` per channel. |
| Efficiency rating per channel | Derived from live CAC vs live blended CAC | **Seeded RPC** | `cac < blended×0.7` → strong; `< blended×1.2` → watch; else → weak. |
| Blended CAC vs last year | Static snapshot `BLENDED_CAC_LY` | **Static Mock** | No LY blended CAC RPC yet. |
| ROAS metrics (blended, by channel) | Static `BLENDED_ROAS_*` constants | **Static Mock** | Requires Meta/Google Ads API. Planned Phase 3 ad-platform integration. |
| Marketing CM % KPI tile | Static `MKT_CM_*` constants | **Static Mock** | No live blended marketing CM% RPC. |
| Channel CPO (cost per order) | Static `CHANNEL_CPO` object | **Static Mock** | Not available in `channel_metrics_monthly`; needs ad spend data. |
| CAC trend chart (12-month) | Static `TREND_DATA[]` array | **Static Mock** | `cac_trend_by_channel` RPC has trend data — wire in next step. |
| Driver attribution narrative | Static `ME_DRIVERS[]` array | **Static Mock** | Planned: derive from live channel delta comparisons. |
| Opportunity narrative text | Static `ME_OPPORTUNITIES[]` array | **Static Mock** | Planned: generate from scored `channel_opportunities_active` rows. |

---

## 4. Growth Quality (`/growth-quality`)

| Metric / Component | Current Source | Status | Notes / Next action |
|---|---|---|---|
| Repeat Purchase Rate | `repeat_purchase_rate()` Phase 1 RPC | **Seeded RPC** | Falls back to `REPEAT_RATE` snapshot. |
| Repeat Rate MoM delta (pp) | Phase 2 delta RPC (`usePhase2Deltas`) | **Seeded RPC** | `gqDeltas` — fires after period resolves. |
| Discount Dependency | `discount_dependency()` Phase 1 RPC | **Seeded RPC** | Falls back to `DISCOUNT_DEP` snapshot. Score explanation text patched live. |
| Discount Dep MoM delta (pp) | Phase 2 delta RPC (`usePhase2Deltas`) | **Seeded RPC** | `gqDeltas`. |
| CAC Payback | Static snapshot `CAC_PAYBACK = 1.4` from `growth-metrics.ts` | **Static Mock** | No live CAC payback RPC yet. Wire from `cac_trend_by_channel` (Phase 3 data exists). |
| CAC Payback MoM change | Static snapshot `CAC_PAYBACK_PREV` | **Static Mock** | Same as above. |
| Growth Quality Score (composite) | Derived from fixed `SCORE_COMPONENTS[]` weights | **Static Mock** | Score gates are hardcoded; should recompute from live repeat rate + discount dep. |
| Score composition chart | Static `SCORE_COMPONENTS[]` array | **Static Mock** | Next action: recompute live score from `liveRepeatRate` and `liveDiscountDep`. |
| Driver impact (£ values) | Static `GROWTH_DRIVERS[]` array | **Static Mock** | Requires revenue × repeat-rate modelling from live data. |
| LTV / cohort chart | Static mock arrays | **Static Mock** | Requires order-level cohort data from Shopify. |

---

## 5. Pricing Optimisation (`/pricing-optimisation`)

| Metric / Component | Current Source | Status | Notes / Next action |
|---|---|---|---|
| All KPI tiles (ASP, discount %, full-price ratio, CPO) | `pricing-metrics.ts` static constants | **Static Mock** | No RPC wiring. `gross_revenue()` + `discount_dependency()` Phase 1 RPCs could seed the top tiles. |
| All delta / change values | Hardcoded `KPI_DELTA_*` constants | **Static Mock** | No prior-period pricing RPCs. |
| Price sensitivity chart | Static mock data | **Static Mock** | Requires pricing experiment data. |
| Discount band breakdown | Static mock arrays | **Static Mock** | Requires order-level discount data from Shopify. |
| Simulator sliders | Driven by static base constants | **Static Mock** | Base inputs could be replaced with live `gross_revenue()` / `discount_dependency()`. |

---

## 6. Profit Engine (`/profit-engine`)

| Metric / Component | Current Source | Status | Notes / Next action |
|---|---|---|---|
| All KPI tiles (revenue, EBITDA, break-even, margin of safety) | `business-snapshot.ts` + `cash-snapshot.ts` static constants | **Static Mock** | No RPC wiring. `operating_profit_monthly()` Phase 2a could seed the EBITDA tile. |
| EBITDA bridge waterfall chart | Static `BRIDGE_DATA[]` array | **Static Mock** | Requires Xero P&L line items. |
| Break-even analysis | Derived from static fixed/variable cost constants | **Static Mock** | Could partially wire from `gross_revenue()` Phase 1 + static cost assumptions. |
| Profit sensitivity simulator | Driven by static base constants | **Static Mock** | Base revenue could use `gross_revenue()` Phase 1 RPC. |
| Driver attribution (£) | Static mock arrays | **Static Mock** | Planned: derive from live gross revenue × CM% vs prior period. |

---

## 7. Cash Control (`/cash-control`)

| Metric / Component | Current Source | Status | Notes / Next action |
|---|---|---|---|
| Cash Balance | Static `CASH_BALANCE` from `cash-snapshot.ts` | **Static Mock** | Requires Xero bank feed. Planned Phase 2 / Xero integration. |
| Cash Runway (months) | Static `CASH_RUNWAY` from `cash-snapshot.ts` | **Static Mock** | `cash_runway_months()` Phase 2a RPC exists but is not wired on this page (wired on Dashboard tile only). Wire from same RPC. |
| Monthly Fixed Costs | Static `MONTHLY_FIXED_COSTS` from `cash-snapshot.ts` | **Static Mock** | Requires Xero P&L. |
| Working Capital Drag | Static `WORKING_CAPITAL_DRAG` | **Static Mock** | Requires inventory + payables data from Xero/Shopify. |
| Inventory Days / Supplier Days / CCC | Static constants | **Static Mock** | Requires Xero/Shopify operational data. |
| Cash bridge waterfall chart | Static `BRIDGE_DATA[]` array | **Static Mock** | Requires Xero cash-flow statement. |
| Cash sensitivity ranking chart | Static `RANKING_DATA[]` array | **Static Mock** | Planned: derive rankings from live cost and inventory data. |

---

## 8. Scenario Lab (`/scenario-lab`)

| Metric / Component | Current Source | Status | Notes / Next action |
|---|---|---|---|
| All base inputs (revenue, CPO, EBITDA, cash, runway) | `pricing-metrics.ts`, `business-snapshot.ts`, `cash-snapshot.ts` static constants | **Static Mock** | No RPC wiring. Base revenue could use `gross_revenue()` Phase 1; base EBITDA from `operating_profit_monthly()` Phase 2a. |
| Scenario sliders | All driven by static base constants | **Static Mock** | Wire base values to live RPCs so scenarios model from current reality. |
| Scenario output chart | Computed from slider state × static base | **Static Mock** | Output will be live once base inputs are wired. |

---

## 9. Profit Opportunities (`/opportunities`)

> **Status: Live Orchestration Layer with Seeded Intelligence.**
> All opportunity cards, prioritisation, phased plan, header totals, and uplift figures are
> derived live from the `opportunity_breakdown` RPC. Marketing intelligence from
> `channel_opportunities_active` enriches relevant cards. The only remaining static elements
> are plan-gated UI labels and the free-tier blurred ranges.

### API proxy architecture

`GET /api/opportunities` (Express route in `artifacts/api-server/src/routes/opportunities.ts`)
proxies the Supabase `opportunity_breakdown` RPC **server-side** using `SUPABASE_SERVICE_ROLE_KEY`.

- The demo store UUID (`10000000-0000-0000-0000-000000000001`) is hardcoded as a module-level
  constant in the route — it is **never derived from the request** (`req.query`, `req.body`, etc.).
  This prevents any client-supplied tenant access (IDOR).
- Using the service role key server-side bypasses the anon/RLS empty-result issue that arises
  because `opportunity_breakdown` is a `SECURITY INVOKER` function: when called with the anon
  key directly from the browser the function runs as `anon`, RLS finds no matching SELECT policy,
  and returns `[]` silently. The server-side proxy avoids this entirely.

### Data source architecture

| RPC / source | Role |
|---|---|
| `opportunity_breakdown` | **Orchestration / action UX source.** Creates and ranks the opportunity cards shown on the page. One row = one card. |
| `channel_opportunities_active` | **Intelligence enrichment layer.** Called by `getMarketingChannelMetrics()` on the Marketing Efficiency page; its `totalOpportunityUplift()` figure surfaces in the hero metric there. On the Opportunities page, relevant rows enrich Pricing / Marketing cards with channel-level context without creating additional cards. |

### Metric / component status

| Metric / Component | Current Source | Status | Notes / Next action |
|---|---|---|---|
| Opportunity cards (ranked list) | `GET /api/opportunities` → `opportunity_breakdown` Supabase RPC (service role, server-side proxy) | **Seeded RPC** | 5 canonical rows seeded. Store ID fixed server-side — no client-supplied tenant parameter. |
| Recoverable contribution header (low / high) | Computed live from `monthly_contribution` opportunity cards returned by RPC | **Seeded RPC** | Sums only cards where `impact_type = 'monthly_contribution'`; excludes `cash_improvement` rows. Previously static (`RECOVERABLE_LOW` / `RECOVERABLE_HIGH`). |
| Prioritisation ordering | Derived live from RPC `confidence` + `effort` fields | **Seeded RPC** | High confidence + low effort ranked first across all returned rows. |
| "Do now" vs "Next wave" classification | Derived live from RPC `timing` field | **Seeded RPC** | `immediate` / `short_term` → Do Now; `medium_term` / `long_term` → Next Wave. |
| Opportunity rationale / description | From RPC `recommended_action` field | **Seeded RPC** | Displayed as card body text. |
| Execution priority note (badge) | Derived live from RPC `confidence` + `effort` fields | **Seeded RPC** | Rendered as coloured badge per card (High / Medium priority). |
| Period label ("This month", "30–60 days", etc.) | Derived live from RPC `timing` field | **Seeded RPC** | Live label mapped from seeded timing value per card. |
| Total estimated uplift (bottom row) | Computed live from all opportunity cards (all `impact_type` values) | **Seeded RPC** | Includes `cash_improvement` rows (e.g. £40k–60k inventory release). Separate sum from the header total. |
| Source page link | From RPC `linked_page` / `linked_page_label` fields | **Seeded RPC** | Links to the relevant CFO page per opportunity. |
| Phase 3 marketing intelligence enrichment | `channel_opportunities_active` Phase 3 RPC via `getMarketingChannelMetrics()` | **Seeded RPC** | Enriches Pricing / Marketing opportunity cards with channel-level context. Does not create additional cards or change card count. |

---

## 10. Phase 3 Marketing Intelligence RPCs

These four Supabase functions are called from `artifacts/virtual-cfo/src/lib/analytics/marketingChannelMetrics.ts`.
All data is seeded dev data for store `10000000-0000-0000-0000-000000000001`.

| RPC / Table | Fields returned | Called by | Wired on page(s) |
|---|---|---|---|
| `channel_metrics_monthly` | `channel`, `cac`, `contribution_margin_pct`, `net_attributed_revenue`, `orders`, `data_freshness` | `getMarketingChannelMetrics()` | Marketing Efficiency |
| `blended_marketing_performance` | `blended_cac`, `blended_contribution_margin_pct`, `total_spend`, `total_orders` | `getMarketingChannelMetrics()` | Marketing Efficiency |
| `channel_opportunities_active` | `channel`, `opportunity_type`, `estimated_uplift_low`, `estimated_uplift_high`, `cac_payback_orders`, `confidence`, `status` | `getMarketingChannelMetrics()` | Marketing Efficiency |
| `cac_trend_by_channel` | `channel`, `period_month`, `cac`, `cac_payback_months`, `orders` | `getMarketingChannelMetrics()` | Marketing Efficiency |

### Phase 3 helper utilities (in `marketingChannelMetrics.ts`)

| Function | Purpose |
|---|---|
| `findChannel(channels, slug)` | Safe lookup of a channel by slug with undefined guard |
| `getCacTrendForChannel(trend, channel)` | Filters trend rows for a specific channel |
| `sortByContributionGap(channels)` | Ranks channels by CM% gap for reallocation logic |
| `filterOpportunitiesByType(opportunities, type)` | Filters opportunities by type slug |
| `totalOpportunityUplift(opportunities)` | Sums `estimatedUpliftLow`/`High` across all active opportunities |

---

## 11. Phase 1 & 2 RPC Inventory

All Phase 1 RPCs are called from `artifacts/virtual-cfo/src/lib/analytics/phase1Metrics.ts`
via `useLatestDataPeriod()`. Phase 2a is called from `phase2aMetrics.ts`.

| RPC Function | Phase | Returns | Used on pages |
|---|---|---|---|
| `gross_revenue(store_id, date_from, date_to)` | 1 | Gross revenue £ | Dashboard, Margin Analysis |
| `net_sales(store_id, date_from, date_to)` | 1 | Net sales £ | Dashboard, Margin Analysis |
| `average_order_value(store_id, date_from, date_to)` | 1 | AOV £ | Dashboard, Margin Analysis |
| `repeat_purchase_rate(store_id, date_from, date_to)` | 1 | Rate [0,1] | Dashboard, Growth Quality |
| `discount_dependency(store_id, date_from, date_to)` | 1 | Rate [0,1] | Dashboard, Margin Analysis, Growth Quality |
| `refund_rate(store_id, date_from, date_to)` | 1 | Rate [0,1] | Dashboard, Margin Analysis |
| `contribution_margin_pct(store_id, date_from, date_to)` | 1 | CM% [0,1] or null | Dashboard, Margin Analysis |
| `recoverable_contribution_range(store_id, date_from, date_to)` | 1 | `{low, high}` £ | Dashboard |
| `cash_runway_months(store_id)` | 2a | Months (float) or null | Dashboard |
| `operating_profit_monthly(store_id, date_from, date_to)` | 2a | Profit £ or null | Dashboard |
| `trailing_12m_cm_avg(store_id, date_to)` | 2a | CM% [0,1] | Margin Analysis |
| Prior-period deltas (various) | 2 | `{metric}_prv`, `{metric}_delta_pct` | Dashboard, Margin Analysis, Growth Quality |

---

## Summary: Live vs Mock at a glance

| Page | Overall status | Live metrics | Still static |
|---|---|---|---|
| **Dashboard** | Partial | 8 KPI tile values (Phase 1 + 2a RPCs), transactions table | All KPI change strings, cash runway, Meta CAC, charts |
| **Margin Analysis** | Partial | CM%, gross revenue, AOV, discount %, returns %, trailing 12m avg, MoM deltas | Prior-period values, channel CM% chart, trend chart, drivers |
| **Marketing Efficiency** | Partial | Blended CAC, CAC by channel, channel CM%, contribution profit, revenue share, CAC payback, opportunity uplift | ROAS, CAC trend chart, CPO, driver narrative |
| **Growth Quality** | Partial | Repeat rate, discount dependency, MoM deltas for both | CAC payback, quality score, driver £ values, LTV chart |
| **Pricing Optimisation** | Static Mock | — | Everything |
| **Profit Engine** | Static Mock | — | Everything |
| **Cash Control** | Static Mock | — | Everything (cash runway RPC exists but not wired here) |
| **Scenario Lab** | Static Mock | — | Everything |
| **Profit Opportunities** | Mostly Live | Opportunity cards, prioritisation ordering, Do Now / Next Wave classification, rationale, execution priority badge, period label, recoverable contribution header totals, total estimated uplift, Phase 3 marketing intelligence enrichment — all from live RPC | Plan-gated UI labels; free-tier blurred ranges |

### Top priorities for next wiring phases
1. **Growth Quality** — CAC payback can come from `cac_trend_by_channel` (Phase 3, data already seeded); quality score should recompute from live repeat rate + discount dep
2. **Marketing Efficiency** — CAC trend chart can use `cac_trend_by_channel` data already fetched but not yet passed to the Recharts component
3. **All pages** — prior-period KPI change strings need prior-period SQL functions (no `_prev` RPCs exist yet for most metrics)
4. **Cash Control / Profit Engine** — blocked on Xero integration; no internal data path exists
5. **Pricing Optimisation** — top tiles could be partially seeded from Phase 1 `gross_revenue()` + `discount_dependency()` without new RPCs
6. **Opportunities — Supabase DDL access** — `opportunity_breakdown` is `SECURITY INVOKER`; cannot change to `SECURITY DEFINER` without direct psql access (Replit runner IPs are blocked by Supabase network policy). Current server-side proxy workaround is stable. Migration file `db-migrations/migrations/20260507000003_seed_opportunities.sql` documents the DDL fix ready to apply when access is available.
