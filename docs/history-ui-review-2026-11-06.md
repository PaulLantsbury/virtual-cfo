# Supported monthly history UI review — 6 November 2026

Reviewed the actual preserved overnight changes in all seven UI/composition/test files, the final overnight handover and preserved review diff, the remote documentation checkpoint `f3de546eae21f0c5e881c064e02de39c33fa76e3`, and the newer product roadmap at `ec6c7a8d5e87b53462c40cf7dffacf8e115535e0`. This review prepares source for a staging candidate; it does not deploy or activate a daily feed.

## Findings fixed

1. **Authenticated selection boundary.** A second signed-in identity at the same business could inherit the first identity's explicit history choice. Choice enablement now requires the authenticated identity, business and edition together. Query keys already include identity/business/edition/month/version; requests retain abort signals and server authorisation. A reload starts without a choice.
2. **Withdrawn choices.** A previously chosen version disappearing entirely from the checked listing was shown as unselected. Both absent and explicitly invalidated versions now produce invalidated state, with no old money. The explicit requested month/version remains in the evidence context for diagnosis.
3. **Blank unsupported output.** A payload could pass metadata validation but fail financial adaptation, leaving an empty supported status with no composition. Read-state classification now checks the final reporting adapter. Invalid source amounts/counts produce explicit unavailable output.
4. **Mutable evidence.** Compositions aliased the caller's selection and parts of the response. Each month now owns a defensive evidence copy and recursively frozen composition, so later cache/selection mutations cannot silently change money or context.
5. **Prepared-result trust.** The shared evidence component accepted a caller-provided prepared view without checking that it represented its current input. It now validates against the canonical same-input result and falls back to that result on any difference. A foreign business/amount regression proves it cannot repaint cards.
6. **Aggregation precision.** Floating-point intermediate sums could lose a penny through cancellation even when every monthly amount and final total was a safe integer. Aggregation now sums integer pence using BigInt, then checks the final safe range. A three-month extreme-value cancellation regression demonstrates the original failure.
7. **Request comprehension and recovery.** Month choice and version choice now have different instructions. Failed month and evidence requests have explicit failed-check wording and retry controls. Denial, invalidation, loading and source-unavailable remain distinct; old money is withheld during each recheck. Explore remains available before a listing is loaded or after its failure.
8. **Supported conclusion and exact Explore.** The supported headline states actual selected-period EBITDA; missing profit evidence instead states that only sales are supported. The next step is evidence inspection, with no invented financial action or comparison. The same frozen monthly composition is available inside Explore as well as the independent composition section, including all seven amounts, operating-profit formula, original-order denominator, exact month/currency/timezone/source date, edition/anchor/version, formula and source revisions. Opening-balance caveats move into evidence detail to reduce initial reading load. Negative bars say “Negative amount”, avoiding a false loss conclusion for an individual negative component.

## Financial and lifecycle review

Cards, the monthly chart/value table and Explore use the same selected, canonical adapted result. Product gross profit and margin exclude shipping; turnover, contribution, operating and EBITDA margins include shipping. Operating profit is supported EBITDA less supported depreciation/amortisation, with unsafe or unreconciled evidence withheld. Missing profit is a gap, not zero. Original eligible order counts and original product amounts are summed before per-order/AOV ratios; monthly ratios are never averaged. Zero denominators remain unavailable. Cross-business, cross-version, cross-month, wrong edition/anchor/source-date and invalidated responses fail closed. London summer month-end conversion remains tested. No multi-month trend selector or comparison is implied by the single-month UI; the contiguous-series helper remains preparation only.

The original January opening basis remains distinct from the two-year history edition. No cash, inventory, cohort, channel, provider-freshness, monitoring or daily-feed readiness claim was added. Availability is explicitly a list of candidates requiring selected-read verification, not a readiness/freshness assertion.

## Validation and remaining release gates

Focused local Node tests: **18 passed, 0 failed** — 15 history tests and 3 bundled React server-render tests. Four new pure regressions cover identity/withdrawal, malformed source state, immutable evidence and exact extreme-value summation; three new render tests cover lifecycle withholding/retry/Explore, exact displayed values/context and prepared-view rejection. The existing genuine QueryObserver delayed-response test remains passing. Frontend TypeScript passed after the review changes. Root integration owns the full suite/build and source export.

The render tests use the existing Vite/esbuild toolchain and real React server rendering; they do **not** mount the authenticated page, execute browser events, exercise a real HTTP/auth lifecycle, or establish mobile/keyboard/visual acceptance. The delayed-response regression uses QueryObserver, not the mounted host. Native `details`, buttons, labels, region focus and the value table are present in markup, but actual browser focus/scroll/390px layout still needs inspection.

Consulted approved v11 principles, navigation, shared page contract, period/per-order rules, Profit specification and native default/expanded Profit mockups 03/04. Requirements addressed: SH02–SH05, DT03–DT04, UN01 and PR03. Full approved multi-month chart parity, all default/expanded visual comparisons, screen-reader/keyboard/mobile checks, signed-in exact-month/version interaction and representative-owner ten-second comprehension remain **open staging release acceptance gates**. No representative-owner comprehension test or browser acceptance is claimed. No connected service was accessed by this reviewer.

## Exact UI review file manifest

- `artifacts/virtual-cfo/src/lib/v11-tests/history-supported.test.ts`
- `artifacts/virtual-cfo/src/lib/v11-tests/history-ui-render.test.ts` (new)
- `artifacts/virtual-cfo/src/lib/v11/history-supported.ts`
- `artifacts/virtual-cfo/src/lib/v11/history-composition.ts` (preserved overnight new file, reviewed and amended)
- `artifacts/virtual-cfo/src/pages/v11/HistoryLivePage.tsx`
- `artifacts/virtual-cfo/src/pages/v11/history-supported-panel.tsx`
- `artifacts/virtual-cfo/src/pages/v11/supported-evidence-panel.tsx`
- `artifacts/virtual-cfo/src/pages/v11/history-monthly-composition.tsx` (preserved overnight new file, reviewed and amended)
- `docs/history-ui-review-2026-11-06.md` (new)


## Parent hosted acceptance update
Exact web revision c7e69211be65b5fb054062d327451844042d38bc is live. Signed-in January/October cards, monthly composition and Explore agreed; month changes withheld prior figures and reset version selection. Original January recheck and unsigned direct API refusal passed. Keyboard Enter toggled the chart disclosure. These limited checks do not establish comprehensive race/error, screen-reader, phone layout, full mockup parity or representative-owner ten-second acceptance. See [current roadmap](roadmap-2026-11-06.md) and [website release](staging-web-release-2026-11-06.md) for current status.
