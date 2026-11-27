# Five-page design/history review — 27 November 2026
Read-only comparison of the live staging website at revision 3373ee13aa00d0a8939c81deb12122644fceaf7f, recorded approved designs, retained prototype source and subsequent Git history. Current local working edits are undeployed and are NOT the live site reviewed here.

## Overall finding
Several data-connection changes introduced narrower connected presentations alongside retained richer prototype presentations. Accurate source gating and explicit sample separation are necessary, but do not establish owner approval of a replacement layout. Do not restore an old mockup wholesale where a later recorded design supersedes it. Preserve verified financial rules while restoring the agreed presentation.

## Page-by-page findings
| Page | Recorded design and what remains | Current material difference |
| --- | --- | --- |
| Scout | Accepted v17 four-section structure and profit Sankey are broadly retained. | Added technical automatic previous-month analysis makes the flow denser; its comparison can differ from the manually selected comparison elsewhere. Shared prototype controls are absent and current date selection resets. |
| Profit | Rich new-profit prototype retains segmented controls, main sales/profit trend, Sankey, change bridge and practical action presentation. | Normal route opens NewProfitLive: single-month picker, separate comparison picker, plainer cards, collapsed monthly trend and generic unsupported-action content. Richer presentation remains behind an explicit sample-design switch. |
| Growth and Marketing | Later v16 Acquisition / Conversion / Retention tabs are the current design reference, not older v11 tab names. | Tabs remain, but connected presentation uses month pickers and separate monthly charts rather than all of the richer paired displays. Retention has genuine missing distinct-customer/group-AOV evidence; some Conversion presentation can potentially reuse already-supported session inputs. Verify exact inputs before claiming that connection complete. |
| Cash | Retained CashDemo has the rewritten verdict, profit/cash trend, graphical bridge, practical review cards and resilience panel. | Normal new-cash-control route opens NewCashLinked with a reconciliation table and more generic status/action content. Rich visual design is available through the bottom fictional-design switch. Old cash-control URL still opens a separate older page. |
| Plan | Later v15/visual Plan retains monthly trajectories, editable levers, conditional result/bridge and My Actions. Later documented consolidation of planner tabs is intentional. | An early baseline gate hides the ENTIRE workspace until three continuous financial/acquisition months pass. With no remembered selected month, initial page contains only a picker and status/evidence. Repeat-order lever is intentionally unavailable without sufficient customer evidence. |

## Change history
- 20 November: d83660a/a77e658 introduced narrower connected rendering for the New pages; original rich components were retained separately.
- Plan a45123f/115a611 represent recorded visual design iterations. bfd0d430 on 21 November introduced the early accepted-baseline gate before rendering the visual workspace.
- 26 November: 0d06c27 simplified connected selectors to Month and removed exposed version choice. It did not remove the prototype segmented selectors; those were already absent from the connected presentations.
- Scout accepted v17 reference 5dd18ef remains largely intact; 9ea3b89/6b34d45 added the technical automatic comparison.
- Technical release acceptance must not be reported as owner sign-off of every layout change.

## Live observations and limits
The signed-in selected synthetic company was inspected in the existing owner Plan tab without changing it. It displayed no selected month and only the baseline selection gate. A separate audit tab selected October, progressed through financial/acquisition checks, then returned to an unselected/loading state before the full planner was verified. Do not claim the full selected Plan passed this review.

Separate read-only audit tabs inspected all five primary pages. Profit and Cash sample switches visibly restored their retained richer designs; Profit's sample controls matched the owner's supplied screenshot. Other pages initially showed unselected/monthly connected layouts. The audit did not certify every figure or every expanded state. No source release, provider operation, database write or saved Plan action occurred. Audit-created tabs were closed.

## Owner's NEW refinements on 27 November
These are now requirements, not evidence that every older design was wrong:
- Restore shared Amounts / Period / View / Compare controls and preserve choices across pages until the user changes them.
- Provide a short plain-English owner paragraph in every primary opening commentary box.
- Remove the top-level Explore the Numbers jump buttons across pages. This overrides earlier mandatory top-level CTA guidance; retain accessible supporting figures and material limits in the page.
- Implement recurring monthly Xero cost allocation by calendar day for weekly reporting, clearly labelled and monthly-reconciled.
- ChatGPT wording is next on the roadmap, explicitly deferred for now; the current rule-based default remains.

## Recommended restoration sequence
1. Restore persistent shared context and stop blank/reset behavior, particularly Plan.
2. Preserve the approved visual workspace even when inputs are unavailable: withhold unsupported results and show the exact missing requirement without making the whole page look deleted.
3. Reuse the retained richer page components with connected supported inputs; do not build another parallel layout or fall back to sample values.
4. Apply the new owner paragraphs and header-button removals.
5. Complete shared period/allocation server adapters, then independently test the exact five-page design/data package before an explicit staging release.

Current local selector, wording and allocation preparation remains held pending this design review; no new restoration patch is applied by this report.
