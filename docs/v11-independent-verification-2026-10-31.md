# v11 independent verification — 31 October 2026

Status: independent calculation, adapter and representative local-browser review completed for this batch. This document does not establish hosted staging verification or deployment.

## Independent basis

The expected financial outcomes come from the approved written v11 fixture tables, not raster chart geometry or the production calculation code. Tests own their input data and independently stated expected pence amounts. Full-precision expectations use rational expressions; per-order values are not rounded before comparison or recomposition.

Initial review covered the v11 README, financial definitions, historical/cash/marketing fixtures, period and shared evidence contracts, planner methods, page specifications and acceptance gates, alongside the agreed financial definitions. The Profit default visual was opened to verify the intentionally retained Sankey and collapsed diagnostics.

## Existing implementation and reuse assessment

- Existing `analytics/cfoEvidence` has useful exact-store/currency/period gating for retained snapshots. A successful fetch alone is not evidence of financial completeness.
- Existing `reportingPeriod` implements only completed month/week and uses browser timezone. It must not be treated as the full v11 business-local period/comparison implementation.
- Existing `scenario-model` uses an older synthetic cost split and direct-order assumptions. Its baseline should not replace v11 Illustrative Month B01 or silently supply the new growth methods.
- Legacy channel calculations include attributed/blended metrics whose allocation and overlap rules differ from v11. They cannot certify the sample's combined ROAS or channel contribution.
- The written specification requires an agreed, versioned comparison tolerance but supplies no numeric default. Do not invent a universal threshold or imply business guardrails are configured.

## Financial checks prepared

`artifacts/virtual-cfo/src/lib/v11-tests/financial-known-answers.test.ts` covers PR01/PR03, UN01/UN02, SH03, DT03 and SP01/SP02/SP06:

- Both historical quarters, profit subtotals and the exact EBITDA bridge.
- Different gross-margin and EBITDA denominators; full-precision own-period per-order values and pre-refund AOV.
- Separate continuous revenue and rounded whole-order break-even measures.
- Missing COGS/later expenses, unsupported denominators and nonpositive margin bases.
- Three matched-baseline growth methods and three £8,600 uplift cases.
- All six directed method switches with poisoned inactive assumptions, marketing-only cost effects, no double counting of Other orders, adverse CPA and invalid/missing inputs.

Results will be recorded after the calculation API is integrated. Date comparisons, cash/marketing reconciliation, UI interactions, responsive checks, capability availability and remaining gaps are separate checks, not inferred from these unit assertions.

## Independently executed results

The independent Node test suite passed **54 tests** with zero failures:

```sh
node --experimental-strip-types --test artifacts/virtual-cfo/src/lib/v11-tests/*.test.ts
```

The suite also checks all completed-calendar period and comparison presets, London summer-time/DST boundaries, completed weeks, arbitrary inclusive dates, leap-day clamping, overlapping/custom/unequal ranges and comparison None. Cash tests reconcile EBITDA to operating cash, bank movements and the closing balance, inventory purchases/COGS, supplier credit, provider balances and overdue categories. Marketing tests distinguish current acquisition and mature cohorts, the exact payback crossing, spend reconciliation, weighted channel ratios and unavailable combined ROAS.

Evidence tests reproduce per-order amounts and denominators, protect copied context, reject cross-business/period/currency/source substitution, invalid dates, unknown metric identifiers and missing cost coverage. Unknown, failed, stale and sample data cannot become verified quiet; quiet requires a completed dated check matching the expected scope.

### Review findings resolved during this batch

1. Monthly monetary trends were initially still totals under Per order mode. The approved fixtures have no monthly original-order counts. The adapter now withholds that series with an explicit explanation; it neither invents counts nor divides each month by the whole-quarter denominator. A regression covers this boundary.
2. Source validation now requires dated evidence and verified cost coverage for cost-dependent measures; independently supported sales remain available. Unknown metric IDs cannot bypass the shared dictionary.
3. Quiet/actionable determination now requires the expected scope to match the checked scope. A nonempty scope string alone no longer certifies a successful check for the selected business.

