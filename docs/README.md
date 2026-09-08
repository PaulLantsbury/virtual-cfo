# Night Scout — project guide

Night Scout is the virtual CFO platform for commerce businesses. Sam is a separate personal assistant and is not part of this repository.

## Start here

[Agreed financial definitions](agreed-financial-definitions.md) — approved sales/VAT/AOV/refund, contribution/profit/EBITDA and cash rules, implementation status and documentation ownership. Read this before older financial definitions.

1. [Restart sprint and current handover](restart-sprint.md) — what is implemented, what remains and acceptance criteria.
2. [Restart audit, 8 September 2026](restart-audit-2026-09-08.md) — verified baseline and its limits.
3. [Calculation logic](calculation-logic.md), [Opportunity Engine](opportunity-engine-spec.md), [Recommendation Engine](recommendation-engine.md) — original product specifications recovered from Replit.
4. [Baseline decisions](baseline-decisions.md) — reconciliations and proposed decisions; distinguishes implemented behaviour from future work.

## Financial acceptance cases

[Ten worked financial cases](financial-acceptance-cases.md) give synthetic inputs and expected results for the approved definitions. Matching machine-readable fixtures live in `tests/fixtures/financial-acceptance-v1.json`. The isolated [financial prototype](../experiments/financial-v1/README.md) now passes these targets in local Node tests. The current application and Supabase still use the earlier calculations.

## Supabase wiring

[Supabase sales/refund mapping proposal](supabase-sales-mapping-proposal.md) maps inspected raw fields to verified inputs and documents the additive SQL tested locally. It is not applied to Supabase.

[Source adapter and disposable database tests](source-adapter-status.md) records the tested trading/refund/cost adapter and its remaining integration limits.

[Measured trading reconciliation, 8 September](trading-reconciliation-2026-09-08.md) contains 119 source/RPC checks, the current screen wiring map, source completeness findings and a proposed synthetic ledger. Matching current SQL does not certify the financial definition.

[Metric-to-source reconciliation](metric-source-reconciliation.md) records the existing tables, unfinished connections and the next data work package. Current values are test data; database-backed does not mean financially reconciled.

## Supporting documents

- [Number-source audit](number-source-audit.md) and [data-source status map](data-source-status-map.md).
- [Dashboard metric dependency map](dashboard-metric-dependency-map.md).
- [Phase 1 completion checklist](phase1-dashboard-completion-checklist.md).
- [Phase 2 schema plan](phase2-schema-plan.md), [migration plan](phase2a-migration-plan.md), [trend plan](phase2b-trend-intelligence-plan.md).
- [Authentication and store isolation](auth-store-isolation-plan.md).
- [Cloud schema authority](supabase-cloud-schema-authority.md) and [timezone handling](timezone-handling-before-shopify-ingestion.md).

Older checklists describe earlier snapshots, not current completion. Verify claims against code and the inspected database. The three original engine documents describe intended behaviour, not deployed features.

## Working together

GitHub is the durable project record. Replit should use a checkout of these same versioned documents; do not maintain a separate authoritative specification there. Draft-branch changes are not automatically present in Replit or main. Keep sprint progress, decisions, validation and remaining work here rather than relying on chat history. A new task can begin by reading this guide and the sprint handover. Keep individual changes scoped and reviewed; preserve the Replit-only specifications when reconciling branches.
