# Yellow-source activation preparation — 21 November 2026

**Preparation only; not an executable approval package.** Scope is optional customer-activity supplements and repeat-eligible Plan economics. No database write, grant, schema operation, feed change, provider request or website deployment is performed or proposed for immediate execution. Existing source publication and website review are separate from data activation.

## What exists and what is missing

`experiments/synthetic-company/acquisition-source.mjs` already generates optional `customerActivity` with contract `synthetic-customer-activity-v1`, policy, exact monthly scope, `identifiedCustomers`, `uniqueReturningCustomers`, `identifiedOrders`, source orders hash and explanatory basis. Browser validation in `lib/marketing/acquisition-evidence.ts` checks cardinalities, first/repeat population overlap and hash/scope. Purchase frequency is derived as identified orders / distinct identified customers; no stored ratio column is needed. Legacy payloads without the optional object remain accepted and withhold the new measures.

Existing 48 immutable cash/acquisition summaries cover November 2024–October 2026. The optional activity object is prepared source, not proof that those published payloads contain it. The current audit account sees public cash_balance_snapshots metadata but not the private supplement catalog. Physical private schema/column absence is unproven; owner-authorised inspection must establish storage/version capabilities before proposing SQL. Do not expand privileges merely to make the audit easier.

`summary-refresh-proposal.mjs` determines eligibility only; it does not compile or publish. Existing publisher rules permit new keys or byte-equivalent replay, not silent alteration of historical payloads. Adding customerActivity changes payload bytes/hashes. Historical backfill therefore requires a separately reviewed version/correction contract. A future closed-month publication can include the optional object if its exact source contract and reader are accepted; it cannot retrospectively populate earlier months by assumption.

Current economics contract contains paid-first-order economics and a separately scoped mature cohort, with financial-version dependencies and source hashes. Neither establishes selected-month repeat-order economics. Paid first customers are a subset of first orders; the residual includes organic-first, guest and unknown orders. The reviewed Plan repeat lever remains disabled.

## Candidate A — optional customer activity

1. Inspect existing private summary constraints, envelopes, selected-version references, correction/invalidation behaviour and reader selection with existing authorised owner access. Capture a redacted schema fingerprint and exact protected row inventory outside public documents where necessary. Determine whether a new version/sidecar is possible without a migration. Do not assert that a migration is needed in advance.
2. Prepare an offline compiler for a bounded explicitly listed month set and exact financial versions. Regenerate from the immutable inception anchor; retain original identity/order proof privately. Public/browser projection contains counts and hashes only, no names, contacts or raw customer IDs.
3. Choose and document one historical publication mechanism: a separately versioned activity sidecar bound to the exact acquisition/financial payload, or a reviewed superseding acquisition-summary version with preserved prior immutable rows. Specify deterministic selected-version resolution, rollback/read-disable behaviour and failure on ambiguous active versions. No in-place overwrite.
4. Produce candidate manifest: company scope, GBP/London, exact periods, financial version/sales/cost revisions, original acquisition envelope hash, new customerActivity hash, compiler/formula version, inventory and package digest. Bind preview and readback to the same immutable candidate.
5. Rehearse publication and reads in disposable Postgres against inspected constraints. Verify idempotent byte-equivalent replay, changed replay refusal, unchanged old 48 rows/financial fingerprints, member/non-member isolation and legacy payload compatibility.
6. Only then present an exact staged data/read-contract package for owner approval. A website-only revision review does not authorise this publication. Keep existing grants unless a separately enumerated new grant is demonstrably required.

Acceptance fixtures: one customer with multiple repeat orders; a newly acquired customer repeating in the same month; organic/email first customers; guest/unknown orders; zero identified customers; invalid union/overlap counts; duplicate identities; source correction; mismatched scope/hash; missing activity; company/version switch and denied non-member read. Month aggregates cannot be summed into multi-month distinct-customer unions. Such windows need their own privacy-safe union proof/aggregate.

## Candidate B — repeat-eligible economics

Prepare a new accepted input contract before adding fields to live storage. Suggested logical inputs (names provisional, not asserted database columns):

| Input family | Required definition/proof |
| --- | --- |
| Population | Eligible repeat orders and distinct repeat customers with a prior first order in the defined synthetic lifetime; distinguish first orders, paid-first subset, organic/email-first, guests and unknowns. Explicit overlap policy for customers first ordering and repeating in one month. |
| Scope | Company, complete month, GBP/London, observation cutoff, canonical financial version and exact acquisition source/version. |
| Monetary inputs | Repeat original product sales after discounts, linked event-period refunds, net shipping, historical product costs/returns, allocated fulfilment/payment/other variable costs and separately allocated repeat marketing. Integer pence; reconcile all classified plus unclassified partitions to canonical totals. |
| Cost lineage | Order-linked allocation proof, complete source cost hashes, partition rules, treatment of negative refunds/returns and late reversals; no reuse of paid-first unit economics for repeats. |
| Model semantics | Historical repeat revenue/contribution per eligible order, permitted scenario levers and which cost components scale. Do not treat selected-month repeat behaviour as a future retention probability or cohort lifetime value. |
| Dependencies | Financial and acquisition version hashes, cost/allocation hashes, predecessor/identity anchor and invalidation rules. Unsupported dependency changes withhold the lever. |

Tests must establish first/repeat/unclassified partition completeness, mixed-margin orders, same-month first+repeat, guests/unknowns, refund reversals, zero/negative contribution, absent costs, incorrect allocation, duplicate proofs, cross-company/month/version rejection and immutability of prior financial/summary records. Browser and saved-draft tests must retain population policy, baseline version and assumptions; old reviewed drafts cannot silently reactivate a repeat lever under new semantics.

Until accepted, Plan may use the supported paid-first lever and explicitly labelled other-order baseline. It must not forecast repeat uplift from the residual. Second-purchase timing or retention probabilities additionally require an observation/censoring policy and eligible timestamps, not merely the customerActivity counts.

## Owner actions and preparation gaps

**No owner decision is needed to continue offline engineering.** The next team work is to inspect permitted storage/version contracts, implement the candidate compiler/version reader and repeat economics validator, run disposable rehearsal, then assemble an exact manifest and reversible release plan. No exact SQL/data package, candidate digest, historical replacement selection, postflight or executable rollback has yet been prepared here; approval now would be premature.

When concrete preparation is complete, ask the owner for one bounded decision covering the exact isolated-company months and immutable candidate, any explicitly necessary schema/read-access changes, publication once, member/denied-read verification and scoped rollback/read-disable. Enumerate each action. Website deployment must identify its own tested immutable revision and can be reviewed separately. Neither package includes provider retries, production release, scheduler activation, future continuation or spending.

Before any new closed-month supplement, independently verify genuine scheduled financial receipts and exact monthly evidence. November 2026 remains open on 21 November; it cannot yet be a completed November summary. The 90-day future continuation through March 2027 remains a separate offline proposal. Do not invent daily/closed-month acceptance from an enabled schedule.

## Source references and validation limits

Read `synthetic-continuation-and-refresh-proposal-2026-11-20.md`, `synthetic-acquisition-costs-proposal-2026-11-20.md`, `new-marketing-v16-connection-register-2026-11-20.md` and `yellow-connection-register-2026-11-21.md` with the latest hosted checkpoint overriding older prepared-only release wording. This document is a source/contract review; no new automated, browser, database-rehearsal or hosted acceptance result is claimed. No operational roadmap file is changed by this proposal.
