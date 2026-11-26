> Baseline readiness review. For the executable install, host isolation and collection sequence, the newer ACCESS.md, ISOLATION.md, LOGGING.md and COLLECTION.md in this directory take precedence over the earlier manual setup outline below. No provider action has been executed.

# Google Ads → Supabase → Night Scout: bounded readiness

26 November 2026. Source inspected at `0e7f99fa5c963de5fe7f3a8f88ec99b180ce08a1`; no source edits or tests rerun. This is preparation, not authority to enable services, create credentials/accounts, consent, collect or write. Root owns the fresh hosted/catalog check. Private target/account/date bindings are deliberately omitted here.

Root's fresh read-only catalog receipt at **15:35:03 UTC** reports zero provider schemas, dedicated roles and provider functions. Root also confirms the pinned source is live on the active website with automatic deploy off. The seven false flags are from PM's existing receipt, not a fresh environment-value read by this lane. Therefore backend source is present but provider storage/access installation remains outstanding.

## Owner-facing checklist

| Item | Already present / established | Missing evidence and precise next action |
|---|---|---|
| Backend integration | Mounted default-off OAuth/account/report routes; distinct API, collector and report capabilities; exact selected-account persistence; bounded manual collector; missing-versus-zero summary correction. | Installed roles/schema/config and genuine provider journey are not established by source. Use root's fresh metadata and the approved install/activation sequence. |
| Google developer access | **No developer token is required.** Google's current migration notice says tokens were sunset on 9 September 2026; access now belongs to the OAuth client's Cloud project. Existing source correctly omits that header. | Owner/operator identifies the existing Cloud project privately and confirms Google Ads API enabled plus access level. Test access suffices for test accounts; a production account needs Explorer or higher. Do not ask for a developer-token secret. [Google migration notice](https://developers.google.com/google-ads/api/docs/api-policy/developer-token), [access levels](https://developers.google.com/google-ads/api/docs/api-policy/access-levels). |
| OAuth application | Source supports a confidential web client, state/PKCE, encrypted refresh credential and fixed callback/origin. | Existing client/consent-screen/test-user/redirect configuration was **not verified** by the bounded local metadata scan. Owner/operator must confirm existing client identity, publishing status, permitted test user and exact registered callback against the private target binding; any creation/configuration/delivery is separately approved. Do not paste secrets into chat/repo. |
| Account for functional acceptance | Owner has already confirmed no historical-spend account. This is settled and must not be asked again. | Confirm an existing test advertiser and authorised read-only user, or an existing eligible empty production advertiser with appropriate Cloud access. Test accounts require a separate test-manager hierarchy and do not produce serving data. If none exists, request only the specific creation/access action through PM; no ads, billing or spend. [Test accounts](https://developers.google.com/google-ads/api/docs/best-practices/test-accounts). |
| Test-manager discovery | Production manager path deliberately accepts only enabled client rows; direct advertiser path does not filter account status. | Google says test accounts appear cancelled in the UI. This is a **compatibility risk**, not proof of API status/failure. Prefer a reviewed direct read-only test-client user path for first empty acceptance, or separately verify manager test-client status under authorised read scope. Do not silently widen production eligibility. |
| Selected account/window | Server revalidates selected advertiser metadata and manager path; collector allows one selected account and at most 14 completed account-local days. | Private approval must name account, optional manager, store/owner, currency/timezone, exact inclusive dates and attempt ordinal zero. No public account IDs, invented dates, reused historical retry authority or automatic substitution. |
| Storage/access/logging | Three exact SQL proposals and fixed-RPC roles are prepared; report rechecks membership. | Root supplies fresh installed-state evidence. Before real consent, demonstrate callback-query, OAuth POST-body and Authorization-header capture controls across ingress/APM/proxies/exports. Unobserved sinks remain a gate. |
| Pages | Authenticated saved-report endpoint exists; it does not itself call Google. | No connected Google Settings/report UI was found in the inspected current pages. Pages owner must supply explicit connect/select/status/read UI and signed-in acceptance; do not describe backend-only success as end-to-end product completion. |

The bounded scan checked old-v11/current-source env-file names and the known low-copy binding directory for Google configuration names; it found no Google binding there. This means **unverified in these locations**, not “no app exists.” No secret values were printed. Cloud console/owner state remains separate from local source.

## Exact source and configuration

Runtime API version is `v26`; Google's timetable lists v26 as released 14 October 2026, with sunset November 2027 (minor v26.2 exists). No forced API upgrade is indicated for this package. [Official timetable](https://developers.google.com/google-ads/api/docs/sunset-dates).

Apply nothing from historical setup prose blindly: `GOOGLE-ADS-STAGING-PREP.md` retains old unmounted/dirty-checkout/baseline statements. Current `app.ts:62–63` mounts both Google routers; startup constructs the default-off runtimes. Current source already includes the corrected acceptance states `no_observations`, `partial`, `zero_spend`, `complete`.

SQL files beneath `db-migrations/proposals/`, independently hashed at the pinned source:

| File | SHA-256 |
|---|---|
| google-ads-spend-store-2026-11-21.sql | `85732db026d4882591405d18b6cb41eddac979cb7b9840dcfedb5a3905ac8e86` |
| google-ads-spend-rpcs-2026-11-21.sql | `d9ec68696a64d09d3ba3c799167826172692d68620a320e98d327fd069ddc3d4` |
| google-ads-spend-read-rpc-2026-11-21.sql | `f7cb0ac6d0a4ea31075474f875938989d46a68650ddbd7285342288c21333e87` |

Install order, if separately approved: dedicated group/login pairs and trusted owner → store → RPCs → report RPC → effective-access/body/owner checks. Unexpected pre-existing objects stop for a reviewed migration decision. No browser raw-table grants or service-role reuse.

Names-only configuration: common staging environment, pinned project/CA/Auth values; `NIGHT_SCOUT_GOOGLE_ADS_CLIENT_ID`, `_CLIENT_SECRET`, `_REDIRECT_URI`, `_ALLOWED_ORIGIN`, `_PKCE_KEY`, `_ENVELOPE_MASTER_KEY`, `_ENVELOPE_KEY_VERSION`, `_STAGING_OWNER_ID`, `_STAGING_STORE_ID`; distinct `_API_DATABASE_URL`, `_REPORT_DATABASE_URL`, `_COLLECTOR_DATABASE_URL`; matching `_API_RUNTIME_ENABLED`, `_REPORT_RUNTIME_ENABLED`, `_COLLECTOR_RUNTIME_ENABLED`; one-off `_COLLECTOR_ENABLED`, `_ACCEPTANCE_ENABLED`, `_ACCEPTANCE_STORE_ID`, `_ACCEPTANCE_FROM`, `_ACCEPTANCE_TO`, `_ACCEPTANCE_RETRY_ORDINAL`. Existing pinned callback/origin and database target must match the private reviewed binding exactly. No developer-token variable exists or is needed.

Report construction does not consume OAuth/envelope secrets; sharing an operating-system environment still requires separate host secret-isolation evidence. Google's `adwords` OAuth scope is not a read-only scope, so fixed read-only code and suitable advertiser access remain essential. Source assumes external Testing consent status and schedules re-consent before seven-day refresh expiry; confirm actual status rather than infer it. [OAuth scope/offline access](https://developers.google.com/google-ads/api/docs/oauth/internals), [Testing refresh expiry](https://developers.google.com/identity/protocols/oauth2#expiration).

## One bounded real acceptance after explicit approval

1. Record immutable source, private host/project/account/window, operator and acceptance class: **functional empty/test** or **positive-spend reconciliation**. The latter is currently unavailable; no new spend is requested. Close installed access, trusted SQL body/owner, TLS/secret separation and capture gates first.
2. Enable only the separately approved API capability. Signed-in fixed owner/current store membership completes consent; discover direct accounts or verified manager clients; explicitly select one advertiser. The server rereads currency/timezone and selection authority before activation. No automatic account fallback.
3. Enable the separately approved collector only for one runner invocation: `deployments/nightly-staging/run-google-ads-acceptance.mjs`, bound completed dates, ordinal `0`, no CLI overrides/retry/schedule. Confirm a durable run and one coverage observation per requested day under the exact selected lineage. Integer micros remain decimal strings; missing provider rows remain null/unknown.
4. Read the saved report using the dedicated report capability and authenticated **pinned staging owner who is also a current member**. Source is intentionally narrower than all-member rollout: runtime pins that owner; SQL independently checks membership. Do not advertise wider merchant access. Verify nonmember/wrong-store denial, exact account/currency/timezone, no old-account fallback, expiration retaining eligible saved history, disconnect/revocation withholding, and no provider call on saved reads.
5. Pages verifies connect/select/status and explicit saved-data load with auth/company/period invalidation. This needs a Google-specific composed check; existing Meta full-pipeline/browser evidence is not Google UI evidence. Record redacted states/counts only. A test account may yield `no_observations`: that can pass functional transport/storage/access checks while remaining unknown spend. `zero_spend` requires explicit zero provider rows; `complete` is coverage, not reconciliation; process exit zero is not acceptance.
6. Stop one-off collection gates immediately. With API still available, owner disconnect removes encrypted stored credentials; external OAuth-grant revocation is a separate approved action. Then disable API/report/collector, close pools, disable dedicated logins and terminate sessions under explicit authority. Preserve observations/audits; no schema drops/history deletion. Source rollback alone cannot revoke credentials/grants or terminate sessions. One-time collection is not scheduling authority.

## Source anchors and limits

- `artifacts/api-server/src/lib/google-ads-runtime.mjs`: pinned host/project/owner, API role, v26, Testing mode and startup checks.
- `experiments/marketing/google-ads-account-discovery.mjs:203–223`: enabled manager clients; direct advertiser verification earlier in the same module.
- `experiments/marketing/google-ads-spend-reader.mjs:153–240`: account-level date/cost-micros query and explicit missing dates.
- `experiments/marketing/google-ads-acceptance.mjs`: one-account/14-day/ordinal gate and coverage classification.
- `artifacts/api-server/src/lib/google-ads-report-runtime.mjs:38–54`: fixed staging-owner authentication; read-only fixed RPC.
- `db-migrations/proposals/google-ads-spend-read-rpc-2026-11-21.sql`: membership, latest selection before eligibility, expired-history handling, per-day accepted-run selection.

No new source defect is proven by this read-only review; the manager-test status risk requires a specific composition check, not speculative production-filter changes. Existing passing suites were reused, not relabelled as fresh tests. No provider account calls, OAuth, live SQL, account/credential creation, configuration changes, deployment, spend or customer-data changes occurred in this lane.
