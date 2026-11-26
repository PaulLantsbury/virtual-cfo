# Google Ads staging integration — preparation only

> 26 November recovery: current source and gates are in `docs/integration-recovery/STAGING-PACKAGE-2026-11-26.md`. OAuth/mock preparation does not require a positive-spend account. Such historical spend is a future external acceptance gate, already known unavailable; no ads or spending should be created. No hosted activation is authorised.

**State: prepared locally; not release-ready and not activated.** This note is not approval to change Render, Supabase, Google Cloud, secrets, roles, tables, or schedules. The current checkout is broad and dirty; do not deploy it. Approved website baseline `3eda388d534b820728172e0edb7ab9b51d0cc3ad` is live on staging with hosted acceptance in progress. The local worktree cannot fetch the commit because network name resolution is unavailable. Port provider source only to a separate worktree from that baseline after data/design reconciliation; do not duplicate its deployment or delay its acceptance.

## Current readiness

- Google Ads scope is limited to account-level daily spend. No clicks, impressions, conversions, attributed sales, campaign editing, or ad creation are part of this integration.
- OAuth protocol, encrypted credential storage, direct/manager account discovery, account selection, separate API/report runtimes, and a bounded spend reader have local source and mocked tests.
- OAuth/account, report, and collector routes/runtimes are not mounted in the shared API app entry point. A disabled-by-default Google collector runtime and no-schedule one-off historical acceptance runner now have local source and mocked tests. The Google SQL files are proposals only and have not been applied or validated against staging.
- Google sunset developer tokens on 9 September 2026. Do not require, request, or configure a `developer-token` header. API access level is now associated with the Google Cloud project that owns the OAuth client. The staging prerequisite is to enable Google Ads API in that project (Test access) and, for any later production-account acceptance, verify the project has Explorer, Basic, or Standard access as required. Test access is limited to test accounts and does not establish production-account access.
- The project has no Google Ads account with historical positive spend available for live acceptance. Plumbing tests can use synthetic/mocked responses, but they do not establish provider connectivity or positive-spend reconciliation. Do not create an ad or spend to manufacture acceptance.
- Forty-two focused mocked Google tests pass across OAuth, account selection, exact-micros reading, fixed-RPC persistence/reporting, the disabled collector runtime, and the no-schedule acceptance runner. Full hosted Postgres/provider/browser acceptance has not run.

## Telemetry gate

Keep `NIGHT_SCOUT_GOOGLE_ADS_API_RUNTIME_ENABLED` and `NIGHT_SCOUT_GOOGLE_ADS_REPORT_RUNTIME_ENABLED` unset until this team verifies the deployed ingress and telemetry configuration. Google OAuth callbacks carry an authorization code and state in the inbound query string. The OAuth token exchange is an outbound **POST** whose form body contains the code, client secret, and refresh token; Google Ads requests carry OAuth access tokens in the Authorization header. Therefore verification must cover:

1. inbound request logs and any configured log streams for callback query strings;
2. outbound HTTP/APM capture for OAuth request bodies and Authorization headers; and
3. injected runtime agents or proxies that may capture outbound URLs, headers, or bodies.

Do not send test credentials or OAuth codes to inspect logs. If the platform boundary cannot be demonstrated to redact or disable capture, use an ingress/runtime where those settings are verifiable. Do not add paid APM for this check.

## Staging-only configuration proposal

First prepare a reviewed source revision containing the Google route/runtime/report wiring and isolated Google files, with no unrelated v11 changes, on separate worktree based on `3eda388d534b820728172e0edb7ab9b51d0cc3ad` once available locally. The current Render service tracks `codex/restart-baseline` with auto-deploy off; do not switch it to the dirty v11 branch. A future reviewed package must name the exact source revision, build, callback, and environment change set before staging activation.

The API runtime reads these server-side values:

| Variable | Purpose |
| --- | --- |
| `NIGHT_SCOUT_GOOGLE_ADS_API_RUNTIME_ENABLED` | Explicit API runtime opt-in; unset until package review and telemetry gate pass |
| `NIGHT_SCOUT_RUNTIME_ENV` | Must be `staging` |
| `NIGHT_SCOUT_GOOGLE_ADS_STAGING_PROJECT_REF` | Pinned Night Scout staging Supabase project |
| `NIGHT_SCOUT_STAGING_CA_PEM` | Existing verified staging CA |
| `NIGHT_SCOUT_GOOGLE_ADS_ENVELOPE_MASTER_KEY` / `_ENVELOPE_KEY_VERSION` | Envelope encryption material and stable key version |
| `NIGHT_SCOUT_GOOGLE_ADS_PKCE_KEY` | Server-only PKCE derivation key |
| `NIGHT_SCOUT_GOOGLE_ADS_CLIENT_ID` / `_CLIENT_SECRET` | Google OAuth web client credentials |
| `NIGHT_SCOUT_GOOGLE_ADS_REDIRECT_URI` | Exact registered callback for the selected staging host |
| `NIGHT_SCOUT_GOOGLE_ADS_ALLOWED_ORIGIN` | Matching exact staging origin |
| `NIGHT_SCOUT_GOOGLE_ADS_STAGING_OWNER_ID` / `_STAGING_STORE_ID` | Fixed owner and store binding for staging |
| `NIGHT_SCOUT_GOOGLE_ADS_API_DATABASE_URL` | Dedicated API login URL only |
| `NIGHT_SCOUT_REVIEW_AUTH_URL` / `_PUBLIC_KEY` | Existing staging Supabase Auth values |

