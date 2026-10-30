# 12A Implementation phases and acceptance gates

| Phase | Work | Exit evidence |
| --- | --- | --- |
| 1 Evidence and calculations P0 | Metric dictionary, mapped source coverage, shared context, financial fixtures, method exclusion and permissions. | Known-answer tests, reconciliation, missing-data gates and scoped evidence. |
| 2 Final interface P1 | Build all default/expanded pages and selectors from this edition; use data-driven charts and accessible components. | Header parity, exact labels, chart-value agreement, keyboard and responsive checks. |
| 3 Actions and settings P0/P1 | Versioned scenario/action persistence, owners/reviews, guardrails and secured access. | Save/reopen, historical versions, permissions, empty/active/overdue and failure transitions. |
| 4 Monitoring P0/P1 | Real scoped checks, scheduling, consent, queues, retries and delivery logs. | No false all-clear, no duplicate delivery, separated analysis/source/delivery states. |
| 5 Later models P2 | Richer scenario comparison, channel traffic models and separately gated cash forecasts. | New approved data contracts and model-specific validation before release. |

P0 must pass before the affected feature reaches customers. Product owns scope; finance approves definitions and fixtures; engineering owns data, permissions and persistence; design owns comprehension and accessibility. No delivery date or activation is implied by this document.

## Owner comprehension

Show each default state at 1440 × 900 to at least five representative £250k–£5m e-commerce owners. Within ten seconds, at least four should identify what matters, why and the next step. Test the natural mobile journey at 390px separately. Expanded reference pages are judged for useful detail, not first-glance brevity. Record misunderstanding rather than treating visual approval as proof.

## Calculation and interaction tests

Verify both full-precision historical fixtures and scenario fixtures. Cover refunds, returned-stock recovery, zero denominators, incomplete COGS, duplicated events/transfers, overlapping attribution, cohort maturity and late data. Every selector updates labels and values together. Chart geometry must agree with accessible data tables. Test green/amber/red plus neutral comparison states around the configured tolerance.

Check all period presets, custom/unequal ranges, leap dates, timezones and None. Test all planner switch pairs and invalid inputs; inactive assumptions never affect results. Action handoffs preserve snapshot and scope. Saving and reopening reproduces the same version. A permission failure never leaks another business’s values.

## Silence and availability

For each page exercise actionable, verified quiet, missing, stale, failed and sample modes as relevant. Unknown cannot appear as zero or healthy. Critical limitations remain visible when sections close. Monitoring requires completed checks and consent; Settings cannot claim a saved configuration or working invitation before success. Release only supported capabilities to the pilot.

[Back to the design index](README.md)
