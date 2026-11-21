# Website-only staging release proposal — 21 November 2026

Status: prepared for owner review; not deployed. This proposal does not apply storage, data, grants, provider or scheduled-worker changes.

## Exact source and comparison

Proposed website source: **eada0f352e5634daef2815522ce676a446e22a6a**, repository `PaulLantsbury/virtual-cfo`, published branch `codex/yellow-connections-20261121`. GitHub branch-list and compare reads independently confirmed this source during preparation. Local integration commit `9b8ee37` has different ancestry; it is not the deployment identifier.

Cleanup baseline: `4ab7b6fcec1a5cdb5be9bb09f48ea042e1755177`. GitHub comparison is ahead by two commits with no divergence: implementation `bfd0d430a1f7d6cf1f19db46dd87caa4aff97c58`, then the final validation/publication record. Changes relative to cleanup:

| File | Website effect |
| --- | --- |
| `artifacts/virtual-cfo/src/components/ConnectedGrowthEvidence.tsx` | Matched customer-evidence comparison presentation |
| `artifacts/virtual-cfo/src/lib/marketing/reviewed-comparison.ts` | Earlier reviewed comparison validation |
| `artifacts/virtual-cfo/src/lib/marketing/reviewed-comparison.test.ts` | Comparison regression tests |
| `artifacts/virtual-cfo/src/lib/planning/future-plan.ts` | Reviewed draft provenance validation and truthful relative conversion assumptions |
| `artifacts/virtual-cfo/src/lib/planning/reviewed-plan-baseline.test.ts` | Reviewed baseline/draft regressions |
| `artifacts/virtual-cfo/src/lib/planning/useReviewedPlanBaseline.ts` | Authenticated, exact-version financial/acquisition composition; no sample fallback |
| `artifacts/virtual-cfo/src/pages/new-marketing.tsx` | Explicit earlier-month/version headline comparisons |
| `artifacts/virtual-cfo/src/pages/plan-visual.tsx` | Reviewed three-month baseline, available prior-year financial actuals, conditional scenario and frozen browser drafts |

Only two other changed paths relative to cleanup are documentation: `docs/roadmap-2026-11-21.md` and `docs/yellow-connection-register-2026-11-21.md`.

Last documented signed-in live website source is **b7ea4913c928ac9dac57bc45b5478ca06688a016**, per [hosted acceptance](cash-acquisition-hosted-verification-2026-11-20.md). The coordinator also verified current Render state read-only on 21 November 2026: deployment `dep-dc08trkipgvc73dk8ji0` is live at that exact commit, with automatic deployment off. This is service-state evidence, not new signed-in acceptance. Newer unpublished Scout work remains a preservation gate. GitHub target is ahead of that source by eight commits, without divergence. Relative to that live source, the above frontend list also includes `lib/marketing/acquisition-evidence.ts` and `lib/planning/reviewed-plan-baseline.ts`. API source has one changed file, `artifacts/api-server/src/lib/xero-staging-refresh-runtime.ts`: its two changes are TypeScript-only credential-port date-range declarations, not provider activation or runtime execution changes.

The wider source ancestry also carries Xero declaration/test cleanup, synthetic acquisition source and continuation/summary-refresh proposal preparation, package test scripts and documentation. Deploying a website bundle does not authorize executing these proposals, refreshing immutable summaries, extending expired trials, publishing additional data or restarting workers.

## What the release delivers and withholds

Marketing can compare explicitly selected, matched earlier month/version evidence; no invented comparison or unreviewed union of unique customers. Plan uses exactly three contiguous complete financial months and their matched acquisition/economics proofs. Existing supported financial history supplies available exact prior-year month comparisons. Source gaps remain yellow/unavailable. Conditional forecasts retain assumptions and source bindings; browser drafts remain browser-only.

