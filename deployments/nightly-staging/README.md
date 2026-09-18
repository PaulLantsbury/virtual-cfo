# Replit staging nightly worker — prepared runbook

Paul approved the separate staging worker setup on 17 September. The worker project has been created; see docs/cloud-worker-activation-2026-09-17.md for current activation status. This folder does not deploy anything. Do not republish or replace the existing Virtual C F O website. Use the reviewed GitHub development-branch revision and retain the repository directory layout because runtime imports cross experiments/shopify and experiments/financial-v1.

## Worker export preparation

18 September correction: the first actual run discovered the website artifact manifests and attempted to start its missing API build instead of collecting. Preparation must also remove `artifacts/**/.replit-artifact/artifact.toml` metadata from the separate export. It preserves source files and refuses Git checkout/linked paths. The smoke check now rejects residual manifests. Never remove these manifests from the website/source checkout. Paul approved and the staging-only correction was published on 18 September at 10:14:45 UTC (deployment `6c765555`); the next genuine overnight execution remains to be verified; see `docs/first-overnight-verification-2026-09-18.md`.

In a separate Git archive export only, copy `deployments/nightly-staging/replit-worker.toml` to `.replit`, then run:

```sh
node deployments/nightly-staging/prepare-export.mjs --export-dir /home/runner/workspace --confirm-staging-export bioalckltvkhlczusdvl
```

This narrows workspace discovery to lib/db and configures plain pnpm installs for locked runtime-only dependencies, disabled lifecycle scripts and non-interactive CI. It refuses Git checkouts and non-staging worker configurations. Never run on the website/source checkout. Replit can run an automatic plain install despite the documented enabledForHosting=false setting, so this export policy is required. Verified with pnpm 10.26.1 first/repeated installs and in the Replit workspace. Re-importing the original workspace manifests requires running preparation again.

## Build and inactive check

Use Node 24 and the project's pnpm lockfile. In the new worker project only, install locked dependencies without lifecycle scripts:

```sh
pnpm --filter @workspace/db --prod install --frozen-lockfile --ignore-scripts
node deployments/nightly-staging/smoke.mjs
```

The smoke check resolves imports and the PostgreSQL driver without contacting Shopify/Supabase. Do not run database push, reset, seeding or web build/start commands. The build command must not read credentials. The existing website .replit settings must not be copied into worker configuration: they reference the original environment and Autoscale.

Check command:

```sh
node experiments/shopify/cloud-nightly.mjs --check
```

This remains disabled unless NIGHT_SCOUT_CLOUD_ENABLED is explicitly true. With valid staging secrets and enabled=true it makes only the existing read-only configuration/storage check. It does not prove Shopify authentication or a completed collection. The nightly-claims schema must exist for readiness to pass.

After approved activation, run command:

```sh
node experiments/shopify/cloud-nightly.mjs --tick --confirm-target bioalckltvkhlczusdvl/56d92f8a-746e-4b4f-b408-81fc98c4aa17
```

In Replit Scheduled publishing choose daily 02:00, Europe/London, a timeout slightly longer than the child's five-minute limit (proposed six minutes), and verify the final machine/charge display. The start window is [02:00,02:15); it is not permission for an extra refresh. The command executes once and exits. It must not be configured as Autoscale/Reserved VM or as a public HTTP trigger. No live scheduler is installed by these instructions.

## Server-only secret contract

- NIGHT_SCOUT_CLOUD_ENABLED: explicit true only after approved configuration; omitted/false means disabled.
- NIGHT_SCOUT_STAGING_PROJECT_REF: fixed staging project reference.
- NIGHT_SCOUT_INTAKE_DATABASE_URL: existing restricted staging login, verified-TLS direct endpoint or the exact dashboard-verified staging session pooler aws-1-eu-west-1.pooler.supabase.com:5432, with project-qualified restricted login. Transaction pooling is rejected.
- NIGHT_SCOUT_SHOPIFY_CLIENT_ID and NIGHT_SCOUT_SHOPIFY_CLIENT_SECRET: existing development app credentials, never browser variables.
- NIGHT_SCOUT_STAGING_CA_PEM: trusted staging CA certificate, materialised only for the child process.
- NIGHT_SCOUT_REPORT_FROM and NIGHT_SCOUT_REPORT_TO: explicit ISO calendar dates, maximum 31 days. Proposed infrastructure trial uses 2026-09-17 for both. This is not a rolling financial-feed design.

No broad administrator/service-role credential is required. Never copy .local, secrets from the website, a shell environment dump or shopper payloads into the worker project. Review access to the new private project before adding credentials. No secret values are present in this runbook.

## Acceptance and rollback

After approved project/credential setup, run the read-only cloud check first. Verify TLS/network reachability and fixed staging role/store. A failure is not grounds to disable TLS or broaden database grants. Then exercise the due path under a controlled test; inspect durable records before repeating any uncertain outcome. Observe an actual overnight run with the Mac offline before claiming Mac-independent live success. Financial rows, prior candidates and test-order exclusion must remain intact. Check billable runtime against the US$5/month planning allowance; this is not an enforced cap.

Disable the schedule to stop future invocations; disabling does not cancel an in-flight write. Inspect its journal/claim before retrying. Do not remove claim/history rows to force another run. Existing reviewed financial data remains separate. Historical coverage/backfill, missed-slot alerting and production readiness still need completion.

## Staging Xero scheduled worker

`replit-xero-worker.toml` is a **separate** scheduled-worker manifest for the
staging Xero test tenant. It must only be used after a retained test-tenant
connection and owner-confirmed mapping have created the fixed connection and
mapping-version identifiers. It requires the staging-only variables validated
by `xero-worker.mjs`, including the restricted database URL, CA, Xero client
credentials, envelope master key, fixed IDs, approved mapping JSON and bounded
GBP report scope. It must never replace the Shopify worker or website manifest.
