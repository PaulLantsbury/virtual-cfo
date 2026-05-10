# Number Source Audit — Virtual CFO Dashboard

**Date:** 2026-05-10  
**Scope:** Dashboard, Margin Analysis, Growth Quality, Marketing Efficiency, Pricing Optimisation  
**Author:** Automated audit from source-code review

---

## Classification Key

| Code | Meaning |
|------|---------|
| **L** | **Live Supabase** — value served directly from a Supabase RPC or table query for the resolved current period |
| **D** | **Derived from live** — computed in-browser from one or more **L** values (arithmetic, ratios, lookups) |
| **SF** | **Static fallback** — hardcoded constant or imported static data file; displayed when live data is unavailable or still loading |
| **MA** | **Modelled assumption** — intentionally calculated from a parameterised cost model rather than a raw data point (e.g. cost-rate × live volume) |
| **FI** | **Requires future integration** — the number needs an external data source not yet connected (e.g. Meta Ads API, Google Ads API, Xero) |

Where a tile has a live primary and a static fallback, both codes appear: e.g. **L / SF**.

---

## 1. Dashboard (`/dashboard`)

### 1a. KPI Tile — Primary Values

| Tile | Displayed Value | Code | Source Detail |
|------|----------------|------|---------------|
| Monthly Revenue | £124,500 (or live) | **L / SF** | Primary: `gross_revenue()` RPC (Phase 1) for resolved calendar month. Fallback: `MONTHLY_REVENUE` = £124,500 from `business-snapshot.ts`. SF shown while loading or when RPC returns 0. |
| Net Sales | £xxx (or live) | **L / SF** | Primary: `net_sales()` RPC (Phase 1). Fallback: `commerceMetrics.netSales` (all-time, no date filter). |
| Average Order Value | £xxx | **L / SF** | Primary: `average_order_value()` RPC (Phase 1). Fallback: `commerceMetrics.averageOrderValue` (all-time; different denominator — see data dict §A.6). |
| Refund Rate | x% | **L / SF** | Primary: `refund_rate()` RPC (Phase 1). Fallback: `commerceMetrics.refundRate` (all-time). |
| Contribution Margin % | 42% (or live) | **L / SF** | Primary: `contribution_margin_pct()` RPC (Phase 1); uses `v_current_cost_assumptions` per store. Fallback: `commerceMetrics.contributionMarginPercent` (estimated, not store-personalised). Returns `null` when no cost-assumption row exists → fallback. |
| Discount Dependency | x% | **L / SF** | Primary: `discount_dependency()` RPC (Phase 1). Fallback: `commerceMetrics.discountRate` (all-time). |
| Repeat Purchase Rate | x% | **L / SF** | Primary: `repeat_purchase_rate()` RPC (Phase 1). Fallback: `commerceMetrics.repeatPurchaseRate` (all-time; different formula — all-orders count, not period window). |
| Recoverable Contribution | £18k–£42k (or live) | **L / SF** | Primary: `recoverable_contribution_range()` RPC — `SUM(impact_low / impact_high)` from non-archived opportunities (no date filter). Fallback: `RECOVERABLE_LOW` = £18,000 / `RECOVERABLE_HIGH` = £42,000 from `business-snapshot.ts`. |
| Cash Runway | x.x months | **L / SF** | Primary: `cash_runway_months()` RPC (Phase 2a) — `MAX(cash_balance_snapshot) / monthly_overhead`. Fallback: `CASH_RUNWAY` = 3.4 from `cash-snapshot.ts`. Used when RPC fails or returns `null` (no cash-balance snapshot row). |
| Net Profit | −£10,184 (or live) | **L / SF** | Primary: `operating_profit_monthly()` RPC (Phase 2a) — `(net_sales × cm_pct) − monthly_overhead_total("actual")`. Fallback: `MONTHLY_OPERATING_PROFIT` = −£10,184 from `business-snapshot.ts`. |
| Acquisition Efficiency | "Meta CAC +14%" | **SF / FI** | Hardcoded string in `KPI_CARDS`. No RPC or API connection. Needs Meta Ads API + ad-spend data. **FI gap.** |

### 1b. KPI Tile — MoM Change Badges

