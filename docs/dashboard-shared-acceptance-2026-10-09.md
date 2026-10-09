# Shared dashboard acceptance — 9 October 2026

Paul confirmed, and the coordinator subsequently independently verified across CFO Briefing, Margin Analysis and Profit Overview, the hosted Store D February 2026 results after reporting configuration and TLS certificate correction: sales £140, gross profit £80, contribution after marketing £60, operating profit £35 and EBITDA £40. This verifies the selected fixture period on those three pages, not September/current coverage, other dashboards or recurring refresh.

## Shared reader acceptance

The following exact expected values come from the prepared current synthetic package. Use only its dedicated synthetic store after separate guarded application and authenticated evidence verification. PocketLaunchpad1 Shopify test-order exclusion remains unchanged; do not merge the fixture into that store.

| Page / selected scope | Required supported figures | Required limits |
| --- | --- | --- |
| Dashboard, September 1–30 | Net product sales £960; pre-refund original AOV £80; gross profit £600; contribution after marketing £496; operating profit £466; EBITDA £472 | No unsupported preceding-period comparison if its exact coverage is absent |
| Profit Overview, September 1–30 | Same sales/profit values; COGS £360; shipping £36; variable costs £48; advertising £92; overheads including D&A £30; D&A £6 | Subtotals are not additional deductions; shipping stays outside product AOV |
| Margin Analysis, September 1–30 | Same shared sales/profit values as Dashboard | Detailed sample model remains labelled and is not treated as actual margin decomposition |
| Marketing Efficiency, Growth Quality, Pricing Optimisation, Cash Control, September 1–30 | Shared verified sales: £960 net product sales; £80 original AOV; 12 original orders | Marketing/channel/cohort/pricing/cash model figures remain clearly separate samples |
| All sales reporting pages, October 1–8 | £240 net product sales; £9 net shipping where shown; 3 original orders; £80 original AOV | Monthly profit unavailable: partial month, not zero and no September substitution |
| Any reporting page, full October 1–31 | No supported sales figures for the unsupported exact scope | No invented future activity/coverage; no October profit version |

## Navigation and recovery checks

1. Select the dedicated synthetic store and September's custom range. Compare Dashboard → Margin Analysis → Profit Overview; all must retain store, dates and currency and agree on the shared amounts.
2. Visit the other four sales-context pages; verify their common sales summary agrees. Confirm sample sections do not change into purported actual results merely because a shared summary is populated.
3. Change to October 1–8, then full October; supported sales and unsupported scopes must behave as above. Switch back to September and then to Store D; a previous store's amounts must not flash under the new selection.
4. Empty one custom-date boundary; no financial request may claim the invalid scope. Restore it and verify the other date survives. Close/reopen a reporting page: its same-store draft stays consistent.
5. A profit service 503 must explain service availability independently of source coverage. A known unconfigured endpoint explains that reporting is not enabled; missing sealed evidence explains evidence, not a connection failure. Retry rechecks the same read scope and does not run collection or change data.
6. Invalid JSON/HTML from a gateway and transport failures must produce bounded explanations rather than raw diagnostics. Missing figures remain unavailable; retries cannot introduce zeros or sample values.
7. Confirm completed month/week presets follow store-local dates. Monthly profit must not be requested for an incomplete or weekly scope.

## Evidence limits

- Store D February has both user-reported and coordinator-observed authenticated live evidence on three shared financial pages. Current September/October fixture arithmetic is independently disposable-database tested, not evidence of current hosted application.
- Shared browser acceptance scripts exist under `artifacts/virtual-cfo/tests/`; browser execution was blocked in this environment by missing Chromium and failed downloads. No loopback browser pass is claimed.
- This package improves explanations and safe read recovery. It does not enable data generation, alter financial definitions, publish a release or grant database access.
