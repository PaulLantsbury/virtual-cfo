# Xero staging worker least-privilege access

Status: reviewed proposal, **not applied**. This file applies only after the one-shot Xero staging installer in the non-production Supabase project `bioalckltvkhlczusdvl` has passed its verification.

## Purpose

The existing `night_scout_import_login` is a dedicated `LOGIN`, `NOINHERIT`, non-administrative account with a one-connection limit. The worker needs four narrowly defined database actions for the staging-only Xero test-tenant flow:

1. retrieve the current encrypted refresh envelope for one known active connection;
2. store its first encrypted envelope or rotate it exactly one version forward;
3. append a safe credential refresh-failure audit event; and
4. append bounded calculated accounting/cash evidence with provenance.

It receives no table `SELECT`, `INSERT`, `UPDATE`, `DELETE`, ownership, DDL, role-management or browser grant. It cannot list connections from the database. Scheduling supplies a previously known connection ID and runs only server-side.

## Apply and verify

After the Xero schema installer and its read-only verification complete, run [the post-install script](../db-migrations/staging/20260918_grant_xero_worker_access.sql) as the staging migration owner. It fails if the existing login is absent or has gained an unsafe attribute. It is safe to re-run only to restore these exact functions and grants.

The functions are `SECURITY DEFINER` with a fixed `pg_catalog, xero_v1` search path. They are owned by the staging migration owner, never by the worker login. The SQL revokes `PUBLIC`, `anon` and `authenticated` execute privileges before it grants execution only to `night_scout_import_login`.

Run these read-only checks afterwards as the migration owner:

```sql
SELECT rolname, rolcanlogin, rolinherit, rolsuper, rolcreatedb, rolcreaterole,
       rolreplication, rolbypassrls, rolconnlimit
FROM pg_roles WHERE rolname = 'night_scout_import_login';

SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'xero_v1' AND routine_name LIKE 'worker_%'
ORDER BY routine_name;

SELECT grantee, privilege_type, table_name
FROM information_schema.role_table_grants
WHERE grantee = 'night_scout_import_login' AND table_schema = 'xero_v1';

SELECT routine_name, grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_schema = 'xero_v1' AND routine_name LIKE 'worker_%'
ORDER BY routine_name, grantee;
```

Expected result: no Xero table grants for the login and `EXECUTE` on only the four `worker_*` functions. Do not record ciphertext, wrapped keys, financial amounts or OAuth material in the change record.

## Operational boundary

The worker process must use this direct login, must not issue `SET ROLE`, and must never expose its database URL to a browser or API response. Existing Shopify importer role membership is intentionally untouched by this package; changing that membership is a separate cross-workstream decision. The worker’s function results may contain encrypted credential material, so they must remain entirely inside the server process and be cleared after the Xero request.

There is no automatic rollback: revoking the four function grants is reversible, but deleting evidence or credential history is not an acceptable rollback action. This proposal makes no remote change.
