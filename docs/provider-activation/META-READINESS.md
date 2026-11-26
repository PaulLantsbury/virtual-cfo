> Baseline readiness review. For the executable install, host isolation and collection sequence, the newer ACCESS.md, ISOLATION.md, LOGGING.md and COLLECTION.md in this directory take precedence over the earlier manual setup outline below. No provider action has been executed.

# Meta end-to-end readiness — 26 November 2026

Preparation only. Source `0e7f99fa5c963de5fe7f3a8f88ec99b180ce08a1` in `work/night-scout-combined-provider-optional-20261126`; source inspected, no changes or repeated suites. No OAuth, provider account query, collection, SQL mutation, credential provisioning, flag/deploy/schedule change or spend occurred. Root owns current hosted/catalog evidence; PM owns approval/operator action and pages owns UI integration.

## Compact readiness checklist

| Stage | Already present | Missing evidence / exact next action |
|---|---|---|
| Hosted source | Root verified exact source live, service active and automatic deploy off. | Seven controls are false in PM's existing receipt; not a fresh environment-value inspection. Preserve all off until separately approved. |
| Meta app and owner access | Source requests `ads_read` only and rejects unexpected granted permissions other than `public_profile`. | Actual app existence, owner app-role/ad-account role, permission access and registered callback are not established by repository code. PM first checks existing secure app metadata; only if unavailable, owner provides presence/status confirmation through the secure setup process, never secrets in chat. Do not create a replacement app by assumption. |
| Private account/window binding | Previous handover says an owner-selected historical account/window was supplied privately. | No non-example env/private binding file found in this workspace; related configuration names absent in this process. This does not mean the remote secret store is empty. Recover existing private binding and check eligibility; do not ask for the same account/date information again before that search, substitute dates, or revive earlier retry approval. |
| Supabase durable path | Three immutable Meta SQL proposals; separate API/report/collector role pairs; runtime role/project/TLS checks; owner/member checks and encrypted credentials. | Root's fresh catalog at 15:35:03 UTC reports zero provider schemas, dedicated roles and provider functions. SQL/role installation and secure credentials therefore remain a separately approved step. |
| Connect/selection UI | API endpoints and `MetaSpendConnectionStatus` component exist. | The component is not mounted by current Settings. Pages must prepare an explicit owner flow and test scope resets/late responses before acceptance. No blind mount: its local pending-selection/messages lack the newer read-panel sequence safeguards. |
| Reporting UI | Growth has `MetaReadOnlySpendPanel`, exact-true opt-in, explicit dates/load, no collection. | Display enablement and real selected-account saved-history acceptance remain separately approved. A report-only display is not a complete connect flow. |
| Capture/privacy | Application redaction and bounded errors are already tested. | Ingress, runtime/injected agents, outbound URL/header/body and log-export capture remain independently unproven. Close this gate before real consent or tokens. |
| Positive-spend reconciliation | Existing reader/collector/SQL/report/consumer composition has frozen test receipts. | Actual accessible account, eligible closed interval, exact account currency/timezone and account-level daily comparison remain unverified. No new advertising spend is required or proposed. |

## Current public Meta requirements

