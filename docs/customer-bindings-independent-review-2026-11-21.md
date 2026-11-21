# Customer bindings independent review — 21 November 2026

Scope: source inspection from local checkpoint `db43798`, including timestamp-fixed activation manifest and current activity reader, followed by the bounded correction below. No hosted catalog, source publication, application route, database operation or broad suite was run. Prior implementation/publication snapshots remain historical references, not approval for a new data action.

## Concrete defect found and corrected

The withdrawal compiler checked supplied `existingSelections` reviewer/time facts but discarded them from both its candidate hash and output. Changing a valid prior reviewer or selection timestamp could therefore produce the same candidate/package identity for a withdrawal. A receipt bound only to that identity did not bind the asserted prior-selection provenance used during validation. This was a reproducible preparation-contract defect, not a demonstrated hosted authentication bypass; the actual SQL still required an immutable selected base/version and a current member withdrawal reviewer.

The corrected manifest retains `existingSelectionPreconditions`, sorted by base snapshot ID. Each entry contains exactly:

```text
baseBodyHash, baseSnapshotId, sidecarVersionId, selectedBy, selectedAt
```

These validated preconditions are included in the candidate hash and final output, hence also in the package hash. The full prior-selection input set is retained, including an unchanged archived selection outside the withdrawn tuple when supplied. Reordering readback rows does not change the canonical result; changing actor, instant or base snapshot does. Previously supplied hosted-header assertions cease to match after any such change.

An eventual publication adapter must compare these preconditions with real selected-row readback in its transaction. Merely adding them to the hash does not authenticate a caller-supplied reviewer or prove that a database row exists. They must not be interpreted as a request to rewrite the selection.

## Other bindings inspected

- **Source and inventory:** actual storage/recovery/reader bytes are checked against supplied SHA-256 anchors. Exactly 48 protected envelope hashes and an explicit acquisition subset are required. Sidecar content hashes bind the original acquisition envelope, exact monthly financial version/revisions and activity source/count facts. The source revision's relationship to those bytes and the indexed live snapshot inventory still needs independent capture evidence.
- **Selection and withdrawal:** candidate selections name exact base/version mappings; selected content is not overwritten. Withdrawal names a previously selected exact version, member assertion, bounded time and enumerated reason. Same-base correction or automatic replacement remains unsupported. The new hashed preconditions close the discarded-prior-provenance defect.
- **Current authority:** the service defaults to the canonical history reader inside its membership-bound read-only repeatable-read transaction. It rechecks selected financial version/revisions, the original acquisition envelope/index/hash and exactly one explicit sidecar selection. Missing, changed, ambiguous or withdrawn evidence withholds activity; there is no latest-version fallback.
- **Security and output:** token verification occurs per call through the existing Auth verifier; validated request values are copied before asynchronous work. The service requires active-company membership before private reads and returns an activity-only whitelist. It does not return base payload, mature economics, reviewer identity, low-level SQL errors or raw customer identities. Dependencies injected in local tests are trusted test/server ports, not an unforgeable hosted authority proof.
- **Withdrawal visibility:** the service explicitly checks withdrawal storage in the same transaction and fails closed if that query/access is unavailable. Existing archived rows do not reactivate activity. A repeatable-read transaction already open before a concurrent change can legitimately complete against its earlier snapshot; next-transaction revocation and genuine multi-connection concurrency are separate acceptance cases.

No additional concrete reader privilege, cross-company, stale-authority or fallback defect was identified by this source inspection. This is narrower than a hosted security certification.

## Bounded regression receipt

Run from the repository root with existing locked dependencies and a Node runtime supporting TypeScript stripping:

```sh
node --experimental-strip-types --test \
  experiments/synthetic-company/customer-activation-manifest.test.mjs \
  experiments/synthetic-company/customer-bindings-independent.test.mjs
```

**12/12 passed:** seven manifest cases, including prior-selection provenance and canonical timestamp precision, plus five independent binding/protocol cases. Independent fixtures are purely fictional. They prove unchanged input data, deterministic readback ordering, changed hash identities for actor/time/snapshot substitutions and rejection of old hosted-header assertions after a changed precondition. The two actual-SQL independent cases additionally verify stale financial authority refusal and exact archived reviewer/time readback before withdrawal. They do not authenticate hosted headers or execute a hosted writer. These counts overlap earlier manifest receipts and must not be summed into a new broad-suite total.

## Publication-protocol defect, correction and independent checks

The draft publication protocol compared original seal bytes but did not independently ask whether that financial version was still current. An actual disposable SQL counterexample inserted a financial invalidation after capture: the draft reported `applied-confirmed` and wrote the sidecar/selection, even though the real activity reader withheld that source. This was a concrete publication-precondition defect, not merely a missing future acceptance checklist item.

