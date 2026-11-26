# Provider access operator — executable preparation

This new operator is **prepared and disposable-tested only**. No live operation is performed by authoring it. It changes no existing provider SQL/runtime/UI. The six source inputs are pinned by SHA-256 to baseline `0e7f99fa5c963de5fe7f3a8f88ec99b180ce08a1`; `access-plan.mjs` lists the exact hashes and twelve role names. The approved target is the same existing staging project pinned by current provider runtimes. Arbitrary matching host/project values in a binding are rejected.

## Commands and private binding

From the candidate root, the only command safe without execution approval is:

```
node deployments/provider-activation/access-cli.mjs plan
```

Plan loads no binding, credentials, database driver or connection. The following commands are **future operator steps only**, each requiring its own recorded approval and exact private binding. `$approved_binding_file` is the path privately selected by the named operator; it is not a secret value or a command-line credential.

```
env -i PATH="$approved_node_path" HOME="$approved_operator_home" NIGHT_SCOUT_PROVIDER_ACCESS_EXECUTE=true NIGHT_SCOUT_PROVIDER_ACCESS_BINDING_FILE="$approved_binding_file" "$approved_node_binary" deployments/provider-activation/access-cli.mjs install --execute
env -i PATH="$approved_node_path" HOME="$approved_operator_home" NIGHT_SCOUT_PROVIDER_ACCESS_EXECUTE=true NIGHT_SCOUT_PROVIDER_ACCESS_BINDING_FILE="$approved_binding_file" "$approved_node_binary" deployments/provider-activation/access-cli.mjs deliver --execute
env -i PATH="$approved_node_path" HOME="$approved_operator_home" NIGHT_SCOUT_PROVIDER_ACCESS_EXECUTE=true NIGHT_SCOUT_PROVIDER_ACCESS_BINDING_FILE="$approved_binding_file" "$approved_node_binary" deployments/provider-activation/access-cli.mjs activate --execute
env -i PATH="$approved_node_path" HOME="$approved_operator_home" NIGHT_SCOUT_PROVIDER_ACCESS_EXECUTE=true NIGHT_SCOUT_PROVIDER_ACCESS_BINDING_FILE="$approved_binding_file" "$approved_node_binary" deployments/provider-activation/access-cli.mjs disable --execute
```

The named operator sets `approved_node_binary` to an absolute trusted Node executable, `approved_node_path` to a minimal reviewed directory list, and `approved_operator_home` to the operator home. These commands deliberately inherit no `NODE_OPTIONS`, APM or tracing environment. A clean environment does not prove the absence of operating-system, driver or database capture; the separate approved logging receipt is still required.

Use the binding approved for that operation; do not reuse one with a different action. Never use shell tracing. The CLI reads owner-only local JSON and secret files via an `O_NOFOLLOW` descriptor and checks actual descriptor ownership/mode, regular-file type, size, canonical path and private parent directory. Paths must be absolute, free of symlink components, and under an operator-owned 0700 directory; binding, administrator URL secret and CA files must have no group/other permissions (normally 0600). No secret is accepted through argv. A credential-bearing administrator URL is read only after the explicit execution switch; password values are never printed.

The private binding fields are:

| Field | Required meaning |
|---|---|
| `targetId` | The existing pinned staging project, independently reviewed before execution. |
| `databaseUrlSecretFile` | Owner-only file containing the approved administrator PostgreSQL URL. Not a provider/runtime/service-role credential. |
| `caFile` | Owner-only PEM CA file. TLS verification is mandatory. |
| `privateDirectory` | Existing empty operator-owned 0700 directory approved for first delivery. |
| `approval.operation` | `install`, `credentials` (for `deliver`), `activate`, or `disable`. |
| `approval.approvalRef` | Identifier of PM's exact recorded execution approval. This is a receipt reference, not a self-authorising checkbox. |
| `approval.sourceRevision` | Exact pinned baseline constant above. Candidate operator revision is separately frozen in the final manifest. |
| `approval.targetId`, `approval.environment` | Same pinned target; literal `staging`. |
| `approval.database`, `approval.definer` | `postgres` database and exact reviewed administrative/definer role; must match actual `current_user` and `session_user`. Runtime provider roles are refused. |
| `approval.loggingGatePassed` | True only after the specific host/driver/database/APM capture receipt is approved. |

The connection permits only the pinned direct database host or the existing exact session-pooler host on **5432**, with project-qualified pooler username. Database must be `postgres`; query-string SSL overrides, other projects/hosts, transaction pooling and runtime role usernames are rejected. The helper's injected executor contract assumes one dedicated same-session connection; the CLI supplies it. Target binding and receipt flags do not independently authenticate an arbitrary injected executor or prove external approval.

## Ordered installation, secure delivery and phases

