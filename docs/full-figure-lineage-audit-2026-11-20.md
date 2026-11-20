# Every figure: source and calculation audit — 20 November 2026

## Answer in plain language

A displayed value does **not** need its own database cell or column. It needs a complete, correct chain back to its inputs. A calculated figure remains connected when its financial inputs come from the selected company's verified database records. An entered target, cash buffer or scenario assumption can legitimately come from the user; it must be labelled as an assumption, not an observed fact.

The previous **4 of 13** count covered headline cards only. It was not a count of all figures. This audit includes connected views, explicit sample views, expanded tables, comparison values, chart series, action estimates, scenarios and saved-browser states.

The audit is against released source **a77e65822345087aa708fad19c98bbf3e9a73b21**. The relevant working source was compared with that exact revision and matched. This batch changes documentation only; it does not claim that all missing connections have now been implemented.

## Where the calculations actually run

| Layer | What happens now | Stored as a separate result for every displayed figure? |
| --- | --- | --- |
| Supabase | Stores mapped orders, refund events, historical unit costs, returns, journal/expense postings, reporting coverage and sealed evidence/version metadata. | No. The selected monthly evidence uses source records and integrity/version records, not one database column per webpage answer. |
| Reporting server | The authenticated history service reads that month's authorised records in a read-only transaction. It validates hashes/scope/coverage, computes canonical sales/cost/profit amounts and checks the selected source revision against the seal. | These read results are returned to the page; this read path does not write a newly calculated result back for each cell. |
| Webpage | Validates and reconciles the response, then calculates margins, per-order amounts, differences, ratios, chart geometry and evidence tables. | No. The same verified response can drive many cards, chart points and table entries. Those are connected calculations. |
| Scenario/sample webpage | Runs conditional calculations from editable assumptions and, currently, a separate built-in example baseline. Some review drafts are saved in browser localStorage. | They are not actual results in Supabase. A user assumption needs a label, not an invented database source. Real saved plans would need a separate persistence/version contract. |

### Concrete examples

- **Blended ROAS:** selected-month net turnover / advertising spend. October's database-backed £67,500 / £2,700 = **25.00×**, calculated in the webpage. It is connected even though there is no separate stored ROAS cell.
- **POAS:** contribution before advertising / advertising. The same month's £26,215 / £2,700 displays **9.71×**. This browser ratio is also connected.
- **Per-order EBITDA:** source EBITDA £10,592.05 / 1,790 original eligible orders displays **£5.92**. The denominator must be from that same month, not the sample order count.
- **Cash above buffer:** bank cash − the owner's chosen buffer is a valid webpage calculation in principle. It is not connected today because eligible bank cash is missing, **not** because the owner typed the buffer.
- **Spend scenario:** verified baseline + explicit budget/response assumptions could form a connected conditional model. Current sample acquisition/customer inputs are still illustrative; connecting accounting totals elsewhere does not validate them or make the scenario a forecast.

## Server and browser source map

- `experiments/synthetic-company/history-reader.mjs`: `historySources` reads stored order/refund/line/return/event records; `calculateHistorySources` uses canonical `calculateMappedSales` and `profitBridge`; `readHistoryInTransaction` checks the selected revision/coverage/seal. Its transactions are read-only.
- `experiments/synthetic-company/history-schema.sql`: source and integrity/version storage. Monthly seals hold manifests/revision identifiers; they are not a separate persisted financial spreadsheet.
- `artifacts/api-server/src/routes/history-reporting.ts`: authenticated API boundary for available months and exact selected month/version. It delegates the calculations to the reader service.
- `artifacts/virtual-cfo/src/lib/useReviewedHistory.ts`: requests the selected evidence; identity/store/month/version choices isolate each response.
- `artifacts/virtual-cfo/src/lib/v11/history-composition.ts`, `reporting-adapter.ts`, `calculations.ts`: response scope checks, financial reconciliation and browser-side composition.
- `newProfitLiveModel.ts` and `marketing/linked-model.ts`: presentation calculations using those verified inputs. The separate `newProfitPreview.ts`, `marketing/review-model.ts`, cash sample and trend modules still supply explicit example modes.

## Full page registers

- [New Profit Engine — every output/source path](new-profit-full-figure-audit-2026-11-20.md).
- [New Marketing Efficiency — every output/source path](new-marketing-full-figure-audit-2026-11-20.md).
- [New Cash Control — every output/source path](new-cash-full-figure-audit-2026-11-20.md).

These registers count **logical numerical output/source-path families**, not every repeated card, table row, tooltip, response-grid point or chart bucket. Connected and sample paths are separate when their inputs differ. Controls, assumptions, dates, metadata and model intermediates are also recorded. No single percentage based on visible cell count should replace this dependency audit.

## What still needs work

### Existing data, missing page wiring

The current monthly reader already has complete reviewed financial months. Multi-month Profit/Marketing trends, fuller comparisons and financial-only historical diagnostics can use those inputs, but need every included period/version explicitly selected/validated and their aggregates/denominators correctly composed. This is additional wiring, not a request to create a database column for each point. Weekly or daily series cannot be inferred by evenly splitting a monthly number; they need an appropriate reviewed finer-period contract.

### Missing input data or a missing supported reader

- **Cash:** eligible dated bank balances and account coverage, stock/debtor/provider/supplier-credit movements, separate bank classifications and reconciliation. Existing journal activity is not automatically a usable unrestricted bank balance.
- **Acquisition/customer metrics:** matched acquisition spend, identified eligible first-time customers, first-order costs/contribution and mature cohort records. Fixed acquisition-share/customer-mix percentages are examples, not measured facts.
- **Action estimates:** eligible cost/product/staff records and a tested change or an explicitly hypothetical assumption. An accounting variance alone does not establish an achievable saving.
- **Saved actions/scenarios:** actual persisted baseline/input/formula version and review history, where real cross-device records are required. Local sample drafts are not reminders or measured outcomes.

### Legitimate calculations and assumptions that do not need extra result tables

ROAS/POAS, margins, AOV, per-order amounts, comparison differences, waterfall arithmetic, chart scaling, user targets, cash buffers and hypothetical scenario inputs do not each require a separate database value. Their provenance and formula must be explicit. Saving a scenario is a separate decision from calculating it on screen.

## Completion rule for the next implementation batch

For every register row, verify: selected company/currency/timezone/period/version; every required input; where its formula executes; correct denominator and rounding; chart-bucket coverage; handling of missing/zero/stale/invalidated sources; and whether the result is historical, a user assumption or a scenario. A value becomes connected when this whole chain is supported, not merely because its text has a database-shaped name.

Keep the existing normal styling for supported database-backed derivations. Yellow remains for sample, missing or unsupported results, with text explaining which. User-entered assumptions must be explicitly identified; they are not database-connection errors.

No source code, website deployment, database write/grant, provider transaction or daily-feed change was made by this audit. The previously deployed New page release remains live; the first genuine unattended daily-feed acceptance is still a separate milestone.
