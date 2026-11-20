## Full connections implementation — 20 November 2026

[Next website batch](new-pages-full-connections-batch-2026-11-20.md) is implemented and locally tested, not deployed. Profit now has reviewed monthly trends, weighted comparisons and full-breakdown/rate deltas. Marketing has reviewed financial trends, break-even/targets and explicit-baseline financial scenarios. Cash has a separate reviewed EBITDA history; cash balances/movements still require source data. The verified synthetic company has no cash snapshots. Prepared cash adapters/builders do not count as a live connection.

Next: publish the exact tested source and website-only release package, obtain hosted release approval, then verify real staging inputs and history latency. Separate follow-on packages cover synthetic cash and acquisition sources. Daily feed/provider/production settings are unchanged. Earlier released notices describe the current website, not this prepared batch.

---

## Full figure audit — 20 November 2026

The comprehensive [New pages figure and calculation audit](https://github.com/PaulLantsbury/virtual-cfo/blob/codex/new-pages-data-links-20261120/docs/full-figure-lineage-audit-2026-11-20.md) covers all three New pages, including expanded charts/tables, comparisons, scenarios and saved local records. It traces deployed source `a77e65822345087aa708fad19c98bbf3e9a73b21`. The earlier 4-of-13 gap count covered headline cards only; it was not a full-page count.

A figure derived on the server or in the browser from verified database inputs is connected; it does not require its own stored database cell. User assumptions are separate labelled inputs. Sample baselines remain examples even where their arithmetic works.

Next batch, in order: wire eligible multi-month financial trends/comparisons to existing reviewed monthly inputs; define and connect missing cash balance/movement and customer/acquisition inputs; then update sample planners to use verified baselines while retaining explicit assumptions. Do not infer daily/weekly data by dividing monthly totals. Maintain yellow example/unsupported indicators and unavailable states for missing evidence. See the three page registers for individual formulas, sources and required work.

This checkpoint publishes documentation only. Website release, database permissions, provider jobs and daily-feed settings are unchanged. The first unattended daily publication remains a separate verification milestone.

---

**Released and hosted-verified — 20 November:** Approved website revision **a77e65822345087aa708fad19c98bbf3e9a73b21** is live on existing staging. October Profit/Marketing figures match reviewed history; per-order and explicit earlier-month comparison work. Unsupported cash/acquisition/forecast figures remain yellow or explicit sample. New Plan is preserved. [Hosted verification](new-pages-hosted-verification-2026-11-20.md). Daily feed unchanged; first genuine scheduled receipt still awaits 21 November.

# Handover — New page connections, 20 November 2026

Read [the audit](new-pages-data-links-2026-11-20.md) and [roadmap](roadmap-2026-11-20.md). The isolated source package is released and hosted-verified. It is based on the current website ea10f8e34930e8ca13e995572a4f9a17190751bb; preserve other concurrent work and keep provider branches unchanged.

Only the sidebar pages labelled New are targeted: marketing-efficiency, profit-engine and new-cash-control. Existing original comparison pages remain. Read-only connections reuse the existing authenticated history API, with explicit month/version selection and strict source validation. No API/schema/grant/financial write is needed for this release.

Default connected views preserve the page section framing and show only supported metrics; unavailable figures are yellow with text. The rich original examples remain explicitly available and yellow rather than appearing automatically after a source failure. Cash is not inferred from profit. The standalone demo remains isolated from live infrastructure.

119 focused financial/evidence/cash tests, TypeScript, production frontend build and standalone demo boundary checks pass. Existing build warnings remain. Local desktop and 390px browser review used fixed labelled fixtures; the actual staging history reader independently returned October EBITDA £10,592.05, sales £64,800, gross profit £32,400 and contribution £23,515. New code is now hosted-verified; see the dedicated verification record.

Keep private connection files, credentials and live account metadata out of GitHub. Local UI-review scaffolding is not part of the release. The approved website-only release and signed-in checks are complete. Next prepare the missing cash/acquisition evidence and verify the first genuine scheduled daily receipt. Do not repeat the website release or publish provider/daily-feed changes as part of this completed package.

[Independent daily-feed handover](https://github.com/PaulLantsbury/virtual-cfo/blob/5420b9cea960057e827422c11b479c2d5a23f1bb/docs/session-handover-2026-11-20.md): already enabled, 15 receipts through 19 November, first actual scheduled run still awaiting 21 November verification; no catch-up/reinstallation/retry.


## Visual Plan integration — 20 November 2026

The visual Plan update preserves the reporting-page data-link package in a combined website-only revision. Plan uses explicitly fictional assumptions, standalone impact bars, a reconciled combined EBITDA bridge and 3/6/12 future full-calendar-month paths. AOV replaces discounts as a headline lever; conversion and existing-customer repeat orders are explicit. Historical evidence is separate from the future horizon. No live cohort forecast or source wiring is claimed for Plan. Connected reporting code and feed/provider configuration are preserved.

Next customer design discussion: one Growth & Marketing destination with Acquisition, Conversion and Retention tabs; cohorts are progressive detail under Retention. Audit customer/order history, identity, cohort maturity and session-funnel ingestion before real metrics. Preserve current Marketing in this release. The acquisition-to-future-repeat lag stays parked. See design/v15-plan/README.md for model, checks and limitations.


## Plan comparison chart and simpler navigation — 20 November 2026

Plan now has one planning view plus My Actions. Former Find your focus / Build your plan URLs resolve to the same combined view, retaining saved sample drafts. Impact cards explicitly point to the editable inputs below; each Edit input below link selects the lever and focuses its number field. A return link leads back to the impact/chart section.

The monthly chart now uses only the selected future calendar months. Each month compares the planned EBITDA, unchanged trajectory and complete same-calendar-month prior-year sample actual, with exact actual dates in tooltip/table. The disconnected historical segment and artificial Data gap bucket are removed. An unchanged plan coincides with baseline and is explained in the main view. Target is an optional chart overlay. Prior-year data does not seasonally adjust the baseline. Per-order paths retain their own original order denominators.

Full 3/6-month prior-year comparisons are available in the fixture at this date. The 12-month view explicitly marks October/November 2026 prior-year actuals unavailable because the fixture ends part-way through October; it does not fill partial/missing actuals or break the two future paths. This fixes comparison alignment and presentation without changing the forecast financial model or draft version.

Validation: six new chart alignment/completeness/leap-year/per-order tests and the twelve monthly model/persistence tests passed, with frontend TypeScript. Desktop and real 390px iframe review verified direct input focus, chart updates and no page overflow. Hosted staging build and live comparison are verified at publication. Scope is Plan only; connected reporting, provider services and daily-feed schedules remain unchanged.


## Marketing growth duplicate — 20 November 2026

Preserved Marketing Efficiency at /marketing-efficiency with the New prefix removed. Added temporary New Marketing at /new-marketing with Acquisition, Conversion and Retention tabs, shared context, four numbered blue sections per tab, visual diagnosis and Explore the Numbers. Existing reviewed monthly financials are reused read-only; missing customer/funnel/cohort measures stay explicitly unavailable. Fictional design requires an explicit switch. Product AOV follows the agreed original-sales definition; mature cohorts retain separate observation windows. Plan and provider/feed work are preserved. See design/v16-marketing-growth/README.md for scope, definitions and remaining data acceptance. TypeScript and eleven calculation tests passed; mobile width checked at 390px. Customer identity/funnel ingestion and acquisition-to-future-repeat forecasting remain pending, not claimed connected.

