# Plan: proposed consolidated redesign — 20 November 2026

Status: proposal for Paul's review. The New prefixes and access to the existing rewritten Cash page are implemented separately; this document does not claim that the Plan redesign, shared scenarios or action services have been built.

## Purpose and design authority

Plan helps a non-financial owner answer: What is the best next move, what could it change, and how will we review it? It consolidates Opportunity Finder and Scenario Planner into one of the five agreed core working areas. Scout's View remains the final summary-page review; Monitoring and Settings are supporting destinations. No new standalone dashboard is proposed.

References: v11 `00-principles.md`, `02-proposition-and-pricing.md`, `03-navigation.md`, `04-shared-page-contract.md`, `09-opportunities-and-actions.md`, `09a-planner-behaviour.md` and `09b-planner-methods-and-fixtures.md`; the refined Profit Engine source, rewritten Cash demo, and v14 Marketing review. Later user direction takes precedence over older sample figures or layouts.

The four analytical jobs remain what changed, why it matters, where it leads and what to do. Visually use the same blue frames, 01–04 badges, selectors where relevant, concise verdict, accessible green/red benchmark labels and persistent Explore the Numbers. Within ten seconds the owner should recognise the priority, its importance and the next action. Detail starts closed. Do not force four KPI cards or a chart where it does not aid that decision.

## What the three rewritten pages contribute

| Page | Retain in Plan | Avoid duplicating |
| --- | --- | --- |
| Profit Engine | One conclusion, ranked practical actions, quantified assumptions, reconciled EBITDA change bridge, source drill-down. | Its whole historical reporting dashboard or a second profit calculation. |
| Marketing | Target versus baseline, spending response, adjustable CAC assumptions, scenario versus unchanged trajectory, short test checklist. | A separate marketing simulator with conflicting CAC or repeat-purchase assumptions. |
| Cash Control | Profit/cash distinction, explicit working-capital movements, stock/settlement investigations and a dated review plan. | Treating historical stock absorption as an available saving or converting profit uplift directly into bank cash. |

## One destination, three views

Use `Opportunities | Scenario planner | My actions` inside **Plan**, as the agreed v11 tabs, not three main-menu pages. Opportunities is the default. A relevant action opens the planner with its action, baseline and assumptions intact; Manual scenario remains an explicit alternative. My actions shows only actually persisted plans, or a clear unavailable/draft state until that service exists.

The first design pass should focus on the default Opportunities journey below. The planner is the working tool behind the selected opportunity, not a competing dashboard. Full controls appear once in the Scenario planner view; Opportunities can show a concise selected-scenario result and a Model this action link.

## Opportunities: four sections

| Section | Visible by default | Interaction and detail |
| --- | --- | --- |
| 01 — Your next best move | One plain-English priority and why it matters, with one primary action. A small optional profit-goal strip shows current trajectory, target and gap on a common planning horizon. | Without adequate evidence say what must be checked, rather than declaring Scale/Hold or inventing an opportunity. No default optimistic total. |
| 02 — Choose what to improve | Up to three ranked, landscape action cards. Each shows the proposed review, supporting finding, potential net EBITDA range where defensible, timeframe, effort and key uncertainty. | First card expanded only enough to explain the priority; others closed. Explain the ranking in plain language. One-off cash-release investigations remain a separate group with timing, not part of a monthly-profit total. |
| 03 — Test the selected plan | For a modelled action, one baseline-versus-scenario EBITDA bridge and a concise outcome against target. Otherwise the relevant next investigation. | Model this action opens the planner for the selected scope. Do not send stock reviews into a P&L-only simulator. No chart or invented financial benefit is required for an evidence-gathering task. |
| 04 — Review and follow through | Who will review it, review date, success measure, stop/reconsider rule and the next step. | Explore the Numbers reveals the exact baseline, formula, assumptions, costs, dependencies and source freshness. Saving and reminders must match actual persistence capabilities; a local draft is explicitly labelled. |

A goal is optional: the page must still be useful without asking an owner to complete a forecast. Suggestions and conditional model results must remain distinct. Lower CAC or higher EBITDA in one scenario does not by itself authorise spending.

## Shared planner

Keep the original tactile sliders, paired with direct number entry. Expose only the controls relevant to the chosen action; tuck other costs and overheads into disclosures. Carry source period/business/unit into the working panel. Keep the historical evidence period distinct from the future plan horizon. If using a next-30-day plan to align with Marketing, explicitly construct and label that shared baseline; do not silently reuse the older one-month B01 or a historical quarter as the same horizon.

