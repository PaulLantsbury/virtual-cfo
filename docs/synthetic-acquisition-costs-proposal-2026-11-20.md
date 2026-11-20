# Synthetic first-order and cohort costs — bounded proposal, 20 November 2026

Prepared source and optional UI/compiler integration only. No live data, website, provider or feed has been changed by this work, and general merchant metric definitions remain separate. The coordinator must bind the exact tested package before live application. Optional economics requires explicit compiler opt-in; a mature result additionally binds all six April–September financial month versions and revisions, revalidated in the reporting transaction. A missing/changed dependency withholds the supplement.

## Source and allocation policy

`experiments/synthetic-company/acquisition-costs.mjs` uses the **actual financial-anchored fixture from 1 November 2024**, alongside the independently generated identity sidecar from 1 January 2024. It validates both canonical sources and the supplied source body. Identity history establishes first/repeat order links; costs come from the financially anchored journal, not a different opening-balance/payment-lag reconstruction.

Policy `synthetic-order-cost-allocation-v1` records every variable expense source ID/hash and allocates its exact integer pennies:

- Pick/pack, carrier and packaging: equally across that day’s original orders, matching the fixture’s explicit per-order fee basis.
- Storage: that day’s original net product value weights.
- Processor: that day’s original gross receipt-value weights (product, shipping and recorded VAT); the allocated **cost amount** is the journal expense, not gross receipt/VAT itself.
- Returns: same-day actual refund-original-order references, weighted by refunded product value. These allocations can follow an older original order and keep their event date.

Missing eligible weights retain an explicit unallocated amount. First-order/cohort economics reject relevant unallocated variable costs or non-acquisition-marketing costs; they do not silently treat unknown costs as zero.

Sale contribution entries use actual product sales after discounts, shipping and historic COGS. Refund entries reverse product revenue in the refund event’s period and use the actual saleable-stock COGS recovery. Only six variable categories enter the cost allocation. Staff, other overheads, D&A, VAT, financing, investing and all initial acquisition advertising are excluded from pre-marketing contribution. Journal/event hashes use the importer’s normalisation of `openingCohort`.

For mature customer economics, existing **other/non-acquisition marketing** allocations are further allocated to same-channel known non-acquisition orders by their existing source weights. These pennies are retained separately as `repeatMarketingCosts`; they are deducted once before comparing contribution with the initial acquisition spend. Unallocated/unknown marketing is not fabricated as a known customer expense. The resulting measure is a matched, allocated synthetic contribution-recovery model, not complete merchant lifetime value or a cash funding calculation.

## Current first-order economics

`firstOrderEconomics(costSource,identitySource,{from,to,observedThrough=to})` selects identified **paid first orders whose first-order date is in the selected range**. Its contribution numerator contains only those original first orders and their linked refund/return-cost events observed through the explicit cut-off. It does not include older first orders, those customers’ later repeat orders or future refunds.

Integer inputs returned: paid first customers, net product sales, net shipping, net COGS, allocated variable costs, contribution before all marketing and paired acquisition spend. Contribution = net product sales + shipping − net COGS − allocated variable costs. The browser may divide by the matching customer count. A zero acquisition spend does not invalidate that contribution numerator, but `acquisitionMetricsState` is unavailable; it cannot produce a zero-day/CAC claim. Recent first-order observation is finite and can change after later refunds; it is not a mature first-order lifetime result.

## Separate mature cohort

The intended fixed population is **paid first customers acquired 1 April–30 June 2026**, observed through **30 September 2026**. This remains separate from the currently selected trading period. Complete maturity requires the last first-order date plus 90 days to be covered. The contribution curve contains ages **0–89 inclusive**, aligned separately to each customer’s actual first-order date.

For each age, the source returns cumulative integer inputs: net product revenue, shipping, net COGS, allocated variable costs, pre-all-marketing contribution, and matched non-acquisition marketing. Customer-linked first and repeat orders and linked refunds retain their actual event dates. Events at age 90 or beyond do not enter a 0–89 result. The paired initial acquisition budget is summed from the exact first-customer allocations for this population.

No CAC, per-customer ratios, payback day or confidence percentage is persisted. The optional frontend integration derives these quantities only after strict source/scope/formula validation; malformed optional economics rejects the whole supplied acquisition supplement. Mature data is withheld under selected reports before 30 September, and without six complete dependency versions. The presentation layer can derive:

- Product gross profit / acquisition spend from net product revenue − net COGS and the same cohort’s spend.
- Contribution after matched repeat marketing and initial acquisition spend, divided by the same cohort count.
- First contribution-recovery crossing where cumulative pre-all-marketing contribution − repeat marketing first reaches the initial acquisition spend.

Both a positive matched cohort count and positive paired spend are required. A first crossing is not irrevocable: a later refund/cost can take the curve below acquisition spend again. The UI must disclose a subsequent reversal and must not imply that economic contribution recovery establishes cash receipt, funding duration or future customer behaviour. A genuine day-zero crossing means first-order contribution covers the allocated spend; it must never be manufactured from zero spend or borrowed from the 55-day sample.

## Integrity and compiler boundary

Cost source includes the acquisition-source hash, actual ledger fingerprint, contribution-entry hash, variable-allocation hash, repeat-marketing hash and one whole-source hash. Summaries check those hashes and scope. As with the existing identity source, the **compiler must independently regenerate the canonical cost source and compare the exact source hash**; a self-resealed edited cost object is not sufficient proof. The live reporting envelope must additionally bind the selected financial snapshot, sales/cost revisions and formula. Corrected variable-cost evidence needs a matched explicitly reviewed cost overlay; do not silently reuse base allocations under changed costs.

## Verification

Seven model tests and five additional frontend economics tests pass: exact pennies and allowed categories; independent monthly reconciliation to contribution before marketing; only selected paid first orders; observed refund timing and immutable inputs; age-aligned first/repeat contribution and repeat marketing; missing/tampered/unallocated source denials; exact final maturity day; and positive-count/spend gates. Full inception/financial-anchor rehearsal through 19 November 2026 also passes with zero unallocated variable or non-acquisition-marketing proofs.

Offline October inputs: 465 paid first customers, 705,061p first-order contribution before advertising, 228,621p allocated variable costs and 95,500p paired acquisition spend, observed through 31 October. Separate fixed mature population: 1,037 paid first customers and 207,423p acquisition spend; age-89 pre-all-marketing contribution 1,585,883p, with 12,948p matched non-acquisition marketing. The derived first crossing is day zero with **positive** spend, reflecting the existing synthetic company’s low advertising budget. These are offline allocation-model outputs, not live installed figures, real customers or a reason to increase spending.
