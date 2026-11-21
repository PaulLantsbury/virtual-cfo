# Durable sync history and signed-in status — prepared 17 September 2026

Paul approved preparing this package with three agents. Database application and new store membership remain a separate concrete approval under the repository staging rules.

## Prepared implementation

- A proposed private `ingest_v1.sync_attempts` table records the fixed staging store, reporting dates, server timestamps and a short allowlisted result. It stores no source payload, shopper contact details or credentials.
- The existing restricted intake role may start an attempt and finish it once. An unresolved attempt blocks another start, including after process restart. Completed history cannot be rewritten by that role. No automatic retry, scheduler or recovery-reset shortcut is added.
- An optional journal wrapper commits the start before collecting. Unknown outcomes remain explicit. The launcher opts in only with `--durable-history` and fails closed if the schema/access is absent. The previous running operator tool is not silently switched to new database writes.
- A proposed authenticated `shopify_connection_status` function checks store membership before reading metadata. It returns latest attempt, latest completed current collection and limited candidate status/counts, with their own reporting periods. It does not expose private payloads or approve finances.
- Settings now shows a read-only Shopify status panel for the signed-in selected store, replacing the fictitious Acme profile and inert account-editing controls. Unavailable/unconfigured and unfinished/uncertain states are explicit. There is no merchant sync/write button.

## Customer identifier decision

Paul approved retaining a store-specific Shopify customer identifier for repeat-purchase reporting, without shopper name/email/address/phone. The existing trading connector still requests none of those fields, including customer ID. [Current architecture and decision](customer-data-architecture-2026-09-17.md).

A [separate identifier proposal](customer-identifier-plan-2026-09-17.md) avoids changing historical financial source fingerprints. Query/normalisation preparation and regression cases are separate from deployed collection/storage. Guest matching, cross-store identity merging and repeat-metric definitions are not invented. No customer identifier has been collected live by this package.

## Concrete staging enablement proposed

After checks and approval:

1. Apply only `db-migrations/proposals/shopify-sync-history-2026-09-17.sql` to staging `bioalckltvkhlczusdvl`, with its fixed development-store/role/RLS preflight. This creates the metadata table, restricted journal permissions and membership-checked status function; it grants no new human membership.
2. Apply `db-migrations/proposals/shopify-status-member-2026-09-17.sql` to add Paul's existing staging sign-in as a member of the fixed Shopify development store `56d92f8a-746e-4b4f-b408-81fc98c4aa17`, after resolving/verifying that existing account. This is store-read membership, not financial-review authority. Existing store membership also permits that store's already-authorised reporting paths; it is not limited solely to this status panel. No access to other stores is added.
3. Restart the private operator preview with `--durable-history`, perform one bounded collection using the existing source/scope and verify replay plus persisted status after restart. Inspect the signed-in Settings panel for the same store. Keep test orders excluded and financial verification separate.

Customer-identifier storage/collection is **not** part of this database application. No production/main/Replit change, public exposure, new Shopify scopes, new test purchases or financial completeness approval.

## Verification record

37 focused checks passed: nine disposable journal/schema groups, two independent recovery/access checks, four customer-data/identifier tests, three launcher checks, three frontend response-contract checks, one membership-proposal check, nine HTTP regressions and six desktop/mobile browser cases. Frontend typecheck passed. The first membership test needed its missing review-schema fixture installed; it then passed without a proposal change.

Live local staging Settings was checked with the existing Store D membership: it displays connection status unavailable because the new function is not installed. This is expected, not a successful live durable-sync claim. No live schema, permissions or identifier collection has been applied. The existing operator preview remains in its prior process-only mode; the new durable mode awaits approval. Independent agents reviewed the journal and UI; coordinator completed the final checks after agent usage limits interrupted their closing turns.


## Applied and verified in staging — 17 September 2026

Paul approved the concrete enablement. Used the already authenticated Supabase dashboard for project `bioalckltvkhlczusdvl` (Night Scout Staging); no administrator password was needed. Preflight confirmed journal/RPC absent and resolved Paul's existing sign-in. Applied the reviewed schema SQL (comments omitted in the editor) and the fixed-store membership proposal with that verified account. Dashboard result confirmed one membership and zero reviewer grants for that store/account. Restricted connection verified the new table, postgres-owned fixed-search-path security-definer RPC, authenticated execute and no anonymous execute.

Enabled `--durable-history` on the private loopback operator. Exactly one collection was requested: attempt `5ee36cb1-315e-44fd-be5a-881af9e3b39d`, started 15:31:07.851 UTC and completed 15:31:09.346 UTC, result `replay`. Reporting period remains 17 September. Existing current candidate stayed `f9d650ba-5b34-4f16-8596-b9319aa20e8e`: two retained versions, one order/two refunds, one TEST_ORDER exclusion, zero financial events and needs-recheck preserved.

Live inspection found a Node PostgreSQL date conversion issue: date-only fields parsed in local time could display the previous UTC day. Journal reads now explicitly select dates as text; no stored date or financial record was changed. Eleven journal/recovery checks passed, followed by the new focused calendar-date regression. Restarted the operator and verified the saved completed attempt survived with correct dates, while process-local lastAttempt reset to null; no second collection was requested.

Signed-in Settings was refreshed, the new PocketLaunchpad1 development-store membership selected, and the real authenticated RPC showed the completed collection, matching counts and needs-recheck. The page makes no financial-verification claim. No new customer identifier collection, financial-review grant, production/main/Replit update or scheduled sync. Customer identifier observation storage/writer is the next prepared implementation package; this approval must not be reused for new identity schema/grants.
