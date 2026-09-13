# Expense evidence design — 13 September 2026

Proposal prepared from the saved repository catalog, financial input inventory, approved definitions and disposable prototype. Not an applied schema or fresh live-data audit. No financial policy, database, app or access change is made here. This scope covers variable expenses, advertising, overheads and depreciation/amortisation; historic product COGS and saleable returns are separate inputs to the same reporting contract.

## Existing rules to preserve

From `docs/agreed-financial-definitions.md`: contribution after marketing includes net product sales, COGS, net shipping, variable operating costs and advertising expense, counted once. Agency fees, salaries and software belong to overheads. Operating profit deducts overheads including depreciation/amortisation (D&A), excluding interest and corporation tax. EBITDA adds back **that same D&A amount** once. Recurring monthly overheads are allocated by calendar day when finer data is unavailable and the allocation is labelled. Missing expense evidence is incomplete, never an inferred zero.

## Reuse the current source structures

| Existing source (saved catalog: `db-migrations/staging/20260909_bootstrap.sql`) | Reuse | Required evidence / restrictions |
| --- | --- | --- |
| `overhead_entries`: id,store_id,category_id,period_start/end,amount,currency_code,entry_type,is_recurring,source,external_ref,notes | Existing period/category expense amount is the source value, not a parallel amount in a new reporting ledger. | `entry_type=actual` is necessary for actual reporting but not sufficient evidence. Verify currency, service/reporting period, tax basis, source total and classification. Budget/forecast remains separate. |
| `overhead_categories`: store_id,name,category_type,is_fixed,is_active,external_account_code | Source account/category lookup, retaining original identity. | Store-scoped, versioned classification must be explicit. Do not infer D&A or interest from `finance` or names; do not remove historical expenses because a category is inactive today. Verify category belongs to same store as entry; a category-id foreign key alone is not that assertion. |
| `marketing_channel_daily_metrics`: id,store_id,channel,metric_date,spend,data_source | Candidate granular advertising source if reconciled and complete. | Captured structure lacks currency/tax-basis columns. Verify those from source evidence; reject mixed/unresolved scope. `data_source=estimated` and default numeric zero are not verified actual expenses. |
| `marketing_channel_monthly_snapshots` and `marketing_blended_monthly` | Comparison/reconciliation material derived from the chosen spend authority. | Do not add daily spend, monthly spend, blended total spend and `overhead_content_spend` together. Derived totals are not additional expenses. Snapshot attribution/contribution is not accounting profit. |
| `store_cost_assumptions` rates and effective_from | Potential disclosed estimate input, **not automatic actual cost**. | Must evidence applicable dates, calculation basis, currency, provenance and coverage. Do not silently activate estimates or apply one current rate retrospectively. The full supported estimate policy remains a decision. |

The existing overhead uniqueness key is `(store_id,category_id,period_start,entry_type,is_recurring)`. It behaves as a period/category summary, not an invoice-line ledger. `external_ref` is not an independently enforced import identity. Do not insert arbitrary multiple source invoices into this table or treat a UUID as proof of uniqueness. A later import design may aggregate invoice lines into one existing summary with a source-membership manifest; that is a proposal requiring concrete schema review.

## Proposed companion evidence contract

Keep source amounts in existing tables. A companion expense-evidence mapping would reference the exact source table/row and store, with the observed source revision (or canonical values digest), evidence reference and classification version. It should carry:

- Reporting currency and explicit accounting amount/tax treatment evidence; service/event dates distinct from import timestamps.
- Provenance distinguishing evidenced actual, disclosed estimate and unverified; source document/account/period identifiers.
- One recognised reporting bucket: variable operating expense, advertising expense, operating overhead excluding D&A, or D&A. Excluded interest/corporation-tax records need an explicit exclusion reason so completeness can be reconciled rather than silently dropped.
- Source record identity and cross-source equivalence/reconciliation links; canonical accepted source for a spend total.
- For aggregated rows, manifest of upstream contributing identities and any known omissions, permitting retry/change detection and reconciliation to the original total.

These are proposed concepts, not approved table names or migrations. Avoid copying accounting amounts into an independently editable second truth. A digest/snapshot of observed values is verification evidence, not a second writable ledger. Any source amount, period, currency or classification change invalidates that evidence and dependent coverage until reviewed again. Preserve history; do not silently recertify by rerunning a query.

