# Isolated synthetic daily cron — preparation, 19 November 2026

The separate disabled service already exists under the approved Phase 1 setup. These files propose a further compatibility release for that same service, with no additional resource or budget. The cron uses the repository root, existing locked `pg` 8.20.0 dependency and native Node 24.22.3. The website and Shopify/Xero services remain outside this package. Publishing these files is not authority to sync the Blueprint, deploy a new revision or alter hosted access.

## Source and build

Treat `deployments/synthetic-daily/render.yaml` as a reviewed description of the same isolated service; do not create a second service or sync infrastructure implicitly. Pin the final tested source revision in the dated release package and verify the deployed commit before enabling writes; the Blueprint's branch alone is not an immutable source pin. Keep automatic deployment off.

The build installs the API server's production dependency closure from the existing frozen lock with pnpm 10.26.1 and lifecycle scripts disabled, then runs verify-runtime.mjs to load pg 8.20.0 and confirm the zero-connection disabled default. It neither builds the customer website nor runs a database migration. The full repository, including its root manifest, workspace definition, lock and linked workspace packages, is required. Verify the exact filtered install on a clean Linux checkout before calling the hosting package accepted. Render supports an explicit `NODE_VERSION`; this proposal asserts 24.22.3 instead of depending on a moving default. Exact version availability and executable CLI compatibility must pass the hosted build. [Node version reference](https://render.com/docs/node-version).

## Disabled and enabled commands

Checked-in start command:

```sh
node experiments/synthetic-company/daily-render-wrapper.mjs --recurring
```

Without `--enabled`, the operator must exit disabled before reading a binding or opening any database connection. A running cron can still incur its service minimum even when the application does no work.

Only after separate installation, access, programme, spending and scheduling approval, the proposed append command is:

```sh
node experiments/synthetic-company/daily-render-wrapper.mjs --recurring --enabled --mode=append
```

Keep inspection read only; an unknown append/commit outcome stops for independent receipt reconciliation, without a retry loop. The application has a 120-second process deadline and bounded connection/query/lock limits. Programme dates and ceiling are finite, with no automatic extension. Those are application controls; the Blueprint does not invent a cron timeout or expiry field.

The UTC expression `0 1,2 * * *` supplies both seasonal opportunities; the trusted server's London 02:00–02:15 guard admits the appropriate one. It never authorises catching up missed days. Render permits only one active run per cron service, delays an overlapping scheduled invocation and stops runs after 12 hours. A manual trigger cancels an active run, so do not use it as blind recovery. [Cron reference](https://render.com/docs/cronjobs).

## Private binding and approval gates

Deliver the separately reviewed synthetic-only binding as a secret file, never as repository content, a generic connection variable or a shared provider environment group. The file must contain the restricted session login and fixed approved scope, finite programme and independently derived catalogue/function/policy expectations. No broad owner or provider credential is accepted.

Render documents `/etc/secrets/<filename>` and a combined 1 MB secret-file limit; native runtimes also expose secret files in the service root. Do not log or copy those files into build artifacts. The operator requires an owner-only regular file outside source with no symlink. Confirm actual hosted mode, ownership, path and TLS behavior before enabling: platform documentation does not certify the operator's file-permission checks. If they fail, keep disabled and prepare a separately reviewed delivery fix rather than weakening the checks. [Secret-file reference](https://render.com/docs/configure-environment-variables#secret-files).

The approved November 19 runtime probe found a root-owned symlink at the native mount, correctly refused by the operator. On November 20, deployed source 1168b0b2 built successfully, but its full-chain check refused Render's root-owned writable `/etc/secrets` directory before any database connection. The disabled command was restored. The operator's strict reader remains unchanged.

The further proposed wrapper authenticates the exact approved binding bytes using a separately delivered private `NIGHT_SCOUT_BINDING_SHA256` setting, derived from the independent approved artifact rather than the mounted file. It requires a valid pin before filesystem access and compares the digest before decoding, parsing or copying. Only the fixed `/etc/secrets` parent may be writable; it must still be root-owned and not a symlink. All other parent/target ownership, permissions, bounded-read and file-identity checks remain. The authenticated bytes become an exclusive runtime-owned `0600` regular copy in a private `0700` directory outside source, removed after use. Default disabled execution reads neither the pin nor the binding and opens no database connection. This new source/private-pin delivery needs separate exact approval and actual hosted verification. See the [pinned-delivery proposal](../../docs/daily-feed-pinned-delivery-proposal-2026-11-20.md).

After that exact disabled release is approved, this distinct file-only check may verify delivery with no database connection:

```sh
node experiments/synthetic-company/daily-render-wrapper.mjs --verify-delivery
```

