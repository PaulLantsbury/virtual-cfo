# Customer source contract batch — 21 November 2026

Status: offline source/contract preparation. This document does not authorise or apply a migration, data publication, access grant, reader activation, website deployment, scheduler change or provider request. The operational roadmap remains coordinator-owned. Existing hosted financial evidence, the 48 immutable supplements and unrelated companies must remain unchanged.

## Compatibility finding

The inspected repository schema, not an owner-verified live catalog receipt, defines `finance_review_supplement_v1.snapshots` with kinds `cash`/`acquisition` and uniqueness on `(store_id,date_from,date_to,kind,financial_version)`. Its immutable trigger refuses updates/deletes/truncation except owner-only one-way invalidation. The publisher matches both snapshot ID and that natural key, and permits exact replay only. Adding `customerActivity` changes body bytes/hash; a second acquisition row under the same financial version conflicts even with a fresh snapshot ID. Invalidating the old row would change a protected record and is outside this batch.

Therefore the existing acquisition publisher cannot install a historical enrichment while preserving all 48 original rows. A new version/sidecar contract must have separate immutable storage and explicit selection semantics, or a separately reviewed schema change. A pure JavaScript candidate or selector supplies neither. This is a repository-contract finding, not a claim that private hosted tables are missing. Inspect live constraints/triggers/roles using already authorised owner access before compiling an executable application package; do not broaden audit privileges to inspect them.

The existing browser validator accepts absent optional `customerActivity` and withholds its figures. That backward compatibility must survive reader changes. New source code cannot make absent fields appear in already sealed hosted JSON. Existing Cash supplements, acquisition economics and source financial revisions must retain their original fingerprints.

## Population rules

- The only target is the reserved fictional UK Gifts company, GBP and Europe/London, under its existing deterministic identity inception and versioned synthetic policies. No real customer names, contacts, raw identity lists, provider accounts or Store D records enter a public manifest or browser response.
- An identified first order belongs to a customer whose retained first-order witness matches that order. A paid first customer is only the paid-attributed subset; organic/email first orders are not paid acquisitions. Guests and unknown identities remain separate, never assigned fabricated customers.
- A repeat order has an identified customer and a retained earlier first-order witness. A customer can first order and repeat within the selected month. Thus first-customer and returning-customer populations overlap. The distinct identified population is their union, not the sum; original order populations remain disjoint.
- Distinct customers are recalculated from identities for each exact requested window. Monthly distinct counts cannot be added to infer a multi-month unique population. Frequency is identified orders / distinct identified customers, with a missing/zero denominator unavailable. No stored ratio is needed.
- Refunds retain original-order classification but affect money in the refund event period. An old repeat order refunded this month is financial activity without a new current-month order/customer. Net revenue, contribution and cost recovery can be negative. Do not increment current order counts for refunds or classify a guest refund as a known customer.
- `all orders − paid first orders` is an **other-order** pool, including organic first, repeat, guest and unknown orders. It cannot be used as a repeat-eligible population or repeat uplift baseline. Retain the reviewed Plan repeat gate until matched repeat order revenue/costs and explicit model semantics are accepted.
- First/second purchase timing and retention probabilities need retained original timestamps, observation/censoring windows and an eligible denominator. Activity counts and a fixed mature paid cohort do not establish these measures.

## Separate contract responsibilities

The customer-summary version proposal must bind the exact original acquisition envelope/hash, financial month/version/sales and cost revisions, customer/source policy and source hash. It must select one explicit accepted customer edition without changing financial-version selection. Missing, invalidated, superseded, mismatched or ambiguous candidates remain unavailable. An unselected candidate must never become current because it has the newest timestamp, largest version number or strongest coverage. Legacy summaries remain readable without customer enrichment.

The repeat-order economics proposal must partition paid first, other identified first, identified repeat, guest and unknown orders without inventing identities. Include integer-pence original sales, linked refund reversals, net shipping, historical COGS/return recovery, allocated variable cost and separately matched repeat marketing. Every component must reconcile to independently accepted company totals, not a balancing plug. Allocations are declared synthetic policies, not measured provider attribution. Missing cost inputs must withhold economics, not become zero. Preserve negative event-period totals and complete lineage dependencies.

A repeat unit margin does not by itself establish future repeat volume, incrementality or cash affordability. If Plan later uses it, freeze a versioned population/model policy in saved drafts; never reinterpret existing reviewed or fictional drafts under new repeat semantics.

## Required activation manifest

Before any live approval, prepare one immutable candidate with:

| Manifest section | Required binding |
| --- | --- |
| Source | Exact tested commit and compiler/contract versions; deterministic package digest and byte/count bounds. |
| Target | Privately verified staging connection/operator; reserved synthetic company; GBP/London; explicit completed month list. |
| Protected inventory | Exact original 48 row keys/IDs/body hashes and financial/unrelated-company fingerprints, captured with authorised access. Keep private operator details outside public GitHub. |
| Dependencies | Each financial version/sales/cost revision; existing acquisition snapshot/envelope hash; source identity/refund/allocation/cost hashes; observation horizon and policy. |
| Candidate | New sidecar/version IDs and hashes; predecessor and explicit selection action; deterministic collision, ambiguity and changed-replay refusal. |
| Storage/read contract | Verified live schema/trigger/RLS/grant digest; exact new objects/necessary grants if any; trusted member-bound transaction and reader version. |
| Transaction | Bounded atomic application, exact replay, unknown-outcome receipt/readback before retry, no rewriting prior rows. |
| Recovery | Rollback on failed pre/postflight before commit; after commit use separately reviewed selection/read-disable action that preserves immutable records. No generic DELETE or mutation of original 48. |
| Acceptance | Disposable SQL/reader/member-denial tests, independent arithmetic oracle, hosted exact-scope reads, unchanged protected fingerprints and browser/saved-draft checks. |