These are calculation/adapter unit results, not an assertion that the live sources, access controls, imports, scheduling or financial pages have been staging verified.

## Authorised reporting adapter checks

Eight additional independent tests cover the structural adapter for existing authorised Shopify sales/profit results. They verify exact scope and access, the source's overheads-including-D&A to v11 overheads-excluding-D&A mapping, source subtotal readiness, partial costs, conflicting derived profit, same-scope dated retention, denied/invalidated/undated sources, and full-precision original-order denominators. The adapter makes no fetch, grants no access, mixes no Xero accounting with Shopify operational figures and supplies no fictional fallback.

This is an implemented pure boundary. Existing hooks still need verified snapshot date/version metadata and page wiring before it can certify actual v11 merchant results. The fictional design review remains an explicitly separate surface.

## Independently observed interface checks

Local development preview only: `http://127.0.0.1:4311/design/v11/scout`. No hosted staging or production deployment is established by this review.

The independent browser measured actual CSS viewports of **1440 × 900** and **390 × 844**. This avoids treating the requested browser size as proof of the CSS size when zoom differs. All seven destinations were reached through the real mobile navigation at 390px; each had document width and scroll width of 390px. The expanded planner was separately rechecked after a grid-minimum-width correction and also remained within 390px. Wide tables and the Sankey retain contained inspection rather than forcing the whole page wider.

Observed journeys:

- Scout default shows one verdict and stock-review action, four cards, and closed diagnostics. At 390 × 844 its primary action remained within the opening viewport. This is layout evidence, not a ten-second owner comprehension test.
- Comparison None removes comparative cards/verdicts and the Profit chart's comparison series. Selecting an unsupported historical period withholds amounts, shows a recovery step and keeps Explore the Numbers available. Returning to the supported range restores the fixture rather than relabelling it.
- Explore the Numbers opens in unavailable and supported states. Escape closes the dialogue and returns focus to its originating header button.
- Profit Total / Per order updates the cards, comparative changes, Sankey and evidence. The economics table shows monetary changes such as CM3 −£4.83 and EBITDA −£4.37, using each period's own denominator. Monthly per-order trends are explicitly unavailable because the approved fixture supplies no monthly order counts.
- Growth & Marketing's three tabs work. Customer Economics distinguishes current acquisition and the observed mature cohort. All paid channels with ROAS selected shows Unavailable because overlap is unresolved; changing to CAC shows the separately supported £33.33 ratio. Comparison None removes the comparative line.
- The planner starts with £110,500 net sales, £49,500 CM3 and £31,500 EBITDA. Direct GBP input £17.99 was also browser-tested: 1,100 orders produced £14,789 net product sales after the fixed £5,000 refunds, with a valid conditional loss result rather than a floating-point input error. CPA zero removes all results rather than retaining the previous method's figures. Switching to Traffic & conversion or Order assumptions excludes that inactive invalid CPA. Shared AOV £106 persists across methods and gives £32,600 EBITDA for 1,100 orders. Reset this method restores only the active method, retaining common inputs. Reset all reproduces £95,000 / £40,900 / £22,900. Top-level Explore now reproduces the active B01 method, common/method inputs, formula version and results.
- Accepted Actions defaults to capability unavailable; no action, reminder or history is claimed to be saved.
- Monitoring defaults to service unavailable. Ready setup retains unchecked consent and disabled activation. Verified quiet, failed data and failed delivery have distinct messages and evidence. Conditional examples remain explicitly fictional.
- Settings shows source freshness separately from financial readiness. Blank guardrails have no universal numeric defaults. An incomplete draft requests owner/date/rationale; a valid review remains Unsaved and shows blank limits as Unconfirmed. Save guardrails and Invite team member stay disabled.
- Incomplete-cost state was retested in Scout and Cash Control after correction: EBITDA and the first-order gap are withheld, cash bridge profit reconciliation is unavailable, the cash chart removes the EBITDA series, and contextual cash evidence marks EBITDA unavailable. Independently supported operating cash and dated bank balances remain visible.

