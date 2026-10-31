> **30 October approved setup:** Separate hosts/app now exist and the two reviewed staging SQL packages are applied. Bootstrap and generation remain off; private owner credentials, actual MFA, genuine demo/source and matching-reader checks remain. See [the current setup record](../../docs/xero-staging-setup-2026-10-30.md). Earlier prepared/unapproved wording below records the package stage; do not repeat completed setup or reset dates/history.

# Isolated Xero generation cron — prepared, not deployed

No host/spend, live settings, SQL, provider call or schedule changed. The separate Xero writer app is still absent. This package is independent of the consent web service, customer app and reader worker.

## Fixed unapproved programme

Only `xero-staging-20261030` / `daily-xero-20261030-v1`: **30 October–5 November 2026, 18:00–18:14 London/GMT**, one **£10 posted GBP Demo Company invoice/day**, seven maximum (**£70 demo revenue/receivables, £0 paid**). Hard stop **6 November 00:00 UTC**. Missed dates skip; no catch-up, new Monday, cap reset or date extension. No contact/account creation, email, payment, tax or stock action. Approval remains required before migration/consent/activation; a prepared package is not approval.

## Package/build/start

Node24, repository root, future **new dedicated cron** only. Build:

```sh
node experiments/test-programme/prepare-xero-generation-deployment.mjs experiments/test-programme/.xero-generation-runtime
pnpm --dir experiments/test-programme/.xero-generation-runtime install --config.auto-install-peers=false --frozen-lockfile --ignore-workspace --prod --ignore-scripts
```

This is the ordinary policy-checked frozen production install: no floating versions or lifecycle scripts. Do not remove lock or supply-chain checks on failure. Offline installation is optional only when the required policy mirror/store metadata is already cached. This package does not create a host.

Start:

```sh
node experiments/test-programme/.xero-generation-runtime/xero-generation-entry.mjs
```

With no config/credentials/enable flag, standalone start returns `prepared-disabled`, seven proposed actions and `configurationBound=false`. That is a disabled smoke, not connection/readiness proof. The generated example has null IDs/code and is deliberately unusable; actual private config must come from verified consent/source proof.

## Isolation and provenance

Eleven local modules, **pg8.20.0 only**, fourteen integrity-pinned snapshots extracted from the existing root lock. The helper verifies root/derived-lock hashes and exact dependency version before output. The shared runner is copied **unchanged**; the Xero-only entry rejects other providers, profiles, shifted dates, invalid IDs and known Shopify/reader/review/intake/consent environment families (including owner/public-auth settings and a false consent flag) before delegation. An unused built-in-only Shopify token helper remains in the shared import closure; it receives no Shopify config/credentials and does not run.

Only the packaged `xero-writer-refresh.mjs` import is relocated from the read-worker runtime to `xero-generation-token-runtime.mjs`. The durable refresh/lease/rotation/stop code is otherwise byte-identical. The standalone primitive reuses existing writer-envelope crypto and has parity tests against the original token contract and encrypted wire format. Per-module source/package hashes record the sole import relocation. No customer, reader runtime, consent server/UI, auth SDK, actual private config, credential or scheduler is copied. Dirty/unrelated or symlinked output is refused before overwrite.

## Disabled-default secure setup

Keep `NIGHT_SCOUT_TEST_PROGRAMME_ENABLED=false`. No secrets are needed for the initial unbound disabled smoke. After separately approved app/host/database/consent/source checks, privately configure only:

- `NIGHT_SCOUT_TEST_PROGRAMME_CONFIG_FILE`: private secret-file path **outside** generated output, e.g. `/etc/secrets/xero-programme.json`.
- Exact `NIGHT_SCOUT_TEST_PROGRAMME_PROJECT_REF=bioalckltvkhlczusdvl` and source-verified `NIGHT_SCOUT_TEST_PROGRAMME_TARGET`.
- Dedicated restricted `NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL`, verified CA through `NODE_EXTRA_CA_CERTS`; never a reader/admin URL.
- Generator-side writer app keys `NIGHT_SCOUT_TEST_WRITER_XERO_CLIENT_ID` / `NIGHT_SCOUT_TEST_WRITER_XERO_CLIENT_SECRET`.
- Separate writer envelope key/version `NIGHT_SCOUT_TEST_WRITER_ENVELOPE_MASTER_KEY` / `NIGHT_SCOUT_TEST_WRITER_ENVELOPE_KEY_VERSION`, matching the disabled consent envelope; never the reader key.

Private config exact fields: provider `xero`, actual demo tenant `target`, actual existing synthetic `contactId`, source-verified revenue `accountCode`, `startMonday=2026-10-26`, programme/profile above, `financialMode=posted_demo_only`. No guessed UUIDs or hardcoded account default. Unknown fields fail validation.

Set `NIGHT_SCOUT_TEST_PROGRAMME_VERIFIED_TEST_TARGET=true` only after source verification. Keep `NIGHT_SCOUT_TEST_WRITER_POSTED_DEMO_APPROVED` absent/false until this exact proposed posting programme is approved. Never install Shopify keys, reader keys, consent-side Xero keys or owner-login settings on this cron; do not share its environment group with those services. Check concrete current platform cost before proposing/creating the additional resource.

Before any enabling, independently verify the exact new disabled DB row/envelope, real clock, approved dates/cap, deployed revision, actual demo target/contact/account, matching reader tenant and actual reader health. Only then review the proposed **`0 18 * * *` UTC** schedule and exact row/host activation separately. Nothing schedules itself. The unchanged runner validates clock/window, restricted database identity, dedicated daily RPC **before refresh**, encrypted rotation-before-use, exact demo proof and durable once-only claim. Uncertain outcomes stop; never clear claims or fake time.

Acceptance remains confirmed provider invoice + durable ledger + next real matching-tenant accounting read. Posted revenue/receivables do not create cash. No dashboard completeness is inferred.

## Checks and limits

Package tests cover standalone disabled/unbound startup, strict provider/profile/ID/env gates, complete local import graph, unchanged runner, sole refresh-import relocation, source/lock hashes, dirty/symlink/ancestor refusal, and no catch-up/expired windows. Token/encryption parity and packaged rotation-before-use/stop-on-scope tests pass.

The first offline frozen install failed safely because cached `pg-cloudflare` mirror metadata was absent. The subsequently authorized normal frozen production install **passed all fourteen supply-chain entries**, installed pg8.20.0 and skipped version resolution; lifecycle scripts stayed disabled and manifest/lock versions were unchanged. Installed-tree checks resolved pg inside the isolated tree, imported the standalone refresh closure, and passed both unbound and synthetic-config disabled smokes with zero provider/database calls. No source binding or credential was validated by those smokes. Actual hosted installation, app/credentials, consent, SQL, scheduled generation and reader ingestion remain unverified.
