# Xero summary P&L mapping foundation

Status: domain and schema proposal only. Nothing in this package is applied to Supabase or exposed by a route.

## Decision

Build the summary P&L mapping now, alongside the connection/readiness work, because the first real Xero connection has exposed the account directory needed to test it. Do not expand the deployed five-category bootstrap in place. That contract also contains `includedCash`, drives existing evidence columns and has already stored the staging credential. A parallel model keeps the successful connection intact and allows a controlled migration.

## Canonical P&L

Xero accounts map many-to-one into nine leaf lines. Each account may appear in only one leaf within a version. Every leaf must be explicitly mapped or owner-marked not applicable.

| Line | Kind | Formula |
|---|---|---|
| Total revenue | mapped | sum selected revenue accounts |
| COGS | mapped | sum selected direct-cost accounts |
| CM1 / gross margin | derived | total revenue − COGS |
| Fulfilment costs | mapped | sum fulfilment, delivery and payment-processing accounts |
| CM2 / product contribution | derived | CM1 − fulfilment costs |
| Direct/performance marketing | mapped | sum direct and performance-marketing accounts |
| CM3 / marketing contribution | derived | CM2 − direct/performance marketing |
| Salaries | mapped | sum payroll and employment-cost accounts |
| Other overheads | mapped | sum remaining operating overhead accounts, including software unless later separated |
| EBITDA | derived | CM3 − salaries − other overheads |
| Depreciation/amortisation | mapped | sum D&A accounts |
| Interest | mapped | sum finance-cost accounts |
| Profit before tax | derived | EBITDA − D&A − interest |
| Tax | mapped | sum corporation/income-tax accounts |
| Profit after tax | derived | profit before tax − tax |

Mapped expenses use positive magnitudes in the Night Scout contract. Derived values are calculated once and are never stored as mapping selections.

## Version and period rules

- Confirmation is owner-only and creates an immutable version with an effective date and pinned Xero directory timestamp.
- Exactly one confirmed version can start on a given date for a connection.
- Reports use the latest confirmed version effective on or before the reporting-period start.
- If a version changes inside a reporting period, the refresh must split/reaggregate or return review-required; it must not silently mix classifications.
- Renamed accounts remain stable by Xero account ID. Missing, inactive or type-changed accounts put the mapping back into review.

## Legacy compatibility

The adapter seeds a review draft only:

| Existing category | Draft P&L line |
|---|---|
| `revenue` | Total revenue |
| `processingFee` | Fulfilment costs |
| `advertising` | Direct/performance marketing |
| `software` | Other overheads |
| `includedCash` | stays in the separate cash mapping |

COGS, salaries, D&A, interest and tax remain unresolved. The draft must not be treated as complete or auto-confirmed.

## Suggestions

Suggestions may use only bounded account-directory metadata (ID, code/name, type and status), not credentials, raw reports or balances. Rules or a later AI service return candidate line, confidence and plain-language rationale. Every result is `review_required`; the owner must accept/reject it and confirm the complete mapping. There is no external AI call in this foundation.

## Intended API and UI follow-on

- `GET /api/xero/pnl-mapping/current?storeId=…&asOf=…`: membership-scoped current version plus readiness, never credentials or amounts.
- `GET /api/xero/pnl-mapping/draft?storeId=…`: account directory, legacy seeds and review-only suggestions.
- `POST /api/xero/pnl-mapping/confirm`: owner-only exact body with connection, effective date and nine dispositions; identity and tenant are server-derived.
- UI: a matrix with Xero accounts on the left and Night Scout leaf lines as destinations; multi-select supports many-to-one. Derived subtotal rows are visible but not drop targets. Show unmapped accounts, conflicts, suggestion confidence/rationale, completeness and the effective date beside a sticky confirmation action.

The existing Xero discovery/bootstrap UI remains available until this flow is live and verified. The persisted connection is reused; no second OAuth consent is required merely to classify accounts.