The separate report runtime reads `NIGHT_SCOUT_GOOGLE_ADS_REPORT_RUNTIME_ENABLED` and `NIGHT_SCOUT_GOOGLE_ADS_REPORT_DATABASE_URL`, plus the pinned staging project, CA, owner/store, and Auth values above. It must not receive the OAuth client secret or envelope key. Both runtimes fail closed unless explicitly enabled and verify the database role identity.

The Settings active-company selector is context only. Before OAuth, confirm that the displayed business is the intended staging target; the server must enforce the fixed owner/store binding and membership. Do not treat a browser-supplied `storeId` as authority, reuse credentials across stores, or silently switch businesses. This follows the integration-lane handover in `docs/handoffs/xero-staging-company-binding-2026-11-21.md`; that Xero note is guidance only and does not authorize or imply any Xero source/setup change.

The separate collector runtime and manual acceptance command add these controls:

| Variable | Purpose |
| --- | --- |
| `NIGHT_SCOUT_GOOGLE_ADS_COLLECTOR_RUNTIME_ENABLED` | Explicit opt-in for the separate collector runtime; unset by default |
| `NIGHT_SCOUT_GOOGLE_ADS_COLLECTOR_DATABASE_URL` | Dedicated collector login URL only; distinct from API/report logins |
| `NIGHT_SCOUT_GOOGLE_ADS_COLLECTOR_ENABLED` | Explicit one-off collection gate; unset by default |
| `NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_ENABLED` | Explicit one-off acceptance gate; unset by default |
| `NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_STORE_ID` | Must equal the already pinned staging store ID |
| `NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_FROM` / `_TO` | Exact inclusive account-local completed-day window, at most 14 days |
| `NIGHT_SCOUT_GOOGLE_ADS_ACCEPTANCE_RETRY_ORDINAL` | Small bounded retry suffix for idempotency; defaults to `0` |

The collector runtime also requires the server-side OAuth client ID/secret, envelope key/version, staging CA, pinned project, and exact redirect URI. It uses a dedicated collector DB login and the fixed worker RPC allowlist. The acceptance runner is a manual one-off (`node deployments/nightly-staging/run-google-ads-acceptance.mjs`), takes no command-line account or date overrides, and does not create a schedule. It requires one selected account bound to the pinned store, validates Google-reported currency and IANA timezone, caps the range at 14 completed account-local days, stores exact integer micros, and preserves days without provider rows as unknown. It reports only coverage and whether positive spend was observed; it does not invent spend or print spend totals. All flags remain unset until the full staging package is separately reviewed.

The proposed schema/RPC files are:

1. `db-migrations/proposals/google-ads-spend-store-2026-11-21.sql`
2. `db-migrations/proposals/google-ads-spend-rpcs-2026-11-21.sql`
3. `db-migrations/proposals/google-ads-spend-read-rpc-2026-11-21.sql`

The final package must include an independent privilege review, exact role-membership/ownership checks, confirmation that the OAuth client's Google Cloud project has Google Ads API enabled and the required access level, and a tested reverse/disable plan for any SQL it asks to apply. Do not apply proposals from this preparation note.

## Acceptance and disable plan

After a reviewed staging build is healthy, telemetry is verified, the Google Cloud project has the required access level, and the owner has a read-only Google Ads account with historical costs:

1. Complete OAuth using only the `https://www.googleapis.com/auth/adwords` scope and `offline` access. Confirm direct/manager account discovery and select one explicitly.
2. Verify Google-reported customer currency and IANA timezone. Compare account-level daily `cost_micros` with Google Ads for a closed completed period. Preserve missing days as missing; do not convert micros or timezones implicitly.
3. For an OAuth project in Testing mode, the refresh token expires after seven days. The current proposal prompts for re-consent by day six; confirm the status screen surfaces that deadline. Revocation and other token invalidation remain possible at any time.
4. Disable one-off acceptance/collector controls immediately after reconciliation. Keep the recurring collector disabled until positive-spend acceptance is explicitly reviewed.

### Disconnect and rollback order

If a Google account was connected, first disable one-off acceptance and collection controls and remove any future schedule. While the API runtime is still available, use its owner-only disconnect flow to remove the locally stored encrypted credential. This local action does **not** revoke Google's OAuth grant. The owner must separately revoke the Night Scout grant in Google Account security settings. After both actions, disable the API, report, and collector runtimes, restart/stop the reviewed staging service, and revoke the database logins' `LOGIN` and `CONNECT` access using the reviewed rollback SQL. Preserve collected spend rows. Do not drop schema or roles as part of routine disable; any later removal requires a separately reviewed migration and retention decision.

If no account was connected, turn off all Google runtime/one-off controls, remove schedules if any were ever created, then revoke the database logins and preserve any spend rows. Restore a previously reviewed source revision through the coordinated release process. Do not use source rollback as a substitute for disabling access or deleting stored credentials.

## Evidence boundary

Mocked tests and static source review are engineering evidence only. They are not Google Ads authentication, API acceptance, historical-spend reconciliation, staging deployment, or production readiness. No Google account was connected and no live Google request, database change, secret change, or deployment is part of this preparation.
