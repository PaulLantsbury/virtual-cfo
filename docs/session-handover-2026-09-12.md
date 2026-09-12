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

## Project-management setup — complete; pilot scopes proposed

Paul requested this conversation coordinate parallel coding/testing agents. Created the current project brief, team working agreement and concrete two-task pilot proposal; added the reading/delegation rules to AGENTS.md and a current entry point to the guide. Two read-only agents reviewed roadmap/source independently. Proposed tasks: reject impossible review-response dates, and identify Cash Control's sample figures honestly. No pilot application work has started; Paul still decides the scopes. Shopify/reference comparison remains paused.

The coordinator checked documentation links and the diff, and completed a read-only review of the setup documents. The review clarified that already-agreed visible changes do not need repeated approval. This package changes documentation only; no application tests or live database checks were rerun. Routine draft-branch publication remains authorised; no merge, staging mutation, Replit sync or production release. Resume by obtaining Paul's decision on docs/parallel-pilot.md, then dispatch disjoint work with an independent reviewer.

## First parallel implementation pilot — complete

Paul approved both proposed scopes. Two developers worked on disjoint pages/tests while a third agent reviewed; the coordinator integrated, verified and documented the result. Financial review now rejects impossible transaction dates before displaying evidence, clearing stale review controls through the existing safe error state. Cash Control clearly identifies its fixed examples, preserves the illustrative simulator and removes misleading business-specific cash answers/live monitoring from that page.

19 review browser checks and 12 Cash Control checks pass with isolated mocked services. Frontend type checking/build and diff checks pass; inherited tooltip sourcemap/bundle-size warnings remain. Desktop/mobile layouts inspected. Initial cash harness failures (missing store fixture and slider wrapper selector) were corrected before the successful rerun. Independent review found no remaining in-scope issues. See docs/parallel-pilot.md for acceptance, limits and deferred shared-component observations.

Current resume point: pilot complete, routine GitHub development-branch publication only. Do not restart these tasks. No staging records, completeness approvals, financial formulas, shared snapshots or entitlements changed; no main merge/production/Replit update. Reference comparison remains paused pending a suitable real source. Bring the next bounded scope to Paul for agreement.

## Second parallel package — Margin Recovery and Monitoring complete

Paul approved both tasks. Margin source figures no longer use invented fallback values, genuine zeros remain, source currency is not assumed and actual margin/recovery remains unavailable pending verified inputs. The retained model and supporting charts are explicit separate samples. Monitoring is clearly a prototype: examples are not completed checks, settings are unsaved local previews and notifications are not sent. Both pages remove misleading local AI/monitoring claims.

20 Margin and 6 Monitoring browser checks pass against a fixed local build with mocked services; frontend typecheck/build pass with inherited warnings. Desktop/mobile screenshots inspected and independent review complete. An initial mobile Monitoring test was interrupted during development reloads; all six passed on the stable build without a source fix. See docs/reporting-truthfulness-package.md for exact acceptance/limits.

Resume point: this package is complete and saved on the development branch; do not repeat it. Source/cost wiring and real monitoring are still future work. Shopify/reference comparison remains paused. No staging data, access, completeness approvals, financial rules, shared sample formulas or deployment changed; main/production/Replit remain outside this package. Agree the next concrete scope with Paul.

## Integrated staging package — 12 September

Paul approved staging after every meaningful completed package; recorded in AGENTS.md and team agreement. Parallel agents checked startup/acceptance and staging database invariants. Coordinator started the current source preview at localhost:3000 against the existing staging project and verified retained Auth, store switching, HTTP401 without Auth, all three Store C periods and sample/unverified/inactive labels on Cash Control, Margin Analysis and Monitoring. See docs/staging-checkpoint-2026-09-12.md for version/evidence and limitations.

No figures were restored; C coverage stays false for all three periods, audit total1/C0 and import receipts2 match baseline. No application code, migration, grant, Replit, main or production change. The preview is local, not hosted; old3001 is stale. Next is Paul’s walkthrough, then agreed bounded fixes; do not redo completed packages or expand synthetic comparison without real reference input.

## Growth Efficiency / Pricing Optimisation complete

Paul accepted the previous staging walkthrough and approved this next package. Two developers and an independent reviewer delivered separate honest source/sample panels, removed invented source fallbacks and advice claims, and retained illustrative simulator arithmetic/gates. Growth's returned snapshot periods and stale-store response handling are explicit. See docs/growth-pricing-package.md for evidence and limits.

55 isolated browser checks pass; frontend typecheck/build and independent review pass. Initial type-status mismatches and Growth harness selector/store-selection errors were corrected before final checks. Existing local staging preview serves the changed source: authenticated store A shows0.00% source ratios, unavailable marketing rows and clear sample/actual-analysis-unavailable notices. No data/financial approval or production/Replit/main change. Next: Paul reviews Growth Efficiency and Pricing; do not repeat the completed coding package. Continue staging after meaningful packages. Real-reference comparison remains paused.

