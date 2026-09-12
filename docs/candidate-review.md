# Candidate reconciliation review — local only

`experiments/shopify/review-candidate.mjs` prepares a read-only review packet from one repeatable-read database snapshot. It binds the exact candidate head, store settings, source-version records, mapped order/refund snapshots, source identities and period coverage record to a SHA-256 digest. It recomputes the candidate mapping rather than trusting stored calculated results.

The check compares individual source identities, original order links, event dates, currency, eligibility, product sales, discounts, shipping, original product/shipping VAT, original customer payment and refund cash/tax components across all supplied history. Equal period totals are insufficient: replacing one order with another or offsetting gross sales and discounts is reported as a mismatch. Missing, duplicate, unsupported or stale identities/evidence block review. Numeric Shopify IDs and their corresponding typed GraphQL IDs are treated as equivalent. No identities are guessed from amounts or dates.

Current scope is deliberately conservative. Excluded source orders that still exist as finance records are reported as unexpected events; handling those requires an explicit exclusion-evidence design. For supported tax-exclusive source orders, the event model now carries actual product VAT after discounts, shipping VAT and the reconciled original customer payment. The review compares those against normalised finance evidence. It does not infer pre-discount VAT or discount VAT separately: only their net product VAT is established from the source. Tax-inclusive source imports remain blocked. This is transaction reconciliation, not independent completeness certification.

A matching packet says `awaiting_independent_coverage_review`, never verified. It exposes no financial figures, restores no coverage, clears no recheck flags and writes no reviewer approval. A digest is a snapshot identifier, not a security token. The future publication transaction must reread and compare it, authenticate the reviewer, independently establish completeness and record an audit entry while coordinating with source/evidence writes. A subsequent local-only write proposal now implements these transaction steps; see reviewed-restoration.md for its authorisation, evidence and concurrency limits.

Verification includes component/identity mismatches, duplicate and stale evidence, refund links/tax, changed source versions and store settings, deterministic/changing digests, and a real disposable PostgreSQL snapshot using the committed staging schema. The real-database test confirms mismatched evidence remains unavailable while another store stays readable. No live schema, Supabase data, Replit or production changes.

## Required restoration gates

- An authenticated internal reviewer must be authorised for the exact store. Client-supplied reviewer names are not sufficient authentication.
- The current packet must pass all reconciliation checks and match the reviewed snapshot digest, batch, store and date range. Recompute with the current mapper; older saved candidate events may lack VAT fields.
- The reviewer must supply retained evidence establishing complete order and refund history for the range, including exclusions and collection limitations. A successful API collection alone is insufficient.
- In one transaction, coordinate with source, raw-data and evidence writers; reread the snapshot, reject changes, append the reviewer identity/evidence reference/digest audit record, restore only the exact coverage range and clear only that range's recheck flag. A failure must roll everything back.
- Subsequent changes must invalidate restored coverage. Test concurrent writes, stale/repeated approvals, denied members, rollback and other-store isolation before staging application.

The subsequent reviewed-restoration.md proposal adds a private audit table and internal coverage write. There is still no live endpoint. Existing verified evidence is required; the candidate review does not create or repair it.
