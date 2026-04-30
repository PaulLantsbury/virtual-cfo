# Auth & Store Isolation Plan

## Purpose

This document describes the future work required to replace the hardcoded
`PHASE1_STORE_ID` constant with authenticated per-session store resolution.
It is a planning reference only. No application code should be changed until
the prerequisite auth and membership table work described below is in place.

---

## 1. Current state

### Hardcoded store ID

`artifacts/virtual-cfo/src/pages/dashboard.tsx` lines 28–32:

```ts
// DEV-ONLY — hardcoded seed store UUID. Must be replaced with the
// authenticated session's store_id before any real merchant can use this page.
// Primary source: auth session → stores.id lookup.
// Not safe for production multi-tenant deployment.
const PHASE1_STORE_ID = "10000000-0000-0000-0000-000000000001";
```

This UUID is the dev store UUID (`Bloom & Co.`) seeded by migration
`20260429000004_cloud_seed.sql`. It is hardcoded at module load time.
Every call to `getPhase1Metrics()` in the dashboard `useEffect` passes this
constant directly:

```ts
getPhase1Metrics(PHASE1_STORE_ID, PHASE1_DATE_FROM, PHASE1_DATE_TO)
```

### What is already multi-tenant

The following pieces are already written for multi-tenant use and require no
structural changes when real store IDs are introduced:

- **All 11 Phase 1 RPC functions** accept `p_store_id uuid` as their first
  parameter. The SQL inside each function filters exclusively on that parameter.
  No cross-tenant data can be returned by the RPCs themselves.

- **`getPhase1Metrics(storeId, dateFrom, dateTo)`** in
  `src/lib/analytics/phase1Metrics.ts` accepts `storeId` as a plain string
  argument. There is no internal reference to the hardcoded constant inside
  this function.

- **All 14 Phase 1 tables** have `store_id NOT NULL REFERENCES stores(id)` on
  every tenant-owned row. The data layer is structurally multi-tenant today.

The only change needed on the frontend is the source of `storeId` — from the
hardcoded constant to a value derived from the authenticated session.

---

## 2. Required future tables

A membership table is needed to record which Supabase auth user has access to
which store, and in what role. Two acceptable names:

- `user_stores`
- `store_memberships`

Either name is acceptable; choose one and be consistent across migrations,
RLS policies, and application code.

### Minimum required columns

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid NOT NULL DEFAULT gen_random_uuid()` | PK |
| `user_id` | `uuid NOT NULL` | FK → `auth.users(id)` (Supabase built-in). `ON DELETE CASCADE`. |
| `store_id` | `uuid NOT NULL` | FK → `public.stores(id)`. `ON DELETE CASCADE`. |
| `role` | `text NOT NULL DEFAULT 'owner'` | e.g. `'owner'`, `'admin'`, `'viewer'`. Define the allowed set before the migration. |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Membership grant timestamp. |

### Recommended constraints

```sql
UNIQUE (user_id, store_id)
```

One role per user per store. If a user needs a role upgrade, UPDATE the
existing row rather than inserting a second.

### Relationship to `stores`

The `stores` table already exists. No changes to `stores` are required for the
membership model to work; `user_stores.store_id` simply references the
existing PK.

---

## 3. Required frontend changes

The following changes must be made together as a single unit — they are not
safely splittable because removing the hardcoded constant before the
authenticated resolution is in place would break the dashboard entirely.

### 3a. Resolve the active store for the logged-in user

After the user signs in, query the membership table to find all stores the
user belongs to:

```ts
const { data: memberships } = await supabase
  .from("user_stores")           // or "store_memberships"
  .select("store_id, role")
  .eq("user_id", session.user.id);
