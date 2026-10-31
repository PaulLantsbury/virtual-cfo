# Dashboard test-data audit and bounded preparation — 9 October 2026

Status: local preparation, not live application. Repository evidence confirms that ongoing Shopify generation and the large historical staging package were prepared, not activated. No live database/source writes, grants, credentials, scheduled jobs or publication were performed by this work package.

A later opt-in [current-period package](current-dashboard-test-package-2026-10-09.md) now prepares complete September 2026 profit and October 1–8 sales locally. The historical limitations below describe the original default fixture; neither package has been applied live.

## What the existing fixtures can populate

| Route | Selection | Supported checks | Limits |
| --- | --- | --- | --- |
| Historical direct synthetic ledger | Proposed separate “Staging Synthetic Historical Store”, reserved UUID `90000000-0000-4000-8000-000000000007`; August 2025–August 2026 complete months | Verified Sales, Profit Overview, Margin Analysis and CFO Briefing shared sales/profit inputs | Not Shopify/Xero source collection; full page functionality and CFO prose still require their own verification |
| Historical partial period | Same proposed store; 1–17 September 2026, matched 2025 sales period | £480 September net product sales; missing monthly profit handled honestly | Full 1–30 September lacks exact coverage; no sealed September profit |
| Shopify development source | PocketLaunchpad1; explicitly collected/reviewed scope | Authentication, pagination, original/refund capture, unchanged replay and failure recovery | Test orders are excluded from eligible financial reporting; ten more test orders do not produce eligible sales |
| Disabled daily synthetic plan | Explicit store identifier and explicit Monday; 14 days | Ten planned original orders, four planned refunds, four no-change days; independent weekly sales oracle | Semantic plan only; no writer, source API or scheduler; no daily profit assertion |
| Xero staging source | Exact store/tenant, saved mapping version and exact report scope | Independent accounting P&L and mapped bank evidence where supported | Historical Shopify ledger supplies no Xero evidence; need actual saved evidence and deliberate test-tenant transactions |

Marketing/CAC/ROAS, customer lifetime/repeat economics, cash/runway, inventory opportunities and scenario outputs are not made trustworthy by installing the sales/profit ledger. They need their own supported inputs and agreed definitions. Missing inputs must not become zero or fabricated customer results.

For a populated first walkthrough, use **August 2026** on the proposed historical store after separate approved application: net product sales £960 and operating profit £466. Preserve February (£460 sales/£197 operating profit), March (£690/£308) and April (£15 independent cost recovery/£357 operating profit) for regression. Selecting current October or complete September on this historical-only store remains deliberately unsupported.

## Reproducible review artifacts

`experiments/financial-v1/prepare-dashboard-test-package.mjs` reuses the existing historical SQL generator and daily planner. It requires an explicit existing approved synthetic reviewer UUID, explicit Monday and empty output directory. It has no network/database/source execution adapter, refuses existing output, and produces five guarded SQL files, historical hashes/counts and a disabled daily plan. No fixture identity is a valid live reviewer selection.

Preparation command (substitute the independently verified existing reviewer; choose the Monday only after reviewing the activation package):

```sh
node experiments/financial-v1/prepare-dashboard-test-package.mjs EXISTING_APPROVED_REVIEWER_UUID EXPLICIT_MONDAY EMPTY_OUTPUT_DIRECTORY
```

The October 12–25 plan generated in scratch for local inspection is **illustrative only**, not an agreed start or scheduled programme; final collection is October 26. It uses the existing synthetic-financial route and cannot populate live pages. The generated historical schema contract remains the disposable bootstrap contract, not a statement of live schema compatibility.

## Gates remaining before a concrete live application

1. Independently verify the hosted frontend's selected store UUID, Supabase project, authenticated memberships and exact requested period. A visible name alone cannot prove the backend selection. Read the actual endpoints/errors and exact coverage before recommending a store switch.
2. Retrieve least-privilege read-only staging schema metadata and validate the actual reviewer. The 18 September record found 95 visible constraints/10 triggers versus the disposable bootstrap's 221 constraints/5 triggers, with incomplete column visibility. That remains an **unresolved recorded compatibility gate**; no current inspection here proves that it still differs or now agrees. Reconcile the disposable fixture to inspected deployed DDL; never weaken the strict contract or add grants automatically.
3. Generate the reviewer-bound package against the reconciled contract. Present exact counts/hashes, vacant target and preflight result together. Applying/rehearsing staging SQL requires the separate approval in AGENTS; current preparation does not supply that approval.
4. Apply once only after that approval, verify 13 complete profit months and partial sales through authenticated readers, compare unrelated store fingerprints, then verify actual hosted pages. Do not replay an uncertain commit.
5. Separately prepare bounded daily source API/capacity/idempotency/recovery checks and the exact disabled-to-enabled worker change. Keep 31 completed London dates consistent through config/reservation/journal/intake/receipt. Historical fixture data and recurring source writes are distinct packages.
6. For Xero, verify saved supported evidence, account mapping and coverage first. Prepare test-tenant-only original postings and expected reports without blending Shopify values or inferring cash account eligibility. No Xero transaction generator is delivered here.

See [historical package](historical-staging-package-2026-09-18.md), [daily preparation](testing-programme-preparation-2026-09-18.md), [agreed definitions](agreed-financial-definitions.md) and [current roadmap](roadmap-2026-09-17.md). Detailed dashboard redesign follows working, verified current dashboards.

## Validation

Local preparation generated all seven files and the existing 912-row guarded package using a disposable reviewer fixture only. Manifest SHA-256: `c74a58e529e9fa7daceb5b16c9345a9c82385cc8ff9aa26573e74e97d7742e6a`; disposable schema SHA-256: `c75f98ba556cd0ba42c8170e72ab666ba4c58998a034b3b20a457707b53cd175`. Reviewer-bound SQL hash is intentionally not presented as live authority. All **21 focused checks passed**: historical SQL deterministic preparation/rehearsal/application/guards, immutable historical profit, disabled daily plans and London rolling scopes. The first run was blocked by the missing PGlite dependency; the integrating batch installed the frozen-lockfile dependencies and the rerun passed.
