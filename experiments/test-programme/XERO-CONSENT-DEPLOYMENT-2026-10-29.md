> **30 October approved setup:** Separate hosts/app now exist and the two reviewed staging SQL packages are applied. Bootstrap and generation remain off; private owner credentials, actual MFA, genuine demo/source and matching-reader checks remain. See [the current setup record](../../docs/xero-staging-setup-2026-10-30.md). Earlier prepared/unapproved wording below records the package stage; do not repeat completed setup or reset dates/history.

# Isolated Xero consent deployment package — 29 October 2026

**Prepared locally; no host, resource charge, live settings or consent enabled.** This closes the reproducible dependency/package gap in the existing isolated operator source. Actual operator origin, hosting cost approval, separate Xero developer app/callback and genuine GBP Demo Company consent remain external gates. The customer app and read-only collectors remain separate.

## Package boundary

`prepare-xero-consent-deployment.mjs` copies **eleven consent-only modules**, the existing exact operator manifest and an independent frozen pnpm lock into a separate directory. It includes the new owner sign-in page, origin validation, owner-authenticated consent API, Xero bootstrap, restricted DB identity checks, scope checks and writer encryption. It contains **no provider invoice/order write runner, scheduler, customer app, collector, reader credentials, private config or environment file**. Node 24 natively strips the runtime's TypeScript types; no frontend/build tooling is required.

The lock contains **92 integrity-pinned package snapshots**: Express 5.2.1, pg 8.20.0, Supabase JS 2.100.1 and their existing committed-root-lock closure. No versions were newly resolved. `xero-consent-lock-provenance.json` pins both source and derived lock SHA-256 values and exact direct dependencies; the packager fails closed on drift. The root/workspace lock and imports are unchanged. All local imports remain inside the copied package. Existing outputs with unrelated files (including old writer runners, configs or `.env`) or symlinked entries are rejected before any overwrite; repeat consent builds may retain their own real `node_modules` directory.

## Exact proposed build/start

From repository root, use an output directory dedicated to this consent service:

```sh
node experiments/test-programme/prepare-xero-consent-deployment.mjs experiments/test-programme/.xero-consent-runtime
pnpm --dir experiments/test-programme/.xero-consent-runtime install --config.auto-install-peers=false --frozen-lockfile --ignore-workspace --prod --ignore-scripts
```

Start:

```sh
node --experimental-strip-types experiments/test-programme/.xero-consent-runtime/operator-consent-server.mjs
```

For a future **separate** Render Node web service, root directory is the repository root, Node major 24, health check `/health`; combine those two build commands with the platform's standard successful-command chaining. `PORT` is supplied by the platform. Do not reuse the Night Scout customer web host, Xero reader, Shopify writer cron or shared environment groups. Inspect actual current hosting cost and obtain the applicable approval before creating a resource; the Shopify trial budget does not authorize this additional service.

## Settings remain an explicit secure operator step

No environment values are generated or read by the packager. Choose a new separate HTTPS origin and register `${OPERATOR_ORIGIN}/api/xero/test-writer/callback` in the separate Xero writer app. Known customer origins, local/IP origins and mismatched callbacks are rejected. Exact origin and registered callback must agree across platform and Xero app.

Provision on that isolated host only: `NIGHT_SCOUT_TEST_WRITER_OPERATOR_ORIGIN`, staging project/owner/store pins, staging Supabase public URL/publishable or anon key, dedicated Xero writer app ID/secret, restricted writer DB URL/verified CA, separate writer encryption key/version, optional source-verified GBP demo tenant pin, and the exact callback. See `XERO-RESTART-2026-10-29.md` for the **unapproved** new programme and SQL/consent gates. Opt-in new consent requires `NIGHT_SCOUT_XERO_TEST_WRITER_CONSENT_PROFILE=daily-xero-20261030-v1`; packaging does not set it or change the original default.

Keep `NIGHT_SCOUT_XERO_TEST_WRITER_BOOTSTRAP_ENABLED` off until the isolated owner sign-in, safe public configuration, callback, database proposal and actual app configuration are accepted. Keep any `NIGHT_SCOUT_TEST_PROGRAMME_ENABLED` off; this package contains no generator regardless of that flag. No customer-host credential is copied. OAuth consent may retain a separate encrypted writer envelope and disabled programme only after those separate approvals/setup steps.

## Verification performed

- Package/graph tests check exact module/dependency boundary, independent parse of every copied module, forbidden source/ancestor output paths, lock provenance and tamper refusal.
- **Actual isolated production dependency install passed**, using the frozen lock, scripts disabled, no workspace coupling and unchanged supply-chain policy checks: all 92 packages installed, zero version resolution. An earlier offline attempt failed because local mirror metadata for Supabase functions was absent; the normal policy-checked install fetched the required metadata/packages successfully. No policy control was disabled.
- Installed-tree disabled smoke used real independently installed Express/pg/Supabase dependencies: `/health` returned 200, owner page and connect returned 503 with bootstrap off, zero provider/database calls. A second installed-tree smoke used synthetic configuration and a canonical Host header: the owner page rendered 200 with CSP and sign-in controls, still zero provider/database calls. These verify dependency resolution, disabled startup and rendering; they do not validate real credentials or login.

These checks do **not** establish a hosted origin, live password/app secrets, genuine login, actual Xero consent, SQL application, daily generation or matching-tenant accounting ingestion. Owner-page authentication/callback/security tests are maintained in the separate UI stream.

## Updating dependency provenance

Only when the root lock/direct manifest changes intentionally, run:

```sh
python experiments/test-programme/prepare-xero-consent-lock.py
```

This development-only utility uses existing PyYAML to extract the exact root-lock dependency closure and update the independent lock/provenance; no network/install runs. Review the diff and rerun package/frozen-install checks before publishing. Hosting/build has no Python requirement. Never remove lock verification or replace the frozen install with a floating install to work around drift.
