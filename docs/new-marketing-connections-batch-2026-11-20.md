# New Marketing connections — implementation batch, 20 November 2026

Prepared source; not a hosted release or live database change. This adds connected financial history and a financial-only what-if to the existing New Marketing default view. The explicit yellow sample review remains intact for design inspection. It is not silently substituted or reclassified as database reporting.

## Connected additions

- Up to 3/6/12 contiguous reviewed monthly buckets ending at the explicitly selected month, using the shared read-only history series hook. Every candidate month/version must pass validation before any history is displayed. A failed/ambiguous/missing month withholds the series. No fabricated daily or weekly allocation.
- POAS and blended ROAS trend, with dated values table including source version, original-order count, turnover, pre-ad contribution, advertising and EBITDA. Summed-period returns use summed numerators/denominators; Per order uses each row’s original orders and the footer’s summed orders. Missing/zero denominators remain unavailable and yellow.
- A separately labelled selected-month versus immediately preceding month comparison for POAS, ROAS and EBITDA, with its exact range and calendar-day-length caveat. It does not change headline scope or imply campaign causality.
- Fixed-sales break-even advertising capacity, minimum POAS/ROAS, required contribution, optional same-month target and target gap, based on validated contribution and overheads excluding D&A. Non-positive capacity yields no finite return threshold.
- A closed-by-default financial what-if that repeats the selected historical month as a baseline. Advertising change and contribution-before-ads change are independent explicit assumptions, plus additional overheads. There is no inferred customer response. Integer-pence conditional EBITDA and a three-effect bridge reconcile exactly to the hypothetical difference. It is not a next-month/30-day forecast, measured benefit, CAC ceiling or spending permission.

Assumptions reset on company, month or evidence-version change; they are temporary browser state. No persistence, action, advertising change or reminder is created. Connected browser calculations need no separate result columns in Supabase. A valid baseline plus a labelled user assumption is not a yellow missing-source warning; unavailable or sample figures retain yellow and textual status.

## Mapping to the original full audit

The [original register](new-marketing-full-figure-audit-2026-11-20.md) remains a dated audit of the previous deployed source. Its IDs identify distinct source paths, not a checklist where deleting samples makes every example connected.

| Original families | New coverage | Remaining limit |
| --- | --- | --- |
| MF01–MF10 | Existing connected financial outputs retained; now reused in validated multi-month chart/table and summed-period ratios. | Requires explicitly selected supported month/version. |
| MF12, MF14–MF16, MF19–MF21 | Connected monthly counterparts for original orders, POAS, ROAS, contribution, historical returns and EBITDA comparisons. | The separately selected sample page still has its own fictional paths. No customer comparison is inferred. |
| MF26–MF27 | Actual pre-ad contribution and advertising numerators are available in every chart row/table for inspecting the financial ratio drivers. | Percentage-driver narrative is not added, and causality is not established. |
| MF30–MF31, MF35 | Connected fixed-sales break-even thresholds and required contribution. | Not marginal CAC or affordability. |
| MF33–MF34, MF36–MF37 | Verified monthly baseline plus optional explicit same-month EBITDA target. | No day-equivalent scaling from a 30-day future target; target is clearly scoped to the reviewed month. |
| MF50–MF52, MF57–MF58 | A separate financial-only conditional EBITDA, difference, total advertising and advertising/overhead effects now use a connected baseline and independent assumptions. | Does **not** replace the sample customer-response formula with an unsupported claim. No original-order or customer response is assumed. |
| MF11, MF13, MF17–MF18, MF22–MF25, MF29, MF32 | Still unavailable in connected mode. | Need matched acquisition spend, identified first-time customers and/or first-order/cohort facts. |
| MF28, MF38–MF49, MF53–MF56, MF59 | Original future run-rate, acquisition-response/sensitivity and customer-based scenario paths remain explicit sample design. | A monthly-history input is not observed future demand, measured CAC response or cohort evidence. |

The financial-only what-if also adds a new explicitly assumed pre-ad contribution effect; it is not attributed to new customers. Existing New Plan continues to use its disclosed sample context.

## Files and validation

Implementation: `components/NewMarketingConnections.tsx`, integration in `components/NewMarketingLive.tsx`, and pure `lib/marketing/linked-connections-model.ts`, with targeted tests. Shared history hook owned by the coordinator.

Ten Marketing tests pass: matched integer totals and weighted ratios, store/period rejection, zero denominator handling, fixed-sales limits, independent scenario effects and bridge reconciliation, missing inputs and invalid/overflow controls, plus existing lineage/conflicting-profit safeguards. Frontend TypeScript check passes. Hosted rendering and release verification belong to the coordinator’s integrated package; no live verification is claimed here.

Design principles addressed: SH02/SH04, DT03/DT04, UN01/UN02 and GM07/GM08. Explore the Numbers remains near the top and exact chart/source figures expand independently. The existing New Marketing visual structure is preserved; the connected financial scenario starts closed. No new campaign scaling recommendation is introduced while cash/customer guardrails are unresolved.
