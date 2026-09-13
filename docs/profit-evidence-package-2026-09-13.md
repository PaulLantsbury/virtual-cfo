# Profit evidence — proposed next implementation package

13 September 2026. Paul asked to continue after the completed shared-sales package. Three agents reviewed historical product/return costs, expense evidence and acceptance gaps. This package prepares the design and decisions; it does not install schemas or connect actual profit figures.

## Purpose

Use the same selected store, currency and dates as shared sales to calculate supported gross profit, contribution after marketing, operating profit and EBITDA. Every actual amount must trace to the existing Supabase source records and verified evidence. Additional evidence tables may be necessary, but there must be one authority for each cost, not duplicated financial totals across pages.

## Reuse and limits

Keep the existing verified sales adapter and source scope. Reuse historical sale/line references, overhead records and advertising source records where the recorded structure supports them. Proposed new evidence must link to these authorities and identify the source revision, coverage and classification; do not install the disposable prototype schema as if it were production. Schema conclusions here use the saved catalog and staging application records, not a fresh database inspection.

The old prototype is useful test material, but cannot be wired directly: its profit bridge withholds even gross profit when any cost field is missing, and it selects cost recovery through refund dates, so a later return-only month needs a separate event contract. It has no complete deployed historical-cost input.

## Proposed bounded implementation

1. Prepare a versioned evidence contract and migration proposal against the existing staging objects, with per-sale-line historical cost, independently dated saleable recovery, expense classification/provenance and component coverage. Read sales and cost evidence consistently so different revisions cannot silently combine.
2. Build/test the adapter and calculation dependencies using disposable synthetic fixtures. Keep current verified sales working if any cost category is incomplete. No change to sample Scenario Planner arithmetic or unsupported cash measures.
3. Prepare one reviewable synthetic month plus later refund/return cases, with exact reconciled expected values. Do not upload or mark its coverage complete yet.
4. Present the exact migration, setup contents, validation and rollback/recovery plan for separate staging database approval. Reinspect the actual staging schema before applying a proposal.
5. Once staging inputs are approved/applied/verified, connect actual Profit Overview and Margin reporting to the shared snapshot, test matching figures and update local staging. Do not treat this design as database or production approval.

First slice proposal: complete calendar months in one evidenced currency; weekly/custom sales remain usable, with profit unavailable until expense allocation/rounding for those periods is agreed and implemented. No exchange-rate conversion, assumed historic costs, estimated actual profit, cash runway or new opportunity ranking.

## Decisions for Paul

These are recommendations, not approved financial policy. Existing definitions are preserved.

1. **Return timing:** record the historical-cost reversal on the evidenced date goods re-enter saleable inventory, independently of the refund date. A March refund followed by April restocking reduces March sales and reverses the related COGS in April. Unknown stock status/date leaves dependent cost results incomplete.
2. **Actual versus estimated:** the first actual-profit release uses evidenced historical landed cost and actual expenses only. Require already supported freight/import allocation; do not invent an allocation method. Keep estimates out of actual totals and separately labelled if a later modelling feature uses them.
3. **Incremental availability and first scope:** start with complete calendar months and show each supported subtotal even if later costs are missing: gross profit can be available without overheads; contribution needs variable costs and advertising; operating profit needs complete classified operating overheads; EBITDA additionally needs identified D&A. Percentages remain unavailable for zero/negative revenue denominators until separately decided.

This bounded approach defers new freight allocation rules, fractional-penny daily allocation, credit/adjustment policies without explicit evidence, currency conversion and cash decisions. It does not assume missing costs are zero or missing returns mean no recovery.

## Supporting designs

- [Historical cost and saleable recovery](cost-evidence-design-2026-09-13.md)
- [Expense classification, authority and coverage](expense-evidence-design-2026-09-13.md)
- [Fifteen reconciliation and failure cases](profit-evidence-acceptance-2026-09-13.md)

## Verification and next checkpoint

This is a documentation/design package. No application, database, grant, data, production or Replit changes; no executable tests needed for these documents. Coordinator reviews the three companion designs for consistency with recorded decisions and checks versioned documentation. Existing shared-sales staging remains the application checkpoint. Dependent financial policy implementation waits for Paul's decisions above.
