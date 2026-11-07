# CFO layer acceptance — 17 September 2026

## Purpose and decision boundary

Night Scout is an ecommerce CFO: explain the supported financial position, show why a result changed where the evidence supports a decomposition, and identify an investigation or action the owner can assess. It is not an advertising attribution or audience-activation product. Retain the current CFO Briefing, Profit Overview, Margin Analysis and related navigation; this document approves no new naming, ranking, forecasting or financial formula.

This acceptance specification translates the [dashboard decision specification](dashboard-decision-spec-2026-09-17.md), [project brief](project-brief.md) and [approved financial definitions](agreed-financial-definitions.md) into testable behaviour. Older implementation-status paragraphs in those references predate subsequent work; the latest handover controls delivery status. Examples below are synthetic acceptance cases, not merchant performance claims.

Paul has now agreed one nightly refresh at **02:00 in the store's local timezone**, retaining previous figures after a failed refresh and clearly flagging them as stale. This is a refresh cadence and presentation decision. It does not turn a collected candidate into verified financial evidence, approve a scheduler deployment, resolve ambiguous evidence or authorise new spending/actions.

## Shared evidence contract

Every actual headline and briefing statement must identify the same store, currency, exact store-local period and reporting evidence version as its supporting page. Read approved shared sales/profit results; do not recalculate independently inside copy generation. Preserve zero and negative amounts. A missing value is unavailable, not zero. Separate:

- Latest source collection attempt and its outcome.
- Latest successfully collected source period and time.
- Current unverified candidate and any recheck requirement.
- Latest supported reporting snapshot and its period/evidence version.
- Financial completeness or independent review, which a sync does not grant.

Briefing copy should state the observation, supporting components, financial meaning, evidence limitation and a link to inspect the source result. A suggested investigation can be useful before an impact estimate exists. Avoid fabricated certainty, confidence percentages, benchmarks or ranking scores. A changed result alone does not identify its cause.

## Worked briefing acceptance

| Case | Required result and example of acceptable wording | Evidence/dependency and failure condition |
| --- | --- | --- |
| Normal February profit | With product sales £140, shipping £5, COGS £60, variable costs £15, advertising £10 and overheads £25 including £5 D&A: GP £80, contribution before marketing £70, main Contribution £60, operating profit £35 and EBITDA £40. “February contribution was £60 after £10 advertising spend; operating profit was £35 after £25 overheads.” | Same exact monthly sales, historical cost and expense evidence as Profit Overview. Every component reconciles; no claim that advertising caused the sales. Contribution margin uses £145 combined revenue, not £140. |
| Supported explanation | “Overheads reduce February contribution of £60 to operating profit of £35.” A detail link shows the £25 total and its supported classifications. | This is an arithmetic bridge, not causal attribution. Do not describe every cost as avoidable or promise £25 savings from removing it. |
| Original AOV and later refund | An eligible February sale of £100 less £10 discount has AOV £90, excluding VAT and shipping. A March product refund of £24 containing £4 VAT reduces March net product sales by £20. “March includes a £20 product-sales reversal relating to an earlier order.” | Actual event dates/store timezone and original-order link. February AOV/order count remain unchanged. A March refund-only period remains visible; zero new orders does not mean no activity. Do not call this a March cohort return rate. |
| Store D refund month | In the existing Store D fixture, March products −£70, shipping −£5 and COGS £0 yield GP −£70 and contribution/OP/EBITDA −£75 with its explicitly complete zero March expenses. “March's recorded result includes refunds of earlier sales.” | This fixture differs from older acceptance examples with March handling/overheads. Use its actual supported inputs; do not mix fixture expectations. Negative revenue does not produce a meaningful percentage margin under the current presentation rule. |
| Later stock recovery | Store D's £40 historical cost recovery occurs in April when goods return to saleable inventory, independently of the March refund. April sales £0 and profit £40 are valid. “April includes £40 of product-cost recovery from returned stock.” | Dated saleable-stock evidence plus historical cost; no cash receipt inferred, no automatic recovery on refund date, and no “sales growth” claim from the positive profit. |
| Discounts | “Product discounts were £10 against £150 gross product sales,” with the value-based discount rate calculated by the shared definition. | Product discounts ex VAT; shipping discounts separate. This is not a percentage of orders using codes. No statement that discounts were unnecessary or that removing them would recover £10 without demand assumptions. |
| Marketing spend | Show evidenced advertising deducted once in contribution after marketing, with agency fees/salaries/software retained in overheads. Suggest inspecting spend and contribution together. | Actual ad spend and period coverage. Without agreed attribution, CAC denominators and response assumptions, do not prescribe a channel switch, assert incrementality or forecast extra contribution. |
| Cash absent | “Cash position unavailable: dated bank/payment balances have not been connected and checked.” Keep supported profit visible. | Do not use sales, EBITDA or overheads as a substitute for bank cash or burn. A runway requires supported unrestricted balances and approved burn inputs. |
| Customer identifier present | State only that identifier observations have been retained if that operation is evidenced. | Identifier collection is not repeat-customer reporting. Explicit null is not a synthetic guest; conflicting historical identities must not be resolved by selecting the newest inserted row. No repeat rate, LTV or CAC until corresponding rules and source coverage are agreed. |
| Actual source consists only of test orders | The observed Shopify test orders remain excluded; explain that collected test transactions are not eligible sales. | A successful extraction or candidate receipt does not establish actual zero revenue for a complete period, and it does not import eligible financial events. Synthetic eligible demonstrations remain separately labelled. |

