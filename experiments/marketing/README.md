# Google Ads / Meta read contract preparation

Disconnected, pure preparation for the agreed four-provider boundary: Shopify supplies trading facts, Xero supplies accounting facts, and Google Ads / Meta supply separate advertising spend and platform-reported performance. No collector, OAuth flow, credentials, database schema, route, scheduler or live provider access is added here.

## Reuse existing work without inheriting its assumptions

Existing `lib/db/src/schema/marketing-channel-daily-metrics.ts`, monthly snapshots and `artifacts/virtual-cfo/src/lib/analytics/marketingChannelMetrics.ts` describe an earlier seeded channel-analysis layer. Its fields do not preserve provider account identity/timezone, conversion-date basis, attribution windows or collection completeness. Its attributed-sales, estimated contribution and blended formulas are not a verified provider integration. This package neither replaces those files nor routes new facts into their calculations.

`provider-facts.ts` defines a normalized contract, not native API field names. Real adapters must separately verify current official provider documentation, exact granted read capabilities, account ownership, API version, pagination, monetary conversion/rounding and attribution settings. The synthetic test window/model labels are examples, not provider defaults.

## Contract boundary

| Data                   | Rule                                                                                                                                                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider namespace     | `google_ads` and `meta_ads` remain distinct, including when account identifiers coincide.                                                                                                                                                                               |
| Grain                  | Account/day totals and campaign/day breakdowns are explicit. A campaign breakdown cannot be mixed with account totals for the expense selector.                                                                                                                         |
| Day / timezone         | Day means the provider account's named timezone. No UTC/store-day recut is inferred. Future days are refused; current account-local day cannot claim complete coverage.                                                                                                 |
| Money                  | Currency and minor-unit exponent are explicit. Safe integer spend, unknown amount as `null`, no implicit pounds/micros conversion or FX. Tax-inclusive/unknown spend cannot become an ex-tax deduction.                                                                 |
| Attributed performance | Purchase counts remain decimal strings because provider attribution can be fractional. Purchase value has its own signed integer-minor field and fixed `provider_reported_unreconciled` basis. It never becomes Shopify orders/revenue or an additional revenue stream. |
| Attribution definition | Each observation retains its definition key, model, window and interaction/conversion/mixed/unknown date basis. Unknown windows keep all day values null. No platform reports are presumed mutually exclusive.                                                          |
| Campaign purpose       | Optional explicit source/operator classification: acquisition, retention, brand, mixed or unknown. Campaign names are not used to infer purpose or new-customer status.                                                                                                 |
| Coverage               | Complete requires all pages read and data-as-of evidence at or after the following account-local midnight. Partial/unknown and unknown spend remain unavailable for expense selection; absent days/accounts are not zero.                                                                                                                        |
| Observation / latency  | Retrieval time, data-as-of coverage instant (not the last conversion timestamp), expected reporting lag (nullable), settled-through day and attribution maturity remain separate. Recent extraction is not proof of mature conversions or financial reconciliation.                                                     |
| Freshness policy       | `assessObservation` and the expense request require an explicit maximum extraction age. No universal business threshold or risk grade is introduced.                                                                                                                    |
| Privacy                | Exact object-key allowlists reject raw payloads, contact data, credentials and arbitrary error fields. Fixed errors never echo invalid input.                                                                                                                           |

Input validation is not provider verification or authorization. An adapter must derive these facts from actual read evidence; caller assertions alone cannot establish source truth.

## One advertising expense, two evidence views

`reconcileMarketingExpense` is a pure evidence-selection rehearsal, not the existing financial/profit engine. The request identifies the store, exact period/currency/unit/timezone, complete expected ad-account population, maximum extraction age and **one selected source**.

- Platform eligibility requires one complete, fresh, ex-tax account/day total for every expected account and date. Duplicate snapshots, extra accounts, campaign rows, currency/timezone/unit mismatches and unsafe amounts are refused. Snapshot selection/revision history belongs to a later adapter/storage package; this function does not pick the newest duplicate.
- Xero eligibility requires a same-store/scope/timezone/currency/unit, fresh, complete, explicitly advertising-media-only ex-tax expense observation. Agency costs, salaries and software remain overheads under the agreed financial definitions. Negative credits/adjusted spend require a separately reviewed extension; they are not silently converted to zero.
- Matching evidence yields one selected deduction under `expenseKey=advertising_media`, never Xero plus platform spend. A variance withholds that proposed deduction until the consumer records a reviewed source choice. A reviewed variance remains visible. This review flag is preparation input, not an audit/permission system.
- Platform purchase value is never summed across providers, added to Shopify revenue or used to derive the expense. No CAC/new-customer attribution, LTV, payback, profit grade or recommendation is inferred.
- Other marketing expenditure is explicitly outside this selector. A future financial integration must consume this expense key once and reconcile it with existing accounting/marketing coverage before altering contribution.

Period-expense reconciliation does not establish transaction-level matching, campaign allocation, cash payment timing or causal marketing incrementality. Historical supported financial evidence and failure/staleness retention remain separate contracts.

## Checks

```bash
node --experimental-strip-types --test experiments/marketing/provider-facts.test.mjs
node_modules/.bin/tsc --noEmit --strict --skipLibCheck --target ES2022 --module nodenext experiments/marketing/provider-facts.ts
```

Tests use synthetic inputs only and cover both namespaces, fractional attribution, explicit unknowns, immutable snapshots, cross-provider revenue separation, one expense deduction, discrepancy review, complete zero versus missing data, stale observations, account/day completeness, duplicates, mixed grains/currencies/timezones, explicit classification and private-field refusal.
