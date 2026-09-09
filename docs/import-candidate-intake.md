# Import candidate recording — local proposal, 9 September 2026

## Implemented and tested locally

`recordShopifyCandidate` recomputes the supported Shopify mapping from a detailed extraction and records source content, settings, reporting scope, mapping outcome and candidate events together. It does not accept a caller's claimed verified result. A canonical content fingerprint includes API version, settings, order/detail content and reporting scope; capture timestamps and previous caller-supplied fingerprints do not determine identity.

The proposed `ingest_v1` schema contains candidate batches and a current-batch pointer for each store/reporting range. These tables are private, have RLS enabled, and explicitly revoke anonymous/authenticated/default public access. No application endpoint, importer credential or service grant is introduced. An internal privileged caller is required; the future server must authenticate/authorise the requested store before invoking this helper.

The existing store row is locked during intake. Its Shopify identity/domain, currency and timezone must match the extraction. A unique key protects store/range/fingerprint identity. An identical current batch returns `replay`; a previously superseded batch returns `historical_replay` and cannot move the current pointer backwards. Changed content creates a new review candidate, including when mapping now blocks. Previous content is retained with a superseded timestamp. Batch insertion, supersession and pointer change are one transaction.

All rows are constrained to `coverage_certified = false`. Candidate storage cannot certify period coverage, update orders/refunds or write financial evidence. The proposal is not in the automatic migration runner and has not been applied to Supabase.

## Validation

`pnpm test:shopify` now passes 25 tests: the existing 19 reader/mapping tests plus six candidate-recording groups. Tests use disposable PGlite PostgreSQL with synthetic stores and source data. They cover replay without duplication, changed/blocked mappings, historical replay protection, identity/settings mismatch, complete rollback after a late write failure, private access despite permissive default grants, refusal to certify coverage, and the same batch identity after a disk-backed database is closed and reopened.

No real customer data, live database calls or application changes. The rollback and restart checks are local database tests, not remote gateway or multi-connection concurrency tests. The row-lock/uniqueness strategy still needs production concurrency/load validation before deployment.

## Remaining boundaries

- This stores review candidates, not authoritative financial events. It does not expose them to the briefing.
- Supersession is scoped to the exact reporting range. It does not invalidate every overlapping period or an existing finance coverage record. Cross-period/source-update invalidation must precede verified publication.
- Exact historical replay is recognised. Arbitrary previously unseen stale snapshots are not chronologically ordered or reconciled; a trusted source version/change stream is still needed.
- Full candidate content is retained in the database proposal. Production retention, access auditing and data minimisation must be settled before real source records are stored.
- Full-history completeness, deletion/update handling, transactional collection, tax-inclusive/split-payment mapping and independent reconciliation remain outstanding.
- The current staging stores are synthetic. No changes were made to their source identity/settings or existing financial evidence.

Next: define and test source-version and affected-period invalidation, then a reviewed path from candidate to verified evidence. Only after that should we prepare a concrete staging application package. Replit sync and production remain deferred.
