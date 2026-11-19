> **Next session:** The [tested hosted compatibility package](daily-feed-hosted-compatibility-2026-11-19.md) pins tested source 1168b0b2ae5fa2fe7211de64f9fcd2b5a675b439. It is published, not approved or deployed. Preparation is complete; the existing source remains disabled. Financial activation remains separately gated.

> **Applied continuation:** Revised disabled source 299998abfe61da90f55417111e565dbc065699b7 was approved and applied. Guarded schema/restricted login and private file delivery are complete; hosted acceptance is blocked by native secret-file layout and existing statistics-view access. Feed OFF, no financial writes. See the [current roadmap](roadmap-2026-11-19.md) for exact acceptance gates.

# Disabled staging setup — amendment, 19 November 2026

## Decision requested
Approve **only the remaining disabled Phase 1 setup** using revised source `299998abfe61da90f55417111e565dbc065699b7` and the managed-install SQL SHA256 `7c75f50255a074c48600548a0d8dcc6a80d2e6aa4ed3cb53ddaf0f40e8aa5480`. Update the **same existing separate cron**, not a second service. Financial history publication, programme enablement, enabled append commands, provider transactions and production remain excluded.

The earlier approval pinned c59ec2e. That exact revision has been deployed to the new disabled service and verified, but cannot complete the managed database installation as written. No database installation or credential creation was attempted live.

## Completed under the existing approval
- Created the separate synthetic cron, pinned to c59ec2ecb4f58f942f3839bd8c7ee455066c2c5e through an isolated release branch; automatic deployment is off.
- Hosted Linux build succeeded on Node 24.22.3. Deployment became live at 18:44 London on 19 November.
- One authorised disabled verification run completed successfully at 18:46 and returned `state=disabled, mode=inspect, connections=0`.
- Website/provider services were untouched. No database roles, schema, credential binding, financial row, seal or horizon changed.

The already approved service minimum and US$5 planning/monitoring budget are unchanged. No additional service, paid upgrade or increased compute is requested.

## Why the installation changed
The connected managed database administrator is not a superuser. PostgreSQL 17 gives such role creators a persistent bootstrap administration membership, without selectable/inherited access by default. The old installation fails an ownership transfer in the matching local rehearsal; its strict membership audit also classified the existing administrator as runtime access. The failure was reproduced in a fresh disposable database, not by retrying DDL on staging.

An ADMIN membership is management authority: the existing administrator can manage those roles. It is **not** a security boundary containing that administrator. The revised contract explicitly trusts and privately pins the existing database-administration identity, while keeping the separate runtime login restricted. No new superuser, BYPASSRLS, replication, CREATEROLE or broad data permission is granted to the runtime or function-owner roles.

## Exact revised behavior
1. Pin the existing installation administrator's identity/attributes privately. During one atomic installation transaction, permit only necessary ownership-transfer setup, perform the function ACL/ownership operations in the tested order, then remove discretionary self-SET and temporary function-owner CREATE rights before commit. Assert the exact remaining bootstrap ADMIN-only edges and absence of selectable/inherited installation access.
2. Separately audit every expected management membership, including the later runtime-login creator edge, with exact grantor, ADMIN true / INHERIT false / SET false. Reject unknown administrators or drift. Runtime remains exactly its reviewed invoker membership, ADMIN false / INHERIT false / SET true, with no direct table authority.
3. Preflight takes the explicit reviewed management identity as a third parameter; only that identity is separated from runtime privilege checks. It remains subject to its own exact audit. Unknown privileged roles remain in the runtime graph and fail closed.
4. Normalize policy-role names instead of internal numeric OIDs, enabling independently reviewed protection hashes across separately created databases. Do not replace expected hashes with target observations.
5. Explicitly distinguish shared session-pooler wire login from the bare verified database session role. Require the reviewed pooler DNS hostname, port 5432 and verified TLS; reject transaction-pooler mode, Unix-path disguises, mismatched roles and administrative runtime login. Actual hosted authentication remains a verification step.
6. Add a credential-free build probe that loads locked pg 8.20.0, asserts Node 24.22.3 and checks the disabled zero-connection default. Keep the start command disabled.

The original financial capability SQL remains byte-identical at SHA256 `5032e5afe139bc870aacec1ccd85d23e25c421cdf9ab350861fe1798cda5afb1`. Financial definitions and existing immutable material artifacts are unchanged.

## Verification
- The managed non-superuser PostgreSQL 17.6 installation and preflight integration passed, including injected post-ownership failure rollback, final ownership/ACLs, exact administration edges, runtime denials and rejection of unknown/selectable management.
- Final expanded regression group: 76 reported passes, zero failures/skips, including full 24-seal/original-January capability protection, effective privilege audits, recurring flow and stable cross-cluster policy pins.
- After final grantor/TLS tightening, 27 focused reported checks passed, zero failures/skips. These include enclosing/overlapping checks, not additional unique business scenarios.
- Runtime probe passed locally. The old hosted c59 disabled run is separately verified; the revised hosted build/pooler/binding is **not yet deployed or accepted**.
- Independent reviews found no remaining preparation blocker after correcting the pooler DNS/TLS validation. No live DDL or permission change was performed.

## Approved-action boundary to resume
After this amendment is approved:
- Pin and deploy the new exact revision to the same disabled cron, adding the build probe; verify the hosted driver/runtime.
- Refresh the data/metadata guards and independently pinned protection evidence. Apply only the exact managed installation if those checks agree; transaction failure means rollback and investigation.
- Create the restricted non-browser login and deliver its new credential only to the same service's private binding. Verify explicit management/runtime membership, file protection, TLS and read-only preflight. A target mismatch stops; no permission broadening or expected-hash substitution.
- Leave programme and append flags off. Do not publish the historical gap or any financial day.

Phase 2 stays separately unapproved. Its temporary historical bridge must also be rehearsed for this managed-administrator environment before any financial-write approval. The earlier superuser-fixture gap test is not a managed-target installation proof; its range/expiry must be refreshed when appropriate.

[Current roadmap](roadmap-2026-11-19.md) · [Original two-phase package](daily-feed-activation-package-2026-11-19.md)
