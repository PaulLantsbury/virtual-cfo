# v11 implementation — 31 October 2026

## Batch 1: shared financial foundation and seven-destination review

Baseline: `codex/restart-baseline` at `f599883`. The approved v11 package is read-only design authority. Work takes place in a separate checkout; the older recovery and design-publication checkouts are preserved. No main merge, production release, database migration or operational writer/reader change is included.

The latest private operational checkpoint supersedes historical prepared-only statements in the 30 October public handover. Shopify/Xero scheduled transaction acceptance is still a separate gate. Neither a successful connection nor these fictional review pages establishes financial completeness. This batch does not run a provider transaction or claim scheduled acceptance.

### Assessment

The application already has authenticated store access, source-scoped reporting, evidence and incomplete-data protections, historical financial calculations, a Sankey implementation, and a scenario prototype. The current navigation and page compositions predate v11. Existing scenario assumptions and historical period helpers differ from the approved fixtures and business-local calendar contract. These cannot be reused as v11 defaults without reconciliation.

The new review must use explicit fictional data, never silently substitute samples when live data are missing. Existing merchant pages and access gates remain available. The seven-destination v11 surface is opt-in while source adapters and capability services remain incomplete.

### Ownership and shared contracts

| Owner                  | Files                                                                                                    | Responsibility                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Lead                   | entry point, route integration, `src/v11-preview.*`, `src/v11-service-pages.*`, this record and handover | Seven-destination shell, Monitoring/Settings, isolation, integration, publication and final checks               |
| Interface agent        | `src/components/v11/*`, `src/pages/v11/*`                                                                | Approved default/expanded compositions, navigation callbacks, evidence disclosure, charts and states             |
| Financial/data agent   | `src/lib/v11/*`                                                                                          | One financial dictionary, full-precision fixtures, calendar context, denominators, scenario methods and evidence |
| Independent test agent | `src/lib/v11-tests/*`, independent verification record                                                   | Independently derived expectations, financial edge cases and interface review                                    |

All `src/` paths above are under `artifacts/virtual-cfo/`. Agents share one checkout with disjoint ownership. The lead integrates changes before another batch starts.

`V11Workspace` receives a section, optional initial sub-tab and a navigation callback. Financial values come from the central v11 library. Monetary fixture inputs retain full precision until formatting. A metric's context and readiness travel with its evidence. Missing values stay unavailable, and scenario methods resolve orders exclusively from the active method. Source data and scenario assumptions are distinct scopes. Materiality colours require a configured versioned tolerance; no numeric tolerance is invented.

### Scope and acceptance

Build the seven destinations and specified sub-tabs using mockups 01–33. First-batch requirements span SH01–SH05, DT01–DT04, UN01–UN02, SV01–SV03, PR01–PR04, GM01–GM08, CC01–CC06, SP01–SP07, MN01–MN03 and ST01–ST04 as applicable. Completion must be recorded per requirement rather than inferred from this scope list.

Checks: independent fixture arithmetic and conservation, own-period per-order denominators, missing-data gates, business-local calendar ranges, scenario exclusion, chart/table agreement, navigation and contextual evidence, selectors, disclosures, desktop and 390px layout. Human ten-second comprehension remains a later owner test, not something screenshots prove.

Persistence, real monitoring/delivery, invitations, financial execution and live source certification remain unavailable unless separately implemented and verified. No disabled or sample control may claim success.

## Status

Both implementation batches are complete and locally tested within this session. Hosted staging and production are not deployed or verified by this work.

## Requirement coverage — review surface, not live acceptance

| Requirements / pages              | Implemented and checked                                                                                                                                                       | Remaining boundary                                                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| SH01–SH02; all seven destinations | Shared shell, purpose/verdict/action, disclosures, persistent contextual Explore, correct sub-tabs, retained current merchant routes                                          | Not the default live merchant interface; exhaustive parity with all 33 references remains an acceptance exercise                                  |
| SH03–SH04; DT03                   | Explicit sample, quiet, incomplete, stale, failed, no-connection and loading examples; independent subtotals; scope/cost evidence gates; source adapter rejects substitutions | Actual source adapter needs verified snapshot metadata and page wiring; examples do not certify live completeness                                 |
| SH05                              | Keyboard controls, native disclosures, evidence-dialog Escape/focus, desktop and 390px browser journeys                                                                       | Exhaustive screen-reader/accessibility audit and representative-owner ten-second test remain unperformed                                          |
| DT01–DT04; UN01–UN02              | Completed London ranges, custom/comparison/None, overlap/leap policies; own-period full-precision per-order values and chart/table agreement                                  | Fictional calendar reference is explicitly 1 October; only Q3 fixture values exist; absent monthly order counts withhold monthly per-order trends |
| SV01–SV03; Scout’s View           | Four cards, same supported profit/cash story, three closed diagnostics, contextual stock/discount/acquisition actions; quiet/incomplete examples                              | Real finding ranking requires verified merchant evidence; no permanent live stock warning is installed                                            |
| PR01–PR04; Profit Engine          | Conserving Sankey, total/per-order values, trends, signed profit waterfall, economics, overhead break-even and included-once staff diagnostics                                | No numeric materiality tolerance is invented; staff comparison data are absent                                                                    |
| GM01–GM08; Growth & Marketing     | Investment Scorecard, Customer Economics and Channels; mature payback curve, selected-channel trends and reconciled spend; unknown blended ROAS remains unknown               | Channel-matched contribution, attribution-overlap resolution, missing Google monthly series and live cohort evidence remain unavailable           |
| CC01–CC06; Cash Control           | Dated bank cash, compact bridge, two signed cash waterfalls, stock/supplier and collections reconciliation, separate flow/balance trends; affected section handoffs           | Source-level payout/invoice/product-ageing records and 13-week forecasting are not supplied; read-only investigation only                         |
| OP01–OP03; AC01–AC02; Plan        | Inspectable fictional ranking, scoped next steps, empty/active/overdue action examples and their original dates                                                               | Real acceptance, versioned history, ownership/review persistence and permissions remain unavailable; no savings claim follows completion          |
| SP01–SP07; Scenario planner       | B01 baseline, exclusive growth methods, shared inputs, reset controls, exact decimal GBP input, conditional bridge and active-context assumption/evidence review              | No scenario/action is saved, monitored or executed; cash funding, VAT and settlement timing are not modelled                                      |
| MN01–MN04; Monitoring             | Six distinct fictional states, scoped check/delivery distinction, unchecked consent, in-app example briefing and unavailable activation/preferences                           | Real checks, consent storage, delivery queues, retries and audit history are not implemented                                                      |
| ST01–ST04; Settings               | Connections/readiness details, blank guardrail drafts with validation and review, planned role policy; disabled save/invite/export/disconnect/billing                         | No actual connection, access, billing or guardrail setting is modified                                                                            |

