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
   `e69b9503c0b100a6cf2c093e0dbedf65f096d3b00be1520ec3e9b8a6451ac77d`
2. [Credential envelope proposal](../db-migrations/proposals/xero-credential-store-2026-09-18.sql) — SHA-256
   `03b53c860f71407d653d8dbf6c05e587ba271b875f4df102c5f1a8e09593ec48`
3. [Bounded accounting evidence proposal](../db-migrations/proposals/xero-accounting-evidence-store-2026-09-18.sql) — SHA-256
   `4fa26b3e2f32cf584a229cdc6f7354c8d929c53404361a210eabd5bfe8ac8bf3`

The one-shot installer embeds the exact reviewed structure of all three proposals inside one atomic transaction. It is the only approved staging application artefact. Do not run individual proposals separately, strip transaction boundaries, edit SQL in the editor, or retry after an error.

All three proposals are additive: they create a new private schema and new tables,
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
`mapping_selections`, `mapping_audit`, `credential_envelopes`, `credential_audit`,
`accounting_evidence`, and `accounting_evidence_audit`. Every table must have RLS.
`anon` receives no grant; `authenticated` has read-only access to the mapping
tables only. Neither browser role receives access to credential or accounting
evidence tables; the server returns scoped DTOs after membership checks. A result that differs is a
security failure, not a condition to work around by broadening grants.

## Remaining configuration boundary

After the schema is proven, the staging server still needs a server-only Xero
test-app client ID/client secret and a managed server-side key-encryption-key
reference. Neither belongs in this repository, frontend, browser settings,
database migration, logs, or chat. The staged connection/worker remains disabled
until those server-side values and an explicit trusted worker identity are
configured.
