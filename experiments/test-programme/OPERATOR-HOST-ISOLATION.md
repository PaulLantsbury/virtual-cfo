# Isolated provider test-data operator — 15 October 2026

The Night Scout customer application and its provider integrations are read-only. Test-data generation is a separate operator tool, not an app feature. The previous default-off customer Settings consent and server writer runtime were detached; retired `/api/xero/test-writer/*` paths now return an unconditional no-store 404, even if old enable flags remain configured.

## Retained source, not a deployed service

`xero-test-writer-runtime.ts` and its tests were relocated here from the main API server. Its DB/auth factories must now be explicitly supplied by a future isolated host; it imports no customer app runtime or infrastructure credentials. `legacy-consent-ui/` retains the former design/helper/tests only as a reference outside app source and build graphs. It is not standalone operator UI. The existing bounded programme runner, provider transports, ledgers, scope restrictions, test-target checks, caps, idempotency and uncertain-outcome stops remain unchanged here.

A standalone operator consent API entrypoint is now prepared in `operator-consent-server.mjs`; a hosted consent service, secure operator sign-in UI and scheduler have **not** been created. Writer activation remains disabled. The operator runtime, bootstrap and router now share one explicit validated `NIGHT_SCOUT_TEST_WRITER_OPERATOR_ORIGIN` and exact callback. There is no default customer origin; both known customer origins and non-HTTPS/local/IP origins are rejected. The archived legacy UI remains a retired reference, never a deployable login interface.

## Required callback migration and deployment split

Before any activation, choose and review an exact separate HTTPS operator origin. Register its callback in the separate Xero writer developer app, then update the pinned redirect consistently in `xero-writer-bootstrap.mjs`, `xero-writer-bootstrap-router.mjs`, `xero-test-writer-runtime.ts`, their tests and any operator-only consent UI. Do not retain the customer site's callback in the writer app, and do not add a writer route back to Night Scout. Origin, CSRF/session/owner verification and secret-free callback/error handling need independent operator-host acceptance.

Only that isolated host/scheduler may hold writer client ID/secret, writer database URL, writer envelope key, Shopify write-scoped credentials, or provider-write network capability. No writer credential is necessary on the Night Scout web host or its read-only collectors. Review and remove old writer enable/credential configuration from those deployments using secure configuration management; this source change did not inspect or mutate hosted environment values.

Reader credentials remain separate and read-only. Separate writer apps/scopes are still required, including `write_orders` only on the dedicated Shopify development writer and invoice write permission only on the dedicated Xero demo writer. Test-target proof, bounded schedule/caps and operator approval continue to apply. This detachment changes no live database role, installed writer schema or historic programme record.

## Verification

Customer app/API build-graph tests assert no writer module, writer credential configuration or provider-write scopes enter their entrypoint graphs. Retired connect/callback paths are tested with the former enable flag set and remain 404 without redirect or SPA fallback. Relocated runtime/helper tests retain their existing synthetic guards. Production API bundle builds successfully. Standalone API typecheck currently also reports unrelated existing missing declaration files for read-only `.mjs` imports and unbuilt `api-zod` project outputs; no writer import/type errors remain.


## Concrete operator-host preparation (not deployed)

Choose a new separate Render Node web service, branch `codex/restart-baseline`, root directory `experiments/test-programme`, Node 24. The proposed service exposes only no-store `/health`, owner-authenticated `POST /api/xero/test-writer/connect`, and state-bound `GET /api/xero/test-writer/callback`. It logs neither requests/query strings nor tokens. The health endpoint contains no credential/provider state. Creation of the API service alone does not enable scheduled provider writes.

`operator-package.manifest.json` records exact top-level versions already present in the project: Express 5.2.1, pg 8.20.0, Supabase JS 2.100.1. It is deliberately not a root/workspace package and does not change the committed pnpm workspace/lock. A separate operator-owned dependency lock must be prepared/reviewed before reproducible deployment; no dependencies were installed by this package.

Proposed build command after that lock is prepared: `npm ci --omit=dev --ignore-scripts` (the isolated host must receive its own reviewed package.json/package-lock.json generated from the operator manifest). Start command: `node --experimental-strip-types operator-consent-server.mjs`. Health check: `/health`. Render supplies `PORT`; the entrypoint validates it and listens on the host boundary. It resolves dependencies relative to its own manifest, never from `artifacts/api-server`.

Operator-only configuration: explicit HTTPS operator origin; exact `${OPERATOR_ORIGIN}/api/xero/test-writer/callback` registered in the separate writer developer app; staging project/owner/store pins; dedicated writer client ID/secret; dedicated writer DB URL; separate envelope key/version; verified demo tenant; Supabase public auth URL/key for validating operator sessions. Keep all writer secrets and flags off the customer web service and its reader workers. Do not paste tokens into chat or use admin credentials as a fallback.

**Remaining usability/security gate:** this is an authenticated API, not a complete operator sign-in journey. A secure operator-only sign-in interface/session transport is still required. Owner verification uses fresh Supabase user validation and database membership checks; anonymous/cross-origin/non-owner connect is rejected. No request for an operator to manually copy/paste bearer tokens is part of this proposal. Do not deploy/activate the writer as a user-ready workflow until operator sign-in, callback registration, dedicated dependencies, host isolation and existing test-target/DB/schedule acceptance are verified.