### Interface findings corrected and rechecked

The initial static/browser pass found a Sankey endpoint overlap, monetary per-order deltas displayed as percentages, a known staff fixture incorrectly labelled unavailable, a mobile planner grid wider than 390px, profit leakage through an expanded incomplete-cost cash bridge, and missing active-scenario evidence. The relevant owners corrected these during integration. The financial/evidence and responsive checks above describe the corrected source, not the initial failures.

Additional financial regressions cover total and own-period per-order EBITDA waterfalls, percentage-point versus percentage-change comparisons, and the explicit £60,000 staff fixture included once in overheads. Staff diagnostics reconcile to 8.6% of revenue and £2.62 CM3 per £1 staff cost before display rounding.

## Remaining verification and delivery limits

- This is a coherent fictional review surface and a pure reporting adapter, not completed live merchant page wiring or Shopify/Xero financial reconciliation. Existing verified source snapshots still need metadata and page integration.
- Real action/scenario/guardrail persistence, permissions for new services, invitations, monitoring checks, consent storage, scheduling and message delivery are not implemented by the review. Disabled controls and fictional state examples do not establish those capabilities.
- The 33 references informed implementation, but this pass does not claim pixel-for-pixel acceptance of every expanded/alternative mockup or an exhaustive keyboard/screen-reader audit. Default/expanded state parity, richer diagnostic drilldowns and all cross-page investigation records should remain in the follow-up checklist.
- The representative five-owner ten-second comprehension test has not been performed. Automated arithmetic, browser interactions and screenshots cannot replace it.
- No main merge, database change, source refresh, provider transaction or production release was performed by the independent reviewer.

The exact GBP parser and null-preserving difference helper have two additional independently executed regressions. The parser maps £17.99 to 1,799 pence without binary multiplication artefacts, handles the safe-integer boundary, and rejects excess decimal places, exponent syntax, overflow and missing values. These inputs do not silently become zero.

Independent review screenshots were captured for Scout desktop/mobile, Profit desktop/full-page and Planner desktop/mobile. The lead owns the user-facing screenshot selection and publication record. Temporary browser viewport overrides were reset and the independent review tab was closed after the checks.

## Bounded diagnostic follow-up in the same session

The final **54-test** suite was strengthened, without changing the test count, for the added visual diagnostics. It verifies the current first-order result £26 − £33.333… = −£7.333…, the mature cohort's own £26 first-order contribution + £29 additional observed contribution − its matched CAC = £21.666…, and the monthly overhead ratios from each month's actual numerator and denominator. The comparison overhead ratio uses the explicitly proportionate fictional allocation, not fabricated comparison monthly costs.

Static review of the follow-up confirms that the revenue-composition visual remains quarter-only (40%/60%, with no monthly split); the mature contribution bridge uses its own cohort values; inventory rolls forward £120,000 + £284,413 − £260,413 = £144,000; purchases, recognised COGS and supplier cash paid remain distinct. New diagnostics remain behind disclosures. The alternative £24 CPA calculation uses the central scenario model and is labelled a separate sensitivity without changing the active draft.

The independent browser was no longer available when this bounded follow-up began (the earlier review tab had been closed). Therefore the additional diagnostic visual checks are static/financial here; the integration lead owns their final desktop/mobile browser check and screenshots. Earlier browser results above remain valid for the journeys actually observed, and are not extended by assumption to the new charts.

## Lead integration addendum — second visual batch

The lead subsequently browser-checked the new Profit overhead diagnostic and Growth quarter-composition/mature-cohort bridges at actual CSS 1440 × 900, and the expanded acquisition/stock diagnostics at 390 × 844. This is lead integration evidence, separate from the independent browser pass above. Settled page width was 390px. The incomplete-cost stock state withheld COGS and its reconciliation while retaining separately supported book balances and cash flows. Source-level records, exact all-33 visual parity and live services remain outside these claims.