Retain the three mutually exclusive growth methods: Orders; Spend and CAC/CPA; Traffic and conversion. One active method determines orders. Preserve common AOV, advertising, cost and overhead assumptions, but exclude inactive method-specific inputs from calculations. Do not count organic/returning orders twice, infer demand from a price change, or let advertising cuts produce pure savings while leaving acquired orders unchanged without an explicit assumption. Spend-response assumptions should reconcile with the Marketing model, with repeat demand and cohort uncertainty disclosed.

Show controls and the reconciled baseline-to-scenario bridge together on desktop; show the compact result near controls on mobile without obscuring inputs. A small What needs to be true panel checks demand, CAC response, margin, capacity and funding assumptions. Profit is not cash stays visible: stock funding, VAT, payouts and supplier-payment timing are separate requirements.

Combining opportunities must recalculate one integrated scenario, not add overlapping card values. Recurring EBITDA, one-off cash release and spend/investment are separately labelled. Costs to implement and capacity steps reduce benefit where supported. Do not turn historical expense or stock balances into a promised opportunity amount.

## Ranking and evidence

Remove the existing headline £31k–£49k combined monthly sample opportunity total, unvalidated weighted score and generic fastest-recovery claims. Prioritise supported net impact, evidence strength, effort, time and cash constraints with an inspectable rationale. Unknown benefit is valid for a useful investigation. Do not imply a precise evidence-confidence percentage from a label or arbitrary score.

Every card references the specialist source and opens the relevant evidence, not a generic unrelated page. A modelled result explains assumptions and sensitivity; a historical finding explains actual movement and uncertainty. Preserve access, missing/stale/incomplete evidence and sample labels. Show fewer findings when nothing material needs attention only after a completed scoped check; missing evidence is never an all-clear.

## My actions and delivery boundaries

Future accepted actions need a frozen baseline/scenario version, owner, accepted date, target, review date, success/stop criteria and history. Overdue reviews preserve the original date and require a reason to reschedule. Marking done is not proof of realised or causal savings. Monitoring may reference accepted reviews only when its real checks and consent services operate.

The immediate design deliverable can use labelled fictional examples and unsaved drafts. Secured action persistence, real ranking, supported baselines, cross-page handoff and monitoring are separate implementation/acceptance tasks. No provider transaction or ad/budget activation follows any Plan control.

## Acceptance for the eventual build

Within ten seconds, owners should identify the top priority, why it matters and the next step. Check 1440px and 390px reading order, keyboard use, disclosure/evidence focus and chart tables. Verify baseline identity, source/period consistency, mutually exclusive growth methods, unchanged-case identity, overlap handling, implementation costs and an exact signed EBITDA bridge. Missing inputs withhold dependent advice while preserving supported data. Cash effects remain unknown when timing evidence is absent.

## New-page labels implemented alongside this proposal

The normal site menu/headings identify New Profit Engine, New Marketing Efficiency and New Cash Control. New Cash Control opens the existing rewritten Cash demo at the protected `/new-cash-control` route, clearly labelled synthetic. The older `/cash-control` reporting/context page remains accessible through Compare original page; it has not been replaced or relabelled as the redesign. Profit and Marketing retain their existing routes. The separate published demo's normal page names stay unchanged. Legacy menu consolidation into Plan is proposed, not applied in this naming-only release.


## Implementation — 20 November 2026

The approved design is implemented at protected /plan, with Opportunities, Scenario Planner and My Actions inside one New Plan destination. Former menu routes resolve to Plan; original designs remain at /opportunity-finder-original and /scenario-planner-original. Legacy planner presets are not silently applied.

Four numbered blue sections follow the rewritten pages. Historical selectors are separate from the dated, conditional next-30-day run rate. The optional EBITDA goal, integrated model and exact signed profit bridge share Marketing's baseline and acquisition response. Orders, spend and traffic are mutually exclusive order methods; combined revenue, order-cost, overhead, implementation and capacity assumptions recalculate once. Cash investigation has no invented EBITDA benefit. Specialist evidence links carry historical context; specialist pages retain their supported comparison choices.

