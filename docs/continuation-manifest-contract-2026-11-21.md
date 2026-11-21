# Offline continuation and closed-month manifest — 21 November 2026

Prepared source contract only. No website, database, provider, financial feed, scheduler, access or summary publication changed. This package is separate from the coordinated Scout/navigation website release.

## Concrete preparation

New `experiments/synthetic-company/continuation-manifest.mjs` exports `prepareContinuationManifest` and `continuationInventoryHash`. It consumes the existing deterministic continuation proposal plus sanitized independently reviewed inventory and receipt headers. It generates no live receipt and executes no compiler, SQL, replay, retry or provider operation. The output always states `activationAllowed:false`, `remoteApplied:false` and `observedReceiptsByThisModule:false`.

The source boundary is fixed: isolated UK Gifts v2 company, GBP/Europe/London, **20 December 2026–19 March 2027 inclusive: 90 days and 10,947 candidate ledger events**. Candidate daily/event hashes and the protected generated prefix through 19 November 2026 are pinned to the fingerprints recorded in [the existing continuation proposal](synthetic-continuation-and-refresh-proposal-2026-11-20.md). A canonical generator compatibility test computes the actual proposal and passes those exact fingerprints. No broader continuation or changed profile is accepted.

The 19 November prefix fingerprint is a generator comparison anchor, not a claim about current hosted publication completeness. The existing finite programme already covers 20 November–19 December; this module does not recreate or catch up that interval.

## Protected summary inventory

Exactly 48 original cash/acquisition rows must be supplied: one of each kind for November 2024–October 2026, with reserved company scope, exact financial version and body SHA256. Keys cannot be duplicated, replaced with later months or omitted. `continuationInventoryHash` defines a sorted, sanitized inventory representation; the preparation call requires an independently supplied matching readback hash. Computing a hash of invented inventory is not independently verified hosted evidence.

The manifest preserves the inventory hash and forbids update, invalidation and recreation. It does not generate a publisher or treat an eligibility decision as permission to overwrite an immutable body. A new optional customer payload version still requires its separately reviewed additive publication path.

## Closed-month refresh boundary

Refresh candidates form one contiguous prefix beginning November 2026. At most November, December, January and February may appear. Every selected month must be closed before the explicitly supplied observed London date and end no later than the finite continuation ceiling. March remains excluded even after March closes because this continuation only supplies activity through 19 March.

Each candidate requires reserved company/currency/timezone scope, exact first/last month dates, verified complete coverage, financial version UUID, sales/cost revisions and compiled cash/acquisition source hashes. Every calendar day requires a distinct verified coverage-proof UUID, event date, company scope, exact monthly financial-version binding, proof SHA256 and source SHA256. Provenance remains explicit: November 1–4 uses sealed-prefix evidence with a seal hash; November 5–19 uses approved historical-publication evidence with approval, publication ID and hash; November 20 onward requires genuine scheduled evidence with run ID and receipt hash. Historical publication is never relabelled as scheduled acceptance. Dates must appear exactly once in order; missing, unknown, arbitrary manual execution modes, provenance substitutions, repeated IDs, skipped predecessors and partial months fail closed. Zero refresh candidates are valid when receipts are not yet available; nothing is inferred from an enabled cron or prepared future fixture.

These checks validate the shape and consistency of **supplied** readback assertions. They do not authenticate a remote receipt, prove a run occurred, verify cash/acquisition compiler payload contents from hashes alone or establish source authorization. That requires the existing restricted reader, independent financial reconciliation and a later exact operational package.

## Verification and remaining gates

Seven focused tests pass, including actual canonical generator compatibility; four closed-month candidates; open/skipped/unknown/manual receipt rejection; original-48 preservation and changed scope/hash/ceiling rejection; and partial-March/duplicate receipt refusal. The test suite uses in-memory generated fixtures only and makes no network or database calls. These are contract tests, not unattended operation or hosted acceptance.

Before activation, obtain current read-only financial/inventory/receipt readback; reconcile the existing 20 November–19 December programme; bind compiled outputs to exact current financial versions; rehearse new-key publication and uncertain-outcome handling in disposable storage; then prepare one exact source/data/permissions/scheduler decision. This source contract grants none of those actions. Preserve the original 48 summaries, financial seals, other companies and finite access/worker policies.


## Input and output integrity

Before reading input fields, a bounded descriptor-only JSON check rejects getters without running them, non-JSON prototypes/symbols, sparse arrays, unsafe/nonfinite integers and cyclic/oversized data. The validated JSON is copied before normalization. The returned manifest is deeply frozen, including nested inventory and coverage proofs, and its hash covers the exact immutable normalized output. This prevents caller mutation from changing the described package after hashing; it does not make supplied external evidence authentic.
