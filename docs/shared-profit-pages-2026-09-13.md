# Shared profit summaries — 13 September 2026

Paul approved extending the existing verified profit report to CFO Briefing and Margin Analysis. Both pages now call the same authenticated, store/month-scoped `useProfitReporting` hook as Profit Overview. A shared presentation component displays gross profit, contribution, operating profit, EBITDA and the existing supported contribution/operating margins. It performs formatting only; no financial calculations or evidence rules changed.

The briefing summary is outside its sales-ready branch, so independent report readiness controls the profit display. Loading, incomplete costs, missing service and unsupported periods remain explicit. Missing overheads do not erase supported gross profit or contribution. Currency and the shared reporting selection are passed from existing store settings. Margins reuse the report's agreed net-product-plus-net-shipping denominator and remain unavailable when unsupported.

Old blanket profit-unavailable descriptions were removed from CFO Briefing, Margin Analysis and Verified Sales. Cash estimates, automated advice, recovery opportunities and forecasts remain unsupported. Margin Analysis's illustrative recovery models retain their labelled sample inputs and do not become store-specific through this change. Scenario Planner is unchanged.

## Verification

Frontend typecheck passes. Existing Margin Analysis browser regressions pass 4/4, preserving desktop/mobile sample controls and plan gates. Independent shared-profit browser tests pass 16/16: desktop/mobile matching metrics, partial overheads, failed reads, non-month scopes, zero/loss, shared dates, breakdown navigation and sample separation.

Live staging Store D February was checked on CFO Briefing and Margin Analysis: both show gross profit GBP80, contribution GBP60, operating profit GBP35, EBITDA GBP40, contribution margin41.4% and operating margin24.1%, matching the existing report. March Margin Analysis shows gross profit−70 and contribution/operating profit/EBITDA−75, with both margins unavailable. No database writes, grants, credentials, production or Replit changes were needed. Existing local preview updates the page code; no server permissions changed.