| Tile | Change Badge | Code | Source Detail |
|------|-------------|------|---------------|
| Monthly Revenue | ↑/↓ x% | **L** | `gross_revenue_delta_pct` from `month_on_month_delta()` RPC (Phase 2 delta). Shows "—" if prior period has no data. |
| Net Sales | ↑/↓ x% | **L** | `net_sales_delta_pct` from Phase 2 delta RPC. |
| Average Order Value | ↑/↓ x% | **L** | `aov_delta_pct` from Phase 2 delta RPC. |
| Refund Rate | ↑/↓ x pp | **L** | `refund_rate_delta_pp` from Phase 2 delta RPC. |
| Contribution Margin % | ↑/↓ x pp | **L** | `cm_pct_delta_pp` from Phase 2 delta RPC. |
| Discount Dependency | ↑/↓ x pp | **L** | `discount_dep_delta_pp` from Phase 2 delta RPC. |
| Repeat Purchase Rate | ↑/↓ x pp | **L** | `rpr_delta_pp` from Phase 2 delta RPC. |
| Net Profit | ↑/↓ x% | **L** | `op_profit_delta_pct` from Phase 2 delta RPC. |
| Cash Runway | Qualitative text | **D** | Derived from live runway value (≥6 → "Healthy"; 3–6 → "Adequate"; 1–3 → "Tightening"; <1 → "Critical"). No MoM delta RPC for cash runway. |
| Recoverable Contribution | "Immediate margin recovery available" | **SF** | Hardcoded string — presence of non-zero opportunities is live-detected, but the label text is static. |
| Acquisition Efficiency | "↓ efficiency" | **SF** | Hardcoded string. |

### 1c. Trend Lines (Phase 2c)

| Tile | Trend Line | Code | Source Detail |
|------|-----------|------|---------------|
| Average Order Value | "AOV rose/fell x% … £y above/below trend" | **D** | Computed from live `aov_delta_pct` (Phase 2 delta) + live `aov_3m_avg` (`rolling_3m_averages()` RPC). |
| Net Profit | "Profit improved/worsened by £x … £y above/below trend" | **D** | Computed from live `op_profit_delta_pct` + `op_profit_cur/prv` (Phase 2 delta) + live `operating_profit_3m_avg` (`rolling_3m_averages()` RPC). |

### 1d. Business Health Verdict Hero (§2)

| Element | Code | Note |
|---------|------|------|
| "AMBER — Moderate Risk" overall verdict | **SF** | Hardcoded string |
| "The business remains profitable…" narrative | **SF** | Hardcoded |
| "£9.4k" context strip figure | **SF** | Hardcoded |

### 1e. Health Modules Strip (§3)

| Module | Value | Code | Note |
|--------|-------|------|------|
| "Contribution at risk" | £20.4k | **SF** | Hardcoded string (`HEALTH_MODULES` array) |
| "Discount leakage" | £52k | **SF** | Hardcoded string |
| "Discount dependency" | 38% | **SF** | Hardcoded string (duplicates the live tile above but here it is static) |
| "Acquisition efficiency" | "Meta CAC +14%" | **SF / FI** | Hardcoded string; needs Meta Ads API |
| "Pricing opportunity" | £64k | **SF** | Hardcoded string |
| "Recoverable contribution" | £18k–£42k | **L / SF** | Live when `recoverable_contribution_range()` resolves; falls back to `RECOVERABLE_LOW / HIGH` constants |

### 1f. Top Drivers (§4)

All rows in `TOP_DRIVERS` are **SF**. Examples:
- "Meta CAC climbed £3.40/order" — **SF**
- "Shipping cost up £2.10/order" — **SF**
- "Discount depth +1.8pp this month" — **SF**
- "Repeat purchasers fell 4pp" — **SF**
- "Returns rate up 0.7pp" — **SF**

### 1g. Priority Actions (§5)

All rows in `PRIORITY_ACTIONS` are **SF**. All £ impacts, percentage uplifts, and timelines are hardcoded strings.

### 1h. Cash Flow Chart & Net Profit Margin Chart

