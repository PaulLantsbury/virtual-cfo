# Historical and daily testing programme — 18 September 2026

Status: **proposal, not an installed generator or new staging dataset**. The deterministic manifest/action-plan preparation and disposable checks are now implemented; see [delivery and limits](testing-programme-preparation-2026-09-18.md). Paul requested preparation of historical comparative data and a recurring handful of development transactions. This document makes that package reviewable; it does not authorise source mutations, new credentials, database application or recurring activation. First-night verification is recorded separately by the coordinator.

> 18 September decision: Paul approved preparing a trailing 31 completed London-day reporting window, with missed days included in the next regular window and older gaps/uncertain outcomes separately reviewed. Tonight’s fixed-date deployment is unchanged. See the delivery record for implementation limits.

## Recommended split

1. **Shopify development connector:** real development test orders/refunds verify authentication, collection, mapping, exclusion, replay and freshness. Retain `test=true`. These must never become eligible merchant revenue merely to populate charts.
2. **Isolated synthetic financial store:** invented eligible sales, refunds, historical costs and expense evidence exercise the genuine reporting readers/calculators and website. Clearly label the store and every fixture manifest as synthetic. Use a new store; preserve existing Store D and E regression cases. No real customer identifiers or contact details.

Both routes need separate expected-action manifests and outcome records. A successful connector run is not an attestation of financial completeness. A working synthetic chart is not proof of live Shopify completeness.

## What the repository supports today

| Boundary | Code-backed capability | Gap before this programme |
| --- | --- | --- |
| Shopify collection | `experiments/shopify/collect.mjs` reads accessible order history, including old orders with later refunds; requires `read_orders` and `read_all_orders`, checks store context before/after extraction | Not snapshot-isolated; source coverage still needs separate evidence. Current `queries.mjs` requests **one order per page**, default `maxPages=100`, and collector timeout is 60 seconds. Continuing daily creation will eventually exceed the present bound. Prepare scale/pagination changes and test the bound before extended activation; do not quietly delete source history or treat truncation as success |
| Reporting scope | `run-development-intake.mjs` accepts explicit periods of at most 31 days; durable nightly/journal protections exist | Published trial is fixed to 17 September, not rolling dates. Later test activity may be observed in full source history without creating eligible reporting events in that fixed period. Historical/monthly coverage and catch-up remain decisions |
| Eligible pipeline | `synthetic-reporting-fixture.mjs` drives invented evidence through collection/details, candidate, first/subsequent import, separate exact-period review, authenticated sales RPC in disposable PostgreSQL | This Store E fixture covers February/March sales, not the new historical ledger, production source completeness or profit evidence |
| Profit evidence | `profit-staging-fixture.mjs` supplies separate evidenced costs/expenses and sealed monthly manifests; existing Store D spans February–April | General 14-period fixture builder is absent. Do not rerun Store D setup: it refuses existing store replay. New store/membership/fixture application is a separate reviewed staging mutation |
| Independent arithmetic | `cfo-acceptance-fixture.mjs` and its tests contain hand-worked three-order sales/cost cases, missing evidence and stale-source cases | New ledger has not yet traversed the full database/browser path. Adapter tests use synthetic RPC transport |
| Website | Existing cross-page suite covers CFO Briefing, Verified sales preview, Margin Analysis and Profit Overview against SQL-backed synthetic results | Does not establish every chart, comparison, planner or page as connected. Complete-month actual-profit slice is supported; partial-month profit/comparison behaviour must be checked and must not be promised |
| Daily generation | No daily creation programme is established by these files | Creation API/permissions, safe identity markers, transaction-status verification, durable generation ledger and scheduling are not implemented. Existing read credentials do not imply order/refund write access |

This is a source review, not a rerun of those existing checks. References: [approved definitions](agreed-financial-definitions.md), [synthetic route](synthetic-reporting-package-2026-09-17.md), [calculation acceptance](calculation-acceptance-2026-09-17.md), [roadmap](roadmap-2026-09-17.md).

## Historical dataset: concrete proposed v1

Freeze initial data at **17 September 2026, 23:59:59 Europe/London**, with 13 complete months **August 2025–August 2026**, plus **1–17 September 2026**. GBP only. August 2026 can compare with August 2025; September comparisons must use 1–17 September 2025, not its entire month. Do not claim every month has a preceding year within this history.

Use three invented original-order types per block, extending the independently calculated acceptance ledger:

| Type | Gross products ex VAT | Product discount ex VAT | Pre-refund product sales | Net shipping ex VAT | Historical COGS |
| --- | ---: | ---: | ---: | ---: | ---: |
| A, tax-exclusive source | £120 | £12 | £108 | £6 | £40 |
| B, source includes recorded VAT | £80 | £8 | £72 | £3 | £30 for two units |
| C, zero-VAT product | £60 | £0 | £60 | £0 | £20 |

