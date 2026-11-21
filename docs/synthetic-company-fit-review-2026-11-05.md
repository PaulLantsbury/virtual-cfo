# Synthetic company data fit review — 5 November 2026

Status: read-only review and proposed package. No database writes, grants, provider calls, scheduler changes or deployments authorised by this document. The new fictional company is separate from existing stores and Shopify/Xero acceptance.

## Finding

Direct daily synthetic data can exercise the canonical sales/profit calculation pipeline, period charts and scoped links, provided it supplies the same evidence contracts as the readers. Inserting daily totals into `public.orders` alone is insufficient. This does not establish provider ingestion or make every v11 page source-backed.

The inspected sales adapter calls `verified_sales_source` under the user session and validates exact business/period/currency and coverage. `cloud-sales-adapter.mjs` rejects absent/incomplete coverage, mismatched stores and stale mappings. `profit-reporting-service.mjs` accepts one complete calendar month only, authenticates the reviewer, checks membership and selects exactly one sealed profit version inside a repeatable-read read-only transaction. `profit-sales-reader.mjs` binds source settings, mappings and coverage into the revision. A digest establishes equality, not source completeness.

The public schema inspection reported RLS enabled on listed public relations. This is not proof of effective tenant isolation: authenticated allowed/denied reader checks and private-schema role/policy inspection remain required. Do not add broad grants, service-role browser clients or permissive policies to accommodate fixtures.

## Proposed staging package

1. A new reserved synthetic company identity, `.invalid` source marker, GBP, Europe/London, explicit fictional labels and an existing approved reviewer binding. Preflight must prove the target vacant and confirm the exact staging project; do not reuse Store D, Historical Store, provider test stores or customer identities.
2. A deterministic integer-pence daily ledger and independent arithmetic oracle. Record seed, dates, formula version, source/snapshot revisions and checksums. Include original orders/lines, discounts, VAT, shipping, linked later refunds, historic product costs and saleable-return recovery. Keep operational sales and accounting bases distinct.
3. Exact-period order/refund mapping evidence and reviewed coverage for every supported selection. Include prior-year comparators, leap/day and London daylight-saving boundaries, no-change days and partial current months. Explicitly withhold unsupported scopes rather than selecting older evidence.
4. Monthly sealed cost versions: historic line costs, return recovery, marketing, payment/fulfilment costs, five-person payroll and employer costs, overhead entries/categories, depreciation and amortisation. Every component needs source references, complete scope and matching source revisions. Never certify completeness merely because fixture generation succeeded.
5. Separate supported inputs for channel metrics, customers/cohorts, inventory, bank cash/reconciliation, receivables/payables and VAT liability/payment timing where those pages need them. A sales/profit ledger alone cannot validate CAC, ROAS, cash bridges/runway or cohort economics. Forecast scenarios remain assumptions with an explicit baseline.
6. A staged application proposal with inspected live schema contract, exact relation counts/hashes, safe rollback restricted to the new identity, existing reviewer membership plan, before/after fingerprints of unrelated stores and one transaction boundary. Rehearsal or application against staging requires separate approval; no SQL supplied here is an execution instruction.
7. Authenticated canonical-reader acceptance: supported monthly profit, exact-period sales, missing/stale evidence, duplicate versions, denied member, comparison None and unequal periods. Reconcile totals and per-order denominators to the independent oracle. Test actual scoped links and every chart against the same result, including snapshot/as-of/version metadata required by the v11 adapter.

## Business modelling constraints

The remote guidance fixes local defaults at £500,000 net turnover (£480,000 products plus £20,000 shipping), £504,000 discounted original product sales / 13,263 original orders (about £38 AOV), £240,000 net product COGS, £164,000 employment, £60,252 3PL/packaging and £60,000 other costs. This yields a £24,252 operating loss and £21,852 EBITDA loss. VAT and Christmas/gifting peaks remain explicit. The generator must declare whether sales and AOV are net of VAT and use one consistent definition; do not derive order counts from an inclusive AOV against exclusive annual revenue. Model five employees and outsourced fulfilment honestly: this cost base can produce a loss at this scale. Do not reduce wages or omit employer costs to force a positive result. Distinguish payroll expense, payment timing, employer liabilities, VAT and bank movement; outsourced fulfilment avoids invented warehouse staffing.

