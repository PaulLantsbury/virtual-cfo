# Xero accounting and cash reader contract — 18 September 2026

The first Xero reader is explicitly separate from Shopify. It can return an accrual/P&L accounting period and a dated unrestricted cash balance from the same approved Xero evidence, but does not compare, reconcile, convert or blend either result with Shopify sales.

Accounting values use Xero's reported minor-unit amounts and selected account mapping. Cash is a separately labelled dated balance across selected unrestricted bank/payment accounts; transfers between included accounts are excluded upstream. Processor balances are separately presented only when their availability is evidenced, otherwise they are unavailable rather than included in available cash.

A reader fails closed when a mapping is incomplete/review-required, Xero evidence is missing, invalidated, stale outside the exact requested scope, malformed, or from a different currency. A failed refresh does not claim a newer result. Future persistence must retain provenance, report date, mapping version, source freshness and review state without retaining raw report payloads alongside ordinary browser-readable data.

The executable local contract is [accounting-reader-contract.mjs](../experiments/xero/accounting-reader-contract.mjs). It is fixture-only and does not expose financial values through the app, contact Xero, create credentials, apply a migration or make a Shopify/Xero comparison.
