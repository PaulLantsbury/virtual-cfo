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
