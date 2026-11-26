# Meta and Google Ads spend integrations — 20 November 2026

## Decision

Build direct, read-only reporting integrations for Meta Ads and Google Ads. The approved first scope is **account-level advertising spend by provider account and provider-local day**.

Do not import campaign, ad-set, or ad rows; clicks; impressions; conversions; attributed orders or revenue; ROAS; audiences; or any capability to create or change advertising. Night Scout can combine spend with its independently sourced Shopify trading and profit measures. Provider-attributed sales are not Night Scout sales evidence.

This is an agreed product direction and implementation proposal. A local experimental Meta reader now includes account discovery and account/day spend normalization under `experiments/marketing/meta-spend-reader.mjs`; its synthetic manual proof exercised pagination, exact minor-unit conversion, missing-day handling, and rejection of extra metrics. On 20 November, the Night Scout app was created under The Pocket CFO business portfolio and the existing Profit Launchpad ad account was authorized with `ads_read` in Graph API Explorer. Account discovery and the first page of historic daily spend were returned without creating new spend. This was an owner-led Graph API Explorer check; it did not run through Night Scout code, persist data, verify timezone metadata through the reader, or compare totals against Ads Manager. A first Google Ads daily-spend reader prototype is now prepared locally at `experiments/marketing/google-ads-spend-reader.mjs`; it has not been tested against Google or connected to OAuth, storage, the API, or UI.

The local implementation slice also includes server-side OAuth, encrypted credential handling, account selection and a bounded daily collector. The Settings page has a spend-only Meta connection card. The Marketing Efficiency page has a separate account-local spend panel, defaulting to the last 30 completed days, with an optional historical range up to 93 days; it uses exact currency formatting and explicit coverage, and does not feed sample marketing metrics or calculate CAC/ROAS. A read-only reporting endpoint uses a dedicated report login and fixed store-scoped RPC, separate from OAuth/API and collector roles. The report runtime, API and daily worker remain disabled until configured. A one-off historical acceptance runner is prepared to verify an existing spend period without creating ads or spend. The base schema, API/collector RPC proposal and report RPC proposal (`db-migrations/proposals/meta-ads-spend-read-rpc-2026-11-20.sql`) are unapplied and untested. The schema proposal removes raw browser table reads; merchant spend goes through the bounded report RPC. A Supabase REST/service-key call will not satisfy the RPCs' `session_user` guard. There is no active schedule, live staging connection or deployment. Never copy the Graph API Explorer token into Night Scout or project files. The app secret has not been collected.

Read-only staging inspection on 20 November found no Meta migration, no `meta_ads_v1` tables, and none of the three Meta role pairs in the connected Supabase project. The Render manifest tracks `codex/restart-baseline`, while this implementation checkout is `codex/v11-verified-20261031`; the implementation must reach the configured source branch before a staging build can use it. The Render manifest has no Meta cron resource. These checks confirm that Meta setup has not yet been applied or deployed.

### Historical spend acceptance

The scheduled daily runner collects a rolling 31 completed account-local days. Because the existing Profit Launchpad account may have no recent spend, use the separately gated `deployments/nightly-staging/run-meta-ads-acceptance.mjs` to collect a previously completed period with actual spend; 7–14 days is preferable, and the one-off runner caps each request at 14 dates. Meta's [Ad Account Insights reference](https://developers.facebook.com/docs/graph-api/reference/adaccount/insights/) documents a 37-month time-range limit. The runner accepts only the server-discovered active account for the fixed staging store and has no account CLI override. After collection, load the same date range in Marketing Efficiency and compare daily amounts and currency with Ads Manager. Record timezone, API version, date range, per-day values, coverage, observation timestamps and any differences; never retain tokens or app secrets. If no historic positive-spend range is available, accept coverage/no-row handling separately and defer positive-amount reconciliation rather than creating spend.

## Why direct provider reporting

