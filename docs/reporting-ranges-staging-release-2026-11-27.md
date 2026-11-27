## 27 November — range release failed hosted acceptance; previous website restored

The owner-approved exact source `d2cb5a9ab173bcae0c194c9843a4ab9fd210dd63` was published on `codex/reporting-ranges-20261127` and deployed to staging. Public health passed. Signed-in multi-month Scout/Profit reporting for 1 August–31 October 2026 succeeded: product sales £172,800, operating profit £22,764.15, EBITDA £23,364.15; the separate operating-cash figure was about £23,920. The selected monthly chart appeared after source reads.

However, exact Custom 28 September–4 October 2026 in Weekly view returned “The selected date range could not be checked.” This is a failed live acceptance, despite the passing local tests. The remaining five-page range checks were aborted. No blanket range-release success is claimed.

The authorized rollback completed: previous compact-controls revision `016beeea1e30d63cc87eda5512666533f63918d3` is live again. Public health and signed-in October sales £64,800, operating profit £10,392.05 and operating cash about −£22,290 were checked. Restored Last month/Monthly/Total/None and retained the synthetic company. Existing linked branch, automatic-deploy-off setting, commands and health path remain unchanged. No database, grants, provider, daily-feed, AI or spending changes occurred.

Root cause remains unconfirmed. Independent offline reviews found no demonstrated date-key or financial-validation defect. The partial-range path performs additional source reads, unlike whole-month aggregation; reducing repeated reads from already validated monthly witnesses is a concrete candidate improvement, not a proven diagnosis. Existing completed range logs showed successful multi-month responses; no completed log for the failed weekly request was found in the bounded check. A request/authentication/transport failure cannot yet be distinguished from hosted timing/lifecycle behavior.

Next priority: reproduce the exact late-history cross-month week at realistic dataset size and capture safe request-stage/status evidence without tokens or payloads. Fix only the demonstrated failure, independently retest full and partial paths and stale/loading behavior, then prepare a new exact staging approval package. Do not retry or leave the failed candidate live under the consumed approval. Preserve passing source work and its local tests; keep live monthly reporting stable. New weekly/multi-month/Custom calculations are therefore prepared/published, not accepted as live.

# Reporting ranges — staging approval package, 27 November 2026

## Exact candidate and scope

Prepared local website/API source: `d2cb5a9ab173bcae0c194c9843a4ab9fd210dd63`, branch `codex/reporting-ranges-20261127`, based on released compact controls `016beeea1e30d63cc87eda5512666533f63918d3`. It contains 45 source/test/guidance files. Not published or deployed at this checkpoint.

Publish that exact source to PaulLantsbury/virtual-cfo on the named branch, then deploy the same revision to the existing staging website. Before deployment, verify the current hosted version has not advanced unexpectedly; reconcile rather than overwrite newer work. Preserve linked branch, automatic-deploy setting, existing commands, switches and access. Verify public health and signed-in synthetic-company journeys; restore the preceding confirmed live version if checks fail.

## User-visible changes

Weekly, multi-month and exact Custom financial ranges use revalidated monthly sources and actual dated sales/cost inputs. Explicitly classified month-end recurring payroll is allocated by calendar day with exact penny conservation; reliably dated costs remain dated. Profit/Growth chart buckets follow Weekly/Monthly and use their own original orders and weighted ratios.

Cash uses independent monthly cash proof plus actual dated bank/control offsets. Its bridge exposes the allocation-to-dated-profit timing adjustment separately; payments and bank balances are never smoothed. Whole-month acquisition inputs are combined where additive; partial session funnels use actual dated observations. Plan keeps a separate three-complete-month baseline with no lookahead. Shared controls, neutral dashes and loading feedback are retained.

## Verification

124 focused and regression checks pass, covering disposable SQL, actual SQL-to-client composition, monthly preservation, source/access refusal, dated cash/timing, allocation, leap-day/cross-month buckets, weighted ratios and Plan's baseline. All workspace constituent typechecks and frontend/API/mockup builds pass. Existing sourcemap/chunk warnings remain; an initial mockup build omitted required PORT and passed after providing it. No dependency reinstall was required.

Independent local browser checks use fictional GET-only fixtures and block external requests. All six range scenarios and five compact-controls regression scenarios pass, including positive whole-month cash/CAC, partial dated cash/timing, actual daily funnel and selected-period Profit/Growth charts. Desktop/mobile chart screenshots were inspected. These are local wiring/financial checks, not a new hosted or provider acceptance.

## Explicit limits

November remains open, so its newest week cannot claim complete monthly cost evidence. Missing monthly sources remain dashes; October is never substituted. Partial customer attribution, range-wide distinct customers, mature cohort/payback and the separate rolling-average comparison remain unsupported where no valid range proof exists. No invented proportional attribution or summed distinct counts. See [the range contract](reporting-range-calculations-2026-11-27.md).

This implements the agreed Xero-style cost treatment for the isolated synthetic reporting stream. It does not activate or remap the separate Xero provider feed. Rule-based commentary stays the default; no ChatGPT wording activation.

## Approval boundary

Source publication and this exact staging website/API release only. No database writes/schema/grants, provider calls or transactions, feed/schedule changes, AI requests, production changes, new service, plan or spending. Hosted approval is needed because the previous approval pinned a different revision.

## Signed-in acceptance

Check one sealed historical cross-month week, a multi-month period and partial Custom dates; reconcile financial totals and weekly/monthly charts. Navigate Scout, Profit, Growth, Cash and Plan, including reverse changes and reload. Confirm positive cash/timing and session-funnel displays where sources exist, missing-source dashes and stale clearing. Confirm Plan's labelled complete-month baseline, current open-month refusal and no browser/application errors. Restore a convenient supported selection and normal viewport. Record targeted coverage and any remaining limits rather than claiming exhaustive every-cell certification.
