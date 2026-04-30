# Timezone Handling Before Shopify Ingestion

## Summary

All Phase 1 RPC date-range filters use `created_at::date`. PostgreSQL resolves
`::date` by truncating the `timestamptz` value at the session's current
timezone. The Supabase cloud project defaults to UTC. For UK ecommerce
merchants, this means orders placed between midnight and 01:00 BST (UTC+1,
April–October) will be attributed to the previous calendar day.

This is acceptable for Phase 2 dummy-data work but must be resolved before any
live Shopify order data is ingested.

---

## Current behaviour

### Where `created_at::date` is used

Migration `20260429000002_cloud_schema_remediation.sql` contains the
SECURITY DEFINER rewrites of all Phase 1 RPC functions. Every date-range
function applies the same filter pattern:

```sql
AND created_at::date BETWEEN p_date_from AND p_date_to
```

This pattern appears in all nine date-range RPCs:

- `gross_revenue`
- `discount_cost`
- `return_amount`
- `net_sales`
- `order_count`
- `average_order_value`
- `repeat_purchase_rate`
- `discount_dependency`
- `refund_rate`

`contribution_margin_pct` (migration `20260429000003`) also uses
`created_at::date` on the underlying `orders` table rows via the same pattern.

`recoverable_contribution_range` (migration `20260429000005`) has no date
range — it is unaffected.

### Migration 000001 comment

The original function migration (`20260429000001`) already documents this
limitation in its header block (lines 16–20):

```
Date comparison: created_at::date BETWEEN p_date_from AND p_date_to
Timezone note : created_at::date truncates using the SESSION timezone
                (UTC by default in Supabase). UK merchants should set
                "timezone = 'Europe/London'" in supabase config or at
                connection time before calling these functions.
```

### Existing schema support

`stores.timezone` already exists:

```sql
-- migration 20260429000000_phase1_shopify_tables.sql
timezone text NOT NULL DEFAULT 'Europe/London'
```

The dev store seed row sets this to `'Europe/London'`. The column is present
and populated — it is not yet used inside any RPC function.

---

## Impact on UK merchants

| Scenario | Effect |
|---|---|
| GMT period (Oct–Mar) | UTC = local time. No misattribution. `::date` is correct. |
| BST period (Mar–Oct, UTC+1) | Orders placed 23:00–23:59 local (= 00:00–00:59 UTC next day) are assigned to the wrong reporting day. |
| Monthly totals | Small overcount at the end of a month / undercount at the start when BST is active. |
| Daily breakdown views | More visible — off-by-one on the boundary hours of every BST day. |

For the current dummy-data seed all timestamps are explicit UTC values with no
boundary-crossing cases. The error is invisible in Phase 2.

---

## Future fix options

### Option 1 — Store timezone in `stores.timezone` (schema work already done)

The `stores.timezone` column already exists with the correct value for the dev
store. No new migration is needed for the schema.

What still needs to be done: the RPCs need to read `stores.timezone` and apply
it. See Option 2 below for how to use it inside SQL.

### Option 2 — Apply `AT TIME ZONE` inside RPC functions

Replace the raw cast with a timezone-aware conversion before truncating to a
date. Two sub-approaches:

**2a. Join to `stores` inside the RPC:**

```sql
-- Example for gross_revenue()
FROM public.orders o
JOIN public.stores s ON s.id = o.store_id
WHERE o.store_id = p_store_id
  AND (o.created_at AT TIME ZONE s.timezone)::date
        BETWEEN p_date_from AND p_date_to
```

This is correct and self-contained but adds a join to every RPC and
slightly increases query cost. For 10 parallel RPC calls per dashboard
load the join is trivial, but it duplicates the join pattern in 10 places.

**2b. Add a `p_timezone text DEFAULT 'UTC'` parameter to each RPC:**

```sql
AND (created_at AT TIME ZONE p_timezone)::date
      BETWEEN p_date_from AND p_date_to
```

The frontend resolves the store timezone once and passes it alongside the date
range. This avoids the join but requires every RPC signature to change and the
`getPhase1Metrics()` call site in `phase1Metrics.ts` to be updated.

### Option 3 — Adjust the reporting period in the frontend

Instead of changing the RPCs, the frontend computes the date range in the
merchant's local timezone and passes UTC-equivalent boundary values. For
example, for a BST merchant a "1 April" day starts at `2026-03-31T23:00:00Z`
and ends at `2026-04-01T22:59:59Z`.

This works but pushes timezone logic into the frontend, which makes the RPCs
harder to call correctly from any other context (admin tools, scheduled jobs,
etc.). It also relies on callers always applying the conversion correctly.

---

## Recommendation

**Leave unchanged for Phase 2.** The dummy-data seed contains no
timezone-boundary edge cases, and `stores.timezone` is already stored. No
code or migration changes are needed during Phase 2 schema build work.

**Fix before live Shopify ingestion.** When real order timestamps arrive from
the Shopify API they will be in the merchant's local timezone (or UTC —
depending on the API version used). At that point, Option 2a (join to
`stores.timezone` inside the RPCs) is the recommended approach: it is
self-contained, requires no signature changes to `getPhase1Metrics()`, and
keeps timezone logic in the database where the data lives.

The fix requires a new migration that rewrites the SECURITY DEFINER function
bodies. It does not require any table schema changes.

---

*Last updated: 2026-04-30. Revisit before Shopify ingestion work begins.*
