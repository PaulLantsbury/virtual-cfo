# Staging review package — ready for approval, not applied

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

Standing approval in AGENTS.md covers draft uploads but excludes applying database migrations. This exact staging package therefore awaits Paul's approval.
