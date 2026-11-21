# Current customer-candidate authority proof — 21 November 2026

Read-only database observations for the privately prepared October 2026 candidate. No credentials, environment values, session tokens, grants, role switches, schema/data changes or provider requests were used. Raw records, dependency identifiers and fingerprints are retained only in mode0600 private proof files. This report contains counts and validation outcomes, not private bindings.

## What was actually checked

One narrowly scoped SELECT returned the October acquisition supplement, canonical seal/coverage/contract metadata and related invalidation/selection counts in one statement snapshot. Results:

- One acquisition base, one October seal, one exact monthly coverage record and one history contract.
- Supplement financial-version, sales-revision and cost-revision bindings match the seal; base is not invalidated.
- Zero base invalidations, zero version heads for that month and zero correction selections superseding the candidate's financial version.
- Local verification of captured values passed: coverage manifest digest, seal manifest digest and coverage identifier; expected history edition/formula, opening anchor, synthetic source basis and October source-as-of; and exact private candidate version/sales/cost bindings.
- Original summary inventory remains 48 records. A private whole-inventory fingerprint and financial seal-inventory fingerprint were captured.
- Seven unrelated store records were counted and privately fingerprinted. A separate SELECT captured row counts and source-ID/row-hash fingerprints across the five history source tables (orders, refunds, returns, lines and journal events), including unrelated-row counts.

These fingerprints are fresh comparison baselines, not a claim that a mutation was applied and preserved them. Source-row hash inventory is not independent recalculation of every canonical amount or validation of every stored body/hash pair. The metadata matches resolve the candidate's current base-selection authority question, but full source arithmetic and same-transaction authenticated runtime acceptance remain separate checks. The separate source-inventory statement is not claimed atomic with the metadata statement.

## Runtime identity: source evidence versus process evidence

Reviewed source startup composes history and supplemental services over the dedicated review database adapter. Configuration validation accepts the named dedicated review login, and each adapter transaction executes the named review service role. Startup verifies the effective service role, unsafe login attributes and limited write-readiness flags. No generic database credential is accepted by that path.

This identifies intended runtime identities without inspecting configuration values. It does not establish that the audit connector is that application session. Its principal and permissions must not be substituted for the deployed process. Previous browser acceptance likewise does not expose PostgreSQL session identity.

The available Render connector supports deploy metadata and narrowly filtered logs. The inspected startup source emits safe failure diagnostics, not a success attestation of session_user/current_user tied to the current request and deployed revision. Retrieving a deploy status or finding no startup failure cannot provide that missing assertion. No broad logs were fetched. Current effective-role catalog evidence gathered separately remains role-definition evidence, not direct observation of the web process connection.

## Precise remaining gate

Use an existing noncredential, revision-bound runtime attestation if one exists. Otherwise prepare a minimal server-owned diagnostic/readiness check that reports only target match, expected login match, expected effective role match, enforced read-only transaction and deployed revision. It must use the actual dedicated application's connection path, withhold credentials/role bindings from public output and remain access-controlled. Review and release of that diagnostic is a separate source change; no endpoint is installed here.

Until then, current application-session identity is **unverified**, rather than unknowable or a reason to create access. Current catalog role checks can establish intended roles and permissions; they cannot certify which session a process is using. Exact candidate publication, operator authority, concurrency/replay recovery, least necessary new access and hosted member/nonmember/browser acceptance remain unexecuted. No activation approval is requested from these SELECT results.

## Private evidence handling

Captured metadata/authority, local boolean validation results, financial-source fingerprints, prior original48 inventory and prior catalog/role observations remain outside the repository with restrictive file permissions. No raw IDs, hashes, bodies, SQL diagnostics, connection strings or member bindings are published. This document changes no operational roadmap and is not committed by this reviewer.