| Chart | Code | Source |
|-------|------|--------|
| Cash Flow line chart (12-month) | **SF** | `MONTHLY_REVENUE` array from `business-snapshot.ts` |
| Net Profit Margin bar chart (12-month) | **SF** | `MONTHLY_OPERATING_PROFIT` array from `business-snapshot.ts` |

### 1i. Recent Transactions Table

| Element | Code | Source |
|---------|------|--------|
| Transaction rows | **L** | API: `GET /api/dashboard/transactions` → Drizzle ORM → PostgreSQL |

---

## 2. Margin Analysis (`/margin-analysis`)

### 2a. KPI Strip — Primary Values

| Metric | Code | Source Detail |
|--------|------|---------------|
| Contribution Margin % (current) | **L / SF** | Primary: `contribution_margin_pct()` RPC (Phase 1). Fallback: `MONTHLY_CM_PCT` = 42.3% from `business-snapshot.ts`. |
| Contribution Margin % (prior month) | **SF** | `CM_PREV` = 45.8% — hardcoded constant. No prior-period RPC exists yet. |
| Contribution Margin £ (current) | **D** | `CM_PCT × net_sales` — both from live Phase 1 RPCs. Falls back to `CM_VALUE_PREV_M` static if Phase 1 unavailable. |
| Contribution Margin £ (prior month) | **SF** | `CM_VALUE_PREV_M` = £57,125 — hardcoded (comment: "45.8% of prior month revenue"). |
| Contribution Margin £ (last year) | **SF** | `CM_VALUE_LY` = £56,972 — hardcoded (comment: "48.2% of last-year revenue"). |
| Contribution per Order (current) | **D** | Derived from live CM £ ÷ live order count (Phase 1). |
| Contribution per Order (prior month) | **SF** | `CONTRIBUTION_PER_ORDER_PREV_M` = £38.20 — hardcoded. |
| Contribution per Order (last year) | **SF** | `CONTRIBUTION_PER_ORDER_LY` = £40.50 — hardcoded. |
| Avg Discount % (current) | **D** | `discount_dependency()` RPC × 100 (Phase 1) — live. |
| Avg Discount % (prior month) | **SF** | `AVG_DISCOUNT_PREV_M` = 5.2% — hardcoded. |
| Avg Discount % (last year) | **SF** | `AVG_DISCOUNT_LY` = 4.8% — hardcoded. |
| Returns % (current) | **D** | `refund_rate()` RPC × 100 (Phase 1) — live. |
| Returns % (prior month) | **SF** | `RETURNS_PREV_M` = 1.8% — hardcoded. |
| Returns % (last year) | **SF** | `RETURNS_LY` = 1.4% — hardcoded. |
| CAC Payback (current) | **SF** | `CAC_PAYBACK` = 1.4 from `growth-metrics.ts` — static. Not yet wired to Phase 3 on this page (only live on Growth Quality / Marketing Efficiency). |
| CAC Payback (prior month) | **SF** | `CAC_PAYBACK_PREV` = 1.1 from `growth-metrics.ts` — static. |
| CAC Payback (last year) | **SF** | `CAC_PAYBACK_LY` = 0.9 — hardcoded on this page. |

### 2b. MoM Change Badges (KPI Strip)

| Badge | Code | Source |
|-------|------|--------|
| CM% delta (pp) | **L** | `cm_pct_delta_pp` from `month_on_month_delta()` Phase 2 delta RPC. |
| CM £ delta (%) | **L** | Derived from Phase 2 delta RPC `cm_value_delta_pct` field. |
| Discount dependency delta | **L** | `discount_dep_delta_pp` from Phase 2 delta RPC. |
| Refund rate delta | **L** | `refund_rate_delta_pp` from Phase 2 delta RPC. |

### 2c. CM% Trend Chart (12-month line)

All 13 data points in `TREND_DATA` are **SF**:  
Mar '25 = 48.2%, Apr = 47.8%, … Feb = 43.7%, Mar '26 = 42.3% — hardcoded array in margin-analysis.tsx.

### 2d. Trailing 12-Month CM% Average

| Metric | Code | Source |
|--------|------|--------|
| 12m average CM% | **L / SF** | Primary: `trailing_12m_cm_avg()` Supabase RPC (Phase 2 delta hook). Fallback: `CM_12M_AVG_FALLBACK` = computed from `TREND_DATA` slice (still static source data). |

