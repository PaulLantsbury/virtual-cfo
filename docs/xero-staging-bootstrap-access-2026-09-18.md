# Staging Xero initial-connection bootstrap capability

Status: reviewed staging-only migration; requires manual application by the staging migration owner.

The scheduled reader remains `night_scout_import_login`, which has only four refresh/evidence RPCs. It cannot create a connection or write mapping records. `20260918_grant_xero_bootstrap_access.sql` adds a **separate**, no-inheritance, one-connection login named `night_scout_xero_bootstrap_login`. It has no table grants and can execute only `xero_v1.bootstrap_create_initial_connection`.

That RPC creates one initial, active connection in an atomic transaction with its account directory, mapping version 1, active selected accounts, audit records and AES-256-GCM encrypted refresh envelope. It cannot read credentials, list connections, update mappings, append evidence, rotate refresh credentials, retire connections, change roles, or issue DDL. The function accepts no plaintext OAuth material, raw reports, transactions or financial amounts.

The trusted host must authenticate the operator as a Night Scout owner before it calls the RPC. The RPC independently requires that the asserted owner is a current member of the requested store. The service login itself is not an owner identity and must never be exposed to a browser.

## Apply

1. In the Supabase SQL Editor visibly select **Night Scout Staging** (`bioalckltvkhlczusdvl`).
2. Run `db-migrations/staging/20260918_grant_xero_bootstrap_access.sql` as the migration owner.
3. Run `db-migrations/staging/verify-xero-bootstrap-access-2026-09-18.sql`. Expected: no table grants; one EXECUTE grant on the bootstrap function; both service roles are NOINHERIT, non-admin, one connection.
4. Set a newly generated random password for `night_scout_xero_bootstrap_login` directly in the staging database administration channel, and add its TLS database URL only as `NIGHT_SCOUT_XERO_BOOTSTRAP_DATABASE_URL` in **Night Scout Xero Staging** Replit secrets. Do not paste the password/URL into chat, source control or a browser field other than Replit Secrets.

The password is deliberately `NULL` after migration, so the role is inert until step 4. It must never be shared with the scheduled worker, and the migration must not be run on the production project.

## Reversal

Before the first consent, revoke the function grant and disable the login. Do not delete mapping, evidence or credential audit history after use.
