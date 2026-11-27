# Five-page restoration release — 27 November 2026

Prepared local source: `fa887b86a18079ff7698b305e85fb3f7cd67f349` (43 files), based on released `3373ee13aa00d0a8939c81deb12122644fceaf7f`. Proposed publication branch: `codex/five-page-restoration-20261127`. Not yet published or deployed.

## Result
Restore fuller Profit/Cash charts and review cards, Growth's three tabs and Plan's visible modelling workspace. Use shared Amounts/Period/View/Compare controls across all five pages, retaining changes through navigation, reverse updates and reload per user/company. Remove top-level Explore the Numbers jump links. Replace yellow source-status flags with neutral presentation, missing numbers with an em dash and pending values with Loading…. Retain meaningful performance colours and explicit fictional/sample labels. Owner briefings are short plain-English rule-based paragraphs.

## Verification
37 consolidated unit tests pass. All six central browser scenarios pass, including desktop/mobile navigation, shared choices, comparison clearing, company/account isolation, pending Plan workspace and header/control layout. Additional targeted Cash/Plan tests and independent financial review passed. Final frontend typecheck and production build pass; earlier complete constituent workspace checks/builds passed. The root package wrapper encountered an existing linked-dependency restriction and is not claimed to pass. Existing build size/sourcemap warnings remain. Browser data was disposable fictional fixtures; this is not signed-in hosted acceptance or exhaustive whole-page pixel parity.

## Limits and next work
Connected primary reports support one complete calendar month. Weekly/multi-month selections persist but unsupported figures show dashes, never monthly values under a different range. The independently tested calendar-day recurring-cost allocator is included as inert source preparation; trusted Xero source binding and whole-platform weekly integration remain urgent unfinished work. Cash/bank stay dated total pounds; financial per-order calculations use each period's own denominator. Plan forecast dates remain distinct from historical selection. Missing figures, customer uniques, benefit amounts and confidence ranks are not invented. ChatGPT wording remains deferred; deterministic commentary stays default.

## Requested bounded release
Publish the exact source to the proposed branch and deploy only the existing staging website. Confirm the current hosted revision before release and reconcile any newer work instead of overwriting it. Verify signed-in all five pages, shared choices, loading/missing behavior, Cash signs and Plan baseline, plus mobile layout; restore the previously verified website if acceptance fails. No setting/secret changes, database writes/grants, provider requests/jobs, daily-feed changes, model requests, production release, services or additional spending.
