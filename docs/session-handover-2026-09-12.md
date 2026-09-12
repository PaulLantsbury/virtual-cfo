# Night Scout handover — 12 September 2026

## Completed bounded work package

Paul approved a short session limited to explaining review readiness on the financial review screen, tests and documentation. A new “What still needs checking?” panel appears after a valid prepare response.

For a passed response it explains the checks already performed by the existing backend: current scoped source, matching financial event evidence and sales/refund arithmetic. It separately explains the independent completeness review still needed: full period collection/pages/gaps/access limits, refunds of earlier orders, exclusions and unresolved edits/cancellations/adjustments. It directs the reviewer to retain supporting evidence and leave completeness unconfirmed if anything remains unresolved. It does not claim that costs, profit or cash balances have been checked.

For a blocked response it shows “need attention”, with no passed-check claim or approval form. Before preparation, after an unavailable response, or after dates change, no readiness panel is shown. These explanations use existing packet states; no new financial definitions, mandatory attestations or backend decision rules were introduced. The evidence reference, written statement and explicit completeness checkbox continue to control the existing restoration action.

## Validation and publication

Eight isolated browser groups pass, including passed/blocked/unavailable guidance, period reset, negative refund-only display and existing restoration safeguards. All remote requests in those browser tests were mocked or blocked. Frontend type checking and diff checks pass. The synthetic preview layout was inspected. No backend code changed, so the earlier 86-test source/import/review suite was not rerun for this screen-only update.

Code, tests and this handover are published on the existing codex/restart-baseline draft branch. No staging database writes, access grants, financial approvals, production releases, Replit synchronization or main merge were performed in this session. The connected staging UI was not independently retested this session; browser verification used isolated synthetic responses.

## Resume point

The 10 September staging state remains the last verified database baseline: C has one original February sale, March/April refunds, two import receipts and three unverified review periods. Paul has C staging membership/reviewer access. The connected preview uses http://localhost:3000/financial-review; the old 3001 tab is stale.

This guidance work is complete. Next agree a bounded package for the actual independent completeness evidence and how reviewed figures feed reporting. The guidance does not itself provide that independent evidence or certify the dataset. Preserve the existing approvals boundary; do not restore completeness or reapply earlier staging packages merely to resume.

## Second approved package — reference-ledger comparison

Paul subsequently approved a separate local comparison prototype. Implemented [normalized reference-ledger comparison](../experiments/completeness/README.md) with separately handwritten synthetic inputs. It catches missing/extra transactions, duplicates, changed amounts/VAT/order links and date shifts, including compensating errors with equal totals. Nine test groups pass. All results explicitly leave coverageCertified false; distinct reference labels do not establish independent provenance. No database, screen, upload or completeness-restoration integration was added.

Both 12 September packages are now complete. The next proposed task is to agree the actual independent reference source/adapter and, if desired, expose a read-only comparison report. Do not claim this prototype proves real source completeness. Existing staging status and approval boundaries are unchanged.

## Third approved package — visible comparison report

Completed a standalone [read-only synthetic comparison demo](../experiments/completeness/comparison-demo.html), generated from the tested comparator. Eight scenarios show matches and transaction-level issues with reference/imported rows side by side. Offline Chrome verification passed all cases with no network traffic and no write/upload/approval controls; layout inspected. This is an HTML artifact, not a new staging/application route. No financial records or approvals changed.

All three approved 12 September packages are complete. Resume by agreeing the real reference source and adapter before connecting this prototype to merchant data. The demo does not establish independent provenance or completeness.

## Fourth approved package — reference-file format and validator

Completed [versioned JSON reference-file format](../experiments/completeness/reference-file-format.md), validator, local CLI and valid/faulty synthetic sample files. Checks required fields, schema version, store/period/timezone/currency, explicit event timestamps, duplicate transaction IDs, integer minor-unit amounts and component reconciliation. Valid output feeds the existing comparator; every outcome remains uncertified. Limits: 1 MiB, 10,000 events, 100 reported issues. The CLI does not print ledger contents or write/upload data.

18 validator/comparison test groups pass, including file errors, UTF-8, scope mismatch and comparator integration. No real Shopify/reference adapter, upload UI or staging change. All four approved 12 September packages are complete. Next agree the independent reference source and adapter before real-data integration; JSON is an internal normalized contract, not a claimed Shopify export.

## Fifth approved package — connected local file comparison

Completed [local-comparison.html](../experiments/completeness/local-comparison.html), combining local selection of two normalized JSON files, validation and actual comparison. Matching scope/distinct references are required. Errors block comparison; replacing/clearing files removes prior results. Side-by-side rows and issue lists are labelled with display limits, and no result certifies completeness. Added a matching synthetic imported file alongside the reference sample.

Three offline browser groups passed, including invalid data, scope mismatch, duplicate IDs, UTF-8/size, reset and inert markup. No network traffic/storage was observed; layout inspected. The standalone builder uses existing esbuild, not a newly installed dependency. No staging/application/database/approval changes. All five approved 12 September tasks are complete. Next pause for an agreed real reference-source example and adapter rather than expanding synthetic prototypes without new evidence.

## Agreed pause — real reference data needed

Paul endorsed and asked us to remember the recommendation to pause further transaction-comparison expansion until a suitable Shopify account/export or another agreed real sales-and-refunds reference example is available. The last stated position was that no Shopify account was available; no new source has been confirmed. Do not keep adding synthetic scenarios as a substitute for verifying a real connection. At the next planning point, check whether a suitable source is available; otherwise propose another roadmap item for Paul to choose. Existing synthetic checks remain useful but do not establish real-source completeness.
