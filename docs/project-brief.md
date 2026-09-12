# Night Scout — current project brief

**Stopped for the day:** Read the [12 September end-of-day checkpoint](end-of-day-2026-09-12.md) first. It records the final state, superseded intermediate work, standing decisions and proposed next steps. No further package is authorised yet.

Page-role clarification: Profit Overview explains the fixed sample profit/cost breakdown; its duplicate simulator has been removed by Paul’s agreement. Scenario Planner alone provides what-if controls. Shared baseline/definitions are unchanged.

Latest completed package: [Profit Overview / Scenario Planner alignment](profit-scenario-alignment.md). Both pages now use the same coherent sample month and calculation model. 51 checks, independent review and local staging verification pass; real financial reporting remains unavailable.

Latest completed package: [Scenario Planner visible impact and corrected sample-month model](scenario-planner-correction.md). This supersedes the earlier preservation of its unvalidated formulas and preset behaviour. 40 checks and local staging verification pass; forecasts and real-source integration remain unfinished.

Updated 12 September 2026. Start here for coordination, then follow the linked evidence. This is a current synthesis, not a fresh audit of deployed services.

## Product

Night Scout is a virtual CFO for commerce businesses: explain financial performance, identify opportunities and recommend useful next actions with supporting evidence. The intended product includes a morning briefing, trading/margin/marketing/pricing analysis, profit and cash reporting, scenario planning, prioritised opportunities and monitoring. A visible page does not mean its calculations or integrations are finished.

Sam is a separate personal AI assistant. Its WhatsApp, Gmail, reminders and Mac Mini services are not Night Scout features or dependencies.

## Authoritative reading order

1. This brief and [team working agreement](team-working-agreement.md): current scope and decision boundaries.
2. [Agreed financial definitions](agreed-financial-definitions.md): approved rules; distinguish approval from implementation.
3. [12 September handover](session-handover-2026-09-12.md) and [integrated staging checkpoint](staging-checkpoint-2026-09-12.md): current local work and staging verification. The [10 September handover](session-handover-2026-09-10.md) remains the earlier baseline.
4. [Restart sprint](restart-sprint.md): chronological implementation evidence. Earlier unchecked items and next steps may be superseded by later entries.
5. [Calculation logic](calculation-logic.md), [Opportunity Engine](opportunity-engine-spec.md), [Recommendation Engine](recommendation-engine.md): intended product. Conflicts and unapproved proposals are in [baseline decisions](baseline-decisions.md).
6. Current code and relevant tests: verify implementation before issuing work. April checklists and the 8 September audit are historical snapshots.

If sources conflict, use Paul's latest explicit agreement for policy, verify implementation in code and take unresolved decisions to Paul. Do not invent a rule to reconcile documents.

## Architecture and working locations

- React/TypeScript frontend under `artifacts/virtual-cfo/`, built with Vite; API under `artifacts/api-server/`.
- Supabase authentication and PostgreSQL data, with store membership and restricted import/review paths in the draft implementation.
- `experiments/financial-v1/`, `experiments/shopify/`, `experiments/staging/` and `db-migrations/` hold calculation, adapter, review, import and database packages. Check callers and handovers: the directory name alone does not establish integration status.
- `experiments/completeness/` contains standalone local comparison tools, not connected application routes or real-source completeness proof.
- GitHub `PaulLantsbury/virtual-cfo`, branch `codex/restart-baseline`, draft PR #1, is the durable development record. Draft publication does not update main, production or Replit automatically.
- Last verified staging project: `bioalckltvkhlczusdvl`; original project: `futkktdebdygsdrcknpr`. Open browser tabs do not prove the active runtime connection. Keep credentials private.

## Delivery status

| Area | Evidence-backed status | Remaining limit |
| --- | --- | --- |
| Financial rules | Core sales/VAT/pre-refund AOV, refund timing, contribution/profit and cash agreed | Listed edge cases and scoring remain open; approval does not certify legacy SQL |
| Access/review | Draft authentication, membership-gated screens and restricted review path; 10 September staging flow checked | No production release claim; no new grants or reviews needed merely to resume |
| Sales/import foundation | Supported synthetic sales/refunds imported; append-only retries checked; evidence-based sales/dashboard path exists in code | Real Shopify connection, operational sync and broader cases incomplete |
| Store C staging | February £90 product sale; March and April each −£20 product refunds; original links retained | All three periods unverified; rechecked 12 September; see integrated staging checkpoint |
| Completeness comparison | Five bounded 12 September packages complete, including offline two-file validation/comparison and review guidance | Synthetic comparisons cannot establish independent real-source completeness |
| CFO features | Dashboard safeguards/trading work exist; other analysis pages and settings contain prototype content | Costs, profit, cash, shared recommendations and monitoring unfinished |
| Release | Changes documented on draft branch | Merge, production and Replit reconciliation need separate preparation and approval |

