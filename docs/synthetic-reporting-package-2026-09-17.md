# Synthetic eligible reporting verification — 17 September 2026

Paul approved a clearly labelled synthetic reporting test route. No additional Shopify transactions were needed: development test payments must remain excluded. Three agents handled the eligible pipeline fixture, SQL-backed browser consistency checks, and independent financial review. No production, Shopify, Supabase data/permission or financial-formula changes were made in this package.

## Two complementary test routes

The new [eligible synthetic fixture](../experiments/shopify/synthetic-reporting-fixture.mjs) invents a separate `.invalid` source and disposable Store E. It does not modify a retained Shopify test flag. It exercises existing collection/detail mapping, candidate recording, restricted first/subsequent imports, separately authorised exact-period review, and authenticated member reporting through the actual SQL RPC. Unreviewed reporting is unavailable; the candidate itself never certifies completeness.

Its hand-worked February sale has £100 gross products, £10 product discount, £18 product VAT, £5 net shipping and £1 shipping VAT: £114 paid, £90 product sales and original AOV. March returns £20 products, £4 VAT, £2 shipping and £0.40 shipping VAT: £26.40 refunded. March product sales are −£20, shipping −£2 and original-order AOV unavailable. February's £90 AOV stays unchanged. Missing costs remain incomplete. [Lifecycle test](../experiments/shopify/synthetic-reporting.test.mjs).

The cross-page route reuses existing synthetic Store D's separately evidenced costs and expenses in a disposable database. [Browser suite](../artifacts/virtual-cfo/tests/store-d-cross-page-browser.mjs) feeds actual SQL RPC/profit-service results to real page components; browser authentication and transport are simulated. It checks CFO Briefing, Verified sales preview, Margin Analysis and Profit Overview with shared store/date scope on desktop and mobile, plus partial overhead evidence. This is not a claim that Store E's intake creates Store D profit evidence, or that missing Shopify costs have been filled.

| Store D month | Product sales | Original AOV | Gross profit | Contribution | Operating profit | EBITDA |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| February | £140 | £70 | £80 | £60 | £35 | £40 |
| March (refund) | −£70 | Unavailable | −£70 | −£75 | −£75 | −£75 |
| April (saleable stock recovery) | £0 | Unavailable | £40 | £40 | £40 | £40 |

February shipping is £5; March shipping is −£5. April's £40 is recovered historic product cost when goods re-enter saleable inventory, not new revenue or assumed cash. All values are synthetic test expectations, not merchant results or hardcoded production reporting figures.

## Live staging observation

Restarted the existing restricted local preview at localhost:3000; the first navigation found it stopped. Used Paul's existing signed-in account and selected **Staging Synthetic Profit Store D**. Verified February Profit Overview against every headline above, including AOV. Verified March Profit Overview and CFO Briefing agree on negative sales/profit and unavailable original AOV. Verified April Profit Overview shows zero sales and £40 stock recovery/profit. Labels clearly identify synthetic staging evidence. Returned the preview to February on Profit Overview for a walkthrough.

This used existing read permissions and existing sealed fixture data only. No setup rerun, new fixture upload, review attestation, membership grant or database mutation. Local store/date selection changed only the browser's reporting context. Current Shopify candidate remains excluded with two refunds and needs-recheck; it was not altered.

## Verification and remaining limits

Seven combined database checks passed: the new eligible lifecycle test plus six existing profit-staging integration tests, including membership/settings, dependency invalidation, fixture rollback/replay and timezone handling. All three SQL-backed browser groups also passed: desktop and mobile across four pages and three months, plus overhead-evidence invalidation. Ten passing groups in total. Initial browser failures were harness expectations about existing page wording/layout (including explanatory text after “Unavailable”); monetary assertions were unchanged and no application defect was found. Independent review found no blocker. See [independent arithmetic and scope review](synthetic-reporting-review-2026-09-17.md).

The fixture tests are disposable; browser transport/authentication are mocked, while calculated reporting responses come from actual disposable SQL. The separate live staging observation covers the existing synthetic store and selected pages/months, not every page or all source cases. Production eligible Shopify data, historic-cost acquisition, automated sync, live connection status and broader network/concurrency recovery remain outstanding.

Next recommended implementation package: operator sync visibility and repeatable ingestion using the existing restricted connection, followed by the merchant-facing store-scoped connection status. Keep actual source completeness and cost evidence separate from successful transport. Additional Shopify development transactions will be useful later for targeted source cases such as discounts, shipping and tax; they are not required to prove the financial arithmetic here and remain excluded from real sales.

## Repeatable local checks

From the repository root:

```sh
node --test experiments/shopify/synthetic-reporting.test.mjs experiments/financial-v1/profit-staging-integration.test.mjs
```

For browser checks, start a separate fake-config preview from `artifacts/virtual-cfo`:

```sh
PORT=5189 BASE_PATH=/ VITE_SUPABASE_URL=https://night-scout-test.invalid VITE_SUPABASE_ANON_KEY=synthetic node node_modules/vite/bin/vite.js --config vite.config.ts --host 127.0.0.1
```

Then from the repository root, with Playwright and Chromium available:

```sh
NIGHT_SCOUT_TEST_URL=http://127.0.0.1:5189 node --test artifacts/virtual-cfo/tests/store-d-cross-page-browser.mjs
```

When using the bundled runtime, set `NIGHT_SCOUT_PLAYWRIGHT_MODULE` to its installed Playwright entry and `NIGHT_SCOUT_CHROME_PATH` to the installed Chrome executable. The run used the bundled Node/Playwright and local Google Chrome. Browser external routes are intercepted/blocked and all authentication inputs are synthetic. Stop the isolated preview afterwards; it must not replace the actual staging preview's configuration.
