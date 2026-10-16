# Data source and integration plan — 17 September 2026

Status: Package 1 specification and implementation backlog. This document inspects repository code and recorded staging evidence; it does not certify today's database contents or external connections. No live queries, credentials, migrations, application changes or new financial policies accompany it. Product sequencing follows Paul's approval of the 17 September roadmap. Detailed contracts below remain implementation proposals where marked.

## Existing foundation to retain

The authoritative [13 September checkpoint](session-handover-2026-09-13.md) records applied staging sales/profit evidence and synthetic Store D verification. Older source inventories describe earlier states; in particular their statements that Profit Overview is entirely static, historical-cost evidence is not installed, or a Shopify writer does not exist are superseded in the areas below.

| Input or capability | Verified from current code | Recorded staging status and remaining limit |
| --- | --- | --- |
| Store identity, currency and timezone | `useSalesReporting.ts` reads store configuration, shares period selection and calls the evidence-aware RPC adapter; no automatic search for an older order-containing month | Store membership and isolated staging setup recorded. No fresh membership or data check today. |
| Sales and refund evidence | `finance_v1` order/refund/coverage mapping feeds `rpc-sales-adapter.mjs`; actual event dates, tax components, original eligibility and coverage govern results | Applied sales evidence and synthetic A/B/C/D work recorded. Rows alone do not certify coverage; no live merchant feed. |
| Historical COGS and stock recovery | `profit-evidence-reader.mjs`, `profit-sales-reader.mjs` and `profit-evidence.mjs` share one scoped transaction and versioned actual-cost/expense contract | Five private profit evidence tables and restricted read access applied; Store D February, March refund and April recovery verified on 13 September. No general external cost importer. |
| Monthly profit API | `profit-reporting-service.mjs` authenticates and checks membership, then accepts exactly one matching sealed month/version; route returns scoped, sanitised metrics | Profit Overview, CFO Briefing and Margin Analysis consume the same `useProfitReporting` hook. More than one version is unavailable until explicit selection exists. Weeks and partial months are not supported profit periods. |
| Expenses | Evidence groups for actual variable costs, advertising and overheads, with identified D&A included in overheads; public overhead and marketing rows are validated against evidence | Synthetic actual expense records demonstrate calculations. Complete merchant expense feeds, source arbitration and broad accounting mappings remain outstanding. |
| Shopify extraction and mapping | `experiments/shopify/client.mjs`, `collect.mjs`, `queries.mjs`, `map-sales.mjs`: fixed read operations, pinned API version, identity checks, bounded retrieval, conservative original-sale/refund mapping | Synthetic API-shaped tests only; no installed development-store connection or live API compatibility claim. |
| Shopify persistence/review/import | `record-candidate.mjs`, `source-versions.mjs`, first/subsequent import writers, review authorisations, invalidation/restoration and restricted `import-runtime.mjs` already exist | Earlier handovers record synthetic staging import/review exercises. These are not a scheduled live connector. Collector success and import receipt never automatically certify coverage. |
| Cash | Existing cash snapshot structure and isolated calculation examples | No established complete classified cash-flow feed, reconciled account set or merchant runway; existing cash samples are not actuals. |
| Xero, Meta and Google integrations | Existing legacy marketing/schema material is available for reuse; no completed external connector established by this review | No live connection or verified financial ingestion recorded here. A seeded table/RPC is not evidence of an external integration. |

Code anchors: `artifacts/virtual-cfo/src/lib/analytics/useSalesReporting.ts`, `useProfitReporting.ts`; `artifacts/api-server/src/routes/profit-reporting.ts`; `experiments/financial-v1/profit-reporting-service.mjs`; `experiments/shopify/import-runtime.mjs`. File comments saying “prototype” or “future” can be older than later integration: determine availability from imports, routes and dated execution records, not comments alone.

## Authoritative source ownership

“One dataset” means one canonical, traceable reporting contract in Supabase. It does not mean discarding source records or forcing different operational/accounting timings to agree. Retain source provenance, normalised events, reconciliation differences and derived metrics as distinct layers; pages must consume the same scoped result rather than maintain their own totals.

