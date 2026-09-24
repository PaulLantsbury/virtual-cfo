# Staging Xero connection-bound bootstrap follow-up

Status: prepared and executable-database tested; staging-only application requires the migration owner.

The applied bootstrap RPC generated its connection UUID after the host had to encrypt the retained refresh credential. Because the credential envelope authenticates `connection ID + tenant ID + key version`, that order cannot produce an envelope the scheduled worker can later decrypt.

`20260924_bind_xero_bootstrap_connection_id.sql` replaces only the bootstrap RPC signature. The trusted staging host must generate a random UUID first, encrypt using that exact UUID and canonical tenant/key version, then pass the UUID and envelope into the same atomic bootstrap transaction. The old signature is removed so it cannot create unbound envelopes.

The same follow-up adds two read-only, worker-only RPCs. `worker_get_refresh_context` returns one exact active connection, encrypted envelope and its persisted mapping selections. `worker_get_latest_supported_evidence` returns only the latest supported row for an exact connection, mapping, scope, currency and closed-period tuple. The lease RPC atomically acquires a 30–300 second refresh lease and returns its exact expiry as a fencing token. The token is truncated to milliseconds so it round-trips exactly through node-postgres `Date` values. Release requires the same connection, credential version and expiry token, so an expired runner cannot clear a newer runner's lease. A new leased rotation RPC likewise requires the exact unexpired fencing token and current version, advances exactly one version and clears the lease atomically. Worker execution of the older unfenced rotation RPC is revoked.

None of the new RPCs grants table access or accepts a caller-selected relation. The worker now derives the operative mapping from persisted state and requires the configured mapping to match it exactly, rather than trusting configuration alone. It can retain stale evidence only from the exact persisted scope.

Apply only in Night Scout Staging (`bioalckltvkhlczusdvl`), then run `verify-xero-connection-bound-bootstrap-2026-09-24.sql`. Expected: old bootstrap signature absent; new signature present; bootstrap has exactly one Xero routine grant; worker has the bounded evidence/failure RPCs, two readers, two fenced lease RPCs and leased rotation; the older unfenced rotation grant is absent; neither login has Xero table grants; memberships are unchanged.

## Staging Replit deployment checklist

The website deployment is staging-only. Do not copy these settings to the
production/original project, the Shopify scheduled worker, or the later Xero
scheduled worker.

Replit cannot reach the staging direct database endpoint from its current IPv4
network. Before a retained OAuth callback is attempted, replace the current
direct value of `NIGHT_SCOUT_XERO_BOOTSTRAP_DATABASE_URL` with the dashboard-
verified **session pooler** form below, using the existing dedicated bootstrap
role password. Percent-encode the password for a URL. Never put the password or
complete URL in source, chat, logs, or a shell command that will be retained in
history.

```text
postgresql://night_scout_xero_bootstrap_login.bioalckltvkhlczusdvl:<URL-ENCODED-PASSWORD>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres
```

Port `5432` is the session pooler. Port `6543` transaction pooling, unqualified
pooler usernames, alternate pooler regions, the importer login, `postgres`, and
service-role credentials are rejected. TLS certificate verification remains
enabled through `NIGHT_SCOUT_STAGING_CA_PEM`. The pooler wire username resolves
to the existing `night_scout_xero_bootstrap_login` PostgreSQL session role; it
does not grant that role membership in the scheduled worker role or add table
privileges.

The first discovery publication needs these exact Replit secret names/settings:

- `NIGHT_SCOUT_RUNTIME_ENV=staging`
- `NIGHT_SCOUT_XERO_STAGING_BOOTSTRAP_ENABLED=true`
- `NIGHT_SCOUT_XERO_STAGING_PROJECT_REF=bioalckltvkhlczusdvl`
- `NIGHT_SCOUT_XERO_REDIRECT_URI=https://night-scout-xero-staging.replit.app/api/xero/staging/callback`
- `NIGHT_SCOUT_XERO_CLIENT_ID`
- `NIGHT_SCOUT_XERO_CLIENT_SECRET`
- `NIGHT_SCOUT_XERO_STAGING_OWNER_ID`
- `NIGHT_SCOUT_XERO_STAGING_STORE_ID`
- `VITE_SUPABASE_URL=https://bioalckltvkhlczusdvl.supabase.co`
- `VITE_SUPABASE_ANON_KEY`

