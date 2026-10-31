# Night Scout — 29 October 2026 development handover

## Priority and decisions

Daily development test data flowing through Shopify/Xero into Night Scout takes priority. Remaining page redesigns are later work; broader CFO recommendations remain deferred. Keep customer connections read-only, provider writers isolated, test orders excluded from merchant sales and previously approved financial definitions intact.

The owner approved the bounded seven-day Shopify proposal and its reviewed setup, with activation conditional on readiness. Do not ask for that same approval again. The Xero restart proposal is separate and unapproved. Preserve expired programmes and their action history. Never shift dates, create catch-up actions, reuse old envelopes or infer scheduled success from a build.

## Source work completed today

- Settings explains retained test-order counts and exclusion from merchant sales; the historical September failure is presented as historical evidence. A disposable collector → candidate → journal → authenticated RPC → status test checks retained exclusions and replay behavior.
- Explicitly opt-in Shopify daily profile, strict disabled binding proposal, metadata/window gates and independent SQL capability tests preserve legacy programmes and prevent direct access to the underlying claim implementation.
- New restricted database preflight validates the dedicated configuration/TLS, authenticates the exact restricted login, verifies SET-only membership and RPC ACLs inside a read-only transaction, then rolls back. It cannot claim, post, enable or reset anything. A real restricted-session regression covers schema resolution after role assumption.
- New read-only Shopify ingestion verifier correlates the exact planned action with the next nightly claim, a unique attempt/candidate, retained test flag/exclusion and zero mapped or merchant-order inclusion. It reports only safe states, dates and ordinals. Its period/time correlation does not prove a host scheduler triggered or certify financial reporting.
- Xero restart preparation adds a fresh explicitly unapproved daily profile, source/database/operator readiness checks and one-use consent routing that seeds a new disabled encrypted writer envelope. It preserves legacy history and Shopify safeguards. Actual separate-app consent, approved dates/hosting and same-demo reader alignment remain gates.
- Isolated owner sign-in now holds the token only in browser memory and sends it automatically to the owner-gated consent API. A consent-only deployment package has an independent frozen lock and passed an actual isolated install/startup smoke. These are prepared source packages; they do not authorize new hosting, credentials, callbacks, grants, consent or activation.

## Resume documents

- [Shopify restart sequence](../experiments/test-programme/SHOPIFY-RESTART-2026-10-29.md)
- [Private credential recovery procedure](../experiments/test-programme/DATABASE-PASSWORD-RECOVERY.md)
- [Read-only ingestion verification](../experiments/shopify/VERIFY-TEST-INGESTION.md)
- [Xero restart proposal and blockers](../experiments/test-programme/XERO-RESTART-2026-10-29.md)

Operational host/database observations, exact approved deployment state and password recovery progress are recorded in the owner's private session handover. This public source checkpoint intentionally does not reproduce internal service telemetry. Read that private evidence before attempting live work; do not treat older prepared-only or access-blocked notes as current facts.

## Validation and limits

Earlier combined batch: 40 checks passed; frontend TypeScript and build passed (build rerun with required PORT/BASE_PATH; existing bundle/sourcemap warnings). Final integrated regression: **60 checks passed**, including restricted-session database preflight, ingestion verifier, Xero consent/profile, isolated owner UI/package and existing Shopify/legacy paths. The isolated frozen production install passed for all 92 dependency snapshots; disabled/synthetic HTTP smokes made zero database/provider calls. Full API TypeScript checking was attempted and remains blocked by existing missing declarations in unchanged Xero modules and unbuilt api-zod declaration outputs; this is not a passing backend-wide typecheck.

These tests use disposable fixtures and databases. They do not prove real consent, live restricted credentials, multi-backend PostgreSQL concurrency, provider action execution, host scheduling, retained overnight acceptance or populated financial dashboards. Production/main merge and a Shopify reader hosting cutover remain outside this package. Keep Replit until replacement overnight acceptance is independently verified.
