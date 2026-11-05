# Synthetic history and daily append: independent review

Later batch: see [the current correction and staged-rollout record](synthetic-history-rollout-preparation-2026-11-05.md). The invalidation-only gap recorded here is now addressed locally for explicitly reviewed expense-accrual amounts only; other correction types and live activation are still outside acceptance.

Status: independent local implementation review and five executable SQL test groups passed. No live seed, schema, access, provider, scheduler or deployment change is authorised or performed by this document.

## Acceptance contract

The company retains the agreed v2 profile: £750,000 annual net turnover (£720,000 product sales plus £30,000 shipping), 19,895 original eligible orders, 50% product gross margin and four artificial staff members. Annual operating profit is £102,244.48 and EBITDA £104,644.48 under the explicit fixture cost model. VAT remains separate from revenue. Cash, stock receipts, payroll liabilities and payments must not become extra sales or duplicated expense.

The target rehearsal is 24 complete months plus completed current-month days. Every complete month needs actual canonical sales and profit reconciliation; an annual total or a pure revision hash alone cannot establish history readiness. Refunds retain original-order evidence and refund-date recognition; saleable stock recovery uses supported original product units/costs. Partial current months must not receive complete-month profit seals.

The already loaded January example is an existing immutable state, not an empty target. Backfill/append must preserve its source identity and earlier evidence; do not rerun an occupied-target exporter or replace sealed source rows silently. Existing canonical v1 store-wide revision and invalidation rules remain authoritative and fail closed. Scoped v2 evidence requires its own explicit reviewed coverage and dependency version; its availability must not recertify stale v1 evidence.

Independent tests must exercise actual disposable SQL and existing financial readers: all monthly figures, idempotent day receipts, exact replay, changed replay refusal, atomic failure rollback, competing submissions, scoped month stability after later append, historical correction invalidation and member isolation. Fingerprints must include canonical rows, trigger side-effect relations and new coverage/receipt/snapshot evidence. Preserve unrelated stores and inspect meaningful source mutations rather than only changing hashes.

## Remaining live gates

A local successful rehearsal does not authorise installation or a daily scheduler. Review the installed schema/trigger contract, initial occupied-company continuation, privileged writer identity, precise access policies, immutable source corrections, concurrency locks and uncertain-commit recovery before proposing live application. Keep operational account bindings and generated SQL private. Provider test programmes remain independent and no catch-up provider transaction is implied.

The planned implementation keeps history in a separate private v2 event/coverage/seal/run contract and reuses existing sales/profit calculation engines through an explicit SQL-backed reader. It does not insert new events into v1 tables or replace the January example. Therefore v1 should remain unchanged and complete when its own sources are untouched; v1 must still fail closed if those actual sources change. The v2 reader is a new versioned contract, not evidence that the old hosted reader has gained daily-history support.

## Executed independent results

Five meaningful test groups in `experiments/synthetic-company/history-independent.test.mjs` passed against actual in-memory PostgreSQL tables and the explicit v2 authenticated SQL reader. The four-group frozen-core run passed in 86.1 seconds; the additional trusted-snapshot preservation group passed in 4.4 seconds, and the strengthened changed-source replay check passed in a focused 4.94-second run. The checks establish local behaviour only.

1. Imported **734 completed London calendar days**, covering 1 November 2024–4 November 2026, with **24 complete monthly seals**. Every monthly result was read through the SQL-backed service. Both complete rolling profile years independently reconcile to £750,000 revenue, 19,895 original orders, £360,000 gross product profit, £102,244.48 operating profit and £104,644.48 EBITDA. Calendar 2025 reconciles to the same oracle. Source-as-of boundaries match London daylight saving; metadata retains the pinned history anchor and a separately supplied observation clock. The incomplete current month remains unavailable for complete-month profit.
2. An explicit offline next-day simulation appends 5 November using a 6 November reference clock. January’s v2 snapshot/result stays unchanged, and its v1 source/evidence fingerprints and £1,976.02 operating profit remain intact. Exact daily replay adds no rows or receipts. This test does not move any provider or live runtime clock.
3. Injected failures after source writes, before sealing and before commit leave the entire v2 state and legacy fingerprints unchanged. Two queued same-day submissions yield one committed day and one exact replay, with one unique receipt. Wrong anchor, skipped day, future/current-day activity and contract truncation are refused. PGlite queues calls within one instance: this is **not distributed or multi-backend PostgreSQL concurrency acceptance**.
4. Invalid authentication, non-member access and extra untrusted scope fields are refused. Coverage-digest corruption and actual mapped-source corruption fail closed. Replaying a tampered source is refused without extra source/receipt rows; the writer checks actual stored body/index data rather than trusting a cached hash column. Pinned contract changes are denied. An explicit correction-review invalidation makes the affected v2 month unavailable while v1 remains intact.
5. A separate representative fixture includes an existing v1 January trusted reporting snapshot, not just raw orders and profit evidence. Its actual legacy service response and snapshot row remain exactly unchanged across a separate v2 import and day append. This is disposable local proof; no new claim about hosted authentication, deployed permissions or live data mutation is made.

## Explicit remaining gaps

- The new v2 reader currently supports complete calendar months. Daily event storage and append receipts do not constitute a day/custom-range reporting API or chart integration.
- Correction handling is **invalidation only**. Existing unique period coverage/seal constraints do not yet support a replacement/supersession version and selection workflow. Historical recovery is not complete; do not silently reseal or overwrite an invalidated month.
- The new private v2 contract reuses the established monetary calculation engines; it does not replace or expand the installed v1 SQL reader. Existing v1 behaviour and fail-closed protections remain unchanged.
- Multi-connection locking, independently concurrent initialisation, uncertain-commit receipts and production-scale performance still require a real multi-backend PostgreSQL rehearsal. Queued PGlite submissions are insufficient evidence for those claims.
- No v2 schema, source history, access policy, recurring job, reader switch or hosted application has been installed by this batch. A live continuation package must reconcile the already occupied January company and preserve its evidence, not reuse an empty-target seed exporter.

The local package is ready for review as preparation. It does not authorise a hosted history import or a daily schedule.
