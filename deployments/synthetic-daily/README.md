# Isolated synthetic daily cron — preparation, 19 November 2026

This proposal creates no service and enables no feed. The separate `night-scout-synthetic-daily` cron uses the repository root, existing locked `pg` 8.20.0 dependency and native Node 24.22.3. The website and Shopify/Xero services remain outside this package. Publishing these files is not authority to sync the Blueprint or alter hosted access.

## Source and build

Use `deployments/synthetic-daily/render.yaml` as a custom Blueprint path only after approval. Pin the final tested source revision in the dated activation package and verify the deployed commit before enabling writes; the Blueprint's branch alone is not an immutable source pin. Keep automatic deployment off and verify the proposed name does not adopt an existing service.

The build installs the API server's production dependency closure from the existing frozen lock with pnpm 10.26.1 and lifecycle scripts disabled. It neither builds the customer website nor runs a database migration. The full repository, including its root manifest, workspace definition, lock and linked workspace packages, is required. Verify the exact filtered install on a clean Linux checkout before calling the hosting package accepted. Render supports an explicit `NODE_VERSION`; this proposal asserts 24.22.3 instead of depending on a moving default. Exact version availability and executable CLI compatibility must pass the hosted build. [Node version reference](https://render.com/docs/node-version).

## Disabled and enabled commands

Checked-in start command:

```sh
node experiments/synthetic-company/daily-operator.mjs --recurring
```

Without `--enabled`, the operator must exit disabled before reading a binding or opening any database connection. A running cron can still incur its service minimum even when the application does no work.

Only after separate installation, access, programme, spending and scheduling approval, the proposed append command is:

```sh
node experiments/synthetic-company/daily-operator.mjs --recurring --enabled --mode=append --binding-file=/etc/secrets/synthetic-daily-binding.json
```

Keep inspection read only; an unknown append/commit outcome stops for independent receipt reconciliation, without a retry loop. The application has a 120-second process deadline and bounded connection/query/lock limits. Programme dates and ceiling are finite, with no automatic extension. Those are application controls; the Blueprint does not invent a cron timeout or expiry field.

The UTC expression `0 1,2 * * *` supplies both seasonal opportunities; the trusted server's London 02:00–02:15 guard admits the appropriate one. It never authorises catching up missed days. Render permits only one active run per cron service, delays an overlapping scheduled invocation and stops runs after 12 hours. A manual trigger cancels an active run, so do not use it as blind recovery. [Cron reference](https://render.com/docs/cronjobs).

## Private binding and approval gates

Deliver the separately reviewed synthetic-only binding as a secret file, never as repository content, a generic connection variable or a shared provider environment group. The file must contain the restricted session login and fixed approved scope, finite programme and independently derived catalogue/function/policy expectations. No broad owner or provider credential is accepted.

Render documents `/etc/secrets/<filename>` and a combined 1 MB secret-file limit; native runtimes also expose secret files in the service root. Do not log or copy those files into build artifacts. The operator requires an owner-only regular file outside source with no symlink. Confirm actual hosted mode, ownership, path and TLS behavior before enabling: platform documentation does not certify the operator's file-permission checks. If they fail, keep disabled and prepare a separately reviewed delivery fix rather than weakening the checks. [Secret-file reference](https://render.com/docs/configure-environment-variables#secret-files).

Before applying this proposal, the activation record must contain:

- Exact source/SQL revision and file digests; independently pinned metadata under the reviewed search path, target-compatible restricted membership/effective privileges and fixed scope.
- Actual accepted horizon, finite approved material range/digests, original January and 24-month protected evidence fingerprints, and explicit synthetic-only gap resolution. No automatic catch-up or rewritten observation time.
- Concrete SQL installation, role/login/grant and immutable material provisioning plan; no credentials or private observed catalog in public guidance.
- Exact disabled service/build verification, private binding delivery, approved enabled command, finite expiry, first bounded write and first genuine scheduled-run receipts.
- Agreed cost ceiling and failure notification/stop owner. To stop, disable append/scheduling, preserve evidence and inspect receipts independently; do not delete financial rows or retry providers.

## Cost estimate and validation limits

The proposed `0.5c-512mb` plan is listed at US$0.00016 per running minute. With two 120-second invocations daily for 31 days, illustrative runtime is 124 minutes, about US$0.01984 before the US$1 monthly cron-service minimum. This is an estimate, not a guaranteed bill or enforced cap; builds, other metered usage and taxes can differ. A US$5 monitoring threshold, if adopted, is an alerting choice rather than a platform spending limit. No spending is approved by this document. [Current pricing](https://render.com/pricing#cron-jobs), [cron minimum](https://render.com/docs/cronjobs#compute-plans-and-billing), [compute plans](https://render.com/docs/compute-plans).

Blueprint fields were checked against the current [YAML reference](https://render.com/docs/blueprint-spec) and [public schema](https://render.com/schema/render.yaml.json). Full Render CLI/platform validation and a clean hosted install remain pre-activation checks; no service was created, synced or deployed during preparation. This file intentionally has no secret values, migration hook, enabled flag or shared environment group. Official references were retrieved on 19 November 2026.