### 2e. Channel CM% Strip

| Channel | Value | Code | Source |
|---------|-------|------|--------|
| Email | 58.6% | **SF** | `CHANNEL_CM_PCT.email` from `channel-metrics.ts` — static snapshot. On this page only; Marketing Efficiency page has live override. |
| Organic | 52.3% | **SF** | `CHANNEL_CM_PCT.organic` — static. |
| Google Shopping | 40.1% | **SF** | `CHANNEL_CM_PCT.googleShopping` — static. |
| Meta | 34.2% | **SF** | `CHANNEL_CM_PCT.meta` — static. |

### 2f. Contribution Bridge (§ Revenue → Contribution waterfall)

All six rows in `BRIDGE_ROWS` are **SF**:

| Row | Value | Code |
|-----|-------|------|
| Revenue | £124,500 / £68.40 per order | **SF** |
| Discounts | −£8,715 / −£8.10 | **SF** |
| Payment fees | −£2,490 / −£1.90 | **SF** |
| Shipping costs | −£15,562 / −£4.80 | **SF** |
| Fulfilment costs | −£17,430 / −£6.40 | **SF** |
| Marketing spend | −£27,390 / −£12.20 | **SF** |

### 2g. CFO Insight Card

| Element | Code | Note |
|---------|------|------|
| "£20,400 in estimated additional contribution next month" | **SF** | Hardcoded in `CFO_INSIGHT.recovery.cashTotal` |
| "42.3%, below the target range of 45–55%" | **SF** | Hardcoded string (matches `MONTHLY_CM_PCT` static constant) |
| Primary drivers list (Meta CAC, shipping, discount) | **SF** | Hardcoded array |
| "+2–4pp" opportunity label | **SF** | Hardcoded |
| "could reach 40% in approximately 2 months" risk note | **SF** | Hardcoded |

### 2h. Recovery Scenarios

All three rows in `RECOVERY_SCENARIOS` are **SF / MA**:

| Scenario | ppGain | cashImpact | Code |
|----------|--------|-----------|------|
| Reallocate Meta spend | +1.4pp | £9,500 | **SF / MA** — formula documented (`ppGain × monthlyRevenue / 100`) but inputs are static |
| Reduce shipping costs | +1.0pp | £6,800 | **SF / MA** |
| Lower discount depth | +0.6pp | £4,100 | **SF / MA** |
| **Total recovery** | **+3.0pp** | **£20,400** | **SF / MA** — computed from the above static rows |

### 2i. Recovery Target and Risk Monitor

| Metric | Code | Note |
|--------|------|------|
| Recovery target CM% (42.3% + 3.0pp = 45.3%) | **D** | Current CM% is live; +3.0pp gain is from static `RECOVERY_TOTAL_PP`. Mixed live + static. |
| "Risk: monitor if CM% falls below 40%" | **D / SF** | Threshold is hardcoded; comparison uses live CM%. |

### 2j. Sensitivity Ranking

All rows in the sensitivity ranking with their £ per-pp impacts are **SF**.

---

## 3. Growth Quality (`/growth-quality`)

### 3a. Growth Quality Score

| Element | Code | Source Detail |
|---------|------|---------------|
| Composite score (numeric) | **D** | Weighted average of 5 sub-scores, each computed from live metric values (see 3b below). |
| Grade letter (A–D) | **D** | Derived from composite numeric score via `numericToGrade()`. |
| Prior-month grade | **D** | Computed from prior-period RPCs: `rpr_delta_pp`, `discount_dep_delta_pp`, `aov_delta_pct`, `blendedCacMom` (Phase 3 CAC trend). All live. Grade direction ("Up from B", "Stable vs B+") is **D**. |
| "Healthy range: A– to B+" | **SF** | Hardcoded label |

### 3b. Score Sub-Components (all five)

Each sub-score is **D** (derived from live inputs). The "Retention quality" text and score bracket labels are **D**:

