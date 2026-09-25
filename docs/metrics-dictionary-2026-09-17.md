# Metrics dictionary — 17 September 2026

Package 1 specification. This document reconciles the approved ecommerce CFO direction with the existing financial contract and implementation. It proposes no application, database or financial-policy change. [Agreed financial definitions](agreed-financial-definitions.md) remain authoritative; the proposals below require a recorded decision before implementation. Night Scout is the commerce CFO product, not Sam.

## Current implementation, rather than historical status text

The approval dates in the financial definitions remain valid, but early paragraphs saying all implementation is pending are historical. By the 13 September checkpoint, verified sales and monthly profit evidence were connected to the local staging application. Profit Overview, CFO Briefing and Margin Analysis reuse the same profit reporting service. Synthetic Store D was reconciled for February sales, March refunds and April stock recovery. This does not certify real merchant ingestion, all pages, production or Replit synchronisation.

Pre-marketing contribution is **already approved and already calculated**. It is not a new definition needed to start this roadmap. Main `Contribution` remains after advertising. Agency fees, salaries and software remain overheads. Do not reinterpret “marketing” to deduct them twice.

Implementation references:

- `experiments/financial-v1/profit-evidence.mjs`: `calculateProfitEvidence`, independently available cost groups and derived subtotals.
- `experiments/financial-v1/profit-evidence-reader.mjs` and `profit-sales-reader.mjs`: source validation and consistent snapshot readers.
- `experiments/financial-v1/profit-reporting-service.mjs`: authenticated membership, unique matching evidence-version selection, complete-calendar-month scope and sanitised report.
- `artifacts/virtual-cfo/src/lib/analytics/useProfitReporting.ts` and `src/components/VerifiedProfitSummary.tsx`: shared consumption and presentation; no separate page formulas.
- [Shared profit pages](shared-profit-pages-2026-09-13.md), [profit evidence package](profit-evidence-package-2026-09-13.md) and [13 September handover](session-handover-2026-09-13.md): verification and deployment boundaries.

## Common metric contract

Every actual metric must declare store, reporting dates, store timezone, currency, source revision or evidence version, completeness and freshness. All pages selecting the same scope must consume the same value and availability state. A comparative period needs its own complete evidence; unavailable comparison does not invalidate a supported current value.

Actuals, observed cohort results and scenario assumptions are different bases and must be labelled. No sample/default amount may stand in for missing actual evidence. A verified zero is different from missing evidence. Negative supported monetary values are valid, including refund-only months. “Complete” describes coverage of the selected evidence and metric, not an audit opinion.

The implemented profit scope is one full calendar month, one supported two-decimal currency, exact integer minor-unit arithmetic and actual supported costs. Sales supports its existing wider date selection independently. Non-month profit, FX, arbitrary landed-cost allocations, unsupported corrections and estimated actual profit are not part of this release. Keep each supported subtotal available when later dependent costs are incomplete.

## Approved sales and profit measures

