# Staging Xero test-tenant consent bootstrap

Status: **implemented as a server-only, injected composition boundary; not yet wired to a hosted staging callback.**

`experiments/xero/staging-consent-bootstrap.mjs` completes one already
state-validated OAuth callback. It is deliberately capability-injected:

1. `exchangeAuthorizationCode` performs the OAuth code exchange and tenant
   discovery inside a trusted server process. It returns only the selected test
   tenant identifier and a transient refresh credential to the coordinator.
2. `encryptRefreshCredential` creates an AES-256-GCM envelope with the
   staging-only server key. It is the only component allowed to receive the
   refresh credential after the exchange.
3. `persistConnection` writes the tenant-pinned connection and ciphertext
   envelope through a trusted staging persistence port.

The only completion result is `{ connectionId, storeId, tenantId, status }`.
The authorisation code, access token, refresh credential, encrypted data key,
and ciphertext are never returned, logged, audited by this module, or supplied
to a browser client. Any malformed provider output, tenant mismatch, encryption
failure or persistence error becomes the same safe `Xero staging consent
unavailable` outcome.

The caller must consume the signed one-time OAuth `state` before invoking this
module. A staging implementation must additionally bind the member/owner and
store identity from authenticated server state; those values must never be
accepted from a browser as authority. The expected Xero tenant must be pinned
before exchange completion and must match the discovered tenant exactly.

The module has no environment access, database driver, scheduler, filesystem,
network request or console logging. Its tests use injected mocks only and prove
that token material cannot enter the success receipt or error message.

## Activation prerequisites

Before wiring a real staging callback, provide a worker/server persistence port
that creates the owner-authorised `xero_v1.connections` row and stores the first
credential envelope atomically. The current restricted refresh-worker role is
correctly limited to envelope rotation and evidence functions; it cannot create
connections and must not be broadened. This consent-writer privilege should be
a separate, audited server capability with no browser access.

This design applies only to the approved staging Xero **test tenant**. It does
not authorise production activation or a real merchant credential.
