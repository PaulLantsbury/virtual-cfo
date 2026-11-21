# Data-handling readiness — 30 October 2026

Source audit and read-only preparation only. This is a practical pre-rollout gap list, not a production-compliance claim. No deletion, migration, new grant, source collection, pooling or benchmark calculation is included.

## Retained-data inventory from reviewed source

| Boundary | Retained data/copies | Readiness implication |
| --- | --- | --- |
| Shopify source | `ingest_v1.batches.payload` holds selected shop/order/refund/line/payment facts and mapped results; heads/source versions preserve current and historical linkage. Superseded batches remain. | Order IDs are linkable. No reviewed expiry/pruning path; deleting the current head leaves historical source. Main queries omit shopper contacts/customer IDs. |
| Financial records/evidence | Normalised orders/refunds/lines, `finance_v1` source snapshots/coverage and proposed profit-evidence manifests/cost/expense snapshots | Installation/presence must be checked. Derived totals and observed snapshots need treatment alongside the original rows. |
| Independent review | `ingest_v1.review_audit.review_snapshot` includes heads with source payload, source versions, normalised mapping/evidence and coverage; reviewer statements/actor references; separate import receipts/authorisations | Source data is copied into review history. Immutable review-audit guards reject UPDATE/DELETE/TRUNCATE; ordinary store cascades do not bypass them. |
| Customer identity | `shopify_identity_v1.order_observations` contains scoped shop/order/customer IDs, source and observation timestamps; no shopper contact fields | This separate operator sidecar was applied/live-verified in September, not part of scheduled financial sync. No repeated-customer metric or retention/deletion policy follows merely from collection approval. |
| Legacy contacts | `public.customers` has email/name/identifier fields and can link to orders | Connector field minimisation does not establish all legacy contents/copies are contact-free. No contact values are printed by this inventory. |
| Xero mapping/accounting | Connections, account directories/names, versioned mappings/selections, actor/audit/preflight/retry rows; bounded calculated accounting totals, source fingerprints and safe status/reasons | Reviewed persistent evidence path excludes raw Xero reports/transaction ledgers; raw data in memory/private diagnostics is a separate boundary. Accounting evidence is append-only; detached audit references need deliberate store attribution. Proposed P&L/reconnect relations must not be assumed installed. |
| Credentials | Shopify private client configuration/host secrets plus short-lived in-memory token; Xero encrypted reader envelopes with separate master keys/version/audit/lease metadata | Encryption, token expiry or retiring a connection is not proof access was revoked at the provider or copies removed on every host. Never print token/envelope/password/key bytes. |
| Isolated writer | Separate `staging_test_programme` programmes/action ledger/writer envelopes/consent states, separate provider apps/hosts/secrets | Outside the customer app. Zero-charge test records still carry linkable provider IDs/owner context. Never clear actions to reset caps or retry an uncertain write. Expiry blocks use, not necessarily storage. |
| Account/browser | Supabase Auth users/sessions, store memberships and actor links; SDK client session, store preference and browser-local sample plans with owner-entered text/dates/status/synthetic snapshots | Shared accounts may access multiple stores. Do not equate removing one membership with deleting the Auth user. Database deletion does not clear other browsers/origins. Operator sign-in token is memory-only. |
| Outside database | Render/Replit secrets/logs, operator files/private diagnostics/downloads/exports, provider-side records, Supabase/platform backups/PITR and device/cloud copies | Source code cannot certify platform retention, log redaction, backup deletion or restore behaviour. These require independent operator/platform evidence. |

## Run the aggregate inventory

Use `inventoryDataHandling(client, {projectRef, storeId})` from `experiments/data-handling/inventory.mjs` with an **already authorised client in independently verified Night Scout Staging** and the fixed PocketLaunchpad1 context exported as `INVENTORY_TARGET`. The tool loads no environment values/credentials, opens no network connection, changes no role/grant and makes no provider request. Do not borrow or broaden a restricted writer/reader credential to obtain a fuller result.

It opens `REPEATABLE READ READ ONLY`, reads catalogue metadata, validates the configured store and runs allowlisted store-scoped `count(*)` queries. Per-relation savepoints recover from unavailable counts; all paths end in rollback. It reports relation/category, visible count, missing/unreadable/unsupported status and the number of installed delete/truncate triggers. It does not print IDs, contacts, source JSON, encrypted credential bytes, secrets, session values or exception text. Trigger presence requires review of its meaning; it does not prove a legal retention requirement or that all mutation paths are protected.