B source gross is £96 including £16 VAT; discount £9.60 includes £1.60 VAT; shipping £3.60 includes £0.60 VAT. Use actual recorded tax, not a universal tax-rate assumption. One block has three orders, gross £260, discount £20, sales £240, shipping £9 and COGS £90; original AOV is £80. Add evidenced variable expenses £12 and advertising £23 per block. Each **complete month** has £30 actual overheads including £6 D&A, counted once per month. These are invented source documents, not inferred/estimated actual merchant costs.

Recommended block counts:

| Month | Blocks | Orders | Base net product sales, before exception overlays |
| --- | ---: | ---: | ---: |
| August 2025 | 2 | 6 | £480 |
| September 2025 | 3 | 9 | £720 |
| October 2025 | 3 | 9 | £720 |
| November 2025 | 4 | 12 | £960 |
| December 2025 | 5 | 15 | £1,200 |
| January 2026 | 2 | 6 | £480 |
| February 2026 | 2 | 6 | £480 |
| March 2026 | 3 | 9 | £720 |
| April 2026 | 3 | 9 | £720 |
| May 2026 | 3 | 9 | £720 |
| June 2026 | 4 | 12 | £960 |
| July 2026 | 4 | 12 | £960 |
| August 2026 | 4 | 12 | £960 |
| September 2026, days 1–17 | 2 | 6 | £480 |

Place block 1 on day 5, block 2 on day 15, then additional blocks on days 20, 24 and 27; place their A/B/C events at 10:00/11:00/12:00 local time with explicit offsets. This gives September 1–17 sales £480 in both years and comparable AOV £80, while August year-on-year product sales rise from £480 to £960 (+100%). Dates are fixture data, not a proposal to backdate Shopify transactions.

For a complete month with `n` blocks and no exception: gross profit £150n; Contribution £124n; operating profit £124n − £30; EBITDA £124n − £24. These hand-worked formulae guide review; executable assertions must contain fixed expected numbers from a separately checked manifest, not invoke the production calculator to produce its own expected answers. August 2026 therefore expects sales £960, shipping £36, COGS £360, gross profit £600, Contribution £496, operating profit £466 and EBITDA £472. August 2025 expects Contribution £248, operating profit £218 and EBITDA £224.

Add three named exceptions without changing original eligibility or AOV:

- **20 February 2026:** refund block-1 A £20 products + £4 VAT and £1 shipping + £0.20 VAT. Cash refund £25.20; no stock recovery. February totals: sales £460, shipping £17, COGS £180, gross profit £280, Contribution £227, operating profit £197, EBITDA £203; six original orders and AOV £80.
- **5 March 2026:** refund one block-1 February B unit: £30 products + £6 VAT, no shipping; actual return handling £4. March totals: sales £690, shipping £27, COGS £270, gross profit £420, Contribution £338, operating profit £308, EBITDA £314. February original AOV stays unchanged.
- **5 April 2026:** the refunded B unit re-enters saleable inventory; independently evidenced historic cost £15. April COGS £255, gross profit £465, Contribution £387, operating profit £357, EBITDA £363. Recovery is not revenue or cash.

September partial month initially certifies **sales only**; do not invent partial-month overhead completeness or broaden current actual-profit support. Retain existing refund-only March and recovery-only April Store D cases: the trend dataset deliberately has ordinary sales alongside these exceptions and cannot replace those edge-case tests.

Add separate disposable variants (not changes to the reviewed base): missing historical cost, missing overhead coverage, stale order evidence, one-penny refund mismatch, incomplete extraction, an excluded £999 test order, refund-only/zero-original-order period, and store-timezone month boundary. Preserve supported earlier subtotals, withhold dependent unsupported measures. Non-positive margin denominator, repeat-customer metrics, cash/FX, forecasts and ranking stay outside this package's policy decisions.

## Daily programme: proposed 14-day trial

Start only after generation safety, agreed rolling coverage and exact staging activation are reviewed. Schedule generation at **18:00 Europe/London**, with next-day **02:00 collection**. This avoids coupling source creation to the collection startup window and lets overnight checks identify generator failure separately. First cycle begins on an explicitly recorded Monday; no silent catch-up on installation day. End automatically after two complete cycles.

| Day | Shopify development actions | Isolated synthetic financial actions after its separate implementation |
| --- | --- | --- |
| Monday | Create test A and test B | Create eligible A and B plus declared evidence; sales £180, shipping £9, original orders 2 |
| Tuesday | Create test C | Create eligible C; sales £60, original orders 1 |
| Wednesday | Partial refund Monday A: £20 products + £4 VAT and £1 shipping + £0.20 VAT; no new orders | Record same financial split; sales −£20 and shipping −£1, no cost recovery |
| Thursday | **No mutation** | **No mutation**; unchanged replay expected |
| Friday | Refund Monday B fully: £72 products + £14.40 VAT and £3 shipping + £0.60 VAT (£90 cash); no new orders | Record same split; sales −£72 and shipping −£3; no stock recovery yet |
| Saturday | Create test A and test C | Create eligible A and C; sales £168, shipping £6, original orders 2 |
| Sunday | **No mutation** | **No mutation**; unchanged replay expected |

