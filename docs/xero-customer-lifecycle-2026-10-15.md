# Customer Xero reconnect lifecycle — 15 October 2026

Status: pure command contract and 31 synthetic tests prepared. Not wired to routes, not durable, not installed, not production ready. No database grant, OAuth scope, scheduled job or provider transaction changes.

## Existing implementation and gap

The September merchant credential lifecycle design remains the architecture baseline. Its in-memory lifecycle already proves connection creation, tenant selection, envelope isolation, refresh leasing and disconnect. This package does not replace those components. Its connect-only mock refuses reconnect while an existing connection exists; it is not customer recovery.

The current staging bootstrap uses process-local `states`, `discoveries` and `selections` Maps. Deployment/restart loses pending browser attempts. Reconnect permission is granted through ordinal reviewed staging SQL (first through sixth); those temporary narrow permissions protect staging, but are not a reusable customer workflow. The sixth installation receipt and first post-consent successful preflight do not establish ongoing reliability.

`customer-lifecycle-reconnect.mjs` defines two pure transitions: start a bounded consent attempt and prepare an atomic credential-replacement command. Context and provider proof are trusted server products, never browser assertions. The reducer is deliberately not an authorization boundary by itself.

## Durable adapter required before activation

Use an additive persistent attempt relation rather than another numbered recovery table. No migration is included: schema/authentication/key-service review is required before a concrete migration can be responsibly finalized.

Required fields: opaque attempt ID; connection/store/tenant; verified owner actor; digest of session binding; state digest; approved scope-set version; expected credential version; creation/expiry; pending/exchanging/consumed/failed status; consumption timestamp and replacement version. PKCE verifier and any temporarily staged credential envelope need a dedicated encrypted boundary and expiry cleanup, never browser-readable columns. Retain no plaintext OAuth material in audit or status records.

Start must lock the connection and load the caller's current owner membership. Expire earlier attempts atomically; enforce one nonterminal attempt per connection with a unique partial index. Neither an in-process Map nor an unlocked pre-query establishes this guarantee. Scope version is the current approved read-only version; it cannot be provided or expanded by the browser.

Callback must atomically claim pending -> exchanging before external code exchange, with the state digest, session, owner and expiry checked. This prevents simultaneous callbacks from exchanging one code twice. Provider calls occur outside the database transaction. Failed or uncertain exchange consumes/fails the attempt; restart with fresh consent rather than reusing an authorization code. Recheck membership at final commit.

Final transaction locks attempt, connection and credential row in a consistent order. Require exchanging state and the matching exclusive exchange claim. Recheck expiry, pinned tenant, scope version, credential version and absence of an active refresh lease. Atomically replace the encrypted credential with compare-and-swap version +1, consume the attempt and append value-free audit. Require exactly one updated credential and one consumed attempt or roll back everything. A reducer returning a command is not proof of atomic persistence.

Preserve mapping, accounting evidence, prior successful freshness and append-only historical records. A tenant change is a new connection and mapping review, never a reconnect overwrite. Reconnect alone does not make accounting data fresh. Provider success followed by failed persistence must fail closed; securely discard uncommitted material and start fresh consent. Transactions cannot undo an external provider grant or refresh rotation.

Tests cover successful command shape, expiry, duplicate active attempt, owner/membership/session/store/tenant/scope isolation, exclusive exchange claim, stale credential version, replay, refresh lease (including malformed lease rejection), safe credential-version bounds, malformed active-attempt expiry, retirement, fresh code/consent, offline access and validated opaque envelope reference. They do not prove database concurrency, encryption, OAuth or provider behavior. Disposable database concurrent-claim/CAS/rollback tests are the next implementation acceptance gate.

## One customer flow, existing consent boundary

For a pinned connection, Settings can eventually start one fresh consent using the already approved read-only scopes plus offline access, verify returned tenant membership, then perform the durable final commit. No separate discovery consent is necessary to learn an already pinned tenant. For first connect with multiple organisations, use durable tenant selection after a single approved consent, staging only encrypted short-lived material until selection. This is a proposal, not a runtime change or expanded provider authority.

