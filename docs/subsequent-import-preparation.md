> Superseded implementation checkpoint: the [database writer is now locally tested](subsequent-import-writer.md). The preparation history below records the earlier limits.

# Subsequent import preparation — 10 September 2026

Paul approved starting the subsequent-import work package after the successful staging first-import trial. This checkpoint implements local preparation only; it does not enable a second financial write or change staging.

## Implemented

`experiments/shopify/plan-subsequent-import.mjs` recomputes financial events from retained sources associated with committed imports and the incoming cumulative candidate. It deduplicates unchanged events across prior batches, identifies new orders and later refunds, preserves event-period dates, and returns false completeness. Missing or changed earlier events, conflicting history, changed settings, ambiguous/unsupported mappings and duplicate event identities block the whole plan. No deletion or correction policy is inferred.

`experiments/shopify/prepare-subsequent-import.mjs` reads a repeatable-read, read-only database snapshot. It requires the current scoped candidate, matching store settings, current source versions and committed receipt fingerprints. It refuses stale/missing raw evidence or a stored-row count mismatch before returning the plan. This is an internal preparation function, not an endpoint or authorization to execute the plan later.

The cumulative-history requirement follows the existing source-version intake constraint. A batch containing only recent changes is not supported. Matching raw snapshots and counts do not prove every stored identity/value matches retained source; the writer must perform that stronger comparison. The preparation result deliberately remains planned_awaiting_database_checks.

## Verification

Eight pure tests cover a March refund of a February sale, overlapping cumulative batches, identical input, missing history/events, changed/edited events, duplicate refund identity, settings/identity mismatch and conflicting multi-batch history. Two disposable-database tests cover actual receipt-backed preparation, unchanged financial rows/receipt count, superseded candidate refusal, missing history and stale raw evidence. The existing full source/import/review suite plus the eight planner tests passed 78 tests; the two database tests also passed separately.

## Remaining implementation in the approved work package

- Implement the append-only transaction writer, repeating preparation under dependency locks and comparing stored identities, amounts and evidence with committed source before any insert.
- Link later refunds to existing original orders; insert only genuinely new events and preserve original sales/AOV.
- Prepare a migration allowing receipts for refund-only or no-new-event batches: the current receipt order_count constraint requires a positive count. Define technical counts explicitly as newly inserted rows; do not reinterpret existing receipts.
- Preserve false completeness/recheck behavior, transaction rollback and nonduplicating retry. Test concurrency and interrupted transactions in standalone PostgreSQL.
- Keep the current first-import runtime unchanged until the new writer is verified. Prepare one concrete staging package for approval before changing the remote database.

No new financial definitions were introduced. No live Shopify account is available. Production, Replit and staging remain unchanged by this preparation package; no credentials or customer data are included.
