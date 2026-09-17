# PocketLaunchpad1 staging intake proposal — 17 September 2026

Status: code-backed proposal only. No database query, migration, permission grant, store creation, source collection or application change was performed in this review. The coordinator subsequently verified read-only live API context: Shop `gid://shopify/Shop/95601983836`, domain `pocketlaunchpad1.myshopify.com`, GBP, `Europe/London`, both `read_orders` and `read_all_orders`, and response API version `2026-07`. The existing collector completed one page with zero orders. This is a successful read-only connection check, not a data import or test-transaction exercise.

## Reuse the existing pipeline

Use `createConnectionReadiness` in `experiments/shopify/connection-readiness.mjs`: fixed Shopify reader → bounded full-history collection → detail validation → `recordShopifyCandidate`. It resolves credentials on the server and records unverified candidates. Do not create a second import engine, financial formula or public collection endpoint.

The remaining stages are distinct: authorised first/subsequent finance import creates matching evidence with coverage still unverified; the existing `/financial-review` service checks source/evidence agreement; an authorised human then independently reviews completeness before restoration. A recorded candidate alone cannot populate that screen's imported-transaction evidence or publish verified sales. Never describe this as an automatic candidate-to-approved-reporting pipeline.

## Concrete store mapping

Target only Supabase staging `bioalckltvkhlczusdvl`. Production/original `futkktdebdygsdrcknpr` is outside this package.

If and when staging intake is approved, prepare a new `public.stores` row using the verified context below and a read-only duplicate check:

| Column | Proposed value / prerequisite |
| --- | --- |
| `id` | Fresh UUID generated once in the reviewed setup script; do not use an existing synthetic UUID |
| `shopify_domain` | `pocketlaunchpad1.myshopify.com` (live API verified) |
| `shopify_store_id` | `95601983836` (live API GID `gid://shopify/Shop/95601983836`); app/organisation IDs are not substitutes |
| `name` | `PocketLaunchpad1 — Shopify development store` |
| `currency_code` | `GBP` (live API verified) |
| `timezone` | `Europe/London` (live API verified) |
| `is_active` | `true` |
| timestamps | Existing defaults |

The recorder accepts the numeric or full `gid://shopify/Shop/...` ID, compares domain/currency/timezone, and locks the store row. Freeze one representation in the setup manifest and test its identity match. Fail on existing conflicting domain or Shop ID; do not overwrite another store.

Keep synthetic Store D (`90000000-0000-4000-8000-000000000004`, `night-scout-profit-fixture-d.invalid`) and all its evidence unchanged. Do not copy its costs, completeness statements or profit coverage into the development store.

For Paul's existing confirmed staging sign-in, a new `public.store_memberships(user_id,store_id)` row permits ordinary store access. A separate `ingest_v1.review_authorizations(store_id,reviewer_id)` row permits financial review. Both are administrator writes requiring approval for this new store; prior Store D grants do not confer this access. Resolve the account UUID privately from the existing confirmed account, not from a caller-supplied reviewer ID or a new account. Membership and reviewer access do not certify figures.

## Missing candidate-intake capability

The repository contains restricted review and finance-import roles, but no dedicated candidate-intake role/runtime. Neither existing login is a suitable substitute. The following is a minimum capability design, not executable provisioning SQL:

- Create a dedicated `night_scout_intake_service` NOLOGIN role and separate private NOINHERIT login; neither may inherit elevated roles, bypass RLS, create roles/databases, replicate or act as superuser. Use TLS certificate validation and bounded connection/statement/transaction timeouts as in the review runtime.
- Pin access to the new development-store UUID using explicit SELECT/INSERT/UPDATE RLS policies and server-side identity checks. Do not grant cross-store intake merely because the existing trusted review service has cross-store powers. Browser `anon`/`authenticated` roles get no intake grants.
- Read the matching `public.stores` identity/settings and `ingest_v1.batches`, `heads`, `source_versions` rows for that store.
- Insert candidate batches; update only `batches.superseded_at`. Insert heads; update only `heads.batch_id` and `heads.needs_recheck`. Insert source versions; update only `source_versions.source_version` and `source_versions.fingerprint`. Do not allow deletion, truncation, schema creation, review-authorisation changes or review-audit writes.
- Preserve existing invoker invalidation triggers. Source-version/head writes also require the exact SELECT/UPDATE access needed to set `finance_v1.coverage_evidence.sales_and_refunds_complete` to **false**, and execute `ingest_v1.invalidate_verified_store(uuid)`. RLS must restrict this to the new store and forbid a true coverage value. This is withdrawal of prior verified coverage, never certification.
- The current recorder uses `SELECT ... FOR UPDATE` on `public.stores`. A SELECT-only role cannot execute that lock. Do not solve it with broad store UPDATE grants. Prepare a narrowly scoped lock helper with a fixed search path and explicit configured-store check, or another independently reviewed locking adaptation, then run recorder concurrency/replay tests using the real restricted role. Existing unrestricted disposable tests do not prove this role composition.
- The role must not write `public.orders`, `public.refunds`, finance event evidence, coverage dates/batch identity, membership or review decisions. Finance import and review remain separate capabilities.

