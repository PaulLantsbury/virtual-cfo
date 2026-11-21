# Offline customer publication protocol — 21 November 2026

Prepared implementation and disposable database rehearsal only. No hosted adapter, network client, environment/credential lookup, remote command, authorization receipt or live operation is included. Manifest activation remains false. This protocol cannot convert supplied hosted headers or a successful local test into permission to publish.

## Runnable implementation

`customer-publication-protocol.mjs` exports `prepareCustomerPublicationPlan(input, financialSealHash, protectedStateHash)` and `createCustomerPublicationProtocol(port)`. Preparation re-runs the bounded customer manifest compiler, rather than trusting a caller-mutated manifest. It binds the exact candidate, source revision, three source-file hashes, immutable 48-body inventory, financial-seal fingerprint, broader indexed/protected-state fingerprint and archived selection preconditions into one protocol hash. Execution requires independently pinned matching values and never silently revises them.

The injected port is explicitly labelled `disposable-local-rehearsal` and supplies transaction/readback callbacks, durable receipt read/append a financial-seal read function, broader protected-state readback and fresh same-transaction canonical-authority checks. The protected-state fixture includes original snapshot IDs/indexed metadata and financial seals, invalidations, heads and corrections. Each new publication/selection scope/version/revisions must still be supported by the authority port; merely recapturing a new fingerprint after invalidation cannot make it valid again. These are trusted local test seams. There is no implemented runtime selection of a remote database or verified real operator/canonical authority. Supplying another backend under that label is outside the contract and not an authorization mechanism.

`customer-publication-fixture.mjs` supplies the reusable disposable PGlite fixture: the real proposed supplemental/storage/recovery schemas, 48 fictional legacy envelopes, memberships, financial seals and a restricted-reader role. Its Auth and canonical financial adapters are expressly controlled test seams. The protocol receipt table is created only inside the disposable tests; no hosted receipt schema is installed or claimed ready.

Run from this checkout:

```sh
TASK_NODE=/Users/paullantsbury/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
"$TASK_NODE" --experimental-strip-types --test --test-concurrency=1 \
  experiments/synthetic-company/customer-activation-manifest.test.mjs \
  experiments/synthetic-company/customer-publication-protocol.test.mjs
```

These commands use disposable in-process storage and no real provider or database connection.

## State transitions and write boundary

Within one serializable transaction the protocol checks all 48 protected envelopes against their canonical body digests and pinned inventory fingerprint, checks the separately supplied financial-seal fingerprint, revalidates current exact financial authority for every new publication/selection target and reads the exact base snapshot plus sidecar/selection/withdrawal state. It refuses conflicting or partially present state; it does not finish an unexplained orphan insertion.

A new selected sidecar is inserted together with its exact member/time selection and a durable deterministic receipt. A withdrawal inserts only an exact existing selected base/version, bounded withdrawal time and reason. Archived selecting member/time must match the manifest's immutable preconditions; a forged but self-consistently rehashed new candidate cannot replace these facts. Existing versions and selections are never updated or deleted. Original envelopes and financial seals are checked again before commit.

The receipt binds protocol/candidate/source, inventory, financial and broader protected-state fingerprints, and exact selection/withdrawal/precondition tuples. A pre-existing complete exact state is accepted only with its matching receipt, as `already-applied`; no second insert occurs. An existing withdrawal makes an attempt to restore the original selected candidate a conflict.

## Failure and uncertain outcome

Injected checkpoints cover preinsert, immediately after candidate insertion, and precommit after tuple/receipt preparation. Exceptions roll back the transaction. The protocol never automatically reruns writes.

Regardless of a lost commit acknowledgement, independent repeatable-read readback examines the exact tuples, receipt and protected fingerprints. Exact complete state plus its receipt produces `applied-confirmed-after-uncertain-ack`; exact absent state without a receipt produces `not-applied-readback-confirmed`. Partial/conflicting evidence produces `conflict`. If readback cannot establish the outcome or protected state has changed, `outcome-unknown` remains unresolved. Every result sets `retryAllowed:false`; none is permission for a blind retry.

A normal acknowledged commit also requires readback before `applied-confirmed` is reported. If the durable receipt is absent or mismatched, complete-looking sidecar rows alone are not sufficient. A transaction rollback and a missing acknowledgement are not treated as interchangeable facts.

## Verification and practical limits

The focused protocol suite passed **10/10** on the final source. Independent binding/authority regressions separately passed **5/5**, including invalidation before and after baseline capture and forged archived selection provenance. These suites overlap in purpose and are not a hosted acceptance count. The protocol tests exercise actual proposed SQL and constraints in PGlite: atomic selected publication, exact no-write replay, three rollback checkpoints, committed lost-ack readback, unavailable readback, archived withdrawal and reader denial, artifact/source/inventory pin checks, unrelated financial-seal mismatch and forged archived reviewer/time rejection, invalidated/corrected current authority, wrong snapshot mapping and missing durable receipt. Protected originals remain intact. No fixture receipt or member is presented as a current hosted fact.

PGlite is useful local PostgreSQL-compatible execution evidence but does not by itself prove separate-connection concurrency, production lock behavior, remote network failure or actual Auth/canonical journal verification. The coordinator separately ran a standalone PostgreSQL reader/concurrency harness; its cases and scope must be reported under that harness rather than credited to this protocol suite. Separate-connection protocol concurrency, current private operator/catalog/role evidence and an exact reviewed activation package remain required. No storage/grant/schema/feed/scheduler/website change follows from this source implementation.


## Withdrawal after financial source correction

A withdrawal removes eligibility and does not reauthorize archived financial results. It therefore checks the exact archived version/body and selecting member/time, withdrawal member/time/reason, current protected-state fingerprint and durable receipt, but does **not** require the old financial version to remain supported. After financial invalidation or a changed financial head, an explicitly recaptured/reviewed protected baseline can support an exact source-correction withdrawal while publication of that old financial scope remains blocked. The regression invalidates financial evidence after committed publication, confirms the reader already withholds it, commits the append-only withdrawal under a fresh pinned baseline, and proves archive/original preservation and unavailable reads.

This recovery path still requires the original 48 supplemental rows to remain uninvalidated and exactly matched. Recovery involving an invalidated/replaced supplemental base itself is intentionally unsupported by this protocol and needs a separately reviewed policy; it is not silently treated as a permissible new base or replacement sidecar.
