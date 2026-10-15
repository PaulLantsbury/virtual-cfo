# Night Scout — stopping point, 15 October 2026

Paul is stopping for today. No active agent work should be claimed. Next session starts with reviewing the latest Cash Control page, then continuing source-feed reliability/test-data setup. Do not rebuild completed packages.

## Review first

Private owner-only demo: https://night-scout-demo.quickraven4.chatgpt.site — Cash Control and Profit Engine. Latest Site source `865b57b4711cd00b8c53258f2f9b040f5156e841`; deployment `appgdep_6ad10dab101881918396b59194cde5d1` succeeded. Project `appgprj_6ad0edd6b1748191914045905aba817d`. Latest GitHub branch code `3914cc3cb562953a02483cb4070551cacb4fa8a9` on `codex/restart-baseline`.

Cash summary, profit-to-cash bridge, CFO review plan and action tracker were liked. Latest changes await Paul’s review: explicit negative cash “used” / profit “loss”; all main trend charts always show twelve completed weeks/months regardless headline period; Profit discount/refund trends also fixed. Selected KPIs/bridges still follow headline controls. Forecast chart and payment-entry form removed; Cash resilience shows bank cash, editable buffer and three-complete-month historical movement before funding. Any cover is historical only, not a forecast/date; cash-positive/missing history yields no invented runway. Sample data only: weekly cash allocations are illustrative. Standard browser-local reminders retained, not email automation. Independent review, 25 focused checks, TypeScript and demo build passed. No browser layout QA or empirical forecast validation claimed.

## Feeds: exact status

Main product and collectors MUST remain read-only. Separate operator credentials/scopes/processes only. No writer API/UI/credentials may be mounted on the customer app.

Shopify writer app Night Scout Test Data Writer (`435944357889`), installed only on PocketLaunchpad1 (`pocketlaunchpad1.myshopify.com`). Separate Render cron `night-scout-shopify-test-writer-staging`, ID `crn-db8g0n8u01pc7383j2d0`, 0.5CPU/512MB; explicit initial US$5 budget approval. Build and disabled smoke succeeded. Schedule `0 17 * * *`, generation false. Paul replaced a mistakenly pasted GitHub value with the correct Shopify writer client secret privately. Actual source-only preflight succeeded at `2026-10-15T17:03:34.008Z`: exact domain, GBP, development target, granted read_orders/write_orders. No token printed or provider order written. Fresh receipt required again before binding (one-hour SQL expiry). Never re-send or inspect the earlier mistaken token.

Remaining writer gates: secure password setup for existing restricted DB login `night_scout_test_writer` (last observed absent; no confirmed interactive admin password workflow yet), restricted session-pooler URL and verified CA on isolated host; inspect durable ledger/roles; exact Shopify-only SQL amendment approval/application, disabled binding then bounded activation. AGENTS standing publication excludes live migrations/new grants: prepare concrete amendment then obtain approval. Do not use the old coupled Xero amendment to unblock Shopify.

Daily writer profile permits ONLY 15–18 October 18:00–18:14 London, existing key `shopify-staging-20261012`, cap4, £60 nominal each / £0 charged, no payment/email/fulfilment/inventory changes, excluded merchant revenue. 15 October was not activated; no catch-up. **If resuming after 18 October, this profile is expired: do not enable, shift dates, reset key/cap or fake time. Review remaining ledger and propose a future bounded programme for explicit approval.** Hard stop remains 26 October; never silently extend. No provider test orders or Xero test invoices were created today.

Xero reader: real connected preflight and supported 1–14 October accounting collection observed earlier today, not long-term reliability proof. Existing Render reader `crn-darap1qd0e5s73e1dcn0`, command `node deployments/nightly-staging/run-xero-daily-cron.mjs`, schedule `0 1,2 * * *` UTC, real London02:00 gate admits one. First scheduled result expected16October02:00London remains unverified at closeout. Inspect genuine overnight receipt first next time; preserve last supported snapshot on failure, never TriggerRun/fake clock to claim overnight success.

Shopify reader latest known genuine overnight15October completed/recorded_requires_review, scope14September–14October, zero unresolved attempts/claims. Reader still on Replit. Prepared Render wrapper/cutover docs and tests only; no replacement service/cutover. Separate host cost approval, frozen hosted package build, secure read credentials, no-overlap future-window cutover and real overnight proof required before cancelling Replit.

Xero writer remains off; separate actual GBP demo consent/credentials/bindings still needed. It must not block Shopify-only readiness. Final test-data acceptance is confirmed provider receipt + durable ledger + next real overnight reader result showing test exclusion; screenshots/builds are not acceptance.

## Next-session order

1. Review Cash Control and Profit Engine with Paul; assess simpler resilience block and fixed-context charts.
2. Inspect actual overnight Xero/Shopify reader receipts and connection status.
3. Secure writer DB provisioning; refresh Shopify source proof; review current date/ledger and only then propose/apply approved binding and future permitted write schedule.
4. Finish Shopify reader Render packaging and controlled cutover; keep Replit until genuine replacement overnight proof.
5. Integrate trustworthy read evidence into product views: current API exposes cash:null and lacks payouts, bill schedules and classified cash movements. See cash-data-dependencies-2026-10-15.md; never wire sample cash into customer reporting. Meta/Google later once test accounts/access are ready; preserve agreed roadmap focus.

Related records: cash-resilience-and-trend-context-2026-10-15.md; cash-data-dependencies-2026-10-15.md; integration-acceptance-2026-10-15.md; shopify-writer-hosting-gate-2026-10-15.md; experiments/test-programme/SHOPIFY-SECURE-SETUP.md.
