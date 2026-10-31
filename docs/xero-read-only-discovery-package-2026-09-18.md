# Xero read-only discovery package — 18 September 2026

Status: **local test connection verified; financial analysis is not implemented.** A separate Xero test app and UK trial organisation were created. The local OAuth service is loopback-only, requests granular read scopes, accepts only the approved callback, requires one selected tenant and discards access tokens after each run. No write scope, refresh-token retention, recurring collection, database table, dashboard exposure or accounting write-back exists.

## Verified read-only route

One-time consent and tenant discovery succeeded for the single Xero test tenant. Fixed-date snapshots subsequently made five tenant-bound `GET` requests only:

1. Organisation settings
2. Profit and Loss
3. Balance Sheet
4. Trial Balance
5. Bank Summary

The reports were read for the selected date and the token was discarded immediately. This verifies consent, tenant binding and the permitted read route. It does **not** establish that any report content, Xero transaction, account balance or Xero total is suitable for financial analysis.

## Current local evidence boundary

The local evidence-summary/store code accepts only a small owner-only JSON summary containing:

- source identity and Xero tenant ID;
- report date and retrieval time;
- organisation base currency; and
- the identities of the four reports.

It rejects raw API responses, tokens, missing report identity and any request to mark Shopify comparison as enabled. Raw reports, transactions, journal lines, financial totals, balances and account mappings do not cross this boundary. The summary is local only and is not connected to a database or website page.

## Separate-source rule

Shopify remains the source for Night Scout’s commerce-event sales analysis. Xero is a separate source for later accounting analysis. Night Scout must not add, match, compare, calculate a variance between, or otherwise reconcile Shopify sales and Xero booked sales. They may be different for ordinary operational reasons and that difference is outside the current product scope.

The present Xero work does not calculate or display Xero revenue, costs, profit, cash movement, cash balances, VAT, contribution, operating profit or runway. It does not select accounts or classify accounting entries. A report title and date are source identity, not financial evidence.

## Test ledger

Paul manually entered the synthetic October Xero transactions described in [the test ledger](xero-matched-test-ledger-2026-09-18.md). A 31 October fixed-date snapshot was read under the same boundary and discarded after confirmation. No contents, totals or account details from that snapshot were retained, so the completed read must not be described as a check of those entries.

## Next package

The next package may wire the tested local summary into a fresh fixed-date snapshot and save only the allowed report-identity summary locally. Before any Xero financial metric or accounting page is proposed, prepare and review a separate package covering: the exact report fields to retain, financial definitions, account selection and mapping, tax/cut-off treatment, cash-account inclusion, completeness/freshness, storage/access controls and presentation. Any recurring collection, retained credential, database storage or write capability needs separate approval.

## Reference route

Xero’s current development guidance: [development accounts](https://developer.xero.com/documentation/development-accounts/), [getting started](https://developer.xero.com/documentation/getting-started-guide/), [Accounting API](https://developer.xero.com/documentation/api/accounting/overview) and [reports](https://developer.xero.com/documentation/api/accounting/reports). The test app uses standard OAuth authorisation code flow with granular read scopes; it is not a production connection.
