# Member-scoped profit reporting service — 13 September 2026

Implementation prepared; applying the accompanying read-access proposal requires separate staging approval. No financial formula changes.

`GET /api/profit-reporting` accepts exactly `storeId`, `from`, `to`, `currency`. Only one complete calendar month and supported two-decimal currency are accepted. Browser-supplied identities, evidence/version selections and extra/repeated parameters are rejected.

The server verifies each bearer token with the same Supabase project's Auth endpoint through the existing bounded Auth client. A single read-only, repeatable-read transaction sets a LOCAL verified user ID, checks membership, selects at most two matching sealed versions and validates source evidence. Zero matches returns unavailable; multiple matches also returns unavailable, requiring a future explicit selection workflow. Neither latest date nor largest ID is treated as approval. There is no automatic evidence creation, correction, coverage restoration or financial review action.

Exactly one version returns `state: ready`, `versionId`, and the existing calculation result as `report`. The outer ready state means a report was read: `report.state` and each metric's state determine complete, partial or unavailable figures. Missing/stale expense categories preserve unrelated subtotals. Internal reader errors are replaced with fixed public text, and the sales provenance omits its private evidence reference. Snapshot digests are retained; raw inputs, evidence rows and user information are not returned.

401 denotes failed authentication, 403 absent membership, 400 unsupported scope, and 503 an unconfigured service or failed read. Every response is no-store. Production composition remains unchanged; the optional local server route accepts an explicitly supplied service.

## Proposed access

`db-migrations/proposals/20260913_profit_reporting_read_access.sql` adds SELECT only on four public source tables and five private profit-evidence tables to the existing `night_scout_review_service`. New RLS policies bind those reads to store membership for the transaction's verified user. Existing sales-read permissions are reused. It creates no login, password, grants to browser roles, write permissions or public RPC. Local identity setting is a trusted server boundary; possession of the private service credentials is not a browser authorization mechanism.

This proposal does not revoke or broaden the existing review service's unrelated review capabilities. Existing broader policies, ownership and role memberships must be inspected before application: permissive RLS policies combine with OR. The proposal is not a claim that historical existing role permissions have been redesigned.

## Remaining limits

Full historical-source validation is conservative and scans this store's mapped history. No new pagination or background aggregation is introduced. Existing sealed fixture digests contain driver-normalized DATE values: the calendar display fix is retained, but a future portable canonical-digest change requires an explicit evidence-version migration, not a global date-parser adjustment. Do not alter existing sealed proofs to demonstrate a successful report.

## UI, staging preflight and verification

Profit Overview now uses shared store/period selection with CFO Briefing, Verified Sales and Margin Analysis. Its fixed sample profit model is removed; headline sales, gross profit, contribution, operating profit and EBITDA plus the bridge are driven by the scoped report. Independently verified sales remain available if profit is not ready. Scenario Planner remains a separately labelled sample. Custom periods are preserved, but profit requires one full calendar month. The frontend request is cancellable and bound to user/store/currency/timezone/dates.

Read-only live staging catalog checks confirmed all nine target tables have RLS enabled and the existing restricted review service has SELECT on none of them. The only current policies on the four public tables are authenticated membership reads; the five private tables have no policies. The proposed service-specific policies therefore add the intended restricted read path. No grant has been applied in this package. Exact read-access proposal SHA256: `c5d4834b37636ac706321736dcc7a473a3ee10d12541822d7fc819e22b64ce0a`.

Combined HTTP/profit-access/review/proxy/runtime checks pass 21/21. These include actual disposable Store D calculations, authentication and cross-store rejection, zero/multiple-version refusal, missing costs, row-level isolation under the real restricted service role, no new writes, and atomic rollback if required RLS is absent. Frontend/backend typechecking passes. Final full isolated browser run passes 9/9, including desktop/mobile, partial costs, month restrictions, safe fallback, mismatched periods and stale-store results. These tests use synthetic HTTP fixtures; the disposable service tests independently verify real database calculations.

The existing local staging server has been restarted with the optional profit service and exact same-origin proxy. Its database reads correctly remain unavailable until the new grant proposal is approved/applied. No actual-profit screen success against live staging is claimed yet. After approval, apply the proposal once in staging, verify grants/policies, then walk through D February/March/April and compare selected-period sales across pages. A live walkthrough with real Supabase Auth remains necessary even after isolated browser tests pass.
