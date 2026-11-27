# Shared reporting ranges — 27 November 2026

## Product behavior

The five primary pages share the same dates, amounts, view and comparison preferences. A range is not permission to read data: the server checks company membership and every selected source version. Presets resolve completed Europe/London weeks or calendar months; Custom uses the exact inclusive dates applied by the owner. No earlier month is silently substituted.

Scout and Profit use the selected range's sales, costs, profit and own original-order denominator. Growth uses the same financial totals plus matching customer/session inputs where supported. Cash keeps actual dated payments and opening/closing balances. Plan retains its separate three-complete-month baseline ending on or before the selected historical end date; its future scenario horizon is a different concept.

## Agreed monthly cost allocation

Preserve monthly Xero-style actuals. Recurring costs without reliable finer timing are allocated over calendar days, using the agreed cumulative nearest-penny method with exact half-penny ties away from zero. Adjacent slices add back to the original month, including negative credits. A week crossing a month boundary uses each month's own source and day count. Leap days and daylight-saving changes use calendar days, not elapsed hours.

The current verified synthetic policy explicitly classifies month-end salary, employer and pension costs for allocation. Premises, software, insurance, utilities, professional fees and depreciation already have reliable daily accruals in this dataset and are not allocated a second time. Dated order costs, advertising and one-off items retain supported actual dates. This implements the agreed treatment on the synthetic reporting stream; it does not activate or remap the separate Xero provider stream or infer a recurring classification for other companies.

Partial-period profit is labelled as including allocated monthly costs. Complete-month totals retain actual amounts. Weekly chart buckets include allocated payroll even when their combined whole-month total is an actual month. Each weekly/monthly chart bucket uses its own dated sales and original orders. Ratios are recomputed from summed inputs; averages and margins are not averaged blindly.

## Cash and customer safeguards

Cash does not follow allocated payment dates. Verify each monthly cash source independently, retain actual bank/control movements and derive partial opening/closing balances from actual offsets. The bridge is allocated EBITDA + explicit allocation-to-dated-accrual timing adjustment + five working-capital movements = operating cash. Opening bank + operating cash + external movements = closing bank. The timing adjustment is not a working-capital category or bank payment. Balances are never summed across months.

Customer first/repeat order counts, attributed spend and revenue can be combined only for complete validated monthly partitions. Recompute CAC and first-order economics from summed matched inputs. Distinct customers, purchase frequency, mature-cohort curves and payback cannot be added across months and are withheld where no range-wide proof exists. Partial ranges use complete actual dated session/funnel observations; partial customer attribution remains a dash rather than a proportional split invented from monthly totals.

## Source limits and scope

Every intersecting monthly cost source must be complete and sealed before range profit is accepted. November 2026 is still open: the latest November week cannot use October's payroll or assume an incomplete November month is complete. Historical sealed weeks, multi-month ranges and Custom ranges can be supported. Missing sources, revised versions, denied access and failed reads clear dependent values and show a specific explanation; missing never becomes zero.

The separate rolling-average comparison and additional immediately-preceding-month CFO analysis are not newly connected for ranges. Last-year and explicit earlier comparisons use accepted separate sources; weekly comparisons preserve Monday–Sunday alignment. Cash resilience remains a separately labelled three-complete-month historical measure with no lookahead beyond the selected end date.

No database schema, grants, data population, provider transactions, daily-feed schedule, paid AI requests or spending change is required by this source package. Hosted release and signed-in verification remain separately approved steps. ChatGPT wording stays deferred; checked rule-based paragraphs remain the default.

## Acceptance

Use server/disposable SQL tests for membership refusal, withdrawn/missing source handling, unchanged monthly totals, actual dated refunds/costs, signed penny conservation, leap day and cross-month weeks. Exercise the actual SQL response through client composition and date buckets. Test cash provenance/timing and weighted acquisition inputs separately. Browser acceptance must cover shared selections across all five pages, stale-result clearing, missing months, Plan's complete-month baseline and supported range chart/cash/customer displays. Fictional browser fixtures demonstrate wiring, not live provider acceptance or exhaustive every-cell certification.
