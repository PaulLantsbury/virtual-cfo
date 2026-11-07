# Dashboard recovery batch — 9 October 2026

## Findings and changes

The hosted app omitted the existing `/api/profit-reporting` router and did not pass the already available trusted `runtime.profitService`. The app now mounts it before SPA fallback, returning explicit no-store 503 when disabled, and startup injects the existing service only through the original opt-in review runtime. No new credential role, permissions, source writes or financial calculations are introduced.

Shared frontend reporting now distinguishes exact-period coverage gaps, source review, access/sign-in failures and reporting endpoint failures, and permits an explicit reread of sales evidence. Missing amounts remain unavailable. Xero discovery selection adds code/name search, selected-account persistence while filtering, exclusivity explanations and a review summary. Saved mapping editing is still unfinished.

See [test-data package](dashboard-test-data-2026-10-09.md) and [Xero mapping audit](xero-mapping-usability-review-2026-10-09.md). Current Shopify profit dashboards use the verified trading/cost evidence path, not Xero snapshot totals. Xero accounting view wiring remains distinct work.

## Verification

- 14 API/profit/startup/SPA checks passed after fixing test bundling; includes actual hosted app composition, independent fixture amounts, missing costs, forged/anonymous/cross-store rejection and RLS/no-write tests.
- 21 historical/daily planning/disposable SQL checks passed; guarded local generator smoke passed and occupied output refused.
- Two frontend availability tests passed; frontend typecheck passed.
- 13 existing Xero discovery/readiness/API boundary tests passed.
- API build and frontend build passed. Existing frontend sourcemap/chunk warnings remain.
- API typecheck remains blocked by pre-existing missing declarations for historical Xero experiment imports and unbuilt workspace declaration outputs. Do not present this as a clean repository-wide typecheck.
- Five synthetic browser acceptance checks are written but blocked because no local Chromium executable is installed; the attempted official Playwright download returned truncated archives. New mapping controls are source/type checked, not browser verified.
- Independent integrated review found no material regression.

## Live evidence and next concrete operations

Secure staging sign-in and an authenticated Settings walkthrough completed after the initial code batch. Private account/store/collection/evidence metadata is deliberately excluded from this public handover. This session still has no server configuration access or authenticated database session. No schema compatibility or deployment of this batch is claimed. Render blueprint disables automatic deployment; development-branch publication alone is not a deployment.

1. Reuse the authenticated staging session where available; verify reporting responses and known fixture periods after deployment. Signed-in Settings was inspected, but financial amounts were not certified in this batch.
2. Inspect existing Render review configuration names without printing values. Profit uses existing `NIGHT_SCOUT_REVIEW_ENABLED`, `NIGHT_SCOUT_REVIEW_PROJECT_REF`, `NIGHT_SCOUT_REVIEW_AUTH_URL`, `NIGHT_SCOUT_REVIEW_PUBLIC_KEY`, `NIGHT_SCOUT_REVIEW_DATABASE_URL` and the dedicated restricted review login. Do not substitute Xero bootstrap/worker or generic admin credentials. Missing configuration requires the reviewed server setup before endpoint success.
3. Deploy the reviewed web revision to the existing staging service under a concrete approval; preserve production and disabled fixed-period worker settings. Verify health, authenticated route, membership denial and browser behavior.
4. Read-only inspect current schema/reviewer/store state before generating reviewer-bound test artifacts. Historical package remains blocked until deployed schema matches; do not apply the fixture reviewer or bypass the guard. Then present exact staging dataset/membership and application steps for the separate approval.
5. Select the explicitly synthetic historical store and August 2026 for known nonzero figures once applied/verified. Full September and current October are not covered by the existing historical package; prepare additional evidence rather than marking partial coverage complete. Recurring source generation needs its separate bounded execution adapter and activation.

No migrations, data seeding, source consent, paid capacity, hosted deployment or recurring generator was activated in this batch.
