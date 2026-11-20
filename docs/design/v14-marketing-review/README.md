# Marketing review layout and spending response — 20 November 2026

Paul requested the Profit Engine format and selectors, a trend-led investment headline, four break-even/target KPI cards, clearer contribution coverage, one full-width CAC/POAS history chart and a 30-day spending planner with varying acquisition efficiency. This scoped revision supersedes the v13 Marketing review layout and its operating-profit framing. EBITDA is contribution after advertising less overheads excluding depreciation/amortisation. v11–v13 remain history; the temporary original Marketing route remains unchanged.

## Delivered order and controls

Header, explicit fictional-review label, Total/Per order, Last week/Last month/3/6/12 months, Weekly/Monthly and Last year/preceding 12-week or 3-month average/None. A temporary EBITDA target applies to the next 30 London calendar days. Then: trend-led recommendation; new CAC, POAS, blended ROAS and contribution after ads with break-even and target figures; same-scale contribution/overhead/target bars; combined dual-axis historical CAC/POAS and dotted comparison; scenario controls, results, bridge and spend/CAC/EBITDA curve; progressive evidence and separately labelled connected-source checks.

The target input belongs to the controls before the headline, leaving the four KPI cards immediately after the verdict. The first-order bridge is removed. Old supporting cards and standalone sample channel/cohort recommendations are consolidated into Explore the Numbers. Native range inputs reuse the original planning interaction pattern without assuming budget can transfer directly into Email or Organic.

## Data and calculations

This is an explicitly selected design review on the existing authenticated Marketing route. It does not silently fill missing actual financial metrics. Historical monetary totals, period boundaries, original orders and EBITDA reconcile to Profit Engine's DAILY_SAMPLE (money converted once from cents to pounds), through11October2026. Fictional new-customer counts derive from daily eligible orders; acquisition spend is80% of advertising. First-order revenue/contribution use documented synthetic mix factors. No provider cohort or attribution claim is made.

The selected horizon governs ALL historical cards, bars, narrative and chart buckets. Comparisons use own summed numerators/denominators. Per-order flows use each population's own original orders; CAC remains GBP/customer and ROAS/POAS remain multiples. The rolling pool immediately precedes the selected span; its totals scale to selected bucket count, clearly an analytical equivalent. None removes comparator lines and trend-direction claims. There is no invented numeric materiality tolerance.

Target30 × selected calendar days/30 gives a labelled historical target equivalent, not a historical forecast. Advertising capacity at fixed sales = pre-ad contribution − overheads excluding D&A − target. Break-even/target CAC additionally holds other advertising and new-customer volume fixed. Such whole-business CAC thresholds are not marginal-CAC ceilings. Non-positive capacities have no finite positive-spend POAS/ROAS threshold; negative acquisition capacity cannot be satisfied with non-negative CAC.

## Thirty-day scenarios

The current-trajectory baseline uses daily rates from up to the latest3 selected buckets weighted1:2:3 (or1 for a single bucket) and extends to30days. It is a conditional run rate, not a forecast; dated source gaps, seasonality, stock, cash and repeat demand remain unmodelled. Historical selection changes the baseline atomically; future target horizon remains30days.

Hold/Scale/Pull back applies a0–80% change to acquisition advertising only, holding other advertising and returning activity fixed. CAC = baseline CAC × spend factor^elasticity; elasticity0–0.85 is an editable unverified assumption. New customers = spend/CAC. One customer produces one first order; first-order revenue and contribution stay fixed. Changes in first-order contribution minus advertising change and entered extra capacity overheads change EBITDA. Hold with zero extra costs is exact identity. No ad-account changes or saved guardrails follow.

Scenario results and a reconciled EBITDA bridge compare with unchanged trajectory. Per-order bridge explicitly includes denominator movement before dividing movements by scenario orders. Sensitivity±15pp is an assumption range, not a confidence interval. The visible spend/CAC/profit curve includes the selected scenario point and uses the same entered extra fixed costs across alternatives. Average CAC is distinct from marginal CAC (average/(1−elasticity)). The headline uses a disclosed35% response assumption, not a fitted empirical response. First-order losses require separately supported mature-cohort/funding evidence before scaling.

## Scope and validation