A record which cannot be classified from documented evidence remains unresolved. Do not automatically move agency fees into advertising because the provider is a marketing platform. Split source totals only from evidenced components; no arbitrary allocation between buckets.

## Deduplication and coverage

Use two checks: stable source-record identity for replay, and reconciliation across alternative representations of the same expense. A repeat import with identical observed data must not add expense; changed data with the same source identity is a change requiring review, not a second expense. Same-amount/day rows are not sufficient proof of duplication. Daily marketing rows and monthly summary rows need explicit authority and reconciliation rather than blind union.

Maintain expense coverage separately from sales/refund coverage, scoped to store, currency, date interval and component. Record expected source accounts/channels, source periods/versions and unresolved exceptions. “No rows” is unknown. An evidenced complete zero-expense category may validly total zero; a missing channel or unreviewed account must not.

Dependency behaviour should preserve already valid sales when costs are incomplete. Gross profit needs COGS; contribution additionally needs shipping/variable costs/advertising; operating profit needs complete classified overheads; EBITDA also needs identified D&A. A single sales-complete flag must never unlock these results. Whether to expose partial lower-level totals when other components are unavailable should be specified in the shared reporting response, not decided separately by each page.

Recurring monthly amounts must contribute to overlapping shorter reporting periods using the already-agreed calendar-day allocation. Do not use the legacy `monthly_overhead_total` containment filter or current `is_active` filter. Allocation precision, rounding/residual handling and exceptional source periods need a documented deterministic implementation/decision before rollout. Nonrecurring costs need evidenced recognition dates or service periods; do not silently prorate them as though recurring.

## Prototype reuse and limits

`experiments/financial-v1/source-schema.sql` has disposable `source_costs` categories variable/advertising/overhead/depreciation_amortisation and actual/estimated provenance. `source-adapter.mjs` groups these expenses and passes overhead+D&A, plus separately identified D&A, into `calculations.mjs::profitBridge`. This demonstrates the core classification bridge and integer-pence calculation without double-counting.

Do not install those disposable tables as a second dataset. The prototype's single `costs_complete` flag, event-date-only expenses and coarse `containsEstimates` result are insufficient as the final evidence contract. They do not by themselves solve recurring period allocation, source-equivalence deduplication, version invalidation or tax evidence. Reuse the validated arithmetic while designing the adapter against the existing sources.

## Decisions actually outstanding

**Already agreed — do not ask again:** contribution after marketing; agency/salary/software overhead treatment; operating-profit/D&A/EBITDA relationships; interest/corporation-tax exclusion; calendar-day allocation of recurring overheads where finer detail is absent; missing-cost incompleteness.

**Needs an explicit decision or source-specific evidence before implementation:**

1. Which reconciled advertising source is authoritative, and the complete account/channel set for each reporting period. This can be answered from source documentation; conflicting/unavailable sources must not be guessed.
2. Which cost estimates, if any, may be used in supported reporting, their calculation bases/effective periods, and how estimated results are labelled. Current assumption rates are not authorization.
3. Expense tax basis and nonrecoverable-tax treatment where source amounts do not establish it; never apply the old blanket20% rate.
4. Treatment and recognition period of accruals/prepayments, credits/reversals, mixed-purpose expenses and nonrecurring spanning-period entries where evidence does not directly resolve the mapping. No new timing rule is chosen here.
5. Allocation rounding/residual policy for sub-periods, especially arbitrary custom ranges, so sums reconcile without introducing inconsistent page rounding.
6. Any source-currency conversion; until agreed, reject mixed currencies rather than invent FX.

D&A accounting amounts/account mappings require evidence. This is not a request to reapprove the already-agreed EBITDA formula or a proposal to infer depreciation from cash purchases.

## Bounded next implementation proposal

First prepare a read-only expense normaliser/validator over existing overhead and marketing row shapes, paired with companion evidence and per-component coverage examples. Use explicit actual period amounts in one synthetic month; exclude estimated, tax-ambiguous or allocation-dependent cases from the initial supported set. Test classification, null vs complete zero, duplicate/revised source, cross-store/category mismatch, currency mismatch, inactive historic category, omitted channel and exact D&A add-back. Build no live importer or reporting display until this input contract is reviewed.

Then consolidate with historic COGS/return evidence into one reviewed schema/setup package for the existing staging dataset. Applying/populating it requires separate authorization. Cash, banking, payroll systems, Shopify account setup and production release are outside this design.
