# Staging review package — applied and verified 10 September 2026

Target: **Night Scout Staging**, project **bioalckltvkhlczusdvl**. The original project futkktdebdygsdrcknpr is excluded. This is a database-only package; no production deployment, merge or Replit sync is included.

## Exact proposed change

Apply `db-migrations/staging/20260910_review_setup.sql` once, in one transaction. It composes the four locally tested intake/invalidation/review/service proposals without their individual transaction boundaries.

SHA-256: `2b69ea566fcfef358617204cc6829561eccdf9293b49cfd0c84cf16a0f920e2d`.

It adds five private RLS-protected intake/review tables, source/evidence invalidation triggers, append-only review audit enforcement, a restricted non-login service role and the fixed locking helper. Changes to source records or supporting evidence will subsequently invalidate affected store coverage. The package itself does not change existing business/evidence rows or current verification flags.

It creates no login/password, reviewer assignments, imports or audit rows. The API stays disabled. Real reviewer Auth/UI verification therefore follows in a separate provisioning step, not immediately upon applying this SQL.

## Preconditions and execution

1. Confirm the dashboard URL/project is bioalckltvkhlczusdvl. SQL alone cannot reliably identify the selected Supabase project.
2. Run the committed read-only `preflight-review-setup.sql` and compare with the saved staging baseline: no ingest_v1 schema or review roles, existing finance evidence/member RPC, and only the two known synthetic store/order identities. Stop on unexpected state; do not remove objects or overwrite data to make the guard pass.
3. Confirm the script content/hash against the committed artifact, then execute the exact script in the staging SQL editor after approval.
4. Run `verify-review-setup.sql`. Expect five ingest tables with RLS, a non-login non-privileged review role, no login, one fixed lock-only definer function, no public/member execution of internal functions, no source mutation/self-grant/audit mutation privileges, and zero candidate/reviewer/audit rows. Compare coverage flags with the preflight output.
5. Leave the API disabled and preserve existing test memberships. Record the actual application outcome and verification separately from this proposal.

The script refuses an existing intake schema or review role and an unexpected synthetic store/order baseline. It is not a migration-history repair or a general production migration.

## Validation

Three package test groups pass: exact generated content and unchanged prior figures; full rollback after a late injected error; rejection of unexpected baseline/existing roles/replay. The exact bundle also passes on standalone PostgreSQL 18.4. Seven concurrency cases and the actual restricted-login runtime case pass in that same disposable run. The test server/cluster was shut down and removed.

A test fixture initially failed to create its deliberately unexpected store because it omitted a required domain; the fixture was corrected and all package tests passed. No live preflight inspection or application is claimed yet.

## Rollback and later provisioning

A failure inside the transaction rolls the entire package back, including the new role; tests confirm this. After a successful commit, do not automatically drop the schema or remove invalidation triggers. If later verification fails, keep the API off, inspect the specific discrepancy and prepare a reviewed correction. Once imports/audits exist, destructive teardown would lose history.

For the subsequent login/UI step, the concrete requirements are: a dedicated NOINHERIT, non-privileged review login granted only the review role; a strong private credential held outside Git; explicit reviewer assignment to an existing synthetic-store member; the four dedicated server variables; matching staging frontend/Auth target; same-origin API routing; request/deployment limits; then verified prepare/restore/revocation tests. No production user or merchant-data import is included. Credentials should never be pasted into this document or public GitHub.

Paul explicitly approved this exact staging package on 10 September 2026. Application and verification are recorded below.

## Actual staging application — 10 September 2026

Applied only to Night Scout Staging `bioalckltvkhlczusdvl` through its authenticated SQL editor after explicit approval. The preflight was run as a single JSON result containing the committed preflight checks: no intake schema or review roles, required finance objects present, exactly the two expected synthetic stores/orders, GBP/Europe-London stores, and four complete August/September coverage periods.

The full editor content was copied back and compared byte-for-byte with the approved SQL artifact; its SHA-256 matched the value above. Execution returned “Success. No rows returned”. Postflight combined the committed verification queries into one JSON result and confirmed:

- All five intake/review tables have RLS enabled.
- Only the non-login review service role exists; all privileged role attributes and inheritance are false.
- Only the fixed lock helper is a definer function; no internal function is executable by anon/authenticated.
- Candidate batches, reviewer assignments and audit rows are all zero.
- Source mutation, self-grant and audit-mutation privileges are false.
- All four coverage flags remain true. Existing order gross/net/total sales remain GBP 123 and GBP 987.

No login, credential, reviewer assignment, candidate import or API enablement was performed. No production, original-project, Replit or main-branch change was made. A fresh real-user UI/RPC end-to-end check was not part of this database-only application. Next: prepare dedicated staging runtime access and reviewer provisioning, then test the complete review flow using synthetic data.
