# Customer continuation and closed-month gates — 21 November 2026

This is an offline execution and evidence checklist at source checkpoint `4e7cd9f`, preserving earlier `9d7151c`. It authorizes no remote operation. The website release, optional customer-sidecar publication and finite financial continuation are separate packages. No private member IDs, snapshot IDs, body hashes or inventory fingerprints are included here.

## Evidence already available

A private read-only capture contains the actual original 48 cash/acquisition envelopes covering November 2024–October 2026. Their body digests were checked without changing any row. For the October acquisition envelope, deterministic identity source regeneration from its original inception through its recorded source ceiling matched the recorded source/order/refund/allocation digests. Existing mandatory acquisition fields also matched, and existing economics were preserved. The resulting single proposed optional activity sidecar reports 1,626 identified customers, 683 customers with a repeat order and 1,634 identified orders.

That is actual original-envelope compatibility evidence plus an offline deterministic calculation. It is not a newly applied sidecar, a merchant identity result, a fresh canonical monthly financial acceptance, an approved selection, or a completed transaction. The private selected member/time are proposed only. Current scoped catalog readback establishes that the original summary relation exists and contains 48 rows, 24 of each kind, with no invalidations or optional customer activity; the new sidecar schema was absent at that check. A complete exact package still needs current authority, restricted-role and transaction/preflight receipts. Aggregate catalog visibility alone does not supply them.

The public contract and storage tests instead use explicitly disposable synthetic fixtures. Their receipts prove local calculations, guards, atomicity and recovery behavior; they must not be relabelled as hosted acceptance of the private October candidate.

## Runnable local verification

Run from this checkout. The runtime path below is the installed local Node runtime; replace it with another compatible Node executable when working elsewhere. These commands use no provider connection or hosted database. Database tests create disposable PGlite instances only.

```sh
TASK_NODE=/Users/paullantsbury/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
"$TASK_NODE" --experimental-strip-types --test --test-concurrency=1 \
  experiments/synthetic-company/continuation-proposal.test.mjs \
  experiments/synthetic-company/summary-refresh-proposal.test.mjs \
  experiments/synthetic-company/continuation-manifest.test.mjs

"$TASK_NODE" --experimental-strip-types --test --test-concurrency=1 \
  experiments/synthetic-company/customer-summary-version.test.mjs \
  experiments/synthetic-company/customer-contracts-independent.test.mjs \
  experiments/synthetic-company/repeat-order-economics.test.mjs \
  experiments/synthetic-company/customer-activation-manifest.test.mjs

"$TASK_NODE" --experimental-strip-types --test --test-concurrency=1 \
  experiments/synthetic-company/customer-sidecar-storage.test.mjs \
  experiments/synthetic-company/customer-sidecar-security.test.mjs \
  experiments/synthetic-company/customer-sidecar-reader.test.mjs \
  experiments/synthetic-company/customer-sidecar-integration.test.mjs \
  experiments/synthetic-company/customer-sidecar-recovery.test.mjs \
  experiments/synthetic-company/customer-activation-rehearsal.test.mjs
```

Read the resulting test receipts rather than assuming this note reran every suite. Existing source receipts are recorded in [the continuation contract](continuation-manifest-contract-2026-11-21.md) and [the activation review package](customer-activation-review-package-2026-11-21.md). The private actual-candidate reproduction is kept outside GitHub with owner-only file permissions; do not copy its input/output into these fixture tests.

A deterministic future continuation proposal can be materialized locally without a service:

```sh
"$TASK_NODE" --input-type=module <<'JS'
import {writeFileSync} from 'node:fs';
import {prepareSyntheticContinuationProposal} from './experiments/synthetic-company/continuation-proposal.mjs';
writeFileSync('/private/tmp/nightscout-continuation-candidate-review.json',
  JSON.stringify(prepareSyntheticContinuationProposal(),null,2),
  {flag:'wx',mode:0o600});
JS
```

The exclusive-create flag preserves any prior review artifact; choose a fresh private filename if it already exists. This command produces future synthetic candidate evidence, never a scheduled receipt. It does not create a fully approved activation manifest.

When a separately reviewed private continuation input file actually exists, the following bounded step validates it and creates an immutable manifest artifact. It deliberately has no fabricated default input, no remote calls and no publication path:

```sh
"$TASK_NODE" --input-type=module <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
import {prepareContinuationManifest} from './experiments/synthetic-company/continuation-manifest.mjs';
const input=JSON.parse(readFileSync('/private/tmp/nightscout-continuation-input-reviewed.json','utf8'));
const manifest=prepareContinuationManifest(input);
writeFileSync('/private/tmp/nightscout-continuation-manifest-review.json',
  JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600});
JS
```

Input structure is executable documentation in `continuation-manifest.test.mjs`; the fields there are test fixtures, not values to paste into the private operational input. Likewise `customer-activation-manifest.test.mjs` demonstrates the customer manifest API; production input must come from the exact private base-body inventory, independent inventory anchor, actual snapshot mapping and reviewed selection plan. Its output remains `prepared-only` with activation disabled even when supplied receipt headers are structurally complete.

