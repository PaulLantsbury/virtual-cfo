# Shopify intake recovery review — 17 September 2026

## Boundary and evidence

This review concerns operator-driven, unverified candidate intake for PocketLaunchpad1 in staging. The preceding package records successful live first intake, unchanged replay and two-connection row-lock contention/release. Those results do not establish concurrent candidate commits, recovery from an actual remote lost acknowledgement, scheduled synchronisation, financial completeness or eligible sales. No standalone PostgreSQL instance was available for the broader concurrency suite. Disposable SQL fixtures and simulated connection failures must be labelled separately from live observations.

No migration, new grant, source mutation, candidate write, coverage restoration or production action is performed by this review. The coordinator owns any separately authorised live exercise and its evidence. The existing Shopify order remains a test order; exclusion is correct.

## Required recovery behaviour

- A source change creates a distinct candidate, retains and supersedes the earlier batch, moves the current head and marks existing coverage for recheck. It cannot certify financial results.
- An unchanged repeat returns the same current batch without additional retained batches. Replay must not clear `needs_recheck`.
- An older source version cannot replace the newer accepted version. Missing sources or equal-version conflicting content must flag the existing head for recheck without replacing accepted source versions.
- A transaction failure before commit rolls back its batch/head/source changes. A failed acknowledgement at commit is **unconfirmed**, not proof of rollback; do not automatically retry or delete history.
- A status inspection is read-only, fixed to the configured staging store and reporting range. Its counts and current-head summary must share one database snapshot. Do not output retained customer payloads, credentials or full database errors.
- An inspection describes stored candidate state at the observation time. It does not prove the current Shopify source matches it, that collection is running, or that financial evidence has been imported/reviewed. An absent head is not proof an earlier unknown request can no longer commit.

## Exact next safe live source-change exercise

Subject to the coordinator's confirmed authority for the source mutation and scoped staging candidate run:

1. Capture a read-only candidate-status receipt and other-store baseline. Independently read the current Shopify order and verify it is still the known development order #1001 with `test=true`, two original units, one refunded unit and £949.95 remaining simulated balance. Stop if those prerequisites differ; do not repeat a completed refund.
2. Refund only the remaining one unit through the existing test gateway, without restocking, fulfilment, shipping purchase or notification. Preserve actual source event dates and test eligibility. No card charge or real customer record is involved.
3. Read the order and both refund records through the existing full-history reader/detail pipeline. Reconcile total original amount £1,899.90, aggregate simulated refunds £1,899.90 and zero remaining balance. Observe actual identifiers/statuses; do not fabricate timestamps or force expected versions.
4. Record once for the already configured 17 September 2026 candidate range, using the dedicated intake login and explicit target acknowledgement. Require a changed candidate, prior batch retained/superseded, current head pointing to the new batch and `needs_recheck=true`. The mapper must still report TEST_ORDER exclusion and zero financial events.
5. Inspect stored state, then repeat the unchanged source collection once. Require the same current batch and unchanged recheck flag. Confirm no finance-import receipt/certification or unrelated-store changes. Retain only non-sensitive evidence in GitHub.
6. If acknowledgement is lost, stop and use the inspector. Establish that the original process/transaction has ended before deciding whether a new collection is appropriate. Do not replay a fabricated historical payload into staging merely to demonstrate stale-version rejection; disposable tests cover that branch.

If the remaining unit is already refunded or the gateway refuses this action, report the changed prerequisite and choose another bounded development transaction explicitly. Do not issue a second refund blindly, edit test flags, backdate events or add unsupported financial semantics.

## Operational limits and later work

Read-only status tooling plus idempotent collection assists recovery but is not an exactly-once delivery guarantee. Shopify pagination is not a transactional snapshot; source completeness still requires independent review. Bounded collection can fail on unsupported/oversized populations. Token refresh and private credential rotation do not justify automatically rerunning an uncertain database transaction.

The all-test population cannot progress through the current finance importer to nonzero actual reporting. The next reporting test route needs an explicit boundary: continue eligible synthetic fixtures separately or use appropriately authorised eligible source data. Do not relabel Shopify test activity as sales or assume costs.

## Package review result

Reviewed `experiments/shopify/intake-recovery.test.mjs`, `inspect-development-intake.mjs` and its tests. No blocking defect found. The independent run passed all eight recovery tests and the initial five inspector tests; the final six-test inspector suite passed after adding blocked-mapping/observation-time checks and sanitising connection-release failures. This is fourteen distinct focused tests, not nineteen independent cases.

Recovery tests exercise the real restricted role and candidate pipeline against disposable PGlite with mocked Shopify responses. They prove refund-only version handling, unchanged replay, stale/missing/conflicting history, pre-commit rollback, simulated post-commit lost acknowledgement and cancellation before intake. Separate fixtures prove missing/conflicting source withdrawal of previously true synthetic coverage. Other-store invariance assertions cover the six explicitly selected fixture tables, not an exhaustive live-database audit.

The inspector uses a read-only repeatable-read transaction, validates target identity and returns allowlisted counts/metadata with an observation timestamp. It distinguishes unavailable mapping event counts from zero, keeps financial import status unassessed and sanitises failure/cleanup paths. Its unit tests use mocked database connections; the coordinator must report any real staging SQL verification separately.

No live changed-source execution is claimed in this review. The existing live lock check proves contention/release only; neither the disposable tests nor simulated acknowledgement loss proves recovery from a real remote disconnect or concurrent candidate commits.


## Coordinator live checkpoint

The proposed remaining-unit exercise was subsequently completed within the authorised batch. The inspector ran successfully against real staging SQL before and after collection; changed candidate, retained prior version, persistent recheck and same-batch replay were verified. API and Shopify admin agree on the two simulated refunds. See [coordinator evidence and visibility limits](shopify-recovery-package-2026-09-17.md). No actual network-disconnect or concurrent-commit recovery claim is added.
