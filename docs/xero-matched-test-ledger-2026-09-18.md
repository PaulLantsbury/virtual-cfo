# Xero synthetic test ledger — 18 September 2026

Status: **entered manually in the Xero trial organisation; not analysed by Night Scout.** The entries are controlled test data for a later, separately approved accounting-analysis package. They are not a reconciliation dataset and they do not create any connection between Shopify sales analysis and Xero accounting analysis.

## Purpose and boundary

The October entries provide a small, known Xero accounting sample. Shopify and Xero remain independent sources in Night Scout:

- Shopify supports sales/trading analysis from Shopify records.
- Xero may later support accounting analysis from Xero records.
- Night Scout does not match, compare, reconcile or calculate differences between their sales entries.

The completed Xero snapshot read only confirmed the authorised report route. Its contents were discarded. The current local summary can retain report identity only; it contains no transaction data, financial totals, account mapping or classification.

## Synthetic October entries

Every entry is labelled `Night Scout test`, uses GBP and was manually posted in the Xero trial organisation.

| Date | Xero test entry | Intended accounting context for a later package |
| --- | --- | --- |
| 5 Oct | Sales invoice and settled payment: £100 product net, £6 shipping net and standard VAT | Booked sales entry; no current Night Scout revenue metric is derived from it. |
| 8 Oct | £20 net product credit note/refund and standard VAT | Booked refund entry; no current Night Scout refund metric is derived from it. |
| 10 Oct | £3 payment-processing fee | Candidate expense entry; no current classification or amount is retained. |
| 12 Oct | £20 advertising payment | Candidate expense entry; no current classification or amount is retained. |
| 15 Oct | £50 software payment | Candidate expense entry; no current classification or amount is retained. |
| 20 Oct | £1,000 transfer between test accounts | Candidate internal transfer; no current cash-movement result is derived. |
| 31 Oct | Test account closing balances | Candidate cash context; no current balance or available-cash result is retained. |

## Not yet decided or implemented

No Xero account mapping, account inclusion list, tax interpretation, cash treatment, financial-period cut-off, completeness rule, accounting calculation, data retention policy or user-facing Xero result is implemented. The use of standard UK 20% VAT was limited to manual test entry and is not a Night Scout financial-policy decision.

Before a later accounting-analysis package can use these entries, it must define the required report fields, selected accounts, classifications, tax and date basis, completeness/freshness behaviour, storage/access boundary and expected Xero-only calculations. It must retain the separate-source rule: no Shopify/Xero sales reconciliation without a distinct future product decision.
