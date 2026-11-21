# Historical and daily test preparation — 18 September 2026

Status: local preparation and disposable verification only. No staging dataset, Shopify transaction, grant, source writer or recurring job was activated. The separate corrected nightly worker remains published for its fixed 17 September period. At this batch's start, the clock was 18 September 10:25 UTC; the next genuine run is expected 19 September 02:00 BST / 01:00 UTC. No new overnight outcome was inferred or collection triggered.

## Delivered

- Pure historical manifest: 132 invented eligible orders across 13 complete months (August 2025–August 2026) plus 1–17 September 2026, two refund events, one independently dated saleable-stock recovery and invented actual-cost/expense evidence. Stable synthetic IDs; no installed store identity or real customers. Store D/E regression data is preserved.
- Fixed independent expected values for all 14 periods exercise the shared sales adapter and profit calculator, including mixed recorded VAT bases, discounts, shipping, historical costs, expense classification, AOV and recovery. September partial periods support sales only; profit is withheld.
- Disposable PostgreSQL test drives the full ledger through the actual member-only verified_sales_source SQL function and shared adapter. All 14 periods and matched September 1–17 comparison pass. A £999 excluded test order adds no eligible sales. Missing exact-period coverage, stale source evidence and absent membership block results; unrelated stores remain unchanged.
- Pure daily action-plan builder accepts an explicit Monday, store identifier and one of two separate routes. It emits two weeks, ten planned orders, four planned refunds and four no-mutation days; generation 18:00 / collection 02:00 London times include explicit offsets and UTC equivalents. Stable action IDs/digests, cycle-specific refund dependencies and final collection date are included. Output is frozen and disabled; no execution adapter exists.
- Independent weekly synthetic sales expectations: net products £316, net shipping £11, five original orders, pre-refund AOV £81.60 and cash refunds £115.20. Shopify development route remains test=true with zero eligible financial events. These are semantic plans, not verified API capabilities.

- Pure rolling-scope planner implements the agreed 31 completed local calendar dates. Explicit timestamp/timezone validation and tests cover London midnight, both DST transitions, leap/month/year boundaries and missed days. No runtime integration or deployment change.
- The historical ledger now traverses the disposable candidate, append-only import, separately authorised exact-period review, authenticated sales reader, immutable profit-evidence reader and real page presenters. It covers 132 invented orders, two refunds and 15 exact sales scopes; 13 complete calendar-month profit versions are sealed. September 1–17 retains sales only, with profit unavailable. This remains an invented, local dataset and does not prove live Shopify collection, inclusive-tax source support or staging readiness.

## Verification and its limits

**50 focused checks passed**: the earlier 43 checks, two historical candidate/import/review lifecycle checks, three immutable-profit integration checks and two SQL-backed browser checks. The lifecycle fixture verifies all 132 invented orders and two refunds through the actual candidate/import/review path and authenticated sales reader. The profit fixture seals 13 complete months, verifies source preservation, rollback, replay refusal, immutable evidence, stale-source handling and membership denial. The browser suite checks five selected periods across four real pages on desktop and mobile using local synthetic transport only.

The historical ledger uses equivalent tax-exclusive invented source payloads because the current mapper intentionally rejects tax-inclusive source orders. This preserves the expected figures for local testing but leaves real inclusive-tax collection unsupported. Custom reporting ranges also intentionally withhold automatic YoY comparisons, so the August £480/£960 relationship is independently checked rather than rendered as a trend. Existing zero-refund formatting displays `-£0.00`; this is presentation-only and no application change was made. No new website values are installed. No live Shopify creation/refund API, durable generator ledger, reconciliation mechanism, permission or capacity measurement is claimed complete. The Monday used in unit tests is fixture input, not an activated start date.

Independent review found no blocking arithmetic or safety issues. A scope-validation hardening identified during review is included before final publication. All final checks above include the scope hardening.

## Agreed next reporting scope — preparation only

Paul approved a trailing **31 completed London calendar days**, ending yesterday, resolved once per invocation and passed consistently to configuration, reservation, journal, intake and receipt. Keep fixed-date mode as the default until an exact deployment package is approved. This is candidate collection coverage, not automatic financial completeness certification.

Continue full accessible source-history extraction, because refunds on older orders must remain discoverable. Refunds use their successful payment event date; never filter only by original-order date. The next regular collection can include missed days still inside its window; do not backdate run success, replay missed schedule dates, clear claims or automatically retry uncertain outcomes. Older gaps need a separately reviewed backfill. Paul selected “Use 31-day rolling coverage” during this batch, explicitly for preparation; this does not authorise changing tonight’s deployed dates.

A changing reporting scope can legitimately produce a new candidate even on a no-mutation day. Compare source fingerprints and financial effects within matching scopes rather than requiring candidate-version equality across different windows.

## Capacity gate before activation

Source review found two independent 60-second stages: summary extraction in experiments/shopify/collect.mjs and sequential order-detail extraction in map-sales.mjs. Summary query currently uses one order/page with a 100-page default. Approximately N+2 summary requests plus N detail requests are needed. The 300-second cloud child timeout does not extend those separate stage deadlines. Nested line/refund connections are also bounded and must refuse incomplete extraction.

Before source generation, measure all accessible existing orders plus the proposed ten with explicit headroom. Test representative details/refunds, pagination termination, throttle handling and deadline exhaustion. Both stages must finish comfortably within their limits, and truncation must never record success. Raising only summary page size is insufficient; do not delete history to fit the bound.

## Remaining bounded work

1. Complete consistent propagation of the agreed window across configuration, claim, journal, intake and receipt before changing the worker; the pure planner is prepared separately.
2. Prepare the exact new synthetic-store application and membership package for review. Historical local verification is complete; staging application remains a separate mutation and decision.
3. Verify a development-only Shopify write method and its no-charge/no-contact/no-fulfilment/no-inventory behavior; prepare separate least-privilege access and durable duplicate/uncertain-write handling.
4. Measure collector capacity, specify the exact Monday/two-week stop dates and any hosting change, then present one concrete activation package. No new recurring automation has been created here.

The [full proposal](testing-programme-proposal-2026-09-18.md) remains the semantic specification; [overnight record](first-overnight-verification-2026-09-18.md) remains authoritative for actual deployment/run evidence.
