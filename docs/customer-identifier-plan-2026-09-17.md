# Customer identifiers — approved principle and safe implementation plan

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
