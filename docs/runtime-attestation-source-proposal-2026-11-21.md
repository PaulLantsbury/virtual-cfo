# Temporary runtime attestation source proposal — 21 November 2026

Prepared source integration only; no deployment, credential/environment change, grant, assignment or business write performed. The shared website components and App routes are unchanged. The existing review runtime and its validated reporting connection remain the only database path.

## Existing protected path and trusted composition

The existing `POST /api/financial-reviews/prepare` accepts an additional exact optional body `{scope:{storeId,from,to},runtimeAttestation:true}`. It creates no new endpoint. Normal prepare/restore contracts remain unchanged. The optional branch rejects extra body fields, query parameters, malformed bearer headers and oversized bodies, and projects only the diagnostic contract/state, validated compiled revision and eight booleans. Tokens, role names, usernames, connection strings, raw catalog rows and SQL errors are never returned.

Runtime composition captures the same `reviewDatabase(pool)` and Auth client already used by history/supplemental reporting, after the existing project/Auth URL/database endpoint/TLS checks and restricted-role startup readiness succeed. The source revision comes only from `compiledDeploymentRevision()` and its build-time definition. There is no request or environment revision override.

The source mode accepts any valid complete closed-month scope for which the freshly authenticated user has **both** an existing `ingest_v1.review_authorizations` assignment and current store membership. It does not create an operator or require an assignment on a newly hardcoded synthetic company. Runtime facts concern the process/pool; no selected business figures are read.

Fresh existing Auth verification precedes one repeatable-read, read-only transaction. That transaction sets a 2-second statement timeout and 3-second idle timeout, performs the joined assignment/membership check, synchronously claims the single diagnostic attempt, then reads the catalog facts. An internal transaction primitive avoids executing a second isolation change after the authorization SELECT. The original helper's standalone behavior remains tested. There is no authorization-to-second-connection gap.

The public target-project boolean is true only when trusted composition carries the exact existing Night Scout project reference after runtime target validation. A matching `current_database()` value alone cannot attest a project. Unbundled source has no trusted compiled revision and cannot produce a successful attestation through normal composition.

## Default-off integration and concrete enable candidate

Both the diagnostic library policy and the app-owned `artifacts/api-server/src/lib/runtime-attestation-release.ts` switch default to false. Shipping this default-off source does **not** produce the missing live runtime evidence.

The reviewed source window is fixed: **21 November 2026, 16:00–18:00 UTC**, with an additional **five-minute process lifetime** from service construction. Expiry is exclusive. Removal is due at 18:00 UTC. Only one authorized attempt is admitted per runtime service/process; an error after the claim consumes it. Ordinary non-operator members do not consume the attempt. This is not a global or durable single-use guarantee: restarts and multiple workers have separate state. No persistent latch or assignment change is introduced.

After source integration review, the coordinator may prepare a **separate exact enabled candidate revision** changing only:

```diff
-export const RUNTIME_ATTESTATION_RELEASE_ENABLED=false;
+export const RUNTIME_ATTESTATION_RELEASE_ENABLED=true;
```

The library remains default-off; existing environment values and privileges remain unchanged. That candidate needs its own actual tests/build receipt, exact commit approval, existing staging target check and immediate bounded operator read. Do not deploy a disabled candidate and describe it as attested. If the 18:00 window expires, an enabled old candidate remains unusable; a new window requires a new reviewed source revision rather than a clock override or environment workaround.

After the observation, restore the app-owned switch to false and remove the temporary opt-in route branch, runtime attachment and diagnostic source in a reviewed cleanup. Expiry disables successful use automatically but does not delete source code. Preserve the redacted receipt separately from private operator evidence; never log bearer tokens or raw role/catalog rows.

## Evidence and limits

Focused helper tests include actual disposable PostgreSQL-compatible role checks. Service tests verify default-off behavior, ordinary-member/nonmember denial, a single authorized read-only transaction, timeout settings, process/absolute expiry, no open-month/extra-field acceptance and actual local SQL ordering after authorization. Source/API typecheck passed during preparation. Independent route/security tests and final full workspace build are separate coordinator receipts.

These local tests use explicit Auth/connection fixtures. They do not establish a live operator assignment, runtime role membership, project identity or current reporting authority. No live attestation is claimed until the enabled exact revision is deployed under its reviewed boundary and the existing authorized operator actually receives the redacted result. This feature observes existing privileges; it cannot repair failed checks by adding a grant, role, assignment or alternate connection.
