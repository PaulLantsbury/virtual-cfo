# New pages: data connections and yellow markers — 20 November 2026

## Scope and status

Prepared and tested; **not deployed yet**. Base is the existing website revision d721c473b1a595f0196035fb48fbe51473123e45, preserving the rewritten pages and their navigation. This is separate from the synthetic daily-feed runtime and its development branch.

The reviewed targets are the sidebar entries **New Marketing Efficiency** (`/marketing-efficiency`), **New Profit Engine** (`/profit-engine`; `/new-profit` redirects here), and **New Cash Control** (`/new-cash-control`). The original marketing/cash comparison pages are not substituted for these targets.

Before this change, the three main designs used fixed local examples. Changing their controls recalculated those examples; it did not connect their cards/charts to the selected store's database records. Marketing's collapsed legacy source panel was separate from its example calculation scope.

## Result and remaining gaps

| Page | Connected in this release | Yellow / unavailable or explicit sample |
| --- | --- | --- |
| New Profit Engine | Reviewed month and evidence version; sales, original orders, product costs, variable costs, advertising, shipping, gross profit, contribution after marketing, overheads, D&A, EBITDA, operating profit, margins, AOV and per-order figures. Complete reconciled evidence drives the Sankey. A separately selected earlier reviewed month/version drives comparisons and the change bridge. | Weekly and multi-month trends, automatic rolling comparisons, product/staff diagnosis, action rankings and estimated benefits, reminders and realised results. Original rich example remains explicitly available, with yellow values. |
| New Marketing Efficiency | Reviewed monthly turnover, advertising, contribution before/after ads, overheads excluding D&A, EBITDA, original orders; blended ROAS and POAS from matched financial numerators/denominators; contribution/cost composition. | CAC, identified new customers, first-order contribution, cohort payback and channel attribution. Spend-response curves, trajectories and scenario outcomes remain assumptions in an explicit yellow sample planner. No inferred acquisition split or customer mix enters connected results. |
| New Cash Control | Existing accounting cash-readiness status and a separately labelled reviewed monthly EBITDA reference. EBITDA is never substituted for cash. | Bank cash, operating cash, stock/credit/provider movements, cash/profit gap, cash trends, buffer headroom and historical cover. The selected synthetic company has no bank cash snapshots. The original interactive cash design remains explicit and yellow. |

**Yellow means not linked, unavailable, sample or assumption.** Text labels accompany colour. A linked figure keeps normal styling and identifies its calculation/evidence. Zero is displayed only when supported; a missing or zero denominator withholds a ratio/per-order amount. Partially supported sales remain available when costs fail. Rejected profit components cannot reappear through a different presentation calculation.

## Data path and controls

The New pages use the existing authenticated, membership-limited `/api/history-reporting/months` and `/api/history-reporting` service. There is no new browser table access, credential, permission grant, schema migration, financial write or provider action. Explicit business/month/version choices and identity-bound query keys prevent a late response from another selection being displayed. Loading, failure, withdrawal and invalidation withhold unsupported amounts; they never switch to sample data.

Complete calendar months are supported by this existing reader. Daily synthetic activity through 19 November does **not** automatically seal November or provide verified weekly cash/cohort reports. Explicit month/version selection is retained rather than silently choosing a later evidence version.

Explore the Numbers remains near the top and includes formulas, actual period, original-order denominator, currency/timezone, version/snapshot, source observation and cost coverage. Sample mode has separate caveats and yellow numbers/charts. Review drafts remain browser-local examples, not reminders or financial execution.

## Cash connection work still required

A future isolated synthetic cash stream needs a reviewed read-only contract for dated included unrestricted bank accounts; opening/closing balances; reconciled stock, receivables, provider settlements and supplier credit; separately classified tax, investment and financing; internal-transfer exclusions. These must reconcile for each reporting period. Profit or accounting connection status alone cannot supply cash eligibility. Prepare and review that package before any new data/grant changes; no existing customer store or Store D is a substitute.

## Verification

- Frontend TypeScript passes.
- 107 focused financial/evidence/cash tests pass, including linked known answers, per-order denominators, source/scope/version rejection, missing costs, zero denominators, reconciliation conflicts and unsafe subtraction.
- Production frontend and independent standalone demo build pass; existing sourcemap, mixed-import and large-bundle warnings remain. The standalone demo still rejects live infrastructure imports.
- Local browser review uses clearly labelled fixed fixtures, **not** a hosted connection. Selected-month values, explicit comparison and per-order controls, yellow sample mode, and 390px layouts were inspected; all three had no horizontal page overflow.
- Separately verified the actual signed-in staging history reader for October: £64,800 net product sales, £32,400 gross profit, £23,515 contribution and £10,592.05 EBITDA. This proves the existing source path, not that the new release is live.
- After deployment: verify those same amounts on all relevant New pages, period/version changes, per-order output, earlier-month comparison, store changes and unsupported-store/error states; confirm cash remains unavailable and sample mode remains explicitly yellow.

Requirements addressed: SH02–05, DT03, UN01–02, PR01–04 and CC02/forecast boundary. Default/expanded v11 Profit, Cash and marketing designs informed the audit; full design parity, ten-second user testing and every dynamic diagnostic are not claimed complete.

## Release boundaries

Website-only staging release, exact reviewed source; existing access and hosting. No merge to main, production release, database migration/grant, feed rescheduling, synthetic financial write or Shopify/Xero transaction is included. Keep provider services and their auto-deploy branch unchanged. The isolated feature branch is a review vehicle, not a replacement provider branch.
