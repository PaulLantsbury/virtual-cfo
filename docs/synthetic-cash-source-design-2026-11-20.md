# Synthetic company cash source proposal — 20 November 2026

## Scope and executable model

`experiments/synthetic-company/cash-source-model.mjs` derives an isolated cash proposal from the existing, unchanged **uk-gifts-v2** journal: the £750,000 annual net-turnover company with four employees. It does not add transactions, change profit, alter the daily feed or contact any provider. The source must be the exact canonical generator programme anchored **1 November 2024**; integrity checks reject altered or rehashed events and a different opening date.

The caller must explicitly acknowledge the source's existing opening assumptions: **£60,000 bank, £35,000 stock, £24,000 equipment and £119,000 equity**. This is fictional opening capital, not inferred cash, new funding or an authorisation to seed. The opening journal establishes balances at the start of the first source day and is excluded from that month's trading/financing flows. These amounts are never reintroduced at each month boundary.

The API is `createSyntheticCashSource(fixture, { openingCapital, observedAt }).month({ from, to, storeId, now })`. It returns a **prepared-only** envelope containing:

- `evidence`: the exact `eligible-cash-v1` presentation contract used by `cashSourceAdapter.ts`.
- `inputs`: dated, source-referenced records consumed by `prepareSyntheticCashEvidence` together with an independently verified monthly financial response.
- `bankLedger`: dated external bank postings, source event IDs/hashes and explicit operating classification.
- `sourceManifest`: company/profile/anchor/scope, source-prefix digest, mapping version, monthly source IDs/hashes, bank-ledger digest, opening/closing control balances, itemised working-capital records and disclosed account eligibility assumptions.
- `reconciliation`: EBITDA, each working-capital effect, operating cash, independently summed bank movement, opening/closing bank observations and the difference (required to be zero).

No endpoint, table, grant, snapshot, provider collection, schedule or publication is created. A `reviewed` field in the prepared presentation body represents the requested target contract, not hosted review/acceptance. The envelope remains prepared until exact source and financial binding are reviewed and published separately.

## Dated activity retained from the source

Sales enter the processor clearing asset including recorded VAT; gross payouts reach the bank after two weekdays. Fees are separately bank charged, and refunds are actual dated bank outflows linked to their original orders, including cross-month refunds. Pending processor funds remain separate from bank cash. No net-payout fee assumption, failed payout or reserve is invented. Weekdays exclude weekends; provider/bank holidays are not modelled.

Stock is received on the first of the month, with its actual source VAT and 30-day supplier terms. COGS/returned inventory remain separate from purchases/payments. Monthly receipts match expected net consumption in this existing programme: closed-month stock growth is therefore often exactly zero, while dated intra-month inventory and supplier payments still move. No stock excess or recoverable saving is inferred.

Fulfilment, packaging, marketing and operating costs use the existing accruals, consolidated supplier invoices and 30-day payments. Four employee payroll accruals, next-weekday net payments and nineteen-day remittances retain their source dates. These are fictional payroll budgets, not statutory payroll calculations.

The source's VAT control and quarter-end-plus-37-day settlement dates are preserved. This is the existing fictional accrual scheme, not a statement of statutory filing/payment rules. Corporation-tax accruals/payments, interest, borrowing, dividends and later capital expenditure do not exist in the source and are not invented. Their bank-flow categories are verified zero only within this complete synthetic programme. Future tax obligations and spendable cash are not certified.

## Exact sign and reconciliation rules

Positive ledger postings debit assets/expenses; negative postings credit liabilities/revenue/equity. Working-capital effects exclude the opening journal and use these independently rolled controls:

| Cash bridge category | Signed effect |
| --- | --- |
| Stock | Negative change in inventory, including actual receipt/COGS/return movements |
| Customer debtors | Verified zero: the complete prepaid source has no credit-debtor account |
| Provider settlements | Negative change in processor clearing, including captured receipts and actual gross payouts |
| Supplier credit | Negative change in supplier payables plus accrued supplier costs; unpaid supplier/accrual liabilities are credited negative in the source |
| Other operating working capital | Negative change in VAT control, employee net-pay liability and payroll-remittance liability, itemised by event/account |

**Operating cash = EBITDA + all five working-capital effects.** It must independently equal the bank postings classified as operating. Actual source VAT settlements and payroll payments already appear in these control-account changes; adding VAT settlements again to the separate tax bank line would double count and is prohibited. `taxAndInterest` means corporation-tax/interest cash flows, which this source does not contain. Depreciation is already excluded from EBITDA and is not added back again.

