# Baseline decisions — restart sprint

## Implemented in the first work package

- A completed period is chosen by qualifying order count, not positive revenue. A period with orders and zero revenue remains valid.
- Search up to 24 months back (104 weeks for weekly mode). A populated older period is historical, never called the latest completed period. Exhausting the search means no data found in the checked window, not zero trading or proof of an inactive business.
- An availability error or partial metric failure cannot produce a trustworthy briefing. The dashboard shows an unavailable state, not fabricated zero values or snapshot fallbacks.
- For stale data the dashboard shows a small historical trading summary and withholds current diagnoses, comparisons, financial upside and recommended actions. Other analysis pages retain their existing content and now identify historical/unverified periods; their static narratives still require replacement.
- A Sunday cannot be included in a completed week until Monday. Browser-local calendar boundaries remain in use pending store timezone implementation.
- Dashboard headline and opportunity KPI use the same existing recoverable-range response. This removes their divergent access paths but does not validate the meaning or freshness of seeded opportunity estimates.

## Approved sales contract — implementation pending

Paul approved [sales definitions v1](agreed-financial-definitions.md) on 8 September 2026: tax-exclusive product sales and discounts, separate shipping/VAT, pre-refund AOV, value-based discount rate and refund-event-period reporting. This supersedes conflicting older sales proposals; existing SQL has not been changed.

## Remaining proposed calculation contract — not yet approved or applied to live SQL

- Contribution should deduct product cost/COGS as well as the intended variable operating costs. Do not assume missing product costs are zero. The source, refund treatment and historic cost versioning need to be settled before changing this metric.
- Distinguish contribution after marketing from operating profit after overhead. Cash release is not recurring monthly profit; do not add unlike impacts into one headline.
- Weekly calculations require week-compatible inputs and an explicit overhead-allocation convention; monthly functions cannot merely be called with seven-day dates.
- Cash runway needs a dated cash balance and matching expense basis. Display both dates and avoid silently substituting the calendar's current month.

## Proposed engine reconciliation — awaiting implementation

The original calculation document applies confidence in the opportunity value and again in priority. The technical engine document also introduces ease and cash factors; the recommendation document asks for six ranking dimensions.

Proposed separation:

1. Opportunity Engine: calculate a non-negative performance gap against a justified target, the relevant financial base, and a confidence-adjusted value. Apply confidence once to the value. Preserve the gross estimate separately for explanation.
2. Recommendation Engine: rank that adjusted value alongside urgency, effort, time-to-benefit and cash context. Confidence remains explanatory evidence, not an unexplained second discount. Define factor scales and risk constraints before implementing a numeric score.
3. Group overlapping effects to avoid double counting. Keep cash-release and monthly-contribution values separate. Use deterministic labels (Do First, High Priority, Next Up, Watch List) and explain the ranking.
4. Define maturity boundaries as fewer than 3 completed months / 3 to fewer than 12 / at least 12, with caps 0.4 / 0.7 / 1.0. YoY additionally requires actual matching prior-year observations; 12 months alone cannot supply a rolling three-month YoY comparison.
5. Use best rolling three-month performance rather than a single exceptional month; distinguish an arithmetic rate average from a revenue-weighted rate. Define metric polarity and check rapid deterioration before ordinary deterioration in threshold logic.

These are proposed reconciliation decisions, not claims that the current engine implements them. Preserve the original source specifications for review.
