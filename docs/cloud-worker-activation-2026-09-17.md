# Cloud staging worker activation — 17 September 2026

## Current status

Paul approved the separate private Replit staging worker, restricted staging/development credentials, nightly-claims schema, 02:00 Europe/London infrastructure trial with [02:00,02:15) startup window, fixed 2026-09-17 reporting period and US$5/month planning allowance. Production and the existing published website are outside this activation.

Created Night Scout Staging Nightly at https://replit.com/@pjlantsbury/Night-Scout-Staging-Nightly (project dc5f1a04-2e7d-482e-b3ed-19fc86cfd6d0). Invite access shows Paul as sole owner; no join link created or collaborators invited. Imported reviewed GitHub commit 311a88eea958283aa5c0227f097fcbea16807e1d, excluding the website .replit/replit.nix configuration. New Node 24 worker configuration only. Pooler adaptation and setup record published in GitHub development commit 9af392d65c91dd899e035cf3e2113dbc7bee26d9, then imported into Replit; smoke check passed again.

Applied db-migrations/proposals/shopify-nightly-claims-2026-09-17.sql to staging after confirming table absent; SQL editor reported success. Do not reapply. Local restricted read-only cloud readiness check through the session pooler passed after this application. No scheduled collection has run.

Replit runtime Node 24.13.0 and pnpm 10.26.1. Full workspace installation hit Replit package firewall 403 for unrelated development dependency orval. Narrowed locked installation to production dependencies of @workspace/db; installation and worker smoke check passed in Replit. No firewall bypass or lifecycle scripts.

Direct database network check from Replit returned ENETUNREACH. Authenticated Supabase dashboard supplied free IPv4 session pooler aws-1-eu-west-1.pooler.supabase.com:5432. Added narrowly pinned support with the same restricted login, project-qualified pooler wire username and actual session_user verification. TLS verification unchanged. 35 focused tests passed; actual Replit authenticated readiness still pending credential entry.

Replit publishing form prepared as Scheduled, daily 02:00 Europe/London, six-minute timeout, Europe geography, database initialisation unchecked. It remains UNPUBLISHED. Form displays 1 vCPU / 2 GiB at $0.000013/sec. Thirty six-minute runs would be about $0.14 compute, plus previously observed $0.99/30-day execution charge, excluding other usage. US$5 is planning allowance, not a platform spending cap.

## Remaining before activation

Worker-only build and nightly run commands have been written to the new .replit. Securely enter only the eight approved worker settings, run authenticated cloud --check, verify saved build/run commands and schedule, then publish within approved budget. Latest Replit --check returned disabled/writeAttempted=false: secrets are not yet available. Final publication is still authorised; no fresh approval needed for unchanged scope. Never start website, seed or push database. No administrator/reviewer credentials.

Credential values were accidentally pasted into the conversation during secure-entry handoff. Do not reproduce them in documentation, logs or GitHub. Replacement of the restricted database password and Shopify app secret should be completed before expanding beyond this development trial, coordinating all existing consumers.

After activation, inspect the first actual overnight journal and financial invariants before declaring a Mac-independent successful refresh. Historical rolling coverage/backfill, missed-slot alerts and production readiness remain separate unfinished work.
