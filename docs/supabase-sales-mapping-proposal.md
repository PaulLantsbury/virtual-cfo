# Supabase sales/refund mapping — prepared for review

8 September 2026. Current schema inspected read-only. Proposed additive SQL tested in disposable PostgreSQL, **not applied to Supabase**. No existing order/refund values, RPCs or application screens changed.

## Concrete input mapping

| Required input | Current Supabase source | Proposed handling |
| --- | --- | --- |
| Store and original order identity | `orders.store_id`, `orders.id` | Reuse IDs. Add composite indexes to support same-store evidence foreign keys |
| Gross product amount | `orders.gross_sales` | Read exact decimal; require verified tax basis and merchandise interpretation |
| Product discounts | `orders.discounts` | Require verified product-only basis; do not mix shipping discounts |
| Shipping amount | `orders.shipping` | Require verification that it represents shipping net of shipping discounts on the declared tax basis |
| Tax split | `orders.tax` is a single amount | Preserve raw value; require separately evidenced gross-product VAT, discount VAT and shipping VAT. Do not allocate the total by assumption |
| Currency | `orders.currency` often null; `stores.currency_code` exists | Require verified currency; do not silently use store default to fill missing order currency |
| Original eligibility | `financial_status`, cancellation fields describe current state | Require explicit original-order eligibility evidence. A later refunded status must not remove the original AOV denominator |
| Event date | `orders.order_date` versus `created_at`; `refunds.refund_date` versus `created_at` | Require resolved event date and evidence; do not guess import versus trading time or store timezone |
| Refund identity/amount | `refunds.id`, `order_id`, `store_id`, `amount` | Preserve event record. Same-store original link; verified component cash amounts must sum exactly to raw amount |
| Refund product/shipping/tax split | Not present on `refunds` | New evidence fields for product cash/VAT and shipping cash/VAT. Existing order-level `refund_ex_vat/refund_tax` cannot attribute individual events |
| Refund coverage | Sparse event records versus `orders.refunds` | Require explicit complete import evidence. Do not synthesise missing event dates/amount splits from cumulative order totals |
| COGS and saleable recovery | Line items, current variant costs and refund-line quantities | Not sufficient for historic cost/recovery evidence. This mapping returns COGS/profit incomplete; line-level mapping is a separate next step |

This is a reviewed mapping to the inspected column names, not a certification of the current seed's monetary semantics. Existing aggregate data gaps remain as recorded in the measured reconciliation.

## Proposed database change

`db-migrations/proposed/finance_v1_sales_evidence.sql` is deliberately outside the automatic migration directory. It runs atomically and adds:

- A private `finance_v1` schema.
- Order evidence, refund evidence and exact-period coverage evidence tables, with verifier/reference/timestamp fields.
- Two same-store unique indexes on existing orders/refunds to support evidence foreign keys. These can lock/build on existing tables; assess live size and deployment method before application.
- Two security-invoker mapping views over the existing raw tables and evidence.
- RLS enabled on the new tables, no client policies, public privileges revoked on the new schema/tables/views. No public/security-definer RPC is introduced.

The evidence contains a selected snapshot of the raw fields used by the mapping (not customer names, emails or whole order payloads). When raw financial values, currency/status, order date or refund identity/date/amount change, the view labels evidence stale. An importer/reviewer must reverify it. Adding any unverified store record also prevents the adapter from silently claiming complete results. This is intentionally conservative: until dates are verified, it blocks the store rather than assuming an unverified record belongs outside the selected period.

There is **no automatic backfill** and no raw data cleanup. New evidence tables start empty. Reapplying the proposal fails instead of silently overwriting a pre-existing `finance_v1` schema. Production application/rollback needs review; do not drop evidence tables once they contain verification history. The current design keeps latest evidence only; durable revision/audit history is still required for production verification workflows.

## Tested source connection

`experiments/financial-v1/cloud-sales-adapter.mjs` reads the proposed mapping views and coverage in a repeatable-read read-only transaction. It converts decimals exactly, normalises tax with the existing prototype, checks raw refund totals and cumulative component limits, and produces event-period sales and pre-refund AOV. It does not write verification records. Historic COGS is explicitly unavailable even when the monetary sales mapping succeeds.

`pnpm test:financial-cloud` runs nine tests against a minimal schema containing the relevant existing cloud columns and constraints, then executes the **exact proposed SQL**. Synthetic evidence is inserted solely by test setup. F03/F04 sales, shipping, original AOV and later refunds match the unchanged expected fixtures. Tests cover absent/stale evidence, changed raw amounts, mismatched refund splits/links, same-store foreign keys, RLS and atomic refusal to overwrite the schema. The existing source-adapter tests continue to cover the separate profit/cost inputs.

The test role cannot access mapping views; even after an artificial grant of schema usage and table SELECT/INSERT, RLS hides evidence and rejects insertion. This is not a Supabase Auth/PostgREST integration test or proof of the rest of the application's tenant isolation. The new schema grants no access to `anon`, `authenticated` or a future application service by default. A privileged verifier/server path needs its own scoped authorisation and audit design before this can be used in the live product.

## Migration-history finding

The standard migration-list tool failed because `supabase_migrations.schema_migrations` has only a `version` column, not `name`. A read-only direct query recovered 25 recorded versions, from `20260429000000` to `20260502000018`. Repository migration files include later May changes that are not present in that ledger, while many earlier recorded versions are absent as files. The repository also contains `20260430000007z_pre_views_functions.sql`, which is not the exact recorded version string.

Do not repair this by marking versions applied or replaying all files. Capture the real schema/functions/grants and reconcile provenance with the ledger first. The PGlite baseline reproduces the relevant table shape, not the entire Supabase project or migration history.

## Before applying or wiring the application

1. Resolve remaining eligibility/date/adjustment policies and obtain source evidence for tax/refund splits and complete imports. Do not infer approval from test data.
2. Review this proposal's schema, indexing impact, evidence workflow/history and server access design.
3. Reconcile the migration baseline and test against a faithful disposable copy, including actual API roles.
4. Apply only after review, populate verified evidence through a controlled process, and reconcile actual source totals. Then change the API/UI to consume the verified result.

Current outcome: schema mapping, proposed SQL and its local tests are complete for sales/refunds. Live wiring, data verification/backfill, line-level cost recovery and production deployment remain pending. GitHub draft branch contains these artifacts; main/Replit are not synchronised.