Shopify may expose marketing engagement spend when a connected marketing channel shares cost data, but it cannot be assumed to do so for both providers. The current Shopify supported-app list names Google & YouTube as early access and does not list Meta as a marketing-engagement data-sharing app. Direct integrations give Night Scout a consistent source for both providers and avoid depending on each merchant's Shopify app configuration.

Xero payment records remain useful as later cash/reconciliation evidence, not as the date-of-ad-delivery spend series. Existing Xero scopes and readers do not collect individual bank transactions; payment collection would require additional access and would still show the payment date and settlement amount rather than daily delivery cost.

## Minimum provider data

For each connected and explicitly selected ad account, retain only:

- provider namespace (`meta_ads` or `google_ads`) and provider account ID;
- provider-local reporting date, account timezone, and account currency;
- daily account-level spend as returned by the provider, retaining provider-native precision (Meta minor units, Google integer micros) without an implicit FX conversion;
- request/observation timestamp, API version, and a bounded collection outcome/coverage state.

Keep accounts and currencies separate unless they share a currency. No FX conversion is part of this package. An unavailable or incomplete day is not zero. Only an explicit provider zero can be shown as zero. Exclude the current incomplete provider-local day from completed-day comparisons.

Use a short rolling re-read window for recent completed days to handle provider corrections, while retaining observation history or an explicit version so a changed provider value is reviewable. Initial window length, retention and schedule are implementation choices to confirm against provider limits and the existing scheduled-reader design before activation.

## Provider access and constraints

### Meta Ads

- Use Meta Marketing API Ads Insights at ad-account level, requesting only date and spend, with daily time increment and the selected account's timezone/currency metadata.
- Request `ads_read`; never request ad-management or write permissions.
- The Meta developer app exists under the user's Pocket CFO business portfolio; the app has not been published and production access/review requirements remain to be checked before multi-merchant use. The exact HTTPS callback still needs to be implemented and registered. Tokens must be envelope-encrypted at rest and isolated by Night Scout business/store.
- The owner test succeeded with an app-role user. It does not prove ordinary Night Scout customers can authorize the app. Meta documents that Standard Access is limited to app-role users; customer access generally requires Advanced Access/App Review. Meta also lists `ads_read` among permissions that a business-owned app cannot obtain from users outside the app role unless the business is verified as a Tech Provider. The Pocket CFO business profile showed as unverified during app setup. Confirm the exact current Access Verification, App Review, business-verification and Tech Provider requirements for this app before planning customer onboarding. No broader permission is justified by the spend-only scope.
- Verify pagination, delayed/corrected spend, account access and privacy-policy requirements in the current API version before building the collector.

### Google Ads

- Use the Google Ads API reporting service only, at customer/account level: request `segments.date`, `metrics.cost_micros`, `customer.currency_code`, and `customer.time_zone`; do not fetch clicks, impressions, conversions, campaign detail or billing data. Keep `cost_micros` as an integer string through storage and transport; convert to display currency only at the presentation boundary.
- The first `listAccessibleCustomers` reader lists customers the user can access directly; it does not enumerate client accounts beneath a manager. Before customer onboarding, either build and review manager-hierarchy discovery or explicitly require direct user access to the selected advertiser. The report account and optional manager login ID must be fixed server-side after selection.
- Use OAuth scope `https://www.googleapis.com/auth/adwords`. Google does not offer a read-only OAuth scope, so least privilege comes from a Google Ads user with **Read-only** account role, server-side reporting-only methods, and a server-bound selected customer ID. Include `login-customer-id` only when access is through a manager account; do not accept customer or manager IDs from browser requests.
- Google classifies the Ads OAuth scope as restricted; complete Google OAuth app verification before productionizing customer authorization. For staging, limit the consent app to configured test users and keep client secrets/refresh tokens server-side and encrypted.
- **Current access model:** for new API users, Google sunset developer tokens on 9 September 2026. Enable Google Ads API on the Cloud project that owns the OAuth client to get Test access, then apply for Explorer access in Cloud Console to query production accounts. Do not follow legacy instructions to create a manager account or obtain a developer token for this new integration. Confirm current access level and project verification requirements before production onboarding.
- Test accounts are free and useful for OAuth/query plumbing, but they do not serve ads and their serving cost metrics are empty. They cannot prove positive spend or reconcile totals. Once Explorer access is available, verify a historic period on an existing active account using a read-only Ads user; no test campaign or new spend is needed.
- Google evaluates report dates in the serving account's timezone. The current API documentation allows daily history for up to 37 months. Start with a bounded 93-day application request and re-fetch a rolling recent window to absorb reporting updates; do not infer missing dates as zero.