Before requesting application: inspect current staging role/object/policy inventory; generate the exact migration and provisioner against that inventory with the resolved UUID; test happy path, replay, changed-source invalidation, rollback, cross-store denial, source-write denial, certification denial and store-lock behaviour in disposable PostgreSQL. Review default/PUBLIC privileges as well as explicit grants. Do not rerun the original staging schema setup merely because its source file still says local proposal.

## UI truthfulness and minimal integration

Code inspection found no Shopify connection-state endpoint or functional integration panel. `artifacts/virtual-cfo/src/pages/settings.tsx` is still an Acme Corp prototype with inert navigation/actions; it must not be used as proof of connection status.

Reuse the existing scoped store selector, reporting controls and `/financial-review` page after approved store access. Its missing-data message says no imported transactions are ready; preparing review is not approval. Shared reporting already distinguishes unavailable evidence from zero results. The review screen cannot diagnose token expiry or whether the app is installed, so do not label either condition from absence of financial evidence.

For this package, operator-visible read-only connection receipts are enough. They should separate:

1. API authentication/identity/scopes checked at a stated time (not permanent connection health).
2. Source collection complete within the bounded run, failed, or unconfirmed.
3. Candidate recorded/replayed, blocked mapping, or needs recheck.
4. Matching finance evidence imported but unverified.
5. Independently reviewed coverage for an exact store/date range.

A future merchant-facing status panel requires an authenticated store-scoped backend status source. Do not add a green Connected badge from static configuration, an installation screenshot, or an import receipt. Return no tokens or raw retained payloads to the browser.

## Test orders and acceptance

`map-sales.mjs` excludes `test=true` orders as `TEST_ORDER` before calculating financial events. Preserve the actual Shopify flag and verify this in live development data. A successful test-order extraction may correctly yield no eligible sales; this is not a broken feed. Unverified coverage remains unavailable, not an asserted zero. A verified empty period requires its own independent completeness review.

Do not make development orders appear non-test, copy Store D figures, invent historic costs, or mark history complete to get nonzero dashboard results. A clearly synthetic nonzero demonstration is separate from actual reporting and needs an explicit presentation decision if required.

Before end-to-end acceptance, verify actual Shop ID/domain/settings, both token scopes and pinned API version; compare source population and exclusion reasons independently; prove unchanged retry, changed-source invalidation and separate reviewer authority; then verify shared date/store scope across connected pages. Old-order refunds, bounds, unsupported payment/tax/edit cases and uncertain commits must fail safely. Profit remains partial/unavailable where supported cost or expense evidence is absent.

## Authority and next action

Already authorised: private development-app authentication preparation, read-only Shopify identity/scope/source checks under the setup permission, local code/tests/proposals, routine GitHub development publication and existing local preview verification. No further permission is needed just to complete those preparations.

Requires one concrete staging approval after preparation: the new store row, exact user membership/reviewer assignment, dedicated intake role/login/lock adaptation and policies, and the specifically scoped first candidate/import exercise. Present the resolved store identity, reporting period, exact privilege/data changes and tested rollback plan together. Approval for Shopify account setup is not approval for new Supabase grants. Any independent completeness attestation remains the reviewer's decision, and production remains separately approved.

## Next checkpoint: development transactions before staging writes

The read-only operator check can be delivered now, with its verified context and bounded empty-source result. It requires no database migration or browser UI deployment. No live test orders/refunds exist in the collected population yet, so test exclusion, transaction mapping and financial reconciliation have **not** been live-verified. Zero orders is not evidence of those behaviours.

Next, under the existing Shopify development setup authorisation, create a small labelled set of fictitious development products and checkout orders using Shopify's development/test payment facilities. Do not use a real payment method or real customer details. Record each source order's actual `test`, payment, tax, discount, shipping and event-time fields; where supported, exercise a refund against a development order and retain its actual source event date. A paid test checkout followed by a refund is an exclusion test, not an eligible sales demonstration. Do not backdate source events, remove the `test` flag or invent policy exceptions to force useful-looking figures.

Rerun the existing reader/collector/detail validation and mapping privately, without candidate database writes. Reconcile the small source population to the visible development orders/refunds, verify exclusion reasons, and exercise the unchanged retry. If Shopify prevents a proposed test action, record that limit and continue supported cases rather than manufacturing a financial result. Existing synthetic disposable tests remain the separate evidence for eligible sales and cross-month refund arithmetic.

Defer staging migration/intake provisioning until meaningful development source cases have been observed. Their outcomes will make the exact first candidate/import period and approval request concrete. The verified numeric Shop ID above resolves the identity prerequisite; a fresh Night Scout UUID, duplicate checks, database inventory and restricted-role tests still belong to that later setup package.
