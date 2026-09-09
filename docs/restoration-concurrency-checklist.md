# Restoration concurrency checks — required before staging

Status: not executed. Existing PGlite tests exercise transactions but cannot establish independent PostgreSQL session contention. Use a disposable local PostgreSQL database with only committed synthetic fixtures and proposals; never run the bootstrap against existing Supabase or production data.

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