## Product and financial boundary

The first consumer is Growth & Marketing: show spend by platform over time, with account coverage and freshness visible. Use the same page period controls and Shopify reporting period. Aggregate platforms only when currency and date basis match.

Do not automatically replace or add to Xero advertising expenses in Profit Engine. The approved financial definition deducts advertising expenditure once. Before direct platform spend affects Contribution, prepare a separate reconciliation/source-selection change that covers Xero advertising bills, agency fees, credits, tax treatment and duplicate expense prevention. Until then, platform spend is a marketing analysis input, not a second accounting deduction.

Marketing efficiency derived from Night Scout's own supported trading/profit data must be labelled with its denominator and basis. A blended business-level measure is distinct from channel-attributed profit. Do not claim channel-specific POAS from account spend alone.

## Delivery sequence

1. **Current architecture check — completed locally:** the existing Xero user flow is a local development reader that stores its test snapshot and mapping files locally; the separate staging worker has an encrypted credential-envelope pattern. Neither is a reusable multi-merchant Meta/Google connection. Xero's current scope list is Settings plus selected reports; it does not include individual bank transactions. The existing v11 Settings concepts distinguish credentials, collection, and financial coverage. Preserve the in-progress v11 files and do not modify any live provider connection.
2. **Provider proof — owner test account authorized:** Graph API Explorer returned accessible account metadata and historic spend using `ads_read`; no ad spend was created. The local spend reader and OAuth/encryption helpers remain synthetic/local only. Next, complete one bounded read through the server adapter and compare the same dates with Ads Manager before treating provider values as accepted.
3. **OAuth, runtime and collector orchestration — implemented locally, not enabled:** `meta-oauth-service.mjs`, `meta-spend-collector.mjs` and the separate API/collector runtimes define the server flow. The API is restricted to a configured staging owner/store and API-only database grants; the collector has a separate login and no app secret or owner authentication. The status endpoint exposes reauthorization-required after token expiry. API startup is wired but remains disabled without full staging configuration. The daily 31-day rolling collector entry point and 16:10 UTC schedule proposal are prepared but inactive.
4. **Storage and fixed RPC proposals — prepared, split by capability, independently reviewed by inspection, unapplied:** `db-migrations/proposals/meta-ads-spend-store-2026-11-20.sql` and `meta-ads-spend-rpcs-2026-11-20.sql` define store-bound connections, one-use OAuth state, pending account selection, encrypted credentials, one selected Meta account per store, leased collection runs, daily observations, active-account discovery and safe connection status. The RPC proposal separates OAuth/API and collector groups/logins and checks effective per-function grants after provisioning. Review fixes cover stale-lease reclaim, ACLs, cleanup lock order, OAuth-state retention and expiry/reconnect credential cleanup. The proposals remain untested and unapplied. Before enabling, confirm role grants and database-wide privileges against staging. Terminally failed runs require a fresh retry ordinal/idempotency key for the same account and range; an expired `running` lease can be reclaimed with the same key. Meta user tokens can be exchanged server-side for long-lived tokens (generally about 60 days); plan for expiry/re-consent rather than assuming a permanent credential. See the official [manual OAuth flow](https://developers.facebook.com/documentation/facebook-login/guides/advanced/manual-flow) and [long-lived token guide](https://developers.facebook.com/documentation/facebook-login/guides/access-tokens/get-long-lived).
5. **Google connector slice — reader prototype prepared locally:** `google-ads-spend-reader.mjs` lists directly accessible customer IDs and requests only the daily account cost metric plus currency/timezone. It keeps micros exact, marks absent dates separately, bounds requests to 93 days, and supports an optional manager login ID for a previously selected client. It is not yet tested or connected to OAuth/persistence. Next add safe OAuth refresh-token handling, decide whether the first onboarding requires direct advertiser access or discovers manager hierarchies, then implement server-selected customer binding and separate fixed-RPC storage/report/collector capabilities, keeping Google credentials and manager-account identifiers separate from Meta.
6. **Settings and display:** add Meta Ads and Google Ads as separate connection rows, distinguishing credentials, collection status, and financial coverage. Add a spend-only source contract to Growth & Marketing. Show source account/currency/timezone and last successful period in Explore the Numbers.
7. **Local verification and staging proposal:** after implementation, check positive, zero, missing, partial, duplicate, stale, changed-history, multi-account, mixed-currency, timezone-boundary, expired/revoked-token, and cross-store access cases. These are not live acceptance. Before enabling OAuth, ensure outbound HTTP/APM telemetry redacts sensitive query strings and request/response bodies. Prepare exact callbacks, secrets, schemas and separate API/collector worker enablement steps for review; do not apply a migration, broaden OAuth consent, add hosting spend, or publish to production as part of preparation.
8. **Live acceptance, separately approved:** after app access, schema and staging deployment are approved, connect a designated Meta test account and a Google account with existing historical spend and read-only user access. Compare account-day totals with each provider UI for a fixed window, verify restart/idempotency, token expiry/re-consent and credential deletion on disconnect, then show the result only after coverage and currency checks pass. A Google test account cannot supply positive serving spend for this comparison.

## Exit criteria

- One selected account per provider can be connected by OAuth without any advertising write operation.
- Daily account spend, date, timezone, currency, source identity, retrieval time and completeness are preserved distinctly.
- Missing, stale, partial, revoked or ambiguous data is visible as unavailable and is never silently treated as zero.
- Meta and Google values are not mixed across account currencies or platform attribution claims.
- Growth & Marketing can show spend with an inspectable source and formula; Profit Engine does not double-count Xero expense evidence.
- Local checks, staging acceptance, and production status are each recorded separately.

## Official references reviewed

- [Meta Ads Insights API](https://developers.facebook.com/docs/marketing-api/insights/)
- [Meta OAuth manual flow](https://developers.facebook.com/documentation/facebook-login/guides/advanced/manual-flow)
- [Meta access levels and app review](https://developers.facebook.com/docs/resp-plat-initiatives/app-review/introduction)
- [Meta Tech Provider access](https://developers.facebook.com/docs/development/release/tech-providers/)
- [Google Ads API access model](https://developers.google.com/google-ads/api/docs/oauth/access-model)
- [Google Ads API access levels](https://developers.google.com/google-ads/api/docs/api-policy/access-levels)
- [Google Ads developer-token sunset and new project access flow](https://developers.google.com/google-ads/api/docs/api-policy/developer-token)
- [Google Ads test accounts](https://developers.google.com/google-ads/api/docs/best-practices/test-accounts)
- [Google Ads date ranges and account timezone](https://developers.google.com/google-ads/api/docs/query/date-ranges)
- [Google Ads API OAuth](https://developers.google.com/google-ads/api/docs/oauth/overview)
- [Google Ads OAuth access model and account roles](https://developers.google.com/google-ads/api/docs/oauth/access-model)
- [Google Ads secure credentials and OAuth verification](https://developers.google.com/google-ads/api/docs/productionize/secure-credentials)
- [Google Ads REST search paging](https://developers.google.com/google-ads/api/docs/reporting/paging)
- [Shopify marketing app data sharing](https://help.shopify.com/en/manual/promoting-marketing/analyze-marketing/app-data-sharing)
- [Xero OAuth scopes](https://developer.xero.com/documentation/guides/oauth2/scopes/)
