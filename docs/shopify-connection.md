# Shopify connection foundation — 9 September 2026

## Status

Paul confirmed that no Shopify account is available and authorised development with test data. The local server-side read client and bounded order/refund-summary collector are implemented and tested using synthetic API-shaped responses. No real access token, Shopify account, network call, database write or production integration was used in these tests.

Run `pnpm test:shopify`. Ten test groups exercise the actual client and collector with an injected HTTP transport. This is more than a standalone fixture calculation, but does not validate a live API schema, OAuth installation or real access permissions.

## Implemented

The reader pins GraphQL Admin API 2026-07 and permits only three fixed read operations. It requires a canonical myshopify.com domain, rejects redirects and unexpected returned API versions, and does not include upstream error contents or credentials in diagnostics. Calls have timeouts, cancellation and bounded retries for throttling/temporary failures. No mutation operation is available.

The collector checks the expected Shopify shop identity, stored domain, reporting settings and full order-history read permissions. It traverses all accessible orders in ID order rather than filtering on the original order period: refunds may belong to older sales. It records page cursors and source IDs, rejects repeated records/cursors, and stops at configured page/time limits rather than returning an apparently complete partial result.

Orders include source timestamps, current status, edit/test flags, summary monetary fields, transaction records and nested refund summaries/payment transactions. No customer names, email addresses or postal addresses are requested. Original order transactions are limited to 100 with an exact-count check; refund transactions are limited to 100 with a pagination-completeness check. Larger results stop extraction and need a follow-on retrieval strategy; they are never silently truncated. Shopify order pages now use one record to reduce nested query cost; live query-cost validation remains pending.

Edited/cancelled orders and refunds lacking successful refund transactions receive review flags. Source timestamps/statuses are retained without promoting them to approved financial event dates or original-order eligibility. Settings are rechecked after extraction. The returned fingerprint identifies extracted settings/content, not a transactional snapshot or a durable replay ledger.

## Financial boundary

Every extraction has `coverageCertified: false` and status `extracted_for_mapping`. It is not adapted into the import-review envelope or connected to the briefing yet. A subsequent detail-mapping step below now produces candidate arithmetic for a conservative subset. The summary monetary fields alone cannot establish original product/discount/shipping VAT allocation after edits, successful payment-event timing or lifetime completeness. Do not silently map current order totals or processedAt into those approved facts.

There is no snapshot isolation across API calls. Identical beginning/end settings do not prove unchanged orders. Deleted records, concurrent changes, API accessibility limits and independent source reconciliation still need a documented collection strategy. Shopify's pagination/resource limits also make this bounded reader unsuitable as a complete large-store backfill solution.

## Validation

Ten synthetic test groups cover multi-page client-to-collector extraction, identity/scope failure, truncated nested results, duplicate orders/transactions, cursor/page limits, pending/failed refunds and edits, changed settings, malformed responses, bounded throttling retries, access/version/GraphQL failures, unsafe destinations, cancellation, and currency mismatch. Existing import-review tests are run alongside these. No new dependencies or application changes are introduced by this package.

## Next work

1. Add line-level original-sales, tax/discount/shipping and refund components to the source queries, with complete nested retrieval and reconciliation.
2. Build conservative source mapping with explicit original-payment evidence; keep ambiguous changes unavailable and make synthetic fixtures exercise the approved financial acceptance cases end to end.
3. Add durable source identity, update/deletion handling, resumable collection and evidence provenance before preparing a writer.
4. Implement the installation/credential lifecycle and verify against a real Shopify development store when available. Keep credentials server-side.
5. Apply only a tested, approved staging writer and verify the briefing before considering production.

GitHub is the versioned record; Replit sync and production release remain separate, neither performed here.

## Official references checked

- [Order fields and historical access](https://shopify.dev/docs/api/admin-graphql/latest/objects/Order): default history is limited; older orders need additional access. Original/current fields and transaction limits require care.
- [Refund fields and payment status](https://shopify.dev/docs/api/admin-graphql/latest/objects/Refund): a refund record does not establish successful repayment; associated transactions must be checked.
- [Orders query](https://shopify.dev/docs/api/admin-graphql/latest/queries/orders), [Shop](https://shopify.dev/docs/api/admin-graphql/latest/objects/Shop) and [current installation](https://shopify.dev/docs/api/admin-graphql/latest/queries/currentAppInstallation): collection, store settings and granted scope discovery.
- [API limits](https://shopify.dev/docs/api/usage/limits): collection must handle resource/pagination limits and throttling; finishing a local page loop is not independent proof of completeness.

The documentation selector identified 2026-07 as latest when inspected. The implementation pins that version; do not silently accept Shopify version fallback. Live compatibility remains untested without an account.


## Product/tax/refund mapping checkpoint

`loadShopifyDetails` fetches a fixed order-detail query and rejects changed order/refund versions between summary and detail reads. It retains a separate detail-content fingerprint. Product and shipping lines, allocated discounts, actual tax components, refund line links and adjustments are included. Results beyond the queried connection limits are rejected by the mapper, not silently used. This does not provide snapshot isolation or automatic continuation of large nested connections.

`mapShopifySales` maps unedited tax-exclusive orders with exactly one successful SALE payment into the shared calculation events. Original product amounts minus allocated discounts, actual tax and shipping must reconcile to both the original order total and successful payment. Order-level tax and discount totals must also agree. Sale and refund periods follow successful payment timestamps in the store timezone, never import dates. The supplied Shopify identity must match the extraction; server-side authorisation of the local-store mapping remains the future caller's responsibility.

Successful refund payments must reconcile to linked product/shipping refund components; cumulative net and tax amounts cannot exceed original line components. Shipping remains outside product AOV. Test orders and clearly unpaid orders are excluded. Edits/cancellations, split/capture payments, gift cards, tax-inclusive allocations, refund adjustments, failed/pending payments, incomplete lines, missing money and reconciliation discrepancies remain blocked for review. No gross/discount VAT split is invented from a net-tax total. This is a supported subset, not full Shopify financial compatibility.

All mapped outputs remain `coverageCertified: false`; candidate calculations temporarily use declared coverage only in memory. These events are not written into finance evidence and are not sent to the briefing. Costs/profit remain unavailable. A source-specific provenance/coverage writer and live-source validation are still required.

Validation: 19 Shopify tests (including nine new mapping tests) and 15 shared financial tests pass. Synthetic HTTP responses pass through the actual reader, collector, detail loader and mapper: February gross product sales GBP 100 less GBP 10 discount gives GBP 90 original AOV; a March GBP 24 refund including GBP 4 tax gives GBP -20 net product sales and no new-order AOV. Separate shipping revenue/refunds do not alter AOV. Tests also cover timezone boundaries, exclusions, scope, incomplete/changed details, payment and tax reconciliation, unsupported cases and cumulative refund limits.

Additional official sources: [LineItem](https://shopify.dev/docs/api/admin-graphql/latest/objects/LineItem), [ShippingLine](https://shopify.dev/docs/api/admin-graphql/latest/objects/ShippingLine), [RefundLineItem](https://shopify.dev/docs/api/admin-graphql/latest/objects/RefundLineItem), and [RefundShippingLine](https://shopify.dev/docs/api/admin-graphql/latest/objects/RefundShippingLine). In particular, original line totals and allocations preserve original quantities, while some current/discounted fields exclude quantities or omit classes of discounts. The mapper uses original totals and allocations, with reconciliation, rather than those current summaries.