## Roadmap decision — marketing budget modeller

During walkthrough Paul queried the arbitrary 30% combined-shift cap. Inspection confirmed unequal channel-budget percentages are added directly and capped before scaling fixed outputs. Paul agreed to defer rebuilding until reliable channel spend/contribution inputs exist, then agree allocation effects, limits and uncertainty before modelling actual pounds moved. Recorded in project-brief.md and growth-pricing-package.md. Current model stays illustrative; no application/staging/data change accompanies this decision. Do not treat this as approval of replacement financial assumptions.

## Consistent page names and Replit decision

Paul approved the naming set in docs/page-naming.md. Applied it to all ten navigation/page headings, destination references, landing/upgrade feature labels and contextual drawer names. Sample/prototype/unavailable notices remain separate and prominent. Existing URLs, financial calculations and plan gates unchanged. Updated existing browser-test heading selectors. All ten heading/menu pairs checked; frontend typecheck and staging Pricing heading/status checks pass. No new financial testing required for copy-only changes.

Paul asked to leave the Replit setup as it is. No Replit reconciliation, synchronisation or hosting change is part of this work; retain the existing setup until separately agreed.

## Growth Quality / Profit Overview complete

Paul approved the package; two developers and an independent reviewer delivered it. Source percentages no longer feed illustrative Growth scores/diagnoses. Profit Overview explicitly uses unvalidated sample arithmetic and discloses mixed periods, rather than claiming operating profit/EBITDA or annualised forecasts. Simulator equations and plan gates preserved. See docs/growth-profit-package.md.

31 isolated browser cases, frontend typecheck/build and independent review pass. Real existing staging store A shows Growth source zeros and fixed sample C+, Profit actual reporting unavailable and GBP78,000 sample result. No database or financial-approval changes, Replit/main/production untouched. Next: Paul’s walkthrough; package coding complete. Maintain staging-after-package cadence and deferred modeller/real-source decisions.

## Opportunity and scenario checkpoint

Opportunity Finder / Scenario Planner approved parallel package complete. Existing synthetic opportunities are explicit examples; unsupported source endpoint removed, one-off cash separate. Scenario formulas/presets preserved, best-plan claims removed, unused inputs and unavailable saving/comparing disclosed. 22 browser cases, typecheck/build and independent review pass; source/staging unchanged except page code, authenticated preset handoff verified. See docs/opportunity-scenario-package.md for harness corrections and limits. Next: Paul’s walkthrough. No DB/financial approval, Replit/main or production change.


### Opportunity Finder wording follow-up

Paul requested clearer UK wording: renamed the sample priority tier “Next Up” to “Do next” everywhere on Opportunity Finder. This is a score-based priority band, not an action number; ranking thresholds and ordering are unchanged. The Sample prefix remains. Verified all four tier references updated and git diff whitespace checks passed.


## Scenario Planner correction — 12 September 2026

Paul approved visible live sales/profit comparisons, then correction of the sample formulas using one consistent month and orders × AOV. Implemented nine active controls, clear cost/profit bridge and unavailable unsupported forecasts; old presets explicitly declined. Baseline net sales £95,000 and operating profit £21,900. All40 tests, typecheck/build and independent review pass; current-source local staging store A checked and reset. See [implementation, verification and remaining scope](scenario-planner-correction.md). No DB writes, access changes, Replit sync, main merge or production release. Next: Paul walkthrough; further modelling policies need his decision.


### Contribution headline follow-up

Paul requested contribution alongside sales and operating profit. Both summary and sticky live panels now show contribution after marketing with its baseline and signed GBP/percentage difference, using the existing model unchanged. The three-column layout fits desktop/mobile. All20 Scenario browser cases pass, including contribution zero/positive/negative changes and visibility; build and whitespace checks pass (existing build warnings unchanged). Mobile screenshot inspected; current local staging store A shows £95,000 sales, £40,900 contribution and £21,900 operating profit. No financial formula, database, Replit or production change.


## Profit Overview / Scenario Planner alignment — 12 September 2026

Three-agent package complete: shared monthly baseline/model, four supported overview controls, signed current profit bridge and clear no-transfer navigation. Fixed baseline £95,000 sales/£40,900 contribution/£21,900 operating profit/£22,900 EBITDA. All51 checks, typecheck/build and independent financial review pass; local staging store A baseline, orders+30% and reset verified. See [package evidence and remaining scope](profit-scenario-alignment.md). Shared model unchanged; no DB writes, grants, Replit/main/production update. Next: Paul walkthrough of Profit Overview; source integration and further model work remain separate decisions.
