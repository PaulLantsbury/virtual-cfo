# Recovered provider source — independent security handover, 26 November 2026

Read-only implementation review; this document is the sole local handover artifact written by this reviewer. No source fix, test execution, publication, provider request, database operation, credential inspection, log capture, deployment or configuration change was performed. The replacement integration chat owns the next implementation and test batch.

## Evidence and baseline

Reviewed the recovered provider-owned files copied from the preserved dirty v11 checkout and the isolated recovery checkout. The implementation owner records the recovery base as cloud source `6cc5c542`, tree `c78236b72faa526b4c6941de44e8e3692e5f0a87`, with the separately documented cleanup source `204226d` preserved. Consult the exact current operational roadmap and fresh hosted preflight before any release; neither an old v11 branch nor this uncommitted recovery tree is a deployment candidate.

The repository instructions, cloud all-stream handover and roadmap delta were read. The historical 27 Meta plus 42 Google mocked results belong to the earlier local checkout. They were **not rerun by this reviewer** and are not an acceptance result for the recovered integrated tree. Source notes from 21 November contain outdated baseline/network assumptions and must be refreshed rather than treated as current operational facts. Private account/store/member bindings and the selected historical spend window stay out of public guidance.

## Concrete defect: composed Meta cancellation is blocked

`artifacts/api-server/src/lib/meta-ads-runtime.mjs` defines a fixed `API_RPCS` allowlist but omits `meta_ads_v1.worker_cancel_pending_selection`. `experiments/marketing/meta-ads-repository.mjs` calls that exact function in `cancelPendingSelection`, and the API route exposes an owner-bound pending cancellation action. The SQL proposal already defines the fixed RPC and API-only grant.

Consequently, the composed runtime rejects this cancellation before reaching SQL. The pending encrypted credential is not immediately removed through this path. Existing isolated repository and route tests do not expose the mismatch because they substitute the adjacent layer.

Required next test: construct the actual Meta API runtime with a mocked pinned pool/Auth/provider boundary, establish a valid pending-selection fixture and invoke its service cancellation (or the mounted route using that runtime). Assert that only the exact cancellation RPC is issued with the bound owner/store/handle digest; its safe successful result reaches the caller. Also assert the collector/report runtime cannot invoke that RPC, and wrong owner/store/expired selection still fails. Then add only this existing fixed RPC to the API runtime allowlist. No broader RPC passthrough or new grant is implied.

## Hosting and outbound logging gate: engineering-owned, still open

The existing application logger projects inbound paths without query strings and redacts selected credential headers. That establishes only the application logging boundary; it does not establish platform ingress, log-stream, injected-agent, HTTP proxy or outbound tracing behaviour.

Current official [Render logging documentation](https://render.com/docs/logging) describes Pro-and-higher public HTTP request logs as including requested URLs and separately describes runtime logs. It does not guarantee OAuth query omission. This is uncertainty, not evidence that private data was actually retained. No real logs were inspected here.

The Meta protocol performs server-side token exchanges with sensitive values in the outbound URL. Current official [Meta long-lived-token documentation](https://developers.facebook.com/documentation/facebook-login/guides/access-tokens/get-long-lived) explicitly documents the GET exchange with secret/token query parameters. Do not casually rewrite it as an unverified POST and claim the privacy issue is solved. Google token exchange uses POST form data and API access tokens use headers; those boundaries also need protection.

Before OAuth activation the team must produce a scoped configuration/receipt showing callback queries, outbound Meta OAuth URLs, Google OAuth request bodies, Authorization headers and response bodies are excluded or redacted at every enabled capture layer. Review only safe configuration facts, not secret values. Local tests can exercise synthetic sentinel strings against the application logger and any explicit telemetry adapter, including error paths; they cannot certify the real hosting boundary. Any later platform canary must be a separately authorised harmless synthetic observation, never a real OAuth code/token or private payload. If the platform boundary is not observable, leave OAuth disabled and prepare a concrete demonstrably controlled ingress/runtime alternative; do not ask the owner to conduct an undefined telemetry audit.

## Current provider guidance checked

- [Google access levels](https://developers.google.com/google-ads/api/docs/api-policy/access-levels) and its [September 2026 onboarding announcement](https://developers.google.com/ads/blog/posts/2026/09/new-onboarding-experience-for-google-ads-api) confirm developer-token sunset and access levels tied to the OAuth client's Cloud project. The missing developer-token header is **not a defect** in this recovered code. Some older official auth overview text still mentions tokens; use the newer policy rather than reintroducing obsolete setup.
- [Google's access model](https://developers.google.com/google-ads/api/docs/oauth/access-model) states that read-only and write operations use the same OAuth scope and the API follows Google Ads user roles. Describe this implementation as read-only by its fixed read operations and account role, not as a separately read-only OAuth grant. Test that only the intended discovery/search calls can leave the reader; never add mutate operations or create spend for acceptance.
- Google positive-spend acceptance still needs a future existing advertiser with historical spend. That known absence is not an owner action for this engineering batch. Mocked plumbing and account discovery cannot establish positive-spend reconciliation.

## Target and OAuth checks to retain in the recovered tree

The inspected sources pin staging project/database role/endpoint, callback origin, owner/store and separate API/report/collector roles. OAuth state is hashed, short-lived, consumed once and bound to the owner/store. Pending account selection is cookie-only, HttpOnly/Secure/SameSite=Lax; the selected account must belong to that grant. Token encryption binds connection and store. Browser account/store values remain requests, not authority. SQL membership checks are distinct from the fixed staging allowlist.

Meaningful final-tree mocked regressions should cover wrong project/role/callback/origin startup refusal; disabled runtime opening no pool or provider connection; state reuse/expiry and revoked membership; account selection from another grant; cancellation and disconnect preserving historical observations; safe fixed error projection under poisoned upstream errors; and no code/state/selection handle/credential material in callback redirects, public results or application logs. Reuse existing tests where they exercise the actual composed path rather than adding mirror tests. New SQL proposals still need disposable effective-role/constraint execution before being called installation-ready; current review did not execute them.

The shared app/startup and current UI must be reconciled manually against the cloud/cleanup baseline, not copied wholesale from dirty v11. Preserve accepted Scout, Plan, customer safeguards and the cloud provider-facts validation fix. The route/runtime constructors alone do not prove they are mounted or enabled. The exact staged package needs an immutable integrated revision, final build/typecheck and scoped tests, separate schema/access/config deltas, schedule-off/default-off proof, rollback/disable instructions and the remaining privacy/live acceptance gates.

## One documentation correction

The recovered Meta setup note says the privately supplied period crosses the UK daylight-saving boundary. The recorded supplied fortnight does not. Remove that unsupported statement; retain the correct rule to compare account-local inclusive days using the account's verified timezone, without publishing private operational dates or assuming UTC. Named campaign observations are not a complete account-level daily total.

## Handover status

Implementation owner and PM were notified of the missing cancellation allowlist entry. No competing implementation edits were made. Freeze this review now and let the replacement integration chat implement, rerun the focused suites on the integrated tree and close the engineering-owned logging gate. Until then: recovered/prepared source, **not staging activation readiness or live provider acceptance**.
