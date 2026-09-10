# Staging importer installation — ready, not applied

Target: Night Scout Staging bioalckltvkhlczusdvl only. Artifact: db-migrations/staging/20260910_import_setup.sql. SHA-256: 1e831db2d96027c123b1987f49c494cae0f9efbdb95946ff2471c2528e121f79.

Installs the tested non-login importer role, its restricted policies/grants, fixed lock helper and empty append-only import receipt table in a single guarded transaction. No logins, credentials, role memberships, source records, candidates or receipts are created. Existing coverage and review history are not changed. This does not enable the importer or allow it to run under the existing review login.

Two exact-artifact tests pass: preserves all existing order/refund/coverage/review rows after a successful synthetic review and refuses replay; a late injected failure rolls back all new objects/role. The underlying role/importer has also passed prior standalone PostgreSQL concurrent/disconnected-import verification; this newly composed exact artifact was tested in PGlite, not yet separately against standalone PostgreSQL.

Execution after approval: confirm the actual dashboard project; check no import role/login/receipt table/helper exists and the two known synthetic stores remain; save current orders/refunds/coverage/review counts; compare editor text/hash against the artifact; apply once; run verify-import-setup.sql and compare baseline. Expect no login, zero receipts, receipt RLS, immutable receipt protection, false-only coverage insert/update policies, true-only recheck policy, no raw update/delete/truncate or review authorisation/audit-write rights, no public/member helper execution. Preserve August A verified, September A unverified, both B periods verified and the existing single synthetic review audit.

A failed transaction rolls back automatically. Do not automatically drop objects after a successful application. No production, Replit or main-branch release. Applying this database package needs explicit approval under AGENTS.md.

## Controlled invocation still to prepare

After installation, keep the role non-login/unassigned until a concrete runtime is reviewed. Plan a separate private importer credential, trusted store/batch selection and readiness checks; never expose a general import endpoint to merchants or share review credentials. Test on a separately authorised empty synthetic store because existing A/B records must not be overwritten. The current importer supports first imports and exact retries; changed-data/incremental updates remain unsupported.
