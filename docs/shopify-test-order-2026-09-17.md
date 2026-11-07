# Shopify development checkout and refund — 17 September 2026

## Observed result

Completed an actual development-store checkout using the existing active Test payment gateway (Bogus), existing generated sample product The Inventory Not Tracked Snowboard, and fictitious customer details. No real card/payment, fulfilment or shipping-label purchase. Existing storefront password protection remained enabled. No app permissions changed.

Order #1001 (`13051443773788`) contained two items at £949.95: total £1,899.90, Standard shipping £0, recorded tax £0, discount £0. Admin explicitly identified it as a Test order; API `test=true`, successful SALE transaction and PAID status matched. The existing detail reader and mapper loaded it successfully and excluded it as TEST_ORDER, producing zero eligible financial events and coverageCertified=false.

Refunded one item through the test gateway for £949.95, with restock and refund notification unchecked. Admin confirmed Partially refunded and the matching test refund. API returned one successful REFUND transaction, refund `1162750722396`, one refund line of quantity 1/subtotal £949.95/tax £0. Remaining test payment balance in admin was £949.95. Test flag and exclusion remained unchanged.

The detail fingerprint changed after the refund and was identical on two subsequent reads. Private assertion checks confirmed before/after change, exact repeated summary, TEST_ORDER exclusion, zero events, false coverage, one refunded unit and £949.95 source refund. Raw credentials/customer details were not committed. Safe private summaries remain in ignored .local files.

## Scope of proof

This verifies live query field compatibility for one sample checkout, line details and a same-day partial refund; source amount agreement with Shopify; explicit test exclusion; and stable repeated extraction. It does not verify database replay/import, eligible-sales arithmetic from a real store, nonzero tax/discount/shipping allocation, cross-month refunds, historical costs, full-source completeness or large-store pagination. The test exclusion intentionally occurs before financial mapping. Do not turn off test eligibility to create revenue.

No Supabase writes, staging grants, financial certification, app UI changes, Replit sync or production release. The existing read-only app permissions remain read_orders/read_all_orders. No new automated job was started. Paul requested periodic updates during active work; give concise updates at meaningful checkpoints and explicitly identify waits/decision gates.

## Next work

Prepare and locally test the exact separate staging candidate-intake setup from shopify-staging-intake-proposal-2026-09-17.md, then present its store row, membership/reviewer access, restricted role and first candidate exercise together for approval. This observed test order should remain excluded and cannot establish actual revenue. A nonzero synthetic demonstration or broader financial semantics requires a separate agreed boundary. Keep synthetic Store D separate.
