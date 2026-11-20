# New pages full connections batch — 20 November 2026

## Prepared and tested; not deployed

This batch builds on released website a77e65822345087aa708fad19c98bbf3e9a73b21 and the complete figure audit e41eebdd3ca991d09236208fec0333b74b647126. Separate agents implemented Profit, Marketing and Cash; the coordinator integrated the shared read-only monthly history reader and independently checked formulas, tests and browser controls.

### New Profit Engine

Connected complete monthly revenue/EBITDA trends, 3/6/12 display windows, optional preceding-three-month EBITDA averages, exact evidence tables, monthly discount/refund/overhead/profit ratios, full-breakdown comparison deltas and margin/rate comparisons. Per-order comparisons use each month’s original-order counts; rolling comparisons use summed counts. Unsupported weeks, automatic year-ago selection, staff/product diagnoses and quantified action benefits remain unavailable. Existing sample design remains explicit.

### New Marketing Efficiency

Connected 3/6/12 monthly POAS/ROAS history, full source tables, aggregate financial totals and properly weighted ratios, explicit previous-month comparison, fixed-sales advertising break-even/optional target calculations and a conditional financial scenario using the reviewed monthly baseline plus independently entered assumptions. Advertising changes do not manufacture sales response or customers. CAC, customer/cohort/attribution facts and response forecasts remain unsupported. See [Marketing mapping](new-marketing-connections-batch-2026-11-20.md).

### New Cash Control

Connected a clearly separate monthly EBITDA reference chart/table. Cash amounts remain unavailable: a read-only staging check on 20 November confirmed the isolated Fictional UK Gifts company has zero cash balance snapshots; missing cash does not mean a zero balance. Added a prepared-only cash input adapter and offline evidence builder requiring explicit opening/closing observations, dated itemised movements and exact reconciliations. No source values, snapshots or financial writes were invented. See [cash source package](new-cash-source-connections-2026-11-20.md).

### Shared reader and evidence

Every trend uses the existing authenticated membership-limited monthly endpoint. Queries bind identity, business, edition, anchor, month and exact selected evidence version. Reads are sequential, capped at twelve, reject missing/ambiguous/gapped months and publish only a fully validated series. Failed checks, cancellations, business changes and evidence changes cannot substitute sample or cross-scope data. Individual profit gaps remain unavailable. Source-level formula checks and original-order denominators remain canonical.

No new endpoint, database schema, grant, provider transaction, daily-feed setting, website deployment or production release is part of the implementation. New Plan is preserved. Yellow remains for unavailable/unsupported/example amounts; explicit user assumptions and legitimate derived figures are not mislabelled as missing links.

## Checks

- Focused calculation/lineage tests cover scope/version mismatch, missing costs, invalid evidence, zero denominators, weighted totals, cancellation, gaps and cash reconciliation.
- Frontend TypeScript and production build pass. Existing non-blocking bundle-size/dynamic-import warnings remain.
- Local browser checks use a prominently labelled fixture harness, not Supabase: selected month/version, Profit trend and exact per-order table, Marketing conditional bridge (£100 extra overhead reduces £1,600 to £1,500), and Cash profit history with cash explicitly unavailable. No browser console errors observed during these checks. These checks do not establish hosted source acceptance or load performance.
- Hosted verification must follow deployment: exact selected October/September history, long-window source reads, missing evidence, company switching, financial scenario reset and unsupported cash/customer markers.

## Next sequence

1. Approve and deploy the exact tested website revision; verify signed-in staging with real reviewed inputs and measure sequential-history latency. Keep auto-deploy/provider/feed settings unchanged.
2. Prepare isolated synthetic cash observations and matched dated working-capital/bank movements with reviewed opening balances, then member-authorised read-only reader and a separately approved data publication if needed. The offline builder is not a connected cash source.
3. Prepare matched synthetic acquisition/customer/cohort records and definitions before CAC/payback/response metrics. Provider tests remain separate.
4. Verify the first genuinely scheduled daily feed receipt at its eligible window; never manually manufacture that evidence.
