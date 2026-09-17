# Shopify data held by Night Scout — 17 September 2026

This records the current implementation and recommendations discussed with Paul. Paul subsequently approved retaining a store-specific customer identifier for repeat-purchase reporting, with no shopper contact details. Retention/deletion policies and repeat-metric definitions remain undecided; approval does not mean the identifier is already implemented.

## Current implementation

Night Scout synchronises selected trading records into Supabase. Shopify remains the original commerce source; Night Scout keeps selected source evidence and derives its reporting from shared stored data. It does not rely on a fresh Shopify request on every dashboard view, and does not keep only aggregate calculated totals.

The current queries in `experiments/shopify/queries.mjs` select store identity/currency/timezone; order/refund/line/payment identifiers; source timestamps; status and test flags; quantities; and money/tax/discount/shipping components. They do **not** request shopper name, email, address, phone or customer ID. An order ID is still linkable back to Shopify and must not be described as anonymous.

`record-candidate.mjs` retains the selected source object and mapped result in `ingest_v1.batches.payload`, with fingerprints, superseded versions and current heads. This provides traceability and change detection. The financial review path can also retain these candidate payloads in review snapshots/audit records; a future retention policy must cover those copies too. Eligible financial imports write normalised order/refund/event evidence used by shared reporting. Review and completeness remain separate from collection. The current real development-store order is a Shopify test order, excluded from financial events; other synthetic evidence has separately tested the eligible import/reporting path.

Legacy schema includes a `customers` table with identifiers, email and name columns, and an order/customer link. The new connector does not populate those customer fields. That is a statement about this connector, not proof that all legacy database contents contain no personal data. Night Scout sign-in accounts separately contain the account information needed for authentication.

## Why retain trading evidence

A stored record lets reports agree across pages, support historical queries, explain calculations and compare changes such as later refunds. Calculations can be recomputed from the underlying evidence instead of relying on an unexplained stored total. Sync status indicates collection freshness/outcome; it cannot certify source completeness or profit inputs.

## Approved identity direction — 17 September

Paul agreed: no shopper names, emails, addresses or phone numbers; add a customer identifier so repeat purchases can be reported. Use Shopify’s customer identity within each store. Do not infer matches for guest orders, merge different stores or change repeat-purchase metric definitions without agreement. An identifier is still potentially identifiable data, not anonymous data. Implementation must preserve existing source-version history and financial evidence; adding the field to queries alone would not complete the reporting path.

## Remaining policy and implementation work

- Keep copying only fields needed for the agreed CFO features; avoid duplicating the customer address book.
- Implement the approved identifier with source-version compatibility and explicit unknown identity for missing customer IDs. Agree repeat-purchase/cohort/customer-value metric definitions before exposing those reports. Customer contact details are not required simply to calculate sales/profit.
- Agree retention of source evidence, financial records, sync history and backups, and handling of deletion/disconnection requests before real merchant rollout. Superseding a candidate currently preserves it; this path has no expiry/pruning mechanism.
- Check all storage/access paths before live rollout. The restricted connector and store-membership checks are implemented in specific paths; a complete privacy, retention and deletion implementation has not been certified.

There is no new customer-contact collection, data export, deletion policy or production release in the durable-sync package.

## Customer identifier package — prepared, awaiting enablement

Implemented and independently reviewed separate minimal Shopify customer-ID collection, a private staging observation-table proposal, restricted atomic writer and private operator launcher. **22/22 combined checks passed** against synthetic responses and disposable PostgreSQL, including unchanged financial evidence. See [package and concrete enablement steps](customer-identity-package-2026-09-17.md) and [independent review](customer-identity-review-2026-09-17.md).

Not live: no identity table/grants applied, no Shopify customer scope enabled, no live customer query. Next decision is one bundled approval for the exact staging proposal, Shopify `read_customers`/non-contact access and one bounded collection plus replay. No contact fields, repeat metrics or current-identity resolution. Existing durable sales sync remains applied and restart-verified. No production, main or Replit change.
