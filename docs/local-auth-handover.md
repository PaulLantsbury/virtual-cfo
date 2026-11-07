# Local Supabase sign-in handover — 8 September 2026

Status: implemented on the GitHub draft, with mocked browser and local regression verification. Not deployed; no Supabase users, memberships, schema, settings or records were changed. Supabase Auth is the chosen implementation for this package following Paul's approval to proceed with the recommended local sign-in work.

## What now exists

Login calls `signInWithPassword`; signup calls `signUp`, validates confirmation and handles an email-confirmation response without pretending a session exists. Failures stay on the form. Fake Google buttons, password-reset placeholder and the demo-login bypass were removed; OAuth and password recovery are not implemented in this slice.

The session provider subscribes to SDK auth changes and restores a stored session. It verifies the user with `getUser(access_token)` before reading `store_memberships` and its permitted store names. It performs SDK calls outside the auth-event callback. Session data is managed by the Supabase SDK; no custom token logging/storage is added. See [password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) and [user verification](https://supabase.com/docs/reference/javascript/auth-getuser).

All merchant routes, timeline state and the AI drawer are inside the access gate. While checking, signed out, unverified, missing membership or backend failure, those components are unmounted and cannot start their data queries. There is no fallback to the demo store. A single authorised membership selects its store; multiple memberships require an explicit choice, with a selector for subsequent switching.

Seven connected pages now obtain their store ID from the gated membership context. User/token/store transitions cancel and clear the query cache, and remount protected providers/components so local briefing, timeline and drawer state cannot carry over. Old verification/membership results are discarded by request version. Expired sessions close the gate; SDK refresh events and returning to the visible tab revalidate access. There is no realtime membership-revocation subscription yet; deployed RLS must deny subsequent reads immediately even if the browser has a cached view.

Sign-out hides merchant content before contacting Supabase. Successful local-scope sign-out removes the SDK session; if it fails, the UI stays closed and offers retry. A later automatic SDK refresh cannot reopen that failed-logout view; a new explicit sign-in attempt is required. This does not claim server-side revocation if the sign-out request failed.

## Checks and reproducibility

- Eight session-controller tests: verified identity before membership, missing/expired sessions, unavailable/no membership, delayed account/logout responses, multi-store choices, expiry, refresh/revocation and malformed rows.
- Five mocked browser groups: direct-route/demo-flag bypass attempts, invalid credentials, missing membership/table, scoped multi-store requests and logout, signup mismatch/confirmation, and failed logout followed by token refresh.
- Prior 71 dashboard/financial/database/API tests remain passing: 84 tests total with the 13 new groups. Full workspace type checking and production builds pass using local PORT=5173 and BASE_PATH=/. Existing tooltip sourcemap and bundle warnings remain. Login error layout was visually inspected.

Run `pnpm test:auth` for the controller tests. Browser tests are `artifacts/virtual-cfo/tests/auth-browser.mjs`. Start a loopback Vite preview with PORT=5187, BASE_PATH=/, VITE_SUPABASE_URL=https://night-scout-test.invalid and VITE_SUPABASE_ANON_KEY=test-public-key. Run the browser file with Node, providing NIGHT_SCOUT_PLAYWRIGHT_MODULE when Playwright is bundled outside the repository and NIGHT_SCOUT_CHROME_PATH when using an installed Chrome. NIGHT_SCOUT_TEST_URL defaults to http://127.0.0.1:5187 and must remain loopback. Every non-preview request is mocked or blocked. No dependency was installed. The bundled browser was absent, so tests used installed Chrome with an isolated temporary profile; the user's browser session was not used.

These tests exercise the real SDK/form/provider wiring against mock responses. They do not establish real credentials, email delivery, JWT signature/expiry enforcement, Supabase project configuration or gateway RLS correctness.

## Exact next-session starting point

1. Read this handover and `auth-store-isolation-plan.md`. Preserve the current live environment and Replit changes; main is not yet updated.
2. Prepare a separate Supabase staging project or approved isolated environment. Configure email/password auth and allowed site/confirmation URLs for its preview. Do not put service-role credentials in frontend variables.
3. Reconcile the reviewed baseline/ledger strategy, then apply the monthly-contribution correction and membership-read proposal in that order on staging. Verify all public functions use caller permissions. Keep finance_v1 evidence private.
4. Create two staging users with two synthetic stores and distinct memberships through a trusted admin path, plus a third authenticated non-member. No automatic demo membership or real merchant import.
5. Point a staging preview at staging public credentials. Verify real login, confirmation, refresh/expiry, logout, no-store/backend-error states, deliberate cross-store REST/RPC requests, client-write denial and revoked membership. Check account switching and stale requests across tabs.
6. Keep the opportunity server proxy disabled until a reviewed user-scoped replacement exists. Detailed pages still have previously documented demo/snapshot financial content, and billing/monitoring/integrations remain incomplete. Do not present authentication work as financial conformance or product completion.

The local UI will deliberately stop at an access-error/no-store screen against a database without the membership proposal. That is the intended fail-closed state, not a reason to restore a demo bypass. Deployment, production email/password recovery, OAuth/MFA, onboarding/invitations, realtime revocation, and a full production access review remain unfinished.
