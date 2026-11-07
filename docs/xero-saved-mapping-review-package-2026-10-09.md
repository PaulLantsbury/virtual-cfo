# Saved Xero mapping review — 9 October 2026

Status: local metadata-only implementation and proposed SQL; no live grants, schema changes, consent or deployment performed.

## Existing authority and missing API

The applied 18 September schema grants authenticated SELECT on connections, account directories, mapping versions, selections and mapping audit with member RLS. It denies evidence and credential access. These existing rights do not prove the private `xero_v1` schema is exposed through PostgREST. No public saved-mapping RPC existed, and the generic mapping service router remained uncomposed. The package therefore prepares an explicit bounded public reader rather than widening schema exposure or using a worker/bootstrap login.

## Customer review

The active connection card now includes **Review saved account mapping**. The lazy viewer reads only after this button is opened. It shows the saved version/effective date, confirmation date, saved directory date and the accounts in each of the five existing categories. The directory timestamp is visible so saved names/statuses are not passed off as freshly fetched Xero metadata.

Recorded invalidation, missing directory metadata or empty categories are explicitly marked for review. Missing names are shown as unavailable instead of invented. Search/summary improvements in the initial bootstrap remain intact. Editing is still unavailable; the viewer never starts consent, reconnects, changes account classifications or fetches financial values. Cash selection remains separate from cash eligibility/readiness.

Read failure provides a retry and explicitly states the connection has not changed. Query identity and response checks include the selected store; changing stores removes the expanded view and prevents previous-store metadata from being displayed.

## Prepared server boundary

- Route: `GET /api/xero/saved-mapping?storeId=<uuid>`.
- Runtime: `createXeroSavedMappingRuntime`, disabled unless `NIGHT_SCOUT_XERO_SAVED_MAPPING_ENABLED=true` in the exact staging environment.
- RPC proposal: [xero-saved-mapping-reader-2026-10-09.sql](../db-migrations/proposals/xero-saved-mapping-reader-2026-10-09.sql).
- Exact shared parser: `experiments/xero/saved-mapping-view.mjs`, used by server and browser.

The proposed security-definer function uses `auth.uid()` membership, a fixed search path and authenticated function execution only. It returns version/account-directory metadata from the confirmed mapping snapshot, never tenant/user IDs, raw reports, financial amounts or credentials. Existing direct credential/evidence grants remain absent.

The optional runtime verifies the bearer, forwards it once to only the fixed staging member RPC, bounds the response to 128 KiB and ten seconds, validates the exact same-store contract and masks internal error detail. No schema exposure, worker credential or privileged fallback is added. The root coordinator composed this optional dependency in app/index before the generic readiness router; the runtime remains disabled by default.

## Activation and remaining work

The proposal must be reviewed and separately approved before application. After ACL/isolation verification, enable the optional runtime and publish through the established staging release workflow. Until then the button reports that the saved mapping cannot be loaded; local implementation does not establish hosted availability.

Saved organisation names/account codes are not present in the current stored directory contract, so this reader does not manufacture them. Full mapping history/editing, the nine-leaf P&L matrix, not-applicable dispositions, and accounting period preview remain the documented follow-on. Merely reviewing or classifying existing accounts should reuse the existing connection without another OAuth consent.

## Verification

- Seven exact shared-parser, route/runtime and browser-client tests passed: same-store identity, metadata bounds, credential/amount rejection, default-off behaviour, member bearer forwarding and unavailable states.
- Three disposable PostgreSQL tests passed: saved account metadata, member/anonymous isolation, absent credential grants, missing directory details and review state.
- Frontend TypeScript check passed (`pnpm --filter @workspace/virtual-cfo typecheck`).
- One composed-app regression passed: the route returns its own disabled 503 or injected same-store 200, is not blocked by disabled readiness, and cannot fall through to SPA HTML.
- Coordinator owns the synthetic browser walkthrough and final build. No live action is included in these checks.
