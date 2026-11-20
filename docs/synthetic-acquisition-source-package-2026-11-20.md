# Synthetic acquisition source — prepared package, 20 November 2026

Prepared and tested offline. No sidecar records, database schema/grants, provider actions, feed changes or website deployment have been applied by this package.

## Scope and policy

The isolated Fictional UK Gifts v2 company gains a separate `synthetic-identity-and-spend-v1` source proposal. Its fixed synthetic identity inception is **1 January 2024**; financial reporting retains its existing separate history anchor. Identity records are generated for the complete inception-to-through ledger before selecting a reporting month. They link existing mapped order UUIDs, original order references, journal sale IDs and canonical sale hashes. They do not rewrite order objects, journal events, revenue, costs, refunds, monthly evidence or the existing daily feed.

This is an explicit new **synthetic-only analytics policy**, not approval of general merchant repeat-customer/cohort definitions. Legacy generator customer/channel hints alone were insufficient to establish first-ever customers from the November reporting anchor. The new identity sidecar is its own disclosed synthetic source; it does not claim that a contact-free identifier overlay was observed at Shopify or Xero.

Identity assignments are deterministic and append-stable. Orders are sorted by business date and original reference. Hash moduli select explicit unknown (29) and guest (23) cases; these observations keep all customer/first-order identifiers null. Other orders either create a customer identifier derived from their first-order reference or select an already observed synthetic customer. A hashed behavioural draw below 42 of 100 selects a repeat when an earlier identity exists. This is a generation rule, not a fixed reported repeat-share assumption. No 39%/43% customer count or 80% advertising split is used. No names, email addresses, addresses or phone numbers enter this sidecar.

The first-time/repeat distinction applies to identified **orders** in this defined synthetic lifetime. It does not classify guest/unknown orders. An identified first customer is eligible for **paid first-customer CAC** only when its first source order channel is Meta or Google. Organic/email first customers are excluded from that denominator; repeat orders reached through paid channels do not become first customers again.

## Advertising allocation and calculations

Each actual synthetic journal marketing expense retains its exact source ID/hash, date, channel and integer-pence amount. Same-day/channel order values provide three disclosed allocation weights:

1. Identified paid first orders.
2. Identified non-acquisition orders, including known email activity.
3. Guest/unknown orders; with no matching order weight, the complete amount remains unallocated.

The generator’s exact penny allocator partitions the source advertising into acquisition, other/retention and unallocated amounts. Acquisition pennies are further allocated to the eligible first orders, retaining source customer/order links. All partitions reconcile exactly; the period sum must also equal the reviewed financial month’s advertising. This is modelled synthetic allocation, not platform attribution, incrementality, measured retention uplift or a general marketing policy.

The reviewed payload stores integer inputs and null unsupported metrics. The browser calculates paid first-customer CAC = acquisition pence / matched paid first customers, rounded only for display. Zero customers yields unavailable; it never yields infinity or a substituted fixture. There is no separately persisted ratio cell.

**First-order contribution and mature 90-day contribution/payback remain unavailable.** Existing sale and historic COGS facts alone do not establish matched variable-cost allocations, complete cohort contribution or a measured response curve. The package does not reuse £26, 55 days or other design fixtures as observed results.

## Source and reporting contract

`experiments/synthetic-company/acquisition-source.mjs` exports:

- `buildAcquisitionSource(fixture)`: requires the immutable v2 ledger from the fixed inception, verifies the fixture fingerprint against regeneration, then returns source observations, ledger-source allocations, their hashes and one source hash.
- `summarizeAcquisitionSource(source,{from,to,financial})`: selects a fully covered reporting month, checks source hashes and exact raw reviewed-financial scope, reconciles original order count and advertising, and returns the `synthetic-acquisition-v1` payload.

The summary binds business, currency, timezone, exact period, financial snapshot/version, edition, original anchor, sales/cost revisions and formula version. Root integration wraps it in the independently checked `reviewed-supplement-v1` envelope. The large raw identity/allocation proof set is separate from the small monthly summary; no raw customer IDs need to be returned to browsers.

`lib/marketing/acquisition-evidence.ts` provides a boolean `validateAcquisitionPayload(payload,rawFinancial)`, `acquisitionView` (validated payload plus derived `cac`), and `acquisitionFinancialContext(reviewedMonth)`. Validation requires the exact reserved synthetic company and matching financial version/revisions/period, safe integer counts/spend, count and spend reconciliation, fixed inception, hashes and the fixed policy. Persisted non-null CAC, first-order contribution or payback is refused.

`AcquisitionEvidence` accepts `{payload,financial,loading,error}`. The New Marketing default uses the shared supplement hook, exposes paid first-customer CAC with explicit synthetic-allocation wording, and provides identity coverage and exact spend reconciliation under Explore the Numbers. Unsupported cost/cohort/response figures remain yellow. Missing/failed/stale evidence does not borrow sample customer facts. Changing company/month/version naturally changes the financial-bound query and clears the valid view until the new proof succeeds.

## Verification and remaining release work

Eight acquisition tests pass: deterministic extension without changing earlier observations/allocations; exact mapped order links and no contact fields; exact source and period penny reconciliation; guest/unknown/repeat coverage; complete integer-only reviewed-envelope digest; rejected tampering/wrong inception/scope/count/spend/version/revision/fabricated metrics; zero-denominator handling. Frontend TypeScript passes.

The coordinator still needs integrated source-manifest review, disposable database/reader acceptance, hosted membership and version-bound read verification, and an exact reviewed application/install package before any live application. No prepared capability is described here as installed or live. The later v16 addition and complete cell-by-cell connection register are recorded in [New Marketing v16 connection register](new-marketing-v16-connection-register-2026-11-20.md), including signed original-order-linked revenue partitions and the optional reviewed simulated session-event source. Those additions do not activate a provider or daily feed. General merchant identity lifecycle/retention and metric definitions remain a separate workstream.
