# Imported transaction review display — 10 September 2026

The financial review screen now displays reconciled transaction evidence returned by the existing authorised prepare endpoint. It shows store-local date, sale/refund identity, original order link, product value excluding VAT, shipping excluding VAT, VAT and customer payment/refund. Refund components are displayed as reductions in their own event month. Linked events outside the selected review period are explicitly labelled; the list is not a total for the selected period.

Only a successful event reconciliation produces the display payload. Blocked packets return null transaction evidence. The response exposes selected financial fields, not raw source payloads or customer details. Rows are sorted and capped at 200 with a shown/total count; no truncated-list aggregate is presented. Frontend validation checks the optional payload, and the existing generation guard/date/store/account resets continue to discard stale responses. Preparation still never certifies completeness, and the independent evidence/statement/checkbox requirements remain unchanged.

## Verification

86 source/import/review tests pass, including actual disposable-database import of the February sale and March/April refunds followed by review preparation. The response shows GBP 90/18/108 for product/VAT/cash on 15 February, then GBP -20/-4/-24 on 5 March and 6 April. Deliberately stale evidence suppresses the display. Five isolated browser groups pass, including the transaction table, out-of-period labels, disabled approval and clearing evidence on date changes. Frontend TypeScript checking passes.

The local connected staging preview was restarted at http://localhost:3000/financial-review. With Paul's explicit approval, his existing confirmed staging account received store C membership and reviewer authorization only. No login credentials were changed or published. In the real signed-in screen, C was selected and the 1–28 February review prepared. All three events and their values appeared correctly, including both later refund labels and the shared original order. The independent-review checkbox remained unchecked and restoration disabled.

Post-check: C has one membership and one reviewer grant, coverage remains false and total review audits remains one. No review/restoration was submitted. This supersedes earlier statements that C has no user grants; earlier trial records remain historical. A membership permits normal store access as well as use of the reviewer screen; the explicit reviewer grant is additionally required by the prepare endpoint.

## Handover

Use port 3000 for the connected preview; the older port-3001 tab is stale. Store C, February 2026 is the demonstrated review scope. March/April events are visible as linked history; separate March/April review candidates and completeness evidence have not been created. No live Shopify account exists yet. This remains synthetic staging validation, with no production release, Replit synchronization or main merge. GitHub draft branch remains the durable code/documentation source.
