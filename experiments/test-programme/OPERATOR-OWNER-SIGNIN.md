# Isolated operator owner sign-in

Prepared source and synthetic tests only. No operator host, account, provider consent, database grant or generation schedule is created by this page.

`operator-consent-server.mjs` now serves a minimal sign-in/consent page at `/` on its exact configured dedicated HTTPS origin. The existing runtime must be enabled and fully configured; disabled/missing/unsafe configuration remains unavailable. Customer Night Scout routes/builds and authentication settings are unchanged.

## Journey

1. The existing staging owner signs in using the same email/password method used by the customer `AuthForm`. The browser posts credentials directly to the fixed staging Supabase `/auth/v1/token?grant_type=password` endpoint, with its public key. The isolated server never receives the password.
2. A short-lived access token is held only in the page's JavaScript memory. Refresh tokens are not retained or used. Nothing is stored in cookies, local/session storage or query parameters, and no bearer token is copied manually.
3. The user explicitly clicks **Continue to Xero test consent**. The browser sends the bearer automatically to the existing same-origin JSON connect endpoint. Existing strict Origin checking, Supabase `getUser`, exact owner identity and durable store-membership checks still control consent creation.
4. The returned URL must be the Xero HTTPS authorisation endpoint with the exact isolated callback. Navigating away clears page-held authentication. The existing callback completes the separately approved consent and keeps generation disabled.

**Clear this sign-in** clears only this page's memory; it does not claim to log out other devices. Expiry, refresh/page leave and clearing while a request is in flight prevent the token being reused/restored or a late response opening consent.

## Public configuration and isolation

- `NIGHT_SCOUT_REVIEW_AUTH_URL` must be `https://bioalckltvkhlczusdvl.supabase.co`.
- `NIGHT_SCOUT_REVIEW_PUBLIC_KEY` must be a publishable key or a legacy JWT with `role=anon` and this exact project reference. Service-role JWTs, secret keys and arbitrary strings cannot be rendered into the page. Never supply a service-role key.
- `NIGHT_SCOUT_TEST_WRITER_OPERATOR_ORIGIN` must be a dedicated HTTPS origin accepted by the existing operator-origin validator, never the customer app host. The root page checks its canonical Host and refuses query parameters, including token injection.
- The page uses no external JavaScript/CDN. Nonce-based CSP restricts scripts/styles and connections to self plus the fixed Supabase project; framing and native form submissions are blocked. No-store, no-referrer and nosniff headers apply. There is no new password-reset/signup/OAuth-provider mechanism.

## Remaining live setup

An approved separate host, its private runtime configuration, verified restricted writer database credentials/CA, separate Xero app/secret and exact callback registration are still required. The actual owner account must support password sign-in; do not change customer auth settings or create a replacement account to make this work. CAPTCHA/MFA/password recovery, if required by the real account, are not implemented by this minimal flow and need an appropriate secure handoff.

Password-grant sign-in does not use an auth redirect URL, so it does not itself require adding this host to Supabase's email/OAuth redirect allowlist. Any actual browser-origin/CORS/security restriction still needs verification when a host exists. The **Xero application callback allowlist must contain the exact isolated callback**. Do not borrow the customer reader callback/client secret or assume an existing registration covers a new host. Provider OAuth callback query material must remain excluded from host/application logs.

The current Shopify cron cannot serve this page; this is a distinct consent web host, with its own hosting/spend review. Successful local HTTP tests do not establish hosted TLS, sign-in, provider app configuration or live consent.

## Validation

`node --experimental-strip-types --test experiments/test-programme/operator-owner-page.test.mjs experiments/test-programme/operator-consent-server.test.mjs`

Eight focused tests cover configuration rejection, real inline-script password posting and field clearing, automatic header-only bearer use, expiry/clear/pagehide, in-flight request fencing, non-owner/unsafe redirect failures, HTTP canonical-host/CSP/private-value separation, root query rejection and existing owner/cross-origin API behaviour. All credentials, users and responses in tests are invented.
