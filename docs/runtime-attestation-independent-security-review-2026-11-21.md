# Runtime attestation independent security review — 21 November 2026

Source candidate only, isolated from the exact live-matching starting tree. No deployment, hosted invocation, credential/configuration inspection, role/grant operation or source publication is part of this review. Implementation and test receipts below are recorded only after the concrete candidate is available.

## Required protection and threat cases

| Boundary | Independent acceptance case |
| --- | --- |
| Existing protected path | Reuse financial-review protection rather than add a public/generic SQL route. Existing review prepare/restore contracts remain compatible. Disabled/unwired composition returns unavailable and does not inspect roles. |
| Identity | Verify the bearer token with Auth on every protected invocation. Missing, anonymous, invalid or upstream-failed authentication produces a fixed safe error, with no role-catalog query. Request claims never supply a user/operator identity. |
| Current authorization | Require both current store membership and the existing explicit reviewer/operator authorization. An ordinary member without that row must be denied. Removed membership or operator authorization must be rechecked after any earlier capability is minted. |
| Capability lifecycle | If composition uses an in-process inspection capability, require exact user/store/runtime binding, bounded expiry, exact-expiry refusal and one use. Reject fabricated/cloned/other-runtime handles. Concurrent attempts must not perform two inspections. A consumed/failed attempt must not be silently rearmed. These are local capability facts, not a newly persisted authorization or grant. |
| Trusted target/revision | Existing dedicated runtime target validation must precede attachment. A request targetValidated flag, project string, database name or revision must not mint target authority. The revision comes from immutable server build composition; wrong/disabled runtime must fail closed. |
| Transaction and SQL | Use the existing dedicated review database/role with read-only repeatable-read semantics. Recheck authorization inside the protected transaction before bounded static inspection. No request SQL/identifier interpolation, new connection, unbounded response, data mutation or grant is permitted. |
| Safe projection | Return only a fixed contract/state, declared built revision and documented booleans. Poisoned dependency output must not leak raw roles/rows, credentials, target endpoints, SQL, tokens, authorization handles or low-level error text. A false role/transaction check remains false. |
| No expanded claims | A matching database name is not project identity; a supplied revision is not proof of deployment. Restricted direct role flags are not an effective grants/RLS graph. No Auth/provider acceptance or installed-process receipt follows from artificial test ports. |

## Existing baseline observations

The starting app already protects `/api/financial-reviews/prepare` and `/restore` with bounded JSON parsing, bearer shape checks and fixed errors. Its reviewer prepare service verifies Auth, then joins `ingest_v1.review_authorizations` with current `public.store_memberships`. Ordinary reporting membership is therefore a weaker boundary and must not be substituted for reviewer/operator authorization.

`reviewDatabase` uses the dedicated pool and `SET LOCAL ROLE night_scout_review_service`; dedicated startup validates target/Auth/database configuration and initial permissions. These existing checks should be reused. Neither an extra public endpoint nor a new SQL grant is necessary merely to observe bounded role/transaction booleans. Current Xero provider/bootstrap authorization remains separate and must not be repurposed as synthetic customer reporting authority.

## Candidate and concrete corrections reviewed

The candidate reuses the existing protected financial-review preparation route through the exact additional body `{scope, runtimeAttestation: true}`. It does not add a public diagnostic endpoint. The old `{scope}` preparation and restoration contracts remain separate. The attestation branch rejects query parameters and extra body revision/target/operator claims, uses branch-specific output validation/projection and fixed errors, and keeps `Cache-Control: no-store`.

Server composition uses the existing validated dedicated runtime and compiled build revision. The source release policy defaults off, with a fixed 16:00–18:00 UTC window on 21 November and a five-minute lifetime from the service instance's creation. One authorised diagnostic attempt consumes that process-local service's slot; it is **not durable or globally single-use across replicas/restarts**. Existing reviewer assignments themselves have no new expiry/consumption semantics and remain unchanged.

The independent review identified two service issues and added concrete regressions: an initially malformed store UUID regex denied normal valid scopes, and a diagnostic that started within the window could return after process/absolute expiry. Both are corrected. The service now checks the valid window again after the awaited catalog inspection and suppresses a late result; the claimed attempt remains spent. The coordinator separately identified an output-coercion issue: a non-string state object could stringify to `observed` and then leak nested fields. The route now requires a primitive allowed state, and the independent HTTP regression verifies generic refusal with no nested secret output.

Authorization and inspection run in one read-only repeatable-read transaction. A transaction-level inspection primitive avoids trying to reset isolation after the operator/membership SELECT. The service applies local two-second statement and three-second idle-transaction bounds. No new pool, persistent setting, role/grant or request-selected revision/operator is introduced.

## Independent execution receipt

`artifacts/api-server/tests/runtime-attestation-independent.test.mjs`: **9/9 passed**, zero failures/skips/cancellations, about 4.55 seconds. Cases cover:

- Actual disposable PostgreSQL/PGlite operator-assignment plus current membership, one transaction/one isolation SET, exactly two bounded static SELECTs and safe output.
- Ordinary members and removal of operator/member rights after Auth but before the protected transaction; no catalog read on denial.
- Default disabled state, exact process/window expiry, concurrent calls, failed authorised attempt consumption, expiry during Auth and expiry while catalog work completes.
- Real temporary loopback HTTP routing: strict body/query target/revision/operator refusal; old preparation compatibility; poisoned dependency extra-field suppression; non-string state object refusal without nested secrets.

Auth is an artificial responder. Actual local SQL uses only disposable fixture memberships/assignments and a restricted role; its session login and fictional target deliberately do not claim the hosted process/project. The helper's role/transaction query, existing reviewer join and HTTP projection are exercised directly. No hosted operator/JWT, installed revision, live target, durable global one-use, effective hosted permission graph or real readiness invocation is certified. Local test SELECT grants are fixture setup only. Temporary servers and databases close in test cleanup.

Run with existing locked dependencies and a Node runtime supporting TypeScript stripping:

```sh
node --experimental-strip-types --test \
  artifacts/api-server/tests/runtime-attestation-independent.test.mjs
```

The HTTP cases need permission to bind temporary loopback sockets; they use no external network or existing browser session. This receipt is independent of the implementation owner's helper/service/legacy regression totals and must not be added to overlapping cases as a new end-to-end acceptance count.

## Remaining bounded review boundary

Before a staging-only runtime decision, freeze the exact tested source/build revision, retain the default-off/removal policy or explicitly enumerate a reviewed enablement change, and verify existing operator access. Deployment and any one authorised invocation require their own concrete revision-bound review; no source test provides that approval. A real invocation must bind the returned build revision, prior trusted target validation and effective runtime observations in one private operator receipt. False role/transaction checks are evidence to investigate, not permission to widen grants. No customer sidecar activation, data write, provider retry or schedule change belongs to this package.
