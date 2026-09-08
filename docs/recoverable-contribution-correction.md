# Recoverable contribution correction — 8 September 2026

Status: prepared and tested locally on the observed public-schema baseline; not applied to Supabase or wired into newly enabled UI claims.

The captured live `recoverable_contribution_range(uuid)` sums every non-archived opportunity impact for the selected store. That mixes monthly contribution with cash release and other impact types. The approved financial definitions require cash-release opportunities to remain separate from recurring contribution/profit improvements.

## Targeted change

[Proposed SQL](../db-migrations/proposed/20260908000001_recoverable_contribution_monthly_only.sql) adds `impact_type = 'monthly_contribution'`, using an explicitly qualified public table. It is an atomic replacement of the existing function, outside the automatic migration runner. A precondition rejects a missing function rather than creating a new public API on an unrecognised baseline.

It preserves the signature, return fields, selected-store filter, archived-status exclusion, SUM/COALESCE behaviour, SQL/STABLE attributes, security-definer mode and search path. CREATE OR REPLACE retains function identity, owner and object grants. It contains no seed inserts, updates or deletes and does not replay the May 7 migration that bundled the fix with seed changes. Historical files and the captured cloud baseline remain unchanged.

Only explicitly monthly-contribution impacts enter the total. Cash release, other one-off impacts, unknown types and NULL types are excluded. This does not classify missing types or validate opportunity estimates/scoring. Existing behaviour for empty/all-NULL amounts remains zero; that legacy API behaviour must not be interpreted as verified zero opportunity or used to enable unsupported dashboard claims.

## Verification

Three regression groups execute the exact proposal against a fresh disposable PostgreSQL database restored from the captured cloud public schema:

- Mixed synthetic impacts reproduce the old £15,880.25–£27,115.75 result, then return only £150.25–£275.75 in monthly contribution. Archived rows and a second store do not enter the selected store's result; the second store retains its own total.
- Empty, cash-only/unknown/archived and NULL-amount cases preserve documented legacy behaviour.
- Opportunity records, other public objects, function identity/owner/security attributes and object grants remain unchanged. Reapplication leaves the same result and state.

Run `pnpm test:migration-baseline` for these three tests plus the two baseline tests. The complete dashboard/financial/adapter/baseline set passes all 66 tests. No runtime application/dependency changes; type/build checks were not repeated for this proposed SQL, test and documentation package.

## Deployment boundary and next work

The live function still has the discrepancy until a reviewed deployment occurs. Before application, compare the then-current definition/signature/security settings with the captured baseline, resolve the migration registration strategy, and complete the production authentication/store-isolation review. Preserving existing SECURITY DEFINER permissions is compatibility, not an authorisation fix; a caller-supplied store ID is not proof that the caller owns that store.

A [membership-based access proposal](auth-store-isolation-plan.md) now passes local role/RLS tests. Real sign-in and Supabase gateway verification remain required before deployment. The correction now rejects a changed security mode so replay cannot undo later SECURITY INVOKER hardening. Opportunity scoring, evidence quality and dashboard claim restoration remain separate work. No changes to opportunity_breakdown, seed data, live migration ledger, Replit or main are included.

GitHub draft PR #1 holds this correction, tests and documentation. Replit should consume the same versioned documents after a reviewed sync.
