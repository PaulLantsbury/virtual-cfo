# Marketing overhead and target-profit coverage — approved 19 November 2026

Paul approved leading Marketing with an overhead/profit coverage graphic, actual same-period mapped overheads where available, optional profit targets, whole-business return thresholds and an incremental-profit bridge. This revision supersedes v12's generic POAS target and its first-order target-derived CAC ceiling. Preserve the v11/v12 historical snapshots.

## Interface and data

The actual page now uses the existing authenticated, scope-validated useProfitReporting hook alongside its existing sales period hook. Same-store, same-period GBP overheads remain independently visible when supported. The business coverage graphic requires supported revenue denominator, contribution before advertising, advertising and overheads. Missing costs produce unavailable coverage, not zero overhead. It does not claim that every verified/synthetic reporting amount is a fresh Xero posting. Non-GBP reports cannot use the GBP display. Store changes remount temporary target and sample state.

The explicit fictional October review leads with a graphic: blue contribution covering overheads, green surplus, break-even and overhead-plus-profit-target markers, signed operating profit and gap. Example overhead category composition sums to GBP15,000, including GBP500 depreciation/amortisation. Advertising and variable costs were already deducted; interest/tax excluded. Target can be a GBP amount, net-revenue percentage or unset; it is temporary, not saved. The actual verified-coverage branch offers a temporary GBP target.

At GBP100,000 revenue, GBP40,000 pre-ad contribution, GBP20,000 ads and GBP15,000 overhead, operating profit is GBP5,000. GBP8,000 target leaves GBP3,000 gap. At unchanged sales the break-even ad capacity is GBP25,000: POAS1.6/ROAS4.0. Target-profit capacity is GBP17,000: POAS40/17 and ROAS100/17. Zero/negative capacity does not yield an infinite or negative return threshold; show no finite threshold / requirement not achievable with positive ads.

## Marginal decision correction

Whole-business return targets are not hard limits on additional acquisition. The spending model adds incremental contribution after extra ads to operating profit and shows the remaining target gap, on the same monthly horizon with unchanged fixed overheads and no displaced sales. Step costs, funding, stock and payment timing remain explicit limitations. A positive extra-order contribution may justify a funded controlled test even below whole-business break-even. Missing marginal CAC or unstable acquisition means Hold/test; unprofitable next-customer economics mean Pull back/review unless a separate funded repeat strategy is substantiated. Mature cohort evidence is not a forecast for current cohorts.

The gap illustration uses ceil(gap / positive marginal contribution) and orders times marginal CAC. GBP3,000 gap at GBP20 contribution and GBP12 marginal CAC requires375 first orders/GBP4,500 ads, conditionally. It is not a volume forecast or spend authorisation.

## Verification and release

Eight behavioral test groups cover missing inputs, funding/capacity, positive marginal returns despite whole-business losses, repeat-purchase evidence, marginal ranges, exact overhead/target arithmetic, missing/zero/impossible targets and rounded gap closure. Frontend TypeScript passes. Local browser checks cover example graphic, GBP/percentage/unset target behaviour and missing actual evidence. Hosted build and signed-in acceptance are separate release checks.

Scope: marketing page, focused tests and this document only. No database, account mapping, provider scope, credential, ad-account or scheduler changes. The existing profit API is read-only. General business recommendations remain unavailable without matched acquisition and operational evidence. Published finance and scope gates are preserved.

## Hosted acceptance — 19 November

Staging deployed 02f6dc0 successfully in55.1 seconds with passing health checks. Authenticated live Marketing page verified the new source-coverage panel and explicit missing October profit evidence for the selected fictional store. Opened the example and verified the leading graphic: GBP15,000 overheads, GBP5,000 operating profit, GBP3,000 gap against GBP8,000 target. Expanded threshold evidence and verified GBP25,000/1.60x/4.00x break-even and GBP17,000/2.35x/5.88x target-profit results. The API-backed graphic remains correctly unavailable where the actual month lacks sealed profit evidence; no live Xero completeness claim is made. Example GBP/percentage/unset target controls were checked locally. Desktop hosted visual checked; no new mobile acceptance claim beyond the existing responsive structure. Existing source and permission boundaries are unchanged.
