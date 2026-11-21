# Customer concurrency and next bounded action — 21 November 2026

## Executed multi-session rehearsal

`customer-sidecar-concurrency.mjs` creates a fresh temporary PostgreSQL cluster, disables network listening and connects only through its private Unix socket. It never reads DATABASE_URL, hosted secrets or a pre-existing database connection. It cleans up the cluster on completion. PostgreSQL17.6 was used, matching the live major version but not certifying exact hosted configuration. Local shared-memory permission was needed; no hosted access was widened.

Four cases passed with actual storage/withdrawal SQL and the activity reader:

1. A committed withdrawal during an already-open reader snapshot left that snapshot coherent; the next transaction withheld activity.
2. A committed membership removal during a snapshot left the old result coherent; the next transaction denied membership.
3. A financial invalidation committed during a snapshot was seen by the next transaction, which withheld activity.
4. Two independently connected owner transactions tried the same selection. An observer verified the second waited on a lock; after the first committed, the second failed the unique constraint. Exactly one selection remained.

All cases preserved fingerprints of 48 original records, financial seals and an unrelated-company fixture. Auth remains artificial; the canonical fixture port checks a seal/invalidation relation, not full retained-journal arithmetic. Cash bodies are integrity placeholders. These are local PostgreSQL semantics and restricted-role reader checks, not hosted identity, cash arithmetic or source-completeness certification. The script is not a publication executor.

```sh
NIGHT_SCOUT_TEST_PG_BIN=/absolute/path/to/standalone/postgres/bin \
node --experimental-strip-types experiments/synthetic-company/customer-sidecar-concurrency.mjs
```

## Additional read-only access observation

A bounded recursive role-membership SELECT started only at the source-pinned review login. Exactly two roles were reachable via SET, with zero unexpected roles. In the three scoped review/history/customer namespaces, four existing functions were visible; zero were executable by the service, zero SECURITY DEFINER functions were executable by login or service, and the service owned zero scoped relations. No schema-specific default ACL rows were present. This last count is not a universal default-privilege or global function audit, nor a grant on future objects. No role switch, grant, mutation, secret or unrelated-role enumeration occurred.

## Minimal actual next live action

No hosted publication decision is ready or requested. The current running application's database session cannot be established through the audit connector, deploy status or absence of a failure log. Existing source pins intended roles, and scoped catalog permissions now have direct observations, but these do not substitute for a live process attestation.

The smallest missing operation is one access-controlled diagnostic invocation using the **actual running application's existing review connection path**, returning only booleans for expected project, session login, effective service role, enforced read-only transaction, and the immutable deployed revision. No connection strings, role bindings, tokens or raw records should leave that boundary. If an existing revision-bound operator receipt already supplies these assertions, use it. Otherwise an exact diagnostic implementation and separately reviewed release/invocation are necessary; this package does not install an endpoint, redeploy or approve it.

After that gate, the data decision must still bind the precise source/artifact hashes, candidate/selection, current canonical monthly arithmetic, original48/indexed-state and financial/unrelated fingerprints, exact schema/access delta and reviewed durable publication/withdrawal/recovery receipts. Do not ask for a blanket data approval or treat this document as one. A new hosted role, grant or write is not needed merely to complete the diagnostic evidence.
