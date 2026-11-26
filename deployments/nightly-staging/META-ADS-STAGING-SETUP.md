# Meta Ads staging activation package — prepared, gated, not activated

> 26 November recovery: use `docs/integration-recovery/STAGING-PACKAGE-2026-11-26.md` for current source, testing, ownership and gates. Older live-baseline/network/UI claims below are historical. No schedule, retry or activation is authorised. The recovered UI components are not wired into current pages.

This is the exact owner-only, read-only staging sequence for Meta spend. It does not authorize or apply SQL, provision roles, write secrets, enable the runtime, or create a schedule. The package is not ready to activate until the source/test gate and telemetry gate below are closed.

## 0. Prepare source from the approved website baseline

The approved website baseline is `3eda388d534b820728172e0edb7ab9b51d0cc3ad`, now live on staging with hosted acceptance in progress. The local dirty worktree cannot fetch the commit because network name resolution is unavailable; preserve it. Prepare provider integration in a separate worktree from this exact baseline after data/design reconciliation. Do not duplicate the website deployment or block its acceptance on this provider package.

The existing Render web service `night-scout-xero-staging` currently tracks `codex/restart-baseline` with auto-deploy off. Do not deploy that old branch or point the service at the broad dirty v11 branch. Once the approved baseline is available locally, port only reviewed Meta changes onto `3eda388d534b820728172e0edb7ab9b51d0cc3ad`, reconcile data/design changes, and verify the Meta-only diff and tests. Verify the target build contains the Meta API, report runtime, collector, UI and SQL proposals. No Meta cron is configured.

## 0a. Close the URL logging gate before OAuth

The application request logger removes inbound query strings, and the API source contains no APM/tracing SDK. However, the existing read-only Render service response does not expose workspace request-log, log-stream, or injected-agent configuration. Render's current documentation says Pro-and-higher HTTP request logs display a “Requested URL,” but does not document whether query strings are removed; log streams forward configured service logs. This does not prove retention, but it leaves query handling unverified. Treat callback code/state and Meta's outbound token-exchange query parameters (which include sensitive OAuth material) as potentially captured until the team closes the platform boundary.

Keep `NIGHT_SCOUT_META_ADS_API_RUNTIME_ENABLED` unset and do not start OAuth until the team verifies how Render request logs and workspace log streams handle query strings and that no injected runtime instrumentation captures outbound URLs or credentials. Do not send a test OAuth code or secret to inspect logs. If behavior cannot be established, use an ingress/runtime whose sensitive URL capture is demonstrably disabled or redacted. No new paid APM is needed or proposed.

## 1. Prepare the staging database roles

Provision three separate role pairs using the database administrator's secure process:

| Capability | Group role | Login role |
| --- | --- | --- |
| Owner OAuth and connection status | `night_scout_meta_ads_api_group` (`NOLOGIN`) | `night_scout_meta_ads_api_login` (`LOGIN`) |
| Read-only daily spend report | `night_scout_meta_ads_report_group` (`NOLOGIN`) | `night_scout_meta_ads_report_login` (`LOGIN`) |
| Scheduled spend collection | `night_scout_meta_ads_collector_group` (`NOLOGIN`) | `night_scout_meta_ads_collector_login` (`LOGIN`) |

Each login must inherit privileges only from its matching group, must not own objects, and must have no other role memberships or database-wide grants. Use separate high-entropy passwords and store them only in the staging secret store. The database URL must use the fixed staging host and the exact matching login name. The API/collector RPC proposal checks their effective grants; the report RPC proposal separately checks report-role access and confirms that direct browser table reads remain revoked.

Review and apply the base schema proposal first, then the API/collector RPC proposal, then the separate report RPC proposal through the normal staging review. The report login can execute only its bounded daily spend read and has no raw table access. Confirm database-wide ownership, direct grants, default grants and `PUBLIC` privileges for every login before enabling any runtime.

The API/collector proposal also grants the API role the fixed `meta_ads_v1.worker_cancel_pending_selection(bytea,uuid,uuid,timestamptz)` RPC. It permits immediate owner/store-bound deletion of an unexpired pending account selection and its encrypted credential envelope, with a `credential_deleted` audit entry. It does not expose this operation to the collector or report role and does not delete spend observations.

## 2. Configure the API service

Set these values in the staging API secret store, never in this repository:

