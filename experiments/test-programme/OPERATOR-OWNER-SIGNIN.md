# Isolated operator owner sign-in

Prepared source and synthetic tests only. No operator host, account, provider consent, database grant or generation schedule is created by this page.

`operator-consent-server.mjs` now serves a minimal sign-in/consent page at `/` on its exact configured dedicated HTTPS origin. The existing runtime must be enabled and fully configured; disabled/missing/unsafe configuration remains unavailable. Customer Night Scout routes/builds and authentication settings are unchanged.

## Journey

1. The existing staging owner signs in using their existing email/password. The browser posts credentials directly to the fixed staging Supabase `/auth/v1/token?grant_type=password` endpoint, with its public key. The isolated server never receives the password.
2. A short-lived access token is held only in the page's JavaScript memory. Refresh tokens are not retained or used. Nothing is stored in cookies, local/session storage or query parameters, and no bearer token is copied manually.
3. The page reads the current user’s existing verified TOTP factors, using the SDK’s documented Auth protocol. An authenticator must already be enrolled; no enrollment, recovery, replacement credential or auth-setting change is implemented here. Password-only sessions keep consent locked. The owner enters a six-digit code; the page creates a fresh challenge and sends the code directly to the fixed Supabase factor verify endpoint. Only the resulting upgraded session replaces the in-memory bearer. No OTP is sent to the operator server, retained in a URL or logged. Missing factors or failed/expired challenges fail closed.
4. The user explicitly clicks **Continue to Xero test consent**. The browser sends the bearer automatically to the existing same-origin JSON connect endpoint. Strict Origin checking, signature/expiry-verified Supabase SDK `getClaims(token)` with `aal2`, fixed issuer/audience/owner, a separate current `getUser(token)` check and durable store membership control consent creation. A decoded unverified JWT, password-only `aal1`, a stale user record or the page’s success label is never authority. The runtime has no weaker-auth opt-out.
5. The returned URL must be the Xero HTTPS authorisation endpoint with the exact isolated callback. Navigating away clears page-held authentication. The existing callback completes the separately approved consent and keeps generation disabled.

**Clear this sign-in** clears only this page's memory; it does not claim to log out other devices. Expiry, refresh/page leave and clearing while a request is in flight prevent the token being reused/restored or a late response opening consent.

## Public configuration and isolation

- `NIGHT_SCOUT_REVIEW_AUTH_URL` must be `https://bioalckltvkhlczusdvl.supabase.co`.
- `NIGHT_SCOUT_REVIEW_PUBLIC_KEY` must be a publishable key or a legacy JWT with `role=anon` and this exact project reference. Service-role JWTs, secret keys and arbitrary strings cannot be rendered into the page. Never supply a service-role key.
- `NIGHT_SCOUT_TEST_WRITER_OPERATOR_ORIGIN` must be a dedicated HTTPS origin accepted by the existing operator-origin validator, never the customer app host. The root page checks its canonical Host and refuses query parameters, including token injection.
- The page uses no external JavaScript/CDN. Nonce-based CSP restricts scripts/styles and connections to self plus the fixed Supabase project; framing and native form submissions are blocked. No-store, no-referrer and nosniff headers apply. There is no new password-reset/signup/OAuth-provider mechanism.

## Remaining live setup

An approved separate host, its private runtime configuration, verified restricted writer database credentials/CA, separate Xero app/secret and exact callback registration are still required. The actual owner account must support password sign-in; do not change customer auth settings or create a replacement account to make this work. The actual existing account must also have a verified TOTP authenticator. Live enrollment/availability is not established by these source tests. Missing enrollment, CAPTCHA and password recovery require a separate appropriate secure owner setup; do not weaken this operator’s assurance check or change the working customer auth to make a test pass.

Password-grant sign-in does not use an auth redirect URL, so it does not itself require adding this host to Supabase's email/OAuth redirect allowlist. Any actual browser-origin/CORS/security restriction still needs verification when a host exists. The **Xero application callback allowlist must contain the exact isolated callback**. Do not borrow the customer reader callback/client secret or assume an existing registration covers a new host. Provider OAuth callback query material must remain excluded from host/application logs.

The current Shopify cron cannot serve this page; this is a distinct consent web host, with its own hosting/spend review. Successful local HTTP tests do not establish hosted TLS, sign-in, provider app configuration or live consent.

## Validation

`node --experimental-strip-types --test experiments/test-programme/operator-owner-page.test.mjs experiments/test-programme/operator-consent-server.test.mjs experiments/test-programme/xero-test-writer-runtime.test.mjs`

Focused tests cover password and authenticator posting to fixed Supabase endpoints, no-factor and low-assurance refusal, invalid/expired challenge handling, field clearing, header-only upgraded bearer use, expiry/clear/pagehide and in-flight response fencing. Runtime tests additionally reject failed signature verification, missing verifier, low/missing AAL, expired/wrong-owner/wrong-issuer/audience/role claims and a revoked/current-user mismatch before any writer SQL. HTTP tests cover canonical host/CSP/private values and cross-origin access. All credentials, users and responses are invented.

This closes the prepared operator authentication gap; it is not a claim of whole-app Xero security compliance or live hosted MFA verification. Primary references: [Supabase verified claims](https://supabase.com/docs/reference/javascript/auth-getclaims), [Supabase TOTP challenge/verify](https://supabase.com/docs/guides/auth/auth-mfa/totp), and [Xero API-consumer security standard](https://developer.xero.com/partner/security-standard-for-xero-api-consumers). Browser requests mirror the exact HTTP protocol of the already pinned Supabase Auth JS 2.100.1 implementation; no external SDK script or new package is loaded.
