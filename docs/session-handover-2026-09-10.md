# Night Scout handover — 10 September 2026

Night Scout is the commerce virtual CFO, separate from Sam. Durable source: PaulLantsbury/virtual-cfo, branch codex/restart-baseline, draft PR #1. Production/main and Replit remain unchanged.

## Current state

- Staging project bioalckltvkhlczusdvl contains synthetic stores A/B/C.
- Dedicated restricted importer and reviewer logins are provisioned. Credentials remain private in ignored local files; never publish or print them.
- Store C has one February sale (GBP 90 product after discount, GBP 18 VAT, GBP 108 payment), a March GBP 24 refund including GBP 4 VAT and an April GBP 24 refund including GBP 4 VAT. Original-order links/event dates are preserved. Two import receipts exist; explicit retries produced no duplicates.
- C February completeness remains false. Existing A/B records and one earlier review audit were preserved through the imports.
- Paul explicitly approved C staging membership/reviewer access. The connected review screen at http://localhost:3000/financial-review successfully showed all three events. The old port-3001 tab is stale. No C completeness review/restoration was submitted.
- Subsequent imports are append-only and require cumulative supported source history. Changed/missing previous financial events are blocked for review. No live Shopify account is available.

## Final work package — awaiting staging approval

March/April separate review candidates and false coverage records are built/tested locally. The selected-period screen summary explicitly shows unverified net product sales; refund-only periods display GBP -20, zero original orders and refund activity. February stays GBP 90. See [exact staging runbook](staging-refund-periods.md) for hash, guards, effects and execution checklist.

Next action is Paul's approval of that bounded staging package. Then apply once, restart the local review preview, prepare March/April through the signed-in screen, verify false completeness/unchanged financial records and audits, document the outcome and stop. Do not submit restoration or mark completeness on Paul's behalf. If deferred overnight, resume from this package without recreating imports or granting access again.

## Verification checkpoint

86 source/import/review tests, six isolated browser groups, two new exact-period-package groups and frontend type checking passed. Earlier standalone PostgreSQL checks passed all 15 cases, including concurrent/interrupted subsequent imports and actual restricted-login runtimes. The new period package was verified in disposable PGlite; do not imply it was already applied remotely or independently run through the standalone PostgreSQL harness.

## Remaining roadmap

Complete independent completeness evidence/review for relevant periods; connect approved figures consistently across reporting; expand supported Shopify cases and operational synchronization; test live Shopify when an account becomes available; finish historic COGS, operating/marketing costs, profit and cash wiring; agree unresolved opportunity/scoring rules before implementation; then complete release checks and a separate production/Replit reconciliation plan.

Paul prefers automatic progression within agreed scope, with concise updates. Pause for genuine product/financial/scope decisions and concrete remote database approvals, not routine implementation/tests/documentation uploads. No extra work package should be started after today's final refund-period checks.
