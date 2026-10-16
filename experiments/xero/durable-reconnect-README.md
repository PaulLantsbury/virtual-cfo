# Disconnected durable reconnect adapter

This default-off server command adapter is a proposal component, not an enabled reconnect route. Existing staging bootstrap is unchanged. No migration, provider consent, credential replacement or schedule activation is performed by this module.

## Required boundaries before mounting

- `authenticate(request, storeId)` must verify a real current server-side account session and produce its account UUID and SHA-256 session digest. Browser owner flags, store IDs and claimed identities are never authority. SQL independently verifies membership and the current mapping owner.
- The injected proof provider is **not implemented**. Its four methods must authenticate purpose-separated, encrypted durable context tied to that session, attempt, pinned connection/tenant/current credential version, state, server expiry and PKCE verifier. Opaque strings alone are not proof. The verifier must reject expired, altered, wrong-purpose and cross-session context. Callback verification must bind the actual returned state and code to the sealed attempt; claim must succeed before exactly one provider exchange. No provider exchange belongs in a retried database transaction.
- Durable PKCE sealing/storage needs a separately reviewed purpose/AAD boundary. Existing refresh-token envelope encryption must not be repurposed as PKCE encryption. No plaintext PKCE, state, code, refresh token or provider payload may be logged or stored through this adapter.
- After exchange, the trusted grant-proof issuer must verify the exact pinned tenant, complete allowed read-only scopes including offline access, and encrypt the refresh token using the existing refresh-envelope machinery. It must bind the resulting envelope and exchange claim to the original attempt and credential version. It must not accept caller-supplied envelope ownership or arbitrary tenant IDs.
- `rpc.call` is a trusted server dependency, not a browser JSON-RPC endpoint. It must use a direct restricted `night_scout_xero_bootstrap_login` database session, without administrative fallback, pool identity substitution or SET ROLE elevation. The accompanying SQL proposal rechecks `session_user`, restricted role flags and absence of memberships on every command. Its SECURITY DEFINER `current_user` is intentionally the function owner, not the login. Installing that reviewed SQL is a separate owner action; mocks do not establish hosted privileges.

Until these dependencies are implemented and independently reviewed, leave the adapter unmounted and `enabled` false. The explicit staging project/store/key gates do not substitute for any boundary above.

## Commands and failure semantics

The only database commands are the fixed `xero_v1.customer_reconnect_begin`, `claim`, `fail` and `finalize` RPCs, using scope identifier `read-only-v1`. SQL generates the ten-minute expiry and exclusive claim and atomically guards mapping/owner, credential version and refresh lease. Prior authorization history is preserved.

`begin` returns only pending attempt/expiry. `claim` returns a **server-private** binding for the trusted proof issuer; never serialize it as an HTTP response. Failed or uncertain provider exchange must use the claimed failure path and fresh consent, never replay the code. `finalize` sends only an already encrypted refresh envelope. Lost acknowledgement or unexpected finalization result returns `unconfirmed`: inspect saved status, without retrying the exchange/write or marking a potentially committed attempt failed. Other errors expose only a generic unavailable message.

The module imports the existing scope allowlist and its synthetic tests exercise the existing refresh-envelope implementation. It deliberately implements no OAuth, encryption protocol, session verifier, durable proof provider, database client or route.

Run focused tests with `node --test experiments/xero/durable-reconnect-adapter.test.mjs`. These are command-boundary tests, not live OAuth or hosted-database acceptance.
