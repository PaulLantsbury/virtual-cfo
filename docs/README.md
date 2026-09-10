# Night Scout — project guide

Night Scout is the virtual CFO platform for commerce businesses. Sam is a separate personal assistant and is not part of this repository.

## Start here

[Latest checkpoint — reviewer screen and API startup](review-screen-startup.md): default-off runtime integration, protected review page and next staging preparation.

[Latest 10 September checkpoint — review server runtime](review-server-runtime.md): checked connection configuration, restricted pool and next enablement/UI work.

[Latest 10 September checkpoint — review HTTP integration](review-http-integration.md): tested request boundary, disabled live route and remaining client/pool configuration.

[10 September progress — review service permissions](review-service-permissions.md): current checkpoint and next integration work after the saved 9 September stopping point.

[Latest stopping point — 9 September 2026](session-handover-2026-09-09.md): today’s achievements, exact resume point, deployment boundaries and remaining product roadmap. This supersedes older next-session instructions.

[Agreed financial definitions](agreed-financial-definitions.md) — approved sales/VAT/AOV/refund, contribution/profit/EBITDA and cash rules, implementation status and documentation ownership. Read this before older financial definitions.

1. [Local sign-in handover](local-auth-handover.md) — implemented SDK sessions and membership-gated pages, mocked verification and next-session staging steps.
2. [Restart sprint and current handover](restart-sprint.md) — what is implemented, what remains and acceptance criteria.
3. [Restart audit, 8 September 2026](restart-audit-2026-09-08.md) — verified baseline and its limits.
4. [Calculation logic](calculation-logic.md), [Opportunity Engine](opportunity-engine-spec.md), [Recommendation Engine](recommendation-engine.md) — original product specifications recovered from Replit.
5. [Baseline decisions](baseline-decisions.md) — reconciliations and proposed decisions; distinguishes implemented behaviour from future work.

## Financial acceptance cases

[Ten worked financial cases](financial-acceptance-cases.md) give synthetic inputs and expected results for the approved definitions. Matching machine-readable fixtures live in `tests/fixtures/financial-acceptance-v1.json`. The isolated [financial prototype](../experiments/financial-v1/README.md) now passes these targets in local Node tests. The current application and Supabase still use the earlier calculations.

## Supabase wiring

[Staging setup, 9 September](staging-setup-2026-09-09.md) — verified new empty staging target and atomic, locally tested setup script applied and verified on staging.

[Authentication and store isolation](auth-store-isolation-plan.md) — access gap reproduced, membership/RLS proposal tested locally, and privileged public proxy disabled in the draft. Real gateway verification remains pending; the local SDK sign-in flow is now implemented.

[Recoverable contribution correction](recoverable-contribution-correction.md) — locally tested separation of monthly contribution from cash/other impacts; not deployed.

[Migration history reconciliation](migration-history-reconciliation.md) — all 25 recorded versions recovered, later changes compared, and observed public schema rebuilt locally. Live ledger repair remains pending.

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