## Finite continuation and November closure

The prepared continuation is exactly 20 December 2026–19 March 2027 inclusive: 90 daily dates and 10,947 candidate ledger events. Its source and generated-prefix digests are pinned by the validator. The existing finite programme ending 19 December is not extended by generating this artifact, and the original historical seals and 48 summaries remain protected.

As of 21 November, November is still open. Its monthly refresh cannot be approved from partial daily activity. The first possible closure checkpoint is 1 December 2026 in Europe/London, after the full month and all required observations are available. A clock crossing midnight is insufficient by itself: obtain exact supported November financial version, sales/cost revisions, full daily coverage and reconciled cash/acquisition compiler outputs.

November's daily coverage is mixed and must remain so:

| Days | Required provenance and references | What it must not become |
| --- | --- | --- |
| 1–4 November | Existing sealed-prefix coverage; exact source/version and seal witness | A claim of scheduled operation |
| 5–19 November | Approved historical-publication coverage; actual approval reference, publication ID and content witness | A manufactured scheduled run receipt |
| 20 November onward | Genuine scheduled run and persisted receipt; exact date/company, source/version and receipt witness | A manual append, enabled-cron assumption or synthetic future fixture |

Each date must be represented exactly once, in order, and bound to the complete monthly financial review. Missing, unknown or uncertain dates block that month and later unpublished months; no skip, automatic catch-up, retry or date rewriting fills the gap. A scheduled run's existence must be corroborated with actual persisted outcome/readback and exact scope; a log saying a job started does not establish complete financial coverage. The validator checks supplied proof headers and hashes, not remote truth or authorization.

New monthly summaries form a contiguous prefix beginning November. December, January and February may follow only after each closes and its proofs succeed. March remains ineligible because activity ends 19 March; do not extrapolate the missing days or relax the finite ceiling. Any source correction, expired access, scheduler extension or changed baseline needs a separately reviewed package.

## Customer populations and refunds

The optional monthly activity fields use distinct identified customer IDs, distinct identified customers with at least one eligible repeat order, and identified order count. A customer placing a first order and then repeating within the same month may appear in both the first-order and returning-customer populations. The groups overlap; they are not mutually exclusive people. First-order witnesses must be consistent for each identity. Guests and unknown identities stay outside identified-customer denominators.

Do not sum distinct customers across months or average monthly purchase-frequency ratios. A wider window needs a separately validated distinct union and overlap policy. Orders and spend may be additive when source coverage matches; unique-customer counts are not automatically additive.

Repeat-order economics partition actual identified repeat orders separately from paid first, nonpaid first, guest and unknown orders. The residual after paid first orders is not a repeat-customer pool. Existing non-acquisition marketing allocation includes nonpaid first orders, so partitioned marketing costs must not be called a newly established causal repeat-campaign allocation. The Plan repeat lever stays gated.

Refunds retain their original order/customer classification and affect financial totals on the refund event date; they do not remove the original order from its count or rewrite historical AOV. A refund in the selected month may concern an earlier original order, whose witness must remain available. Cost recovery follows evidenced return-to-saleable-stock timing, not an assumed refund reversal. Missing identity, cost, recovery timing or observation coverage withholds dependent results. No lifetime value, retention probability or future repeat uplift follows from these offline counts.

## Replay, atomicity and recovery

Before any proposed sidecar insertion, re-read the complete 48 immutable bodies, actual base snapshot mapping and exact current financial dependencies. Bind source revision plus storage/recovery/reader file bytes, base inventory, sidecar body/version, selected tuple, actor and proposed instant into one candidate. Current hosted catalog, owner authority, restricted-role and transaction/preflight evidence must bind that same exact candidate. The existing member readback alone is not authority to publish.

Local rehearsal must show candidate version and selection commit atomically, or both roll back on failure, without changing original bodies. Exact existing sidecar content may be recognized as unchanged by the proposal planner; changed same-base content is refused by immutable uniqueness. There is no generic upsert or same-base correction approval.

After an uncertain outcome, inspect exact committed state before considering another attempt. Do not interpret timeout as rollback and blindly retry. A replay path must prove byte-equivalent content and exact tuple identity against the intended package; the absence of an executor here is deliberate.

Recovery is an append-only withdrawal of an exact already selected base/version, by an appropriately reviewed member, with bounded instant and supported reason. Keep the archived sidecar/selection and original 48 summaries intact. The guarded reader must check withdrawal in the same read transaction and return unavailable, never restore an older version, choose another base or invent optional counts. Rehearsals must cover membership denial, changed source/correction, withdrawal/read denial, duplicate or conflicting tuples, stale gate evidence and failed transaction rollback. Real hosted schema/role/application acceptance remains a later explicit operational step.
