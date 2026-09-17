# Replit staging nightly worker — prepared runbook

Create a separate private worker project only after the final cloud setup approval. This folder does not deploy anything. Do not republish or replace the existing Virtual C F O website. Use the reviewed GitHub development-branch revision and retain the repository directory layout because runtime imports cross experiments/shopify and experiments/financial-v1.

## Build and inactive check

Use Node 24 and the project's pnpm lockfile. In the new worker project only, install locked dependencies without lifecycle scripts:

```sh
pnpm install --frozen-lockfile --ignore-scripts
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
- NIGHT_SCOUT_INTAKE_DATABASE_URL: existing restricted staging login, direct verified-TLS endpoint only. Cloud connectivity must be checked; pooler support is not silently enabled.
- NIGHT_SCOUT_SHOPIFY_CLIENT_ID and NIGHT_SCOUT_SHOPIFY_CLIENT_SECRET: existing development app credentials, never browser variables.
- NIGHT_SCOUT_STAGING_CA_PEM: trusted staging CA certificate, materialised only for the child process.
- NIGHT_SCOUT_REPORT_FROM and NIGHT_SCOUT_REPORT_TO: explicit ISO calendar dates, maximum 31 days. Proposed infrastructure trial uses 2026-09-17 for both. This is not a rolling financial-feed design.

No broad administrator/service-role credential is required. Never copy .local, secrets from the website, a shell environment dump or shopper payloads into the worker project. Review access to the new private project before adding credentials. No secret values are present in this runbook.

## Acceptance and rollback

After approved project/credential setup, run the read-only cloud check first. Verify TLS/network reachability and fixed staging role/store. A failure is not grounds to disable TLS or broaden database grants. Then exercise the due path under a controlled test; inspect durable records before repeating any uncertain outcome. Observe an actual overnight run with the Mac offline before claiming Mac-independent live success. Financial rows, prior candidates and test-order exclusion must remain intact. Check billable runtime against the US$5/month planning allowance; this is not an enforced cap.

Disable the schedule to stop future invocations; disabling does not cancel an in-flight write. Inspect its journal/claim before retrying. Do not remove claim/history rows to force another run. Existing reviewed financial data remains separate. Historical coverage/backfill, missed-slot alerting and production readiness still need completion.
