# Integration implementation handover — 26 November 2026

## Ownership transfer and safe state

The replacement integration chat takes implementation ownership from this checkpoint. The earlier recovery agent has frozen edits. This is LOCAL source only: no publication, provider request, OAuth, database query/mutation, configuration, feed, deployment or spending occurred. No test command is running.

## Exact baseline and preserved work

- Original dirty worktree remains untouched: `work/night-scout-v11`, branch `codex/v11-verified-20261031`, HEAD `9c4c66f2d7cae0ab874d708ca45d2d3afd16660d`.
- Independent recovery checkout: `work/night-scout-integration-recovery-20261126`, branch `codex/integration-recovery-20261126-local`.
- Starting snapshot is an exact `git archive` of cloud candidate `6cc5c542929dadedaa3a7633a6937160d4b16880`; its verified tree is `c78236b72faa526b4c6941de44e8e3692e5f0a87`.
- Independent local snapshot commit: `9c608a9675a1bcf7f03f85da6cf9745e6f50ad4e`. Its tree equals the public cloud commit; metadata/ancestry differ because this repository was initialized from an archive rather than copied shared Git metadata. Do not claim this local commit is the public cloud object. Any later publication must deliberately preserve the real reviewed public ancestry.
- Archive extraction copied no original local `.env`, credentials, browser sessions, private captures, node_modules or shared `.git` links.
- Applicable AGENTS.md was read; current operational `docs/roadmap-2026-11-26.md` was read remotely on the synthetic-company operational branch. Follow latest roadmap and parent coordination. Original AGENTS historical v11/deployment notes are superseded where the current session pins newer source.

## Copied source capsule

`source-capsule-manifest-2026-11-26.json` inventories all 65 explicitly selected source files with byte lengths and SHA256. This is a selection from a dirty local source, NOT an assertion that the old HEAD contains those files. Existing cloud provider-facts files were not overwritten.

Selected paths comprise Meta/Google API/report/collector runtime modules and declarations; their own routes and tests; Meta connection/spend components and client helpers; six SQL proposals; three provider preparation documents and three runner files; two historical integration status/design notes; and provider-owned experiments modules/tests. No broader v11/history page, App, shared startup, Settings or legacy Marketing page was copied wholesale. The original broader tracked changes remain solely in the original checkout.

## Tests and present limits

No tests, typecheck or build have been run on this RECOVERED candidate yet. The earlier 27 Meta +42 Google result is recorded historical evidence, not a new pass. Recovery checkout node_modules is not installed or linked; test/build environment setup remains next. Original modules are copied byte-for-byte, with no runtime fixes so far.

The existing public cloud fixes remain in the baseline: provider-facts extra/accessor-backed attribution property rejection, Plan/Cash recovery, accepted Scout/selectors/navigation, synthetic protocol precision fix and cleanup ancestry. Verify all are preserved during integration.

## Immediate next implementation batch

1. Verify this manifest and original preservation; prepare locked dependencies without copying secret/config files. Run the provider-focused Node mocked tests and frontend/API typecheck. Record commands and real results. The old source status says API typechecking was blocked by old Xero declarations, but the new cloud base already includes the cleanup; do not repeat that historical diagnosis without reproducing it here.
2. Read and selectively port provider-only composition from original `artifacts/api-server/src/app.ts`, `index.ts`, `lib/review-startup.ts` into the NEW baseline. Do not replace those files wholesale. Meta was wired locally but disabled; Google was unmounted. Keep every new mount/runtime disabled by default and preserve all current website/reporting behaviour. Settings/new-Marketing integration must follow current pages, not old v11/legacy page copies.
3. Coordinate independent security review with PM reviewer `pm_release_risk_review`, read-only on this implementer-owned checkout. The reviewer has already identified the real telemetry boundary below. Source publication is held until independent review and PM scope check. Do not assume an old branch's approval covers recovered source/new branch.
4. Prepare one exact source/staging-preparation package with changed path inventory, private-info audit, tests/build, ownership and target-binding semantics, current provider docs, schema/role proposals, secure callback/secret handling, disable/rollback and genuine acceptance gates. Do not activate it.

## Team engineering gates, not owner homework

- Meta OAuth token exchange currently places app secret, code and token-related values in outbound URLs. Existing `safeRequestPath` strips inbound app query logging only; it does NOT establish Render ingress/request logging or outbound tracing behaviour. Official Render docs read by reviewer state requested URL logging without guaranteeing query omission. Close with defensible configuration/synthetic-canary evidence or explicitly keep activation blocked. Do not use real credentials/OAuth codes as a logging probe or ask Paul to perform a vague telemetry audit.
- Existing notes pin provider/API/access guidance as of21Nov; verify current official docs before relying on specifics. Do not blindly repeat the local claim about Google's developer-token sunset or access model as newly verified fact.
- No Meta/Google schema/roles/secrets/callback/schedule were applied under this batch; recorded hosted absence comes from earlier notes, not fresh server inspection. No live provider calls are authorised.
- PM already has an existing closed Meta spend period, GBP and London-time convention. No owner needs to find another period; exact timezone and full account/day total reconciliation remain later provider acceptance.
- Google historical positive-spend advertiser is unavailable. Do not create an account, ads or spending to manufacture acceptance. No immediate owner action is established.

## Stop and escalation boundaries

Preserve the original dirty source and all accepted cloud/live work. Never deploy old v11, revive expired provider trials, run transactions/catchups, broaden DB access, inspect secret stores or touch daily financial feed as a recovery shortcut. Preparation can continue autonomously; any actual hosted/database/provider action needs its own exact reviewed approval.