Discovery does not need a database connection, CA, envelope key, tenant pin or
mapping. The existing `NIGHT_SCOUT_XERO_BOOTSTRAP_DATABASE_URL` can therefore
remain unchanged until the single final-bootstrap secrets update below.

The deployed process receives `PORT` from Replit. The duplicate
`NIGHT_SCOUT_REVIEW_AUTH_URL`, `NIGHT_SCOUT_REVIEW_PUBLIC_KEY`, and the unused
`NIGHT_SCOUT_XERO_STATE_KEY` are not required.

After the owner-only discovery returns the test-tenant directory, add or verify
this final retained-bootstrap group in one Replit Secrets update:

- `NIGHT_SCOUT_XERO_BOOTSTRAP_DATABASE_URL` in the session-pooler form above
- `NIGHT_SCOUT_STAGING_CA_PEM`
- `NIGHT_SCOUT_XERO_STAGING_TENANT_ID` (the discovered test tenant only)
- `NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY`
- `NIGHT_SCOUT_XERO_ENVELOPE_KEY_VERSION`
- `NIGHT_SCOUT_XERO_MAPPING_EFFECTIVE_FROM`
- `NIGHT_SCOUT_XERO_STAGING_MAPPING_JSON` (owner-confirmed active account IDs)

Then publish the current `codex/restart-baseline` revision as a **single-instance
Reserved VM** using
the repository's staging API artifact. Its hosted build includes the Virtual
CFO SPA on `/` and the API on `/api`, so the callback and authenticated
Settings discovery page share the exact staging origin. Build and run commands
are pinned in
`artifacts/api-server/.replit-artifact/artifact.toml`; do not replace `.replit`
with either scheduled-worker manifest. A read-only shell preflight is:

Autoscale is not approved for this one-shot OAuth bootstrap because the current
state and discovery handles are deliberately process-local. Separate requests
must reach the same process. A deployment restart safely invalidates pending
consent, in which case start discovery again; never retry a consumed callback.
The later scheduled Xero refresh remains a separate worker deployment.

```sh
git branch --show-current
git log -1 --oneline
node --experimental-strip-types --test artifacts/api-server/tests/staging-database-target.test.mjs artifacts/api-server/tests/xero-staging-bootstrap-runtime.test.mjs artifacts/api-server/tests/xero-staging-bootstrap-router.test.mjs
node artifacts/api-server/build-hosted.mjs
```

Expected branch is `codex/restart-baseline`; all focused tests and the build
must pass. These commands do not contact Xero or the database.

## Hosted smoke checks

Immediately after publication, these checks are deliberately unauthenticated
and make no Xero or database change:

```sh
base=https://night-scout-xero-staging.replit.app
curl -fsS "$base/api/healthz"
curl -sS -X POST -D - -o /dev/null "$base/api/xero/staging/discover"
curl -sS -D - -o /dev/null "$base/api/xero/staging/connect"
curl -sS -D - -o /dev/null "$base/api/xero/staging/callback"
```

The health endpoint must succeed. Discovery and connect must return `401` with
`Cache-Control: no-store`; this proves the owner boundary is mounted without
starting OAuth. The malformed callback must return `400`. A `503` on discovery
or connect means the staging runtime was not injected or its configuration
failed and publication must stop before consent. Do not weaken TLS, swap roles,
or retry a consumed OAuth callback to work around a failure.

After the retained connection has been persisted and independently verified,
remove `NIGHT_SCOUT_XERO_BOOTSTRAP_DATABASE_URL`, disable the bootstrap route,
and apply the documented `NOLOGIN` shutdown for the bootstrap role. The
scheduled refresh worker continues to use only its separate restricted importer
login.
