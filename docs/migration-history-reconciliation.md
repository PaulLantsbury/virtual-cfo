# Migration history reconciliation — 8 September 2026

Status: read-only cloud investigation completed; historical files recovered and observed public schema rebuilt in disposable PostgreSQL. The live migration ledger is **not repaired**. This is Night Scout, the commerce virtual CFO; Sam is unrelated.

## Recovered history

The cloud ledger has only a `version` column, with 25 entries from `20260429000000` through `20260502000018`. It contains no SQL, checksums or migration names. The standard migration-list tool expects a name column and fails.

All 25 recorded versions have corresponding SQL recovered from Git history. Commit `cd96a239b12eed023d5606b59b424e4e1de4bb81` archived 27 files under `db-migrations/history`; subsequent commit `f14e278` removed that archive during deployment fixes on 3 May. The files were not lost.

The [recovery manifest](../db-migrations/reconciliation/2026-09-08/recovery-manifest.json) records original paths, source commit, Git blob IDs and SHA-256 hashes for all 27 files. These are the last archived repository revisions, **not proof of the exact bytes executed in Supabase**. The ledger cannot establish that.

The two additional files, `20260502000019_opportunity_breakdown_rpc.sql` and `20260502000020_fix_repeat_purchase_effort.sql`, have no exact ledger entry. The first function exists with a different body; the second is a data update whose application is unverified.

Recovered SQL is reference material outside the migration runner. It includes historical seed/data changes and destructive operations. **Never replay this archive as a repair.** Existing migration/seed execution remains disabled in `supabase/config.toml`.

## Later repository changes versus live state

The eight files currently in `db-migrations/migrations` have no exact matching ledger entry. Absence from this ledger does not prove their changes are absent from the database.

| Repository change | Observed evidence | Conclusion |
| --- | --- | --- |
| `20260430000007z_pre_views_functions` | Six helper bodies match; net sales, AOV and contribution differ | Partial/superseded; the “07z” filename is not an exact numeric ledger version |
| `20260504000001_fix_contribution_margin_pct` | Body differs from current | Superseded by later matching contribution body |
| `20260504000002_add_shipping_marketing_to_cm` | Contribution body matches | Current logic consistent with this revision; execution provenance unknown |
| `20260504000003_trailing_12m_cm_avg` | Function body matches | Same qualification |
| `20260507000001_rls_and_view_security` | All 22 public tables have RLS enabled; all five views have security_invoker enabled | Those effects are present; does not prove the complete migration ran |
| `20260507000002_marketing_intelligence_schema` | All five named tables exist and all four function bodies match | Substantial implementation present; no claim that every statement/seed ran |
| `20260507000003_seed_opportunities` | Recoverable-contribution body differs; seed rows not inspected in this reconciliation | Genuine logic discrepancy; data changes unverified |
| `20260517000001_fix_net_sales_aov_rpc` | Both function bodies match | Present logic despite absent ledger entry; not certification against newly approved definitions |

The [function comparison](../db-migrations/reconciliation/2026-09-08/function-comparison.json) covers all 35 recovered/current files. The comparison script ignores comments, whitespace and unquoted token case. It compares function bodies, not complete DDL, permissions or execution provenance. It is scoped to the SQL syntax in these files, not a general SQL parser.

## Concrete discrepancies to retain in the backlog

- Live `recoverable_contribution_range` sums all non-archived opportunity impacts. The May 7 repository revision additionally filters `impact_type = 'monthly_contribution'`. Live logic can therefore combine monthly contribution with other impact types. No live correction or seed replay was attempted.
- Live `opportunity_breakdown` differs from the recovered May 2 file. The observed function is SQL/STABLE, uses caller permissions, includes impact type and excludes archived status with COALESCE. Its exact source revision remains unidentified. Preserve the captured definition rather than overwrite it with the recovered file.
- `v_monthly_metrics` generates only January–June 2026. This fixed reporting window is captured as observed, not repaired.
- Existing security-definer functions and object grants are preserved for compatibility testing. This does not approve their production security. Authentication, store isolation and API-role verification remain separate work.

## Reproducible observed baseline

[Captured artifacts](../db-migrations/reconciliation/2026-09-08/README.md) contain public object definitions and object grants, not extracted business records. The snapshot covers 22 tables, four generated columns, 88 non-NOT-NULL constraints, 15 non-constraint indexes, five views, 24 functions, RLS flags, zero policies and zero non-internal triggers. NOT NULL is captured per column.

`pnpm test:migration-baseline` rebuilds those observed objects in a fresh in-memory PGlite database. Tests compare columns/defaults/generated expressions, constraints, indexes, view definitions/options, function definitions, RLS flags and non-owner object grants with the snapshot. PostgreSQL 18's additional NOT NULL constraint entries are excluded because column nullability is compared separately.

Both test groups pass: archive hash/ledger correspondence, and faithful public-object restoration plus application of the exact proposed `finance_v1_sales_evidence.sql` to that empty baseline. Existing public function definitions remain unchanged and evidence tables stay empty. Existing financial/cloud-mapping fixtures continue to test monetary behaviour separately.

This is **not a full Supabase backup or deployable replacement**. It excludes customer/test records, Auth/Storage/internal schemas, schema/default ACLs, role attributes/memberships, extension configuration, owners and project settings. Local roles are placeholders; Supabase JWT/PostgREST and production service-role semantics are not reproduced. No historical migrations or seed files are executed by this test.

## Next controlled step

Use this observed baseline for local compatibility tests and prepare a targeted, versioned correction for the recoverable-contribution mismatch, without replaying its bundled seed migration. Keep deployment pending until production authentication/store isolation and API-role tests are specified.

Before any future ledger repair, obtain a full schema-only backup/project configuration, reconcile remaining object/security/data provenance, and agree a reviewed baseline strategy. Do not add a name column, mark later versions applied, or rewrite old ledger entries solely from body matches.

GitHub's draft branch is the durable record. Main and Replit have not been merged/synchronised, and Supabase schema, data and ledger were not modified.
