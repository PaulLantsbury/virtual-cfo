# Scenario Planner — visible impact and corrected monthly model

Completed 12 September 2026. Paul first requested immediate sales/profit feedback and baseline differences, then requested correction of erroneous formulas. He explicitly agreed a single sample month, sales derived from order volume and AOV, and unavailable unsupported marketing-growth/cash effects until their assumptions are agreed. The exact sample amounts are chosen test fixtures, not real store data or separately approved business forecasts.

## Implementation

The page now shows sales and operating profit above the controls and in a matching summary. Each shows sample starting position, current scenario and signed GBP/percentage change. The live panel remains visible while using the controls on desktop/mobile. Supporting analysis uses the same outputs and gives the contribution/operating profit/EBITDA bridge. Zero/negative changes retain their signs. Percentage changes are unavailable for nonpositive baselines.

The pure model in `src/lib/scenario-model.ts` replaces the former coefficients and mixed-period shared snapshots for this page only. Monetary arithmetic uses integer pence. Baseline: 1,000 orders, £100 pre-refund AOV, £95,000 net product sales, £40,900 contribution after marketing, £21,900 operating profit and £22,900 EBITDA in one synthetic month. See [review and worked ledger](scenario-calculation-review.md) for all inputs and limits.

Nine controls have explicit effects: orders, AOV, outbound shipping cost per order, payment processing cost per order, marketing spend, fulfilment cost, staff, software and other overheads. Sales derives once from orders × AOV less fixed refund events. Variable and marketing costs reduce contribution once; disjoint overhead categories prevent duplicate costs. Operating profit includes depreciation/amortisation; EBITDA adds it back. Monetary inputs exclude VAT. No automatic price-demand or advertising-sales response is inferred.

Product mix/COGS per order and discount percentage stay fixed when AOV changes. Shipping income is a fixed monthly amount; cost per order scales with original orders. Refunds and explicit recoverable returned-goods costs are fixed events in the sample month, not percentages of this month's newly modelled orders. These are declared synthetic assumptions, not importer/data-validation claims.

Unsupported discount/refund-response controls, channel growth, cash/runway/CAC outputs and conflicting fixed preset cards are removed from the planner. Old Opportunity Finder URLs remain navigable but display “Previous preset not applied” and load no partial assumptions. Free/Pro access remains; saving/comparison remain unavailable. No shared snapshot, other page's financial formulas, Supabase, Replit, main or production changes.

## Verification

- 11 pure model groups: independently worked ledger, all nine controls, joint orders/AOV, classification, whole-order/pence rounding, invalid inputs, a −£7,380 operating loss and 512 permitted-boundary combinations.
- 20 desktop/mobile Scenario browser cases: live/summary/table alignment, positive/negative changes, reset, marketing expense with unchanged sales, sticky visibility, free gate, all three old preset URLs, unknown preset and missing store-source data.
- 9 Opportunity browser cases including actual click-through to the corrected planner with unsupported preset declined.
- All 40 checks passed. Typecheck and build passed. Existing tooltip sourcemap and bundle-size warnings remain. Initial typecheck surfaced a pre-existing Opportunity timing literal mismatch; widened the local string type without changing its ranking conditions. The new page's duplicate JSX key diagnostic was fixed before final checks.
- Independent calculation/UI review completed. Desktop/mobile screenshots inspected. Existing authenticated local staging at localhost:3000, store A, shows baseline £95,000/£21,900. Increasing orders30% updates both panels to £125,000/£37,200 and differences +£30,000 (+31.6%)/+£15,300 (+69.9%). Reset restored baseline. No new access or database writes.

This is tested sample arithmetic, not a complete forecast engine or verified live financial data. Real inputs, demand/discount/refund response assumptions, cash forecasts, replacement opportunity presets and persistence remain roadmap work. Other legacy pages' models are not certified by this correction. Local staging is not hosted staging or production.
