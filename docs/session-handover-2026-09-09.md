# Night Scout — stopping point, 9 September 2026

Paul asked to stop for today. Resume from this document, then read agreed-financial-definitions.md and the relevant implementation documents. Night Scout is the commerce virtual CFO, not Sam.

## Achieved today

- Created and bootstrapped the separate Supabase staging project, with store membership/RLS protections. Applied the approved verified-sales evidence package and checked real staging store isolation and synthetic sales/refund results.
- Connected the local dashboard briefing to verified sales, original AOV, discounts and separate refunds/shipping. Missing coverage stays unavailable. Reporting uses the selected store's currency and timezone.
- Built the first Shopify extraction/detail mapping path against synthetic API responses, because no real Shopify account is available. Original payment and refund components are reconciled; ambiguous/unsupported transactions are blocked.
- Added private candidate history, replay/source-version controls and cross-period recheck flags. Prepared source/evidence invalidation so changed data withdraws financial verification.
- Built exact transaction/VAT/payment reconciliation, snapshot-bound review, reviewer token verification composition, explicit reviewer authorisation and atomic audited restoration of an exact period. These later backend/schema additions remain local proposals, not applied to staging.
- Verified 52 Shopify/source/review/auth tests and seven independent PostgreSQL 18.4 concurrency cases. The latter exercise real lock waits, stale approvals, competing writes, revoked reviewer permission, rollback and timeout. Temporary clusters were stopped and removed.

Other test suites and builds were verified at their relevant earlier checkpoints; the 52+7 counts describe the latest ingestion/review work, not a fresh run of every project test. Auth adapter responses remain synthetic; real reviewer endpoint integration is not yet implemented.

## Environment and durable record

- Staging: bioalckltvkhlczusdvl. Original project futkktdebdygsdrcknpr was not changed by today's staging work.
- Development: local preview previously at localhost:3000. A preview process/session is not durable; inspect before restarting it.
- GitHub: PaulLantsbury/virtual-cfo, branch codex/restart-baseline, draft PR 1. Code checkpoint before this handover: local 0da03bf, remote e51b8c7dd034f51b33b4f4a387f3b996013491bd, matching tree b86a1d1896d21b9aa93ab2d969ec62603de5db69.
- Main has not been merged; Replit has not been synchronised; no production release. GitHub draft is the authoritative work record.
- No real Shopify account/data yet. Keep test inputs synthetic.
- Routine public GitHub draft uploads have standing approval (AGENTS.md). Remote migrations, merging and production releases are separate actions.

## Resume here

1. Inspect current branch/status and read reviewed-restoration.md, restoration-concurrency-checklist.md and reviewer-auth.mjs. Do not repeat completed isolation/concurrency work without a relevant change.
2. Prepare and test least-privilege service permissions for review preparation/restoration, including denial of raw truncation, audit mutation and reviewer self-grants. Existing tests mostly use the disposable database owner.
3. Integrate a server-owned Supabase Auth client targeting the same environment as the database, with bounded requests, safe errors and request limits. Authorise both review preparation and restoration. Add the reviewer UI and explicit provisioning path; do not expose an owner/service credential to the browser.
4. Review the accumulated local migration package and exact staging changes before applying anything remotely. Complete staging end-to-end checks with synthetic data before considering release.

## Remaining product roadmap (sequence, not a delivery promise)

1. Finish the controlled import/review path above: source-to-authoritative-evidence writer, completeness/exclusion handling, useful review UI, staging integration and recovery/error handling.
2. Complete Shopify installation/credential handling, incremental sync, retries/backfill and supported transaction edge cases. Validate with a development or real test store once one is available; synthetic tests cannot certify Shopify conformance.
3. Finish the financial model's data wiring: historic product/fulfilment/payment costs, marketing spend, contribution, overheads, operating profit/EBITDA, cash balances and actual-burn runway. Add accounting/advertising integrations in the order needed; reconcile weekly/monthly calculations to known ledgers.
4. Apply the same evidence-backed figures and dynamic explanations to every analysis page. Remove remaining snapshot/fixed values and misleading comparisons; complete trends and period consistency.
5. Implement the Opportunity and Recommendation Engines from the recovered specifications. Agree unresolved scoring/target/confidence policies first; avoid overlapping upside and keep cash release separate from recurring profit. Add monitoring/alerts and action tracking on verified inputs.
6. Launch preparation: merchant onboarding/store connection, account recovery/invitations, subscription entitlements/billing as required, operational monitoring/backups, access/performance checks, acceptance testing, controlled merge/Replit sync and release/rollback rehearsal. Confirm the minimum launch scope before setting dates.

The app is not complete. Today substantially improved the trusted-data foundation; much of the broader CFO analysis, integrations and recommendation product remains to be built or connected.

## Working-method comparison

A rough planning estimate is several full working days, potentially one to two weeks of stop-start sessions using the former ChatGPT → copied prompt → Codex → Replit checking loop. This is not a measured benchmark or an hours-saved calculation. The major gain is removing manual handoffs and doing implementation, tests, inspection and documentation in one continuous workflow. Quality and scope still need explicit verification.
