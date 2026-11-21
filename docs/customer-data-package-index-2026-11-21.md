# Customer data source package — 21 November 2026

This is source preparation, not hosted activation. Baseline implementation and independent rehearsal source: `4e7cd9f28bc601dd27bd26f479743442201543c8`, following storage/reader `9adb5ff0a33763068a360e200b271f04ca7f3714` and withdrawal/continuation `9d7151cd61adfc6648cecaa9daa47e5d8cf33eb8`. The consolidated publication adds a timestamp precision correction and review documentation; its exact implementation source is `9a5dd35c982a81e57370700d3afffa80e98f93ba`, with file hashes in customer-data-package-source-manifest-2026-11-21.json. The public commit identity is recorded separately. No hosted database, grant, feed, provider, endpoint or website change is included.

## What can run now

The repository modules compile bounded, immutable customer sidecar and continuation proposals locally. Disposable tests exercise actual proposed storage/withdrawal SQL and the restricted-role reader. They do not connect to hosted Supabase. The manifest always returns activationAllowed=false, remoteApplied=false and executorIncluded=false; supplied receipt headers never confer authority. There is no exported hosted writer, no automatic migration, no new runtime route and no page activation.

Read the independent evidence in:
- customer-activation-review-package-2026-11-21.md — exact candidate binding and actual SQL rehearsal, including explicit test seams.
- data-security-review-2026-11-21.md — membership, withdrawal, concurrency and trust-boundary review.
- customer-data-source-validation-2026-11-21.md — commands and non-additive validation receipts.
- customer-sidecar-effective-access-gates-2026-11-21.md — observed catalog versus outstanding effective access.
- customer-continuation-closed-month-gates-2026-11-21.md — finite continuation and monthly refresh requirements.

## Private evidence newly obtained, with limits

Read-only hosted queries captured the actual 48 original envelopes (24 acquisition, 24 cash; November 2024–October 2026), metadata and body hashes privately. No optional customerActivity was present. The original table had RLS, expected immutability/owner/member controls and no observed schema/table access for anon, authenticated or service_role. This is an observation under the audit connector, not proof of the application's deployed reporting-role privileges. The queries were SELECT-only; the connector session was not asserted to enforce transaction_read_only.

A private exact October acquisition candidate reproduced source/order/refund/allocation hashes and preserved mandatory original economics. Its proposed activity counts were 1,626 identified customers, 683 unique returning customers and 1,634 identified orders. The private manifest proposes one sidecar and one selection, zero withdrawals; an existing member is only a proposed reviewer, not approval. Protected snapshot IDs, account/reviewer identifiers, raw envelopes, hashes and private manifests are excluded from public source. The older data-safeguards-source-manifest is a historical receipt and was not retroactively rewritten to claim this later capture.

This capture is insufficient for activation: current indexed/invalidated state, financial and unrelated-company fingerprints, canonical authority, effective reporting role, candidate-bound transaction receipts and hosted recovery/replay evidence must be bound together freshly. An inventory digest alone does not establish financial authority or access.

## Smallest next live evidence step

No data-write approval is requested. Source inspection recovered the intended dedicated review login and service role. A bounded SELECT-only catalog query confirmed service SELECT/no mutation privileges on five existing reader relations, RLS enabled, no bypass or elevated flags, and explicit SET-only/non-admin membership. No operator role-discovery question is needed. This does not attest the actual current application session or all effective function/default/inherited privileges. Next capture those remaining scoped capabilities and existing noncredential deployed-process/target evidence; never dump connection strings, passwords, tokens or environment values. See the effective-access gate document for the exact observation limits.

After the evidence is available, prepare and independently rehearse a parameterised private writer/preflight/postflight protocol with exact candidate IDs, protected fingerprints, atomic insertion, uncertain-commit readback and append-only withdrawal. Only then present a concrete decision enumerating any necessary schema/access changes, one exact candidate/selection subset and separate runtime integration. Source publication and website deployment approvals do not approve these operations. Same-base replacement remains unsupported.

## Website release remains separate

Website source `3eda388d534b820728172e0edb7ab9b51d0cc3ad` is deployed. Immutable receipt: https://github.com/PaulLantsbury/virtual-cfo/blob/21e5112b1635e60e239c2186febb4bef8a9591f4/docs/hosted-release-receipt-2026-11-21.md . Legacy probe /margin-analysis?acceptance=release#evidence became /profit-engine#evidence; expected /profit-engine?acceptance=release#evidence. The design lane owns that isolated follow-up. This data package does not change App routes or the deployed source.