The protocol owner corrected it with mandatory same-transaction `authority(tx, expectedHeader)` and `protectedState(tx, store)` ports, and an independently pinned protected-state hash. Each publication target is checked for current authority before writes, after writes and during readback. Withdrawal instead requires an independently captured fresh protected baseline and the exact archived base/version/selection facts, so a source-correction withdrawal remains possible after financial invalidation; it does not require that invalid financial result to become supported again. Withdrawal after invalidation of the original supplemental base itself remains unsupported. The fixture authority port verifies exact seal/company/period/revisions, absent invalidation and absent superseding version head; the protected-state port includes indexed original snapshot metadata and seal/invalidation/head/correction tables. A real adapter must still implement full current canonical authority and the independently reviewed protected scope; a function name or supplied fingerprint is not that proof.

The independent SQL regression now passes both variants: invalidation **before** the protected-state capture, which requires current-authority refusal despite matching captured fingerprints, and invalidation **after** capture, which the protected-state binding also refuses. No new sidecar row is left in either variant and retry remains disabled. A separate independent case publishes the valid fixture first, then supplies a different archived selection reviewer or time for withdrawal. Both produce conflict with no withdrawal; the actual restricted-role activity reader remains supported. Together these checks confirm that the newly retained manifest preconditions are consumed against actual immutable SQL rows, rather than merely included in a hash.

The protocol's `purpose: disposable-local-rehearsal` flag and injected ports are trusted caller assertions, not an unforgeable sandbox or hosted authority. Receipt storage and unknown-outcome readback use local test adapters. The independent tests use real PGlite schemas/queries plus explicitly artificial Auth and prepared financial-response fixtures. No hosted writer, least-privilege publication role or live receipt signature is certified.

## Multi-session concurrency source review

Inspected `customer-sidecar-concurrency.mjs` without rerunning it. Its fresh private Unix-socket PostgreSQL cluster, separate connections, membership-read snapshot barrier and independently observed unique-key lock wait support the coordinator's four reported cases: withdrawal, membership revocation, financial invalidation and duplicate selection. The actual activity reader runs under a non-superuser/non-BYPASSRLS read-only role. The already-open reader is expected to retain a coherent old snapshot; a subsequent transaction must observe committed denial. Duplicate selection waits and then fails uniqueness without replacing the first selection.

The script explicitly uses artificial Auth and a minimal seal/invalidation financial port. It does not demonstrate correction-head/full-journal recomputation, hosted credentials or source completeness. No additional concrete source defect was identified within those four claimed cases. The coordinator's PostgreSQL 17.6 **4/4** receipt is separate from this source review and the **12/12** bounded PGlite/pure tests above; it was not reproduced here.

## Minimal runtime attestation source review

Inspected the prepared attestation helper, four controlled SQL-port tests and proposal. The helper executes static SQL only, accepts no request SQL/identity/target fields and projects booleans plus a server-supplied build revision; errors are redacted. `targetProjectAttested` remains false. The proposal explicitly requires existing operator authorization and prior trusted target validation and does not equate database name `postgres` with a project identity. None of this proves an actual deployed process revision or effective grant/RLS graph.

A concrete SQL role-attribute omission was raised and corrected: the service-role unsafe expression had omitted `rolinherit`, despite the NOINHERIT baseline. It now includes that attribute. The helper owner added an actual PGlite regression showing an INHERIT service reports restricted=false and, after a local NOINHERIT change, reports restricted=true; session-login/project attestation deliberately remain false. The proposal source/test hashes were refreshed. This fixes the bounded role-flag observation; it does not establish an effective grant/RLS graph or create a public endpoint.

## Final combined bounded receipt

Coordinator-frozen code revision: `6d7d5e9b6f2411eef54152070328daa89e2858e3`. After the helper correction and final protocol recovery rule, **34/34 passed**, zero failures/skips/cancellations, in about 15 seconds: manifest 7, independent bindings 5, publication protocol 10, attestation 5, security 3 and activation rehearsal 4. This includes the earlier 12-case subset and supersedes the interim 33-case result taken before the helper's fifth test. Do not add overlapping receipts together. No broad domain suite, application build, browser run or remote operation was repeated.

```sh
node --experimental-strip-types --test --test-concurrency=1 \
  experiments/synthetic-company/customer-activation-manifest.test.mjs \
  experiments/synthetic-company/customer-bindings-independent.test.mjs \
  experiments/synthetic-company/customer-publication-protocol.test.mjs \
  experiments/synthetic-company/customer-runtime-attestation.test.mjs \
  experiments/synthetic-company/customer-sidecar-security.test.mjs \
  experiments/synthetic-company/customer-activation-rehearsal.test.mjs
```
