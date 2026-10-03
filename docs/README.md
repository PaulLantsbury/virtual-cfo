> 18 September latest: the first nightly run failed before collection; approved staging correction published successfully at 10:14:45 UTC. Next genuine run expected 19 September 02:00 BST, fixed reporting date 17 September. [Actual evidence](first-overnight-verification-2026-09-18.md). [Historical/daily test preparation](testing-programme-preparation-2026-09-18.md) is local/disposable only; no generator activated. Earlier checkpoints below are historical.

# Night Scout — current starting point, 17 September 2026

- [Xero staging connection-bound bootstrap](xero-staging-connection-bound-bootstrap-2026-09-24.md) — verified least-privilege migration plus owner-only non-retained discovery, same-origin hosted Settings flow, pinned session-pooler support and final retained-bootstrap runbook; production remains untouched.

- [Customer identifier package: applied and live-verified](customer-identity-package-2026-09-17.md) — 22 preparation checks passed; one live observation and unchanged replay verified, financial evidence unchanged.
- [Independent customer identifier review](customer-identity-review-2026-09-17.md)

Start with the [17 September handover](session-handover-2026-09-17.md), [current project brief](project-brief.md), [17 September roadmap](roadmap-2026-09-17.md) and [team working agreement](team-working-agreement.md). Paul approved the revised CFO direction and Package 1 specification work. New financial policies are separately identified in the specification; earlier pending approvals must not be repeated.

## Current position

Shopify development authentication, restricted candidate intake, changed-order/refund detection, unchanged replay, durable sales-sync history, signed-in connection status and separate ID-only customer observations are implemented and staging-verified. Shopify test purchases remain excluded from financial results. Shared supported sales/profit reporting and synthetic pipeline checks exist; broader production reconciliation is not complete. No production/main/Replit release is implied.

Paul has now agreed **one overnight refresh per day at 02:00 in each store's local timezone**, retaining prior supported figures after failed collection and clearly flagging uncertain freshness. The current parallel package prepares the nightly runner, expands independent calculation acceptance checks and specifies the evidence-backed CFO layer. The separate staging cloud worker is now published for the fixed 17 September test period; saved London timezone confirmed, first overnight execution still pending. See [activation evidence](cloud-worker-activation-2026-09-17.md) and [next-run checklist](first-overnight-verification-2026-09-18.md). Repeat/customer economics rules remain later decisions; richer customer analysis does not block reliable sales sync.

## Current package evidence

- [Cloud worker preparation](cloud-worker-preparation-2026-09-17.md) and [deployment runbook](../deployments/nightly-staging/README.md) — bootstrap disabled by default; approved separate staging deployment now published.

- [Cloud-hosted nightly staging plan](cloud-nightly-staging-plan-2026-09-17.md) — Mac-independent direction and cost rationale; superseded by the activation evidence above.

- [Nightly runner and activation boundaries](nightly-sync-2026-09-17.md)
- [Independent calculation acceptance](calculation-acceptance-2026-09-17.md)
- [CFO-layer acceptance requirements](cfo-layer-acceptance-2026-09-17.md)

## Delivery records (earlier wording records the state at that time)

- [Customer identity connection](customer-identity-package-2026-09-17.md): applied minimal private observations and live replay; no contact fields.
- [Durable sync and signed-in status](durable-sync-package-2026-09-17.md): applied, restart-verified history and Settings status.
- [Private operator screen](operator-sync-package-2026-09-17.md): explicit operator collection; not a scheduler.
- [Synthetic reporting verification](synthetic-reporting-package-2026-09-17.md): independent eligible test route and shared-page consistency checks.
- [Change detection and recovery](shopify-recovery-package-2026-09-17.md): changed refund history, retained versions and repeat/recovery checks.
- [Restricted staging intake](shopify-intake-package-2026-09-17.md), [development checkout](shopify-test-order-2026-09-17.md), [initial connection](shopify-live-connection-2026-09-17.md).
- [Application Package 2](package-2-2026-09-17.md), [metric dictionary](metrics-dictionary-2026-09-17.md), [dashboard specification](dashboard-decision-spec-2026-09-17.md), [data-source plan](data-source-plan-2026-09-17.md).

Maintain this index, package evidence and session handover automatically after each completed package; distinguish agreed, prepared, applied and live-verified work. Never publish private credentials or customer identifiers.

The notices below are historical snapshots, not current instructions or blockers.

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

## Opportunity and scenario checkpoint

Latest completed package: [Opportunity Finder / Scenario Planner](opportunity-scenario-package.md), with 22 browser checks and local staging verification.