It requires `appendApproved` and `protectedFingerprintsAccepted` to remain false. It cannot be combined with enabled/append arguments. Restore and verify the normal disabled command after the check. This does not accept the financial baseline or authorise activation.

The separately reviewed `node deployments/synthetic-daily/verify-connection.mjs` check uses that same private staging/reader path to verify certificate-authorised client TLS, the exact PostgreSQL 17 session role, default read-only mode and the reviewed invoker identity in a read-only transaction. It rolls back and disconnects, prints booleans only, and requires both approval flags to stay false. It neither reads financial rows nor provisions a programme. A successful result proves restricted hosted connection identity, not full catalogue, baseline or financial acceptance. Its current connection tests use controlled clients; actual hosted evidence is still required after exact release approval.

## Existing platform statistics metadata

The optional `statisticsCompatibility` contract requires explicit `reviewAccepted: true` before the strict validator can permit SELECT on the two exact `pg_stat_statements` extension views. It verifies independent PostgreSQL 17.6/extension 1.11 source profiles, extension membership, C invoker definitions, ACLs, separately reviewed control-plane owners and effective table/column privileges. Both operator checks combine ordinary and statistics metadata in one prepared statement. Financial/unrelated-table, role, sequence and write guards remain in force; no database grant or migration is added.

Acceptance acknowledges existing system-wide activity counts, timings and database/user identifiers. Native tests prove other roles' query text and query IDs are masked; own-role query text remains visible. Elevated statistics-role access, reset execution and table/column write or grant-option drift are refused. See [PostgreSQL 17 statistics documentation](https://www.postgresql.org/docs/17/pgstatstatements.html) and the [pinned Supabase bootstrap ACL source](https://github.com/supabase/postgres/blob/8698fe81703a4eade3b18bbe0adddd89628d15c2/migrations/db/init-scripts/00000000000003-post-setup.sql).

Only the owner grant-option representation is normalized in statistics protection hashes: ownership already carries grant options under [PostgreSQL 17 privilege rules](https://www.postgresql.org/docs/17/ddl-priv.html). Ordinary owner privileges and every non-owner grant-option bit remain exact, with native tests covering both. Profiles are derived from independent local source fixtures; hosted hashes must never be copied into expected values. A matching target profile with review still false remains blocked. This access-contract review does not accept original evidence fingerprints or approve financial activation.

Before applying this proposal, the activation record must contain:

- Exact source/SQL revision and file digests; independently pinned metadata under the reviewed search path, target-compatible restricted membership/effective privileges and fixed scope.
- Actual accepted horizon, finite approved material range/digests, original January and 24-month protected evidence fingerprints, and explicit synthetic-only gap resolution. No automatic catch-up or rewritten observation time.
- Concrete SQL installation, role/login/grant and immutable material provisioning plan; no credentials or private observed catalog in public guidance.
- Exact disabled service/build verification, private binding delivery, approved enabled command, finite expiry, first bounded write and first genuine scheduled-run receipts.
- Agreed cost ceiling and failure notification/stop owner. To stop, disable append/scheduling, preserve evidence and inspect receipts independently; do not delete financial rows or retry providers.

## Cost estimate and validation limits

The proposed `0.5c-512mb` plan is listed at US$0.00016 per running minute. With two 120-second invocations daily for 31 days, illustrative runtime is 124 minutes, about US$0.01984 before the US$1 monthly cron-service minimum. This is an estimate, not a guaranteed bill or enforced cap; builds, other metered usage and taxes can differ. A US$5 monitoring threshold, if adopted, is an alerting choice rather than a platform spending limit. No spending is approved by this document. [Current pricing](https://render.com/pricing#cron-jobs), [cron minimum](https://render.com/docs/cronjobs#compute-plans-and-billing), [compute plans](https://render.com/docs/compute-plans).

Blueprint fields were checked against the current [YAML reference](https://render.com/docs/blueprint-spec) and [public schema](https://render.com/schema/render.yaml.json). The existing service's approved 299998 release passed its clean Linux install and locked-driver build; this further compatibility source still requires exact hosted verification after approval. This file intentionally has no secret values, migration hook, enabled flag or shared environment group. Official references were retrieved on 19 November 2026.


## Managed installation continuation
The initially approved c59 service built and ran disabled. Its database installation was held when the managed administrator differed from the superuser test fixture. The separately approved 299998 amendment subsequently installed the managed-compatible capability and restricted login, with exact administration edges and temporary-access cleanup independently verified. No financial material was provisioned. Do not replay either installation or recreate the login. This further source proposal addresses hosted file delivery and existing platform statistics metadata only; protected evidence, hosted acceptance and separate financial activation remain gated. See the dated roadmap for the current applied state.
