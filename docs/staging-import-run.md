# Staging first-import run — ready for approval

## Concrete scope

Target only Night Scout Staging bioalckltvkhlczusdvl. Apply db-migrations/staging/20260910_import_scenario.sql (SHA-256 eda78a5d462719cd8c947e3e941ee827c66a997b6e8f475f3aed454faac7e22d). This guarded atomic package adds store C, one February candidate/head and two source versions. It creates no orders/refunds/evidence/coverage, memberships or reviewer grants. Existing A/B rows are untouched.

Provision night_scout_import_login using experiments/staging/provision-importer.mjs: dedicated LOGIN, NOINHERIT and no administrative attributes, connection limit one, granted only the existing importer service role. Generate a strong random private password after approval and keep it in a mode-0600 Git-ignored .local file. The reviewed generator emits a SCRAM verifier, never the plaintext password; generated credential-bearing SQL must also stay private. Do not reset any existing credential or reuse the review login.

Run the reviewed importer runtime once, configured solely for store 90000000-0000-4000-8000-000000000003, batch 93000000-0000-4000-8000-000000000003, February 1–28 2026, using verified TLS and the official Supabase CA. Then explicitly repeat once. Expected first result imported_awaiting_review; second already_imported. No public endpoint or continuous job is enabled. Close the pool afterwards.

Expected financial records: one original sale with GBP 100 gross product, GBP 10 discount, GBP 18 VAT and GBP 108 customer charge (GBP 90 net product); one March refund GBP 24 including GBP 4 VAT. One immutable import receipt and false February completeness. No costs/profit assumed. No human review or restoration is authorised by this test package.

## Checks and limits

Before applying, verify actual dashboard project, installed importer objects, absent importer login and store C, exactly the existing A/B stores, and capture current source amounts/coverage/audit. Check exact script hash/editor content. Stop on discrepancies rather than overwriting. Each setup transaction must succeed before continuing; after uncertain outcomes inspect actual state instead of repeating blindly.

After provisioning, verify role attributes and only intended membership. After seed confirm C has no financial rows or user grants. After import/retry verify one C order/refund/receipt, matching evidence, false completeness and unchanged A/B records/coverage/review history. Do not change production, original Supabase project, Replit or merge the draft.

Two exact-package tests pass for preservation, restricted first-import/retry, empty seed, no membership, replay refusal, login constraints and late-error rollback. Existing runtime previously passed real dedicated-login PostgreSQL checks. This newly composed seed/login package is tested locally; it has not been applied to staging. Approval is requested for the whole bounded sequence above.
