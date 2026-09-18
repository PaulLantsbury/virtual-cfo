# Cloud staging worker activation — 17 September 2026

> 18 September update: first scheduled execution **failed before collection** because the exported website artifact manifests caused Replit to launch the website API service. No nightly claim or new journal entry; financial fingerprints unchanged. A guarded worker-export correction is tested but not republished. See [actual overnight evidence and next action](first-overnight-verification-2026-09-18.md). The publication/readiness record below is historical and does not imply successful execution.

## Current status — published, first overnight execution pending

The separate Replit Scheduled staging worker is PUBLISHED. Build, bundle and promotion completed on 17 September. Replit Overview reports published; Schedule reports **No runs yet**. Eight approved settings are saved and included in deployment. A fresh Replit shell passed authenticated cloud `--check` through the restricted session pooler, with fixed project/store/date scope and `financeImported=false`.

The configured cron is `0 2 * * *`, six-minute hosting timeout, Europe hosting region. Saved timezone **Europe/London is verified**: the published Adjust Settings timezone dropdown visibly marks Europe, London with a checkmark. Replit groups that option under Greenwich Mean Time (GMT), explaining its abbreviated overview label. The selector was absent from the accessibility tree but present in the rendered editor. No timing change, fixed UTC offset or republish was needed. First expected trigger is 18 September 01:00 UTC / 02:00 BST; actual execution remains to be verified. Runner retains its [02:00,02:15) London guard and once-date lock.

Replit automatic non-interactive dependency installation initially failed. Export-only preparation now narrows workspace installation to `lib/db`, retains the locked catalog, and adds runtime-only, frozen-lockfile, scripts-disabled and CI settings. Exact pnpm 10.26.1 first/repeated installs, smoke check and two export guard/preservation tests passed. The published worker combines source revision 9af392d65c91dd899e035cf3e2113dbc7bee26d9 with deployment preparation from d8ac46bf939da86123c06ddcbc140f7f1a8f552f and the documented export transformation. Main repository dependency manifests were not narrowed.

Automatic approval initially rejected publishing due to the database checkbox. Verified the worker's default development database had no tables and copy-development-data was off; a subsequent reviewed publish was accepted. No approval override, original website change or Supabase production change.

Paul approved the separate private Replit staging worker, restricted staging/development credentials, nightly-claims schema, 02:00 Europe/London infrastructure trial with [02:00,02:15) startup window, fixed 2026-09-17 reporting period and US$5/month planning allowance. Production and the existing published website are outside this activation.

Created Night Scout Staging Nightly at https://replit.com/@pjlantsbury/Night-Scout-Staging-Nightly (project dc5f1a04-2e7d-482e-b3ed-19fc86cfd6d0). Invite access shows Paul as sole owner; no join link created or collaborators invited. Imported reviewed GitHub commit 311a88eea958283aa5c0227f097fcbea16807e1d, excluding the website .replit/replit.nix configuration. New Node 24 worker configuration only. Pooler adaptation and setup record published in GitHub development commit 9af392d65c91dd899e035cf3e2113dbc7bee26d9, then imported into Replit; smoke check passed again.

Applied db-migrations/proposals/shopify-nightly-claims-2026-09-17.sql to staging after confirming table absent; SQL editor reported success. Do not reapply. Local restricted read-only cloud readiness check through the session pooler passed after this application. No scheduled collection has run.

Replit runtime Node 24.13.0 and pnpm 10.26.1. Full workspace installation hit Replit package firewall 403 for unrelated development dependency orval. Narrowed locked installation to production dependencies of @workspace/db; installation and worker smoke check passed in Replit. No firewall bypass or lifecycle scripts.

Direct database network check from Replit returned ENETUNREACH. Authenticated Supabase dashboard supplied free IPv4 session pooler aws-1-eu-west-1.pooler.supabase.com:5432. Added narrowly pinned support with the same restricted login, project-qualified pooler wire username and actual session_user verification. TLS verification unchanged. 35 focused tests passed; authenticated readiness subsequently passed from Replit after secure entry.

Published as a Scheduled worker, with no public HTTP URL. Machine price: 1 vCPU / 2 GiB at $0.000013/sec. Thirty six-minute runs would be about $0.14 compute, plus previously observed $0.99/30-day execution charge, excluding other usage. US$5 is a planning allowance, not a platform spending cap.

## Next verification and remaining work

1. Inspect the first actual scheduled trigger and its London-time alignment, runner receipt and durable journal; distinguish a successful deployment from successful source collection.
2. Verify once-date reservation and unchanged financial invariants. No manual daytime run was requested or performed.
3. Agree historical rolling coverage/backfill and catch-up behaviour; this worker still rechecks only the explicit 17 September development period.
4. Add live per-store nightly telemetry and missing-run monitoring. Settings now shows an explicitly dated, project/store-scoped deployment acknowledgement and the existing dynamic collection journal; it does not pretend to poll Replit or identify scheduled attempts from manual ones.
5. Continue site-wide calculation acceptance, then the evidence-backed CFO layer. Production release remains separate.

Do not reapply the claims migration or request the same activation approval. Never start the website, seed or push a database from this worker. No administrator/reviewer credentials are deployed.

Credential values were accidentally pasted into the conversation during secure-entry handoff. Do not reproduce them in documentation, logs or GitHub. Replacement of the restricted database password and Shopify app secret should be completed before expanding beyond this development trial, coordinating all existing consumers.

After activation, inspect the first actual overnight journal and financial invariants before declaring a Mac-independent successful refresh. Historical rolling coverage/backfill, missed-slot alerts and production readiness remain separate unfinished work.

## Final focused package

Settings now distinguishes the acknowledged staging schedule, outstanding first overnight verification, last successful saved collection and existing failure/uncertain-outcome warnings. The acknowledgement is scoped to the exact staging Supabase host and Shopify development store. Other stores/environments do not inherit it. It contains operational configuration, not hardcoded financial results. It explicitly states that status refresh reads saved collection records, does not run Shopify collection, and does not check Replit live. No schema/grant changes or financial approvals.

See [first overnight verification checklist](first-overnight-verification-2026-09-18.md). Replit failure notifications were observed disabled; enabling notifications is separate from this UI package. Existing internal uncertain-outcome locks remain active.

Verification: four focused connection checks and frontend TypeScript check passed. Signed-in Settings browser review confirmed the correct staging trial, 15:31 UTC manual collection receipt, one excluded test order, two refunds and zero mapped events. Switching to Store A removed the deployment acknowledgement immediately; no shared-store success leaked. Scope tests reject another project, store, malformed URL, non-HTTPS host, credentials, and non-default port. No new data collection or financial writes were performed.
