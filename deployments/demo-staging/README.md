# Isolated GBP Xero Demo reader — proposed deployment

Prepared source only. Applying the new SQL, creating a dedicated reader app and host, granting access, consenting and enabling collection require the separately reviewed setup approval. Existing reader, Shopify and writer settings are unchanged. This package contains no credentials or customer application.

The fixed target is project `bioalckltvkhlczusdvl`, synthetic store `f59e3a44-7106-4df8-9c08-52da30c9de30`, schema `xero_demo_v1`, login `night_scout_demo_import_login` and SET-only role `night_scout_demo_import_service`. Each transaction verifies the actual session, role privileges and sole membership before invoking its fixed RPC allowlist. SQL proposal: `db-migrations/proposals/xero-demo-isolation-2026-10-30.sql`.

Prepare a separate, empty deployment directory:

```sh
node deployments/demo-staging/prepare-demo-reader-deployment.mjs /tmp/night-scout-demo-reader
pnpm --dir /tmp/night-scout-demo-reader install --config.auto-install-peers=false --frozen-lockfile --ignore-workspace --prod --ignore-scripts
cd /tmp/night-scout-demo-reader
pnpm start
```

Use Node 24. The package pins the existing `pg@8.20.0` lock closure (14 snapshots); the helper checks both source and derived lock hashes. Local verification also completed the same frozen production install with `--offline` from the existing cache. The prepared tree runs all three CLI entries disabled without credentials or installed dependencies. `source-provenance.json` fingerprints the exact 19 modules and manifest; unrelated output files and symlinks are refused. Shared modules are pure period/cadence/calculation helpers, with no legacy reader runtime, consent host, writer runner or customer application.

Keep the new host disabled with `NIGHT_SCOUT_DEMO_XERO_REFRESH_ENABLED=false` until setup and consent acceptance pass. The following private environment is required for enabled execution; no dotenv loading, inherited shared environment, alternate schema/role or date override exists:

| Variable | Required value |
| --- | --- |
| `NIGHT_SCOUT_RUNTIME_ENV` | `staging` |
| `NIGHT_SCOUT_DEMO_XERO_REFRESH_ENABLED` | `true` only after acceptance |
| `NIGHT_SCOUT_DEMO_XERO_PROJECT_REF` | `bioalckltvkhlczusdvl` |
| `NIGHT_SCOUT_DEMO_XERO_STORE_ID` | `f59e3a44-7106-4df8-9c08-52da30c9de30` |
| `NIGHT_SCOUT_DEMO_XERO_PERIOD_MODE` | `daily_completed_period` |
| `NIGHT_SCOUT_DEMO_XERO_CURRENCY` | `GBP` |
| `NIGHT_SCOUT_DEMO_XERO_CLIENT_ID` | Dedicated new Demo reader app ID; exact original value |
| `NIGHT_SCOUT_DEMO_XERO_CLIENT_SECRET` | Dedicated new Demo reader app secret |
| `NIGHT_SCOUT_DEMO_XERO_EXPECTED_TENANT_ID` | Exact tenant selected during separately authenticated consent |
| `NIGHT_SCOUT_DEMO_XERO_ENVELOPE_MASTER_KEY` | New reader-only master key, shared only with its isolated bootstrap |
| `NIGHT_SCOUT_DEMO_XERO_ENVELOPE_KEY_VERSION` | Exact encrypted envelope key version |
| `NIGHT_SCOUT_DEMO_XERO_DATABASE_URL` | `postgresql://night_scout_demo_import_login.bioalckltvkhlczusdvl:<encoded-password>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres` |
| `NIGHT_SCOUT_DEMO_XERO_CA_PEM` | Trusted database CA PEM; certificate verification remains enabled |

Never copy the current reader or writer master key/token into this reader. Bootstrap and worker use dedicated Demo AAD binding store, connection, tenant and key version. The expected tenant pin is an operator constraint, not proof that the writer uses the same tenant. After both consents, independently compare their actual authenticated tenants and accept fresh reader health before writer activation.

On approval, the one-shot preflight entry is `node deployments/demo-staging/run-demo-preflight.mjs`; collection is `node deployments/demo-staging/run-demo-refresh.mjs`. Both use actual time. Each collection refreshes under a fenced lease, durably saves token rotation, and checks exact connection, scopes and actual `IsDemoCompany=true` plus GBP before accounting evidence can persist. Non-demo/wrong-currency/tenant/rebound/malformed sources fail closed; report outages preserve earlier supported evidence with failed freshness. No provider business writes occur.

Proposed UTC cron: `0 1,2 * * *`; the runtime accepts only 02:00–02:14 Europe/London, so one candidate enters per day. Reporting covers completed days this month through yesterday (or the prior complete month on day one), with the existing mapped-account calculation rules. This is not an accounting close or historical backfill.

The immutable trial intake interval is **30 October 2026 00:00 UTC through 6 November 2026 03:00 UTC, exclusive**. It permits the final 6 November 02:00 collection after the final proposed writer invoice on 5 November. Before start or at/after stop the CLIs return a safe disabled/expired receipt before pool/provider creation. Direct refresh/preflight and SQL also enforce the limit. An already leased token rotation can finish safely and release its lease; later accounting intake remains blocked. No environment switch extends these dates. Disable/delete the scheduled host and retire new app/grants after the trial as separately approved: this intake stop does **not** cancel hosting charges.

Verification:

```sh
node --test deployments/demo-staging/*.test.mjs experiments/xero/demo-isolation.test.mjs
```

Disposable SQL integration uses synthetic data and the actual proposed schema plus restricted query adapter. It verifies successful supported evidence, token rotation and lease completion while all legacy reader table rows, function definitions and its global selector remain identical. No successful local fixture is a live consent, provider source or hosted-run receipt.
