# Subsequent import writer — local verification, 10 September 2026

The approved subsequent-import work now has an append-only database writer in `experiments/shopify/import-subsequent-evidence.mjs`. It is an internal function, not yet selected by the staging runtime or exposed through HTTP.

## Behaviour

The writer takes the existing dependency locks before checking a matching receipt, current candidate, source versions, settings and committed history. Preparation is recomputed inside the transaction; a previously returned plan cannot authorize a write. Prior stored order/refund identities, links, timestamps, legacy totals, financial components and evidence are compared with the retained source. This extends the earlier snapshot/count checks: a matching snapshot alone is not accepted as proof of correct values.

Only new events are inserted. New refunds link to their existing original order, using the actual refund event date and VAT components. Existing original order rows and AOV inputs are not rewritten. Source edits, missing events, ambiguous mappings or stored-value discrepancies abort before additions. New raw/evidence records and the receipt commit together. Existing invalidation triggers conservatively clear coverage for the store when new events are inserted; this is existing behaviour, not new period-specific certification logic.

Receipts count newly inserted orders/refunds, including zero. The proposed `db-migrations/proposed/ingest_v1_incremental_receipts.sql` changes only the positive-order-count constraint to allow zero, enabling refund-only and no-new-event batches. Existing receipts, append-only protections and permissions remain unchanged. No-op batches preserve existing coverage rows/references; they can add a false row for a previously absent requested period. A returned coverageCertified false never claims the store's current completeness status. Matching-receipt retries remain historical acknowledgements and make no changes.

## Verification

85 source/import/review tests passed. Five new writer groups cover restricted-role additions, preserved existing rows, later refund-only imports, zero-event batches, receipt retries, transaction rollback and stored identity/value/evidence tampering. Additional assertions verify rollback restores the prior coverage flag and a no-op preserves existing coverage; the focused writer tests were rerun after these assertions.

All 14 standalone PostgreSQL checks passed, including two new subsequent-import cases. Independent connections show an observed lock wait. Concurrent same-batch refund imports yield one import and one already_imported response. Terminating the first connection after financial/coverage work but before receipt/commit rolls it back; the waiting request completes exactly one addition. Each ends with one original order, two refunds and two receipts (including the first import). Explicit retry adds nothing. This does not simulate a network failure during COMMIT acknowledgement. The temporary cluster was removed.

## Remaining before staging

Compose the bounded subsequent-import runtime and test its restricted login path. Prepare a guarded synthetic candidate update for staging store C plus the receipt constraint change; specify exact expected values and preservation checks. Request approval for that concrete remote package. Do not apply the proposal to staging simply because it passed locally.

Cumulative retained history is still required. Delta-only intake, historical corrections/deletions, unsupported Shopify mappings, scheduling, live Shopify connectivity and complete profit/cash reporting remain outside this implementation. No new financial rules were chosen. No staging, production, Replit or main-branch changes accompany this checkpoint.
