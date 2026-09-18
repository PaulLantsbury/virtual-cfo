# Customer identifier connection — 17 September 2026

## Customer identifier connection — applied and live-verified

Paul approved the complete enablement package. Applied the exact private `shopify_identity_v1.order_observations` staging table and fixed-store SELECT/column-INSERT grants to the existing intake service. Restricted readiness passed. Released Shopify development version `night-scout-customer-id-readonly` (1133059112961) and updated installed-store consent for `read_customers` alongside existing order scopes. The collector verified actual grants and shop context before and after reading. No separate protected-data configuration change was needed for this custom development app; this is not approval/readiness for a future public app.

Live collection: **1 observation collected, 1 inserted** with an identifier. Explicit unchanged replay: **1 collected, 0 inserted, 1 replayed**. Only expected identifier/timestamp/version columns exist. Before/after fingerprints across seven relations (candidate batches/heads, orders, refunds and three financial evidence tables) and the current candidate inspection are unchanged. Test-order exclusion, two retained candidates, needs-recheck and zero mapped financial events remain. No contact fields collected; actual customer IDs and private verification files remain excluded from GitHub.

Settings now appears after Monitoring in the shared left navigation, using the existing route and selected styling. Frontend typecheck passed; signed-in staging browser navigation from Profit Overview to Settings succeeded. Existing localhost:3000 preview reflects the change.

**Next:** agree repeat-purchase metric definitions, guest/unknown treatment, identity conflicts and deletion/retention behaviour before implementing customer analysis. The separate ID collection is an explicit private operator action, not scheduled or part of the existing sales-sync status. Do not reapply the schema, repeat scope approval or create another test purchase/refund. No production/main/Replit changes.

## Preparation record (before approval)

Paul approved a store-specific customer identifier for repeat-purchase analysis, without shopper names, emails, addresses or phone numbers, and then approved implementing the connection. Three agents prepared collection, private storage and independent verification; coordinator integrated the private launcher and documentation. New database permissions and Shopify access have not been enabled by this preparation.

## Implemented preparation

A separate paginated Shopify query requests order ID, source update time and `customer { id }` only. It verifies the configured shop before and after collection, requires actual order-history and customer-read grants, bounds pages/observations/runtime, rejects GraphQL/permission/partial-page failures and returns only projected identifiers/timestamps. Existing financial queries, source objects and fingerprints are unchanged.

A proposed private `shopify_identity_v1.order_observations` table stores the seven-field observation plus its generated record ID and database record time. The existing restricted intake service receives only the required schema access and fixed-store SELECT/INSERT permissions. No new credential, merchant read, update/delete permission or financial grant is added.

The writer validates the full batch before beginning its transaction and inserts all observations atomically. Unchanged facts replay without another row; the first recorded observation time is retained. A changed ID or explicit null remains separate evidence even at the same Shopify update time. Null means the source explicitly supplied no ID; an unreadable or uncollected field is not converted to null or a guest identity.

There is deliberately no 'current customer' resolver or repeat-purchase calculation yet. In particular, A → null → A at an unchanged source timestamp cannot be interpreted from the final inserted row: deduplication preserves known facts, not a complete change timeline. No guest matching, cross-store merging, deletion reconciliation or cohort formula is silently chosen.

## Private launcher

`experiments/shopify/run-development-customer-identity.mjs` reuses the existing private staging configuration and restricted login. Default `--check` verifies storage readiness without requesting Shopify customer data. Recording requires `--record --confirm-target bioalckltvkhlczusdvl/56d92f8a-746e-4b4f-b408-81fc98c4aa17`. It collects a complete bounded batch before the writer runs and returns counts only. It never automatically retries an uncertain database write. No customer identifier is printed in its normal result, published to GitHub or exposed in the app.

No scheduler or merchant-facing write control is introduced. The existing sales sync history continues to describe the sales collection, not this separate identity operation.

## Concrete proposed staging enablement

After Paul approves:

1. Apply `db-migrations/proposals/shopify-customer-identity-2026-09-17.sql` to staging project `bioalckltvkhlczusdvl`, creating the private observation table and narrowly extending the existing intake role for the fixed development store.
2. Add Shopify `read_customers` to the development app's existing order scopes, configure non-contact protected customer-data access if required, and complete the development-store permission update. This is a broader Shopify permission even though our query requests only IDs; no name/email/address/phone fields will be requested. Verify the actual installed token grants before collection. See [official-source permission review](customer-identity-review-2026-09-17.md).
3. Run one bounded identity collection and an explicit unchanged replay. Verify only minimal fields were stored and compare the existing financial candidate/evidence before/after. Do not infer repeat-purchase figures from the test order or change test-order exclusion.

No production/main/Replit release, new test purchase, legacy customer-table import or repeat-metric rollout is included. Subsequent work must agree the repeat measures and identity-change/deletion treatment before exposing customer analysis.

## Verification

Final combined suite: **22/22 checks passed**, covering bounded collection, access failures, strict dates, atomic private storage, replay/conflicts, restricted permissions, unchanged financial evidence, the private launcher and the existing membership proposal. The integration checks used disposable PostgreSQL and synthetic Shopify responses; they do not establish live identity access. No live Shopify customer query, new scope or staging schema change has been performed in this package.
