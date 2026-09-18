# Xero staging schema application record

Status: **prepared, not applied by this repository checkout.**

The approved target is the separate Night Scout Staging Supabase project:
`bioalckltvkhlczusdvl` in eu-west-1. It is not the original project and it is
not a production database. The repository has evidence that its baseline
bootstrap and Shopify nightly-claim table were applied previously. This checkout
does not contain a database credential, Supabase access token, or a Supabase
control surface, so it cannot safely select or write to the remote project.

## Safe application gate

An operator with access to the already-designated staging project must first
select `bioalckltvkhlczusdvl` visibly in the Supabase dashboard and run
[the read-only preflight](../db-migrations/staging/preflight-xero-staging-2026-09-18.sql).
It is suitable only if:

- the first result has every `has_*` readiness value and
  `xero_namespace_is_empty` set to true;
- the second result confirms RLS, the self-read policy, read-only browser
  access, and no browser membership writes; and
- the final result returns zero rows.

If any condition differs, stop the application and capture only the structural
result (no credentials or Xero data) for a fresh review. Do not use a production
connection string, an application service-role key, or a browser client to
apply it.

## Exact approved artefacts and order

1. [Mapping store proposal](../db-migrations/proposals/xero-mapping-store-2026-09-18.sql) — SHA-256
   `8b1e8b5e8d39e7f842714ec685c6625b71971b9771f6f0d68241add2ca8c28f3`
2. [Credential envelope proposal](../db-migrations/proposals/xero-credential-store-2026-09-18.sql) — SHA-256
   `03b53c860f71407d653d8dbf6c05e587ba271b875f4df102c5f1a8e09593ec48`

Each proposal has its own transaction. Apply the mapping proposal first; it
creates `xero_v1.connections`, which the credential proposal references. Stop
on an error; do not strip transaction boundaries, edit the proposal in the SQL
editor, or retry a partially successful statement.

Both proposals are additive: they create a new private schema and new tables,
enable RLS, revoke browser writes, and do not alter existing commerce or finance
rows. The credential proposal stores envelope metadata and ciphertext only. It
does not store an Xero client secret, access token, report, balance, transaction
or accounting value.

## Read-only post-application review

Before configuring any Xero credential or enabling a worker, inspect the
following without querying financial/Xero payloads:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'xero_v1'
ORDER BY table_name;

SELECT relname, relrowsecurity
FROM pg_class
WHERE relnamespace = 'xero_v1'::regnamespace AND relkind = 'r'
ORDER BY relname;

SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'xero_v1'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;
```

Expected tables: `connections`, `account_directories`, `mapping_versions`,
`mapping_selections`, `mapping_audit`, `credential_envelopes`, and
`credential_audit`. Every table must have RLS. `anon` receives no grant;
`authenticated` has read-only access to the mapping tables only; neither browser
role receives access to either credential table. A result that differs is a
security failure, not a condition to work around by broadening grants.

## Remaining configuration boundary

After the schema is proven, the staging server still needs a server-only Xero
test-app client ID/client secret and a managed server-side key-encryption-key
reference. Neither belongs in this repository, frontend, browser settings,
database migration, logs, or chat. The staged connection/worker remains disabled
until those server-side values and an explicit trusted worker identity are
configured.