A self-consistent digest proves equality, not completeness or authority. Supplied booleans such as `reviewed` or `complete` are assertions requiring independent operator evidence. Do not issue executable approval from this document or an offline receipt alone.

## Minimum tests and remaining gates

Exercise same-month first+repeat overlap, several repeats by one customer, paid/organic first separation, guest/unknown, zero customers, duplicate/conflicting witnesses, historical refunds, cost recovery, negative contribution, absent costs, wrong period/company/version/hash and changed original evidence. Version selection must refuse ambiguity and cross-scope predecessors, preserve original rows byte-for-byte and leave legacy missing aggregates unavailable. Rehearse replay, failure rollback, denial for non-members, effective restricted roles and concurrent selection/read consistency before hosted activation.

On 21 November, November remains open. No complete November summary, daily receipt, future cohort maturity or continuation through March is established by these contracts. Future closed-month refresh and retrospective customer enrichment are distinct reviewed workflows. Website-only deployment remains distinct from data/read-contract activation.

Source references: `supplemental-schema.sql`, `supplemental-publication.mjs`, `supplemental-reader.mjs`, `summary-refresh-proposal.mjs`, `acquisition-source.mjs`, browser `marketing/acquisition-evidence.ts`, and `docs/yellow-source-activation-proposal-2026-11-21.md`. New contract implementation/test receipts will be recorded after independent review; no new runtime or hosted result is claimed here.

## Delivered offline contracts and independent review

`customer-summary-version.mjs` exports `prepareCustomerSummaryVersions`. It inspects exactly 48 protected envelopes, validates their hashes and the explicit customer candidate's financial/source/population bindings, and returns frozen content-addressed **sidecar proposals**. Identical candidate readback is unchanged; a changed candidate or ambiguous existing sidecar set is refused. The existing acquisition payload is not enriched in place. This is neither a stored version chain nor a trusted selected-version reader: no sidecar SQL, automatic selection, remote writer or installed endpoint is supplied.

`repeat-order-economics.mjs` exports `partitionRepeatOrderEconomics`. It checks the reserved company, one complete month, supplied reviewed financial version/revisions and independently pinned source/array hashes. Each identified customer must retain one consistent first-order witness. It partitions paid-first, non-paid-first, identified-repeat, guest and unknown original orders and event-period money, including later refunds; the provided five component totals must reconcile. The output retains explicit `forecastEligibility: unavailable`. Financial bindings remain caller-supplied reviewed assertions; no database authentication or completeness attestation is implied.

Independent review identified and the implementation corrected two draft risks: conflicting first-order witnesses for the same customer, and missing reserved-company/financial-version bindings in the partition result. The bounded tests now refuse conflicting witnesses. Existing non-acquisition marketing allocation is only partitioned; it is not a newly measured causal retention budget.

Validation performed in this batch:

- Existing disposable PostgreSQL/PGlite supplemental schema/publication tests: **14/14 passed**. These exercise immutable rows, natural-key conflicts, exact replay, atomic failure rollback, current financial authority and member-bound restricted reads.
- Coordinator integration receipt: **22/22 combined new contract tests passed**, including a generated canonical synthetic-source partition rehearsal. This is local source integration, not a hosted reader or runtime receipt.
- New `customer-contracts-independent.test.mjs`: **4/4 passed**. Twenty-four labelled fictional acquisition envelopes and 24 Cash placeholders preserve all 48 input bytes/hashes and existing browser acquisition-view results. The test separately checks exact replay/conflict refusal, historical financial correction not relinking the old edition, and conflicting first-order identity rejection. Cash placeholders are protected fixtures, not cash arithmetic acceptance.
- The independent fixtures reuse the explicitly disposable browser test builder; they contain no hosted captured customer/provider data. These tests prove local compatibility and refusal behaviour, not actual hosted row fingerprints, operator authority, effective live roles, installed selection, uncertain-commit recovery or browser activation.

Remaining engineering: design and rehearse separate sidecar storage plus immutable explicit selections; implement a trusted same-transaction reader that checks current canonical financial authority and the original acquisition envelope; define post-commit read-disable/recovery; pin the exact operator-bound candidate and schema fingerprints; then obtain the enumerated bounded approval and hosted acceptance. Missing old-month aggregates, multi-month unique unions and second-purchase timing remain unavailable. The repeat lever remains gated. No live activation is ready merely because these offline contracts pass.

Full root workspace typecheck and all configured production builds passed after the contract additions. Existing non-fatal sourcemap/chunk-size warnings remain. No existing application, database schema or deployed reader file was changed in this batch. The prior website release candidate remains pinned independently; these experimental contracts are not imported by it.
