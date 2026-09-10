# Night Scout handover — 10 September 2026

Night Scout is the commerce virtual CFO, separate from Sam. Durable source: PaulLantsbury/virtual-cfo, branch codex/restart-baseline, draft PR #1. Production/main and Replit remain unchanged.

## Current state

- Staging project bioalckltvkhlczusdvl contains synthetic stores A/B/C.
- Dedicated restricted importer and reviewer logins are provisioned. Credentials remain private in ignored local files; never publish or print them.
- Store C has one February sale (GBP 90 product after discount, GBP 18 VAT, GBP 108 payment), a March GBP 24 refund including GBP 4 VAT and an April GBP 24 refund including GBP 4 VAT. Original-order links/event dates are preserved. Two import receipts exist; explicit retries produced no duplicates.
- C February completeness remains false. Existing A/B records and one earlier review audit were preserved through the imports.
- Paul explicitly approved C staging membership/reviewer access. The connected review screen at http://localhost:3000/financial-review successfully showed all three events. The old port-3001 tab is stale. No C completeness review/restoration was submitted.
- Subsequent imports are append-only and require cumulative supported source history. Changed/missing previous financial events are blocked for review. No live Shopify account is available.

## Final work package — complete; stopping point

March/April separate review candidates and false coverage records are now applied to staging with explicit approval. Verified both in the real signed-in screen: each shows GBP -20, zero original orders and refund-only activity. February remains GBP 90 with one order. All three months remain unverified. Existing financial rows, receipts, source versions and prior coverage were preserved, and review audit count remains one. See [execution record](staging-refund-periods.md#actual-staging-execution--10-september-2026).

Today's final package is complete. Do not recreate imports, reapply the guarded package, grant access again or submit completeness restoration. The connected preview remains at http://localhost:3000/financial-review, last checked on C/February. On resumption, review this handover and agree the next work package: independent completeness evidence and the path from reviewed figures into reporting remain open. No further work should start today.

## Verification checkpoint

86 source/import/review tests, six isolated browser groups, two new exact-period-package groups and frontend type checking passed. Earlier standalone PostgreSQL checks passed all 15 cases, including concurrent/interrupted subsequent imports and actual restricted-login runtimes. The period package was verified in disposable PGlite and then applied/checked on actual staging; it was not separately run through the standalone PostgreSQL harness.

## Remaining roadmap

Complete independent completeness evidence/review for relevant periods; connect approved figures consistently across reporting; expand supported Shopify cases and operational synchronization; test live Shopify when an account becomes available; finish historic COGS, operating/marketing costs, profit and cash wiring; agree unresolved opportunity/scoring rules before implementation; then complete release checks and a separate production/Replit reconciliation plan.

Paul prefers automatic progression within agreed scope, with concise updates. Pause for genuine product/financial/scope decisions and concrete remote database approvals, not routine implementation/tests/documentation uploads. No extra work package should be started after today's final refund-period checks.
