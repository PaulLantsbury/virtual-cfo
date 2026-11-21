# Yellow figure connection register — 21 November 2026

## Workstream validation and publication checkpoint

Source-only validation: **22 Marketing/planning tests passed**, **55 existing Profit/history/supplement tests passed**, and **full workspace build passed**. The coordinator's final full workspace build/typecheck recheck passed. These receipts are local source checks, not browser or hosted acceptance, and do not certify real provider integrations.

Published source branch: `codex/yellow-connections-20261121`, based on cleanup revision `4ab7b6f`. Do not overwrite the operational handover or development work on another branch. Publication is not deployment.

Activation requires a concrete website-only review of the final tested revision, separately from any optional-summary refresh/data-publication package. Existing immutable summaries are preserved. Optional new customer aggregates need their own reviewed source/version/data publication before existing hosted months can expose them. No new hosted change is proposed or applied by this checkpoint; no database grant/schema/data, scheduler, provider or website configuration is changed.

Scope: Profit, Cash, Marketing, Plan, Monitoring and Settings. Scout is excluded from this batch. This register audits source paths, not a percentage of coloured cells. Implementation underway in the same batch must be reported separately from deployed acceptance.

## Evidence and current baseline

Read the latest entries first in roadmap-2026-11-21.md and session-handover-2026-11-20.md. GitHub `codex/restart-baseline` was checked read-only at `8eb5f60646c6f5635e8a6d1bd851f47771a16a38`: its design closeout predates the connected cash/acquisition release. Integration preserves `9f034cc` cloud source plus the existing November 21 cleanup changes. Latest documented signed-in website source is `b7ea4913c928ac9dac57bc45b5478ca06688a016`; this audit has not independently rechecked the hosted service.

The 48 published private monthly cash/acquisition summaries cover November 2024–October 2026. The existing daily financial feed does not automatically refresh those supplements. Optional customer aggregates in prepared source are not automatically present in existing immutable summaries.

## Read-only catalog visibility limit

The current audit account's `information_schema` inspection exposes public `cash_balance_snapshots` fields but does not expose the private supplemental-summary catalog. The 48 private summaries are documented published records; their absence from this account's catalog is not evidence that the tables or columns do not exist. Requirements below identify payload gaps or missing accepted source/reader contracts unless an appropriately authorised owner catalog inspection establishes physical schema absence. No privilege expansion or database write is part of this audit.

## Source implementation checkpoint — not deployed

The Marketing implementation now supports explicitly selected earlier month and evidence-version headline comparisons. It does not complete multi-month CAC/session trend windows. Prior-year/wider-window claims still require all matched constituents and correct denominator/unique-population handling. Local implementation and its final test receipts are separate from hosted acceptance.

Plan baseline integration must distinguish paid first customers from repeat orders. The residual after paid-first orders is **other orders including organic-first/guest/unknown**, not a repeat-customer population. The reviewed-baseline repeat lever is gated. Enabling a repeat forecast requires separately matched repeat-order revenue, contribution and costs, plus complete classified population definitions. This checkpoint does not mark the whole Plan page complete or live.

## Classification

- **Derived:** calculate from supported, matched inputs; no dedicated database column needed.
- **Wiring:** inputs/read contract already exist, but the page does not yet select or compose them.
- **Missing aggregate:** the current published payload lacks required input; prepare a new reviewed version rather than mutate sealed summaries.
- **Unsupported source:** raw records may exist, but no accepted completeness/definition/reader contract establishes this figure. Do not equate this with a physically absent database column.
- **Workflow:** persistent product capability is missing, not a financial fact to generate.
- **Assumption/example:** legitimate explicit user input or selected design fixture; never silently substitute for business evidence.

## Page/source register

