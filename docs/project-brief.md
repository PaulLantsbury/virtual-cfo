# Night Scout — current project brief

Updated 12 September 2026. Start here for coordination, then follow the linked evidence. This is a current synthesis, not a fresh audit of deployed services.

## Product

Night Scout is a virtual CFO for commerce businesses: explain financial performance, identify opportunities and recommend useful next actions with supporting evidence. The intended product includes a morning briefing, trading/margin/marketing/pricing analysis, profit and cash reporting, scenario planning, prioritised opportunities and monitoring. A visible page does not mean its calculations or integrations are finished.

Sam is a separate personal AI assistant. Its WhatsApp, Gmail, reminders and Mac Mini services are not Night Scout features or dependencies.

## Authoritative reading order

1. This brief and [team working agreement](team-working-agreement.md): current scope and decision boundaries.
2. [Agreed financial definitions](agreed-financial-definitions.md): approved rules; distinguish approval from implementation.
3. [12 September handover](session-handover-2026-09-12.md) and [10 September handover](session-handover-2026-09-10.md): latest local work and last verified staging baseline respectively.
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
| Store C staging | February £90 product sale; March and April each −£20 product refunds; original links retained | All three periods unverified; last checked 10 September, not rechecked for this brief |
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

These are workstreams, not a completion percentage or promised delivery date. Work can run in parallel once inputs and decisions are settled.

## Current coordination checkpoint

Paul approved this conversation as the project-management hub with delegated coding/testing. The setup package established shared documentation. Paul subsequently approved both scopes in [parallel pilot](parallel-pilot.md); both are now implemented, independently reviewed and verified in isolated browser tests. See the pilot completion record; production and staging data are unchanged.
