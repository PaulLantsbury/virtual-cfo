# Approved staging provider activation — 9 October 2026

Paul approved activating the prepared staging package. Approval does not make missing writer consent, target evidence, password provisioning or schedules exist. No source writes are made by the installer.

## Exact first database step

In **Night Scout Staging**, project `bioalckltvkhlczusdvl`, run the complete `provider-activation-install.sql` as the existing authorised database operator. It is a single atomic transaction with statement/lock bounds, absence guards and postconditions. It refuses an occupied schema or either pre-existing role instead of altering/reusing unknown permissions. If acknowledgement is lost, run `activation-postflight.sql` read-only; do not blindly reapply.

The installer requires PostgreSQL17+, the existing UUID user/store membership relation, and the operator's approved role/schema privileges. It creates four isolated RLS tables, eight fixed-search-path security-definer RPCs, the NOLOGIN `night_scout_test_writer_service` capability role and restricted `night_scout_test_writer` login with a three-connection limit. The login has **no password**. Its sole membership permits explicit SET ROLE, with ADMIN/INHERIT false. No existing reader, bootstrap, finance, Shopify, Xero or auth relation/grant is changed. Browser roles are explicitly denied table and RPC access. SQL results contain status/counts only.

The exact generated installer is reproducible with `node experiments/test-programme/prepare-activation-installer.mjs`; committed SQL matches its output. Password/secret provisioning is a separate private action through the approved credential interface. Do not put a password into committed SQL, chat, a shell command argument, stdout or a page screenshot. Use the existing verified session pooler and trusted CA; the runtime validates actual login capabilities and memberships before RPC use.

## Programme rows wait for actual provider evidence

The initial installer deliberately inserts **zero programme rows** because the actual Xero demo tenant has not been verified. The current accounting read tenant may be a trial organisation, which is not sufficient for `IsDemoCompany=true`. No UUID is invented. Shopify's pinned development target is `pocketlaunchpad1.myshopify.com` but must still report development status and GBP through the writer app's authenticated API.

After both provider targets are independently verified, `disabledProgrammeRowsSql({shopifyVerifiedDevelopment:true,xeroVerifiedDemo:true,xeroTenant:verifiedTenant})` generates private operator SQL for exactly two disabled programme rows, keys `shopify-staging-20261012` and `xero-staging-20261012`. Both cap six actions, start12 October2026 and hard stop26 October2026. Disabled rows perform no writes. The generator rejects unverified/malformed targets and the SQL refuses incompatible/used programme keys and preserves an exactly matching disabled Xero row already created by the consent callback; it never resets or replaces it. Private JSON config and rows must match exactly before enablement.

## Shopify writer provisioning

The existing collector is read-only. Its credentials are not silently reused or broadened. The generator needs a separately configured and installed same-organisation writer app targeting the pinned development shop, with `read_orders write_orders` (optional `read_all_orders`) and no other scope. Shopify client-credentials grant works only for an app and shop owned by the same organisation; official reference: https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant . Creating/updating/installing this separate app and its private client credentials is an external provisioning task, not accomplished by the database installer.

On each due run, the writer mints a fresh token and verifies actual granted scopes using the fixed shop `access_scopes` endpoint, then confirms exact development domain, GBP and partner-development status. No static token or collector credential fallback is allowed. Planned orders stay `test=true`, so collection activity and freshness can be verified while merchant revenue excludes them. Six nominal GBP60 orders cause no real charge, receipt, fulfilment or inventory change.

## Xero writer consent and envelope seeding

Use a separate test-writer OAuth client/consent identity rather than expanding the existing read-worker connection. Reauthorising the existing reader app with extra writes could rotate/invalidate its refresh token or fail its strict read-only scope contract. Writer consent must include `offline_access accounting.invoices accounting.settings.read`, optionally `accounting.contacts.read`, plus optional OpenID identity scopes. Do not request legacy `accounting.transactions`, payments, bank transactions, manual journals, contact writes or other broad writes.