| Page / output family | Classification and existing evidence | Required next input or work | Test data / acceptance |
| --- | --- | --- | --- |
| Profit totals, margins, AOV, per-order, monthly trend and selected-month bridge | Derived from authenticated monthly financial history; full costs and original orders gate availability | No new ratio/result columns. Validate each selected/comparison version and its own denominator | Missing costs, zero orders/revenue, refunds relating to earlier purchases, correction invalidation, unavailable comparison, company switch |
| Profit weekly figures | Unsupported source; monthly history is insufficient | Reviewed finer-period sales/refund/cost coverage and allocation policy; never split monthly totals evenly | Uneven trading weeks, crossing month/year boundaries, late refunds, partial week/cost coverage |
| Profit automatic prior-year/broader comparisons | Wiring/period contract; original unlinked list still names this limit | Select matching complete monthly history, aggregate integer inputs and retain exact periods | Leap year, missing constituent month, different order volumes and amended versions |
| Profit staff/product diagnosis and annual action benefit | Unsupported source, not a missing savings column | Eligible product/staff cost and quantity/hours detail, allocation method, action assumption or tested effect, overlap rules | Mixed margin products, shared overhead, missing unit cost, negative/zero quantity, overlapping proposed savings; never claim causal savings from a variance |
| Cash bank, operating cash and cash-minus-profit | Derived from separate reconciled synthetic supplement, already documented as deployed | Preserve exact financial-version binding, included accounts, dated balances and movement reconciliation; other companies need equivalent supported sources | Restricted/incomplete accounts, opening+movements=closing, mismatched version, stale/corrected dependent months |
| Cash resilience / buffer arithmetic | Derived plus explicit owner buffer; needs three complete cash months | No runway/result column. Historical bank cash is not current spending capacity; buffer is an assumption | Missing middle month, zero/positive/negative operating cash, large buffer, company/month change resets assumptions |
| Cash current bank feed, invoice/product drilldowns and spending permission | Unsupported source/workflow | Current bank account coverage, dated commitments, stock/debtor/provider/supplier-credit detail, cash reserve policy and eligible drilldown reader | Unsettled provider receipts, VAT/payroll/supplier due dates, restricted cash, incomplete obligations; EBITDA must not become bank cash |
| Marketing CAC/session/conversion/cohort headline arithmetic | Derived from matched supplement and financial evidence | Keep paid-customer denominator, simulated session source, mature cohort window and financial dependency lineage explicit | Zero spend/customers/sessions; guest/unknown identity; immature cohort; refund reversal; dependency correction |
| Marketing prior and multi-month CAC/session/customer comparisons | Explicit earlier-month/version headline comparisons implemented in source; multi-month CAC/session trend windows remain a gap; never sum unique customers blindly | Complete wider-window source selection/composition separately; sum additive counts/spend, derive ratios; unique unions require an aggregate/identity policy | Missing month, unequal denominators, invalidated source, overlap across months, exact prior-year context |
| Marketing unique returning customers / purchase frequency | Missing aggregate in existing published summaries; prepared source has optional identifiedCustomers, uniqueReturningCustomers and identifiedOrders | Separately reviewed new payload/version publication; defined identified-customer denominator, guest/unknown exclusion and overlap constraints | One customer with several repeat orders, new customer repeating within month, guest orders, impossible cardinalities, legacy payload without optional fields |
| Marketing second-purchase timing and customer drilldowns | Unsupported source/reader | Eligible first/second purchase timestamps, observation/censoring window, refund/cancellation policy and privacy-safe aggregate distributions; no contact data needed in browser | No repeat, same-day repeat, late repeat, immature customer window, duplicates/identity conflicts and deletion |
| Plan baseline / scenario outputs | Wiring plus Derived and Assumption | Use three contiguous complete reviewed months and matching acquisition/economics sources; preserve baseline/formula versions and source labels | Missing/noncontiguous months, source mismatch, zero customers/orders, cost coverage gap, source correction, company switch; no fictional fallback |
| Plan saved actions, reminders and realised progress | Workflow; browser drafts are not shared records or deliveries | Persist scoped action/scenario ID, baseline versions, assumptions, formula version, owner/access, status, review dates and append-only review history; reminder/check delivery receipts need separate service | Non-member denial, duplicate/replay, cross-device edits, overdue/reschedule, changed baseline, failed delivery; examples do not prove activation |
| Monitoring statuses, counts, trends and history | Assumption/example in cfo-alerts.tsx; explicit notice says inactive | Authorised monitor configuration/consent, scoped completed checks with evidence versions, business guardrails, next due time, findings, failure/quiet distinctions and actual delivery receipts | Completed quiet versus no check, missing/stale evidence, failed job/delivery, revoked consent, duplicate schedule and tenant isolation |
| Settings Shopify/Xero collection and verification status | Existing reader/workflow; a credential/collection result is not financial completeness | Reuse scoped status readers; mapping confirmation, exact period/currency evidence and recovery metadata remain independent acceptance requirements | Expired/revoked auth, wrong tenant/member, incomplete mapping, old snapshot, partial period, provider error; no provider retry performed by this audit |
| Settings profile, team and billing | Workflow explicitly unconnected in settings.tsx | Product contracts/access policy and actual backend capability, invitation audit and billing integration; do not invent people, subscriptions or revenue records | Roles/denial, invitation expiry/replay, disconnected billing, membership removal and stale session |