| Metric | Formula or definition | Source and scope | Availability and dependencies |
| --- | --- | --- | --- |
| Eligible original orders | Paid/completed original orders; exclude unpaid, test and pre-sale-cancelled orders; keep later-refunded originals | Evidenced original order/payment facts and sale event date in store timezone | Current status alone is insufficient; ambiguous cancellations/edits/goodwill adjustments need review |
| Gross product sales | Product value before discounts/refunds, excluding VAT and shipping | Normalised original product sale events | Recorded tax basis required; no blanket VAT rate |
| Product discounts | Product discount value excluding VAT | Matching product sale events | Keep shipping discounts separate |
| Net product sales | Gross product sales − product discounts − product refunds/reversals | Sale and refund events in their own reporting periods | Later refunds do not rewrite original sale period; retain original-order link |
| Net shipping revenue | Shipping charges − shipping discounts − shipping refunds, excluding VAT | Separately classified shipping events | Required for contribution and approved margin denominator |
| AOV | Original product sales after discounts, before later refunds, excluding VAT/shipping ÷ matching eligible original order count | Original orders in selected sale period | No orders means unavailable AOV, not zero; refund-only months retain negative net sales |
| Discount rate | Product discounts ÷ gross product sales | Matching product sales scope | Zero-denominator behaviour is not yet a settled general policy; do not manufacture a percentage |
| COGS | Historical cost of goods sold − historical cost of evidenced saleable-stock recoveries | Sale-line historical landed cost and actual recovery date, independently of refund date | Missing cost, allocation support, stock disposition or recovery coverage blocks dependent results; current product price is not historic cost |
| Gross profit | Net product sales − COGS | Shared sales and historical-cost evidence in one snapshot | Does not require advertising or overhead completeness |
| Contribution before marketing | Gross profit + net shipping revenue − variable operating costs | Actual payment processing, fulfilment, packaging, outbound shipping and return handling | Requires these costs in addition to gross profit/shipping; already approved and calculated |
| Contribution after marketing (`Contribution`) | Contribution before marketing − period advertising spend | Actual classified advertising source records | Agency fees, salaries and software stay in overheads; zero advertising requires complete zero evidence |
| Operating profit | Contribution − operating overheads including D&A | Actual classified overheads | Excludes interest/corporation tax; incomplete overheads leave earlier subtotals usable |
| EBITDA | Operating profit + identified D&A already deducted in overheads | Same overhead evidence, with explicit D&A identification | Never add back unidentified costs or add D&A twice; separate from available cash |
| Contribution margin | Contribution ÷ (net product sales + net shipping revenue) | Same shared report | Current approved rollout withholds percentage for zero/negative denominator; negative contribution with positive denominator is valid |
| Operating profit margin | Operating profit ÷ (net product sales + net shipping revenue) | Same shared report | Same denominator/availability policy as contribution margin |

Weekly recurring-overhead allocation by calendar day was approved in principle; allocation precision/rounding and the non-month implementation are still deferred. Do not let this older approval imply the full-month service already handles weeks.

## Cash definitions: approved, not connected actual reporting

| Metric | Approved definition | Evidence required / remaining policy |
| --- | --- | --- |
| Available cash | Dated unrestricted bank/payment-account balances; unsettled processor funds shown separately | Account inventory, timestamp, restrictions and currency; no duplicate processor/bank settlement balances |
| Net cash movement | Actual period inflows less outflows; internal transfers between included accounts excluded | Account transactions and transfer matching; maintain distinction from accrual profit |
| Cash runway | Available cash ÷ average monthly net cash burn over last three complete months; positive cash generation shows “Not currently burning cash” | Complete account coverage; zero burn, less than three complete months, financing/one-off classification and currency policy remain decisions |
| Cash release | One-off working-capital improvement | Stock/receivable/payable evidence and an explicit achievable action; never add one-off release to recurring profit |

Xero accounting integration is a dependency for the planned cash package, but a connector alone cannot prove complete or unrestricted cash. Confirm the supported account and processor coverage before presenting these as actuals.

## Proposed extensions and genuinely new decisions

These are recommendations for later packages, not silently adopted rules. Existing sales/profit work can continue without deciding every item now.