| Sub-score | Live input | Code |
|-----------|-----------|------|
| Retention quality (repeat rate ÷ 30% benchmark) | `repeat_purchase_rate()` RPC (Phase 1) | **D from L** |
| Discount reliance (discount_dependency vs 25% benchmark) | `discount_dependency()` RPC (Phase 1) | **D from L** |
| CAC efficiency (cac_payback_orders vs 1.2 benchmark) | `cac_payback_orders` from `channel_metrics_monthly()` RPC (Phase 3) | **D from L** |
| Contribution quality (blended marketing CM% vs 45% benchmark) | `contributionMarginPct` from `blended_marketing_performance()` RPC (Phase 3) | **D from L** |
| Channel mix quality (email+organic revenue share ≥ 50%) | `attributedNetSales` per channel from `channel_metrics_monthly()` RPC (Phase 3) | **D from L** |

### 3c. KPI Strip

| Metric | Code | Source |
|--------|------|--------|
| Growth Quality Score (letter) | **D** | Derived composite (see 3a) |
| Repeat Rate % | **L / SF** | `repeat_purchase_rate()` RPC (Phase 1); SF: `REPEAT_RATE` = 28% from `growth-metrics.ts` |
| Discount Dependency % | **L / SF** | `discount_dependency()` RPC (Phase 1); SF: `DISCOUNT_DEP` = 38% from `growth-metrics.ts` |
| Blended Marketing CM% | **L / SF** | `blended_marketing_performance()` RPC (Phase 3) — `blendedCmPct` field; SF: `BLENDED_CM_PCT` = 38.6% from `channel-metrics.ts` |
| Blended CAC Payback (orders) | **L / SF** | Weighted average of `cac_payback_orders` across channels from `channel_metrics_monthly()` RPC; SF: from `PAYBACK_BY_CHANNEL` in `channel-metrics.ts` |

### 3d. MoM Change Badges (KPI Strip)

| Badge | Code | Source |
|-------|------|--------|
| Repeat Rate MoM | **L** | `rpr_delta_pp` from Phase 2 delta RPC |
| Discount Dependency MoM | **L** | `discount_dep_delta_pp` from Phase 2 delta RPC |
| Blended CM% MoM | **L** | `blendedCacMom` from Phase 3 CAC trend RPC |
| CAC Payback MoM | **L** | Computed from `getCacTrendForChannel()` over Phase 3 `cac_trend_by_channel()` RPC |

### 3e. Growth Classification Banner

| Element | Code | Note |
|---------|------|------|
| Classification label ("Fragile growth / Paid-dependent") | **D** | Computed from live composite score and sub-score values via `GROWTH_TYPE` object |
| Risk level badge ("High / Medium / Low") | **D** | Derived from same live score logic |
| Risk signal text | **D** | Template string populated with live metric values |
| "Prior period: …" sub-label | **SF** | `GQ_SCORE_PREV` = "B" — hardcoded. No prior-period composite score RPC exists yet. |

### 3f. Composition Donut Chart

| Element | Code | Note |
|---------|------|------|
| Revenue-type segments (Repeat / New Paid / New Organic / New Other) | **SF** | `COMPOSITION_DATA` array hardcoded in `growth-metrics.ts` |
| £ recoverable upside label | **SF** | `RECOVERABLE_UPSIDE` = "£12k–£28k" from `growth-metrics.ts` — hardcoded string |

### 3g. Key Drivers

All rows in `KEY_DRIVERS` (driver labels, ↑/↓ pp impact values, narrative text) are **SF**.  
Examples: "Repeat rate declining −4pp", "Discount depth +3pp month on month" — hardcoded strings in `growth-metrics.ts`.

---

## 4. Marketing Efficiency (`/marketing-efficiency`)

### 4a. Blended CAC KPI

| Metric | Code | Source Detail |
|--------|------|---------------|
| Blended CAC (current period) | **L / SF** | Primary: `blendedCac` from `blended_marketing_performance()` RPC via `getMarketingChannelMetrics()` (Phase 3). Fallback: `BLENDED_CAC` = £28.40 from `channel-metrics.ts`. |
| Blended CAC (prior month) | **L / SF** | Primary: `liveBlendedPrev.blendedCac` — Phase 3 RPC called for prior calendar month dates. Fallback: `BLENDED_CAC_PREV` from `channel-metrics.ts`. |
| Blended CAC MoM change (£) | **D** | `liveBlendedCac − liveBlendedCacPrev` — both from live Phase 3 RPCs (with static fallbacks). |
| Blended CAC vs LY change (£) | **D / SF** | `liveBlendedCac − BLENDED_CAC_LY`. `BLENDED_CAC_LY` is **SF** (no prior-year RPC). |

