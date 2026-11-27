# Monthly Xero costs to weekly reporting — approved policy and implementation specification
Approved by Paul on 27 November 2026. Urgent prototype priority; source implementation started, not deployed.

## Purpose and authority
Monthly accrual costs must not bunch into the week in which bills were entered. Retain the checked monthly Xero P&L totals, and allocate explicitly classified recurring monthly costs over the calendar days to which they relate. Weekly reports aggregate those daily allocations. This expands the weekly-overhead rule in agreed-financial-definitions.md; it does not turn allocations into actual weekly Xero results or remove actual-month evidence requirements.

This work and restoration of shared period controls are the current authorized design/calculation tasks. Unrelated provider releases, data publications and broader features remain on hold.

## One shared calculation
Keep original source records and monthly actuals unchanged in Supabase. Implement one deterministic pure allocation core, called by the authenticated server reporting layer after scope, membership, source revision and classification checks. Pages consume the same result and provenance; do not reproduce the arithmetic independently in Scout, Profit, Growth/Marketing, Cash or Plan. No new derived weekly database tables are required for the first implementation. A cache, if later needed, must bind exact source and method versions.

## Cost treatment
| Evidence and category | Treatment |
| --- | --- |
| Explicitly classified recurring monthly salary, rent or software | Calendar-day allocation from the complete checked monthly amount |
| Product and order-linked costs | Use reliable original-order/date-matched costs; do not also deduct an allocated copy |
| Advertising or other variable activity with reliable dated evidence | Use its matched period activity; no automatic recurring classification |
| One-off expense | Retain its evidenced specific treatment/date; no automatic spreading |
| Cash/bank balance, stock or working-capital balance | Keep its dated balance and own reconciliation; never divide it into days |
| Missing, ambiguous or unclassified cost | The affected component remains unavailable, not zero |

Account names do not establish treatment. A Bank Fees mapping does not by itself prove a recurring overhead. Classification records are data provenance, not a substitute for authenticated authority. Existing Xero/Shopify source-separation and reconciliation rules remain in force: this allocation does not authorize blending their revenue or costs or counting a cost twice.

## Calendar calculation and pennies
For monthly amount M and D calendar days, the unrounded daily rate is M/D. Each selected day receives that month's share; a Monday–Sunday week spanning two months combines the relevant days at each month's rate. Use actual month lengths and leap days. Business-local ISO dates govern inclusion; daylight-saving hours do not change the number of calendar days.

Implementation rounding convention: for the first n days of a month, compute cumulative M*n/D to the nearest minor unit, with exact halves rounded away from zero. The amount assigned to a day is the difference of adjacent cumulative boundaries. Use exact integer/rational arithmetic, not floating-point money. This distributes penny remainders deterministically, preserves signed adjustments, makes adjacent periods additive and reconciles the complete month exactly. Preserve the monthly source amount and method version in the result.

Example: January £3,100 / 31 = £100 per day; seven January days allocate £700 and three allocate £300. For 26 January–1 February, use six January days plus one February day at February's rate. A full January selection always returns precisely £3,100.

## Required source contract and gaps
Bind company, currency, cost identity, full source month, source version, supported coverage, amount in integer minor units and explicit recurring classification. A present zero is valid evidence; absent evidence is not zero. Reject duplicate/ambiguous source months, mixed businesses/currencies, unsupported precision, unsafe totals or inconsistent coverage.

Only a supported complete monthly amount can be spread as that month's actual cost. Do not treat a month-to-date total as a final month or silently project it over future days. Open-month estimates need a separately agreed basis. A selected week crossing a missing month must show the affected allocated cost as unavailable; do not present the supported portion as a complete weekly amount. Independently supported revenue or other subtotals can remain visible.

## Reporting and advice
Every derived cost result must identify method/version, selected dates, source-month portions, source versions and the status "Allocated from monthly costs". A weekly profit that depends on it is an allocated estimate, not a separately reported weekly Xero actual. Display original monthly actuals and reconciliation in Explore the Numbers.

A prior-period comparison uses the same method, each period's own sources and original-order denominator. Do not average monthly ratios or customer counts. Allocation does not establish cash paid, cash available, causality, savings or permission to spend. The CFO briefing must disclose its allocated basis; missing comparison suppresses comparative claims.

## Platform acceptance checklist
- Scout headline, Sankey, commentary and Explore agree on the selected dates, allocated costs and estimate label.
- Profit cards, flow, bridge, trends and tables use the same cost result; full-month figures reconcile unchanged.
- Growth/Marketing profit/contribution calculations reuse the same cost definitions; daily advertising/customer evidence is not invented or overwritten.
- Cash shows any allocated profit reference distinctly from actual cash movements and dated balances.
- Plan identifies the historical baseline's allocation basis without silently changing forecast assumptions or saved plans.
- Shared Amounts/Period/View/Compare selections carry between pages in both directions; a page must not retain stale one-month figures under a weekly or multi-month heading.
- Test partial weeks, cross-month/year weeks, 28/29/30/31-day months, DST dates, signed credits, explicit zero, penny remainders, missing months, classification, duplicate costs and source isolation.
- Independent acceptance must cover the common engine and each consuming page. Source tests are not hosted acceptance.

## Implementation sequence and current status
1. Record this policy and urgent roadmap item — complete.
2. Implement and independently test the shared pure calendar allocator — in progress.
3. Bind the server adapter to actual supported monthly Xero evidence and explicit cost classifications; keep the existing monthly actual reader unchanged.
4. Connect the shared period selection and allocated result to each page, with clear supported/missing states.
5. Verify calculations, monthly reconciliation and cross-page navigation independently; prepare one exact staging release package.

No provider calls, Xero mapping changes, database migration/write or hosted release is authorized merely by this specification. Routine local source implementation and tests are authorized; any required live action must remain concrete and separately scoped.
