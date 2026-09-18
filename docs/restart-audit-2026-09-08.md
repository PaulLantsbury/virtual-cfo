# Read-only restart audit — 8 September 2026

## Evidence and baseline

Inspected local source and GitHub main at `2cf59f65982714037e43bbd0554ece2fd81d113f` (14 June 2026), Replit files and Git UI, Supabase metadata/function definitions and aggregate queries, and selected published application flows at https://virtual-c-f-o.replit.app/.

Replit had an unpushed commit `b00e474` (parent `2cf59f6`) adding `calculation-logic.md`, `opportunity-engine-spec.md`, and `recommendation-engine.md` under docs. The three original documents were recovered through the Replit editor during the restart sprint. Their content has been preserved, not silently rewritten to resolve conflicts.

Architecture: pnpm TypeScript workspace, React/Vite frontend, Express API, Supabase analytics functions, generated API packages and Drizzle database package. Some analytics calls are direct from the browser; the opportunities API uses a server credential and a hardcoded demo store.

## Findings

- Extensive page implementation, but static narratives, seeded opportunities and model snapshots coexist with database-backed calculations.
- Published dashboard selected empty May 2026 data when inspected in September. It showed zero sales and a 100% decline, alongside static positive growth copy. The three-month search limit missed April.
- Dashboard headline opportunity range was £0k–£0k while the KPI showed £71k–£109k. They used different database functions and permission paths.
- Login is simulated, plans controlled in browser storage, no store access checks found in inspected analytics functions, public development plan toggle.
- Supabase: 22 tables with RLS enabled and no policies; numerous security-definer functions callable anonymously. RLS alone does not establish tenant isolation.
- One store, 3,841 orders, 30 customers, eight products, six opportunities and no auth users. Latest orders April 2026; consistent with documented demo seeds, not evidence of an operating ingestion pipeline.
- Contribution-margin SQL has no explicit product-cost deduction. Weekly requests do not match monthly overhead/comparison/channel semantics. Runway mixes the latest cash snapshot with current-month overhead.
- Migration ledger contains version-only rows and differs from later repository filenames. Some function definitions include later fixes: missing ledger entries do not prove unapplied SQL. Do not replay migrations blindly.
- No working Shopify/Xero/advertising ingestion, LLM response generation, billing or background monitoring service found. The corresponding UI/specifications are not evidence that these services run.
- Later development focused on UI, free/pro presentation, Opportunity Finder, Profit Launchpad and Monitoring through June.

## Limits

This was read-only. No installations, builds, migrations or changes were performed during the audit. Selected browser flows, not every interaction, were exercised. Historical Replit deployment logs had expired. External commerce/accounting accounts were not inspected. Live migration reconciliation and multi-user isolation tests remain work for the sprint.