My Actions stores at most 20 explicitly fictional drafts locally for the signed-in user and store. Each freezes source dates, baseline, assumptions, target, owner, success/stop criteria and review history. Rescheduling preserves the original date. Corrupt or incompatible storage is retained and blocks overwrite. This is not secured shared action persistence, scheduled reminders, live merchant ranking or realised-savings measurement. No provider transaction or advertising setting is changed.

Validation: 12 Plan model/persistence tests and 14 existing Marketing tests passed, plus frontend TypeScript. Desktop interaction checked scenario changes, saving, reload and review history. 390px layout has no document overflow; Free view gates modelling and preserves evidence. Staging production build and live route acceptance are final release checks.


## Visual monthly Plan revision — 20 November 2026

Supersedes the first Plan layout and fixed next-30-day UI. New Plan now leads with editable standalone profit sensitivities for acquisition efficiency, conversion, existing-customer repeat orders, net AOV, order costs and overheads. Reduced discounts is no longer a headline lever. The four numbered sections are replaced by outlined working stages. Find your focus compares impact bars alongside a monthly trajectory; Build your plan foregrounds the trajectory and controls; My Actions preserves frozen browser samples.

Plan ahead selects the next 3, 6 or 12 full calendar months. The historical evidence window is separately labelled in Explore the Numbers. A monthly total-EBITDA target is compared with each projected month and the horizon total. History and future are separated by an explicit source gap, with no invented actuals or connecting line. The first partial month is excluded. Underlying activity trend defaults to zero; seasonality and new-cohort repeat demand are not forecast.

The shared Marketing sample provides the 30-day economic starting point. Monthly activity scales for calendar days and the entered trend; monthly fixed overheads stay constant. Spend uses Marketing's fixed 35% response assumption. Independent CAC improvement excludes conversion. Conversion scales first and existing repeat orders, then the repeat lever scales the existing repeat pool only. No new-cohort repeat orders are added. Net AOV uses an explicit incremental contribution margin rather than treating revenue as pure profit. Negative conversion, repeat-order and AOV changes can stress-test downside.

Standalone bars exclude all other improvements and test costs. Selected effects are recalculated in one model; bridge interactions are allocated sequentially, not added from standalone bars. Start month, ramp, ongoing expenses and one-off setup expense are editable. Total/per-order paths use their own order denominators. Invalid inputs remove dependent output and block saving.

Monthly browser drafts use plan-monthly-v2 and freeze the base, source, date anchor, horizon, timing, assumptions and monthly target. Earlier v1 30-day drafts remain preserved and inspectable; they are not silently converted. New review notes retain history and do not claim realised benefit. No shared persistence, automatic reminders, provider action or live forecast is introduced.

Validation includes 12 new monthly model/persistence tests, 14 existing Marketing tests and frontend TypeScript. Desktop browser checks cover selection, combined six-month results, invalid input, save and reload; an actual 390px iframe viewport checks responsive controls and document overflow. Free modelling is gated and evidence stays accessible. Hosted production build and live acceptance are checked at publication.

## Recommended customer analysis structure — discussion, not implemented

Keep one Growth & Marketing destination with Acquisition, Conversion and Retention tabs. Acquisition retains existing CAC/POAS/ROAS and spend decisions, with new-customer versus blended definitions made explicit. Conversion covers sessions, add-to-cart, checkout and purchase funnel, device trends, net AOV and contribution trade-offs. Retention leads with new/repeat customer and revenue trends, second-purchase timing, purchase frequency and contribution; cohort heatmaps and 30/60/90-day mature-cohort economics are progressive detail.

Plan remains the cross-business financial simulator; specialist tabs diagnose performance and pass evidenced assumptions into Plan. Reuse relevant Growth Quality material instead of creating another top-level customer dashboard. Do not rename/rebuild Marketing in this release. Customer acquisition creates future cohorts; the lagged acquisition-to-repeat model remains parked pending sufficient evidence.

Shopify reports support new/returning customer and cohort analysis and a session-based conversion funnel. This does not prove Night Scout's current imports include those datasets. Audit complete first-order history, stable customer identity, refunds/cancellations and anonymised/guest handling; historical orders outside the default 60-day window need appropriate access. Funnel sessions need a separate supported analytics source and measurement definitions. Do not calculate Shopify session conversion as all-channel orders divided by sessions.

References reviewed: Shopify Help Center Customers reports and Behavior reports; Shopify developer API access scopes. Preserve cohort maturity and comparable-session definitions, including the documented September 2026 measurement change. Never compare immature cohorts as though they have completed the same 90-day window.
