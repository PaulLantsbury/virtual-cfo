# Restricted Shopify candidate intake: acceptance boundary — 17 September 2026

This review covers the prepared staging intake package. It is not permission to apply it, evidence of live database deployment, or certification of financial completeness. The coordinator records final test results and application status in the session handover.

## What the first exercise can prove

The observed PocketLaunchpad1 order and partial refund are genuine Shopify development transactions with `test=true`. The agreed mapper excludes the order as `TEST_ORDER`, including its refund, before financial event construction. The first staging exercise may retain this source as a private, unverified candidate and demonstrate unchanged replay, identity validation and separate permissions. It must produce no actual sales or financial coverage certification.

`importFirstEvidence` currently requires a supported mapping with no exclusions and at least one event. An all-test candidate therefore cannot enter that importer. Do not weaken this guard or provision finance-import access merely to make this exercise populate the financial-review screen. Missing imported evidence remains unavailable; it is not a verified zero. A future independently justified empty-period reporting mechanism or synthetic nonzero demonstration is a separate decision.

## Required privilege boundaries

- One fixed new development-store UUID, distinct from synthetic Store D; exact Shopify Shop ID/domain, GBP and Europe/London must agree before recording.
- Dedicated candidate role and private login. No ownership, elevated role membership, RLS bypass, schema creation, browser grants or inherited importer/reviewer capabilities.
- Store-scoped SELECT and INSERT on candidate batches, heads and source versions. UPDATE limited to batch supersession, current head/recheck and source version/fingerprint columns. No deletion or modification of retained payloads, store identities, scope columns or certification fields.
- Invoker invalidation triggers retain only the SELECT and column UPDATE permissions required to withdraw this store's coverage. Coverage RLS must allow setting completeness false and forbid true. No evidence insertion, coverage identity/date edits, review-authorisation edits or review audit writes.
- The store lock must serialize with the existing row-lock recorder. A narrow SECURITY DEFINER helper must have a fixed search path, qualified relations, a non-caller-controlled store allowlist, no caller-controlled dynamic SQL, and no PUBLIC/browser execute grants. Do not grant general store UPDATE merely for `FOR UPDATE`.
- A configurable runtime check supplements database enforcement; it cannot substitute for RLS. Review effective PUBLIC grants, function execution and inherited roles, not just the new GRANT statements.

## Acceptance checks before application

Use disposable PostgreSQL under the actual restricted role and, for concurrent claims, separate real connections. PGlite or mocked queries alone cannot establish multi-connection lock behavior.

1. Correct candidate is recorded unverified; exact repeat is replay without duplicate; historical replay cannot restore superseded heads.
2. Changed sources withdraw matching-store verified coverage and mark recheck; missing/conflicting history is refused safely; stale history cannot supersede accepted content.
3. A late write failure rolls back batch, head and version mutations together. Concurrent same-store requests serialize, and a lost acknowledgement is handled by explicit idempotent retry.
4. Cross-store reads/writes and lock requests are denied. Attempts to edit the store, source orders/refunds, financial event evidence, retained batch payloads, review rights or completeness true are denied.
5. The lock helper cannot be invoked by ordinary browser roles or used to select arbitrary store data. Trigger calls work with only the intended role privileges.
6. Private connection configuration rejects the production project, wrong login/store/source identity and insecure TLS. Statement/connection/transaction waits are bounded. No secret or raw source payload is returned in operator receipts or logs.
7. Live setup remains unapplied until the exact store/role/login/policy changes and first candidate-only exercise are approved. Membership/reviewer assignments are optional separate access changes, not prerequisites for recording a candidate.

Do not describe the package as end-to-end financial import, reviewed reporting, permanent connection health or production readiness. Record any unexecuted checks as limitations.

## Independent code review checkpoint

Reviewed the proposed SQL, optional recorder lock hook and private intake runtime. The SQL uses the same store row lock, fixed target and search path; column grants isolate retained payloads and certification; it refuses setup when required RLS is disabled. Review feedback added startup checks for forbidden column-level writes, unexpected role memberships and inherited service authority. Candidate receipts explicitly state `financeImported: false` and never return retained payloads.

No remaining design blocker was found for keeping this as an unapplied, candidate-only preparation package. Permission tests use disposable PostgreSQL-compatible PGlite; they must not be presented as proof of concurrent remote connections. Before live application, confirm the current staging inventory and effective PUBLIC/default privileges, provision only the reviewed private login, and record the separate-connection lock test result or retain it as an explicit gate. This review does not approve database application or weaken the all-test finance-import guard.

### Live catalog and concurrency follow-up

The coordinator's read-only staging inventory confirmed RLS on all five target tables, no existing intake service/login, no PUBLIC table ACLs in the relevant public/ingest/finance schemas, and no PUBLIC policies. Existing policies name authenticated/review/import roles. This narrows the preflight uncertainty; it is not an application result. The coordinator subsequently inspected invalidation successfully using the existing restricted review role. Retain baseline function/ownership verification in the administrator preflight.

No standalone PostgreSQL executable was found on PATH, in the bundled Codex runtimes, `/private/tmp`, `~/.local`, or a Homebrew/Postgres.app installation during this check. No tools were installed. The existing `experiments/shopify/restoration-concurrency.mjs` harness requires `NIGHT_SCOUT_TEST_PG_BIN`; the new intake helper has therefore **not** been tested with independent connections.

The remaining contention gate is precise: in a disposable real PostgreSQL cluster, apply the new proposal; use two sessions under the restricted intake role and an independent observer; pause the first after its store lock, then prove the second waits on a lock. Commit the first and require the second to return replay with a single batch/head; repeat with first-session rollback/disconnect and require exactly one successful retained candidate. Finally prove the original recorder's `FOR UPDATE` and the helper contend on the same row, and explicitly retry after a lost success acknowledgement. Use only generated synthetic fixtures. The proposed private login permits two connections for the rollback-only staging lock check; normal runtime pools remain limited to one connection. This restriction is not a substitute for the broader interoperability test.

### Prepared rollback-only staging lock gate

`experiments/shopify/intake-lock-check.mjs` exports `checkIntakeStoreLock(config, {createPool, confirmTarget})`. It requires the existing strict private staging intake configuration and explicit `bioalckltvkhlczusdvl/56d92f8a-746e-4b4f-b408-81fc98c4aa17` acknowledgement. After approved provisioning, it opens two restricted connections, holds the first store lock, requires the second to fail with PostgreSQL lock timeout `55P03`, rolls back the first, and proves the second can then acquire the same lock. Both sessions are rolled back and closed; it inserts no rows. Its mock sequencing/error/cleanup tests passed (2 tests); the live check has not run.

Run this before recording the first candidate. Passing proves same-helper row-lock contention and release, not candidate replay across concurrent requests, disconnect recovery or original-recorder interoperability. Those remain the broader independent-connection checks above.


## Coordinator application checkpoint

Paul subsequently approved application. Dedicated staging readiness, two-connection lock/release check, candidate recording and unchanged same-batch replay passed. One test-order/refund source remains excluded, zero financial events, coverage false, other-store fingerprints unchanged. See [live result](shopify-intake-package-2026-09-17.md). This supersedes earlier pending narrow live-lock/setup gates; the wider concurrency/recovery matrix remains outstanding.
