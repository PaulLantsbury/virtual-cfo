# Independent website release and financial-scope review — 26 November 2026

Status: source review passed for the coordinator's frozen application candidate, subject to final exact revision and validation receipts. This is not a deployment or signed-in hosted acceptance.

## Source reviewed

Checkout `work/night-scout-website-release-20261126`; baseline `204226d0c796561d5bb812cde1bd9cec8da6a8d5`; cloud UI from `6cc5c542929dadedaa3a7633a6937160d4b16880`, plus the six-file presentation-copy delta from `25515ab436528eb5b76d523a4aca0baa1a501b2e`. Browser tests remain under their independent test owner's control. Read root/repository instructions, current operational roadmap and cloud handover, and agreed financial definitions before review.

An independent byte comparison of every baseline tracked file found 11 changed tracked UI/test paths, eight added UI/test paths, zero deleted baseline files, and every non-UI tracked file identical to cleanup. The coordinator's final inventory may add scoped documentation and browser cases; recheck final inventory before publication. No API/provider route/runtime, synthetic-data, SQL, storage, grant, role, feed, scheduler, dependency or hosting configuration change was present.

Reviewed application fingerprint after the mobile containment fix: SHA-256 `45edfe2d4dcf4aeabe509a3901db9fbe63db6b0d360194f8c2bb6893e4e093f5`, over canonical sorted compact JSON mapping all 283 non-test files under `artifacts/virtual-cfo/src` to their SHA-256 hashes, using repository-relative POSIX paths. Files with `test` in their filename are excluded. This pins application review independently of later documentation/test edits. The prior repository-relative fingerprint `46a9327aa698e840fd8608f0f6734143de7d6daeb791783d983cfd64d1eb617b` and prior src-relative fingerprint `78ff82835b47317465848ae2deb4fa03d384f7c283ef6e6c119f8f6f48e2ff31` describe the application before the additional CSS fix and are superseded.

Follow-up independent review: `src/pages/plan-visual.css` adds exactly two rules scoped to `.pv-page .pl-sample[data-baseline-state]`. They vertically stack the baseline-status alert, allow long content to wrap, and bound direct children to the alert width. This addresses the observed mobile retry clipping without touching financial logic, controls, accepted Scout or ordinary supported Plan banners. The reviewed tracked change count is now 12 (the original 11 plus this CSS file); eight added UI/test paths and zero baseline deletions remain. Fresh browser containment and rebuild results must be recorded after this change; earlier application receipts must not be presented as testing the updated CSS.

Reproduce from the repository root:

```python
from pathlib import Path
import hashlib, json
root = Path('.')
src = root / 'artifacts/virtual-cfo/src'
files = sorted(p for p in src.rglob('*') if p.is_file() and 'test' not in p.name)
manifest = {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
encoded = json.dumps(manifest, sort_keys=True, separators=(',', ':')).encode('utf-8')
print(len(manifest), hashlib.sha256(encoded).hexdigest())
```

Tracked changes: `src/components/{CashSourceFigures,NewProfitLive}.tsx`; `src/lib/planning/useReviewedPlanBaseline.ts`; `src/lib/{useReviewedCash,useReviewedHistorySeries}.ts`; `src/pages/{cash-demo,new-cash-linked,new-marketing,new-profit,plan-visual}.tsx`; `tests/reviewed-pages-browser.mjs` (all relative to `artifacts/virtual-cfo`). Added: `src/components/PlanBaselineEvidence.tsx`; `src/lib/planning/{plan-baseline-evidence.ts,plan-baseline-evidence.test.ts,useReviewedPlanBaseline.test.mjs}`; `src/lib/{reviewedCashWindow.ts,reviewedCashWindow.test.ts,useReviewedCash.query-race.test.mjs,useReviewedCash.test.mjs}`.

Scout page/CSS, application route map, legacy navigation, reviewed Plan baseline calculator, cash-resilience calculator and agreed-financial-definitions document are byte-identical to cleanup. The wider unchanged tracked-file scan also preserves existing financial models, selectors, original/reference pages and URLs. The actual Cash query-race fixture SHA-256 is `dae319f66bf863158c3bab6c53b82a0cc215b92a217124651542ca2692268e9f`, matching the supplied original. This review checks its identity; fresh execution belongs to the coordinator's receipt.

## Findings

