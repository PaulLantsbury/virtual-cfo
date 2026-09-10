# Review server runtime — local composition, 10 September

`experiments/shopify/review-runtime.mjs` prepares a dedicated review service from explicit server-owned configuration and trusted pg Pool/Supabase client factories. It does not read generic environment variables, create credentials, apply migrations or enable an API route.

## Configuration and request bounds

Auth must target the configured hosted project and the direct database hostname must contain the same project reference. Only the dedicated night_scout_review_login username, postgres database and normal direct port are accepted. Connection URL options, privileged usernames, alternate destinations and pooler URLs are rejected. This conservative version does not support Supabase poolers, custom domains or self-hosted deployments.

The pool enforces certificate verification, at most three connections, a five-second acquisition timeout, a 30-second statement timeout and a 15-second idle-in-transaction timeout. Configuration errors never include the URL/password. The Auth client has persistence, automatic refresh and browser URL detection disabled. It accepts a public publishable/legacy-anon key; the legacy role inspection is a configuration guard, not cryptographic key verification. Service-role keys are not needed.

The supplied Auth fetch wrapper only permits the configured /auth/v1/user endpoint, rejects redirects and applies a five-second abort deadline through reading the response body. Streamed response data is capped at 64 KB. The existing reviewer wrapper suppresses upstream error details. SDK transport behaviour and certificate trust still require live environment verification.

## Pool lifecycle and readiness

Every transaction acquires a dedicated client, begins a transaction and sets the restricted review role locally. It commits or rolls back and releases the client. A failed rollback or uncertain commit discards the connection; there is no automatic mutation retry.

Initialisation verifies the effective role, non-inheriting/non-privileged login attributes, absence of source/audit/authorisation mutation rights tested by the readiness query, the locking helper and required relations. Failed startup closes the pool before returning a safe error. This is a focused readiness check, not a complete audit of every possible inherited grant or SQL capability. Administrator provisioning and a full live privilege check remain necessary.

## Verification

61 Shopify/source/review/runtime tests pass, including five new groups for configuration mismatch, TLS options, restricted Auth destination/deadline/size, transaction cleanup, uncertain commits and failed readiness. The standalone PostgreSQL 18.4 harness also passes seven contention cases plus an additional runtime case using a real restricted LOGIN and pg Pool to prepare and restore synthetic evidence. That runtime test overrides transport to its isolated Unix socket and simulates Auth, so it does not verify cloud DNS/TLS or real Supabase tokens. Temporary clusters were stopped and removed.

The HTTP app remains default-disabled. Next: wire the reviewed runtime into server composition with explicit enablement/readiness handling, then add the reviewer UI and deployment controls. Prepare the concrete staging migration/login plan before asking to apply it; no live credentials or grants have been created here. No Supabase, Replit or production changes occurred.
