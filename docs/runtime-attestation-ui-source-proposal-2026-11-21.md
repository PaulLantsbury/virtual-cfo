# Temporary runtime diagnostic control — source proposal, 21 November 2026

Prepared in an isolated checkout from the approved runtime-attestation source. No deployment, server access, credential, grant, assignment or business-data change occurred. Scout, Plan, navigation and the ordinary prepare/restore workflow are preserved.

## Default-off control

`financial-review.tsx` conditionally includes a small `RuntimeDiagnosticPanel` only when the trusted source constant `RUNTIME_DIAGNOSTIC_UI_ENABLED` is true. Both new UI and app-owned API switches were false in preparation checkpoint106c5256ab16f09aa8e2d13861f6e495a0aad324. A separate enabled implementation checkpointd12a6ab38f9d78a9317464a609cf56100ca5abc2 sets both true for local review only. See runtime-attestation-ui-coherent-review-2026-11-21.md for the actual enabled candidate and complete release boundary; the historical default-off description is not an assertion that the enabled candidate is inactive.

The reviewed server and UI window remains **21 November 2026, 16:00–18:00 UTC**. This package does not extend it. A later enabled candidate must receive exact source review and actual tests/build before any hosted action. After expiry it requires a new explicitly reviewed window/revision; no environment or client-clock workaround is authorized. Existing server five-minute process age and per-process attempt limits remain independent of the UI.

The local fixture can render the exported panel with `enabled:true` and a fixed test clock without changing either release flag. Such a fixture proves interface behavior, not hosted availability or permission.

## Request and authority

The button says **Check reporting connection**. It uses the existing Supabase client to obtain the current session internally, confirms its user matches the captured page user, and sends only `POST /api/financial-reviews/prepare` with `{scope,runtimeAttestation:true}`. No token is displayed, copied, persisted by this control or included in its returned/displayed result. Cached session retrieval is credential transport only; it does not establish authorization.

The server still performs fresh Auth verification and the existing joined operator-assignment plus store-membership check. The page cannot infer that assignment from membership and says so. A permission denial is shown as an operator-access denial, not a missing database configuration. No new endpoint, SQL input, role/target identity field, auth flow or provider request is introduced.

Diagnostic handling is separate from normal review preparation and restoration. It never calls the restore endpoint, changes the review packet, checks completeness, records a review or invalidates financial caches. The normal buttons and their existing messages retain their behavior. Shared busy signals prevent simultaneous diagnostic and ordinary prepare/restore actions without changing or clearing the prepared financial packet.

## Safe results and request lifetime

The helper accepts only a primitive allowed state, a validated build revision and eight boolean checks. It projects fixed human-readable labels; extra token/role/host/catalog fields are discarded, malformed state objects or string booleans are rejected. Response reading is bounded at 8,192 bytes and error text comes from a fixed public allowlist, never a raw SDK/server exception or response body.

A user/store/date context key and request generation prevent old results appearing under a new scope. Context changes and unmount abort pending work and remove its display. A delayed session response cannot start a request after cancellation. The panel exposes a cancel button and a 15-second abort limit; after a timeout/cancellation it warns that the server attempt may already have been consumed. No automatic retry runs. Once a diagnostic is dispatched, a page-session latch disables further diagnostic attempts even after a scope change; the server remains the authority for its own process limit. The request refuses redirects, disables caching and uses same-origin credentials. Helper scope/window validation runs before session retrieval and again before dispatch, not only in the panel. Results are hidden after the fixed window expires.

The displayed checks describe an observation, not approval for schema, grants, publication, changes to the reporting connection or use of financial figures. Failed booleans trigger an explicit needs-attention message. Unavailable results never render a confirmed-check checklist.

## Source checks and remaining acceptance

Seven focused helper tests passed: strict projection and private-field removal; original window/closed-month guard; exact authenticated diagnostic request; permission/session mismatch handling; and delayed-session cancellation, SDK-error redaction and oversized-response rejection. Frontend TypeScript was checked during implementation. The independent browser suite owns actual-panel cancellation/context-change tests and default-off ordinary review behavior; its receipt is recorded separately.

No signed-in hosted diagnostic is claimed by this source package. The coordinator must review exact final source and both source flags, preserve the fixed expiry/removal boundary, run the final application build and applicable existing review tests, and obtain any required exact hosted approval before deployment. All private operator evidence and account identifiers remain outside repository artifacts.
