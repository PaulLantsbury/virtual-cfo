# Parallel pilot — proposed scopes

12 September 2026. **Proposed for Paul's agreement; no pilot application changes made.** Two read-only agents reviewed roadmap and implementation to inform these choices. The coordinator checked the cited source. No fresh live-service audit or application test pass is claimed by this planning package.

## A — Financial review: reject impossible transaction dates

Problem: `artifacts/virtual-cfo/src/pages/financial-review.tsx` accepts evidence dates using only a YYYY-MM-DD pattern, then formats them during rendering. An invalid month can throw and an impossible day can normalise to another date. This is a source-identified defect; browser reproduction remains part of implementation.

Proposed behaviour: reject malformed calendar dates before displaying a review packet, using the existing safe error state. Do not correct dates silently or change valid financial results, API contracts or review permissions.

Developer A owns `artifacts/virtual-cfo/src/pages/financial-review.tsx`, any dedicated date helper it needs, and `artifacts/virtual-cfo/tests/review-browser.mjs`. No schema, importer or shared auth changes.

Acceptance: invalid month/day and non-leap February 29 show safe failure, no review/restore controls and no browser page error. Valid leap day and existing sale/refund/zero-value cases remain valid. Run relevant review-browser checks and frontend type checking. Use mocked responses only; no real review submission.

## B — Cash Control: identify sample figures honestly

Problem: `artifacts/virtual-cfo/src/pages/cash-control.tsx` imports fixed cash snapshots and contains fixed balances, rankings, comparisons and diagnoses. A real signed-in user can mistake the model for evidence about their business.

Proposed behaviour: clearly present this page as an illustrative cash model, with prominent wording that actual cash reporting is not connected. Label sample summaries/charts/scenarios and remove or rewrite claims that those examples describe the user's actual cash position, change or recommended action. Keep the existing sample simulator available as an illustration. Do not label a model result financially verified or imply it follows the approved actual-burn runway definition.

Developer B owns `artifacts/virtual-cfo/src/pages/cash-control.tsx` and a dedicated `artifacts/virtual-cfo/tests/cash-control-browser.mjs` if needed. Do not alter shared snapshot values, financial formulas, shared layout, plan entitlements or other pages.

Acceptance: page heading/summary and simulator make sample status clear; sample diagnosis/comparison copy cannot be read as verified business results in current, historical or unavailable reporting states. Inspect desktop/mobile layout and relevant interactions using isolated responses. No new banking/Xero/Shopify connection, data entry, financial policy or database work.

## Review, integration and completion

The third agent reviews changed code and test coverage read-only against both briefs. It can prepare acceptance checks while developers work and inspect final diffs afterward. The coordinator owns shared scripts/docs, resolves file conflicts, runs appropriate combined checks and publishes the routine package to the existing draft branch. Do not merge or deploy.

If work needs new behaviour outside these scopes, bring the concrete choice to Paul. Do not automatically expand into all other financial pages or broader review hardening. Pilot success means two useful, independently verifiable changes with clear documentation and no policy drift, not merely keeping three agents busy.

## Deferred alternatives

The reviews also found Margin Analysis snapshot fallbacks replacing zero/missing values and a gap in delayed-response review regression tests. These are candidates for later packages, not included in this pilot. Transaction-comparison expansion remains paused pending a real reference source.
