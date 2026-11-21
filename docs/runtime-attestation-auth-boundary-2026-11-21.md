# Runtime attestation authorization boundary — 21 November 2026

Source inspection only in the isolated runtime-attestation worktree. No hosted query, new access, configuration, credential inspection, implementation, deployment or commit is performed by this review.

## Existing reusable authorization

`experiments/shopify/reviewer-auth.mjs` already supplies an operator-level gate: `reviewerAuthenticator` verifies the bearer with the trusted same-project Auth client's `getUser`, requires a valid nonanonymous identity and returns only its ID. `prepareReviewWithReviewerToken` then starts a repeatable-read/read-only transaction and requires exactly one row from:

```sql
SELECT 1
FROM ingest_v1.review_authorizations a
JOIN public.store_memberships m
  ON m.store_id=a.store_id AND m.user_id=a.reviewer_id
WHERE a.store_id=$1 AND a.reviewer_id=$2
```

The first parameter must be the strictly validated exact store scope; the second comes from fresh verified Auth, never request metadata, reviewer IDs or decoded claims. An ordinary store member without the existing reviewer assignment is denied. Removing either current membership or reviewer assignment must deny the next transaction. No new assignment is implied.

`ingest_v1.review_authorizations` has the existing composite primary key `(store_id,reviewer_id)` and no expiry or one-use fields. It is an operator/reviewer assignment, not a freshly issued one-shot authorization receipt. Do not invent expiry, consent or single-use proof from its existence. The existing dedicated service source already requires SELECT on that relation at startup and uses it for preparation; a source implementation can reuse it without proposing additional grants. Actual current operator assignment and effective hosted permissions still require invocation evidence.

## Smallest concrete integration

Prefer the existing `/api/financial-reviews/prepare` protected read-only path over a new endpoint. Add a strictly validated opt-in attestation mode with no caller-supplied revision, database target, SQL, role, policy or identity fields. Preserve the existing preparation response and workflow when the mode is absent. A trusted server-only method is also acceptable if no safe HTTP exposure is needed yet.

For attestation mode, perform fresh Auth verification, then enforce repeatable-read/read-only mode before any query. In the **same transaction**, check the assignment+membership join and execute the attestation query on the same dedicated review adapter. Return only fixed match booleans and the trusted built revision. No candidate-review inspection or restore/write operation should execute in this branch; an absent imported candidate must not be mistaken for lack of operator authorization. Authentication/authorization failure precedes any diagnostic SELECT/result.

The standalone helper currently owns its own transaction. Do not authorize in one transaction and call `inspect()` in another, or nest the helper's transaction over a connection selected independently. Extract/reuse an internal same-transaction query routine or provide a trusted authorization callback that runs after transaction mode is set and before the attestation SELECT. Do not repeat SET TRANSACTION isolation after the authorization SELECT; PostgreSQL requires setting it before queries.

Startup composition must supply the existing target-validated dedicated database adapter and trusted built revision. `current_database()='postgres'` is not project identity. A caller boolean or submitted revision cannot satisfy target/revision authority. Keep the established helper's explicit target-project limitation unless trusted composition adds a separately reviewed proof tied to the same runtime.

## Exposure and timing

No new environment variable, credential, database permission or reviewer grant is necessary for offline wiring. Keep the diagnostic disabled/unexposed unless trusted composition explicitly enables the bounded operator path. If a fixed expiry or single invocation is required for deployment, encode an explicitly reviewed server-owned interval/operational receipt; the existing assignment table does not enforce those semantics. Do not manufacture a time window or persist one-use state through an unreviewed write.

The dedicated service has limited review-write capabilities for its existing workflow; it is not globally a SELECT-only role. The attestation's enforced read-only transaction is therefore a necessary boundary. Role checks alone cannot replace it. The diagnostic must never call restore, write audit state, change review authorizations or invoke dependency-mutating functions.

## Required implementation tests and remaining gate

Test verified operator success, ordinary member denial, reviewer without membership denial, revoked membership/assignment on next call, wrong-store scope, malformed/forged identity/revision/target mode fields, fresh Auth failure, disabled diagnostic, wrong target/revision, same-transaction ordering, read-only enforcement and safe fixed errors. Preserve normal prepare/restore behavior when attestation mode is absent. Rehearse with an effective restricted role and ensure raw names/rows/tokens/errors never appear in output or logs.

No source-level authorization impossibility remains: existing assignment plus membership is sufficient for a bounded read-only operator diagnostic. The unresolved runtime fact is whether the currently signed-in authorised operator has that assignment for the exact target store and the deployed process uses the expected connection/revision. The existing protected invocation can prove or deny that without expanding access. If denied, report the exact missing assignment/permission gate; do not create or widen it. A tested concrete integration revision and the bounded staging deployment/one-invocation decision are still required before any live claim.
