# Night Scout — 17 September handover

## Latest checkpoint — live development test order

Completed test checkout #1001 with two sample items (£1,899.90) and a one-item simulated refund (£949.95). Live summary/detail reader succeeded, matching admin amounts; mapper excluded TEST_ORDER with zero financial events. Before/after fingerprint changed and repeat reads were identical. No Supabase writes or completeness certification. See [test evidence and next step](shopify-test-order-2026-09-17.md). This supersedes earlier empty-store statements below. Next is preparing/testing the precise staging intake proposal, not treating this test activity as actual revenue. Paul requests regular progress updates while work is active.


## Latest checkpoint — Shopify installation

Paul authorised necessary Shopify setup changes. Night Scout Development (app 424626651137) is installed on development store PocketLaunchpad1 (`pocketlaunchpad1.myshopify.com`) in organisation 185032893. The active version is `night-scout-full-history-readonly` (1132636897281), requesting `read_orders` and `read_all_orders`, API version 2026-07. Store currency is GBP and its timezone was changed to London. Installation was verified in Shopify admin; the app still displays its default example.com embedded placeholder, not the Night Scout interface.

Paul approved Custom distribution for this development app; selected and confirmed in Shopify. A separate customer-facing app is planned later. Submitted the full-history request explaining historical sales reconciliation and later refunds. Shopify Partners now states “Your app can access the full order history for a store.” Dev Dashboard initially rejected the new scope while its configuration form was stale, and automatic approval review correctly blocked a repeat submission. A freshly loaded scope selector subsequently offered `read_all_orders`; selected it, verified both read scopes and no validation error, then released `night-scout-full-history-readonly`. Verified Active in Versions. The earlier block is resolved through verified UI state, not an override. Installed-store consent/token scopes still need API verification; configuration release alone does not prove the token grants both scopes.

## Latest checkpoint — parallel Shopify connection package

Paul approved the three-agent connection/verification/staging-integration package. Implemented server-only credential provider, fail-closed context verifier and repeatable operator check; see [package evidence](shopify-live-connection-2026-09-17.md). The private development credential is in ignored owner-only local configuration, never GitHub or browser application code.

Live read-only verification succeeded after updating the installed app's data-access consent: Shop `gid://shopify/Shop/95601983836`, domain `pocketlaunchpad1.myshopify.com`, GBP, Europe/London, API 2026-07, actual token scopes `read_orders` and `read_all_orders`. Existing collector completed one page with **zero orders**. This proves authentication/context and an empty order query, not line/refund mapping, replay against live transactions, or financial completeness.

No Supabase changes/imports or production/Replit deployment. The next bounded task is development test transactions and real source/exclusion verification, then prepare/test the exact separate staging intake store/role/permissions proposal before asking Paul to apply it. Do not reuse Store D or reviewer/import credentials for candidate intake. [Staging intake proposal](shopify-staging-intake-proposal-2026-09-17.md) records exact boundaries. Preserve test-order exclusion; nonzero synthetic demonstration is a separate presentation decision. App home remains the placeholder; merchant-facing integration settings are not implemented.

## Latest checkpoint — Package 2 implementation

Paul approved Package 2. See [delivery record](package-2-2026-09-17.md) for migrated shared sales pages, factual CFO observations, Shopify readiness code, tests and live staging checks. Package 1 entries below are history; their proposed-package approval is superseded. Shopify account/installation and authorised live intake remain outstanding; no new database grants, production or Replit changes. Current local staging reflects application changes. Final combined existing browser regressions: 20/20 passed after correcting an asynchronous assertion race; new workstream checks are in the delivery record.


## Completed

Paul approved the revised ecommerce CFO roadmap and Package 1. Three independent agents inspected financial implementation, data/connector foundations, and page roles. Coordinator consolidated the [roadmap](roadmap-2026-09-17.md), [metric dictionary](metrics-dictionary-2026-09-17.md), [dashboard specification](dashboard-decision-spec-2026-09-17.md) and [source/backlog plan](data-source-plan-2026-09-17.md). Current README, project brief, AGENTS and team agreement now reflect the latest checkpoint. Financial definitions header corrected for implementation status only; no formula changed.

Pre-marketing contribution is already approved and calculated. Shopify collection/version/review/writer foundations already exist. Reuse them. Remaining legacy reads and sample features are explicitly inventoried, including static settings; no declaration of site-wide consistency.

## Decisions and next package

No new financial formula decision blocks the proposed Package 2 scope: migrate remaining shared sales/discount reads, add factual CFO observations, prepare Shopify runtime/connection integration, test/document/stage the combined result. Keep current page names. This is the recommended next package, not yet recorded as separately approved. Its internal steps need no repeated go-ahead after package approval. Actual development-store connection requires a concrete account/access step. Any necessary new schema application/grants remain separately approved.

Later decision groups are recorded in the metric/page specifications: customer identity and CAC/cohort/payback; Xero mappings and cost arbitration; cash coverage and forecast assumptions; opportunity ranking/monitoring thresholds; optional naming. Bring worked proposals at the relevant package boundary; do not ask Paul to decide them all to start Package 2.

## Verification and environment

Documentation-only package, code-reference inspection and cross-document review, relative Markdown link checks and whitespace validation. No application tests rerun because code is unchanged. No fresh live Supabase or browser checks: the 13 September handover is the last recorded staging verification, not a claim of current runtime availability. No app, database, permissions, production or Replit changes. Source of financial rules remains agreed-financial-definitions.md. Routine development-branch publication covered by standing authority.

Read this handover and roadmap before resuming; the older chronological pending grants/setup entries are superseded. No automation or long-running goal has been started.