| Financial fact | Intended evidence authority | Conflict and duplication rule |
| --- | --- | --- |
| Original commerce order, discounts, shipping, VAT and successful refund event | Shopify source events normalised under Night Scout's already approved rules | Do not replace original sale facts with current order status/totals, or event date with import date. Refunds remain linked to original orders but reduce the event month. |
| Historical landed cost and saleable inventory recovery | Evidenced cost applicable at sale and actual restock event, from an appropriate inventory/accounting source | A current Shopify variant cost or refund line does not prove historic COGS/recovery. Do not invent allocations; retain unsupported status. Source selection may vary by merchant and must be explicit. |
| Accounting overheads, D&A and ledger actuals | Proposed Xero account/transaction evidence plus explicit classification | Preserve original ledger IDs and dates. Explain timing, VAT and classification differences from commerce; do not add ledger revenue to Shopify revenue. Agency fees, salaries and software retain approved overhead treatment. |
| Period advertising cost | Initially evidenced advertising expenses; later reconciled platform and accounting evidence | Select an explicit authority per scope. Platform spend and Xero invoice/accrual records describing the same cost must not both be deducted. Unresolved currency/timing differences need a reconciliation record. |
| Cash balance and movement | Complete, dated bank/payment-account evidence, with restrictions and unsettled balances classified | Profit/contribution is not cash. Transfer matching prevents double counting; accounting synchronisation alone does not prove bank completeness. |
| Customers/cohorts | Commerce identities and order history, after identity/eligibility policy approval | No name/email inference, arbitrary merging or customer-level profitability from blended averages. The current Shopify query avoids personal customer fields. |
| Platform attribution | Meta/Google source-reported metrics, with their own dates/windows | Label platform-reported attribution separately; overlapping claims are not additive commerce sales or proof of incremental lift. |
| Budget, forecasts and scenarios | Explicitly versioned management assumptions plus a disclosed baseline | Never write a scenario back into actual evidence. Unsupported marketing response, forecast and payback assumptions stay unavailable. |

## Shared metric mapping

Use [agreed financial definitions](agreed-financial-definitions.md). Contribution before marketing is already approved; adding it to a screen is not permission to change cost classifications.

| Output | Required shared inputs |
| --- | --- |
| Net product sales; original-order AOV | Verified product sales/discount/refund events; matching original eligible orders for pre-later-refund AOV; shipping/VAT separate |
| Gross profit | Net product sales minus evidenced historical COGS, including separately dated supported stock recovery |
| Contribution before marketing | Gross profit plus net shipping minus variable operating costs |
| Main Contribution | Contribution before marketing minus period advertising |
| Operating profit | Main Contribution minus operating overheads, including D&A |
| EBITDA | Operating profit plus the same identified D&A already deducted |
| Contribution/operating margin | Corresponding amount divided by net product sales plus net shipping; current implementation withholds ratios for non-positive denominator |
| Comparison/observation | Same metric definition and compatible store, currency, period and completeness in both periods; no comparison or causal explanation from missing baseline |
| Cash/runway | Dated unrestricted cash, complete classified flows and approved three-complete-month burn basis; outstanding edge policies remain separate decisions |
| CAC, cohort contribution/payback, growth quality | Customer identity/cohort facts, acquisition-cost scope and appropriate observed horizon; new definitions/assumptions require explicit approval |

No unsupported metric is zero-filled. Independently valid sales or gross profit survive missing downstream expenses. Scope, revision, provenance and availability should accompany any decision-card input, not just its formatted number.

## Conceptual extensions: prepare only where absent

These are requirements for later design, not proposed SQL or approval to install tables.

- Connection lifecycle: tenant-to-source installation identity, server-side credential reference, granted permissions, revocation/disconnection and collection status. Do not store tokens in browser state or public documentation.
- Durable extraction operation: resumable cursor/watermark and limits, source changes/deletions, reconciliation manifest and checkpoint. Reuse current candidate versions and receipts rather than another replay ledger. Collection completion must remain distinct from reviewed coverage.
- Source-to-canonical line mapping: preserve Shopify order/line/refund identity through existing orders and historical-cost links. Current sales writer inserts orders/refunds but does not establish a general historic-cost or order-line ingestion pipeline.
- Accounting reconciliation: ledger account/category mappings with effective versions; source period/currency and revision; bridge differences, review status and adjustments. Explicitly resolve duplicate advertising/cost representations.
- Cash: account-set completeness, restrictions/unsettled classification, dated balance/transaction evidence, paired transfers and forward commitments. Forecast assumptions and actual cash require separate versioned contracts.
- Customer economics: pseudonymous source identity mapping, cohort assignment/version, observed horizon and coverage, acquisition-cost taxonomy. Implement only after definitions and data minimisation are agreed.
- Decision evidence: source report/version references, comparable-period coverage, observation provenance, known limitations and confidence reason. Do not encode guessed opportunity amounts as facts.

## Integration sequence

1. Finish the bounded existing-data CFO journey below. Then build a Shopify development-store connection into the existing intake/review/import path, validate actual API behaviour and source reconciliation, and test on synthetic development transactions. Resolve unsupported cases explicitly. Shopify sales alone cannot unlock all profit components.
2. Xero reconciliation and cash inputs: prepare account mappings and discrepancy categories before installing a connector. Begin accounting actuals/reconciliation; only then complete supported Cash Control. Treat the 13-week forecast as a separately approved assumptions package.
3. Meta: reconcile spend first, then source-reported performance and supported customer economics. Do not infer incremental returns or causal recommendations from attribution.
4. Google Ads: extend the same spend/attribution contract and prove cross-channel deduplication. Do not build a second financial calculation path.

