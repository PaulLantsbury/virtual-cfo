# Source adapter and disposable database verification

8 September 2026. Implemented experimentally; not integrated, merged or deployed.

## What is now tested

`experiments/financial-v1/source-schema.sql` creates four test-only relational tables: source orders, refund events, period coverage evidence and classified expense rows. `source-adapter.mjs` reads one store/period in a repeatable-read read-only transaction and feeds the isolated approved calculation module. Queries are parameterised. Writes happen only in the synthetic test setup.

Run `pnpm test:financial-db`. Fourteen tests use [PGlite's in-memory PostgreSQL](https://pglite.dev/docs/), destroyed when the test process closes. The exact development dependency is pinned to 0.5.8 in package.json and the lockfile. Existing package versions were not upgraded; pnpm also recorded the existing Drizzle packages' optional PGlite peer resolution. This does not add a PGlite import to the frontend or server runtime.

F03's February sales and full profit bridge, and F04's March refunds, agree with the unchanged fixture amounts after insertion into PostgreSQL and adapter loading. The adapter also verifies inclusive/exclusive VAT normalisation, missing historic costs, source decimal precision and cost-estimate provenance. The pure calculation suite remains the coverage for all ten worked cases, including cash and overhead allocation; not all ten have a database adapter yet.

## Source contract

| Source input | Adapter behaviour |
| --- | --- |
| Decimal money | Exact string conversion from pounds to integer pence; missing values, more than two fractional digits, scientific notation and unsafe totals are rejected rather than rounded |
| Order scope | Store/currency plus original ID, resolved event date/evidence and explicit original eligibility; no status or timezone inference |
| Tax | Explicit verified basis and actual VAT components; legacy gross/tax columns alone do not determine the basis |
| Refunds | Same-store original order foreign key, event date, separate product/shipping and VAT components; cumulative refunds cannot exceed original ex-tax/tax components |
| Product recovery | Evidence and saleable quantity; cumulative quantity cannot exceed the original sale; historic unit cost drives reversal, never current catalogue cost |
| Missing cost evidence | Sales remain available, COGS/profit incomplete; missing recovery evidence blocks affected trading rather than fabricating a reversal |
| Expense classification | Unique original source key per store prevents relabelling the same row into another cost group. Depreciation/amortisation is added into overhead once and added back only for EBITDA |
| Coverage | Explicit complete import evidence for exact store/date bounds; cost coverage is separate from trading coverage. No expense rows means known zero only with complete cost coverage |
| Provenance | Estimated cost rows set `containsEstimates`; callers must carry that status into any presentation |

The fixture schema uses one historic unit cost per original order. Multi-line product/variant cost allocation, partial-line returns and landed-cost evidence require an expanded adapter; the fixture's one-unit orders do not settle those policies. Return-to-stock outside the selected refund period is blocked until its event treatment is agreed.

## Guard results

- Duplicate order/refund keys and cross-store refund links are rejected by PostgreSQL constraints.
- Duplicate expense source keys cannot be counted in multiple classifications.
- Adapter rejects incomplete coverage, missing tax/currency/date/eligibility evidence, invalid refund tax components, excessive cumulative refunds/returns and mixed cost currencies.
- Querying March leaves February's sales and original AOV unchanged; a refund-only month remains active.
- Missing historic cost evidence preserves sales but withholds dependent profit figures.

`assessLegacyOrder` is a minimum-evidence diagnostic only. A successful result would not certify a full import, refund reconciliation, access control or financial correctness. The existing cloud-shaped sample without this evidence is explicitly rejected by the test.

## Sales/refund mapping progress

The [cloud-shaped mapping proposal](supabase-sales-mapping-proposal.md) now joins the actual raw table shape to separately verified evidence and tests the proposed SQL. It has not been applied to Supabase; live evidence collection and migration reconciliation remain open.

## Remaining integration work

This schema is deliberately outside `db-migrations/migrations`; do not apply it to connected Supabase. It is not a dump or reconstruction of the cloud schema. No live records were downloaded, backfilled or modified to make the tests pass.

Next build the verified import mapping from actual source fields into this versioned contract. Do not guess the incomplete legacy seed's tax/currency/cost values. Add line-level costs/returns and evidence-backed eligibility/date handling, then cash/account/transfer and marketing feeds. Cash runway currently has pure-function tests only; bank-feed mapping is not complete.

Before production: define replay/correction behaviour (duplicate imports are rejected, not automatically upserted), establish completeness evidence, reconcile migration history, implement authenticated store permissions/RLS and prove integration under the actual Supabase API roles. Parameterised scoped reads and test foreign keys are not production authorisation. PGlite tests do not exercise Supabase Auth, PostgREST, deployment, extensions or the live migration ledger.

GitHub's draft branch holds this code, tests and documentation. Main and Replit remain unchanged until an explicitly verified merge/synchronisation.