## Core batch verification

- **54 independently derived v11 tests passed**, including exact decimal input, historical/scenario fixtures, both units, cash/marketing/cohort reconciliation, date/DST boundaries, evidence and reporting-adapter gates.
- **57 existing reporting/authentication tests and 20 existing financial/event tests passed**. Combined final command: **131 passed, zero failed**.
- Frontend TypeScript check and production Vite build passed. The build retains non-fatal tooltip sourcemap, mixed static/dynamic import and large-chunk notices; no warning was suppressed to obtain a pass.
- Independent browser testing exercised real controls at actual CSS **1440 × 900** and **390 × 844**. All seven mobile destinations stayed within 390px. Corrected profit leakage, missing scenario evidence, monetary-delta and overflow issues were rechecked.
- Separate source review found no gating issue in the development preview isolation, existing store-access gate, source adapter or unavailable-service controls. This is not a live authorisation or deployment test.

Run `pnpm test:v11` for the new suite. The complete combined command used Node's test runner over `src/lib/v11-tests/*.test.ts`, existing `src/lib/analytics/*.test.ts`, `src/lib/auth/*.test.ts`, `experiments/financial-v1/calculations.test.mjs` and `event-evidence.test.mjs` (frontend paths under `artifacts/virtual-cfo`).

### Review and delivery status

| Stage                    | Status                                                                            |
| ------------------------ | --------------------------------------------------------------------------------- |
| Implemented              | Core fictional workspace, shared finance/evidence library and pure source adapter |
| Locally tested           | Automated, typecheck, build and the scoped desktop/mobile journeys above          |
| Local review             | `http://127.0.0.1:4311/design/v11/scout`, after `pnpm review:v11`                 |
| Hosted staging verified  | No; no hosted page deployment is part of this batch                               |
| Production / main merged | No                                                                                |

## Bounded second batch — supported diagnostic visuals

After the core checks passed, a bounded second batch added Profit's monthly overhead ratios; Growth's CM3/overhead coverage, first-order acquisition and mature-cohort bridges, plus quarter-only 40%/60% composition; Cash's purchases/COGS/supplier-payment comparison and inventory roll-forward; and the optional collapsed adverse-CPA sensitivity. These use the same central fixtures and accessible value tables. Defaults remain closed.

### Second-batch integration receipts

The independent suite retained **54 passing tests**, with stronger checks for the negative first-order result, the mature cohort's own £26 + £29 − matched CAC bridge, and each monthly overhead ratio. The existing adverse-CPA sensitivity remains £25,900 EBITDA without changing the active scenario.

The lead browser-checked the new overhead diagnostic and Growth composition/cohort bridges at actual CSS 1440 × 900, and expanded acquisition/stock diagnostics at 390 × 844. Settled page widths remained 390px; wide chart/value-table content scrolls inside its own panel. The incomplete-cost stock example now withholds COGS and the inventory reconciliation while retaining separately supported dated book balances and purchases/payments. The Sankey refuses missing inputs, non-positive revenue or negative flows and retains a numeric evidence table instead of drawing invalid ribbons. Evidence focus returns to the actual invoking control.

The complete final regression, frontend type check and production build are repeated after these changes before publication. Final publication uses an expected-head lease on `codex/restart-baseline` to preserve concurrent work. No hosted staging, main merge or production release is inferred from GitHub publication.

### Residual acceptance work

Pixel-for-pixel acceptance of every expanded/alternative reference, exhaustive assistive-technology testing, staff comparison inputs, absent monthly/per-order and Google series, provider/product record drilldowns, verified live snapshot metadata and merchant-page wiring remain explicit follow-ups. The representative-owner comprehension test is still required. No fictional page state, local draft, passed unit test or successful import substitutes for those gates.
