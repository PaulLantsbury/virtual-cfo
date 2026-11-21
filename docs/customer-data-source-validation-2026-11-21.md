# Customer data source validation — 21 November 2026

Scope: local source checks and disposable databases. Baselines are recovery/continuation `9d7151c` and activation/rehearsal `4e7cd9f28bc601dd27bd26f479743442201543c8`. The timestamp correction below is a subsequent source change frozen at `9a5dd35c982a81e57370700d3afffa80e98f93ba`. No hosted writer, endpoint, UI connection, database/grant change or source publication is performed here.

## Run from the repository root

Use Node with TypeScript stripping support (the recorded runtime is Node 24) and the existing locked workspace dependencies, including PGlite. No database URL, provider keys or signed-in browser is required. These commands create disposable in-memory databases only.

Bounded activation/security checks at the timestamp-corrected source:

```sh
node --experimental-strip-types --test --test-concurrency=1 --test-timeout=300000 \
  experiments/synthetic-company/customer-activation-manifest.test.mjs \
  experiments/synthetic-company/customer-activation-rehearsal.test.mjs \
  experiments/synthetic-company/customer-sidecar-security.test.mjs
```

The focused recovery/reader/continuation gate can be reproduced separately when relevant code changes:

```sh
node --experimental-strip-types --test --test-concurrency=1 --test-timeout=300000 \
  experiments/synthetic-company/customer-sidecar-storage.test.mjs \
  experiments/synthetic-company/customer-sidecar-recovery.test.mjs \
  experiments/synthetic-company/customer-sidecar-reader.test.mjs \
  experiments/synthetic-company/customer-sidecar-integration.test.mjs \
  experiments/synthetic-company/continuation-manifest.test.mjs
```

The historical full-domain command was `pnpm run test:synthetic-company`; the release gate was `pnpm run build` (which includes workspace typecheck). Do not rerun unchanged broad suites merely to refresh a receipt. The historical full-domain count is not an expected count for later checkouts that add test files.

## Receipts and overlap

| Source/checkpoint | Recorded result | Interpretation |
| --- | --- | --- |
| Recovery/continuation baseline | 201/201 serial synthetic-domain tests passed | Historical broad receipt. Final continuation hardening was separately covered by the focused receipt below. Not rerun in this task. |
| Final recovery/continuation focus | 31/31 passed: storage 5, withdrawal 4, reader-port 9, actual SQL integration 6, continuation 7 | Overlaps the domain suite; not 31 additional independent end-to-end scenarios. Not rerun in this task. |
| Activation package `4e7cd9f` | 12/12 passed: manifest 5, independent rehearsal 4, security 3 | Bounded new-package receipt; shared fixtures and behaviours overlap earlier coverage. |
| Timestamp-corrected manifest | 6/6 passed | Includes one new timestamp regression; this is also included in the combined receipt below. |
| Timestamp-corrected activation/security group | 13/13 passed: manifest 6, rehearsal 4, security 3 | Current bounded source receipt, superseding 12/12 only for this changed group. Counts are not summed with 6/6, 31/31 or 201/201. |

Historical sources: `sidecar-recovery-continuation-batch-2026-11-21.md`, `customer-activation-review-package-2026-11-21.md` and `data-security-review-2026-11-21.md`. Full workspace build/typecheck previously passed at the recorded coordinator checkpoints; this narrow review does not claim a new broad build receipt.

## Timestamp defect found and corrected

The activation manifest accepted arbitrary fractional-second precision but compared timestamps through JavaScript's millisecond `Date.parse`. A selected timestamp ending `.000001Z` could compare equal to a review timestamp ending `.000000Z`, despite being later in PostgreSQL. The reader already accepted only whole seconds or exactly three fractional digits, so a microsecond selection could also fail its readback guard.

The manifest now uses the same UTC seconds-or-three-digit-milliseconds contract. The regression accepts both supported forms, rejects microseconds and one/two-digit fractional forms in selected/reviewed timestamps, permits equivalent second/millisecond boundaries, and rejects a selection one millisecond after review. The shared guard applies to existing selections, withdrawals and supplied hosted-header observations too. No financial definition, live timestamp or stored record was changed.

## What the local evidence proves

Actual supplemental, sidecar and recovery SQL executes in PGlite. The reader's membership/source/selection/withdrawal queries run under a non-superuser, non-BYPASSRLS, NOINHERIT role with read-only transactions and local SELECT-only grants. Rehearsals prove atomic candidate/selection rollback, committed withdrawal withholding, protected-record preservation, denied non-member selection, restricted-role/RLS boundaries and refusal of substituted source hashes. The manifest checks source bytes, bounded exact candidate actions, original inventory hashes and asserted receipt bindings; it always returns activationAllowed=false.

Auth responders are artificial. The independent activation rehearsal's financial port checks artificial seal/invalidation/version-head SQL and supplies prepared report responses; it is not a full retained-journal canonical recomputation or hosted JWT verification. Fixtures include labelled fictional acquisition envelopes and protected Cash placeholders, not captured hosted records or cash arithmetic certification. Single-connection PGlite does not prove multi-connection concurrency, immediate revocation within an already-open snapshot, provider acceptance or unknown-commit recovery.

## Boundary before activation

Still missing: independently verified target/operator and installed commit; live-compatible private catalog/RLS/effective grants; actual protected 48-row indexed state and hashes; canonical current financial/source proofs; a private bounded writer/preflight/postflight with durable uncertain-outcome readback; exact withdrawal/recovery materials; and separately reviewed runtime endpoint/UI integration. Supplied verified receipt headers are assertions, never authenticated permission. No repeat lever, customer timing forecast, monthly backfill or scheduler extension is enabled by these tests.
