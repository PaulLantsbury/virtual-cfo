# Staging review access — 10 September 2026

## Applied and verified

Following the instruction to continue with restricted staging/reviewer setup and Paul's selection of his existing sign-in, checked that the selected Auth account is confirmed and already belongs to synthetic store A. Provisioned exactly one reviewer assignment for that store and a dedicated night_scout_review_login on staging bioalckltvkhlczusdvl. Actual user identifiers/email and credentials are deliberately excluded from this public record.

The login has NOINHERIT, no superuser/create-role/create-database/replication/bypass-RLS attributes, a three-connection limit, and membership only in night_scout_review_service. Provisioning ran in one guarded transaction through the confirmed staging dashboard. The generated SQL was copied back and matched exactly before execution; it uses a SCRAM verifier instead of a plaintext password. No source records, finance evidence, coverage flags or candidate batches were changed.

Four local tests cover successful restricted provisioning, replay refusal, missing membership, late-error rollback, invalid targets/passwords and absence of plaintext credentials in SQL. The helper is administrator-only and is not imported into the web application. Its projectRef guard is not proof of the actual database destination: operators must separately verify their connection/dashboard target.

The Mac resolves the direct endpoint over IPv6 and reaches PostgreSQL. The first authenticated attempt correctly refused an untrusted certificate chain. Downloaded the public root certificate linked in the staging dashboard and used NODE_EXTRA_CA_CERTS at Node startup; certificate verification remains enabled. The subsequent real PostgreSQL login succeeded, SET LOCAL ROLE selected the review service, one reviewer assignment was visible, and source-mutation/self-grant privileges were false. No TLS bypass was used. See [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Private local material

The generated strong password/configuration is stored in .local/review-staging.json with mode 0600. The provisioning SQL and official certificate also live under .local, confirmed ignored by Git. Never upload these files or paste the credential into chat. SQL verifier material is sensitive too. The service password is separate from the Supabase administrator password and the user's sign-in password. Credential delivery to another deployment and rotation remain explicit operational steps.

## Next

The app API/proxy is not enabled yet. Configure the dedicated runtime with the matching staging Auth public key and NODE_EXTRA_CA_CERTS pointing to the official certificate. Use a separate local review-only server or resolve the existing general API's DATABASE_URL dependency without reusing restricted credentials for unrelated routes. Verify runtime readiness and real Auth through the signed-in screen. The database has no candidate batches yet: a passing synthetic end-to-end review needs a deliberate candidate fixture plus matching evidence, not just a successful connection. Production/Replit remain unchanged.

## Connected local preview

Added review-local-server.mjs, an isolated loopback-only HTTP composition which imports no generic database/dashboard routes. It rejects unrelated browser origins, uses the existing review router's bearer/body/error checks and bounds HTTP header/request reads. Two listener tests pass for origin rejection, accepted local review forwarding and absence of unrelated API routes.

A private local launcher at .local/start-review-preview.mjs composes the real restricted runtime and a separate Vite preview. It reads the two ignored configuration files (review-staging.json and review-public-config.json) and starts with NODE_EXTRA_CA_CERTS=.local/staging-root.crt. Run from the repository with Node's --experimental-strip-types. It binds the review API to 127.0.0.1:4001 and the preview to 127.0.0.1:3001, leaving the prior port-3000 preview alone. The startup permission readiness query passed against staging; a request through port 3001 without a token returned 401. No credential is passed to Vite or the browser. The frontend gets only the existing public Auth configuration.

The /financial-review screen is open and awaiting the user's interactive sign-in. Real authenticated review is still pending. No candidate batch has been loaded, so successful financial restoration is not yet expected. This is a local test launcher, not a production deployment or process supervisor; a fresh machine needs private provisioning/configuration again.

### Connected preview consolidated onto port 3000

Stopped the two identified local preview processes and restarted the private launcher with frontend origin/port 3000 and review API 4001. This preserves the existing browser sign-in and avoids the extra port-3001 login. The authenticated financial-review screen loaded test store A; preparing August 2026 returned the safe evidence-needs-attention response. The empty candidate schema means a successful review is not yet possible. The message currently conflates missing candidate data with stale evidence and should be clarified before the next test. No restoration, candidate import or finance-row change was performed. Next: explicit synthetic candidate scenario, then full review/restoration validation.