1. **Install into absence.** Review body/definer, existing memberships/PUBLIC/default ACLs and logging first. The helper obtains a transaction-scoped advisory lock and checks provider schema/role/RPC absence. Within **one transaction**, it creates all six NOLOGIN groups and six passwordless LOGIN identities with no elevated attributes, grants only matching exclusive group membership, and executes the six unmodified hash-verified SQL bodies in store/RPC/read order. Only their outer BEGIN/COMMIT wrappers are removed to compose the transaction. It validates the exact installed RPC/access matrix and function ownership, then sets every runtime login NOLOGIN **before commit**. The temporary LOGIN state satisfies existing SQL guards but is never externally committed. Returned state is `installed-disabled`; no passwords or provider calls occur.
2. **Deliver credentials while disabled.** Requires `approval.privateDirectory` equal to the approved destination plus `noExistingCredentialsConfirmed:true`. The helper obtains the same advisory lock, verifies disabled access state and that the six roles have no stored password. It generates six independent random passwords only during this approved execution. It writes one 0600 file per provider/capability with exclusive creation (`wx`); existing files/symlinks are not overwritten. Each JSON file contains version, provider, capability, exact username and password. Only SCRAM verifiers reach password DDL. **SCRAM verifier strings are sensitive too:** database statements, driver/APM traces and server logs must not capture them. SCRAM generation is not a substitute for the logging gate. The transaction keeps all logins NOLOGIN.
3. **Deliver only to the matching approved process.** Private files are `meta-api.credential.json`, `meta-report.credential.json`, `meta-collector.credential.json` and the corresponding Google names. Website receives report credentials only; the separate API process receives API credentials; each one-shot collector receives only its provider's collector credential. Do not upload the whole directory or pass an API/collector secret through the website. Host-scoped import and TLS URL construction belong to the separately reviewed host delivery step; local secure files do not prove remote secret isolation.
4. **Activate a named phase without re-consent.** Requires exact `approval.expectedActiveCapabilities` and full desired `approval.capabilities` arrays, using only `meta-api`, `meta-report`, `meta-collector`, `google-api`, `google-report`, `google-collector`. The actual current LOGIN set must equal the expected set. The desired set can only add capabilities; removals use the stop/cleanup path. Requires `installedBodiesVerified:true` and `hostSeparationVerified:true`, plus `boundedOneShot:true` if any collector is included. Selected roles must already have credentials. The full ACL matrix is checked using transaction-local LOGIN changes, unused roles restored NOLOGIN before commit. Thus API connect can be followed by separately approved report/collector phases while retaining the active connection/grant; no blanket collector activation or re-consent is forced. This command changes database LOGIN flags only, never application flags, schedules or provider state.
5. **Run only the independently approved OAuth/selection/collection/report steps.** One-time collection is separate from scheduling. Retain account/window/currency/timezone and raw CLI receipt privately; publish only redacted outcomes. The access helper cannot establish provider app permission, correct real account selection, retention eligibility or positive-spend reconciliation.
6. **Stop and disable.** Stop collector activity/prevent new connections; complete finite approved pending cancellation and disconnect where final cleanup requires credential removal, while API capability remains available. External provider grant revocation is separate. For `disable`, record `collectorsStopped:true`, `pendingConnectionsCleaned:true`, `sessionVisibilityConfirmed:true`. The helper commits NOLOGIN for all six, terminates existing provider sessions, and verifies disabled/no-visible-sessions with the authorized administrator. It does not delete observation history, schemas, roles, envelopes or grants. Those provider cleanup operations must actually precede the final attestation; a flag alone is not evidence. Coordinate one operator at a time through completion.

## Failure and partial-install handling

- Existing schema, role or expected RPC means the absence preflight fails; no blanket cleanup or retry occurs. Review that exact state and authorise a targeted recovery/migration separately. Changed-return-type Meta RPCs are never blindly replaced.
- Failure before commit rolls the composed new-role/six-file installation back as one transaction. No `DROP SCHEMA`, `DROP ROLE`, history wipe or global grant repair is attempted.
- A COMMIT acknowledgement failure is **uncertain**, even if a subsequent rollback command returns. Stop and inspect actual state; do not repeat installation or regenerate credentials automatically.
- During known credential rollback, only files exclusively created by this invocation are removed; existing files remain untouched. On uncertain commit/rollback, private files are retained for reconciliation. Failed local cleanup is reported as an operator-recovery requirement. First delivery is not a password rotation tool.
- If session termination/visibility verification fails after NOLOGIN commit, logins stay disabled and cleanup remains unverified. Source rollback cannot reverse database credentials, existing sessions or provider grants.
- Never fix failed attestation by blanket revocation of unrelated application privileges or by trusting PUBLIC privileges merely because provider namespaces were absent. Body provenance, trusted owner, TLS, host isolation and logging remain separate real evidence gates.

## Focused verification

```
node --test deployments/provider-activation/access-plan.test.mjs
```

The new tests execute the actual six SQL files and role provisioning inside disposable PGlite, plus private temporary filesystem delivery. They cover default-plan isolation; disabled final matrix; partial-state refusal; mid-install rollback; target/owner/hash rejection; distinct 0600 files and no overwrite/symlink; SCRAM/no plaintext query; uncertain commits; selected and phased capability activation; generic error redaction; and cleanup preservation. This is new provisioning composition evidence, not a rerun of the broad provider suite or proof of live PostgreSQL network, log retention, multiple operator concurrency, host isolation or actual provider acceptance.