## Partial and unavailable evidence

- **Missing or changed historical costs:** retain supported sales/AOV/discount/shipping amounts; GP and downstream dependent profit become unavailable. Do not assume COGS is zero, use current product cost or write that the business has a high margin.
- **Missing advertising evidence:** retain supported GP and contribution before marketing; after-marketing contribution and dependent profit are unavailable. Do not infer zero advertising from no rows unless complete coverage supports that conclusion.
- **Missing/changed overheads:** retain supported sales, GP and contribution. Operating profit and dependent EBITDA are unavailable. The briefing may say that overhead evidence needs checking; it must not say the company broke even or incurred zero overheads.
- **Missing cash:** no actual cash balance, runway or liquidity advice. Its absence does not suppress valid trading results.
- **Unsupported period or multiple unselected versions:** clearly unavailable for that scope; no hidden fallback to another month or whichever version was returned first.
- **Comparison unavailable:** show the current supported amount without a percentage change, improving/falling wording or implied trend. Comparable periods, currency, definitions and evidence coverage are prerequisites.
- **Store/date change or access denied:** clear the previous scope immediately. Retention after refresh failure never permits displaying another store's data or data the current user can no longer access.

## Nightly refresh and retained figures

1. Schedule eligibility is evaluated using the configured store timezone and local calendar date. “02:00” is not hardcoded UTC or the operator Mac's timezone. A successful journaled slot must not run twice because a process restarts or a clock repeats.
2. Daylight-saving or downtime behaviour that the agreed local time does not fully specify must be documented by the scheduler package. An implementation's skipped-time, repeated-time or catch-up behaviour is not silently a new product rule. Never imply a broader catch-up or retry promise than has been agreed and tested.
3. A failed or unconfirmed refresh preserves the last supported reporting snapshot for the **same authorised scope**, including its original data-through date and evidence timestamp. Display, for example, “Last available figures: [period]. The latest refresh did not complete; these figures may be out of date.” Use actual observed dates, not invented freshness.
4. A stale label must be visible alongside retained headlines and dependent briefing statements. Do not leave a current/green status, say “updated today” from a page load time, or generate new advice as though yesterday's snapshot were newly verified.
5. Retention is not restoration of invalidated evidence. If a newly observed source change makes an earlier snapshot require recheck, do not republish it as currently verified. If retained historical values are displayed, label them as the previous snapshot awaiting recheck and keep them distinct from current supported actuals. Where the present reporting contract returns unavailable, preserving retained storage does not require overriding that contract.
6. An uncertain write remains uncertain. Persistent started/running state after a restart is an unfinished attempt, not proof that a worker is active. No automatic retry that could overlap an unresolved operation; follow the explicit recovery procedure.
7. A successful source collection updates source freshness only. It must not clear an existing financial recheck flag or issue a completeness attestation. If the refreshed candidate has not entered approved reporting, show that distinction instead of claiming the figures have refreshed.
8. Nightly work must not send email, notifications, place orders, change marketing budgets or execute recommendations merely because a briefing action exists. Those are distinct capabilities and authorisations.

## Acceptance checks for implementation packages

Use three distinct layers of evidence: disposable ledger/pipeline tests for arithmetic and capability boundaries; SQL-backed page tests for shared visible results and copy; separately identified live staging read-only observations. Passing a mocked transport test is not proof of a live connector or current financial completeness.

The briefing package should demonstrate normal sale, refund-only and later-stock-recovery months; missing historical cost, advertising and overhead cases; valid zero/negative values; unsupported period; refresh failure with a same-scope stale snapshot; source invalidation; denied access; rapid store/date changes; and narrow/wide layouts. Headline values and copy must agree with the supporting pages and link to the same scope.

Nightly tests should separately cover store-local date boundaries, restart after a finished slot, unfinished-slot blocking, an ordinary failed refresh and the explicitly selected DST/downtime policy. Tests must not mutate financial definitions to make a synthetic example pass.

## Delivery order and remaining decisions

First strengthen supported CFO observations and evidence links using the shared sales/profit contract. Complete source freshness and stale-state presentation alongside the reviewed nightly machinery. Extend cash/accounting after real account coverage and reconciliation; add customer and marketing analysis after identity/cohort/CAC/attribution decisions. Forecasts, ranked opportunities and automatic monitoring require their own assumptions, guardrails and tracking definitions.

Do not rank actions by invented impact/effort/confidence, estimate causal uplift from correlations, or turn a sample scenario into an actual forecast. This document is an acceptance specification and dependency guide, not a claim that all CFO behaviour, cash connections, scheduling or merchant reporting is deployed.

## Current nightly preparation boundary

The prepared nightly runner is fixed to the existing London development store and an explicitly configured reporting range; it does not automatically select a new financial reporting period. Its due window is the scheduled minute, without daytime catch-up. The generic planner has tests for other timezones, but the SQL reservation capability remains London-only. These are preparation limits to address explicitly at activation, not claims of deployed multi-store scheduling.

Independent read-only review of the planner, runner, operator entry point and reservation proposal found no remaining core reservation/uncertain-outcome defect after receipt validation and terminal timestamp checks were tightened. Eight planner/runner tests passed independently, including persistent once-per-day claims, recreation, failure blocking and simulated acknowledgement loss. Those disposable tests do not establish a live OS/cloud schedule or real multi-session network-failure recovery. No scheduler was installed or live nightly write performed by this review.
