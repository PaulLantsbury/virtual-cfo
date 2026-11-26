# Google Ads UI contribution to the consolidated Meta + Google package

Local source candidate based on `0e7f99fa5c963de5fe7f3a8f88ec99b180ce08a1`. This is a contribution to the coordinator's single approval package, not a separate release proposal. Canonical interpretation policy: `b675ede2e6028e5891ef7e179ee391447f5133d0`, `docs/cfo-guardrails-core-v1-2026-11-26.md`. No shared Settings/Growth file, backend, SQL, provider worker, CFO contract or financial calculation changes.

## Exact existing contracts

The source at the base commit supplies `artifacts/api-server/src/routes/google-ads.ts`, `google-ads-spend-report.ts`, `lib/google-ads-runtime.mjs`, `google-ads-report-runtime.mjs`, and `experiments/marketing/google-ads-report-repository.mjs`. UI supports:

- Explicit GET `/api/google-ads/status?storeId=…`, showing returned connection states, account/manager route, currency/timezone, app publication mode, reauthorisation date and collection/update dates. Unknown remains unknown. A passed reauthorisation date is not a saved-report observation date.
- Explicit POST `/connect` with only storeId. Only the server-returned HTTPS Google consent URL, exact Adwords scope and same-origin callback path are allowed. No token/selection handle is copied to browser storage or query state. Reconnection uses this same route, never automatic retries.
- Callback query `googleAds=select` or `cancelled` is a hint only. Explicit GET `/account-selections` uses the existing HttpOnly selection cookie; no account is selected by default. POST `/select-account` sends the exact returned customerId/loginCustomerId pair and storeId. Connected response binds the selected pair; current status is then re-read.
- Explicit POST `/disconnect` uses the exact displayed connectionId and current store; success is followed by a status read. A failed/aborted/timed-out change is uncertain, not asserted rolled back. No retry is automatic.
- Explicit GET `/spend` accepts store and inclusive user-entered account-local dates, maximum 93 days. Returned account customerId/currency/timezone are authoritative for that report. No account/timezone is inferred from company settings or connection time.

### Concrete cancellation gap

The existing Google router has **no authenticated pending-selection cancellation endpoint**. OAuth denial at Google's consent screen is handled by the existing callback and redirects with `googleAds=cancelled`. The UI can close the local selector and erase its state, but cannot revoke a pending server handle or clear its HttpOnly cookie. It explicitly says the pending selection expires and that closing is not disconnecting an existing account. Do not label this as server cancellation parity. A future cancel endpoint must be data/API-owner supplied and pinned before a client request can be added.

## Saved-report presentation

`googleAdsSpendApi.ts` exports its existing strict report parser and tightens timestamp/calendar/descriptor checks without changing server shape. Micros are nonnegative canonical integer strings within int64 per day; formatting uses BigInt, exactly six decimals, preserving JPY/KWD/etc. without Meta minor-unit conversion or float rounding. Total uses BigInt and appears only when every requested day has a provider row from a complete run. `no_row`, `partial`, `failed`, `not_collected` stay unavailable, not zero; a verified provider-row zero displays exactly zero.

Original observed/run-start timestamps (including microseconds), run IDs/status and daily coverage remain visible. Freshness is explicitly unknown. The Google envelope has no Meta lineage digest, connection ID or freshness field; none is invented. Current/expired connection status does not manufacture freshness or gate eligible saved history in the UI. The server's latest-account/disconnected/revoked rules determine eligible report data. No FX, attribution, CAC, profit, savings or spend recommendation is inferred; Google remains separate from Meta and synthetic finance.

## Lifecycle and default-off mounts

Both wrappers return null before mounting their hooks unless the exact build flag is true. No automatic requests occur on mount, callback hint, focus or visibility change. Each explicit request gets a fresh matching unexpired Auth session, uses same-origin credentials, no-store, redirect:error and no retries. The controller has a 20-second overall deadline, immediate prior-data clearing, abort and generation guards. Hook render-key gating includes user, Auth revision, company and report dates. Auth events, focus/visibility and known same/cross-tab Google changes clear results. Cross-tab notification stores only a timestamp, not credentials or account IDs. This is known-context invalidation, not continuous external revocation detection. Read failure never restores prior amounts. JSON size is checked after buffering (1 MiB), not a streaming memory guarantee.

Coordinator-owned mount snippets (these shared files are not edited here):

```tsx
// Settings connection section, alongside the separately gated Meta component:
import {GoogleAdsSettings} from '@/components/GoogleAdsSettings';
<GoogleAdsSettings />
// internally requires VITE_GOOGLE_ADS_SETTINGS === 'true'

// Growth source mode, separate from synthetic financial measures:
import {GoogleAdsSavedSpend} from '@/components/GoogleAdsSavedSpend';
{!sample && <GoogleAdsSavedSpend />}
// internally requires VITE_GOOGLE_ADS_SAVED_SPEND_DISPLAY === 'true'
```

Both flags remain unset/off. UI flags do not enable server runtimes or install permissions. Existing Google server runtime gates, owner/store/project restrictions, database/role grants, OAuth/provider readiness and final hosted signed-in acceptance remain independent gates for the coordinator's single consolidated approval package.

## Scoped verification

15 focused Node tests passed: exact micros/timestamp preservation, unknown coverage and valid zero, not-connected withholding, scope/date/schema/overflow/sparse-array/accessor rejection, status expiry vs freshness, exact manager selection/expiry, connected pair binding, OAuth origin/callback protection, actual transport fresh-session/no-store/no-redirect/no-retry, denial/abort, stale-result and deadline protection. Frontend TypeScript passed. Logs outside the checkout: `work/google-ui-20261126-evidence/controller-parser-tests.log` and `typecheck.log`.

Browser acceptance after root's shared mounts is pending at this source freeze. Node mocks do not certify OAuth, real owner/membership, cookie handling, live collection, signed-in provider acceptance or deployed Google reporting. No provider/OAuth/live Auth/DB/configuration operation, publication, deployment or spending was performed. No broad backend suite repeated for this UI-only contribution.
