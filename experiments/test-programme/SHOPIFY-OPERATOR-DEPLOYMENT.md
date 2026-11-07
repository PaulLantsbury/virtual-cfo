# Shopify-first isolated test operator — 15 October 2026

Status: runnable disabled deployment tree and integrity-pinned dependency closure prepared; no hosted service, secret provisioning, live database change or provider write performed. Shopify runs independently of Xero consent, Xero credentials and the operator consent web API.

## Smallest operational path

Use a separate headless Render Cron Job for the Shopify writer. It needs no public URL, no callback and no operator sign-in UI: only the separately installed same-organisation Shopify writer app's client-credentials flow, dedicated writer database identity, private host configuration and existing runtime development-shop/scope checks. Operator access is through the hosting platform's secure sign-in and secret editor. Never ask anyone to paste bearer tokens into chat. No customer Settings route or main-host writer credentials are needed.

Xero's future operator consent API still needs separate hosting and a secure owner sign-in interface, but neither blocks this Shopify-only job. Do not invent an app/callback URL as a shortcut; the Shopify app configuration must follow the verified current client-credentials requirements. Existing writer target and read-only collector credentials stay separate.

## Deployment tree and dependencies

From the repository root:

```sh
node experiments/test-programme/prepare-operator-deployment.mjs experiments/test-programme/.operator-runtime
```

The packager copies exactly seven Shopify runner modules, creates a private package.json and disabled programme config, and writes a standalone frozen pnpm lock containing 14 package snapshots. All versions and integrity hashes were extracted from the committed repository lock; there are no workspace links or imports of `artifacts/api-server`. No Xero refresh/consent server modules are copied. The shared runner dynamically imports its Xero branch only for Xero configurations; the Shopify-only entry rejects those configurations before invoking it.

Proposed Render Cron Job configuration (not created):

- Repository/branch: existing `PaulLantsbury/virtual-cfo`, `codex/restart-baseline`.
- Root directory: repository root. Node 24, pnpm version matching the existing environment.
- Build command: `node experiments/test-programme/prepare-operator-deployment.mjs experiments/test-programme/.operator-runtime && pnpm --dir experiments/test-programme/.operator-runtime install --config.auto-install-peers=false --frozen-lockfile --ignore-workspace --prod --ignore-scripts`.
- Command: `node experiments/test-programme/.operator-runtime/shopify-operator-entry.mjs`.
- Config file: `experiments/test-programme/.operator-runtime/shopify-programme.json`.
- Proposed scheduled window: 17:00 UTC on the approved 15–18 October dates, corresponding to 18:00 London before the daylight-saving change. Existing code refuses other dates/windows, caps or unknown durable profile state. Review/pause the service after the bounded programme; do not silently extend, catch up or fake execution time.
- Initially keep `NIGHT_SCOUT_TEST_PROGRAMME_ENABLED` unset/false. Disabled invocation produces only `prepared-disabled` and performs no credential mint, DB access or provider write.

Private Shopify-only configuration: `NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL`, `NIGHT_SCOUT_TEST_PROGRAMME_CONFIG_FILE`, exact project/target pins, verified-development-target flag, Shopify writer client ID/secret, and trusted CA material where required. No Xero environment variable or OAuth scope is required. No dependency/host spend was incurred or approved by this package; hosting cost must be shown for the actual proposed service before creation.

## Verification and honest remaining gate

Two new tests prove the standalone copied entry executes disabled without customer source or Xero credentials, contains integrity-pinned independent dependency metadata, and rejects provider/target switches before calling the runner. Existing programme safeguards remain unchanged.

A genuine isolated frozen/offline install was attempted. The environment's supply-chain verification refused it with `ERR_PNPM_NO_OFFLINE_META`: first missing Supabase metadata for the wider consent package, then missing `pg-cloudflare` metadata for the minimal 14-package Shopify closure. No policy check was disabled or bypassed. Therefore dependency installation is **not verified**, even though the disabled standalone runner executes without loading pg. The approved package mirror/metadata must be available and the same frozen install must pass before deploying the enabled job.

Live sequence: verify installed writer app and exact scopes/development shop; provision its credentials privately on the separate job; pass isolated dependency build; inspect dedicated DB role and Shopify-only disabled programme/profile receipt; obtain/apply the separately reviewed `shopify-daily-binding-proposal-2026-10-15.sql` if required (operator metadata receipt must come from an actual fresh authenticated provider check; the proposal does not authenticate that receipt itself); review the concrete job/cost; then enable only the approved future execution window. The existing coupled two-provider amendment must not be used merely to unblock Shopify. Root's browser operator owns these live checks.

## Live hosting receipt

Paul approved the separate Render cron and initial US$5 test budget on 15 October. Service `crn-db8g0n8u01pc7383j2d0` was created on 0.5 CPU / 512 MB. First build failed because pnpm did not inherit the root auto-install-peers=false setting across the isolated directory; the explicit matching setting above preserves frozen-lockfile checks. Corrected build `bld-db8g1667bikc73e0ibs0` succeeded on Render using Node 24.22.0. Generation remains false; no writer secrets or DB password provisioned. Historical offline-install limitation above no longer blocks the hosted dependency build.

Hosted disabled smoke run completed successfully at 16:35:24 UTC on 15 October, with output `prepared-disabled`, provider Shopify, actions 4. This verifies hosted entry/config execution, not provider credentials, database readiness or actual order creation.
