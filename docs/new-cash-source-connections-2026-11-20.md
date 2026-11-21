# Cash source connections — 20 November 2026

## Delivered locally

New Cash Control now adds a monthly EBITDA chart and expandable exact-amount/evidence table using the authenticated reviewed-history reader. The shared history hook checks a continuous sequence of up to twelve complete months ending at the explicitly selected month/version. Each bar is profit, including negative or zero EBITDA where verified. No daily/weekly allocation or cash series is made from these amounts. Source gaps withhold the history; changing the business or evidence context clears the previous series.

This extends audit C001 and supplies the profit input for C015/C018 with a clearly separate supported monthly reference. It does not certify the sample C015/C018 windows, comparisons or cash values. C002–C004 and the remaining cash/source dependencies remain unavailable. The existing accounting readiness endpoint supplies status only. Static cash snapshots and synthetic P&L/journal activity are not accepted as eligible bank reconciliation.

## Concrete reader proposal (prepared, not connected)

`cashSourceAdapter.ts` defines `eligible-cash-v1`: exact business, GBP, Europe/London, inclusive from/to, reviewed state, invalidation flag, source revision, mapping version and truthful observed time. The account list must be complete, uniquely identified and explicitly included/unrestricted. Opening balances mean start of the first scoped day; closing balances mean end of the last day. The upstream reader must retain dated source observations establishing those boundaries. Pending/reserved provider funds remain separate from bank cash.

The reader must prove account coverage, working-capital completeness, classified bank-movement completeness and internal-transfer exclusion. It must return actual signed stock, debtor, provider-settlement, supplier-credit and itemised other operating effects. EBITDA plus these movements must equal operating cash; opening bank plus operating cash plus tax/interest, investing, financing and other external movements must equal closing bank. No balancing plug, duplicate D&A addback, duplicate payout or inferred current cash is allowed. Missing values fail closed. This client adapter is a final presentation guard, not a substitute for canonical server/source review.

A future member-authorised read-only endpoint must validate access on each request, bind the exact cash snapshot/source/mapping revision, reject invalidated or unsupported evidence, and return only the safe contracted fields. Failed refresh retention needs an explicit same-business retained/stale state and date; this adapter presently accepts reviewed historical evidence only and does not implement stale retention. No cash endpoint, snapshot, schema, grants, collection or provider actions were added here.

## Remaining connection work

1. Establish an eligible dated cash snapshot for the selected company and account boundary observations; current synthetic company has none.
2. Implement a server reader over those separately reviewed cash sources, with membership, exact-scope, refresh/invalidation and account eligibility checks. Confirm whether existing restricted read access can supply every dependency before proposing any new grant.
3. Supply matched monthly working-capital and classified external-bank-movement evidence. Bank balances need their own aligned chart; operating/comparison cash requires every complete current/comparison bucket. Current bank as-of remains independent of historical profit selection.
4. Only then connect cash cards, both cash bridges, stock/collections investigations and historical resilience. Forecasts, source-linked actions and saved review records require their own contracts; this package does not activate them.

## Verification

Three local tests cover exact bank/profit/cash reconciliation and separate pending money; rejection of wrong scope, invalidation/stale state, future observation, missing coverage, restricted/duplicate accounts, missing movements and mismatched totals; and signed monthly EBITDA with gaps, partial periods, missing profit and wrong-store rejection. Shared history helper tests and integration type/build verification are coordinated separately. No hosted acceptance is claimed for this local package.

## Read-only source finding and next publication preparation

On 20 November the coordinator's read-only staging check found **zero `cash_balance_snapshots` records for the fictional UK Gifts company**. This is absence of an eligible snapshot, not a zero bank balance. No cash source was created or seeded.

`syntheticCashEvidence.ts` now supplies a pure offline builder for a proposed synthetic cash package. It consumes the strict reviewed monthly financial response/selection plus explicitly supplied dated account opening/closing observations, itemised working-capital movements, classified bank movements, a separate closing pending-funds observation, source references, coverage, source/mapping versions and observation time. Every category needs explicit evidence, including a verified zero. The builder derives operating cash only from EBITDA plus the supplied working-capital effects, and refuses a bank roll-forward gap rather than inserting a balancing adjustment. It retains each supplied source record and the exact financial evidence version/revisions in the prepared envelope.

The builder returns `prepared-only`; it does not fetch, approve, persist, publish, seed or activate anything. Test-only amounts are artificial contract examples, not a proposed company's opening balance or permission to publish them. A real next publication package still requires the operator to supply and review the missing company cash inputs and approve the exact storage/reader package. Three additional builder tests pass: precise supplied roll-forward/provenance, missing/duplicate/out-of-period/unreconciled evidence rejection, and malformed/wrong-business/incomplete-profit rejection.
