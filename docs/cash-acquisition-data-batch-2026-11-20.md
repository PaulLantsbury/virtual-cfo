# Cash and new Marketing data batch — 20 November 2026

## Prepared and tested; not applied or deployed

This batch preserves the current live8287d1024b8c90523c807450dcef1d9d2a1490b4 design, its new Marketing profit briefing/comparison labels, prior Marketing Efficiency, Plan, historical reporting and the existing daily financial feed. The primary Marketing target is **/new-marketing**, with Acquisition, Conversion and Retention tabs, alongside the preserved original page.

Three agents independently implemented source models, reader/storage controls and UI connections. The coordinator integrated and checked the package. New private storage, publication, server read grants, optional reader activation and website deployment still require one concrete staging approval. No such live action has occurred.

## Source package

The isolated fictional UK Gifts programme remains UK/GBP/Europe–London, approximately£750,000 annual net turnover, four staff, outsourced fulfilment, VAT and the existing seasonal sales/cost assumptions. The original financial journals/seals and opening capital are unchanged. No customer store, Store D, Shopify/Xero transaction or provider identity is reused.

The proposed dataset consists of **48 immutable monthly snapshots:24 cash and24 acquisition records**, November2024–October2026. The acquisition records include integer customer/spend/revenue inputs and bounded daily simulated session observations. Optional first-order and mature-cohort economics carry matched allocated-cost inputs, not persisted ratios or payback answers. [Immutable review manifest](synthetic-supplemental-review-manifest-2026-11-20.json) pins the exact package and SQL hashes.

Cash derives from actual dated activity in the existing synthetic journal: gross provider payouts, refunds, supplier purchases/payments, payroll, VAT and fees. Each month independently rolls opening bank through classified cash movements to closing bank; EBITDA plus explicit working-capital changes reconciles to operating cash without a balancing plug. Existing opening assumptions are£60,000 bank,£35,000 stock,£24,000 equipment and£119,000 equity at1November2024. They are not new revenue or new funding. Corp-tax/interest, later capital spending or failed payouts are not invented where this programme has none. Pending provider money is separate.

Acquisition identities are an independent deterministic synthetic sidecar from January2024, with explicit first/repeat, guest and unknown order witnesses. Advertising is partitioned exactly into matched paid-first, other/retention and unallocated activity; no universal80% assumption. Revenue retains original-order identities and refund-event timing, excluding shipping/VAT. Simulated sessions are generated source observations under a declared policy; orders and purchasing sessions are distinct. They are not collected web analytics.

First-order contribution uses paid first orders, recorded COGS, observed refunds and explicitly allocated variable costs through the selected month end. It is before advertising and overheads. The separate April–June2026 mature paid-first cohort uses complete customer ages0–89, observed through30September. Repeat marketing is deducted once before comparing contribution with paired acquisition spend. Stored inputs are integer pence/counts; the browser derives ratios, per-customer amounts and first crossing. Actual model recovery is Day0, not the old55-day sample; this is contribution recovery, not cash payback or permission to scale.

Mature results additionally pin all six April–September financial versions and source revisions. The server canonically rechecks those months in the same read-only transaction as the selected month and snapshot. A later historical correction withholds the supplement rather than leaving stale cohort economics supported. Older selected contexts or missing dependencies leave mature results unavailable.

## Page connections

- New Cash: dated month-end bank cash, operating cash, cash less profit, pending funds, both numerical cash reconciliations, three complete cash/profit months with a separate bank-balance chart, buffer arithmetic and historical cash-use cover. A bank balance is not a flow or a current feed. Three cash months depend on matching continuous reviewed evidence; unavailable months are not zero.
- New Marketing Acquisition: paid first-customer CAC, count/spend reconciliation, financial totals/thresholds, allocated first-order contribution and its **before-overhead** CAC benchmark.
- New Marketing Conversion: simulated sessions, purchase conversion, approved product AOV, checkout completion, funnel counts/rates and exact daily source table. Product AOV remains before subsequent refunds and excludes shipping/VAT.
- New Marketing Retention: identified first/repeat orders, refund-linked revenue with guest/unknown segments separate, matched mature economics/curve/recovery and dependency evidence. These are synthetic order measures, not unique returning-customer probability.
- Prior Marketing Efficiency retains its new source panel and financial scenarios. Plan remains explicitly illustrative; no silent transfer of these figures into its forecast or saved actions.

[Every v16 numerical path and remaining gaps](new-marketing-v16-connection-register-2026-11-20.md). [Cash source design](synthetic-cash-source-design-2026-11-20.md). [Acquisition policy](synthetic-acquisition-source-package-2026-11-20.md). [Allocated-cost proposal](synthetic-acquisition-costs-proposal-2026-11-20.md).

## Review evidence

Read-only staging capture found24 selected financial months and no correction overlays. Independent monthly posting/order totals matched the exact source programme for every month; October EBITDA remains£10,592.05. These captured inputs are preparation evidence, not a substitute for the installed authenticated canonical reader. Source/financial readback is required again before activation.

The exact48-record package passed a newly created local PostgreSQL/PGlite publication and unchanged replay; its single-call SQL export replay also preserved every row. Payload records total351,665bytes; the one-call SQL is355,833bytes and serialized tool argument386,813bytes. Raw fictional order/bank/cost proofs stay in separate private operator artifacts and are not uploaded in routine handovers or returned to browsers. The new database table stores reviewed summaries and daily simulated-analytics inputs, not a bulk import of raw customer records. Individual customer/provider drill-downs remain separate work.

Validation:208 combined source/model/security/UI tests plus7 HTTP route tests pass (**215 total**). Frontend TypeScript, targeted new API module type checks, frontend production and server bundles pass. Full server typecheck still reports the same17 legacy Xero missing-declaration diagnostics found in the earlier baseline; no new missing declarations were introduced. Existing bundle-size warnings remain. Actual PGlite tests cover RLS, no browser grants, immutable rows, exact replay/conflicts, full rollback, privilege guards and quoted/injection-shaped SQL strings. Independent financial review recomputed the90-day cohort separately.

Local browser review used a prominently labelled prepared-data harness, **not Supabase acceptance**. It verified new Marketing counts/funnel/revenue, first-order benchmark and true Day0 recovery; Cash balances, bank roll-forward, three-month history and user-buffer calculation; no console errors. Both Marketing and Cash fit390px with no page overflow after the Cash table scroll fix. The viewport was restored. Hosted latency/load testing remains pending; mature requests perform at most six additional canonical financial checks.

## Remaining after this release

Explicit comparison selections, multimonth CAC/session/retention comparisons, unique customer frequency/second-purchase measures, current live bank feeds, stock-age/product investigations, forecasts, reminders and measured action benefits remain separate. Sample values stay yellow. Source-level identities remain in the private proof archive; customer-level drill-down is not implemented by monthly summary storage.

This is an **initial historical publication**, not new daily enrichment. The existing financial feed is unchanged. Future closed-month cash/acquisition publication, recurrent scheduling and independent supplemental correction/version handling need a separately reviewed extension; never change financial sales just to repair a supplemental metric. Verify the genuine financial nightly run in its original eligible window, not through a manual append or provider retry.