| Variable | Purpose |
| --- | --- |
| `NIGHT_SCOUT_META_ADS_API_RUNTIME_ENABLED` | Explicit opt-in; leave unset until the bounded staging read is approved |
| `NIGHT_SCOUT_RUNTIME_ENV` | Must be `staging` |
| `NIGHT_SCOUT_META_ADS_STAGING_PROJECT_REF` | Must be the pinned Night Scout staging project reference |
| `NIGHT_SCOUT_META_ADS_API_DATABASE_URL` | Direct or session-pooler URL for the API login only |
| `NIGHT_SCOUT_STAGING_CA_PEM` | Existing verified staging database CA certificate |
| `NIGHT_SCOUT_META_ADS_ENVELOPE_MASTER_KEY` | Random secret material of at least 32 bytes, shared with the collector runtime |
| `NIGHT_SCOUT_META_ADS_ENVELOPE_KEY_VERSION` | Stable version label for the encryption key |
| `NIGHT_SCOUT_META_ADS_API_VERSION` | Pin to `v27.0` for this package; Meta's current official versioning guide lists v27.0 as latest and guarantees each version for at least two years. Recheck at activation and review the Marketing API changelog before changing it. |
| `NIGHT_SCOUT_META_ADS_APP_ID` / `NIGHT_SCOUT_META_ADS_APP_SECRET` | Night Scout Meta app credentials |
| `NIGHT_SCOUT_META_ADS_REDIRECT_URI` | Exact callback URI registered in the Meta app |
| `NIGHT_SCOUT_META_ADS_ALLOWED_ORIGIN` | Exact matching staging origin for the callback and browser requests |
| `NIGHT_SCOUT_META_ADS_STAGING_OWNER_ID` / `NIGHT_SCOUT_META_ADS_STAGING_STORE_ID` | The one owner and store allowed by this staging runtime |
| `NIGHT_SCOUT_REVIEW_AUTH_URL` / `NIGHT_SCOUT_REVIEW_PUBLIC_KEY` | Existing staging Supabase Auth endpoint and publishable key |

The runtime accepts only the two fixed staging origins and their matching `/api/meta-ads/callback` URLs. Select one host, register its exact callback in Meta, and use its origin in the allowlist. The API startup verifies the PostgreSQL `session_user` and `current_user`; it fails closed on a different role, host, project or incomplete configuration. The Settings active-company selector is context only: the posted `storeId` must match the fixed staging owner/store and server-side membership checks. Confirm the selected Settings business is the intended staging company before starting OAuth; do not treat a browser-supplied store ID as authority or silently switch businesses.

## 3. Configure the spend reporting API separately

The report runtime has its own database login and can call only the read-only `worker_read_daily_spend` RPC. It does not receive the Meta app secret or encryption key. Keep it disabled until the report RPC proposal and role grants are reviewed and applied.

| Variable | Purpose |
| --- | --- |
| `NIGHT_SCOUT_META_ADS_REPORT_RUNTIME_ENABLED` | Explicit opt-in; unset until the reporting read is approved |
| `NIGHT_SCOUT_META_ADS_REPORT_DATABASE_URL` | Direct or session-pooler URL for the report login only |
| `NIGHT_SCOUT_RUNTIME_ENV`, `NIGHT_SCOUT_META_ADS_STAGING_PROJECT_REF` | Must identify the pinned staging environment |
| `NIGHT_SCOUT_STAGING_CA_PEM` | Existing verified staging database CA certificate |
| `NIGHT_SCOUT_META_ADS_STAGING_OWNER_ID` / `NIGHT_SCOUT_META_ADS_STAGING_STORE_ID` | Same fixed owner/store used by the staging connection runtime |
| `NIGHT_SCOUT_REVIEW_AUTH_URL` / `NIGHT_SCOUT_REVIEW_PUBLIC_KEY` | Existing staging Supabase Auth endpoint and publishable key |

The endpoint accepts only the store and a date range of at most 93 days. The database function checks store membership and returns only the active selected ad account, with daily coverage and exact minor-unit spend. Do not add browser table grants or reuse the OAuth or collector database URL.

## 4. Run one historical acceptance collection

Use this only after the API connection and report runtime are working and the URL logging gate is closed. PM has supplied a suitable closed 14-day period with positive spend; it is within Meta Insights' current 37-month lookback. Keep exact dates and observed amounts in the private operational handoff or secure one-off configuration, not repository files. No new ads or spend are required. Configure the following only for this one-off run:

Use the supplied dates as an inclusive range in the API runner. The current reader sends `since=FROM` and `until=TO`; do not add a day to `TO` based on a UI link's exclusive endpoint. The Ads Manager evidence relayed by PM is campaign-level, not a verified whole-account total: compare the API's full account-level daily rows with Ads Manager account-level daily totals for the same inclusive period, rather than summing only named campaigns. The UI says dates are shown in London Time; use `Europe/London` as the working expectation, then confirm the selected account's API `timezone_name` before comparing. Do not recut these account-local days in UTC. Confirm the exact account timezone before acceptance.

| Variable | Purpose |
| --- | --- |
| `NIGHT_SCOUT_META_ADS_COLLECTOR_RUNTIME_ENABLED=true` | Explicitly enables the collector runtime |
| `NIGHT_SCOUT_META_ADS_COLLECTOR_ENABLED=true` | Explicitly enables the collection command |
| `NIGHT_SCOUT_META_ADS_ACCEPTANCE_ENABLED=true` | Explicitly enables the historical acceptance runner |
| `NIGHT_SCOUT_META_ADS_ACCEPTANCE_STORE_ID` | Must exactly match the fixed staging store ID |
| `NIGHT_SCOUT_META_ADS_ACCEPTANCE_FROM` / `_TO` | Explicit completed account-local dates, no more than 14 days inclusive and within Meta’s current history limit |
| `NIGHT_SCOUT_META_ADS_ACCEPTANCE_RETRY_ORDINAL` | Optional; defaults to `0`, increment only after a terminally failed attempt |

