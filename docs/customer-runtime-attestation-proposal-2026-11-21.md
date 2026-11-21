# Minimal runtime attestation proposal — 21 November 2026

Prepared helper and tests only. No runtime integration, route, configuration, deployment, new connection, environment/credential inspection, database mutation or live invocation occurred.

## Exact source package

| File | SHA-256 |
| --- | --- |
| experiments/synthetic-company/customer-runtime-attestation.mjs | 66d9a3a589c7f738760124b666ad87d911684072441d2b6416f9d5171b1fb82a |
| experiments/synthetic-company/customer-runtime-attestation.test.mjs | 65f54d738cf137e12023c90ded710552e2f896e59c72235ce9cad717d39fc951 |

`createCustomerRuntimeAttestation(existingReviewDatabase,{trustedRevision})` receives only server-owned composition dependencies. Its no-argument `inspect()` executes one enforced repeatable-read/read-only transaction and one SELECT through the existing adapter. The adapter already selects the expected service role. The helper compares session login, effective role, database name, unsafe role attributes and transaction settings against source-pinned expectations. Output contains fixed contract/state, trusted built revision and match booleans; no role names, rows, tokens, SQL diagnostics or credentials escape. Database failure yields generic unavailable with false checks.

Five tests passed: four controlled SQL-port cases and one actual disposable PGlite role case. The latter executes the real SELECT under the expected service role, rejects INHERIT and accepts NOINHERIT while keeping session-login and project matches unasserted. Independent review identified the missing service inheritance check; the helper now includes rolinherit among unsafe service attributes. Port cases cover mismatched roles/unsafe attributes, transaction mismatch, ambiguous rows and private-error suppression. No test establishes a running hosted process or live project/session identity. There is no new real-process attestation receipt.

## Mandatory trusted prerequisites

This module is not authentication or target validation. It must only be composed **after** the existing dedicated runtime validates its project/Auth/database endpoint and after an existing operator/readiness authorization boundary admits the invocation. The revision must come from trusted built application composition, never a request body/header/query parameter. A caller-supplied `targetValidated=true` would prove nothing and is deliberately not accepted.

`current_database()='postgres'` does not identify a Supabase project. Accordingly `targetProjectAttested` is always false in the helper result. The final operator receipt must separately bind the current revision, existing validated target match and actual helper invocation to the same process. A bare helper result without that trusted linkage cannot satisfy the project-attestation gate. Avoid exposing target bindings or private names in public response/log output.

## Concrete next source and live actions

1. Compose this exact helper behind a **separately reviewed access-controlled operator readiness boundary**, using the same dedicated reviewDatabase object as the reporting services, trusted built revision and existing target-validation outcome. Do not create an unauthenticated public endpoint, another credential, another database connection or generic SQL facility. There is no dedicated review-runtime operator diagnostic path installed today. Existing Xero merchant-readiness routes serve a different purpose and must not be reused to expose this diagnostic. Reuse established bearer verification mechanisms where applicable, but require explicit operator authorization rather than treating arbitrary store membership as operator permission. No route is changed by this proposal.
2. Add route/composition authorization tests: denied operator, forged request revision/target claims, disabled review runtime, wrong target, failed role match, safe result projection and unchanged business records. Review the concrete integration diff and its exact revision.
3. Present a bounded website/runtime-only review of that tested immutable integration revision. Explicit actions would be deploying it to the existing staging web service and making **one authorised readiness invocation**, with a private receipt tying deployment/process revision, previously validated target and returned booleans together. No schema, grant, data publication, scheduler or provider action is included.
4. Observe the invocation through existing authorized operator access; keep only booleans/revision in normal reporting. If any match fails, preserve the failure and investigate before changing access. No retry/credential repair or grant widening is implied.

This is a concrete integration/one-invocation plan, not executable deployment approval. No generic permission question or new hosted change is issued here. Existing source publication permission remains separate from deploying the not-yet-built integration. The exact missing work is wiring and authorization evidence, then bounded deployment/invocation review; no operator needs to reveal connection strings or role secrets.
