# Night Scout — project guide

Night Scout is the virtual CFO platform for commerce businesses. Sam is a separate personal assistant and is not part of this repository.

## Start here

1. [Restart sprint and current handover](restart-sprint.md) — what is implemented, what remains and acceptance criteria.
2. [Restart audit, 8 September 2026](restart-audit-2026-09-08.md) — verified baseline and its limits.
3. [Calculation logic](calculation-logic.md), [Opportunity Engine](opportunity-engine-spec.md), [Recommendation Engine](recommendation-engine.md) — original product specifications recovered from Replit.
4. [Baseline decisions](baseline-decisions.md) — reconciliations and proposed decisions; distinguishes implemented behaviour from future work.

## Supabase wiring

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

Use this repository as the durable project record. Keep sprint progress, decisions, validation and remaining work here rather than relying on chat history. A new task can begin by reading this guide and the sprint handover. Keep individual changes scoped and reviewed; preserve the Replit-only specifications when reconciling branches.