**Opening bank + operating cash + corporation tax/interest + investing + financing + other external movements = closing bank.** Both balances come from independently rolled source bank postings, not from an amount chosen to close the bridge. Unclassified accounts or external bank kinds are refused. No balancing plug or monthly-to-daily allocation is used. Account eligibility is an explicitly fictional, included unrestricted GBP model account, not bank/provider verification.

## Monthly coverage and financial-version boundary

Only complete covered calendar months are emitted. The current partial month is not converted into complete-month cash. Observation timestamps must be explicit, no later than the supplied actual review clock and after the complete period. The frontend must label historical bank balances with their own date; a selected month's closing balance is not automatically today's bank cash.

The source manifest uses the anchored canonical journal prefix through that month, including prior history that establishes opening cash. Later ordinary daily appends do not change that closed month's cash revision or source manifest. Full input-fixture integrity is checked separately; it is not used as a changing store-wide monthly revision.

Each published cash body still needs a private binding to the exact selected monthly financial version and sales/cost revisions. `prepareSyntheticCashEvidence` recomputes the bridge using that verified monthly EBITDA and rejects a mismatch with the supplied bank roll-forward. The existing reviewed August expense correction cannot be silently paired with an unchanged baseline cash bridge. Corrected months need explicitly corresponding cash/liability evidence or must remain unavailable. Matching a baseline amount does not itself approve a corrected version or establish correction semantics.

## Acceptance evidence and remaining gates

The local tests cover all 24 complete months, independent bank sums, month-to-month balance continuity, `eligible-cash-v1` validation, prepared-builder compatibility, June payroll, Christmas payouts, cross-month refunds, VAT counted once, separate pending funds, immutable/capital/scope/date failures, correction mismatch and later-append stability. Tests never write to a database or provider. The existing synthetic P&L and generator files are unchanged.

Before publication: bind each eligible month to the current supported financial version, review model account eligibility and source digests, supply a read-only same-member/same-scope reader and stale/invalidation contract, rehearse storage and idempotent publication with protected data fingerprints, and obtain any required migration/grant/data-publication approval. Forecasts, available-to-spend claims and provider acceptance remain separate. The coordinator's 20 November read-only finding of zero synthetic cash-balance snapshot records remains historical evidence of the missing connection; this offline model does not change that count.

## Bounded reviewed expense overlays

The source constructor optionally accepts `verifiedExpenseOverlays: [{beforeHash, afterBody, afterHash, financialVersionId}]`. These must be obtained from an authenticated, selected correction lineage; the offline model verifies their structure and cryptographic predecessor/body consistency but cannot certify database membership, review approval or selected-head authority itself. Publication must independently recheck those facts.

Every overlay must be exactly `amendedExpense(previousBody, newAbsoluteAmount)` using the existing reviewed correction engine. Only the original expense, associated recorded VAT and accrued supplier liability may change. Changing an ID/date, sale, bank movement, classification or unrelated field fails. Chained replacements require the exact previous effective body hash; duplicate overlays fail. The base canonical fixture remains unchanged.

An expense correction changes the effective period's EBITDA and its itemised unpaid liability/VAT controls. It does **not** invent a supplier invoice, bank payment or revised VAT remittance. The additional accrued liability and input VAT carry into later opening/closing balances until separately supported actual settlement evidence exists. For a taxable £4 expense increase: EBITDA falls £4; unpaid supplier/accrual credit increases £4.80; the VAT working-capital asset absorbs £0.80. Net operating cash and bank movement stay unchanged. These are the typed correction's explicit postings, not a balancing plug.

For a month containing overlays, `month` requires `financialVersionId` equal to the last supplied selected version for that month and an exact `reviewedEbitda` matching the effective journal. For later months, the same prior overlays must be supplied so the source prefix and liabilities remain consistent; monthly EBITDA is unchanged unless that month has its own correction. Providing a reviewed EBITDA for any month always checks it. The resulting manifest retains the complete bounded overlay proofs and the provided financial binding. Exact sales/cost revision and selected-head checks remain the loader's responsibility. Omitting an August correction in a later published prefix must not be permitted by the loader.

Two additional local tests prove the August correction and September/October carry-forward with byte-identical bank ledger; reject stale/missing/wrong selected financial versions and amounts; verify explicit replacement lineage; and reject arbitrary bank/date/body/hash tampering. No underlying P&L events or hosted correction rows are altered.
