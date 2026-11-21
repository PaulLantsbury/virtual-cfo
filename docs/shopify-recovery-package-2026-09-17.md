# Shopify change detection and recovery — 17 September 2026

Completed using three parallel workstreams: restricted-pipeline recovery tests, private read-only status inspection, and independent review. Coordinator exercised a real Shopify development refund and the existing staging intake. No new database permissions/migrations, production release, financial rule or UI change.

## Delivered

[Read-only inspector](../experiments/shopify/inspect-development-intake.mjs) accepts the existing private intake configuration and needs no Shopify credential. It uses a repeatable-read read-only transaction with the restricted intake role, fixed staging/store identity, TLS and bounded waits. Its safe receipt contains observation time, current batch/fingerprint, retained batch count, order/refund/event counts and exclusion reasons. It distinguishes unavailable, current unverified and needs-recheck states; financial import is explicitly not assessed. No raw retained payload, customer details or secrets are returned.

```sh
node experiments/shopify/inspect-development-intake.mjs --config <private-intake.json>
```

Use this after an uncertain import outcome; first establish that the original process/transaction has ended. Inspecting an absent head does not prove an older request cannot still commit. Do not automatically retry an unknown commit or delete retained history.

[Recovery tests](../experiments/shopify/intake-recovery.test.mjs) run the existing HTTP collector/detail mapper/recorder with actual restricted-role SQL in disposable PGlite. They cover refund-only changes, stale/conflicting/missing history, rollback after a late write, simulated lost commit acknowledgement, cancellation and explicit recovery. Existing synthetic coverage withdrawal and other-store invariance are asserted. No eligible-sales policy was changed.

## Verification

**23 combined checks passed:** eight new recovery tests, six inspector tests, five existing runtime checks and four operator checks. The independent reviewer separately checked the fourteen new cases and found no blocker. Inspector cleanup errors were sanitised and blocked-mapping counts checked. [Independent review and remaining limits](shopify-recovery-review-2026-09-17.md).

Live test on PocketLaunchpad1 order #1001: refunded the remaining one unit (£949.95) through the Bogus test gateway, without restocking or notification. Shopify now shows Refunded/Archived, original payment £1,899.90, two refunds totalling £1,899.90 and zero net payment. The source API independently confirmed test=true, two successful refund transactions, one unit per refund, no tax/discount/shipping and REFUNDED status. No real payment was involved.

Before recollection the new inspector correctly showed the retained one-refund candidate, even though Shopify had changed: its receipt describes stored state, not current source health. The next intake returned `changed_requires_review`. Inspection then showed one test order, two refunds, zero financial events, two retained batches, and `needs_recheck`. The old batch remains retained and superseded. A second collection returned `replay` for the same new batch, creating no third batch and preserving recheck. TEST_ORDER exclusion and false coverage remain intact.

Read-only reconciliation compared the twelve relations with full cross-store visibility under the existing review role to their earlier count/content fingerprints: all unchanged. Candidate history and zero source/financial evidence for the development store were verified. An initial attempt to compare membership-filtered tables against administrator totals was invalid; it was narrowed to fully visible relations. Import-receipt tables are not readable through this role and were not claimed as inspected. No privilege expansion was needed. The earlier application package's 43-relation administrator baseline remains historical evidence, not a fresh 43-relation check here.

## Exact checkpoint and limits

Staging project `bioalckltvkhlczusdvl`, store `56d92f8a-746e-4b4f-b408-81fc98c4aa17`, reporting range 17 September 2026. Two retained candidate versions, one current head requiring recheck, one source order with two refunds, no financial events. Do not repeat the already completed final refund, recreate setup or clear the flag to make the screen look complete. This test population cannot enter the current finance importer.

The live exercise proves source-change detection and same-batch replay. Disposable injected failures do not prove actual remote disconnect recovery or concurrent candidate commits; only the earlier two-connection lock contention/release check was live. No scheduled sync or merchant-facing connection panel is implemented. No frontend files changed, so no new browser walkthrough or UI deployment is claimed; the operator was run against staging with existing authorised access.

Next recommended reporting package: agree a clearly separated eligible synthetic test route through the existing financial pipeline, covering sale/refund dates and cross-page reconciliation. Keep actual Shopify test orders excluded. A customer-facing connection/status panel and scheduled sync remain separate implementation work; missing costs and completeness remain unavailable rather than fabricated.