Only the Marketing page, new scoped CSS/model, focused behavioral tests and this document change. Existing authenticated access, original comparison route, APIs, Xero/Shopify scopes, databases, reader/writer schedules and Profit Engine source are unchanged. Connected financial evidence remains an independently labelled, lazy read-only section with its own supported source period. Actual growth recommendations are not enabled.

Twelve behavioral groups cover all period/view combinations, weighted ratios, Profit Engine reconciliation, rolling/None, 30-day daily-rate weighting, EBITDA thresholds, absent/impossible targets, Hold identity, capacity cost treatment, diminishing returns, total/per-order bridge reconciliation and invalid-input refusal. Frontend TypeScript passes. Isolated browser review verifies period/per-order synchronization and scenario Scale controls; mobile width390 has no document overflow after the label layout fix. Hosted build and signed-in visual checks are separate release gates.

## Four-part layout audit and colour review — 20 November

References: the documented Profit/Cash four-section pattern in `docs/night-scout-demo-2026-10-15.md`, Profit Engine's numbered source sections, and v11 `00-principles.md` / `04-shared-page-contract.md`. The four jobs, in plain English, are: give the headline position; explain the movement; move from insight to action; offer supporting numbers without clutter. The v14 user instructions supersede older Marketing card counts and diagnostic ordering.

| Job | Current Marketing fit | Suggested next refinement |
| --- | --- | --- |
| Headline position | Trend verdict, EBITDA, target gap and four benchmark cards present. | Compact the mobile controls so the verdict is reached sooner, preserving Paul's requested selectors. |
| Explain the movement | Coverage bars and historical CAC/POAS show what changed. | Add one concise driver explanation using spend, identifiable new customers and first-order contribution; distinguish arithmetic from an unproved causal claim. |
| Insight to action | Editable spend/CAC scenario and reconciled profit bridge present. | Add a short review checklist: which activity to investigate, cash/stock/cohort checks, proposed test and review date. Saving/monitoring must remain unavailable until supported. |
| Supporting numbers | Source/math details and exact chart values available. | Keep the spend-response chart available but collapse its long numerical table separately, reducing default page length. |

Implemented now: green/red financial status with explicit text, not colour alone. KPI headline numbers compare with business break-even; comparison changes have their own favourable/unfavourable direction (lower CAC is better); break-even and target threshold rows explicitly say Within limit/Above limit or Meets minimum/Below minimum. A green break-even result can coexist with a red target gap and red worsening comparison. EBITDA is coloured relative to zero; target gaps relative to target; scenario changes relative to the unchanged trajectory in the active display units. Missing/nonfinite comparisons and unset targets stay neutral. Fixed costs and spending are not automatically labelled bad merely because they are positive costs. No financial model or provider data changes.

The four recommendations above are proposals for Paul's review, not claims of completed action tracking or measured causal drivers. Thirteen focused financial/status test groups and frontend TypeScript pass. Hosted acceptance is checked separately.

### Approved refinements implemented — 20 November

Paul approved all four proposals. The history section now explains CAC and POAS movements from their matched numerator/denominator percentage changes, using the selected comparator (including the scaled rolling reference). It does not infer a campaign cause. None asks for a comparator; absent/non-positive reference amounts do not produce fabricated percentages.

The scenario adds an unsaved test checklist, scope/owner fields and a proposed review date seven London calendar days ahead. It asks for activity-level economics, cash/stock/capacity checks and cohort payback before accepting first-order losses; review criteria compare actual CAC/contribution/EBITDA with the unchanged plan. It explicitly distinguishes a whole-acquisition-budget illustration from a bounded campaign test. Draft inputs/ticks reset with scenario/period/comparison/target changes and reload. No saving, reminders, monitoring or provider changes are enabled.

At mobile widths, Amounts and View occupy one compact row; Period and Compare use native dropdowns on the next row. They share the desktop state and retain every original option. Desktop controls retain their existing appearance. The response curve stays expanded while its numerical table has a separate closed-by-default disclosure.

Fourteen focused financial/status/driver checks and frontend TypeScript pass. Browser acceptance checks both responsive controls, the independent table disclosure, changing scenario draft reset and missing-comparison explanation. Hosted deployment is verified separately.
