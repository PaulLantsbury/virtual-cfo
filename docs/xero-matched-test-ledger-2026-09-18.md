# Matched Shopify/Xero test ledger — 18 September 2026

Status: **preparation only**. This is a small manual seeding plan for the blank Xero trial organisation. It does not authorise creating Xero or Shopify transactions yet.

## Purpose

Exercise the first accounting reconciliation without treating Xero revenue as additional Shopify revenue. Each entry is deliberately synthetic, uses GBP, and has an explicit date and expected classification. Use one isolated test month after the Xero organisation’s financial settings and VAT treatment have been confirmed.

## Proposed test month

Use **October 2026** and label every transaction `Night Scout test`. Keep the Shopify side to the matching synthetic orders only; do not use customer contact data or live payments.

| Date | Shopify event | Xero entry | Expected reconciliation treatment |
| --- | --- | --- |
| 5 Oct | Order: £100 product net, £20 VAT, £6 shipping net, £1.20 VAT; £127.20 customer cash | Sales invoice / settled payment for the same gross amount | Shopify and Xero revenue compared for product/shipping net amounts; VAT stays separate. |
| 8 Oct | £24 product refund including £4 VAT | Credit note / refund for £24 | Refund belongs to its actual refund date; difference remains explicit if Xero posts it later. |
| 10 Oct | No commerce event | £3 payment-processing fee | Operating/variable fee; never another reduction of Shopify sales. |
| 12 Oct | No commerce event | £20 advertising bill/payment | Marketing expense, separate from commerce revenue. |
| 15 Oct | No commerce event | £50 software bill/payment | Operating overhead, separate from marketing and product costs. |
| 20 Oct | No commerce event | £1,000 transfer between two included bank/payment accounts | Zero consolidated cash movement. |
| 31 Oct | No commerce event | Closing balances in one included bank account and one included payment account | Available cash includes the selected balances only; restricted/unsettled accounts stay separate. |

The first report comparison should expect original product revenue £100, product refund £20, net product revenue £80, original net shipping £6, no shipping refund, and customer cash refunded £24. It must not claim complete contribution, operating profit or runway until the cost, account-mapping, coverage and included-account decisions are reviewed.

## Required account mapping before entry

Create or select test-only accounts for sales, VAT liability, payment-processing fees, advertising, software/overheads, bank/payment clearing, and owner/financing if the Xero trial requires it. Record the exact account names and tax rates in the test evidence. Do not map inventory/COGS, financing, restricted funds, or foreign currency into the first result unless they are intentionally included and separately tested.

## Acceptance checks

1. The selected Xero reports identify the correct organisation, report date, base currency and report title.
2. Shopify £80 net product revenue is compared against the mapped Xero revenue amount; the result is a difference, not a combined £160 revenue total.
3. The £3 processing fee, £20 advertising and £50 software cost are separately classified.
4. The £1,000 internal transfer changes neither consolidated cash movement nor revenue.
5. Missing mappings, a late refund, a missing included-account balance and a report-permission failure each leave the comparison unavailable or explicitly different; none becomes a zero or a success.

After the mapping and tax treatment are agreed, create the Xero trial entries manually, capture the dated report outputs, and run one new fixed-date read-only Night Scout snapshot. The later data-store/reconciliation presentation needs a separate reviewed package. No recurring collection, token retention or accounting write-back is included.
