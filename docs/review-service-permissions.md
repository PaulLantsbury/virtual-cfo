# Review service permissions — 10 September 2026, local proposal

`ingest_v1_review_service.sql` must follow the candidate, finance, invalidation and restoration proposals. It is not in the automatic runner and has not been applied to Supabase.

## Service boundary

The dedicated `night_scout_review_service` role has no login, role inheritance, superuser, role/database creation, replication or RLS-bypass capability. The proposal grants no user membership and creates no credential. An existing role with unsafe attributes or parent-role membership is rejected. Before applying to an existing environment, audit any pre-existing grants and PUBLIC/default privileges; this additive proposal does not clean up unrelated historic grants.

The role can read the required source/review relations, append an audit record, update only coverage verification fields and change only the candidate head's recheck flag. It cannot alter raw orders/refunds, source versions, event evidence, reviewer permissions or memberships; change coverage dates or batch identity; create tables in the private schema; or mutate/truncate audit history. Existing append-only audit enforcement remains active.

This is a trusted backend role with cross-store read access and limited cross-store write capabilities. It is NOT a merchant role or a replacement for request authorisation. A compromised backend connection could misuse its allowed coverage/audit writes. Never expose it through client credentials or grant it to anon/authenticated. Both preparation and restoration must use the authenticated service helpers; direct calls to the lower-level inspection helper are internal only.

## Locking exception

The existing strong table locks require privileges that would otherwise permit source mutations. A fixed, argument-free SECURITY DEFINER function now takes those exact locks as the migration owner. It contains no dynamic SQL, reads or writes no rows, uses a fixed pg_catalog search path, and is executable only by the review role (plus its owner). Ordinary clients cannot execute it. This is a narrowly scoped exception to the earlier invoker-only prototype; do not generalise it to data access.

The restoration helper uses this function before rereading authorisation and evidence. Its existing bounded timeouts and atomic rollback still apply. The invoker invalidation helper is also executable by this internal role, to support coverage withdrawal through existing triggers.

## Authenticated preparation

`prepareReviewWithReviewerToken` verifies the bearer token, then checks membership AND explicit review authorisation inside the same read-only snapshot used to prepare the packet. A user who belongs to a store but lacks review permission is refused before private candidate inspection. The packet does not return the retained raw audit snapshot.

## Verification and next step

56 Shopify/source/review/auth tests pass. New role tests prove successful authorised restoration and deny raw/source/evidence mutation, permission changes, audit modification, schema creation and protected column changes. Client sessions cannot assume the service role or invoke the lock helper. A second store's ordinary member cannot prepare its review without the explicit grant.

All seven independent PostgreSQL 18.4 contention cases pass again, now with restoration transactions using the restricted role and lock helper. Temporary clusters were stopped and removed. This is not a test of live Supabase roles, a provisioned login or real Auth responses.

Next: provision the server-side client/pool composition in code with environment matching, bounded Auth requests and safe HTTP request handling, then reviewer UI integration. Review the concrete staging migration and provisioning plan before applying anything remotely. No Supabase, Replit or production changes occurred in this checkpoint.
