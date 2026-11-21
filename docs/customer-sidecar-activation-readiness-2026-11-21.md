# Customer sidecar activation readiness — 21 November 2026

**Not ready for hosted activation.** Reviewed local source revision: `9adb5ff0a33763068a360e200b271f04ca7f3714`. This document does not approve executable SQL or request immediate activation. It does not change an operational roadmap, publish a branch, install a reader, or perform any hosted operation.

## Exact local source proposal

Paths below are relative to `experiments/synthetic-company/`. SHA-256 values identify reviewed bytes; they are not deployment/data approval or evidence of an installed schema.

| File | SHA-256 |
| --- | --- |
| customer-sidecar-storage.sql | 2f6ecbda16e2478a7533577d3e504ec1f87a335373c8c4191283d13d4241e75a |
| customer-sidecar-reader.mjs | 611859eca7ced20d224c577d85a67ce95d5a87c3a068e8c29a56bdf28b47078c |
| customer-sidecar-storage.test.mjs | 423233114d2ab1508998e4a85a2724b2bd262c71723fe8b19e37118fdc2b2038 |
| customer-sidecar-reader.test.mjs | e08f592c371fe5779acf524b204f78361d0a594363ff6c1d8a84c57daea94698 |
| customer-sidecar-integration.test.mjs | 77cfef0b29d492d4c0a38e84ad426f171043d7616dcdf10b153c007da6d5162f |
| customer-summary-version.mjs | 3256a3c4527ec63c23b3fb9bb609eb132fa51b480e1be587528768de6de63fb8 |
| repeat-order-economics.mjs | 5a84b3eeaec5cc17f90ff9efe7d17458fda12164363edc47c0b40ed5c0131689 |

The new schema proposal adds `finance_customer_sidecar_v1.versions` and `selections` without altering the original supplementary relation. A sidecar binds exact original acquisition snapshot/body hash and financial period/version/revisions. Both records and one explicit selection per base are immutable. No generic runtime grants, role creation or SECURITY DEFINER function is proposed. The reader is activity-only and is not mounted on an HTTP endpoint or imported into the website.

## Local receipts and precise limits

The source package records **17/17** tests: five disposable storage tests, eight dependency-injected reader tests and four actual PGlite schema-to-reader integration tests. The prior contract batch records **22/22** combined contract tests. These are separate receipts, not a claim of 39 distinct end-to-end scenarios; overlap and reused fixtures exist. This review inspected those receipts and source; it did not rerun the suites or perform a new build.

The integration executes the actual original supplemental schema and new sidecar SQL, real SQL query aliases and local RLS. Auth and canonical-financial ports are explicitly controlled test seams. The five storage cases protect 48 stub original records. The four integration cases also retain 48 fixture records: one acquisition envelope and 47 minimal Cash placeholders, with artificial financial versions. This proves binding/immutability and query integration, **not** real 24-month source reconciliation. The prior independent compatibility fixture has 24 fictional acquisition envelopes plus 24 Cash placeholders. No fixture contains a captured hosted customer or provider source.

No live catalog, target connection, effective role, JWT verification, real monthly authority, existing 48-row fingerprints, browser display or genuine scheduled receipt is established by these checks. Digest equality cannot prove source completeness or operator authority.

## Exact preparation gates still open

| Gate | Required concrete preparation |
| --- | --- |
| Live catalog visibility | Owner-authorised read-only inspection of private summary schema, constraints/triggers, RLS, effective roles, correction selections and installed reader revision. Current audit account's public catalog view cannot establish private column absence. Keep sensitive target/operator evidence private. |
| Original inventory | Exact protected 48 original snapshot IDs, kinds, periods, financial versions/revisions and body hashes; financial and unrelated-company fingerprints before/after. Reconcile documented November 2024–October 2026 scope with actual readback. |
| Candidate source/data | Compile optional activity from immutable inception proof for an explicitly enumerated subset of the 24 acquisition months. Pin company GBP/London, source hashes, original base IDs/hashes, every activity body/version ID, count and package digest. Existing 24 Cash records require no enrichment. No candidate quantity is approved by this document. |
| Financial completeness | Independently confirm current canonical selected financial versions/revisions and relevant source dependencies. Invalidation/correction must make old sidecars unavailable; supplied test ports are insufficient proof. |
| Publication transaction | Owner-bound executable compiler/preflight/apply/postflight with atomic boundaries, deterministic insert order, unchanged replay, changed-replay rejection, receipt and uncertain-commit inspection. Current planner and SQL are not a bounded hosted writer. |
| Effective access | Identify exact existing server role and least required read objects; demonstrate member/non-member denial and no browser/default-role access. If new grants are necessary, enumerate them separately. Proposed private SQL alone grants no reader access. |
| Correction / recovery | Current UNIQUE base and immutable selection intentionally reject enrichment changes. Define a separately reviewed replacement/withdrawal/read-disable contract and rollback after commit, preserving original and sidecar audit records. Do not improvise DELETE, selection mutation or generic grant revocation as recovery. |
| Selection provenance | Exact member/reviewer binding, selected time at/after original observation and not future, chosen base/version tuple and permission proof. No automatic latest selection. Concurrency and removed-membership behaviour need operator/reader acceptance. |
| Full rehearsal | Rehearse exact candidate and live-compatible inspected schema in disposable Postgres, including failure rollback, changed replay, stale/corrected dependency, grants/RLS and unchanged original/unrelated fingerprints. Minimum local stub coverage is not this rehearsal. |
| Runtime/UI | Separate tested server endpoint/optional feature integration, auth/context/query-cache isolation, failure/stale handling, browser exact-month counts/definitions/Explore and denied reads. Keep legacy absent aggregates unavailable. |

For a complete retrospective activity rehearsal, the potential data shape is **24 new acquisition activity sidecars and 24 explicit selections**, preserving **48 old Cash/Acquisition records**, subject to owner selection of exact scope and successful source proof. A smaller bounded month subset is valid; no silent default to all24. Fixture quantities above are not a deployment manifest.

Repeat economics remains an independent next source contract. The offline partitioner distinguishes paid-first, non-paid-first, identified-repeat, guest and unknown orders and reconciles supplied inputs. It does not supply hosted completeness or enable forecasting. Eligible repeat revenue/refunds/shipping/COGS/variable costs/marketing allocations, observation policy and matching financial/source versions require their own manifest and tests. `customerActivity` counts alone cannot enable the repeat lever, second-purchase timing, retention probability or multi-month distinct-customer unions.

## Owner decision when preparation is concrete

No additional permission is needed for the already authorised offline work or already approved source package. The team should close the gates above before requesting an activation decision. Then present a single exact operator-bound staged package enumerating any schema/read-access actions, immutable sidecar/selection publication once, postflight and recovery, with candidate revision/digests and bounded periods. Website-only deployment identifies its own final tested revision and remains separate. No previous exact-revision approval automatically activates these new objects or data.

No production release, provider request/retry, feed/scheduler activation, future continuation or spending belongs in that package. November 2026 is still open on 21 November; the next closed-month refresh and the proposed future continuation remain separate workflows.