Repeat in week 2 with distinct cycle IDs. Proposed limits: **10 new test orders and four refund actions over 14 days**; existing development transactions are untouched. Synthetic equivalent has the same cap, independently identified. No live payments, customer email, fulfilment, inventory changes, edits or automatic restocking are intended; verify the chosen development creation/refund method can enforce that boundary before enabling it. If it cannot, stop and revise the exact proposal. A supported order-edit/review case should be a separate explicit test, not silently added to this calendar.

Independent weekly synthetic sales oracle: gross £440; discounts £32; original pre-refund sales £408; five original orders; AOV **£81.60**; product refunds £92; net product sales **£316**; original net shipping £15 less refunds £4 = **£11**. Refund cash **£115.20**, including product/shipping refund VAT £19.20. Shopify route contributes **zero eligible financial events** regardless of these source amounts. Weekly profit is not asserted: the first actual-profit slice remains complete calendar months, with separate complete cost/expense evidence. Calendar-month boundaries split refund events by their actual local event dates rather than forcing these weekly totals into one month.

Source scenarios are semantic expectations, not confirmed Shopify API functionality. Verify supported test-order creation, payment facts, taxes/discounts and refunds against the actual development environment during implementation. Do not assume arbitrary timestamps or scopes are accepted. No API write capability was exercised for this proposal.

## Duplicate protection, recovery and observability

- Assign each planned action a stable tuple: programme version / target store / local scenario date / action ID. Store an input digest and durable lifecycle (`planned`, `reserved`, `confirmed`, `failed-before-write`, `uncertain`) plus returned source IDs and safe receipt metadata. A rerun with changed input under the same key must refuse.
- Reserve atomically before source mutation. A local claim alone cannot guarantee exactly-once remote creation: first verify the chosen API's supported idempotency/reconciliation mechanism. Tag/marker lookup alone is insufficient without complete, reliable lookup and concurrency protection. On ambiguous acknowledgement, stop dependent actions and reconcile; do not blindly create another order/refund.
- Refunds require the recorded source ID from that cycle's confirmed order and verified remaining refundable quantity/amount. Never select the most recent order or refund yesterday's unrelated test transaction.
- Generator and collector use separate least-privilege identities, schedules and status records. Collector remains read-only against Shopify. Preserve the existing unresolved-outcome guard; never clear a claim to force a retry.
- Report generation outcome, collector outcome, financial review state and reporting freshness separately. No-change days expect a completed collection receipt, no additional candidate version when source contents/scope are unchanged, unchanged finance fingerprints and correct last-collection metadata. A changed reporting window may legitimately create a distinct candidate even with identical source data; compare within exact scope.
- Missed generation is a missed scenario, not automatic backdating. Default proposal is to skip and record it; bounded replay requires reconciliation and an explicit operator action. Missed collection/catch-up policy belongs to the rolling-coverage decision; this proposal does not change the 02:00–02:15 guard.
- Cap programme dates, action counts, target identities and allowed currency. Stop the generator on uncertain writes, wrong store, unexpected payment behaviour or incomplete source reconciliation. Preserve records for audit; no automatic delete/cleanup job.

## Implementation and one bounded activation package

Proceed with reversible local preparation: build the new deterministic source/expected manifests in a disposable store; independently verify fixed totals; drive real candidate/import/review/SQL and profit evidence paths; check supported website periods on desktop/mobile; test restart, concurrency, no-change, stale evidence and failure behaviour. Source mutations and fixture financial attestations are distinct; the nightly collector must never gain financial-review authority.

Before asking Paul to activate, provide the concrete reviewed package containing:

1. New synthetic store identity, exact seed/source/evidence manifest, membership change (if required), proposed application script and preflight/verification steps; no schema changes unless separately demonstrated necessary.
2. Exact Shopify development target and supported write method; permissions delta, no-charge/no-contact/no-fulfilment controls, credential handling and rotation/access readiness. Never commit credentials.
3. Rolling reporting/history/refund and missed-run proposal, including the current pagination/time-limit gate and conservative capacity budget. Thirteen-month synthetic history does **not** approve live Shopify historical backfill.
4. Exact first Monday, two-week stop date, 18:00 generation/02:00 collection, 10-order/four-refund caps, disabled-by-default configuration, failure stop/reconciliation runbook, schedule/hosting changes and any cost impact.
5. Acceptance record: independent expected figures, supported page comparisons, test-only exclusion, no-change evidence, generator/collector status separation, and precise unverified gaps.

Paul's remaining decisions are the historical/daily scope above, coverage/recovery behaviour, any new write access or hosting/spend, and activation of the exact staging package. Routine implementation/documents/tests on the development branch follow standing authorisation. This document has made **no external changes**, activated **no recurrence**, created **no source transactions**, and applied **no database or membership changes**.
