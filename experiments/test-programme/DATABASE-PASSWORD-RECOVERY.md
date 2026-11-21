# Restricted writer credential recovery

This is an operator procedure, not an automatic migration or password reset. Keep provider generation disabled throughout. Website sign-in through GitHub does not authenticate a PostgreSQL connection. Supabase cannot display an existing database password.

## Before a reset

The coordinator must verify the staging project against the fixed runtime target, inspect known external database clients without printing their credentials, and identify any connection using the `postgres` administrator. A current `pg_stat_activity` snapshot cannot rule out dormant or periodic clients. Resetting the administrator password requires updating external clients that use that password; separate restricted-role passwords do not change. Do not reset the administrator merely to diagnose a TLS or hostname failure.

The owner must explicitly perform the password entry, confirmation and submission. Neither the assistant nor a script enters a new credential on their behalf. Use the existing private password manager. Do not copy credentials into chat, a public repository, SQL Editor/history, command arguments or application logs.

## Owner's private steps

1. In the verified staging project's **Database → Settings**, reset only its **database administrator password** if the existing one is unavailable. Save it under a project-specific password-manager entry. This is different from the Supabase website login. Do not change any reader credentials or role flags.
2. In the already isolated writer's private shell, open a verified-TLS interactive `psql -X -W` operator connection using the dashboard-confirmed session-pooler parameters. Do not save an administrator URL in the cron environment. Run `\password night_scout_test_writer` (or the reviewed `psql -c` form): first supply the administrator password privately, then supply the new **restricted writer** password twice. Save these as two distinct entries. The command changes only the existing writer's password, not its permissions.
3. In that writer cron's private environment editor, add only `NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL`. Use the exact restricted session-pooler username/host/port/database from `SHOPIFY-SECURE-SETUP.md`. Percent-encode reserved password characters for the URL; the interactive `psql` password prompt takes the original, unencoded password. Do not paste a password into an external encoding website. Retain verified TLS and the trusted CA file, and keep `NIGHT_SCOUT_TEST_PROGRAMME_ENABLED=false`.

If a connection is rejected after a deliberate password reset, the shared pooler may briefly cache old credentials. Make only a bounded retry after propagation, then stop and inspect. Repeated guesses can trip the shared pooler's circuit breaker. An authentication failure occurs before the `\password` command executes and does not change the writer password.

## Coordinator's verification

After the owner has completed entry/submission, run `node experiments/test-programme/shopify-database-preflight.mjs` from the deployed repository. It requires the dedicated disabled writer configuration, trusted CA and restricted URL before connecting. It authenticates as the exact restricted login, checks its SET-only membership, assumes the restricted service role, checks RPC permissions, queries the programme's read-only window gate and rolls back. It cannot claim an action, perform OAuth, post an order, change credentials or enable a programme. Errors and receipts omit connection strings and underlying errors.

`restricted_connection_verified` establishes authentication and the checked ACLs only. `programmeWindowReady=false` does not distinguish a disabled programme from an elapsed/outside window. Independently inspect the exact disabled binding and current clock; actual activation and first scheduled/provider/intake acceptance remain separate steps. Skip missed windows; never use Run now, fake time or a catch-up order to manufacture acceptance.

References: Supabase [database roles](https://supabase.com/docs/guides/database/postgres/roles), [password reset](https://supabase.com/kb/troubleshooting/how-do-i-reset-my-supabase-database-password-oTs5sB), and [pooler password rotation](https://supabase.com/kb/troubleshooting/supavisor-error-password-authentication-failed-after-password-rotation).