## Current evidence and remaining gates

Read-only staging inspection found Store D has two same-timestamp orders with missing `net_sales`; the Historical Store also has missing raw `net_sales`. These observations support isolation, not an instruction to repair either store. Existing mapping evidence may represent amounts independently; missing raw values alone do not prove every canonical reader fails.

The current v11 workspace is an opt-in fictional review. Its live source metadata/wiring, full reference-state parity, ten-second owner comprehension and contextual Explore the Numbers acceptance remain separate gates. A locally validated generator is preparation, not an installed company or complete live product.

Source review: `experiments/financial-v1/{rpc-sales-adapter,cloud-sales-adapter,profit-reporting-service,profit-sales-reader,profit-evidence-reader}.mjs`; `db-migrations/proposals/20260913_profit_reporting_read_access.sql`; `docs/roadmap-2026-10-31.md`; `docs/dashboard-test-data-2026-10-09.md`; historical synthetic reporting guidance. Remote guidance `docs/synthetic-daily-reporting-data-stream.md` was fetched from `codex/restart-baseline` and reviewed at content SHA `2db87969b717d80a0afb72f95e82f7e39a35dea8`; it agrees with these gates. Independent generator review remains pending integration.

## Independent local generator review

Reviewed `experiments/synthetic-company/generator.mjs` and its focused tests. An initial processor-clearing defect was corrected before acceptance: the local model now uses full gross processor payouts plus separate daily direct-bank fee debits. This is an explicit simplified gross-settlement model, not fee-netted payouts.

Independent execution of the corrected generator confirmed the 2025 oracle: £500,000 revenue, £240,000 gross product profit, £24,252 operating loss and £21,852 EBITDA loss. Every daily trial balance summed to zero; inventory stayed non-negative (minimum £35,000); 24 completed months produced 120 payroll accrual records across five artificial staff IDs. Closing processor clearing was £5,504.84 and independently matched only receipts whose payouts fell after the horizon. VAT-control posting roll-forward matched the closing control balance. These are offline arithmetic checks, not accounting certification or staging acceptance.

Focused tests cover independent annual budget expectations, posting/daily balances, refund revenue/cost caps and dates, clearing, VAT flow, seasonal shapes, replay immutability and CLI determinism. Final test-run evidence belongs to the integration record. Insurance must carry no recoverable input VAT; any taxable premises treatment must be explicitly elected in the fixture assumptions. Re-review tax outputs after that adjustment; tax tables remain fictional and configurable.

The generator is an offline journal only. It supplies neither canonical Supabase mappings/coverage seals nor an authenticated snapshot adapter, so no live supported page slice or staging company is claimed. The exact package gates above remain open.

### Canonical calculation rehearsal delivered

The new local `experiments/synthetic-company/canonical-adapter.mjs` maps retained original orders/refunds to the existing `calculateMappedSales` engine and maps journal expense/COGS postings to the existing `profitBridge` engine. It consumes recorded product/shipping VAT components from the generator. Three focused tests passed: all twelve 2025 months reconcile to the independent fixture summary and exact annual oracle; wrong/incomplete/unreviewed scopes and unsupported opening-cohort months are refused; mixed-company, duplicate and unbalanced events are rejected.

This closes a calculation-contract rehearsal gap only. Its explicit local `complete` flag is not a database coverage attestation, sealed profit version, authentication or membership check. The bridge neither executes SQL nor supplies a production snapshot. Opening-cohort months remain blocked until retained original-order evidence exists. Real source sealing and authenticated reader/page acceptance remain gates before staging activation.
