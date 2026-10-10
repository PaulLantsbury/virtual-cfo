# Independent synthetic reporting review — 17 September 2026

## Scope

The approved next package validates eligible synthetic sales through the existing candidate/import/review/reporting path and checks consistency across reporting pages. It does not change the actual Shopify test order's eligibility, manufacture real revenue, apply new database policy or certify live financial completeness. The coordinator owns separate read-only observation of existing synthetic Store D in staging.

Disposable eligible fixtures must be created as eligible synthetic inputs from the outset. Do not clone the retained live Shopify test payload and flip `test=true` to false. Keep source identity, store and evidence separate from PocketLaunchpad1's excluded test order and from live merchant data.

## Independent expected arithmetic

The approved worked single-order example is a February gross product sale of £100, £10 product discount and £18 recorded product VAT, with no shipping. Net product sales and original AOV are £90; VAT is separate and is not deducted again. A March £24 refund containing £4 VAT reduces March net product sales by £20. It does not change February's £90 AOV or remove its original order. A refund-only March must remain visible as activity, with zero original orders and no fabricated AOV.

The new eligible pipeline fixture additionally records £6 gross shipping less £1 shipping discount = £5 net shipping, with £1 shipping VAT. Its original customer charge is therefore £114 (£90 products + £18 product VAT + £5 shipping + £1 shipping VAT). Its March refund adds £2 shipping plus £0.40 shipping VAT to the product refund: £26.40 total cash, March net products −£20 and net shipping −£2. The £1 shipping discount must not inflate product discounts or affect product AOV.

For the existing two-order Store D worked example, February product gross is £150, discounts £10, net product sales £140, original orders two and AOV £70. Net shipping £5 makes the contribution/profit margin denominator £145. With COGS £60, variable costs £15, advertising £10 and overheads £25 including £5 depreciation/amortisation, expected values are gross profit £80, contribution before marketing £70, contribution after marketing £60, operating profit £35 and EBITDA £40. Contribution margin is 60/145 and operating margin 35/145, rounded only for display.

Store D's later months are a distinct fixture from the older F04 worked example. Its March refund reduces products by £70 and shipping by £5, with no cost recovery until April and explicitly complete zero March expenses. March gross profit is −£70 and contribution, operating profit and EBITDA are −£75. April records £40 historical product-cost recovery when the goods re-enter saleable stock: zero sales and £40 profit, with no original-order AOV. Do not use F04's March costs or £20 recovery expectations for this different fixture.

Missing cost evidence must leave dependent profit values incomplete, even when the sales path is verified. Shipping, tax and refunds must not silently enter the original-order AOV numerator. Import dates must not replace actual event dates in the store timezone.

## Review acceptance and limits

Pipeline assertions must use independently stated expected values and show that candidate recording alone leaves reporting unverified, finance import alone does not certify completeness, and authorised review remains a distinct capability. Cross-page tests must verify visible values and the requested store/date scope, not merely render pages successfully. Unavailable evidence must not render as an asserted zero. The cross-page browser tests use responses calculated by the real sales RPC and profit service against a disposable SQL fixture, with browser authentication and network transport simulated. They connect actual SQL calculations to frontend presentation but do not establish current Supabase ingestion, a live authenticated network path or live completeness.

Live read-only Store D checks, if completed by the coordinator, are evidence for that existing synthetic store and selected period only. They are not evidence that every legacy/sample page is connected or that Shopify customer reporting is ready.

## Result

Reviewed `experiments/shopify/synthetic-reporting-fixture.mjs`, its pipeline test and `artifacts/virtual-cfo/tests/store-d-cross-page-browser.mjs`. No blocking defect identified. Independently reran the eligible pipeline test successfully. It exercises restricted finance import, separately authorised exact-period review and authenticated sales RPC. Assertions establish unavailability before review, separate February/March certification, independent tax/shipping arithmetic, original AOV preservation and unverified candidate records even after authorised reporting restoration. Other-store invariance in this test covers `public.orders`, not an exhaustive database audit.

The coordinator separately reported seven combined pipeline/profit integration checks passing and read-only verification through the actual signed-in staging interface: February Profit Overview sales £140, gross profit £80, contribution £60, operating profit £35, EBITDA £40 and AOV £70; March Profit Overview/CFO Briefing sales −£70, contribution/operating profit/EBITDA −£75 and AOV unavailable; April Profit Overview zero sales, £40 stock recovery and £40 profit. The selected period was reset to February. These live observations are coordinator evidence, not actions performed by this independent reviewer.

The browser owner reports all three final SQL-backed browser tests passing: desktop and mobile checks across CFO Briefing, Verified Sales, Margin Analysis and Profit Overview for February/March/April, plus changed-overhead evidence leaving supported sales/profit components visible while dependent operating profit and EBITDA become unavailable. Initial assertions were corrected for existing page-specific copy (the briefing layout and the full unavailable-AOV label); monetary expectations were unchanged and no application fix was needed. The isolated preview was stopped.

Final integrated package evidence is ten test groups: seven database/pipeline/profit checks and three SQL-backed browser checks. The independent pipeline rerun is a repeat of one of those seven, not an eleventh group.

No calculation changes, production release, new grants or live data mutation are implied by these tests. Remaining limitations include broader source cases, all-page coverage, live eligible merchant ingestion and concurrent source changes; this package does not certify them.
