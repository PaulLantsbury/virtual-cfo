# Profit evidence implementation preparation — 13 September 2026

Paul approved the three decisions recorded in `agreed-financial-definitions.md`: actual restock-date cost recovery, actual-only costs and complete-month reporting with independent subtotal availability. This is a bounded implementation preparation package, not a live profit connection.

## Work allocation

- Calculation agent: versioned pure cost/expense evidence contract, historical line costs and independent recovery events, component availability. Existing sales and sample calculations remain stable.
- Schema agent: executable private evidence schema proposal and disposable database validation, linked to recorded existing source structures.
- Independent reviewer: financial acceptance cases and invalid/missing/stale/duplicate/source-scope tests.
- Coordinator: integration review, decision record, tests and publication.

## Release boundary

No browser route reads these new costs yet. The pure contract is not a live Supabase adapter; matching revision labels supplied by a caller are not themselves proof of a consistent authorised database read. A future server read must obtain and validate the source evidence and sales in one compatible snapshot, including source changes and coverage invalidation.

The proposed schema is not permission to install it. Do not apply it or populate synthetic data until the exact current staging schema has been checked, the source-to-contract read and setup have been reviewed/tested, and Paul has approved the concrete database operation. No table existence, passed prototype test or user-approved formula certifies source completeness.

## Verification

Existing calculation, source-adapter and cloud sales regression suites pass: 38 tests. New contract/schema/reader checks also pass; final combined run: 58/58 (19 new pure-contract groups, one proposed-schema/reader group, 38 existing regressions). The old prototype still conservatively blocks cross-period returns; the new approved contract will support independently dated recovery without rewriting that historic prototype or the live sales API. Whitespace checks pass. No frontend code changed, so a new app build/browser walkthrough was not needed for this isolated preparation package.

## Implemented boundaries

- `profit-evidence.mjs`: versioned pure monthly actual-cost calculation contract. Checks historical line evidence, distinct original-order reconciliation, independent recovery dates/cumulative quantity, component coverage, exact money, duplicates, scope/revisions and actual provenance. Missing D&A identity blocks EBITDA, not supported operating profit.
- `profit-evidence-reader.mjs`: disposable server-side projection of the proposed private records and existing source amounts, inside a repeatable-read read-only transaction. Rechecks line/expense snapshots and source membership; errors affect their dependent components. Expense decimals are read as text before exact minor-unit conversion.
- Proposed private schema: five versioned evidence/coverage tables, append-only/sealed versions, scoped references, no browser grants and no public read RPC. It is validated locally against the recorded staging bootstrap.

The reader requires a trusted transactional verified-sales callback; tests currently supply synthetic evidence through that interface. It is not wired to the existing live RPC and does not establish live merchant collection completeness or independent warehouse-event coverage. Snapshot and manifest validation checks declared evidence; it cannot manufacture source facts.

## Remaining authorised engineering work before database approval

Complete the concrete integration with existing sales evidence, explicit version selection/supersession and controlled source-proof preparation; add a reviewable exact synthetic setup and full reconciliation/replay checks. Reinspect current staging structures and produce a precise preflight/recovery plan. Only then request approval for a named staging database operation. No premature approval is needed to finish those preparation steps.

The app retains the prior verified shared-sales checkpoint. These server/proposal files introduce no active frontend change, so restarting or presenting a changed staging profit screen would be misleading. No new actual contribution or profit figure has been enabled.

## Database-reader regression evidence

The exact proposed SQL was loaded into disposable PGlite against the recorded staging bootstrap. Checks cover restricted access, scope, append-only/sealed evidence, duplicates and excessive returns. Reader tests establish repeatable-read/read-only execution and source decimals read as text.

A synthetic February line with two units at £40 historic cost, followed by an April return of one unit, produces April COGS −£40 and gross profit £40 through stored records and the reader. With £100 overhead entirely identified as D&A, operating profit is −£60 and EBITDA £40. Changing the original line makes COGS unavailable while valid sales/overheads remain. Changing or omitting an expense blocks dependent expenses/profit while preserving valid gross profit. These are isolated synthetic assertions, not staged merchant figures.

Review corrections before the final passing run: added an original-order count/line-manifest sanity check; stopped a bad expense from discarding all cost components; narrowed historical line scope to selected sales and recovery originals; used decimal text for source amount conversion.