Missing relations can mean an unapplied proposal, schema drift or incomplete visibility. Zero means **zero rows visible to this role under current RLS**, not proof there is no retained data. An unknown table contributes to `unclassifiedRelationCount`, and the report always retains an incomplete-coverage warning. Schemas discovered by metadata include public, ingest, finance, customer-identity, Xero, Auth and isolated writer; target-only/otherwise unclassified relations are not silently assigned to a store. Null-linked credential audits and other detached records are not covered by a store join.

The tool has no CLI credential input or public API route. A root operator can use it in an existing secure session; aggregate reports are still internal business metadata and should not be published as if they were invented fixtures. This batch's tests use disposable invented records only.

## Concrete gaps before real merchant rollout

| Work item | Evidence needed | Current limit |
| --- | --- | --- |
| Purpose and periods | Owner decisions per source/evidence/identity/account/audit class, required exceptions and erasure authority | No durations chosen. Token/consent expiry is not a storage-retention policy. |
| Stop new intake | All relevant collectors/writer schedules/queues/hosts stopped for the requested scope; uncertain writes reconciled safely | A UI disconnect label/expired programme is insufficient. Do not delete writer actions to permit retries. |
| Revoke credentials | Provider revocation/uninstall evidence; reader/writer envelope disposition and hosting secret/private config/cache checks | Row count or `retired_at` does not prove remote access ended. Preserve reader/writer separation. |
| Source/copy graph | Authorised complete inventory plus FK/trigger review across source, normalised records, identity, mappings, snapshots, reviews/imports and derived totals | Ordinary `ON DELETE CASCADE` does not cover non-cascade references/immutable guards. No erasure executor exists here. |
| Shared/detached scope | Null-connected audit rows, target-only writer bindings, actor IDs, Auth users/sessions with multiple memberships | Per-store joins cannot establish scope for detached rows. Never delete a shared account simply to remove one store. |
| Erasure audit | Separately reviewed implementation and minimal receipt without retaining deleted source payload/unnecessary linkable IDs | Current audit/evidence guards reject deletes. Do not operationally disable guards or fake success. |
| Browser/exports | Scope-specific plans/session/cache handling and local/downloaded/operator files across origins/devices | Clearing one database row/current browser sample key does not erase other copies. |
| Backup/restore | Actual platform backup/PITR retention/access, host log/query redaction, exports and tested reapplication of authorised deletion after restoring older data | No platform settings or backup deletion/expiry/restore test was verified. |
| Assurance | Merchant-facing explanation, authorised request handling and independent end-to-end verification | Source audit/aggregate counts do not certify whole-system compliance or production readiness. |

## Safe order for later approved execution

Prepare exact request scope/authority; inventory data and coverage gaps; stop/revoke new processing and reconcile in-flight uncertainty; review dependency/copy graph and policy exceptions; then prepare a concrete separately approved erasure implementation. Verify postconditions across application, provider, hosts and browser/export boundaries, and record what backups or required retained records remain. Restore handling must prevent older backups from quietly resurrecting erased records.

Do not infer approval for execution from today's read-only preparation or pick a blanket retention number just to make status green. The source includes an in-memory Xero disconnect/revoke prototype; this is not proof of a deployed complete durable customer disconnect-and-erasure journey.

## Validation

`node --test experiments/data-handling/inventory.test.mjs`

Six disposable tests cover store scoping/aggregate privacy, missing versus empty tables, unreadable/changed shapes, savepoint failure recovery/private errors, wrong-target rejection and RLS hiding real rows behind an apparently empty count. No live database/provider/backup/browser deletion or production validation is claimed.

## Proposed isolated Demo dataset

The new source-only Demo reader package adds a proposed private `xero_demo_v1` copy of bounded accounting/mapping/encrypted credential history and a separately identified synthetic logical store/member link. It is not applied by this audit. If approved later, include those new copies/roles/host secrets and provider consent in retention/deletion inventory; existing source inventory reports incomplete coverage for unclassified relations. Demo credentials remain sensitive even when the financial sample data is fictional. No expiry claim here proves data or backups erased, and no cross-client benchmark reuse is introduced.
