# Sales/refund import readiness — 9 September 2026

## Current result

A local dry-run checker now reviews a source-adapter envelope before any future evidence write. It is not a Shopify connector, CSV mapper, source authentication mechanism or production importer. No remote records are read or written by it. Run `pnpm test:import-review` (eight tests).

The user has been asked which Shopify development store or order/refund export is available. Source-specific mapping and independent reconciliation remain pending that answer. Do not infer full refund history from a general order export or an order's current cumulative refund field.

## Input contract

`experiments/financial-v1/import-review.mjs` exports `reviewImportBatch(batch, options)`. Its input is version 1 with:

- `scope`: storeId, currency, timezone, from and to. Only completed store-local date ranges and two-decimal currencies are supported.
- `manifest`: matching store/settings/date range, sourceRef, snapshotRef, capturedAt, an explicit originalOrdersAndLifetimeRefunds declaration, and separate orders/refunds page arrays.
- Each page: cursor, nextCursor, snapshotRef and record IDs. The first cursor and final nextCursor are null. Intermediate cursors must link without gaps or repetition; page IDs must match mapped records exactly.
- `orders` and `refunds`: the existing cloud-sales-adapter mapped row shapes, plus the currency/timezone settings used when preparing their evidence. Original orders and historical refunds needed for cumulative checks must be included even when outside the reporting period.
- Optional prior fingerprint: identifies an identical batch replay or a changed batch requiring reconciliation. This is diagnostic only; it is not a persistent idempotency store and performs no update/upsert.

All page-completeness and historical-coverage declarations must eventually come from a source-specific collection process with recorded query scope and independent verification. A coherent manifest can still describe an incomplete source extraction. This checker cannot establish that every upstream event was fetched, that source facts are authentic, or that an extraction was snapshot-consistent.

## Output and checks

Malformed/missing scope, unsupported precision, unfinished periods, early/future captures, incomplete pagination, duplicate IDs, mismatched records/settings, stale evidence and financial reconciliation failures produce `blocked` with no candidate result. Valid batches produce `ready_for_source_review`, a fingerprint, counts and candidate arithmetic. Every result retains `coverageCertified: false`. No persistable coverage certificate is emitted.

Shared financial arithmetic preserves original AOV, refund-event periods, original order links, tax components and cumulative refund limits. Missing or invalid values stay blocked. A temporary in-memory coverage assertion allows dry-run calculation only; the result must not be passed into the live briefing or stored as verified coverage.

Tests cover a refund-only period; input immutability; replay and changed snapshots; incomplete/missing/duplicate pages; mixed source snapshots; changed settings; missing lifetime history; stale evidence; bad links, money and over-refunds; ongoing periods and capture timing; complete multi-page and empty datasets; and prior-period refunds exceeding cumulative limits.

## Next steps

1. Identify the actual source and inspect its available fields and extraction limits.
2. Map real event, payment, tax, discount and refund facts without inferring missing information. Keep raw/customer exports outside public GitHub.
3. Compare a small representative import against independently obtained source totals and original order/refund details.
4. Prepare a transaction-safe writer with durable source identity, provenance, replay handling, change invalidation and coverage controls; test before any staging application.
5. Verify staged results through the authenticated briefing. Production remains deferred.

GitHub remains the durable versioned record. Replit has not been synchronised. Replit synchronisation is distinct from production release: it can be done earlier for development after checking its working tree for changes and selecting the intended branch. Nothing syncs automatically in this workflow.
