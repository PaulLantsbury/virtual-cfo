# Shopify test-data journey — 29 October 2026

Status: code audit and local synthetic integration verification. No live provider order, remote database update, scheduled run or deployment is established by this record.

## Existing supported route

| Stage | Source | What it proves |
| --- | --- | --- |
| Read Shopify | `experiments/shopify/collect.mjs` and `map-sales.mjs` (`loadShopifyDetails`) | An extraction retains source order/refund facts and checks source settings/version/detail completeness. It is not a snapshot-isolated financial certificate. |
| Record source | `record-candidate.mjs` | Recomputes the mapping, retains source payload in `ingest_v1.batches`, updates the scoped head and source versions, handles unchanged replay and changed-source invalidation. |
| Exclude tests | `map-sales.mjs` | A source order with `test=true` becomes a `TEST_ORDER` exclusion before creation of financial events. Its nominal amount does not enter merchant sales/profit. |
| Save collection attempt | `durable-sync-journal.mjs` and `ingest_v1.sync_attempts` | A durable attempt/result; unresolved attempts prevent unsafe retry. This does not itself prove an automatic trigger. |
| Read member status | `public.shopify_connection_status`, defined in the already-existing `shopify-sync-history-2026-09-17.sql` | Membership-gated counts and dated attempt/period metadata; no source payload or credentials. |
| Display | `ShopifyConnectionStatus.tsx`, mounted on Settings | Saved source orders, refunds, financial-event count and excluded test-order count. Refresh reads the RPC only; it does not collect or write provider data. |

Source extraction reads accessible history, rather than filtering orders by creation date within the financial reporting period. The displayed source/test counts therefore describe the retained extraction. They must not be labelled “orders created today/last week” or “new orders received this run”. A count increase is not proof that one particular writer order was collected.

## Small Settings improvement in this batch

Settings now explains received test-order counts explicitly, including unavailable/zero/inconsistent-count states and warnings for unfinished or recheck-required candidates. It states that the counts do not prove the writer ran, a daily schedule worked, or financial verification passed. The old September deployment observation remains available in an expandable historical record instead of appearing as the current operational result.

This adds no schema, grants, provider scopes, writer endpoint, credentials, scheduler controls or financial mapping changes. The synthetic Profit Engine/Cash Control pages remain independent sample demonstrations; live test orders do not automatically make those charts change.

## Acceptance for the live feed

1. The isolated writer obtains a provider-confirmed development-store test-order ID and records the matching durable action result under its approved future bounded programme.
2. The next genuine overnight reader records a completed collection covering the appropriate completed reporting period.
3. A restricted operator inspection finds that exact provider ID in the retained source and its `TEST_ORDER` exclusion, with no finance event for that order. Keep IDs and private source payloads outside public documentation.
4. Member Settings shows the dated collection and test-order ingestion counts; exact-order matching remains an operator verification, not a claim inferred from aggregate counts.
5. Unchanged reader replay creates no duplicate candidate or merchant order; failed/unconfirmed attempts retain honest status and must not be relabelled successful.

To show trading/profit charts evolving, a separate labelled synthetic reporting fixture can exercise eligible financial events. Do not make real Shopify `test=true` orders eligible to create a visually busy dashboard. Any connected development financial view needs an explicit isolated data contract and remains separate work.

## Validation

- Five new status tests: observed tests vs financial/scheduler claims; missing state/counts; explicit zero; inconsistent counts; recheck/unfinished attempt warnings.
- New disposable PGlite integration: synthetic API-shaped test orders → collector/detail reader → candidate recorder → durable journal → authenticated member RPC → frontend parser/status message. Checks one order, replay without duplicate batch, then two retained test orders; zero financial events/net product sales and unchanged public orders/coverage counts.
- Existing connection warning/deployment tests run with the new status tests.
- Frontend typecheck passed.
- Main frontend build passed with `PORT=3000 BASE_PATH=/` (existing tooltip sourcemap, mixed Supabase import and bundle-size warnings). A first invocation without these variables failed at configuration before compilation.

These checks use invented API responses and a local disposable database. They do not establish live feed health, exact-order receipt, production readiness or forecast accuracy.
