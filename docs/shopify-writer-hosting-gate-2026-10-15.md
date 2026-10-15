# Shopify writer: hosting gate — 15 October 2026

Separate writer app “Night Scout Test Data Writer” was created/released and installed on PocketLaunchpad1 after Paul’s exact approval. UI confirms Installed / Development legacy / exact development domain. No writer app credentials were read/exported and no orders were created.

After Cash feedback publication, automatic approval review rejected opening a new Render dashboard tab to prepare the separate writer cron service. Reason: hosting setup was outside the specific app-installation approval and could lead to unapproved hosting/spend. Do not retry via another tab/API/route before approval. No service created or charge incurred.

Proposed next approval: separate lowest-plan Render Shopify test-writer cron job, initial test budget up to US$5; verify the actual creation form price stays within approval. Official Render docs report US$1 monthly minimum per cron service and usage-based compute. Prepared build/command/config live in experiments/test-programme/SHOPIFY-OPERATOR-DEPLOYMENT.md. Paul approved this exact hosting proposal on 15 October. A separate cron service has now been created; generation remains disabled.

Still required after hosting permission: restricted writer database password through owner secure workflow, private writer credentials, fresh actual scope/target check, reviewed Shopify-only profile binding and future eligible window activation. No catch-up or date/cap expansion. The Night Scout customer app/read collectors stay read-only.

## Approved hosting creation

Render service `night-scout-shopify-test-writer-staging`, ID `crn-db8g0n8u01pc7383j2d0`, created on the smallest 0.5 CPU / 512 MB plan displayed at US$0.00016/minute. Initial budget approval: up to US$5 (not a platform-enforced spending cap). Source branch `codex/restart-baseline`, first build `bld-db8g0nou01pc7383j3m0` at commit `f3214a081fb1bc5b33bfc830f1ff0cf84a440eff`. Corrected build `bld-db8g1667bikc73e0ibs0` succeeded. First build failed on isolated autoInstallPeers setting mismatch; explicit `--config.auto-install-peers=false` corrected it without loosening lockfile checks.

Schedule `0 17 * * *`; `NIGHT_SCOUT_TEST_PROGRAMME_ENABLED=false`. Config points to the isolated generated Shopify programme file; Node 24 selected. No writer secrets, DB password or provider writes have been provisioned/performed. Scheduler existence does not mean test generation is active. Existing source date/window/cap guards remain unchanged.

Hosted disabled smoke run completed successfully at 16:35:24 UTC on 15 October, with output `prepared-disabled`, provider Shopify, actions 4. This verifies hosted entry/config execution, not provider credentials, database readiness or actual order creation.

## Next multi-agent batch

Prepared source-only authenticated preflight with exact safe seven-field receipt, independently reviewed. Separate writer host now has non-secret project/domain/app pins and independently observed app-boundary acknowledgement; generation remains false and no provider-target verification flag is asserted. Hosted configuration rebuild `bld-db8g7iuq1p3s73d97g20` succeeded. Client secret and restricted DB password remain absent; no actual provider preflight or schema amendment has occurred.

A separate Render Shopify reader wrapper/cutover specification is prepared only. It has no hosted service and replaces no Replit schedule yet. See `docs/integration-acceptance-2026-10-15.md`.

## Actual authenticated provider receipt — 15 October 17:03:34 UTC

After Paul replaced the mistaken GitHub value directly with the separate Shopify writer secret, Render build `bld-db8gdbt9fdbs73e7mflg` succeeded. Root executed `node experiments/test-programme/shopify-source-preflight.mjs` in this isolated cron shell with generation false. API receipt: domain `pocketlaunchpad1.myshopify.com`, GBP, partnerDevelopment true, separateWriterApp/sameOrganisation independently acknowledged from prior app installation, grantedScopes exactly read_orders/write_orders; observedAt `2026-10-15T17:03:34.008Z`. No token printed, DB call or order created. Restricted writer DB password, reviewed SQL binding and bounded activation remain pending. A later SQL application must use a fresh receipt within its one-hour limit. No GitHub credential was sent to Shopify by this check.
