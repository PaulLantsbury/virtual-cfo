# Owner-friendly opening briefings — approved design requirement, 27 November 2026

## Purpose
The first commentary box on Scout and every other primary page must let a business owner understand the selected period without reading the rest of the page. Replace the single technical headline/supporting sentence with one short, everyday-English paragraph. Keep a concise title if useful; the paragraph is the explanation, not another list of metrics.

## Required shape
Use roughly three sentences, normally no more than 90 words:
1. Explain the two or three most material supported results or changes for the selected period.
2. Explain why those observations matter to the business, distinguishing profit, cash and customer activity.
3. Give one bounded, evidence-linked focus for the next check.

Do not pad a sparse report to reach three findings. With missing or unverified evidence, clearly explain what can be said and what remains unknown. Do not hide a material limitation in Explore the Numbers. Avoid jargon, unexplained acronyms, code, source IDs and internal verification vocabulary in the main paragraph. Technical details remain available in the evidence section.

## Financial and advice safeguards
Use the same checked figures and selected dates as the page. Do not invent why a change happened, claim a marketing return caused by a spend change, forecast an outcome, promise savings or imply cash is available to spend. An increase in profit is an observation; its business cause may still need investigation.

Distinguish operating profit from EBITDA, and both from operating cash and a dated bank balance. Where EBITDA is necessary, explain its exclusions briefly rather than calling it profit after every cost. Zero is break-even, not a loss. Missing values are not zero.

Weekly results that depend on monthly Xero cost allocation must say they use allocated monthly costs, as specified in xero-weekly-cost-allocation-spec-2026-11-27.md. Monthly original actuals remain available. Comparisons require supported matching sources; no previous period means no directional claim. Ratios retain their correct denominator.

## Page coverage
| Page | Paragraph focus |
| --- | --- |
| Scout | Overall trading result, the most important supported movement, any profit-versus-cash tension, and where to look first |
| Profit | Sales and supported cost/profit movements, what remains after the defined costs, and the largest supported area to inspect |
| Growth/Marketing | The selected acquisition/conversion/retention tab's supported customer or advertising observations, their limits, and a useful next check |
| Cash | Operating cash movement and dated balances, distinction from profit, and supported cash-bridge components to inspect |
| Plan | Explain the checked starting point and conditional result; make assumptions and 'if' conditions explicit, never describe a scenario as an achieved improvement |

The paragraph must update with company, period, comparison and source readiness. Do not retain prose from an earlier successful selection while new data is loading or unavailable. Examples remain visibly synthetic; no claim of real merchant results.

## Current implementation and later AI phase
Current implementation is deterministic, using the approved interpretation rules and existing checked data. The ChatGPT wording layer is NOT live. The three earlier private model drafts were acceptable for their narrow private evaluation but did not demonstrate clearer or more useful wording than the existing briefing.

Paul has now prioritized the ChatGPT wording layer as the NEXT phase after current design/shared-controls, plain-English paragraphs and cost-allocation work. Do not start that AI phase now. Its later scope is to improve wording from an approved bounded fact/interpretation packet, preserving validation, usage limits, graceful fallback and independent review. Existing trial approvals are consumed; no new API calls, server key setup, model activation or hosted AI release is authorized by this document.

## Acceptance
Review exact profitable, lower-profit, zero, missing-current, missing-comparison and positive-profit/negative-cash scenarios. Fictional boundary tests must not be presented as observed business results. Verify all primary opening boxes, not only the detailed Scout comparison. Measure clarity as reviewer judgment unless an actual owner/user test occurs. Keep Explore the Numbers discoverable, with source amounts, formulas and material limits. Prepare source evidence and an exact staging package before deployment.
