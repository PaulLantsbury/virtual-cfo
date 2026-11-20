# Authentication and store isolation — restart status

Updated 8 September 2026. This replaces the April plan's unsafe implication that a store parameter or a frontend membership lookup alone enforces authorisation.

## Verified implementation state

The initial audit found simulated login/signup and hardcoded store IDs. The [subsequent local sign-in package](local-auth-handover.md) replaces these with Supabase SDK authentication and membership-gated active stores; it is not deployed. The frontend uses the configured public key. The captured public database schema has no membership table or policies. Of 24 public functions, 22 use SECURITY DEFINER and two use caller permissions.

A caller-controlled store ID is a filter, not an access check. A browser user can bypass frontend selection and call a granted RPC directly. Table RLS does not protect data read by an owner-executed function that bypasses it. Local reconstruction of the observed database proves an anonymous caller can retrieve a second synthetic store's recoverable-contribution total while a direct table read returns no rows.

The existing server opportunity route was unauthenticated and used a service-role credential to read a fixed demo store. Fixing the store ID does not authenticate its caller. **The local route now returns 503 until authenticated store access is implemented**, without making an upstream request. This change is on the draft branch only; it has not changed the deployed route. Static dashboard API responses remain demo content; deployed sign-in is still unverified.

## Proposed read-only access model

Supabase Auth was selected for the first implementation; local SDK integration now exists, with real staging verification pending. The [local SQL proposal](../db-migrations/proposed/20260908000002_store_membership_read_access.sql) adds `store_memberships(user_id, store_id)` referencing `auth.users` and `stores`, with a composite primary key. No roles, invitation flow or client write privileges are introduced. Membership grants/removal are trusted administrative operations; no automatic demo membership or backfill is included.

Authenticated users can read only their own memberships. Policies on all 22 captured business tables restrict rows to those memberships, including the stores table itself. All five views use caller permissions. All 24 existing functions are changed to SECURITY INVOKER so nested calls cannot bypass the table policies. Anonymous table/view/function privileges are revoked; authenticated clients receive only SELECT/EXECUTE and cannot insert, update, delete or self-enrol. Existing service-role privileges remain privileged and must never be used as a substitute for user authorisation on a public route.

This approach follows [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [function security guidance](https://supabase.com/docs/guides/database/functions). The database must derive identity from a validated session, and enforce membership on each read. A frontend store selector is only presentation.

The SQL is outside the automatic migration runner, atomic and intended for the captured baseline. It rejects a changed object inventory/existing policies and is not silently rerunnable. Review the fresh full schema before deployment; inventory counts alone are not schema equality. Future tables/functions require explicit access review and default-grant hardening. The private finance_v1 evidence proposal remains inaccessible to normal clients and is not included in this public read contract.

## Tested locally

Four PostgreSQL test groups cover:

- The anonymous cross-store exposure in the unchanged captured baseline.
- The proposed fix: Alice sees store A, Bob sees store B; explicit requests for another store return no protected data. All 24 RPCs reject anonymous execution and return the same results for an inaccessible store as an absent store with the seeded fixture. All five views exclude other stores.
- Missing identity, own-membership visibility, denied self-enrolment/data/membership writes, and immediate loss of access after membership removal.
- The earlier monthly-contribution correction cannot be replayed to restore SECURITY DEFINER after access hardening. That earlier proposal now rejects a changed security mode.

An HTTP regression test verifies that anonymous and forged-token/store requests receive 503 from the local server opportunity route and make no upstream calls. It uses a temporary loopback server; the sandbox initially blocked the socket, and the approved local test then passed.

Run `pnpm test:access`. The full suite totals 71 passing tests, including 66 previous tests, four database access groups and the HTTP route group. Full workspace type checking and build are also run for the server change; see the sprint handover for their results.

**Limit:** PGlite uses a test-only auth.users table and auth.uid function with a controlled subject setting. It does not validate JWTs, passwords, expiry, refresh, invitations, PostgREST or real Supabase identities. These tests verify the database role/RLS contract, not a working end-to-end sign-in system. All 24 RPCs are exercised with representative inputs; this is not exhaustive coverage of every function branch. An inaccessible-store aggregate may retain legacy zeros/defaults; those are not certified financial data.

## Work required before deployment

1. Confirm Supabase Auth and configure a separate staging environment with two real users and two synthetic stores, plus an authenticated non-member. No real merchant data is needed.
2. Verify the locally implemented sign-in/sign-out/session expiry handling and gated active-store selection against staging. Never fall back to the demo UUID for an authenticated merchant. Clear store data/cache on user/store changes and logout.
3. Restore the opportunity route only with verified user identity and user-scoped database credentials, or call the membership-protected RPC directly from the authenticated client. Remove service-role proxying from public request paths.
4. Test valid/expired/forged/missing tokens, direct REST/RPC bypass attempts, revoked membership and reads/writes in the real Supabase gateway. Review all remaining public routes, schema/default grants, function branches, performance and privileged ingestion paths.
5. Register reviewed migrations after reconciling history. Apply monthly-contribution correction before the membership proposal. No blanket ledger repair or historical seed replay. Recheck the full schema and permissions immediately before deployment.

GitHub's draft is the durable record. Nothing in this package was applied to Supabase, main or Replit. The application cannot yet claim authenticated tenant isolation in production; local SDK wiring and mocked tests are not live deployment evidence.
