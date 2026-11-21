# Runtime diagnostic owner-review boundary — 21 November 2026

## Exact available source, not a deployment request

Published customer readiness package: `8fdf04824e21aa44b09e04709b08f118969cef6a`.
Frozen local implementation checkpoint: `6d7d5e9b6f2411eef54152070328daa89e2858e3`.
Helper path: `experiments/synthetic-company/customer-runtime-attestation.mjs`.
Helper SHA-256: `66d9a3a589c7f738760124b666ad87d911684072441d2b6416f9d5171b1fb82a`.

The helper is experimental source and is not imported by the application. This package does not deploy a website, install a diagnostic route, change configuration or invoke the hosted process. Three changed core modules were read back from the immutable published commit and matched local source bytes exactly. The combined source checks passed34/34; standalone PostgreSQL17.6 concurrency passed4/4 separately. The private October candidate was rebound to that public source: one proposed sidecar/selection, no withdrawal, activation disabled and four missing hosted gate headers. No raw candidate/identity/record hashes are published.

## What the helper does and exposes

The server-owned helper receives an existing reviewDatabase adapter, not a connection string or caller-selected database. Its no-argument inspection performs one transaction, sets repeatable-read/read-only mode, and executes one fixed SELECT of session/effective-role, database-name and transaction/role-attribute metadata. There are no business-row queries, writes, role grants, schema changes, provider calls or SQL identifiers taken from a request. Output is a fixed contract/state, a revision supplied by trusted composition and eight match/status booleans; role names, target bindings, raw rows, token, SQL error and credentials are omitted. Project identity is deliberately not established by the database name: targetProjectAttested stays false until separate trusted target/process evidence is bound. A caller-provided revision or boolean is not attestation.

The helper itself supplies **no access restriction**, endpoint, enablement switch, expiry, single-use latch or removal mechanism. It must not be exposed by assuming store membership is operator authorization. Its tests are four controlled SQL-port cases plus one actual PGlite INHERIT/NOINHERIT role check, not a hosted session receipt.

## Required concrete integration before an owner decision

The present batch forbids website changes; none were made. There is no executable diagnostic-deployment package to approve yet. The next source-only integration review must specify and test:

- Exact operator authorization using an existing approved boundary, with denied callers, ordinary members and forged revision/target claims rejected. Do not invent a new browser key, role, grant or generic SQL endpoint.
- Trusted build revision and validated target, bound to this same application's reviewDatabase object and invocation. Do not trust request fields or infer process identity from deploy status.
- Fixed query/time bounds and failure projection. The existing adapter's bounded pool/statement limits must be verified in the concrete composition; this pure helper does not implement independent cancellation.
- A defined lifetime, one-invocation restriction, fail-closed expiry/restart behavior and removal plan. No persistent public diagnostic is authorized. These controls are unimplemented today; do not describe them as installed or approved. If no existing controlled mechanism can enforce them without new access/state, identify that exact additional delta before a decision.
- A private receipt showing the deployed revision, established target and all expected matches, while retaining unavailable/mismatched output as failure. No automatic retry, access repair, data publication or credential disclosure follows.

An exact tested integration revision is required before asking the owner to approve a staging deployment and one invocation. The current immutable helper/source package is reviewable preparation, not that integration revision. No generic diagnostic approval is requested.

## Preserving the website release

The accepted source at the recorded live deployment was `3eda388d534b820728172e0edb7ab9b51d0cc3ad`. A future integration must start from the **then-current owner-approved website source**, preserve any later accepted design/Cash fixes, and use a fresh branch/deployment lease. Do not deploy this data branch as a replacement website, reset to3eda, or assume an unrelated branch head is approved. Compare the exact future diff to that baseline, complete relevant tests and identify the immutable deployment source separately. No diagnostic deployment or rollback is performed by this package.

Corrected release receipt: https://github.com/PaulLantsbury/virtual-cfo/blob/1407e47299b6b10329d92a8227a82602f9e26ee2/docs/hosted-release-receipt-2026-11-21.md . Unsupported acceptance=release filtering was intentional; supported reporting-key/anchor checks belong to design. No website defect or fix is inferred from the unsupported-key probe.