Run `node deployments/nightly-staging/run-meta-ads-acceptance.mjs` once. The runner discovers the selected ad account from the server-side store binding and rejects command-line overrides. It prints coverage counts, currency, timezone, date range, run ID and observation time; spend values remain available through the authenticated report endpoint and Marketing Efficiency page. Load the same inclusive dates in the page and compare each daily amount with Ads Manager account-level daily totals. Turn off the acceptance and collector command flags after the comparison. If the account-level API timezone differs from `Europe/London`, resolve the date interpretation before accepting the reconciliation.

## 5. Configure the scheduled collector separately

The collector secret store needs the shared staging CA, envelope master key/version, API version, fixed project reference, and `NIGHT_SCOUT_META_ADS_COLLECTOR_DATABASE_URL` for the collector login. It does not need the Meta app secret, Supabase user authentication, or a configured owner ID.

The worker entry point requires both `NIGHT_SCOUT_META_ADS_COLLECTOR_RUNTIME_ENABLED=true` and `NIGHT_SCOUT_META_ADS_COLLECTOR_ENABLED=true`. Its proposed schedule is `10 16 * * *` UTC; keep it inactive until the first bounded server-side read has been compared with Meta Ads Manager. A terminal failure on the same account/range/day requires an incremented `NIGHT_SCOUT_META_ADS_RETRY_ORDINAL`; an expired running lease can be reclaimed using its existing key.

## 6. Checks before enabling

- Confirm outbound HTTP/APM logging redacts query strings. Meta's OAuth token-exchange URL carries the authorization code and app secret in query parameters.
- Confirm the app consent asks for `ads_read` only and the owner account still has the required app-role access.
- Start the API only after the schema, roles and all secrets are configured. The route stays unavailable until the API runtime is fully configured.
- Connect the authorized account, confirm currency and account timezone, collect a bounded period, and compare fixed daily totals with Ads Manager.
- Check the status endpoint for collection freshness, coverage and reauthorization-required state.
- Keep the scheduled collector disabled until this bounded read is accepted. No advertising spend is needed to test read access.

The owner-only staging runtime does not establish multi-merchant customer authorization. Confirm Meta Advanced Access, App Review and business/Tech Provider requirements before offering connections to other stores.

Logging boundary references: [Render request and application logs](https://render.com/docs/logging), [Render log streams](https://render.com/docs/log-streams), and Meta's [system-user token endpoint guidance](https://developers.facebook.com/docs/business-management-apis/system-users/install-apps-and-generate-tokens/).

## 7. Disable and rollback sequence

This is a preparation-only rollback plan; no hosted state has been changed. If an activation check fails or the connection must be stopped:

1. In the staging secret store, immediately set `NIGHT_SCOUT_META_ADS_ACCEPTANCE_ENABLED`, `NIGHT_SCOUT_META_ADS_COLLECTOR_ENABLED`, `NIGHT_SCOUT_META_ADS_COLLECTOR_RUNTIME_ENABLED`, `NIGHT_SCOUT_META_ADS_REPORT_RUNTIME_ENABLED`, and `NIGHT_SCOUT_META_ADS_API_RUNTIME_ENABLED` to false or remove them. Stop/remove any Meta collector schedule. Verify the worker and API report the disabled state before continuing.
2. If OAuth completed, use the Settings **Disconnect** action for the selected store/account, which removes its encrypted credential while retaining historical spend evidence. If OAuth credentials may have been exposed, revoke the app/account authorization in Meta's security controls and rotate/revoke the Meta app secret; remove the old secret from the staging secret store. Never put tokens or secrets in this repository or chat.
   If the owner cancels during account selection, use the account-selection **Cancel** action: the server deletes the still-valid pending connection and encrypted envelope immediately, audits credential deletion, and clears the browser cookie only after that deletion succeeds. An already expired or unmatched selection returns a generic unavailable response; normal expiry cleanup handles expired pending credentials.
3. Restore the exact previously reviewed staging source revision through the normal branch review and service deploy process. Do not point the service at `codex/restart-baseline` or the dirty v11 branch as a shortcut. Verify the service health check and that the Meta routes remain unavailable after the runtime flags are disabled.
4. For the database, first disable the runtime and revoke the three Meta login roles' `LOGIN` and database `CONNECT` access (or remove their matching group memberships) through the reviewed DBA process. Do not drop tables, collection runs, or spend observations: they are evidence and may be needed for diagnosis. Keep schema and data in place until a separate reviewed data-retention decision exists. If activation stopped before any data was written, any role/schema removal still requires a separately reviewed reverse migration that checks dependencies and ownership; no destructive rollback SQL is included in this package.
5. Confirm no Meta cron remains, API/report/collector flags are off, the selected credential is disconnected or revoked, the previous source revision is healthy, and retained evidence is still labelled as staging provider data. Do not resume collection until a new concrete package review.