## Implementation evidence locations

`components/NewProfitLive.tsx` and `lib/newProfitLiveModel.ts` retain explicit unsupported weekly/action/staff limits. `pages/new-cash-linked.tsx`, `useReviewedCash` and `CashSourceFigures` gate cash separately from financial history. `docs/new-marketing-v16-connection-register-2026-11-20.md` is the detailed Marketing lineage register; its prepared-only opening is superseded by the later hosted release checkpoint, not by assuming new optional aggregates were installed. `pages/cfo-alerts.tsx` states that no checks are scheduled or notifications sent. `pages/settings.tsx` explicitly leaves profile/team/billing unconnected.

`components/CfoMonitoringStatus.tsx` still contains fixed amber status and example attention counts. Audit its actual mounted usage before presenting that badge as genuine telemetry; the new linked pages suppress monitoring via layout options. A colour alone cannot certify monitoring.

## Completion and database boundary

For each changed family record exact source scope, period/version, unit/denominator, formula, rounding and missing/loading/stale/invalidated handling. Supported derived values use ordinary styling; unsupported/example figures retain yellow plus clear text. Assumptions are labelled inputs, not database defects. Source completeness and schema existence are separate checks.

No database schema/data/grant, provider transaction, scheduler or deployment change is performed by this register. A proposed new field means a missing accepted contract/payload unless live schema inspection proves physical absence. Prepared customer aggregates and refreshed summaries require an exact reviewed data/version package. Do not reuse earlier exact-revision deployment approvals for a different package.

## Read-only operational check — 21 November

The genuine scheduled run published 20 November at 02:01 UTC on 21 November. Render application logs report committed-reconciled with replay false; an independent restricted read-only inspection at 13:57 UTC confirmed both 19 and 20 November receipts committed-reconciled and the programme horizon through 20 November. The 01:00 run correctly reported outside the London window with no mutation. No manual trigger, append, retry or catch-up was performed. This confirms scheduled publication and receipt reconciliation, not browser acceptance or refresh of optional monthly customer/cash summaries.

Render read-only deployment inspection still shows the website on the previously verified b7ea4913 source, with automatic website deploys off. The published yellow-connection source is not live. The exact website proposal and separate source-activation preparation are workstream documents; PM owns cross-stream integration and the operational roadmap.

## Isolated browser acceptance

Three fixture-only browser tests passed: Marketing explicit earlier month/version comparison with legacy missing customer activity; Plan missing one of three supplemental sources withholds its baseline; and Plan paid-first/other-order labelling with the unsupported repeat lever disabled. Marketing and Plan checks at 390px had no page overflow or application page errors. Fresh isolated headless Chrome contexts used a loopback preview; every external request was mocked or blocked, and the server was stopped after testing. An initial Marketing locator timeout was a test selector issue and was corrected before the complete passing rerun.

This does not certify hosted member/non-member isolation, cross-company or delayed user/store switching, real supplemental hashes, correction/withdrawal refresh, persisted reviewed/legacy draft journeys or the full desktop journey. Those remain release acceptance. No source was changed by these browser checks.