The reviewed Plan repeat lever is disabled: paid-first-customer residual orders also include organic-first, guest and unknown orders and cannot be treated as a repeat-customer pool. Reviewed saved drafts reject a nonzero repeat improvement. Existing fictional monthly drafts remain separately readable, read-only. No absolute 2% conversion baseline is asserted.

This release does not complete multi-month CAC/session trends, publish optional customer aggregates into the existing 48 immutable summaries, provide shared action persistence/reminders, activate Monitoring, connect Settings billing/team services or establish live provider acceptance.

## Validation evidence and limits

The published [connection register](https://github.com/PaulLantsbury/virtual-cfo/blob/eada0f352e5634daef2815522ce676a446e22a6a/docs/yellow-connection-register-2026-11-21.md) records 22 focused Marketing/planning tests, 55 existing Profit/history/supplement tests, and a passing full workspace build plus final full typecheck/build recheck. Exact tested source tree recorded there: `9131fa1026063b588fd1a7509a7262a3e3040436`. Four focused Plan tests independently passed during implementation, including provenance retention, malformed bindings, legacy readability and repeat-forecast rejection; do not add overlapping test counts into a grand total.

Cleanup separately records 321 Xero tests, 146 baseline synthetic tests, focused guard checks and the repaired full build. Those receipts do not establish hosted provider acceptance. No new signed-in desktop/mobile/browser acceptance has yet been performed for this exact website package. Existing source loading/refetch costs and optional 12-month history are not a formal performance benchmark.

## Concrete approval boundary

Request approval to deploy **only the exact proposed website source** to the existing Night Scout staging website and perform read-only signed-in acceptance. Preserve its configured repository branch, automatic-deploy setting, environment values, existing supplemental enabled flag, service sizing and other service configuration. No production/main merge, database schema/data/grant change, supplemental refresh, provider request/transaction/retry, worker redeployment, feed/scheduler change, trial extension, new service or additional spending is included.

This approval is not reusable for a different commit. The read-only hosted check confirmed b7ea491 is live; recheck immediately before release and reconcile concurrent unpublished Scout work. No Scout application path is changed in either comparison above, but that alone does not prove an older exact source preserves newer independently deployed Scout code. If current staging contains newer Scout/application changes absent from this target, stop the exact deployment, integrate and test preservation, and present the replacement revision for review. Never overwrite the newer design or switch the service to a branch tip to bypass this gate.

Prior approvals pinned older releases. [AGENTS.md](../AGENTS.md) states standing publication approval does not authorize production releases and local staging-preview permission does not authorize hosted exposure. The latest release register explicitly requires concrete website-only review of the final tested revision. This is the reason for a new exact website release decision; it is not a request to reapprove completed storage/data work.

## Operator checks after approval

1. Read existing service identity, currently live commit and any pending deployment. Confirm the exact source is compatible with current Scout and current hosted schema/readers. Preserve user work; do not cancel unrelated jobs.
2. Deploy the approved commit explicitly, using the existing website-only path. Do not change environment values: the prior environment connector unexpectedly triggered a branch-tip deployment even with auto-deploy off.
3. Verify website health, anonymous API denial and signed-in company access. Check Marketing selected/current/comparison month and version changes; wrong/unavailable comparison must withdraw comparative figures. Check all three Marketing tabs and existing Profit/Cash figures.
4. Check Plan unavailable state before selection, reviewed three-month baseline where evidence exists, prior-year gaps, unit toggle, relative assumptions, disabled repeat lever, frozen source bindings, browser draft save/read and read-only legacy drafts. Switch company and date/version; no previous-company values or unsupported samples may survive.
5. Inspect desktop and 390px layouts, keyboard operation, console/application errors and request timings. Confirm Scout visual/source behavior is preserved. Report observed results, not presumed acceptance.

If a check fails, stop acceptance and record the observed failure. Do not repair it by widening grants, changing data, triggering a feed, mutating evidence or silently changing the release commit. Any website rollback must preserve the independently verified current Scout source and use the actual pre-release website revision; do not assume the older documented b7ea491 revision is still the correct recovery target.
