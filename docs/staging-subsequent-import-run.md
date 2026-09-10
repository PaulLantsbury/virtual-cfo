# Staging subsequent import — ready for approval

Prepared 10 September 2026. Not applied remotely.

## Bounded proposal

Target only Night Scout Staging bioalckltvkhlczusdvl and synthetic store C (90000000-0000-4000-8000-000000000003). Apply `db-migrations/staging/20260910_subsequent_scenario.sql`, SHA-256 `5e23cfc9740f4804d98c73a548cfaeea7b7ef04588e189a4a94c1c6afe08c706`.

The atomic package requires C's original head, matching original receipt/fingerprint, one order/refund and exact prior source versions. It changes the receipt constraint to permit zero new orders, retains a new cumulative candidate containing one additional synthetic refund, updates source versions, supersedes the earlier candidate and marks its head for recheck. It adds no financial rows itself. The new batch is 93000000-0000-4000-8000-000000000004 for the existing February 1–28 scope. The retained cumulative source includes the later refund; its financial event belongs to April, not February.

Using the existing private importer credential and verified TLS/official Supabase CA, initialize `initialiseSubsequentImportRuntime` with the same staging/store/February scope and the new batch ID. Run once and explicitly retry once; close the pool. The new initializer selects the append-only writer internally, while the existing initializer retains first-import behaviour. Both enforce the same copied/frozen scope, dedicated login, role readiness checks, bounded pool/timeouts and sanitized failures. No HTTP endpoint, automatic retries or scheduled import is enabled.

Expected first result: imported_awaiting_review, orders 0, refunds 1, coverageCertified false. Retry: already_imported with the same counts. Final C totals: one unchanged original sale, two refunds and two receipts. The new refund is GBP 24 including GBP 4 VAT, dated 6 April 2026 and linked to the original February sale. The original March refund remains GBP 24 including GBP 4 VAT. The sale remains GBP 100 gross product less GBP 10 discount plus GBP 18 VAT, customer charge GBP 108. No cost or profit assumptions.

Existing February completeness stays false; no March/April coverage certification is added. C receives no merchant membership, reviewer authorization, human review or restoration. Existing A/B financial rows, coverage/references and review audit count must remain unchanged. No production, original-project, Replit or main-branch changes.

## Execution checklist after approval

1. Confirm actual dashboard project. Capture A/B rows/coverage/audit and C financial/evidence/receipt records. Check original scoped head and expected source versions. Stop on unexpected state; do not overwrite it.
2. Check artifact hash and exact editor contents. Apply the package once. On an uncertain result inspect actual state before any repeat. Guarded package replay is refused.
3. Verify candidate/source update and unchanged financial rows before invoking the restricted subsequent-import runtime.
4. Run and retry as specified; verify timestamps, amounts, order linkage, one added receipt, false completeness, unchanged A/B and no C user grants. Preserve credentials only in ignored private files; do not print them.
5. Record verified result and publish documentation through the existing draft branch.

## Tests and limits

Two exact-package disposable-database tests pass, including restricted-role import/retry, A/B coverage and all original order preservation, guarded replay refusal, stale source refusal and late-error rollback of both candidate changes and the receipt constraint. Three existing runtime configuration/failure tests pass. All 15 standalone PostgreSQL cases pass, including the new initializer with a real dedicated LOGIN and pg Pool: one refund-only import then already_imported. Its test-only Unix socket transport does not retest cloud TLS; the approved real run must verify TLS.

The previous writer suite passed 85 source/import/review tests and 14 standalone cases; this package adds the two exact-package tests and the fifteenth standalone case. This remains synthetic cumulative-source testing, not live Shopify synchronization or production readiness.
