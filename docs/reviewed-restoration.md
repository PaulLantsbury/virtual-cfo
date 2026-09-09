# Reviewed period restoration — local proposal

The internal `restoreReviewedPeriod` helper and additive `ingest_v1_review_restoration.sql` proposal implement restoration of existing reconciled finance coverage. Neither is connected to a live endpoint, applied to Supabase or enabled in the app.

## Required inputs and authority

A trusted server authentication dependency supplies the reviewer identity; it must not come from the request body. The database independently requires both membership of the exact store and an explicit private review_authorizations entry. No entries are provisioned automatically and ordinary members cannot grant themselves permission. Live authentication and reviewer provisioning remain integration work.

The request binds an exact store/date range, candidate batch and snapshot digest. It requires the reviewer to confirm completeness and provide a retained evidence reference and completeness statement. The helper validates presence, not the truth of that human assessment: full history, exclusions and collection limitations must be independently reviewed. Successful collection or reconciliation alone is insufficient.

## Transaction and retained evidence

The operation locks all relevant tables against concurrent writes, rereads the review snapshot and rejects changed batches, source versions, settings, raw/evidence records or failed reconciliation. The snapshot now includes full order/refund evidence metadata as well as financial mappings.

It appends the reviewer ID, evidence reference, statement, original snapshot and digest to a private audit record. It then restores only the exact existing coverage range, links coverage to that audit record and clears only that range's candidate recheck flag. It creates no raw records or finance evidence and never changes candidate coverage_certified to true. Failures roll back audit and coverage together. Reusing the original approval after restoration is rejected because the snapshot has changed.

Audit update, delete and truncate operations are rejected by a trigger; ordinary clients cannot read or write audit records. This is an application-level append-only record, not protection against a database administrator disabling controls. Retained snapshots may contain private financial source material and must stay in the private database.

The migration also invalidates coverage when order/refund evidence changes, using the existing store-scoped invalidation helper. Existing raw/source/settings invalidation remains active. Browser figures disappear on the next read, not necessarily immediately in an already open page.

## Tests and release limits

48 Shopify tests pass, including five real disposable PostgreSQL restoration groups: successful scoped restoration through the existing verified-sales RPC, retained audit, rejected replay, denied reviewer/missing attestation, changed evidence/metadata, failed reconciliation and rollback after a late failure. Other stores remain readable; other periods remain incomplete; candidate certification stays false.

The prototype uses SHARE ROW EXCLUSIVE table locks and bounded lock/statement timeouts. Reads remain possible, but writes across stores pause during restoration. Deadlock or timeout must abort and surface for a fresh review; do not silently retry an approval. PGlite tests do not prove multi-session concurrency or production throughput. A separate PostgreSQL multi-session contention test is required before staging application, along with a least-privilege service role and authenticated review UI/endpoint. The global lock strategy needs review before scaling.

No live Shopify/Supabase call, remote migration, Replit sync or production deployment occurred.
