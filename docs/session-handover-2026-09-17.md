# Night Scout — 17 September handover

## Latest checkpoint — durable sync/status applied and restart-verified

Paul approved and staging enablement is complete. Applied the reviewed journal/status schema and Paul's fixed Shopify development-store membership through the authenticated Supabase dashboard. One membership, zero reviewer grants. Enabled durable operator history, performed exactly one unchanged replay, restarted and verified the saved attempt and correct 17 September reporting dates survive. Signed-in Settings now shows the real development-store collection and 1 order / 2 refunds / 0 financial events / 1 test exclusion; needs-recheck remains. [Application evidence](durable-sync-package-2026-09-17.md#applied-and-verified-in-staging--17-september-2026).

Fixed a date-only driver conversion discovered live; journal reads dates as text. Eleven journal/recovery checks plus the new calendar-date regression passed. Existing operator runs at 127.0.0.1:5190 with durable history; merchant app remains localhost:3000, Settings selected development store. No production/Replit changes, new financial-review authority, identity collection or schedule. Do not reapply schema/membership or request their approval again. Next is the separate customer-identifier observation storage/writer package, preserving financial fingerprints and excluding contact fields. New identity schema application remains a later concrete approval.

## Earlier checkpoint — durable sync/status prepared; staging approval pending

Prepared metadata-only persistent sync journal, restart uncertainty protection, authenticated member-scoped status RPC, optional operator journal integration and signed-in Settings status. Three agents plus coordinator; 37 focused checks and frontend typecheck passed. Live local Settings shows honest unavailable state while the new RPC is absent. [Prepared package and exact enablement proposal](durable-sync-package-2026-09-17.md). Schema/access not applied, no production/Replit change. Existing operator on 5190 remains process-only; merchant preview 3000 has updated Settings.

Paul also agreed no shopper contact data and a store-specific customer identifier for repeat-purchase reporting. [Architecture/decision](customer-data-architecture-2026-09-17.md) and [identifier preparation](customer-identifier-plan-2026-09-17.md) explain the separate observation path needed to preserve financial fingerprints. Active queries unchanged; customer identity storage/feed and repeat metrics are not implemented. Do not treat approval of the principle as deployed collection or approval of retention/guest/cohort formulas.

Next: request/apply the concrete staging sync-history schema plus Paul's fixed-store read membership, then enable journal mode, verify one replay and persisted status after restart. These are new grants/schema and still require approval. No financial reviewer grant or figure approval is proposed. Customer identity storage is a separate subsequent package.

## Earlier checkpoint — private operator sync screen

Three-agent package implemented and independently reviewed; 34 checks passed. A private loopback screen now reads the fixed development-store candidate and runs one explicit collection at a time, with safe errors, uncertain-outcome retry blocking and graceful shutdown. Live staging button test returned unchanged replay: two retained versions, one test order, two refunds, zero mapped financial events, needs-recheck preserved. Local operator screen on port 5190 is left open; existing merchant preview remains on port 3000. [Delivery, access and repeatable checks](operator-sync-package-2026-09-17.md).

Attempt history is process-local, not a durable sync log. No merchant membership, financial approval, schema/grants, scheduler, public exposure or production/Replit change. Next package: design and prepare persistent sync history and a store-scoped merchant status panel with concrete access/migration proposals before applying them. No more test transactions are needed for that work. Do not reapply intake setup, repeat the refund or clear test exclusions. The private access link must not be committed; reopening requires the current owner-only access file.

## Earlier checkpoint — eligible synthetic reporting verification

Paul approved a separately labelled synthetic reporting test route. New disposable eligible fixture exercises existing collection/candidate/import/independent-review/authenticated-reporting; it never changes actual Shopify test eligibility. SQL-backed browser consistency checks cover CFO Briefing, Verified sales preview, Margin Analysis and Profit Overview. Coordinator additionally read the existing live staging Store D: February sales £140/contribution £60/operating profit £35, March refund-period loss £75, April stock-cost recovery £40. Preview restarted and left on Store D February Profit Overview. No live database writes/new permissions, Shopify mutations or financial formula changes. [Full verification record and remaining scope](synthetic-reporting-package-2026-09-17.md).

No more Shopify test transactions are needed for this arithmetic/reporting stage. Later targeted Shopify cases can check source shape (discounts/shipping/tax) but must remain excluded from merchant sales. Next recommended implementation is operator sync visibility/repeatable ingestion, then a store-scoped merchant connection-status panel; schedule/exposure/new database requirements need concrete decisions when prepared. No production or Replit release is implied.

## Earlier checkpoint — change detection and recovery batch completed

Three-agent batch complete: read-only private inspector, eight restricted-pipeline recovery tests and independent review. 23 combined tests passed. Live second simulated refund completed; Shopify order #1001 is fully refunded and remains test=true. Staging detected the change, retained/superseded the old candidate, set needs_recheck and replayed the new batch without a duplicate. Current state: two retained batches, one current head, one order/two refunds, zero financial events, coverage false. Twelve fully visible other-store relation fingerprints unchanged; no new grants/migrations or production/Replit/main changes. [Delivery, exact checkpoint and limits](shopify-recovery-package-2026-09-17.md).

Do not refund again or rerun setup. Next proposed package is a clearly separated eligible synthetic reporting test route; do not reclassify Shopify test purchases or assume costs. Read-only inspector is available after uncertain outcomes. Real remote disconnect/concurrent commit tests, scheduled sync and merchant-facing connection status remain outstanding. Keep periodic progress updates.

## Earlier checkpoint — restricted Shopify staging intake applied

Paul approved the prepared package. Applied the fixed development store, service policies/lock helper and private restricted login to staging only. Dedicated readiness and live two-connection rollback-only locking passed. The 17 September Shopify test order/refund recorded once; repeat returned the same batch. One TEST_ORDER exclusion, zero financial events, no coverage certification, finance import or memberships. All other-store fingerprints unchanged. Temporary administrator password file removed; private intake credentials remain ignored/owner-only. [Full result and limits](shopify-intake-package-2026-09-17.md).

The final verifier initially included derived monthly-view rows in a zero-stored-transactions assertion; corrected that distinction and all checks passed. No application or data fix was needed. Do not reapply setup or request its approval again. Next is bounded changed-source/replay and recovery validation, then an agreed eligible-data reporting test route; actual Shopify tests must remain excluded. No production/Replit/main changes, scheduled sync or merchant-facing connection panel. Keep progress updates frequent.

## Earlier checkpoint — live development test order

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
