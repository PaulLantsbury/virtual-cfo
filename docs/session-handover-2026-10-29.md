# Night Scout — 29 October 2026 restart batch

## Current priority and scope

Paul has approximately three hours and prioritises daily development test data flowing through Shopify into Night Scout. Broader CFO recommendation work is deferred until remaining pages are redesigned and connected; no page redesign is requested today. Keep existing Shopify/Xero customer connections read-only and development writers isolated.

## Implemented and locally checked

- Settings now explains retained test-order counts and their exclusion from merchant sales; absence of evidence stays unavailable. Counts cover the retained extraction, not newly created orders in the reporting period. The September deployment failure remains available as historical evidence rather than current status.
- Added a disposable end-to-end test: mocked Shopify orders/details → retained candidate → durable journal → authenticated membership RPC → frontend status. Replays do not duplicate candidates; test orders produce no merchant finance events.
- Prepared an explicitly opt-in Shopify-only programme proposal for 29 October–4 November, 18:00–18:14 London (GMT), one GBP60 nominal test order/day, seven maximum, GBP0 charged. New key `shopify-staging-20261029`, hard stop 5 November 00:00 UTC. Old programme rows/caps/dates/actions remain unchanged; missed dates are skipped. No payment/email/fulfilment/inventory changes.
- New binding SQL leaves generation disabled, requires a fresh actual provider receipt and rejects unresolved/overlapping Shopify work. Guarded wrapper preserves the existing claim implementation and revokes direct writer access to its renamed underlying function. No remote SQL applied.
- Root combined test run: 40 passed, zero failures. Frontend TypeScript passed. Initial root build lacked required PORT; rerun with PORT=3000 BASE_PATH=/ passed, with existing sourcemap/chunk warnings. Independent source review passed. Reviewer additionally installed the full activation schema in disposable PGlite and verified wrapper/underlying function ACLs, disabled cap7 row, and SET-only membership. No hosted or multi-backend concurrency acceptance.

## Live access and evidence — not completed

The current cloud browser started with no tabs and was signed out of Render. Secure auth initially failed because automatic review model was at capacity; retry allowed method selection, and Paul selected Google and the saved paul@thepocketfd.com account. Secure password request returned submitted. Subsequent browser observations repeatedly timed out at the origin approval gate. This is an approval infrastructure timeout, not a site error or unsafe-action determination. Render authentication state remains unknown; do not claim sign-in success or inspect through an indirect workaround. No hosted service settings changed, secrets copied, provider calls made, or orders created in this batch.

Actual overnight Shopify/Xero receipts and live writer role/password/binding state remain uninspected today. Preserve the 15 October observations as historical only. Do not infer that the old services still run successfully. Shopify reader still depends on Replit until proven otherwise; do not recommend cancellation.

## Resume live work

1. Resolve browser approval/access and verify Render signed-in state. Inspect existing writer and Xero reader jobs/logs, then current Supabase restricted roles/programmes/actions using the read-only inspection SQL. Do not expose credentials, hashes or customer IDs.
2. Complete restricted writer password/URL/trusted CA privately if absent. Existing Shopify secret passed 15 October preflight; recheck rather than rotate or request it again.
3. Read `experiments/test-programme/SHOPIFY-RESTART-2026-10-29.md`. Obtain explicit approval for the concrete new programme/binding before remote migration/activation. Obtain a fresh Shopify source receipt, apply reviewed disabled binding, opt into the new build profile, verify disabled hosted build/connectivity, then activate the exact approved programme/schedule. Proposed GMT cron `0 18 * * *`; no catch-up or silent date extension.
4. Acceptance requires provider receipt + durable confirmed action + exact order matched privately to the next genuine overnight candidate with test exclusion. A UI count, source preflight or successful build alone is insufficient.
5. Profit Engine and Cash demonstrations remain synthetic. Making merchant charts nonzero from test orders is not authorised; a separate development financial-data design needs agreement. Retain scenario-slider discussion and remaining page redesign agenda for a later session.

Routine source publication is authorised to the existing development branch; this does not apply SQL or activate jobs. Latest previous durable checkpoint is the 15 October handover, updated on 16 October.