```

For Phase 2 (single-store merchants) the first row's `store_id` can be used
directly. Multi-store switching (a store selector) is a separate, later
concern and is not required to unblock this work.

### 3b. Pass the active store UUID into `getPhase1Metrics()`

Replace:

```ts
getPhase1Metrics(PHASE1_STORE_ID, PHASE1_DATE_FROM, PHASE1_DATE_TO)
```

with:

```ts
getPhase1Metrics(activeStoreId, PHASE1_DATE_FROM, PHASE1_DATE_TO)
```

where `activeStoreId` comes from the resolved membership query above.

`getPhase1Metrics()` already has the correct signature — no changes to the
function itself are required.

### 3c. Remove the hardcoded constant

Delete the `PHASE1_STORE_ID` constant from `dashboard.tsx` entirely.
If any other file references `PHASE1_STORE_ID` at the time of removal, those
references must be resolved in the same commit.

### Suggested state management approach

Store `activeStoreId: string | null` in React state or a lightweight context.
Initialise to `null`. Render the dashboard in a loading/gated state while
`activeStoreId` is null, then trigger the `getPhase1Metrics()` call once it
is resolved. This avoids a brief window where the dashboard fires RPCs with an
empty or incorrect store ID.

---

## 4. Security notes

### RLS policy considerations

Supabase Row Level Security should be the final enforcement layer for tenant
isolation — it should not be the only layer, but it must be in place before
production traffic can reach real merchant data.

The minimum RLS posture for the membership-driven model:

- `user_stores` / `store_memberships` — users should only be able to `SELECT`
  their own rows (`user_id = auth.uid()`). No `INSERT` or `UPDATE` should be
  permitted via the client key; membership grants must go through a trusted
  server-side function or admin path.

- All tenant data tables (`orders`, `customers`, `products`, etc.) — `SELECT`
  policies should check that `store_id` appears in the set of stores the
  calling user has a membership row for. Example pattern:

  ```sql
  CREATE POLICY "tenant_isolation" ON public.orders
    FOR SELECT USING (
      store_id IN (
        SELECT store_id FROM public.user_stores
        WHERE user_id = auth.uid()
      )
    );
  ```

- RLS should be **enabled but permissive (or absent) in the dev environment**
  during Phase 2 dummy-data work. Hardening to the above pattern is Phase 3
  work (see "Not in scope" below).

### SECURITY DEFINER RPC tenant isolation

All 11 Phase 1 RPCs are `SECURITY DEFINER`. This means they run as the
Supabase `postgres` role, bypassing RLS entirely. They enforce tenant
isolation purely through their `p_store_id` parameter — there is no
additional row-level check inside the function body.

This is safe **only** under the following conditions:

1. The `p_store_id` value is **not** taken verbatim from client-supplied input
   without validation. The server-side resolution step (section 3a) must
   verify the user is a member of the requested store before calling the RPC.

2. The Supabase service role key is **never** exposed to the browser. RPC
   calls from the frontend must use the `anon` key. The anon key's effective
   permissions are controlled by RLS on the non-RPC tables.

### Risk: trusting client-supplied `store_id`

If the dashboard simply reads a `store_id` from a URL parameter, local
storage, or any other client-controlled source and passes it to
`getPhase1Metrics()` without server-side validation, an authenticated user
could pass any store UUID and receive that store's metrics — because the RPCs
do not themselves check membership.

**Mitigation:** The active store must be resolved server-side (via a Supabase
function or a verified membership query) and must never be taken from
unvalidated client input. The frontend state derived from a successful
membership query is the only safe source for `activeStoreId`.

This risk exists today in the dev environment too, but is acceptable because
the only store that exists is the seed store, and the API is not publicly
reachable with real merchant data. It must be resolved before any real
merchant connects their store.

---

## 5. Not in scope for Phase 2 dummy data

The following items are explicitly deferred. Phase 2 work (continued
dummy-data development, additional metric tiles, analysis pages) may proceed
without them.

| Item | Reason deferred |
|---|---|
| Full authentication UI (sign-in, sign-up, password reset) | Phase 2 continues to use the seeded dev store. No auth flow is needed for dummy-data work. |
| Shopify OAuth / store connection flow | Shopify API integration is post-Phase 2. No production store data will be ingested during Phase 2. |
| `user_stores` / `store_memberships` table creation | The table does not exist yet. Adding it is the gating item for Phase 3 auth work. |
| Production RLS hardening | RLS policy authoring and testing requires real user accounts and membership rows to test against. This is Phase 3 work. |
| Multi-store switching UI | Single-merchant scope for the initial launch. A store selector is a later iteration. |
| Session refresh / token expiry handling | Depends on the chosen auth provider (Supabase Auth, Clerk, etc.), which is not yet decided. |

---

## Gating dependencies

The following must all be true before `PHASE1_STORE_ID` can be removed:

1. An auth provider is chosen and integrated (Supabase Auth or Clerk).
2. The `user_stores` / `store_memberships` table exists in the cloud schema
   with at least one membership row for the dev/test user.
3. The frontend can obtain `session.user.id` from the auth provider.
4. A membership resolution query has been tested against the cloud project.
5. RLS on `user_stores` is enabled (even if permissive) so the anon key
   cannot enumerate all stores.

None of items 1–5 are Phase 2 work. Phase 2 concludes with the hardcoded
`PHASE1_STORE_ID` still in place.

---

*Last updated: 2026-04-30. Update this file when the auth provider decision
is made or when Phase 3 planning begins.*
