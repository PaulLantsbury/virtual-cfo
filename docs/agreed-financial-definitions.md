# Agreed financial definitions

## Decision record

Sales definitions v1 — approved by Paul Lantsbury on 8 September 2026, including pre-refund AOV and refund-event timing. Status: **approved requirements; implementation pending**. This approval does not mean existing SQL, seed data or screens conform, and does not approve the remaining contribution/profit/cash or ranking proposals.

This document takes precedence over conflicting sales definitions in older dictionaries, audit snapshots and proposed calculation notes. Preserve those documents as history. Record future agreed changes here with their approval date and implementation status.

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

## Implementation and remaining decisions

No application or database change is included in this approval record. The current net-sales/AOV RPCs and order-count availability logic do not implement this contract. Tests comparing the current SQL to source rows describe legacy behaviour, not acceptance of that behaviour.

Before implementing: agree original-order status eligibility, source date/timezone handling, and treatment of edits/cancellations and non-product goodwill refunds. Define the refund-rate denominator and interpretation under event-period reporting separately; a March refund can relate to February sales, so it is not automatically a same-order-cohort return rate. Repeat-customer identity/eligibility also remains open.

Contribution/COGS, overhead, operating profit, cash runway, weekly allocation and opportunity/scoring definitions require their own agreement. Do not infer approval of those from this sales decision.

The source evidence and incomplete data are recorded in [the measured reconciliation](trading-reconciliation-2026-09-08.md). Shopify terminology informed the discussion: [sales report definitions](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/sales-report). Night Scout's approved decisions above are the contract; Shopify's separate order-inclusion rules are not implicitly adopted.

## Documentation ownership and portability

The GitHub repository is the durable source of truth for code, specifications, decisions, tests and migration files. Keep these documents in `docs/` alongside the application so they remain available if development or hosting moves away from Replit.

Replit should hold a working checkout of the same versioned documents. Update through the repository workflow and verify the revision, rather than maintaining an independently edited second specification. Preserve and reconcile any uncommitted Replit changes before synchronising; do not overwrite them. Record decisions as agreed, proposed, implemented or deployed so approval cannot be mistaken for delivery.

Current location: recorded on `codex/restart-baseline` in draft PR #1. This is not yet a merge into `main` or a verified synchronisation to Replit. The handover must retain that distinction until each step is confirmed.