## Agreed pause

Paul endorsed pausing comparison expansion until a suitable Shopify account/export or another agreed real sales-and-refunds example is available. No new source is confirmed. Do not add synthetic scenarios as a substitute for real integration evidence. Independent approved roadmap work may proceed.

## Remaining roadmap — subject to Paul's priorities

1. Make unfinished screens truthful about available data/actions and address bounded usability or robustness gaps.
2. When a reference source is available, agree mapping and validate real collection/completeness; connect reviewed figures consistently across reporting.
3. Finish Shopify installation, supported data cases and operational synchronisation, with real-account testing when possible.
4. Complete historic costs, returns-to-stock, marketing/operating costs, profit and cash inputs/reporting under agreed definitions.
5. Agree remaining opportunity ranking, overlap, confidence and financial edge cases, then implement the shared engines and monitoring.
6. Complete release checks, reconcile GitHub/Replit and prepare a separately approved production release.

### Deferred: rebuild the marketing budget modeller

Paul agreed to defer this until underlying channel spend and contribution data are connected and validated. The current illustrative model sums percentages of different channel budgets and caps that sum at 30%; the cap has no documented business justification, and the sum is not a valid combined-budget percentage when channel budgets differ.

Delivery order: establish reliable channel spend/contribution inputs; agree the effect of reallocating money, channel limits and uncertainty with Paul; then replace the sample with a model based on actual pounds moved. Resolve both limitations before presenting it as a real planning tool. Do not simply remove the cap or invent replacement coefficients. Keep the current model explicitly illustrative meanwhile. This is a roadmap decision, not approval to implement a new financial model now.

These are workstreams, not a completion percentage or promised delivery date. Work can run in parallel once inputs and decisions are settled.

## Current coordination checkpoint

Paul approved this conversation as the project-management hub with delegated coding/testing. The setup package established shared documentation. Paul subsequently approved both scopes in [parallel pilot](parallel-pilot.md); both are now implemented, independently reviewed and verified in isolated browser tests. See the pilot completion record; production and staging data are unchanged.

The next [Margin Recovery and Monitoring package](reporting-truthfulness-package.md) is complete: source figures are separated from sample margin analysis, Monitoring is explicitly a prototype, and 26 isolated browser checks plus independent review pass. No live financial or deployment change is implied.

The [integrated staging checkpoint](staging-checkpoint-2026-09-12.md) now records the approved local preview against real staging Auth/database. Existing synthetic review periods matched expectations without approving completeness. Stage after every meaningful completed package under the team agreement; production remains separately approved. Paul accepted that walkthrough. The subsequent [Growth/Pricing package](growth-pricing-package.md) is now complete with 55 isolated browser checks, independent review and local staging checks. Next: walkthrough of these two pages. Actual analysis remains unfinished.

Current display names are agreed in [page naming](page-naming.md) and applied consistently across the site. Paul requested leaving the existing Replit setup unchanged for now; no migration away from it is approved.

The [Growth Quality / Profit Overview package](growth-profit-package.md) is complete: 31 isolated browser cases, independent review, frontend checks and current-source local staging checks pass. Both pages keep actual analysis unavailable and separate samples. Next: Paul’s walkthrough of these pages.

## Opportunity and scenario checkpoint

The [Opportunity Finder / Scenario Planner package](opportunity-scenario-package.md) is complete: 22 browser checks, frontend checks and independent review pass; local staging handoff verified. Next: Paul’s walkthrough. Actual recommendations/forecasts remain unavailable.


## Paul’s next priorities — agreed after the end-of-day handover

After the financial-input inventory/mapping, Paul prioritised:

1. One authoritative Supabase dataset feeding every reporting page, with shared metric definitions/calculations and explicit period/store/currency scope. Reconcile figures/results between pages. No hardcoded business amounts/results, invented fallbacks or synthetic values in actual reporting. Missing/incomplete inputs must remain unavailable/incomplete, not zero. Clearly isolated test fixtures may remain for automated testing; approved formula constants are not business results. Scenario assumptions must be explicit and baseline figures sourced from the same underlying data. Define acceptance and implementation scope with Paul before proceeding.
2. Set up the previously discussed Shopify development environment and feed supported Shopify data through that same import/storage/calculation path. Verify orders, discounts, refunds, pagination/retries and reconciliation; do not create a second reporting source or separate page-specific calculations. Exact account/setup requirements remain to be confirmed when that package begins.

This records priorities, not permission to resume work after today’s stop or to create accounts, incur costs, apply migrations, change access or release production. Earlier proposed roadmap ordering is superseded by this instruction.
