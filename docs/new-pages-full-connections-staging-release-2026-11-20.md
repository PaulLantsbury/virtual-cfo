# Website-only staging release — New page full connections

20 November 2026. Prepared for approval; not deployed.

## Exact tested source

Deploy `2ec14a6d16905fd64bd18bb2fc0bab14c4bb39ab` to the existing Night Scout staging website only. Branch: `codex/new-pages-full-connections-20261120`. Current website remains `a77e65822345087aa708fad19c98bbf3e9a73b21` until approved release. Preserve the configured branch and disabled auto-deploy; use exact-commit deployment.

## Visible changes

Profit gains complete monthly trends, weighted historical comparisons and fuller breakdown/margin comparisons. Marketing gains monthly financial trends, break-even and optional targets plus explicitly conditional calculations from a verified baseline. Cash gains a separately labelled EBITDA history; missing bank balances and movements remain yellow/unavailable. New Plan and explicit sample pages are preserved. [Full batch and remaining gaps](new-pages-full-connections-batch-2026-11-20.md).

## Verification

112 focused tests pass, frontend TypeScript passes and production build passes. Independent agents reviewed financial aggregation and scope isolation. Local fixture-browser interaction checked Profit exact/per-order history, Marketing independent assumptions/reconciling bridge, Cash profit-only history and zero captured console errors. The fixture harness is not published or claimed as database acceptance. Read-only staging confirms no eligible cash snapshots for the isolated company.

## Hosted acceptance after approval

1. Verify deployed exact revision and health. Select the authorised synthetic company, October 2026 and its reviewed version.
2. Verify October baseline and September comparison remain unchanged; check up to twelve actual complete months, exact table/version lineage and correct per-order denominators.
3. Check Marketing summed-input ROAS/POAS, prior-month comparison and conditional scenario/reset; no customer or advertising-response facts are inferred.
4. Confirm Cash's EBITDA chart does not populate any bank/operating-cash result, and unsupported acquisition/action figures remain marked.
5. Switch business and evidence context; no former-company values survive. Verify New Plan, Explore the Numbers and explicit sample mode.
6. Measure history loading and inspect errors. Reads are sequential and capped at twelve, but production-like latency is not established locally. Roll back to a77e658 on a material regression; do not retry provider jobs or alter the feed.

## Approval boundary

Website deployment and signed-in verification only. No database migrations/grants, cash seed, financial writes, provider jobs, daily scheduling, new service/spend, production release or main merge. Synthetic cash builder and source adapter are offline preparation only. The existing exact-source website approval covered a77e658 and does not cover this revision; the repository's standing development publication approval covers uploading this tested package, not hosted deployment.
