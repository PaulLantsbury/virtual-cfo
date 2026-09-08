# Agreed financial definitions

## Decision record

Sales definitions v1 — approved by Paul Lantsbury on 8 September 2026, including pre-refund AOV and refund-event timing. Status: **approved requirements; implementation pending**. Contribution, profit and cash definitions v1 were subsequently approved by Paul on 8 September 2026, including all recommendations below. Both decisions are approved requirements with implementation pending. Existing SQL, seed data and screens are not certified by this approval. Opportunity ranking/scoring remains unapproved.

This document takes precedence over conflicting financial definitions in older dictionaries, audit snapshots and proposed calculation notes. Preserve those documents as history. Record future agreed changes here with their approval date and implementation status.

## Approved sales definitions

| Item | Definition |
| --- | --- |
| Gross product sales | Product value before discounts and refunds, excluding VAT and shipping. |
| Discounts | Product discounts excluding VAT. Shipping discounts remain separate. |
| Net product sales | Gross product sales minus product discounts minus product refunds/sales reversals, all excluding VAT. Do not deduct VAT again from tax-exclusive amounts. |
| Shipping revenue | Shipping charged to customers less shipping discounts and shipping refunds, excluding VAT; presented separately from product sales. |
| VAT | Keep sales VAT and refunded VAT separately. Normalise tax-inclusive source amounts using the actual recorded VAT, not a blanket 20% assumption. |
| Average order value (AOV) | Product sales after discounts, before subsequent refunds, excluding VAT and shipping, divided by the matching original order count. Later refunds do not remove the original order from this denominator or rewrite its original AOV. Detailed order-status eligibility is still to be agreed. |
| Discount rate | Product discount value divided by gross product sales. This is a value percentage, not the proportion of orders using a discount code. Zero-denominator presentation remains an implementation decision to document. |
| Refund timing | Financial reductions are recorded in the period of the refund/reversal event. A March refund of a February sale reduces March net sales, not February net sales. Preserve the original-order link for customer/product analysis. |

Revenue retained after refunds may be shown as a separately named metric; it must not silently replace the approved AOV definition.

## Worked example

A February product sale has gross value £100 excluding VAT and a £10 discount excluding VAT. Product sales after discount are £90; if recorded VAT is £18, that £18 is kept separately and is not subtracted from £90 again. With one eligible original order, AOV is £90.

A March product refund pays £24 back, including £4 recorded refund VAT. March net product sales are reduced by £20 and refund VAT is £4. February net product sales and original AOV remain £90. The refund remains linked to the February order. If there are no other March sales, the March net product sales contribution from this example is −£20; a refund-only period must not be presented as no activity.

Shipping charges and their discounts/refunds have their own components and do not enter product AOV.

## Approved contribution, profit and cash definitions

Approved by Paul on 8 September 2026 after reviewing all the definitions and recommendations in this section. No application or database changes accompany this record.

| Measure | Approved definition |
| --- | --- |
| Gross profit | Net product sales minus cost of goods sold (COGS). |
| Contribution before marketing | Gross profit plus net shipping revenue minus variable operating costs. |
| Contribution after marketing | Contribution before marketing minus marketing expenditure. This is Night Scout's main **Contribution** measure. |
| Operating profit | Contribution after marketing minus operating overheads, including depreciation and amortisation. Excludes interest and corporation tax. |
| EBITDA | Operating profit plus depreciation and amortisation; show separately when supported by the data. |
| Contribution and operating profit margin percentages | Divide the corresponding profit/contribution amount by net product sales plus net shipping revenue. Label the denominator consistently. |

| Cost treatment | Approved definition |
| --- | --- |
| Product costs | Use cost applicable when goods were sold, including consistently allocated freight/import costs. Missing costs mean incomplete profit figures, not zero costs. |
| Returned goods | Reverse related product cost only when goods return to saleable inventory. A refund without a recoverable product reduces revenue without reversing COGS. |
| Variable operating costs | Payment processing, fulfilment, packaging, outbound shipping and return handling. Prefer actual costs and clearly label estimates. |
| Marketing expenditure | Deduct period advertising spend in contribution after marketing. Agency fees, salaries and software belong in overheads. Count every cost once. |
| Weekly overheads | Allocate recurring monthly overheads by calendar day where finer data is unavailable. Label this as an allocation. |

| Cash measure | Approved definition |
| --- | --- |
| Available cash | Dated, unrestricted bank/payment-account balances. Transfers between included accounts are excluded from cash movement. Show unsettled processor funds separately. |
| Net cash movement | Actual cash inflows less actual cash outflows in the period, kept separate from accounting profit. |
| Cash runway | Available cash divided by average monthly net cash burn over the last three complete months. If cash generation is positive, show **Not currently burning cash**, rather than an artificial runway figure. |
| Cash-release opportunities | One-off working-capital improvements, such as excess-inventory reduction. Keep separate from recurring contribution or profit improvements. |

Runway is based on actual cash burn, not overheads alone. Available cash must be dated, and the three-month measurement period must be explicit.

## Worked acceptance cases

[Financial acceptance cases v1](financial-acceptance-cases.md) translates these approved rules into ten worked examples, with integer-pence fixtures in `tests/fixtures/financial-acceptance-v1.json`. Deferred policy choices are explicitly excluded from asserted outcomes. These examples do not change the approved definitions or the application.

## Implementation and remaining decisions

No application or database change is included in this approval record. The current net-sales/AOV RPCs and order-count availability logic do not implement this contract. Tests comparing the current SQL to source rows describe legacy behaviour, not acceptance of that behaviour.

Before implementing: agree original-order status eligibility, source date/timezone handling, and treatment of edits/cancellations and non-product goodwill refunds. Define the refund-rate denominator and interpretation under event-period reporting separately; a March refund can relate to February sales, so it is not automatically a same-order-cohort return rate. Repeat-customer identity/eligibility also remains open.

Contribution/COGS, overhead, operating profit, EBITDA, cash runway and weekly allocation are now approved above. Opportunity/scoring definitions remain proposals. Detailed implementation choices still need recording: exact cost allocation method, return-to-stock event timing, zero/negative margin denominators, cash currency/account coverage, zero burn, fewer than three complete months and financing/one-off flow treatment in the burn measure. Do not silently introduce new policy for these cases or present missing inputs as zero.

The source evidence and incomplete data are recorded in [the measured reconciliation](trading-reconciliation-2026-09-08.md). Shopify terminology informed the discussion: [sales report definitions](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/sales-report). Night Scout's approved decisions above are the contract; Shopify's separate order-inclusion rules are not implicitly adopted.

## Documentation ownership and portability

The GitHub repository is the durable source of truth for code, specifications, decisions, tests and migration files. Keep these documents in `docs/` alongside the application so they remain available if development or hosting moves away from Replit.

Replit should hold a working checkout of the same versioned documents. Update through the repository workflow and verify the revision, rather than maintaining an independently edited second specification. Preserve and reconcile any uncommitted Replit changes before synchronising; do not overwrite them. Record decisions as agreed, proposed, implemented or deployed so approval cannot be mistaken for delivery.

Current location: recorded on `codex/restart-baseline` in draft PR #1. This is not yet a merge into `main` or a verified synchronisation to Replit. The handover must retain that distinction until each step is confirmed.
