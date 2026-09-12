# Restoration concurrency checks — required before staging

Status: seven isolated PostgreSQL 18.4 multi-session cases passed on 9 September 2026. The 52 PGlite/source/auth tests also pass. A deliberately forced deadlock and production throughput remain untested. Use a disposable local PostgreSQL database with only committed synthetic fixtures and proposals; never run the bootstrap against existing Supabase or production data.

Use separate database clients for writer, reviewer and observer. Coordinate with explicit transaction barriers and lock-state observations, not arbitrary timing sleeps. Capture final committed coverage, audit count and RPC availability in each case.

| Case | Required observation |
| --- | --- |
| Writer changes raw order before review acquires locks | Review waits or times out. After writer commit, the old snapshot is rejected; coverage stays incomplete. |
| Review holds locks; writer attempts source/evidence change | Writer waits. After review commits, writer's commit invalidates restored coverage; no stale verified result remains after both commits. |
| Two reviewers submit the same snapshot | One succeeds; the second waits then rejects the changed snapshot. Exactly one audit row. |
| Reviewer permission revoked before locks are acquired | Membership/authorisation is reread after lock acquisition; revoked reviewer cannot restore. |
| Writer rolls back while reviewer waits | Reviewer may proceed only if the reviewed snapshot still matches; no abandoned writer values reach the audit. |
| Lock timeout or deadlock | Review transaction aborts with no partial audit/coverage change. Surface failure; never silently replay approval. |
| Another store is being read during restoration | Ordinary reads continue. Document that writes to other stores are temporarily blocked by the prototype's global table locks. |

Before enabling a route, also verify the service role has only necessary table permissions (no audit mutation or raw-data truncation privileges), the Supabase Auth client and database target the same environment, and the route authenticates and authorises review preparation as well as restoration. Map internal errors to safe responses and enforce request limits. Add bounded Auth request cancellation/timeouts in client provisioning. Reviewer provisioning remains an explicit administrator action.

## Executed harness and repeatability

`experiments/shopify/restoration-concurrency.mjs` creates a fresh temporary cluster, disables TCP listening, connects only over that cluster's private Unix socket, loads shared synthetic fixtures and removes the cluster after shutdown. It never reads DATABASE_URL or connects to an existing server. The test reuses the real restoration helper and the existing verified-sales RPC/adapter.

Run `pnpm run test:restoration-concurrency` with `NIGHT_SCOUT_TEST_PG_BIN` set to the absolute directory containing standalone `postgres`, `initdb` and `pg_ctl` binaries. The harness observes `pg_stat_activity` lock waits through a separate client before releasing each transaction barrier. Seven cases cover committed/rolled-back competing writes, writes to raw data or evidence after reviewer locks, duplicate approvals, permission revocation and the actual five-second lock timeout. Every case checks audit count, committed coverage and the member sales reader; another store remains readable. No automatic retry is used.

For this run, standalone Darwin ARM64 PostgreSQL 18.4 binaries came from [embedded-postgres](https://github.com/leinelissen/embedded-postgres), package `@embedded-postgres/darwin-arm64@18.4.0-beta.17`. The downloaded archive matched its registry SHA-512 integrity. Binaries were kept outside the repository in a temporary test folder; no application dependency or lockfile change was needed. The environment required shared-memory permission outside the command sandbox. This tests PostgreSQL 18.4 semantics and synthetic data, not the exact live Supabase configuration, a deployed service role or production load.