The current official Insights reference limits the start date to the last 37 months and defines `until` through midnight following that date. Keep the configured end date inclusive; do not add another day. Recheck the private interval against the actual account-local date immediately before a newly approved run. A window formerly eligible can age out; source validation rejects it rather than choosing a substitute. This is calendar eligibility only, not proof that the account retains accessible spend. [Meta Insights reference](https://developers.facebook.com/docs/graph-api/reference/adaccount/insights/)

Official authorization guidance distinguishes permission Standard/Advanced access from Marketing API Limited/Full access tiers. Reporting uses `ads_read`; own-account preparation does not establish approval for other merchants. App roles and advertiser access must both be checked. Even development-tier calls use production data, so they remain unapproved provider reads here. [Meta authorization](https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/authorization)

The official Marketing changelog lists `v27.0`, introduced 4 November 2026, with its end date not yet set. Keep this reviewed version pin. Do not repeat the old setup document's two-year Marketing-version guarantee: Graph and Marketing schedules differ. The dedicated Marketing versioning page returned HTTP429; the official Marketing changelog and current v27 reference were readable. [Marketing changelog](https://developers.facebook.com/documentation/ads-commerce/marketing-api/marketing-api-changelog), [Graph versioning distinction](https://developers.facebook.com/docs/graph-api/guides/versioning/)

## Exact setup inputs for PM approval

Use the already confirmed staging service/database privately; do not switch workspace or reuse a different environment. Register the chosen target's exact origin and `/api/meta-ads/callback` in the existing app. The runtime allows only the existing fixed staging origins; it rejects a different callback/origin/project/database role.

Apply the following source files under `db-migrations/proposals/` in this order, after catalog preflight and explicit approval:

| File | SHA-256 at `0e7f99fa` |
|---|---|
| `meta-ads-spend-store-2026-11-20.sql` | `7ee141420cf19081cf348984934618efb83eda02586385e4da2a1e47b48be9b3` |
| `meta-ads-spend-rpcs-2026-11-20.sql` | `a6df957d7ed26249e937143e07d46da119c9943756367110064a23a1e9cddb2c` |
| `meta-ads-spend-read-rpc-2026-11-20.sql` | `3d2367000859ff33f5644bd4aedf73b25137edde0d52ad0a66810f323be0ad80` |

Provision distinct API/report/collector group-login pairs via the approved secure DBA process; no service-role substitution, direct browser-table grants or elevated membership. Verify actual function bodies/trusted owners, signatures, effective/default privileges and denied-role behaviour. The catalog checker alone does not prove these. Do not apply `CREATE OR REPLACE` over an older incompatible report signature if preflight changes.

Configure names from the existing `META-ADS-STAGING-SETUP.md`: staging/project/owner/store binding; role-specific database URLs/CA; Auth URL/publishable key; app ID/secret; exact redirect/origin; envelope key/version; API version. Supply each capability only what it needs. The report path does not need Meta app/envelope secrets; colocating secrets in one process is not proven isolation. Owner actions are secure metadata confirmation and later consent/account selection, not copying tokens into this packet.

## One approved end-to-end acceptance, in order

1. **Capture gate and install.** Obtain PM's exact SQL/access/secure-config and fictional canary approval. Check every enabled capture/export layer using fictional sentinels against a team-controlled non-provider endpoint; no real OAuth material. Install/verify the hashed storage/access package, close temporary canary resources, keep collectors/display disabled. Unexpected drift or invisible capture sink stops activation.
2. **Owner connection.** After explicit API enablement/consent approval, signed-in owner calls connect; server verifies Auth user, pinned store and current membership. Callback consumes one-time state; token exchange/permission checks/discovery remain server-side. Select the exact intended account from returned IDs/currency/timezone; no first-account fallback. Verify durable selected lineage and encrypted credential, without reading the credential out.
3. **Once-only collection.** Approval privately pins account, connection, store, currency, timezone, source, completed inclusive interval no more than14days, and attempt ordinal0. Run `deployments/nightly-staging/run-meta-ads-acceptance.mjs` once with its three explicit collector/acceptance switches. No CLI/account override, automatic retry, catch-up or schedule. Runtime selects the server binding; reader fetches only account metadata and account-level daily spend. Missing rows remain unknown. Repository persists coverage, observations, lineage and run outcome through fixed role-bound RPCs.
4. **Durable report and pages.** Read stored data with the separate report role as the authenticated pinned staging owner who is also a current member (not a general all-member rollout), through GET `/api/meta-ads/spend`; no live provider request occurs on page load. Compare every daily amount to whole-account Ads Manager totals for precisely the same inclusive local days/currency. Earlier campaign-only screenshots do not establish full-account reconciliation. A successful run/exit/HTTP response is not by itself reconciliation. Require nonmember denial and current selected lineage; no revoked/disconnected/older-account fallback. Expiry may retain eligible saved history with explicit reconnect/unknown freshness. Pages separately verifies applied dates, account/currency/timezone, unknown coverage and late-response/company-switch invalidation.
5. **Finite cleanup.** Stop collection/acceptance first. While the approved API remains available, cancel pending selection or disconnect the owner-bound connection and verify credential deletion without deleting observations/audits. External grant revocation is separate. Disable report/API/display, stop/restart the exact host as approved, disable logins and terminate existing sessions through the approved operator. `NOLOGIN` alone does not end sessions. Roll back only to the freshly verified source; source rollback does not revoke grants or erase credentials. No table/history drop and no cleanup schedule.

The new writes, once separately approved, are confined to dedicated Meta credential/selection/run/spend/audit storage. Existing synthetic company financial summaries, customer identities, daily feeds and financial definitions are unchanged; do not automatically inject provider spend into customer financial calculations. A later source reconciliation is separate.

## Source evidence and limits

- Connect runtime: `artifacts/api-server/src/lib/meta-ads-runtime.mjs:39`; Auth verification: `:71`; role identity: `:142`.
- Owner endpoints: `artifacts/api-server/src/routes/meta-ads.ts:98` onward; OAuth scope and sensitive token-exchange URL handling: `experiments/marketing/meta-oauth-protocol.mjs:125–177`.
- Fixed spend read/collector: `experiments/marketing/meta-spend-reader.mjs`; `meta-spend-collector.mjs`; one-off runner `deployments/nightly-staging/run-meta-ads-acceptance.mjs`.
- Report role: `artifacts/api-server/src/lib/meta-ads-report-runtime.mjs:17`; mounted routes: `artifacts/api-server/src/app.ts:60`.
- Current UI boundary: `artifacts/virtual-cfo/src/pages/new-marketing.tsx:102`; unmounted owner component `components/MetaSpendConnectionStatus.tsx`.
- Reuse frozen combined pipeline, bridge, controller/browser and provider receipts. This review reran no unchanged suites and does not certify hosted access, real advertiser data or current private configuration.
