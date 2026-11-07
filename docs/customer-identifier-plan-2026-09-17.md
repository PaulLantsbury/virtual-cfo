# Customer identifiers — approved principle and safe implementation plan

## Customer identifier connection — applied and live-verified

Paul approved the complete enablement package. Applied the exact private `shopify_identity_v1.order_observations` staging table and fixed-store SELECT/column-INSERT grants to the existing intake service. Restricted readiness passed. Released Shopify development version `night-scout-customer-id-readonly` (1133059112961) and updated installed-store consent for `read_customers` alongside existing order scopes. The collector verified actual grants and shop context before and after reading. No separate protected-data configuration change was needed for this custom development app; this is not approval/readiness for a future public app.

Live collection: **1 observation collected, 1 inserted** with an identifier. Explicit unchanged replay: **1 collected, 0 inserted, 1 replayed**. Only expected identifier/timestamp/version columns exist. Before/after fingerprints across seven relations (candidate batches/heads, orders, refunds and three financial evidence tables) and the current candidate inspection are unchanged. Test-order exclusion, two retained candidates, needs-recheck and zero mapped financial events remain. No contact fields collected; actual customer IDs and private verification files remain excluded from GitHub.

Settings now appears after Monitoring in the shared left navigation, using the existing route and selected styling. Frontend typecheck passed; signed-in staging browser navigation from Profit Overview to Settings succeeded. Existing localhost:3000 preview reflects the change.

**Next:** agree repeat-purchase metric definitions, guest/unknown treatment, identity conflicts and deletion/retention behaviour before implementing customer analysis. The separate ID collection is an explicit private operator action, not scheduled or part of the existing sales-sync status. Do not reapply the schema, repeat scope approval or create another test purchase/refund. No production/main/Replit changes.


Paul approved retaining a customer identifier to support future repeat-customer reporting, without shopper names, email addresses, addresses or phone numbers. This approves the identifier principle, not guest matching, cross-store identity merging or repeat-customer formulas. Those remain separate decisions.

## Current implementation

The active Shopify queries request no customer identifier or contact fields. They retain selected transaction IDs, timestamps, quantities and financial components in private candidate batches. Financial import currently leaves `public.orders.customer_id` unset. Legacy `public.customers` has name/email columns, but the new connector does not populate it. Shopify order identifiers remain linkable at Shopify; this is not anonymous data.

Candidate batches retain selected source objects and superseded history. Independent review snapshots also retain candidate payloads. No automatic expiry/purge is implemented in this path. A future retention/deletion plan must cover both, with audit requirements agreed separately.

## Prepared, not connected or applied

[Separate query and extractor](../experiments/shopify/customer-identity-proposal.mjs) demonstrate requesting **only** `customer { id }` alongside order ID and update timestamp. The extractor projects an observation containing:

- `identityCollectionVersion: 1`
- local `storeId` and source `shopId`
- `shopifyOrderId`
- `shopifyCustomerId`: the source Customer ID, or explicit `null`
- `sourceOrderUpdatedAt` and `observedAt`

Explicit null means Shopify returned no identifier. Missing collection must stay distinguishable from null. No email matching, generated guest identity, cross-store merge or inherited repeat classification is performed. The observation is store-scoped even where an external identifier looks identical.

The active collector/query is unchanged. There are no new network calls, live identity observations, database tables/grants or customer metrics in this package.

## Why keep identity observations separate initially?

Existing financial source fingerprints include the full selected order object. Adding a customer property to an otherwise unchanged order changes its fingerprint while its Shopify update timestamp may stay the same. Existing safeguards correctly classify that as `conflicting_source`. Blindly extending the live query would therefore disrupt existing candidate history and review evidence.

A separate observation path can preserve the established financial objects and fingerprints. [Tests](../experiments/shopify/customer-identity-proposal.test.mjs) reproduce the naive conflict and verify that the prepared projection leaves the original financial source untouched. This is preparation, not proof of a deployed identity feed.

## Next complete package

Prepare a store-scoped identity observation schema and least-privilege writer; preserve historical observations, distinguish unknown versus explicit-null identity, and define how changed/deleted customer references affect later analysis. Authenticate the source store before collection, retain only projected fields, and test pagination, retries and identity updates without changing financial history. Review the concrete schema/access proposal before staging application. Then agree repeat-customer eligibility, reporting period/cohort meaning and guest treatment before displaying a repeat metric. No contact fields are needed simply to identify repeat orders where Shopify supplies a stable customer ID.

## Earlier checkpoint — customer identifier preparation

Implemented and independently reviewed separate minimal Shopify customer-ID collection, a private staging observation-table proposal, restricted atomic writer and private operator launcher. **22/22 combined checks passed** against synthetic responses and disposable PostgreSQL, including unchanged financial evidence. See [package and concrete enablement steps](customer-identity-package-2026-09-17.md) and [independent review](customer-identity-review-2026-09-17.md).

Not live: no identity table/grants applied, no Shopify customer scope enabled, no live customer query. Next decision is one bundled approval for the exact staging proposal, Shopify `read_customers`/non-contact access and one bounded collection plus replay. No contact fields, repeat metrics or current-identity resolution. Existing durable sales sync remains applied and restart-verified. No production, main or Replit change.