### 4b. CAC by Channel Table

| Channel | CAC | MoM % change | Code |
|---------|-----|--------------|------|
| Meta | live | live | **L / SF** | `cac` from `channel_metrics_monthly()` RPC for "meta". MoM % from `cac_trend_by_channel()` RPC. SF: row from `CAC_BY_CHANNEL` in `channel-metrics.ts` if RPC returns null. |
| Google Shopping | live | live | **L / SF** | Same pattern — "google_shopping" slug. |
| Email | live | live | **L / SF** | "email" slug. |
| Organic | live | live | **L / SF** | "organic" slug. |

### 4c. ROAS by Channel

All ROAS values are **SF / FI**:

| Metric | Code | Note |
|--------|------|------|
| ROAS — Meta, Google, Email, Organic | **SF / FI** | `BLENDED_ROAS` and per-channel ROAS from `channel-metrics.ts` — static snapshots. Actual ROAS requires ad platform API (Meta/Google Ads). **FI gap.** |

### 4d. Channel Contribution Margin %

| Channel | Code | Source |
|---------|------|--------|
| Email CM% | **L / SF** | `contributionMarginPct` from Phase 3 `channel_metrics_monthly()` RPC — "email" row. SF: `CHANNEL_CM_PCT.email` = 58.6%. |
| Organic CM% | **L / SF** | Phase 3 RPC — "organic" row. SF: 52.3%. |
| Google Shopping CM% | **L / SF** | Phase 3 RPC — "google_shopping" row. SF: 40.1%. |
| Meta CM% | **L / SF** | Phase 3 RPC — "meta" row. SF: 34.2%. |

### 4e. Channel Contribution Profit (£)

| Channel | Code | Source |
|---------|------|--------|
| Email, Organic, Google Shopping, Meta (£ CP) | **L / SF** | `contributionProfit` from Phase 3 `channel_metrics_monthly()` RPC per channel. SF: `CHANNEL_CP` static array from `channel-metrics.ts`. |
| Best/Worst CP channel label | **D** | `liveCpSortedDesc` — sorted from live CP values above. |

### 4f. Channel Revenue Share vs Contribution Share Chart

| Element | Code | Note |
|---------|------|------|
| Revenue share % per channel | **D** | `channel.attributedNetSales / liveTotalChannelRevenue × 100` — from Phase 3 RPC. SF: `CHANNEL_SHARE` static array. |
| CP share % per channel | **D** | `channel.cp / liveTotalAttributedCp × 100` — from Phase 3 live CP values. |
| Share delta (CP share − Rev share) | **D** | Computed from the two **D** values above. |

### 4g. CAC Payback by Channel

| Channel | Code | Source |
|---------|------|--------|
| Email, Organic, Google Shopping, Meta payback (orders) | **L / SF** | `cac_payback_orders` from Phase 3 `channel_metrics_monthly()` RPC per channel. SF: `PAYBACK_BY_CHANNEL` from `channel-metrics.ts`. |

### 4h. Opportunity Uplift

| Metric | Code | Source |
|--------|------|--------|
| Estimated Contribution uplift (£) | **L / SF** | `totalOpportunityUplift(liveOpportunities).high` from `channel_opportunities_active()` RPC (Phase 3). SF: `ESTIMATED_CONTRIBUTION` = £18,200 from `channel-metrics.ts`. |

### 4i. Marketing Drivers (§ change drivers table)

All rows in `ME_DRIVERS` are **SF**. Examples:
- "Blended CAC up £3.40/order since Feb" — **SF**
- "Email contribution margin fell 2.4pp" — **SF**
- All £ and pp figures in driver rows — **SF**

### 4j. Marketing Spend and MKT_CP (contribution profit total)

| Metric | Code | Note |
|--------|------|------|
| Marketing spend (total £) | **SF** | `MKT_CP` / `MKT_CM` from `channel-metrics.ts` — static. No marketing spend ledger connected. **FI gap.** |
| MKT CM% (38.6%) | **SF / L** | SF fallback from `channel-metrics.ts`; overridden by Phase 3 blended RPC when available. |