| Decision | Recommended first scope | Source/dependencies and availability rule | Needed before |
| --- | --- | --- | --- |
| Accounting reporting | Maintain the operational trading report and Xero accounting report as distinct views, each with its own period, classification, currency and evidence status. Explain either source on its own terms; do not match, reconcile, calculate a variance between or force agreement with the other. | Xero mapping, accounting period/basis, tax/cutoff treatment and cash assumptions. Paul must approve account mappings and accounting policies before accounting results are used. | Xero package |
| Customer identity and first/repeat classification | Stable store-scoped source customer identity, complete known order history and first eligible original order; keep unresolved guests/merged identities unknown rather than infer from email alone | Shopify customer/order history and explicit merge policy. Limited import history cannot prove first-ever customer | Customer/cohort package |
| CAC numerator and denominator | Start with a clearly named **blended advertising cost per new customer**: period advertising spend ÷ evidenced new customers in the same period. This is an aggregate indicator, not causal acquisition cost | Complete spend, eligible customer classification and timezone/currency scope. Zero customers means unavailable. Broader fully loaded CAC needs separate cost policy | Marketing/customer package |
| Channel CAC and attributed revenue | Keep channel-reported attribution distinct from blended commercial results; require an explicit attribution window and model before channel comparisons | Platform attribution and deduplication policy; do not sum overlapping channel-attributed revenue into store sales or describe attribution as incrementality | Meta/Google package |
| Observed cohort value | Start with cumulative observed contribution before marketing per acquired customer, net of linked refunds/cost recoveries, for explicitly aged cohorts | Customer identity, full cohort history, order-level cost coverage and agreed cost allocation; do not allocate store-wide costs arbitrarily. Keep event-period P&L unchanged | Customer/cohort package |
| Acquisition payback | Propose earliest observed cohort age at which cumulative contribution before marketing covers the approved acquisition-cost basis | Agreed cohort cost assignment, observation window and refund treatment. Report “Not yet observed”/insufficient history rather than an invented predicted month; do not subtract acquisition spend in contribution and again as recovery target | Customer/cohort package |
| LTV | Defer predicted lifetime value; begin with observed value over a named completed horizon (for example, a separately agreed 90-day window) | Explicit horizon, maturity and repeat/refund completeness; no extrapolation from immature cohorts | Customer economics predictions |
| Cash burn edge cases | Propose unavailable runway for insufficient three-month history or zero burn until explicit wording/policy approved; show financing/one-off flows separately so operational burn cannot be silently distorted | Account/currency coverage, restricted funds and classification policies. Do not invent a financing exclusion formula before approval | Cash Control |
| 13-week cash forecast | Separate actual opening cash and contractual expected receipts/payments from user-entered assumptions, with a dated weekly bridge and downside scenario | Collection/payment timing, tax/payroll/stock commitments, settlement delays and evidence of opening cash; profit is not cash and sales are not bank receipts | Forecast package |
| Budget / forecast / scenario | Retain validated baseline and explicit assumption deltas. Sales derived from order volume × AOV under the already agreed sample model; actual baseline must be independently supported | Forecast horizon, assumption ownership and versioning. No automatic marketing-to-sales uplift, elasticities or causal effects without a separate approved model | Planning package |
| Opportunity value and ranking | Begin with evidence-backed observations and suggested investigation; distinguish recurring contribution, one-off cash release and potential scenario effect | Scoring, confidence, priority and overlap rules remain unapproved; do not add mutually overlapping opportunities or present speculative savings as attainable fact | Automated prioritisation |
| Refund rate | Offer a separately agreed cohort-based measure for return behaviour, distinct from period refund value | March refunds may relate to February sales; numerator, denominator and elapsed return window must be agreed | Refund/customer diagnostic cards |

For Package 2, continuing shared actual-sales/profit integration and preparing Shopify development ingestion under the existing rules requires no reapproval of these formulas. A source that cannot evidence a required fact must leave the dependent result unavailable or create a specific decision for Paul; it must not force a new financial assumption simply to complete the integration. Shopify account/app configuration and any database application or new grants remain separate operational approval boundaries.

Financial recommendations above should be presented to Paul at the relevant package boundary. Package 1 does not need to settle all future formulas in advance. A new gross-margin percentage or EBITDA margin also needs an explicitly named denominator; their existence must not be inferred from the two approved margin percentages.

## Decision-card evidence contract

The approved product direction calls for observation, driver, financial impact, outlook, action, guardrail and confidence. Each field must respect its evidence basis:

- Observation: measured result and named comparison period, or a clear data gap.
- Driver: supported arithmetic explanation; a correlation is not proof that marketing caused growth.
- Financial impact: actual difference or separately labelled scenario estimate, with metric, period and overlap limits.
- Outlook: unsupported if no agreed forecast; do not fill with generated precision.
- Action: investigation or conditional proposal when evidence cannot justify a commercial intervention.
- Guardrail: record the relevant limitation or threshold only when agreed; never invent a margin target.
- Confidence: explain evidence coverage/freshness and model limits. A numerical confidence score would itself require a defined method.

## Acceptance requirements for subsequent coding packages

1. Identical store, month, currency and evidence revision produce identical common metrics across every connected page.
2. February sale / March refund / April saleable recovery retain their separate periods and original AOV; refund-only and recovery-only months work.
3. Missing overheads preserve gross profit and contribution; missing advertising blocks after-marketing contribution but preserves supported pre-marketing contribution.
4. Duplicate costs, stale revisions, incomplete manifests and unsupported currency/periods never become zero or sample totals.
5. Real integrations reconcile source rows to the shared contract before page totals are labelled verified; synthetic passing tests do not certify merchant coverage.
6. Accounting differences are explained and traceable; no forced match, duplicate ad costs or unapproved posting adjustments.
7. No customer, cash, forecast or causal marketing metric appears merely because its page exists. Deferred-policy states must remain explicit.
