# Night Scout — current project brief

Updated 17 September 2026. Paul approved the revised roadmap approach and Metrics and Decision Specification package after reviewing “Compare Sweet Analytics Night Scout”.

## Product and priority

Night Scout is an ecommerce AI CFO: explain what drives profit and cash and what management should do next, with evidence, confidence and financial guardrails. Keep the existing dashboards; strengthen financial depth rather than expanding into attribution, audience building or advertising activation. Sam is a separate personal assistant.

Delivery order: specification update; Shopify-backed CFO journey; Xero reconciliation and Cash Control; Meta/Google and customer economics; forecasting/scenarios and action tracking; reconciled profit visualisation and launch readiness. See [roadmap](roadmap-2026-09-17.md) for dependencies. New naming, financial thresholds, cohort/CAC/payback and forecast assumptions remain decisions rather than implicit approval.

## Current implementation

- React/TypeScript Vite frontend in artifacts/virtual-cfo; API in artifacts/api-server; Supabase Auth/PostgreSQL with store membership.
- Shared scoped sales reporting and historical cost/expense evidence support actual Profit Overview. CFO Briefing and Margin Analysis share its profit report; Verified Sales shares sales definitions and scope.
- Approved synthetic Store D schema/data/membership and subsequent restricted read permissions were applied to staging on 13 September. Three months reconciled; see the [handover](session-handover-2026-09-13.md). Do not reinstall them or re-request their approvals.
- Other pages and Scenario Planner retain sample/prototype content. No claim that every business figure is dynamic or every input complete. Missing evidence must remain unavailable, not zero or guessed.
- Shopify import/connector foundations exist in experiments; no live Shopify feed connected. Xero, operational cash and full customer/marketing/forecast functionality remain unfinished.
- Blue navigation artwork and corrected ear clearance accepted. Public home/authentication logos unchanged.

## Sources of authority

1. Latest explicit Paul decisions, [roadmap](roadmap-2026-09-17.md), [team agreement](team-working-agreement.md).
2. [Approved financial definitions](agreed-financial-definitions.md); distinguish them from proposed extensions in the [metric dictionary](metrics-dictionary-2026-09-17.md).
3. [Dashboard specification](dashboard-decision-spec-2026-09-17.md), [source plan](data-source-plan-2026-09-17.md), dated implementation evidence and current code.
4. Older handovers/specifications are historical or intended requirements. A visible page or a migration file does not prove functionality or deployment.

## Environments and publication

GitHub PaulLantsbury/virtual-cfo, codex/restart-baseline and draft PR #1 are the durable development record. Local preview localhost:3000 depends on this Mac; it is not hosted staging. Last verified Supabase staging project bioalckltvkhlczusdvl; production/original futkktdebdygsdrcknpr unchanged. Recheck runtime before live work; no fresh live audit is claimed by this brief. Main, production and Replit have not been updated by development publication.

Routine authorised code/tests/docs publication and meaningful-package local staging verification can proceed without repeat approval. New database operations/access, accounts/spending, production releases and material financial/product decisions retain their explicit boundaries.

## Preserved deferred decisions

Marketing budget modeller: replace percentage-summing/unsupported 30% cap only after reliable channel inputs and agreed pound-based reallocation effects; do not invent coefficients. Independent source comparisons cannot be certified by synthetic fixtures. Planned Sankey follows validated profitability and Xero reconciliation; waterfall and causal driver attribution need their own evidence. Scenario baseline must eventually use the same authoritative data, with explicit assumptions; sample models are not real forecasts.
