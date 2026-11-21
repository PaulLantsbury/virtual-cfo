# Customer sidecar effective-access gates — 21 November 2026

This consolidates existing read-only observations and offline security evidence. No new remote query, schema/data/grant change, provider action, publication, commit or deployment is performed for this document. Raw catalog definitions, identity bindings, hashes and source bodies remain in restricted private captures; none are reproduced here.

## Verified observations and their limits

| Evidence | Observed result | What it does not establish |
| --- | --- | --- |
| Original supplemental inventory SELECT | 48 records, 24 distinct reporting months, zero invalidated records. Separate coordinator capture records no optional customerActivity in those original payloads. | Current canonical validity/completeness of every financial dependency; authority to enrich or publish; full cross-company preservation after a future operation. |
| Existing supplemental relation catalog | One table, 13 constraints, one policy, three noninternal triggers and two functions. RLS enabled. Both functions are SECURITY INVOKER. | Actual runtime role, correct deployed application database binding, or effective access under that role. Catalog readability is not operator publication authority. |
| Structural contract comparison | Scoped unique constraint, immutability trigger, owner guard, member policy and expected server member-context reference present. Function definitions and digests retained privately. | Exact application schema compatibility across a new transaction; permission to run the proposal; proof of live reader code revision. These are structural checks, not a complete executable migration preflight. |
| Known browser/default-role privileges | The three already referenced default/browser roles had no schema usage or table SELECT/INSERT/UPDATE/DELETE on the original supplemental relation at capture. | Every inherited/effective privilege of the unknown deployed reporting login; access to proposed absent objects; actual application session identity. No unrestricted role enumeration was performed. |
| Membership SELECT | One membership for the isolated synthetic company; audit principal could read the membership relation. | That the currently signed-in reviewer is that member, or that the deployed reader checks that exact member. No identity binding is published or inferred from a count. |
| Sidecar namespace catalog | Proposed customer-sidecar schema absent. | A migration approval, a need to widen audit privileges, or an installed runtime route. |
| Query mode | All performed statements were SELECT catalog/inventory checks. Connector reported transaction_read_only off. | An enforced read-only database session. No BEGIN READ ONLY, role switch, credential use or writer operation is claimed. |

Private captures were saved with mode0600. Their existence does not substitute for fresh preflight if the source, schema, memberships or runtime change. No private IDs, original record hashes or catalog role bindings should be copied into public repository documentation.

## Offline evidence already available

The immutable storage/selection/recovery proposals and trusted reader have local PGlite and port-level checks. They preserve fixture records, enforce owner-reviewed publication/withdrawal, deny unsupported identity/scope/version/hash combinations, and withhold any withdrawn base. Focused additional tests establish committed membership removal affecting the next restricted-role transaction and reject removed reviewers or invalid withdrawal times. These do not constitute hosted JWT, runtime-role or canonical-financial acceptance.

The local 48-row integration inventories contain integrity placeholders, not a complete reproduction of live 24-month cash/source records. Prior broad and focused test receipts overlap; they are not combined into an invented end-to-end total. No new tests were run for this consolidation.

## Named role evidence recovered from source

The historical staging checkpoint names the dedicated review login, and current local startup code supplies a stronger implementation clue: `artifacts/api-server/src/lib/review-startup.ts` invokes `initialiseHistoryReportingRuntime`; `experiments/synthetic-company/history-runtime.mjs` composes the supplemental reader over `reviewDatabase`; `experiments/shopify/review-runtime.mjs` permits only the dedicated `night_scout_review_login` username (with its project suffix on the pinned session pooler), executes `SET LOCAL ROLE night_scout_review_service` for each transaction, and checks effective service role plus unsafe login/write flags during startup. `staging-database-target.ts` governs different import/bootstrap roles and is not the review-role contract.

Thus the next catalog check can be bounded to the **source-pinned proposed login and service roles**, without asking an operator to rediscover their names or revealing credentials. The local checkout does not contain the deployed website candidate object needed for an exact byte comparison, so this source inspection does not certify that the current hosted process runs these bytes or uses that session identity. Current live process/target attestation and effective-role catalog checks remain pending. No remote query or secret inspection was used for this additional clue.

## Gates still unresolved

1. **Authoritative reporting-role identity.** Source pins the intended dedicated review login and effective review service role as described above. Exact deployed-byte/current-process identity remains unverified. Do not substitute table ownership, audit connector principal or a test role for that attestation.
2. **Effective runtime grants and capabilities.** Once that existing identity is independently pinned, inspect only that identity's current relevant schema/table/function privileges, inheritance, superuser/BYPASSRLS flags, and role-switch capability needed for this reader. Do not enumerate passwords, environment values, connection strings, secrets or unrelated roles. SQL grants on nonexistent proposed objects remain a future separately bounded package.
3. **Current canonical financial authority.** Confirm exact selected financial versions/revisions, invalidations and dependencies for the candidate months using the existing authorised reader contract. Inventory/hash self-consistency alone is insufficient.
4. **Exact candidate and replay.** A private one-month candidate/selection manifest exists, but it is proposed rather than owner-approved and has no current canonical authority or hosted gate receipts. There is no owner-bound executed publication manifest, source completeness attestation, transactional writer receipt, uncertain-outcome recovery readback or live idempotence proof. Preserve old records; replay only after inspecting the exact committed state.
5. **Concurrent correction/revocation.** Single-connection PGlite does not establish multi-connection interleavings. Separate-connection disposable PostgreSQL must prove coherent old-or-new repeatable-read results, unique selection conflicts, next-transaction withdrawal/revocation and no mixed canonical/sidecar dependency acceptance. An already-open snapshot may legitimately precede a committed change.
6. **Runtime and UI.** The activity-only reader remains experimental; no installed HTTP route, browser response, endpoint authentication, context-isolated cache, hosted denied read or current effective membership check is certified here.

## Smallest next inventory action

**Use the recovered source-pinned login and service role names for the next bounded read-only catalog check; no generic operator role-discovery request is needed.** Independently attest deployed revision/target/session identity through an existing noncredential receipt or minimal trusted application assertion. Do not inspect secret/environment values. If current process attestation is unavailable, retain that specific gate without creating access.

For those source-pinned roles, prepare one narrowly scoped read-only catalog query for that named identity and the existing supplemental/membership/financial objects used by the reader. Return booleans and counts, save raw bindings privately, compare expected no-write/no-bypass access, and leave any mismatch as a concrete named gate. This is a planned inventory step only; no remote action is taken by this document. Sidecar activation, database publication, new grants and website release remain separate exact packages after the missing evidence exists.

## Subsequent bounded role-catalog observation

After source recovery, one SELECT-only query inspected only the two source-pinned roles and five existing reader relations. Both roles had superuser, BYPASSRLS, create-role, create-database, replication and inheritance disabled. The service role was NOLOGIN; the dedicated login could log in. Their explicit membership permitted SET, with ADMIN and INHERIT false. The service had schema usage and SELECT on supplemental snapshots, public membership, historical seals, invalidations and correction selections; INSERT/UPDATE/DELETE/TRUNCATE were false on all five. The login had no table SELECT or those mutation privileges on these relations. All five relations had RLS enabled. Raw receipt was saved privately with mode0600. No role switch, credential inspection, grant or database mutation occurred.

This resolves the named-role scoped table-access observation, not every effective capability. Function EXECUTE/default privileges, additional inherited memberships, exact deployed-process identity and current candidate-bound canonical authority remain to be captured. The proposed sidecar objects do not yet exist, so no privilege on them is inferred. No broad no-write claim beyond the inspected five relations is made.
