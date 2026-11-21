# Temporary runtime attestation candidate review — 21 November 2026

This is a concrete source candidate, not deployment or diagnostic approval. No hosted configuration, grant, assignment, database record, provider or feed was changed. Existing source publication permission is separate from the next deployment/invocation decision.

## Exact baseline and revisions

Baseline: `3eda388d534b820728172e0edb7ab9b51d0cc3ad`, the accepted live website release. Its public Git object was fetched without credentials and verified against tree `0374ce28afb8c259117818498d73e915f13dc6df`. The isolated source worktree starts at that exact baseline. No frontend page/component/App file, business calculation, provider, scheduler, deployment setting or lockfile is changed.

Default-off implementation checkpoint: `2914a41b18fd6d4f2466d70f65f699fd82372eba` locally. The immutable public default-off integration and its separately enabled one-line candidate are reported by their publication commits. File hashes in runtime-attestation-source-manifest-2026-11-21.json bind the reviewable implementation; public commit metadata may differ while source bytes match.

The enabled candidate must differ from the default-off integration in exactly one line of artifacts/api-server/src/lib/runtime-attestation-release.ts: false becomes true. The diagnostic library itself remains default-off. Do not deploy the inactive integration and describe the missing process evidence as obtained. Neither revision has been deployed by this batch.

## Existing access and exact request

Only the existing POST /api/financial-reviews/prepare path is reused. The diagnostic branch accepts exactly:

```json
{"scope":{"storeId":"<existing-authorised-store-UUID>","from":"2026-10-01","to":"2026-10-31"},"runtimeAttestation":true}
```

The existing authorized client must supply its normal verified bearer internally; no token should be copied into chat, source or logs. No diagnostic button or new browser workflow is added. A live invocation must use an existing secure operator API mechanism; if none is available, establish that explicit invocation gate before deployment rather than extract a browser token. The example store placeholder is not an identity or approval.

Fresh same-project Auth verifies a nonanonymous user. A single repeatable-read/read-only transaction requires an existing reviewer assignment AND current store membership for that exact store before querying diagnostic metadata. Ordinary members, removed assignments/memberships and wrong-store callers are denied; no new assignment or grant is created. Any complete closed month is permitted for an already-authorised store; no new synthetic-company operator is assumed. No candidate-review, restore, audit-write or business-data read executes in this branch.

The same existing dedicated pool and Auth client as history/supplemental reporting are reused. Frozen startup configuration binds the validated project reference to the actual database configuration, rather than rereading mutable request/environment claims later. Revision comes only from the existing compiled build constant. Runtime target validation and role startup readiness finish before attachment. No new credential, connection, environment flag or runtime revision override is introduced.

## Bounds, output and lifetime

- Existing parser body limit16KB and bearer limit8192 characters remain. Extra diagnostic body/query keys, caller revisions/targets/operators and malformed input are rejected.
- Existing Auth fetch is bounded to5seconds/full-body64KB with redirects refused. Existing pool is max3 with5second acquisition timeout; diagnostic statements use2second statement timeout and3second idle-in-transaction timeout.
- Each attempt executes exactly two parameterized/fixed SELECTs: current assignment+membership, then fixed session/role/database/transaction metadata. Isolation is set before queries, once. No generic SQL or caller-chosen identifier exists.
- HTTP output is projected to contract/state, trusted revision and eight booleans only; cache is no-store. Raw role names, account IDs, target URL, credentials, tokens, rows, SQL diagnostics and nested/coerced state objects are withheld. Expected successful evidence is state=observed, the exact enabled deployed revision, and all match booleans true. Any false/unavailable/mismatched value blocks the gate.
- Source window:21 November2026,16:00–18:00UTC, expiry exclusive. Each process has at most five minutes from service construction and one authorised attempt. Claim occurs synchronously after authorization; failure after claim consumes it. Results crossing expiry, including during Auth/query/commit, are withheld.
- Single use is **per process**, not globally durable. Multiple workers or restarts have separate state. This limitation is explicit; no durable latch or database write is added. Do not restart or auto-retry to rearm an attempt under this review.
- At18:00UTC successful use disables automatically. Physical removal requires a reviewed cleanup restoring the release switch tofalse and removing the temporary branch/attachment/source. Expiry does not delete code. A different window needs a newly tested immutable source revision; no clock or environment workaround is allowed.

## Validation

Frozen default-off source passed37/37 focused tests: five existing review HTTP cases, two startup cases, nine independent security cases, nine existing runtime cases, four diagnostic service cases, five helper cases, two shared-pool hook cases and one history composition case. Zero failures/skips. These are fictional local HTTP/Auth/database fixtures, including actual PGlite ordering, restricted-role, expiry, concurrent one-attempt and safe projection checks. They do not prove hosted identity or current operator assignment. An earlier full workspace typecheck/build passed; final API typecheck passed after review fixes. The separately enabled candidate receives its own final test/build receipt and compiled-revision readback before handoff.

Review fixes included in-flight expiry suppression, primitive state output validation, service INHERIT rejection and single-transaction SQL ordering. See runtime-attestation-independent-security-review-2026-11-21.md and runtime-attestation-auth-boundary-2026-11-21.md. Earlier data package34/34 plus PostgreSQL concurrency4/4 receipts are separate, overlapping scopes and are not added to37.

## Bounded next decision and stale-baseline protection

The eventual decision is deployment of the exact tested enabled source to the existing staging web service, plus one authorised read-only diagnostic request within five minutes of startup and before18:00UTC. No database installation, grant, assignment, sidecar publication, financial write, provider/feed/scheduler action or environment change is included. This document does not request that decision before the enabled revision and invocation mechanism are reviewable.

Deployment would replace the staging web service build, including an unchanged frontend rebuild; it is not merely source publication. Before any request, confirm the then-current live/approved source still equals this baseline or reconcile any later approved design/Cash changes into a new tested candidate. Do not overwrite later approved work or deploy the data branch as a website. Existing configured branch, auto-deploy and service settings must remain unchanged. A lease mismatch, expired window, absent secure operator client or denied existing permission blocks the action; it is not permission to add access, restart or repair configuration.

The data package remains nonactivated. The corrected legacy receipt is immutable at https://github.com/PaulLantsbury/virtual-cfo/blob/1407e47299b6b10329d92a8227a82602f9e26ee2/docs/hosted-release-receipt-2026-11-21.md : unsupported acceptance-key filtering did not establish a redirect defect. No alias/website design fix is part of this candidate.
