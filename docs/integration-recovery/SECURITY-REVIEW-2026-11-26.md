# Integration security review — 26 November 2026

Independent source/documentation review supplementing `independent-security-review-2026-11-26.md`. Baseline inspected: recovery checkpoint 57b2c6e, followed by concurrent implementer changes; this is not a final immutable-tree certification. No hosted access, provider invocation, secret inspection or database action performed. Test receipts belong to the validation owner.

## Findings

1. Confirmed the Meta API fixed-RPC cancellation omission identified by PM. Implementation owner is correcting it with composed-runtime coverage. Closure requires the final receipt, not isolated repository stubs.
2. Meta historical reporting currently selects only connected, unexpired credentials (`meta-ads-spend-read-rpc-2026-11-20.sql`, selected_account). Credential expiry therefore hides retained observations as not_connected. Google already allows reauthorization_required connections. Do not claim Meta stale-history continuity until this predicate and the corresponding status presentation are corrected and exercised in a disposable database. Disconnect deliberately excludes the account while preserving stored observations; that is distinct from an ordinary failed refresh.
3. Hosting telemetry remains an activation blocker. Application query stripping is not ingress or outbound telemetry evidence. [Render documentation](https://render.com/docs/logging) documents requested URLs without guaranteeing OAuth-query removal. Meta's documented long-token exchange uses sensitive query parameters; an unsupported POST rewrite must not be treated as a verified remediation. Require an engineering-owned capture-layer inventory and harmless synthetic sentinel receipt under separate hosted authority. Inspect URL, header, body, response and error capture independently. No real code/token should be used as a canary.
4. SQL proposal execution/effective-role tests remain necessary before installation readiness. Source inspection finds membership predicates, fixed role checks, private schema functions and explicit PUBLIC revocation; inspection does not prove effective deployed grants.

## Preserved boundaries

The reviewed Meta runtime pins project/endpoint, API database login, callback origin and configured user/store. Auth uses server-validated getUser; the configured owner label alone is not membership authority, and the SQL performs separate membership checks. State consumption binds user/store and is one-use; pending selection is digest-bound and expires. Envelope inputs bind connection/store. Report responses validate requested store/range and whitelist fields. Collector/report/API credentials and fixed operations are separated. Shared UI and the daily feed were not reviewed or changed here.

Supabase skill applied for auth review. [Current getUser guidance](https://supabase.com/docs/reference/javascript/auth-getuser) supports server validation; no getSession/user_metadata authority substitution was found in the inspected runtime. [Changelog](https://supabase.com/changelog.md) was consulted: recent CLI/branch-permission changes do not require an application auth rewrite. No remote query is justified by this read-only review.

## Current official provider guidance

- [Google developer tokens](https://developers.google.com/google-ads/api/docs/api-policy/developer-token) were sunset on 9 September 2026; [access levels](https://developers.google.com/google-ads/api/docs/api-policy/access-levels) are tied to Cloud projects. Older auth overview wording conflicts with this newer policy. Missing developer-token header is not a new defect.
- [Google access model](https://developers.google.com/google-ads/api/docs/oauth/access-model) follows user roles and manager hierarchy. Its OAuth grant is not separately read-only: fixed discovery/search operations and a read-only account role provide that restriction. No mutate/spend operation is needed for acceptance.
- [Google retention](https://developers.google.com/ads/blog/posts/2026/05/new-data-retention-policy-for-google?hl=en): granular daily/weekly/hourly data is limited to 37 months from June 2026; monthly and coarser history remains 11 years. Do not promise daily 11-year reconciliation.
- [Meta Insights reference](https://developers.facebook.com/docs/graph-api/reference/adaccount/insights/) documents a maximum 37-month period. The already selected private historical window is within that nominal horizon today; this is an inference, not actual account/history availability. Exact account timezone and complete account-level daily totals require later authorised live acceptance. The private fortnight does not cross the UK DST boundary; do not publish its dates or account binding.
- Google positive-spend history remains unavailable as already established. This requires no repeated owner question and no new advertising spend.

## Disposition

Suitable to continue offline source preparation. Not cleared for OAuth activation, schema installation, hosted release or live acceptance. Final package must distinguish locally exercised boundaries from platform telemetry, effective-role execution and real-provider evidence. Parent coordinator owns final source identity and regression receipts.

## Follow-up integrated source review

Reviewed coordinator changes to app.ts/index.ts, marketing-provider-startup.mjs and declaration, Google runtime declarations, Meta cancellation allowlist and both added regression groups. No new source-preparation blocker found in these changes. Provider startup exposes only service/auth/origin route ports, closes partial startup resources, projects generic failure text, and constructs no collector or schedule. Constructors remain default-off. The tests exercise actual default-off constructors and partial failure cleanup; cancellation traverses actual service/repository/fixedRpc and checks wrong owner/store before SQL. Its mocked completion flag is not an executed SQL expiry or effective-role test. Typed Google services now match route contracts rather than unknown declarations.

The coordinator recovered the missing provider client helper separately; final manifest and build receipts remain coordinator/validation responsibilities. This review does not extend to unrelated shared UI edits.

Scoped documentation correction located: deployments/nightly-staging/META-ADS-STAGING-SETUP.md line 74 incorrectly says the supplied private period crosses the UK daylight-saving boundary. Remove that clause while retaining exact account timezone and inclusive local-date verification. Sent to coordinator; only this review note edited by reviewer.

The Meta expired-history predicate and real hosting telemetry gates above remain open unless subsequently closed by an explicit tested change/receipt. The reviewed source is suitable for offline packaging, not activation certification.

## Additional validation repairs reviewed

Reviewed canonical UUID-pattern repairs in Google spend route and Meta client helper: missing fourth-group characters/separator are restored, with a mounted actual HTTP positive request and malformed-input denial case. Mounted disabled-route tests exercise real application composition and prove provider paths return JSON/no-store rather than SPA fallback.

Reviewed removal of nonexistent jsonb_object_length calls from both provider proposals. Required-key checks combined with subtracting allowed keys preserve exact object shape; source JSON uses exact jsonb equality, which independently rejects extra/missing fields. Disposable PGlite rehearsal loads all six exact proposal files and switches session authorization, checking actual function permissions and direct-table denial. These are meaningful local effective-role checks, not installed hosted-role evidence. Final execution results belong to validation receipts.

Offline history proposal expanded to five passing tests: expired with no reported data is unavailable, missing days remain unknown, and revoked trusted membership withholds results. Membership input is a prevalidated server decision, never an auth substitute or browser-controlled permission. Existing per-field mismatch cases cover cross-company and mismatched periods. Actual Meta expiry implementation is now authorized for preparation and under separate implementation review; earlier gate remains until that change passes.

## Final expiry repair disposition (supersedes earlier unresolved source finding)

Independently reviewed actual Meta SQL/runtime and shared wire-validator changes. The SQL chooses the authoritative newest selection before testing caller/connection eligibility, rejects ambiguous latest selections, and does not fall back to an older grant. Exact selected history remains readable on expiry/reauthorization-required state; explicit disconnect, revoked selection, wrong owner/store and revoked membership withhold it. A different period cannot borrow another day's facts. Runtime content identity includes store/account/connection, selection ID and exact PostgreSQL microsecond selection instant, requested period, currency/timezone and accepted day records. Credential health is excluded from this digest so expiry does not rewrite evidence identity. This digest is not a persisted revision or authorization proof.

The shared pure wire parser is now consumed by API and provider client. It enforces exact projected fields, coherent range/day chronology, selected account/store/connection and version shape, consistent reauthorization state and observationFreshness=unknown. No unsupported age policy or fresh timestamp is invented. Expired selection with no reported day is evidenceUnavailable while unknown amounts stay null. Client session retrieval only supplies a bearer token; server getUser and SQL membership remain authority. No shared UI mount is part of this change.

Independent fresh execution: `node --experimental-strip-types --test experiments/marketing/provider-storage-rehearsal.test.mjs experiments/marketing/meta-spend-report-contract.test.mjs` passed **9/9**, zero skips/failures (six exact-proposal disposable SQL tests plus three wire tests). This repairs the earlier Meta expiry-history source defect; it is no longer an unresolved source gate. Local grant execution is demonstrated, installed hosted grants are still unknown. Final application build and full suite receipts remain the coordinator's validation package.

Final disposition: no outstanding blocker identified for this reviewed source-preparation package. OAuth activation still requires actual hosting/outbound capture protection, exact schema/access/configuration approval, and provider-specific live acceptance. No live capability is certified by this review.

Installation caveat: the Meta report proposal adds returned columns. PostgreSQL CREATE OR REPLACE cannot change an existing function's return-table type. Disposable tests cover a fresh installation only. Before any hosted application, inspect object existence/signature under separately authorized read-only scope; if present, prepare an explicit versioned migration or reviewed replacement with dependencies and exact ACL restoration. Do not blindly reapply this proposal. No hosted inspection or migration occurred in this review. Source/runtime new-column coherence was inspected and the matching disposable SQL and wire tests passed.
