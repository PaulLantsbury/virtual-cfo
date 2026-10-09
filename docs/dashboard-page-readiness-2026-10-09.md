# Dashboard page readiness — 9 October 2026

This is a source inspection of `codex/restart-baseline`, not a claim that each hosted page has passed live customer testing. Preserve the distinction between imported records, verified sales coverage, sealed profit evidence and Xero accounting snapshots.

## Current page connections

| Page / route | Actual selected-store inputs already wired | Still illustrative or unavailable |
| --- | --- | --- |
| CFO dashboard `/dashboard` | Shared verified sales, previous completed period where supported, monthly profit summary and evidence-based profit observations | Cash runway, recovery estimates, automated monitoring and wider CFO advice |
| Profit Overview `/profit-engine` | Same selected-store monthly profit report; sales/cost bridge, independent subtotal availability | Scenario baseline and forecasts; Xero summary P&L is a separate reporting contract |
| Margin Analysis `/margin-analysis` | Shared verified sales and monthly profit summary | Detailed sample margin model, causal diagnoses, sample cost levers and recovery forecast |
| Marketing Efficiency `/marketing-efficiency` | Shared verified sales context | Channel spend, CAC/ROAS, channel diagnoses and simulator use samples; no actual ad-source ingestion here |
| Growth Quality `/growth-quality` | Shared verified sales context | Cohorts, repeat/customer economics, scores, trends and recovery estimates use samples |
| Pricing Optimisation `/pricing-optimisation` | Shared verified sales context | Product/channel elasticity, discount recommendations and simulator use samples |
| Cash Control `/cash-control` | Shared verified sales context; separate Xero readiness may describe connection state | Actual unrestricted dated balances, reconciled cash movement and burn/runway are not connected by the sales hook; visible cash model remains illustrative |
| Opportunity Finder `/opportunities`, `/profit-opportunities` | No actual store opportunity feed | Fixed examples; scoring/combined benefit not validated for real recommendations |
| Scenario Planner `/scenario-lab` | No actual store scenario baseline | Separate explicitly labelled sample month; saving, comparison and forecasts unavailable |
| Monitoring `/monitoring`, `/cfo-alerts` | No activated monitoring result feed | Do not equate page existence with working background monitoring |
| Financial Review `/financial-review` | Authenticated review workflow for the selected store | It is evidence review, not certification that all store periods are complete |
| Verified Sales `/verified-sales` | Shared verified sales | Development-only route; production builds do not expose it |
| `/dashboard/transactions` | Currently aliases Dashboard | It is not a transaction drill-down screen |

The same `useSalesReporting` hook is used on all seven sales-reporting pages. Only Dashboard, Profit Overview and Margin Analysis use `useProfitReporting`. Populating verified evidence can make their wired sections useful; it cannot turn the other sample analyses into store results.

## Scope and date behaviour

- Each selected store has its own persisted reporting preference. Supported figures are accepted only for matching store, currency and exact date range; no previous month is silently substituted.
- Completed week/month selection uses the store timezone. Monthly profit requires exactly one full calendar month. Weekly/custom partial-period sales do not automatically support monthly profit.
- Invalid, incomplete or corrupted custom date drafts intentionally withhold results. The UI's From and To edits now merge against the latest draft rather than a render's captured opposite boundary, preventing closely spaced edits from overwriting each other.
- A hosted automation attempt displayed filled date fields while controlled reporting state stayed blank. Source review found the stale-boundary race above, but does not prove it caused that observation. DOM value changes without the appropriate input event can also bypass React. Native browser verification remains required.

## Current recovery controls

The shared period panel explains exact coverage missing, source-review requirements, unavailable settings and failed requests. Its retry button rechecks sales/settings without changing financial records or completeness.

Dashboard, Margin Analysis and Profit Overview now expose a separate profit-evidence retry when the selected full month is eligible but has no usable report. It retries only the authenticated read. It does not trigger Xero refresh, consent, mapping changes or sealed-evidence creation.

The first batch corrected the hosted API composition to mount `/api/profit-reporting`; the existing trusted review runtime supplies its service. An unconfigured deployment still returns 503. Configuration, restricted grants and sealed evidence must be verified separately before claiming hosted profit reporting works.

## Verification for this frontend package

- Nine focused reporting/date tests passed, including consecutive boundary edits, invalid drafts, exact-coverage and bounded HTTP errors.
- Frontend typecheck passed.
- Loopback browser tests are prepared but unexecuted: Chromium is unavailable and its download failed. Do not label the date-selection changes browser-verified.

Next: confirm hosted deployment/configuration and selected-store coverage, activate only the approved synthetic evidence package after its separate application review, then run shared-page acceptance tests against known expected values before Paul's detailed dashboard revisions.
