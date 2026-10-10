# Xero accounting read package — 9 October 2026

Status: local implementation and proposed member-scoped RPC. No database changes, grants, consent, live Xero reads or deployments performed.

## Delivered

The existing mounted Xero readiness router now serves `/api/xero/cash-readiness` using its existing verified-member bearer and saved readiness RPC. This repairs a missing route without adding a database grant. Accounting readiness remains insufficient to unlock a cash amount: the response identifies missing dated eligibility/settlement evidence and never contains financial values.

A separate default-off `/api/xero/accounting-period` endpoint is composed into the application. It requires an exact store, date range and currency, a verified bearer and a bounded member-scoped RPC response. The runtime is restricted to the current staging project and forwards only that verified bearer/public key; it has no bootstrap or worker database credentials. Streaming RPC responses are limited to 16 KiB and ten seconds. Expanded or wrong-scope responses fail closed.

The [proposed SQL](../db-migrations/proposals/xero-accounting-period-reader-2026-10-09.sql) adds `public.xero_accounting_period(uuid,date,date,text)` as a security-definer function with fixed search path and an explicit `auth.uid()` membership check. Only authenticated function execution is proposed; direct evidence and credential access remain denied. It reads bounded saved evidence and returns the four existing mapped accounting values as decimal minor-unit strings, not JSON bigint numbers. The browser boundary preserves the existing signed amounts and does not derive profit, contribution, EBITDA or cash from incomplete classifications.

Only exact reporting scope/currency and the correct effective mapping can produce values. Mapping changes inside the requested range, missing classifications and recorded mapping/source review block the read. A later failed open-period refresh cannot present an older value as current. An explicitly closed-period failed refresh may return the last supported same-scope, same-mapping closed snapshot, clearly marked `stale` with its original retrieval date. Review-required evidence cannot use that fallback.

## Activation sequence

1. Review this proposal and verify the staging account/store mapping, exact evidence scope, API membership and supported snapshots using read-only queries.
2. Apply the reviewed member-reader migration only after the existing database-change approval boundary is satisfied. This document is not approval to apply it.
3. Verify function owner/search path/ACL, member isolation and that direct evidence and credential grants remain absent.
4. Set `NIGHT_SCOUT_XERO_ACCOUNTING_READER_ENABLED=true` only on the reviewed staging runtime and publish through the established staging deployment process.
5. Connect an explicitly labelled Xero accounting section to the selected report scope, show unavailable/stale states, and retain separate Shopify trading figures.

## Limits

The live database currently exposes only the value-free readiness RPC to authenticated callers, so the new amount endpoint cannot return live numbers until this proposal is applied and the optional runtime enabled. No privileged read fallback is implemented.

The deployed five-category mapping does not provide COGS, salaries, D&A, interest or tax; it cannot populate a complete P&L. The separate nine-leaf mapping foundation remains the next customer mapping workstream. Cash balances stored by the first worker do not establish restricted/unsettled account eligibility or dated per-account settlement, so this package deliberately keeps actual cash unavailable. Net movement and runway also need their own supported inputs.

No new accounting frontend is mounted in this package; the coordinator can add one after the RPC contract is reviewed, using the explicit Xero scope rather than substituting values into Shopify profit.

## Verification

- Five parser/route/runtime tests passed: exact scope, signed precision, extra-field rejection, authentication, default-off behaviour, fixed staging RPC and bounded responses.
- Five disposable PostgreSQL tests passed: signed saved evidence, exact periods/currency, member/anonymous isolation, no direct evidence grant, failed refresh, mapping change and explicitly stale closed-period retention.
- Eight cash/readiness/runtime tests passed.
- API TypeScript check remains blocked by existing missing experiment-module declarations and unbuilt API Zod declarations; no diagnostics point to the added files.
- A desktop/mobile mapping browser fixture was prepared, but execution was blocked because the local Chromium binary is absent. An earlier official browser download failed; no retry or live browser interaction was attempted. Existing thirteen mapping/discovery/browser-boundary tests and frontend TypeScript passed in the prior package.