Recheck current official platform installation/API documentation when implementing a connection; this repository review does not assert current external platform requirements. No account setup is needed to complete Package 1 or the first existing-data coding slice.

## Package 2 internal milestone: evidence-backed CFO observations

The first internal milestone of the proposed, larger roadmap Package 2: turn the existing shared monthly sales/profit result into a small, deterministic CFO observation panel and verify consistency across CFO Briefing, Profit Overview, Margin Analysis and Verified Sales. Use existing synthetic Store D and current reader; no new financial rules, external connection or cost engine.

Acceptance:

1. Consume the existing report and scope, with no page-local profit arithmetic or legacy RPC fallback. Use the existing `contributionBeforeMarketing` metric already exposed by the shared engine and `profitMetricKeys`; do not reconstruct it independently in pages.
2. Show sourced current-month facts and evidence/completeness observations. A factual profit bridge is not a claim about what caused a period-on-period change. Do not create materiality thresholds, forecasts, rankings or recommended financial actions until approved.
3. Cards use the proposed observation/driver/impact/outlook/action/guardrail/confidence structure, with unsupported elements omitted or explicitly unavailable; this does not authorise invented content to fill every field. Confidence explains evidence state rather than an arbitrary percentage.
4. Deterministic tests assert the recorded Store D February values (sales £140, shipping £5, gross profit £80, contribution £60, operating profit £35, EBITDA £40), March refund and April recovery; also missing costs/expenses, authentic zero, negative amount, wrong store/currency and stale response. Expected fixture values belong in tests, not application results.
5. Browser checks prove matching scope and shared values across those pages, correct unavailable states and sample separation. Do not claim site-wide reconciliation from four pages.
6. Preserve read-only access; no writes, schema/grants, automatic completeness restoration or financial-review sign-off. Update docs and GitHub development branch, then check existing local staging. Production/Replit remain separate.

Continue directly within the same approved Package 2 into Shopify connector/runtime readiness, synthetic end-to-end tests and documentation, reusing existing code. Prepare a precise account/access request and any genuinely needed reviewed schema delta; do not seek another approval merely to move from observations to connector preparation. The connector must demonstrate a supported synthetic sale/refund round trip, retry safety, changed-source invalidation, review visibility and blocked unsupported cases before proposing application to staging. A complete small-store live read and independent reconciliation strategy are necessary before merchant completeness claims; a passing mocked test suite is insufficient.

## Minimum decisions and runnable boundary

One Package 2 approval should cover the factual-observation milestone, connector/runtime readiness, synthetic end-to-end tests, documentation and local staging verification. These preparatory activities can run without a Shopify account and do not need repeated milestone approvals or a new calculation rule. Materiality/risk thresholds, causal driver explanations, opportunity ranking, forecast effects and confidence scores are excluded, so none blocks that slice. Before adding recommendations, Paul must approve which evidence-based triggers and controlled actions are appropriate; propose worked examples rather than asking abstract policy questions.

Actual Shopify development setup is the concrete account/access boundary within that package, rather than a reason to stop its independent preparation. New migrations or grants, if inspection demonstrates a genuine gap, need a reviewed proposal and separate approval. Do not repeat already approved Store D setup or nine-table read grants. Xero account mappings and duplicate-cost arbitration, cash edge cases and CAC/cohort policy are decisions for their relevant later packages, not reasons to delay existing-data observations.

## Package 2 integration backlog — coordinator consolidation

One proposed coding-package approval covers these internal milestones, not repeated approvals per step:

- P2.1: Move remaining legacy actual sales/discount reads (including Growth Quality and Pricing & Discounts) onto existing shared scope/definitions, withholding unsupported deeper diagnostics. Do not change separately labelled sample models or invent customer metrics.
- P2.2: Add deterministic current-period CFO observations from supported shared reports, including evidence gaps. Retain existing names; no causal recommendations, scores or forecast assumptions.
- P2.3: Prepare existing Shopify collector/candidate/review/import integration and runtime lifecycle, with testable credential boundaries and an exact development-store setup checklist. Reuse existing review and retry controls.
- P2.4: Run focused integration and browser tests, check combined local staging, document limitations and publish the package. Live connector verification is a distinct completion gate requiring a configured development account, not something mocked tests can satisfy.

Ownership: application worker P2.1; reporting worker P2.2; connector worker P2.3; coordinator integrates and assigns independent review across completed portions. Shared hook/API changes remain coordinator-owned to avoid conflicting edits. No new SQL application or access grants are authorised by this backlog. If external access is absent, complete and stage the independent deliverables and report live verification as outstanding; never mark the full Shopify journey complete.
