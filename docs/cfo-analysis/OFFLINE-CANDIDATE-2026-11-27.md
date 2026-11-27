# Comparative CFO beta candidate — 27 November 2026

Offline source prepared on released baseline `4b83819400ba6264731a4eb7cf176705df4f5800`. No publication, deployment, model request, new credentials, database change or provider action occurred. The canonical approved rulebook and existing financial calculations are unchanged.

## Independent-review corrections

Independent testing of initial candidate `384c2a98050128b82dda0f168c84966891614b1f` found two defects: additional nested scope fields survived generic presentation output, and supplying the selected month as its own prior period cleared otherwise valid current facts. The corrected candidate explicitly projects the seven declared scope fields and checks prior calendar-month eligibility before appending its source. Shared engine strictness, formulas, declarations and raw/model payload boundaries are unchanged.

Correction validation: 42/42 focused test entries passed, including the tester’s two unchanged reproduction files and new regressions for ready/stale/partial scope projection, model success/fallback output, and duplicate-month current-fact preservation. The count includes the nested test container; it is not 42 independent scenarios. Strict declaration compilation and whitespace checks passed. The earlier full build receipt belongs to the initial candidate; it was not relabelled or redundantly rerun for this isolated correction. Separate tester retest of the corrected frozen revision remains pending.

## Delivered behaviour

`lib/cfo-analysis/index.mjs` explains a selected completed month versus its immediately preceding complete calendar month. It reuses the existing evidence engine to recompute and validate every fact. Six component changes reconcile exactly to operating-profit change: net product sales, net shipping, cost of goods, variable costs, advertising and overheads including depreciation/amortisation. D&A is not deducted twice. Negative amounts and zero remain numbers; missing is never zero.

The result has a headline, arithmetic explanation, checked facts, full component bridge, dated source references and one records investigation focused transparently on the largest absolute component movement. This is not opportunity ranking, proof of cause, savings, a forecast or safe-spend advice. If every component is unchanged, no investigation is invented. Missing prior evidence preserves supported current facts, but withholds comparison/action. Stale evidence retains dated facts only. Company mismatch, denial and invalidation clear content.

`experiments/synthetic-company/history-cfo-analysis.mjs` maps the existing raw history reports, independently checks every component against the unchanged shared calculation, and builds the selected/prior evidence packet. It performs no database or network access. `prepareHistoryCfoAnalysis` is server-only and its raw packet MUST NOT be serialized to browser or model. `createHistoryCfoAnalysis` returns only the presentation contract.

`lib/cfo-analysis/model.mjs` implements an optional OpenAI Responses adapter, off by default. It regenerates the checked analysis, sends minimal aggregate amounts and accepts only one to three existing fact keys for presentation emphasis. It never displays generated prose or lets the model alter figures, recommendations or policy. Invalid response, unsupported selection, refusal, timeout, unavailable evidence or budget exhaustion keeps the deterministic result. This is a constrained AI selection pilot, not conversational Ask or autonomous financial advice.

## Integration contract and remaining work

See `lib/cfo-analysis/index.d.mts`, `model.d.mts` and `experiments/synthetic-company/history-cfo-analysis.d.mts`.

1. Within the existing authenticated history service, resolve both exact sealed months with membership, revision, completeness and freshness checks. Pass those trusted assertions to the history adapter; do not accept browser assertions.
2. For deterministic analysis call `createHistoryCfoAnalysis`. For a separately approved finite model pilot call `prepareHistoryCfoAnalysis`, then the pilot with its `{input,expected}`. Only the adapter's minimized request reaches the model.
3. Return the presentation result. Pages must match company, period, selection version and source revisions; discard in-flight results after company/month/access changes and clear on loading/error/sign-out. There is no separate answer cache in this package.
4. Render headline, the selected checked facts, one investigation if present, and limitation; retain full bridge and dated sources in Explore. Distinguish deterministic fallback from a valid model selection and synthetic from fictional evidence.
5. Independent tester assesses the exact candidate and subsequently the integrated owner journey. Then seek exact source/release approval as required. This package does not wire a route, history reader or Scout markup and is not live acceptance.

## Validation and limits

Development checks: 86/86 combined analysis/model/history and existing engine/profit calculation regressions passed; 11/11 final backend checks passed (overlapping, not additive). Strict declaration compile and full workspace typecheck/production build passed. The history tests run a disposable local database with generated data, never hosted data. Existing frozen-lockfile dependencies were reused with package-manager pre-run dependency installation disabled; no dependency versions changed. Existing build size warnings remain.

A separate implementation agent reviewed the backend/history modules without editing them and found no concrete blocker. This is internal development review, not the separately requested independent tester acceptance. Model tests use a fake transport; actual account model access, provider retention configuration and end-to-end latency remain unverified.

## Verified generated example

This is generated synthetic source in a disposable database, not a fresh live-company observation or model response. April to May 2025:

- Net product sales: £43,200.00 to £50,400.00 (+£7,200.00).
- Net shipping: £1,800.00 to £2,100.00 (+£300.00).
- Cost of goods: £21,600.00 to £25,200.00 (+£3,600.00 cost).
- Variable costs: £6,501.00 to £7,297.00 (+£796.00 cost).
- Advertising: £1,800.00 to £2,100.00 (+£300.00 cost).
- Overheads including D&A: £13,122.98 to £13,122.96 (-£0.02 cost).

Operating profit increased £2,804.02, from £1,976.02 to £4,780.04. Positive effects £7,500.02 less offsets £4,696.00 reconcile exactly. The next check is the records behind the £7,200 net-sales movement, confirming period and classification before considering commercial change. These figures establish arithmetic, not why sales changed.
