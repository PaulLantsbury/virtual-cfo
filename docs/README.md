# Current starting point — 12 September 2026

Read the [current project brief](project-brief.md), [team working agreement](team-working-agreement.md) and [approved parallel pilot](parallel-pilot.md) first. The first pilot is complete, with 31 isolated browser checks passing. The [Margin Recovery and Monitoring package](reporting-truthfulness-package.md) is also complete, with 26 isolated browser checks passing and independent review finished. Real-reference-data comparison work remains paused. The [integrated staging checkpoint](staging-checkpoint-2026-09-12.md) records the latest local staging preview and checks.

The older checkpoint notices below are retained as history. Their “latest”, “next” and “remaining” statements describe the time they were written; use the current brief and dated handovers to resolve later progress.

## Historical checkpoint notices

> Latest local demo: [select, validate and compare two files](../experiments/completeness/local-comparison.html). Use the synthetic reference/imported samples in experiments/completeness/samples. No uploads, database writes or completeness approvals.

> Latest local package: [reference-file format and validator](../experiments/completeness/reference-file-format.md), with valid/faulty JSON samples and local CLI. 18 validator/comparison groups pass; no uploads or completeness approvals.

> Latest demo: [read-only comparison report](../experiments/completeness/comparison-demo.html), with eight selectable synthetic scenarios and side-by-side evidence. Open the downloaded HTML in a browser; no staging connection.

> Latest local prototype: [reference-ledger comparison](../experiments/completeness/README.md) detects transaction-level differences even when totals match. Nine test groups pass; no completeness certification or database integration.

> Latest checkpoint: [12 September handover](session-handover-2026-09-12.md). Review readiness guidance is implemented and tested; no database or financial approval changes.

> End-of-day checkpoint: [10 September handover](session-handover-2026-09-10.md). Final [March/April staging review package](staging-refund-periods.md) is applied and verified. Both refund-only months show -£20; all three C periods remain unverified. Today’s work is complete.

> Latest connected preview: [imported transaction review display](review-transaction-display.md) shows C’s February sale and March/April refunds with VAT, linked orders and out-of-period labels. Paul has approved C staging access; no completeness review submitted.

> Latest staging result: [subsequent-import trial passed](staging-subsequent-import-run.md#actual-staging-execution--10-september-2026). One April refund added to C, explicit retry created no duplicate, original records/A/B/review history unchanged. Completeness remains false.

> Latest local development: [subsequent-import writer verified](subsequent-import-writer.md). Adds new orders/later refunds without overwriting existing records; 85 tests and 14 standalone PostgreSQL checks pass. Staging runtime remains unchanged.

> Latest local development: [subsequent-import preparation](subsequent-import-preparation.md) identifies new events and blocks changed history. Ten new tests pass; the append-only writer remains to be implemented.

> Latest staging result: [bounded first import and retry passed](staging-import-run.md#execution-record--10-september-2026). Store C has one synthetic sale/refund/receipt, false completeness and no user grants. Existing A/B data and review history are unchanged. Dedicated importer login is provisioned; no continuous job or public import endpoint is enabled.

> Latest result: [the positive synthetic review flow passed end to end](staging-review-scenario.md): August restored with an audit; September remains unverified.

> Latest access status: [restricted staging login and selected reviewer are provisioned and the TLS connection is verified](staging-review-access.md). Real-auth screen testing remains.

> Latest status (10 September): the staging review database package is now applied and verified. See [application record](staging-review-package-2026-09-10.md#actual-staging-application--10-september-2026). Runtime login/reviewer provisioning is now complete; end-to-end testing remains.

# Night Scout — project guide

Night Scout is the virtual CFO platform for commerce businesses. Sam is a separate personal assistant and is not part of this repository.

## Start here

[Staging review package — applied and verified](staging-review-package-2026-09-10.md): exact database package, execution record and remaining runtime/reviewer setup.

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