Required provisioning remains concrete: registered writer redirect/callback, one-use state, OAuth code exchange handled privately, exact connected tenant and provider `IsDemoCompany=true` / GBP evidence, selected existing synthetic contact and non-stock revenue account, and encrypted first writer refresh envelope tied to the new programme. A separate writer bootstrap service/router is now implemented: authenticated owner-only POST `/api/xero/test-writer/connect`, callback `/api/xero/test-writer/callback`. The API now mounts this separate route before the SPA fallback and composes a server runtime with exact owner/store authentication and a restricted RPC pool. It remains default-off until the private hosted configuration is supplied and enabled. Its one-use state is stored only as a hash with owner/store binding and a ten-minute expiry. Callback consumes state before exchange, requires strict writer scopes and exact connected GBP demo evidence, encrypts the refresh material with a side-effect-free codec preserving the existing AES boundary, seeds only version1 and creates the disabled Xero programme if absent. Reseeding/replay is refused. The existing read-only callback is untouched. No token is returned to the browser or placed in public SQL/chat.

Once seeded, the runner obtains an atomic permanent refresh claim, decrypts only the separate writer envelope, rotates via Xero, re-encrypts and persists version+1 before provider use. Interrupted/uncertain refresh stops the programme and cannot auto-reclaim. Draft mode remains default. For meaningful booked-revenue testing, explicit `financialMode=posted_demo_only` plus action-time `NIGHT_SCOUT_TEST_WRITER_POSTED_DEMO_APPROVED=true` and fresh provider demo evidence are all required. Six GBP10 authorised invoices book at most GBP60 revenue and GBP60 receivables, no VAT, payment or email. Refreshing the independent read feed must then show the effects in the mapped accounting report; this is not Shopify revenue.

## Hosted writer callback configuration

The mounted API adapter uses these exact variable names (names only; no values in this document):

- `NIGHT_SCOUT_XERO_TEST_WRITER_BOOTSTRAP_ENABLED=true` and `NIGHT_SCOUT_RUNTIME_ENV=staging`.
- `NIGHT_SCOUT_TEST_PROGRAMME_PROJECT_REF=bioalckltvkhlczusdvl`.
- Existing dedicated public authentication configuration `NIGHT_SCOUT_REVIEW_AUTH_URL` / `NIGHT_SCOUT_REVIEW_PUBLIC_KEY`, and exact private owner/store bindings `NIGHT_SCOUT_XERO_STAGING_OWNER_ID` / `NIGHT_SCOUT_XERO_STAGING_STORE_ID`.
- Separate writer app `NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_ID` / `NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_SECRET`.
- `NIGHT_SCOUT_XERO_TEST_WRITER_REDIRECT_URI=https://night-scout-xero-staging.onrender.com/api/xero/test-writer/callback`.
- Optional `NIGHT_SCOUT_XERO_TEST_WRITER_EXPECTED_TENANT_ID` once the exact demo tenant is verified; absent configuration permits only one connected organisation and still requires its provider demo/GBP proof.
- Separate writer encryption `NIGHT_SCOUT_TEST_WRITER_ENVELOPE_MASTER_KEY` / `NIGHT_SCOUT_TEST_WRITER_ENVELOPE_KEY_VERSION`.
- Restricted writer connection `NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL` using the exact pinned session pooler, dedicated login and privately provisioned password.
- Existing trusted certificate file via `NODE_EXTRA_CA_CERTS`; TLS verification remains enabled. No insecure SSL URL overrides.

The mounted runtime rejects reuse of the reader app client ID or reader envelope master key. On every RPC transaction it verifies actual login/service-role capabilities and sole SET-only membership before selecting the service role locally. No bootstrap/admin/reporting database credential is accepted. CLI generator variable names for the same separate writer app are `NIGHT_SCOUT_TEST_WRITER_XERO_CLIENT_ID` / `NIGHT_SCOUT_TEST_WRITER_XERO_CLIENT_SECRET`; configure these in the generator's private environment, without renaming or altering the reader variables.

## Recurrence and acceptance

No recurring job is installed by SQL. Use existing approved hosting capacity, one due invocation per provider at18:00–18:14 Europe/London on12,13,17,19,20,24 October; no missed-day backdating or automatic renewal. Read collection remains a separate02:00 process. After configuration/consent readiness, enable the exact programme and worker flags, then verify first real action and subsequent collected/reporting evidence before claiming recurring generation works. An unsupported or uncertain result is a stop/reconciliation signal, never a reason to clear a claim or resend.

Tests verify atomic installation and replay refusal, null initial password, browser denial, absent targets refusing row generation, exact two disabled rows and read-only postflight. The broader provider suite covers credential renewal, safe shape checks, durable uncertainty and separately gated posted demo mode. No test is evidence that a live writer app, tenant, secret or scheduler has been provisioned.
