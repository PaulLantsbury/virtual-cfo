# Handover — New page connections, 20 November 2026

Read [the audit](new-pages-data-links-2026-11-20.md) and [roadmap](roadmap-2026-11-20.md). The isolated source package is prepared and tested, not deployed. It is based on the current website ea10f8e34930e8ca13e995572a4f9a17190751bb; preserve other concurrent work and keep provider branches unchanged.

Only the sidebar pages labelled New are targeted: marketing-efficiency, profit-engine and new-cash-control. Existing original comparison pages remain. Read-only connections reuse the existing authenticated history API, with explicit month/version selection and strict source validation. No API/schema/grant/financial write is needed for this release.

Default connected views preserve the page section framing and show only supported metrics; unavailable figures are yellow with text. The rich original examples remain explicitly available and yellow rather than appearing automatically after a source failure. Cash is not inferred from profit. The standalone demo remains isolated from live infrastructure.

119 focused financial/evidence/cash tests, TypeScript, production frontend build and standalone demo boundary checks pass. Existing build warnings remain. Local desktop and 390px browser review used fixed labelled fixtures; the actual staging history reader independently returned October EBITDA £10,592.05, sales £64,800, gross profit £32,400 and contribution £23,515. New code still needs hosted verification after the website release.

Keep private connection files, credentials and live account metadata out of GitHub. Local UI-review scaffolding is not part of the release. The next live step is the exact website-only staging release followed by signed-in period/version/store/error checks; do not publish provider or daily-feed changes with it.

[Independent daily-feed handover](https://github.com/PaulLantsbury/virtual-cfo/blob/5420b9cea960057e827422c11b479c2d5a23f1bb/docs/session-handover-2026-11-20.md): already enabled, 15 receipts through 19 November, first actual scheduled run still awaiting 21 November verification; no catch-up/reinstallation/retry.


## Visual Plan integration — 20 November 2026

The visual Plan update preserves the reporting-page data-link package in a combined website-only revision. Plan uses explicitly fictional assumptions, standalone impact bars, a reconciled combined EBITDA bridge and 3/6/12 future full-calendar-month paths. AOV replaces discounts as a headline lever; conversion and existing-customer repeat orders are explicit. Historical evidence is separate from the future horizon. No live cohort forecast or source wiring is claimed for Plan. Connected reporting code and feed/provider configuration are preserved.

Next customer design discussion: one Growth & Marketing destination with Acquisition, Conversion and Retention tabs; cohorts are progressive detail under Retention. Audit customer/order history, identity, cohort maturity and session-funnel ingestion before real metrics. Preserve current Marketing in this release. The acquisition-to-future-repeat lag stays parked. See design/v15-plan/README.md for model, checks and limitations.


## Plan comparison chart and simpler navigation — 20 November 2026

Plan now has one planning view plus My Actions. Former Find your focus / Build your plan URLs resolve to the same combined view, retaining saved sample drafts. Impact cards explicitly point to the editable inputs below; each Edit input below link selects the lever and focuses its number field. A return link leads back to the impact/chart section.

The monthly chart now uses only the selected future calendar months. Each month compares the planned EBITDA, unchanged trajectory and complete same-calendar-month prior-year sample actual, with exact actual dates in tooltip/table. The disconnected historical segment and artificial Data gap bucket are removed. An unchanged plan coincides with baseline and is explained in the main view. Target is an optional chart overlay. Prior-year data does not seasonally adjust the baseline. Per-order paths retain their own original order denominators.

Full 3/6-month prior-year comparisons are available in the fixture at this date. The 12-month view explicitly marks October/November 2026 prior-year actuals unavailable because the fixture ends part-way through October; it does not fill partial/missing actuals or break the two future paths. This fixes comparison alignment and presentation without changing the forecast financial model or draft version.

Validation: six new chart alignment/completeness/leap-year/per-order tests and the twelve monthly model/persistence tests passed, with frontend TypeScript. Desktop and real 390px iframe review verified direct input focus, chart updates and no page overflow. Hosted staging build and live comparison are verified at publication. Scope is Plan only; connected reporting, provider services and daily-feed schedules remain unchanged.