- Plan keeps its existing financial definitions and weighting. New disclosure shows actual monthly inputs, exact accepted source versions, acquisition snapshots and frozen source bindings. Complete three-month financial and first-order acquisition economics remain required; missing sources never create example baselines. Prior-year chart history remains independently checked.
- Cash uses three continuous reconciled months, verifies selected-current identity against the historical window and preserves independently accepted current cash when historical evidence fails. Failed/disabled/loading windows expose no cached partial history. Paired retry remains read-only application reporting, not a provider transaction or data refresh.
- Copy changes remove obsolete “New” headings and explain Plan's separate baseline without altering selectors, calculations or saved-draft semantics. Samples remain explicitly labelled.
- The unsupported `acceptance=release` pass-through proposal is excluded. The reporting allowlist remains byte-identical, with supported review/comparison fields, duplicate rejection and fixed destination tab/legacy precedence. No cross-tab persistence implementation or product rule was invented.
- No release-blocking financial-scope defect was found in these changes. Existing unavailable customer/second-purchase/cohort/cash-funding measures remain unavailable; source-only review does not certify their hosted evidence or source freshness.

## Fresh hosted preservation preflight

Read-only Render metadata checked **26 November 2026, 10:41:13 UTC (London)** using the Render monitor skill. Existing release documents identify the already-approved Night Scout staging website, and the returned service confirms its repository and workspace ownership. No environment secrets, private settings, runtime logs, database/provider data or mutations were requested.

- Website: https://night-scout-xero-staging.onrender.com
- Repository: `PaulLantsbury/virtual-cfo`; configured branch `codex/restart-baseline`.
- Latest deployment: cleanup `204226d0c796561d5bb812cde1bd9cec8da6a8d5`, status `live`, completed 21 November at 17:11:07 UTC. No newer pending deployment appeared in the latest three records.
- Automatic deployment `no/off`; service `not_suspended`. Build/start/health metadata matches the existing website receipt. No settings changed.

This independently refreshes the source-preservation preflight only. It does not recertify financial freshness, live membership denial, signed-in journeys, provider access or cross-tab behaviour. Temporary diagnostic source remains deactivated and must never be used as a rollback target.

## Concrete approval and rollback conditions for PM

After final tests and exact source identity are recorded, request one website-only approval for that exact candidate at the existing staging website, followed by bounded signed-in read-only acceptance. PM selects the single release owner. Before execution, refresh current live/pending source; stop to reconcile any intervening source, and preserve current branch, automatic-deploy policy, environment, sizing, build/start and health settings. No production/main merge, provider/API/OAuth, database, feed or configuration operation is included.

Rollback target is the verified cleanup source `204226d0c796561d5bb812cde1bd9cec8da6a8d5`, subject to a fresh compatibility and source check. The separate exact approval should include rollback authority if core navigation, membership isolation, financial bindings, missing-evidence handling or service health regresses. Stop acceptance and report the failure before making further unapproved actions. A website rollback cannot reverse external data or configuration changes; none are proposed here. Do not restore any enabled diagnostic commit.

## Signed-in acceptance plan after approval

1. Record deployed source and ordinary health, then inspect desktop and mobile five-core navigation and accepted Scout. Read the page summary within ten seconds and open Explore the Numbers; verify visible figures bind to the selected business/month/version.
2. Exercise supported aliases with real review/comparison fields, duplicates and fixed Plan destination parameters. Verify original/reference pages remain reachable. Do not use inert acceptance markers as context evidence.
3. Use existing supported historical evidence to inspect Plan's three constituents, pence-to-pounds display, weighting/bindings, separate comparison history and disabled repeat lever. Missing evidence must stay unavailable. No provider refresh or financial catch-up is permitted.
4. Check current Cash versus historical window and dated balances; with any naturally unavailable source verify retained independently supported figures and honest missing-source labels. Fault injection belongs to local fixtures unless separately approved.
5. Test an already-authorised authenticated nonmember session with a controlled denied target, without changing memberships or roles. If no such session exists, record this as a hosted acceptance gap, not a mocked substitute.
6. Investigate cross-tab behaviour in two deliberately recorded same-user/store tabs: record each URL, chosen current/comparison source and user/store scope; vary one control at a time and record the other tab before/after focus/reload. Do not mutate persistent plans or infer an original reset cause. Restore reviewed context and report observed behaviour without promising unagreed persistence.

No new owner product decision is needed for preparation. Any missing hosted session/target authority is collected through PM with the exact release proposal, not duplicate questions to Paul.
