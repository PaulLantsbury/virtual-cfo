# Xero mapping usability and reporting review — 9 October 2026

Status: repository audit and local UI improvements. No live Xero calls, consent, database changes or deployment performed. Hosted revision, account binding and actual stored evidence have not been independently inspected by this review.

## What exists

| Surface | Implemented behaviour | Limit |
| --- | --- | --- |
| Settings / `XeroStagingDiscovery` | Same-origin owner discovery, five-category checkbox selection, effective date, retained connection and reconnection | Active connection displays status only; no saved-mapping read/edit/history journey |
| `XeroMappingSetup` | Read-only local preview fetching `127.0.0.1:4002` | No current component import found; not a hosted customer mapping tool |
| `/api/xero/merchant-readiness` | Bearer-authenticated, selected-store-scoped value-free connection/evidence state | No financial amounts or requested report-period coverage in its contract |
| `/api/xero/cash-readiness` client | Frontend expects bounded same-store status | No corresponding route mounted in `artifacts/api-server/src/app.ts` |
| Five-category worker | Stores scoped revenue, processing fees, advertising, software and included cash against connection/mapping version | Successful collection does not populate Shopify trading metrics or a nine-line summary P&L |
| Summary P&L foundation | Nine leaf classifications and derived subtotals; owner confirmation/version/date rules, suggestions and schema proposal | Explicitly not applied or exposed by a route; cannot be described as installed |
| Generic mapping router | Dependency-injected current/confirm boundary with tests | Not mounted by application composition; no production persistence adapter |

Sources: `artifacts/virtual-cfo/src/components/XeroStagingDiscovery.tsx`, `XeroMappingSetup.tsx`, `artifacts/virtual-cfo/src/lib/xeroMerchantApi.ts`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/lib/xero-staging-bootstrap-runtime.ts`, `deployments/nightly-staging/xero-refresh-runtime.mjs`, and [summary P&L foundation](xero-summary-pnl-mapping-foundation-2026-09-25.md).

## Store, organisation and dates

Readiness requests include the selected store and reject a response for a different store. Bootstrap/discovery is a restricted staging-owner workflow: server configuration pins the owner and store, the discovery directory supplies the tenant, and the final callback rechecks the pinned tenant and active account directory. The browser does not select the bootstrap store. Before another consent, verify that the visible active store matches the configured staging store; general multi-store onboarding requires a server-authorised explicit context contract.

Worker evidence is tied to an exact reporting range, currency, connection and mapping version. The conversation reported a supported 1–25 September refresh; that report is not independent live verification here and does not establish full 1–30 September coverage. The value-free readiness card cannot certify an arbitrary dashboard date range. Xero amounts remain separate from Shopify under the agreed accounting policy.

## Improvements prepared in this batch

Bootstrap account selection now supports searching names/codes, retains selected accounts in filtered results, explains assignments disabled by another category, and provides a full selection summary before confirmation. Empty search results are distinguished from no compatible accounts. Existing five-category eligibility, unique assignment, mandatory selections, limits, effective-date validation and server payload remain unchanged.

The active-connection message now directs the customer to the evidence status rather than repeating a first-refresh warning after a successful refresh. It explicitly identifies that saved mapping review/editing is not available yet.

The UI explains that an organisation without an applicable account should leave setup incomplete instead of selecting an unrelated account. Optional/not-applicable treatment belongs in the already documented P&L follow-on, not an in-place financial-policy change to the five-category bootstrap.

## Next customer journey

1. Display selected store, connected organisation, reporting scope and connection/evidence freshness together, using membership-scoped server metadata.
2. Add a read-only current mapping and history view for an existing connection; account classification must reuse the connection without another consent.
3. Complete the parallel summary P&L persistence/service/router contract from the existing proposal, with a reviewed migration package before application.
4. Provide accounts-to-leaf-line classification with understandable review-only suggestions, unresolved/conflict counts, explicit not-applicable dispositions, effective date and P&L preview. Derived subtotal rows cannot accept accounts.
5. Connect the confirmed mapping/version to scoped accounting readers, then test mapping changes, renamed/inactive accounts, partial periods and retained same-scope evidence.
6. Review the populated dashboards with Paul individually after source/calculation coverage is working.

Do not expand the deployed five-category credential bootstrap in place, blend Xero accounting with Shopify trading, infer missing amounts as zero or make cash-account eligibility automatic. Cash-account inclusion/restrictions and dated balances remain separately confirmed.

## Validation

- Existing browser-boundary tests: 13 passed across discovery, merchant readiness and merchant API contracts.
- Frontend TypeScript check: `pnpm --filter @workspace/virtual-cfo typecheck` passed.
- New UI text/search/summary is a reversible presentation change; no new financial arithmetic or schema.

Remaining verification: signed-in browser walkthrough using synthetic discovery fixtures, full hosted revision/connection/evidence inspection, and accounting amount endpoint integration. This audit does not claim customer mapping or cash reporting is complete.
