# Independent access operator review

Reviewed `access-plan.mjs`, `access-cli.mjs`, `ACCESS.md`, the attestor's final-state conditions and existing focused test cases. This was a bounded source review: no credentials read, tests rerun, database connections, provider calls or live changes.

## Result

No outstanding implementation or documentation blocker found in the requested paths. The initial inherited-environment finding is **resolved**: independently re-read all four amended execution examples in `ACCESS.md` and confirmed `env -i`, an absolute approved Node executable, minimal reviewed PATH/HOME and only the two execution binding controls. The document explicitly excludes inherited `NODE_OPTIONS`, APM and tracing variables, forbids shell tracing and retains the external capture receipt requirement.

Owner-only files, clean environment and redacted errors do not establish absence of operating-system, driver or database capture. Approval to execute and real logging/host evidence remain prerequisites; this review does not supply them.

## Reviewed guarantees and limits

- Installation composes the six hash-pinned SQL bodies into one same-session transaction. Passwordless temporary LOGIN roles become NOLOGIN before commit; the final disabled access matrix is checked.
- Activation checks the exact current capability set and permits only approved additions. Unselected temporary LOGIN changes are reversed before commit; collector capability requires its own bounded-run approval.
- Credential delivery exclusively creates owner-only files and never overwrites existing paths. Plaintext passwords stay out of SQL; sensitive SCRAM verifiers still require an independently verified capture gate. Known rollback removes only newly created files; uncertain commit/rollback preserves them for reconciliation.
- The CLI checks canonical private files and descriptor ownership/mode, enforces the pinned staging database/session-pooler endpoint and mandatory TLS, and closes its dedicated connection. Approval flags and an injected executor are trusted operator inputs, not independent proof of authorization or host identity.
- Lost COMMIT acknowledgement is treated as uncertain; neither regeneration nor automatic retry is prescribed. Errors expose fixed messages rather than driver content.
- Disable commits NOLOGIN before terminating existing sessions, then requires disabled/no-visible-sessions attestation. One operator must remain coordinated through completion: the transaction advisory lock does not cover the subsequent termination phase. External grant revocation and pending-connection cleanup remain separate prerequisites; observation history is preserved.

Existing focused tests cover the main composition, file, phase, target and failure cases. Source review and disposable tests do not establish live session visibility, logging absence, PostgreSQL transport behavior or host isolation.