### 4k. Budget Reallocation Simulator

| Element | Code | Note |
|---------|------|------|
| Slider inputs (Meta→Email, Meta→Organic, Google→Email, Google→Organic) | Interactive (0–30%) | User-controlled, no data source |
| `simContribution` = shiftRatio × £18,200 | **SF / MA** | £18,200 baseline is `ESTIMATED_CONTRIBUTION` — static or Phase 3 live; formula coefficients are modelled. |
| `simCacChange` = shiftRatio × 1.10 | **MA** | Modelled coefficient — not from any data source. |
| `simMarginGain` = shiftRatio × 3.0pp | **MA** | Modelled coefficient. |
| `simHighConf` = shiftRatio × £9,800 | **MA** | Modelled coefficient. |
| `simMedConf` = shiftRatio × £8,400 | **MA** | Modelled coefficient. |
| `simRisk` = "Medium" if shift > 15% | **MA** | Rule-based, no data. |

---

## 5. Pricing Optimisation (`/pricing-optimisation`)

> **Overall status: entirely static.** No Supabase RPCs are called on this page. All values originate from `pricing-metrics.ts` or are hardcoded in the page file. The page imports use `@dynamic` comments flagging where live replacements are needed.

### 5a. KPI Strip

| Metric | Value | Code | Source |
|--------|-------|------|--------|
| Gross Revenue | £420,000 | **SF** | `GROSS_REVENUE` from `pricing-metrics.ts` |
| Discount Cost | £64,000 | **SF** | `DISCOUNT_COST` from `pricing-metrics.ts` |
| Returns Impact | £18,000 | **SF** | `RETURNS_IMPACT` from `pricing-metrics.ts` |
| Orders | 16,000 | **SF** | `ORDERS` from `pricing-metrics.ts` |
| Base Contribution | £198,000 | **SF** | `BASE_CONTRIBUTION` from `pricing-metrics.ts` |
| Avg Discount % | 18% | **SF** | `AVG_DISCOUNT_PCT` from `pricing-metrics.ts` |
| Net Revenue (derived) | £356,000 | **D / SF** | `GROSS_REVENUE − DISCOUNT_COST` — arithmetic on two static constants |
| Net Retained Revenue | £338,000 | **D / SF** | `BASE_NET_REVENUE − RETURNS_IMPACT` — arithmetic on two static constants |

### 5b. KPI Delta Badges (period-on-period)

All delta values are **SF**:

| Badge | Value | Code |
|-------|-------|------|
| ASP change | −£1.20 | **SF** — `KPI_DELTA_ASP` |
| Avg discount delta | +3pp | **SF** — `KPI_DELTA_AVG_DISCOUNT` |
| Full-price ratio delta | −6pp | **SF** — `KPI_DELTA_FULL_PRICE_RATIO` |
| Contribution per order delta | −£2.10 | **SF** — `KPI_DELTA_CONTRIB_PER_ORDER` |
| Discount cost delta | +£14,000 | **SF** — `KPI_DELTA_DISCOUNT_COST` |
| Returns impact delta | +£5,000 | **SF** — `KPI_DELTA_RETURNS_IMPACT` |
| Recoverable contribution delta | +£11,000 | **SF** — `KPI_DELTA_RECOVERABLE_CONTRIB` |

### 5c. Revenue Bridge Chart & Table

All bars and table rows derive from the **SF** constants above. No live data.

| Row | Code |
|-----|------|
| Gross Revenue, Discounts, Net Revenue, Returns, Net Retained | **D / SF** — arithmetic combinations of `GROSS_REVENUE`, `DISCOUNT_COST`, `RETURNS_IMPACT` |

### 5d. Contribution Leakage Chart

| Segment | Value | Code |
|---------|-------|------|
| Discounts | £64,000 | **SF** — `DISCOUNT_COST` |
| Returns | £18,000 | **SF** — `RETURNS_IMPACT` |
| Shipping subsidy | £11,000 | **SF** — hardcoded in page file |
| Payment fees | £9,000 | **SF** — hardcoded in page file |

