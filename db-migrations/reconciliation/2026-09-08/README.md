# Observed public schema and recovered history

Captured read-only from the connected Night Scout Supabase project on 8 September 2026. See [findings and limits](../../../docs/migration-history-reconciliation.md).

- `public-catalog.json`: observed public schema plus version-only migration ledger. No business rows.
- `object-grants.json`: grouped relation/function ACLs; no schema/default ACLs or role attributes.
- `recovery-manifest.json`: immutable Git provenance and hashes for 27 recovered historical SQL files.
- `function-comparison.json`: current/recovered repository function-body comparison with the observed cloud definitions.
- `recovered/`: **historical reference only, never replay**. Includes original seeds and destructive historical statements already present in repository history; these are not newly extracted cloud data.

Run `pnpm test:migration-baseline` from the repository root to rebuild public objects in disposable PostgreSQL. No remote connection is accepted or used by the test.

Reproduce comparisons with `python3 experiments/migration-baseline/compare-history.py`.
Read-only catalog queries are in `experiments/migration-baseline/capture-public.sql`, `capture-object-grants.sql` and `capture-history-metadata.sql`. The public catalog was initially captured in one read-only query; generated/identity flags were supplemented in a second read-only query. The checked-in public capture query now includes those flags. Capture groups are not claimed to be one transactionally consistent project backup.

To verify recovered bytes independently, run `git show <source_commit>:<source_path>` using manifest fields and compare its hash. The source revision is the last archived file before deletion, not an execution checksum from Supabase.

The restorer preserves observed legacy logic and object permissions. It deliberately does not restore business data, migration ledger, full Supabase platform, schema grants or production identities. It must never be pointed at a live database.
