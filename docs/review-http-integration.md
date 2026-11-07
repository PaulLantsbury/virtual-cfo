# Financial review HTTP boundary — local development, 10 September

The API app now mounts `/api/financial-reviews` before its general body parsers. Its default router is deliberately unconfigured and returns a safe 503 response without database/Auth access. No environment flag activates it. Nothing is deployed and the existing local dashboard is unchanged.

The injectable router supports POST `/prepare` with `{scope}` and POST `/restore` with the exact reviewed scope, batch, digest and completeness attestation. `createReviewerService` composes those handlers with the existing token-verification and database-authorisation helpers. Dependencies come from server composition, never request JSON.

Requests require a bearer header and JSON; strict field lists reject extra identity/callback fields. Store/batch UUIDs, real calendar dates, ordered ranges, digest, confirmation and evidence lengths are checked before calling the service. Bodies are limited to 16 KB. Responses are no-store. Malformed/oversized bodies get fixed errors, without echoing submitted data. Known sign-in, permission and stale-review failures map to 401, 403 and 409. Unexpected database/upstream failures return a safe 503 and advise checking status before retrying; no automatic mutation retry is attempted.

The router does not validate a token itself: the composed service verifies it through Auth and checks explicit review permission. Cookies alone are not accepted. The existing API logger serialises only request ID/method/path and response status, and redacts authorization/cookie headers.

## Verification

Four new HTTP test groups pass using a temporary loopback server. They cover the disabled route, rejected headers/body/date/media type/size, safe errors and a complete synthetic prepare/restore/replay sequence through the real service helpers and restricted PGlite database role. A different store without reviewer permission is denied, and forged identity fields cannot override the verified user. Supabase Auth responses remain synthetic. The first sandboxed attempt failed because local listening was disallowed; rerunning with loopback permission passed.

API type checking and API build pass; the build reports its existing large bundle size. Run `pnpm run test:review-http` in an environment permitting loopback listeners. Prior ingestion/review checks remain recorded separately as 56 tests and seven PostgreSQL contention cases; this checkpoint does not claim a fresh run of every suite.

## Required before enabling

Provision a server-only Supabase client and restricted database pool for the same explicitly verified environment, including bounded Auth/network requests. Never reuse an unverified generic DATABASE_URL or browser-provided project URL. Check effective role privileges and migration readiness. Add request/rate limits appropriate to deployment, configure trusted origins/proxy handling, and connect a reviewer UI with clear uncertainty/status handling. Then review and apply the concrete staging changes and test real authentication end to end. The default disabled route must remain until these dependencies are ready.

No Supabase mutation, live Auth request, Replit sync, merge or production deployment occurred.
