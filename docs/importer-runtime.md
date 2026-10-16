# Controlled importer runtime — local only

The new experiments/shopify/import-runtime.mjs composes a dedicated pool and the first-import writer. It accepts explicit staging-only configuration, the exact direct project hostname and night_scout_import_login; privileged/reviewer usernames, alternate projects, URL options and invalid scopes are rejected. TLS verification is enabled, the pool has one connection and bounded connection/statement/idle transaction timeouts. The configured store/period/batch scope is copied and frozen; run() accepts no caller-selected scope. No HTTP route or automatic environment loading is provided.

Startup checks the effective role, expected non-privileged non-inheriting LOGIN, absence of source/receipt mutation and reviewer/audit write grants, the lock helper and receipt table. These checks complement the installed policy verification; they are not a complete proof against every unexpected inherited grant or policy. A full administrator permission check remains necessary when provisioning. The database service role remains trusted across stores; the frozen scope is a runtime restriction, not tenant isolation in PostgreSQL.

Every run uses a fresh transaction and SET LOCAL ROLE. Failed rollback or uncertain commit discards the connection. Errors are sanitised; an uncertain import is never automatically repeated. The next explicit run may return its existing receipt. Failed startup closes the pool.

Three unit groups pass for address/scope configuration, uncertain commit disposal, and fail-closed readiness. Standalone PostgreSQL now also creates a real dedicated importer LOGIN and pg Pool, imports into the empty third synthetic store, then returns already_imported on retry with one receipt. Its socket transport override is test-only; it does not verify cloud DNS/TLS for this new login. All twelve standalone cases pass and the temporary cluster is removed.

No importer login, private credential, runtime or third store has been provisioned in staging. Existing review runtime and A/B records are unchanged.

## Proposed next staging scenario

Prepare an exact guarded package adding synthetic store C (90000000-0000-4000-8000-000000000003), new-fixture.myshopify.com/shop 3, and a retained February candidate using the existing test fixture: GBP 100 gross product less GBP 10 discount plus GBP 18 VAT; GBP 24 March refund including GBP 4 VAT. No real Shopify call. Create no financial rows in the seed package: the restricted runtime must produce those. Do not assign merchant or reviewer membership automatically.

Prepare a dedicated private NOINHERIT login granted only the importer service role, with a bounded connection limit and a credential kept outside Git. Verify the actual staging target and permissions before connecting. Then configure exactly C/February/the seeded batch, run once and retry explicitly, and check one order/refund/receipt, false completeness and untouched A/B records. This concrete provisioning/seed package still needs to be generated and tested before requesting its application. Incremental changed-data imports remain unsupported.

Full source/import/review regression: 70 tests pass.
