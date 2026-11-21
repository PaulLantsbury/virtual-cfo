# Shopify data held by Night Scout

## Current source-audit update — 30 October 2026

The historical identity preparation below has been superseded: the separate customer-ID sidecar was applied and live-verified in September. The main scheduled Shopify financial query still omits shopper names/contact details/customer IDs; the separate operator identity query collects store-scoped order/customer IDs only. Neither proves that legacy contact-capable tables contain no personal data. Shopify's current scheduled feed/writer status belongs in the dated session handover; this document does not activate either service.

The reviewed persistence paths retain selected Shopify source versions, normalised/evidenced financial records, identity observations and independent review snapshots; snapshots can duplicate the source payload. Xero retains account/mapping metadata, encrypted credential envelopes and bounded accounting evidence/audit. It does not persist raw Xero reports through the reviewed accounting-evidence path. Review audit and Xero accounting evidence have append-only delete guards. Retiring/disconnecting a connection is separate from erasing source/evidence/copies. The in-memory lifecycle prototype is not proof of a deployed complete disconnect-and-erasure journey.

Auth accounts/sessions, browser-local plans with owner-entered text, hosting/private credential files, isolated writer ledgers/envelopes, logs/exports and platform backups are separate boundaries. Expiry and encryption do not prove deletion. No retention periods or erasure exceptions are chosen here; no production-compliance claim is made. Benchmarking/pooling is deferred and outside this work.

A read-only aggregate inventory and concrete pre-rollout copy/deletion/disconnect gaps are documented in [Data-handling readiness](data-handling-readiness-2026-10-30.md). Missing/unreadable/RLS-filtered records remain explicit; the tool is not an erasure executor or complete deletion manifest. Earlier dated observations below are historical evidence, not current row counts or activation instructions.

## Customer identifier connection — applied and live-verified

Paul approved the complete enablement package. Applied the exact private `shopify_identity_v1.order_observations` staging table and fixed-store SELECT/column-INSERT grants to the existing intake service. Restricted readiness passed. Released Shopify development version `night-scout-customer-id-readonly` (1133059112961) and updated installed-store consent for `read_customers` alongside existing order scopes. The collector verified actual grants and shop context before and after reading. No separate protected-data configuration change was needed for this custom development app; this is not approval/readiness for a future public app.

Live collection: **1 observation collected, 1 inserted** with an identifier. Explicit unchanged replay: **1 collected, 0 inserted, 1 replayed**. Only expected identifier/timestamp/version columns exist. Before/after fingerprints across seven relations (candidate batches/heads, orders, refunds and three financial evidence tables) and the current candidate inspection are unchanged. Test-order exclusion, two retained candidates, needs-recheck and zero mapped financial events remain. No contact fields collected; actual customer IDs and private verification files remain excluded from GitHub.

Settings now appears after Monitoring in the shared left navigation, using the existing route and selected styling. Frontend typecheck passed; signed-in staging browser navigation from Profit Overview to Settings succeeded. Existing localhost:3000 preview reflects the change.

**Next:** agree repeat-purchase metric definitions, guest/unknown treatment, identity conflicts and deletion/retention behaviour before implementing customer analysis. The separate ID collection is an explicit private operator action, not scheduled or part of the existing sales-sync status. Do not reapply the schema, repeat scope approval or create another test purchase/refund. No production/main/Replit changes.


Paul approved retaining a store-specific customer identifier for repeat-purchase reporting, with no shopper contact details. The separate identity observation path is now implemented and was live-verified as recorded above; retention/deletion policies and repeat-metric definitions remain undecided.

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
- The approved separate identifier observation path is implemented; preserve source-version compatibility and explicit observed absence for missing customer IDs. Agree repeat-purchase/cohort/customer-value metric definitions before exposing those reports. Customer contact details are not required simply to calculate sales/profit.
- Agree retention of source evidence, financial records, sync history and backups, and handling of deletion/disconnection requests before real merchant rollout. Superseding a candidate currently preserves it; this path has no expiry/pruning mechanism.
- Check all storage/access paths before live rollout. The restricted connector and store-membership checks are implemented in specific paths; a complete privacy, retention and deletion implementation has not been certified.

There is no new customer-contact collection, data export, deletion policy or production release in the durable-sync package.

## Historical preparation checkpoint — superseded by the applied/verified record above

Implemented and independently reviewed separate minimal Shopify customer-ID collection, a private staging observation-table proposal, restricted atomic writer and private operator launcher. **22/22 combined checks passed** against synthetic responses and disposable PostgreSQL, including unchanged financial evidence. See [package and concrete enablement steps](customer-identity-package-2026-09-17.md) and [independent review](customer-identity-review-2026-09-17.md).

Not live: no identity table/grants applied, no Shopify customer scope enabled, no live customer query. Next decision is one bundled approval for the exact staging proposal, Shopify `read_customers`/non-contact access and one bounded collection plus replay. No contact fields, repeat metrics or current-identity resolution. Existing durable sales sync remains applied and restart-verified. No production, main or Replit change.
