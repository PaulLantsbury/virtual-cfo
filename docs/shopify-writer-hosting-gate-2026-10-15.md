# Shopify writer: hosting gate — 15 October 2026

Separate writer app “Night Scout Test Data Writer” was created/released and installed on PocketLaunchpad1 after Paul’s exact approval. UI confirms Installed / Development legacy / exact development domain. No writer app credentials were read/exported and no orders were created.

After Cash feedback publication, automatic approval review rejected opening a new Render dashboard tab to prepare the separate writer cron service. Reason: hosting setup was outside the specific app-installation approval and could lead to unapproved hosting/spend. Do not retry via another tab/API/route before approval. No service created or charge incurred.

Proposed next approval: separate lowest-plan Render Shopify test-writer cron job, initial test budget up to US$5; verify the actual creation form price stays within approval. Official Render docs report US$1 monthly minimum per cron service and usage-based compute. Prepared build/command/config live in experiments/test-programme/SHOPIFY-OPERATOR-DEPLOYMENT.md. Paul approved this exact hosting proposal on 15 October. A separate cron service has now been created; generation remains disabled.

Still required after hosting permission: restricted writer database password through owner secure workflow, private writer credentials, fresh actual scope/target check, reviewed Shopify-only profile binding and future eligible window activation. No catch-up or date/cap expansion. The Night Scout customer app/read collectors stay read-only.

## Approved hosting creation

Render service `night-scout-shopify-test-writer-staging`, ID `crn-db8g0n8u01pc7383j2d0`, created on the smallest 0.5 CPU / 512 MB plan displayed at US$0.00016/minute. Initial budget approval: up to US$5 (not a platform-enforced spending cap). Source branch `codex/restart-baseline`, first build `bld-db8g0nou01pc7383j3m0` at commit `f3214a081fb1bc5b33bfc830f1ff0cf84a440eff`. Corrected build `bld-db8g1667bikc73e0ibs0` succeeded. First build failed on isolated autoInstallPeers setting mismatch; explicit `--config.auto-install-peers=false` corrected it without loosening lockfile checks.

Schedule `0 17 * * *`; `NIGHT_SCOUT_TEST_PROGRAMME_ENABLED=false`. Config points to the isolated generated Shopify programme file; Node 24 selected. No writer secrets, DB password or provider writes have been provisioned/performed. Scheduler existence does not mean test generation is active. Existing source date/window/cap guards remain unchanged.

Hosted disabled smoke run completed successfully at 16:35:24 UTC on 15 October, with output `prepared-disabled`, provider Shopify, actions 4. This verifies hosted entry/config execution, not provider credentials, database readiness or actual order creation.