The existing two-stage staging discovery/retained-consent path stays unchanged until its replacement is implemented and reviewed. No automatic consent clicks, token copying or live grant broadening is part of this package.

## Dependencies and release evidence

1. Agree dedicated runtime role/session-verification and encrypted staging-envelope storage; prepare least-privilege additive DB migration and rollback plan for separate application approval.
2. Implement durable attempt adapter and authenticated Settings routes; current membership is checked on every mutation. Prove duplicate callbacks, worker refresh race, DB rollback, process restart and cross-store isolation in a disposable database.
3. Implement one-consent pinned reconnect with exact callback, CSRF/state and PKCE tests; preserve existing scopes and account-mapping rules.
4. Verify hosted web/worker revision identity, real token renewal beyond 30 minutes, delayed reconnect, revoked consent and unattended scheduled collection.
5. Display status and last verified collection separately; retain previous supported results on failure. A routine transient retry is not a new consent request.

Hosted access is currently blocked by observed Render secure sign-in/canonical recovery navigation timeouts. No browser retries or alternative credential access were attempted in this package. Ongoing Xero/Shopify writers are not active; Google/Meta live setup remains deferred pending test accounts.

## Durable database proposal — next batch, 15 October

Supersedes the earlier “no migration included” checkpoint above: `db-migrations/proposals/xero-durable-reconnect-2026-10-15.sql` now prepares a concrete additive attempt relation and `customer_reconnect_begin`, `customer_reconnect_claim`, `customer_reconnect_fail`, `customer_reconnect_finalize` RPCs. It has not been applied and no runtime route has been enabled. The disconnected server adapter is a separate package.

The proposal reuses the existing restricted bootstrap login rather than provisioning a new secret. Installation verifies its reviewed LOGIN/NOINHERIT/no elevated flags/connection-limit-one shape and rejects memberships in either direction; it never silently repairs drift. The same restricted role shape and lack of memberships are rechecked by the internal guard on every command, so post-install role drift fails closed too. Direct attempt-table access is revoked from that login and all browser/import identities, with RLS enabled. The internal guard is not independently executable by the login. The four top-level RPCs are its only new capabilities. They are pinned to the existing staging store; future customer enablement requires replacing this explicit staging boundary through review, not removing it dynamically.

Owner authority currently means the latest mapping confirmation's actor plus current store membership, matching this staging model; it is not an assertion that `store_memberships` has a generic owner-role column. Every transition rechecks that authority. Lock order is store -> active connection -> membership -> credential -> attempt. The store lock serializes new FK-bound connection insertion; the membership lock prevents revocation committing during the transaction. Credential version and lease are rechecked at rotation. Two callbacks cannot both claim one attempt; consumed or uncertain exchanges cannot be reused.

RPC proof inputs are server-derived SHA-256 session/state digests, existing read-only scope-set identifier and pinned tenant, never browser-authoritative fields. SQL stores no PKCE verifier, OAuth code, raw state, token, or pending provider credential. It cannot independently verify provider consent, allowed scope strings or ciphertext cryptographic correctness; the separately authenticated server adapter must do so. A sealed, purpose-separated durable PKCE context and complete OAuth wiring remain required before activation. Existing ordinal recovery functions and evidence/mapping/history tables are untouched; only final successful rotation appends the existing credential audit event.

The database tests execute against disposable PGlite PostgreSQL, including replay, cross-store/session proofs, membership revocation, owner change, active lease, stale version, expiry/retirement/tenant changes, injected audit failure rollback, unknown exchange outcome and fresh consent after abandonment. Simultaneous JavaScript calls are serialized by PGlite; this does **not** prove independent PostgreSQL backend lock behavior. A real two-connection PostgreSQL concurrency test remains an activation gate; no local PostgreSQL server/binaries were available in this environment. Do not describe these tests as hosted validation.

Unknown commit outcome: never retry OAuth code exchange or automatically re-finalize with credential material. The durable record may already be consumed. Report uncertain status, retain previous verified collection and require a fresh server status/recovery decision. The current proposal does not add a public/browser status reader.