### 5e. Pricing Power Trend Chart

All 6 periods in `TREND_DATA` are **SF** (Jan–Jun, discount %, full-price %, contrib per order).

### 5f. Pricing Movement Drivers

All 5 rows in `PRICING_DRIVER_DATA` are **SF**:

| Driver | Impact | Code |
|--------|--------|------|
| ASP change | −£8,000 | **SF** |
| Discount increase | −£14,000 | **SF** |
| Full-price mix | −£9,000 | **SF** |
| Returns movement | −£5,000 | **SF** |
| Product mix improvement | +£12,000 | **SF** |

### 5g. Pricing Simulator

All simulator multipliers and outputs are **MA / SF**:

| Element | Code | Note |
|---------|------|------|
| Slider inputs (discount %, AOV lever, returns reduction) | Interactive | User-controlled |
| Contribution impact formula coefficients | **MA** | Modelled from static base metrics — not from live data |
| Simulated £ output | **D / MA** | Derived from slider × static base constants |

---

## 6. Summary by Classification

### Count by page

| Page | L | D | SF | MA | FI |
|------|---|---|----|----|----|
| Dashboard | 11 primary tiles (L) + 9 delta badges (L) | 5 | 19 | 0 | 2 |
| Margin Analysis | 5 (CM%, NS, DD, RR, 12m avg) | 5 | 19 | 3 (scenarios) | 0 |
| Growth Quality | 5 sub-scores, 4 MoM badges | 12 | 5 | 0 | 0 |
| Marketing Efficiency | 10 channel/CAC metrics | 8 | 9 | 6 (simulator) | 2 (ROAS, spend) |
| Pricing Optimisation | 0 | 3 (arithmetic) | 21 | 8 (simulator) | 0 |

### Highest-priority gaps (FI — requires future integration)

| # | Gap | Pages affected | External source needed |
|---|-----|---------------|----------------------|
| 1 | Acquisition Efficiency (Meta CAC +14%) | Dashboard, Margin Analysis | Meta Ads API — ad spend + impressions |
| 2 | ROAS by channel | Marketing Efficiency | Meta Ads API + Google Ads API |
| 3 | Marketing spend (total £) | Marketing Efficiency | Ad platform ledger or manual upload |
| 4 | Prior-period CAC payback on Margin Analysis | Margin Analysis | Phase 3 prior-month RPC (already exists on ME page) |

### Highest-priority SF→L upgrades (data exists in Supabase, just not wired)

| # | Gap | Pages affected | Supabase path |
|---|-----|---------------|--------------|
| 1 | Contribution Bridge rows (revenue, discounts, shipping, fulfilment, payment fees, marketing) | Margin Analysis | `net_sales()`, `discount_dependency()`, `refund_rate()`, cost assumptions — data already available; bridge needs live assembly |
| 2 | Change Drivers £ impacts | Margin Analysis, Dashboard §TOP_DRIVERS | Need driver attribution RPC (Phase 4 work) |
| 3 | Recovery Scenario £ impacts (£9,500 / £6,800 / £4,100) | Margin Analysis | Formula documented — implement as derived from live CM + volume |
| 4 | CM% trend chart (12-month line) | Margin Analysis | `trailing_12m_cm_avg()` provides the average; per-month breakdown needs a monthly-history RPC |
| 5 | Channel CM% on Margin Analysis page | Margin Analysis | Already live on Marketing Efficiency via Phase 3 RPC — import `liveChannelCm` |
| 6 | Composition donut (Repeat/New Paid/New Organic splits) | Growth Quality | Derivable from `repeat_purchase_rate()` + channel attribution RPCs already available |
| 7 | Pricing page — all metrics | Pricing Optimisation | `gross_revenue()`, `discount_dependency()`, `refund_rate()`, `average_order_value()` all available via Phase 1 — page needs wiring |
| 8 | Health Module headlines (£20.4k, £52k, 38%, £64k, £18k–£42k) | Dashboard | Several already live on KPI tiles; Health Module strip should reference live computed values |

---

*This document was produced by static code analysis of the source files. It reflects the state of `main` as of 2026-05-10. Re-run after any Phase 4+ wiring work.*
