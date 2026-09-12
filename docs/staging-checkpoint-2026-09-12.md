# Integrated staging checkpoint — 12 September 2026

Paul approved this package and staging after meaningful completed packages. Two supporting agents independently checked startup/target and acceptance criteria; the coordinator ran the integrated checks.

## Version and environment

Application tested: local commit `3df821b`, matching GitHub commit `93fa0d8f37bbc600518f6b91413c3580eb654492`, tree `703735a8f51b30b483255ca431dc5756c54f70a5`. Subsequent checkpoint changes are documentation only.

This is a **local staging preview** at http://localhost:3000, connected to Supabase staging `bioalckltvkhlczusdvl`. It is not a hosted staging deployment. The existing private launcher serves current source via Vite and the restricted review API on loopback port 4001; it does not serve the previous fake-test build. Existing private configuration and TLS certificate were used, with no credentials published. Port 3001 is obsolete for this session.

## Integrated checks

- Refreshed existing authenticated browser session, authorised store A/C selection and real staging access succeeded. This verifies the retained session, not a fresh password login. Switching stores cleared prior review dates/evidence.
- Same-origin review API rejected an unauthenticated prepare request with HTTP 401.
- Store C February 2026 review: net product sales GBP90, one original order; March and April each GBP−20, zero original orders, refund-only activity. Linked events outside each period were labelled correctly. Changing dates cleared previous evidence.
- All three preparations passed transaction checks while explicitly requiring independent completeness review. Confirmation stayed unchecked and restoration disabled; no restoration was submitted.
- Cash Control displayed its sample-model notice and actual-cash-unavailable status with separate August sales context. The Pro sample simulator responded to a revenue change and reset to its original values.
- Margin Analysis displayed unverified source revenue 123.00 and AOV 100.00 for store A, explicitly without verified currency, separate from the fixed sample model; actual margin remained unavailable.
- Monitoring Free and Pro views clearly said inactive/prototype, with fictional history and no scheduled checks or notifications. Local settings selections changed with explicit unsaved wording and reset to Weekly/In-app after reload. The existing development plan toggle was used; no subscription or entitlement record changed.
- Independent read-only database queries after financial review checks confirmed audit entries 1 total/0 for C; import receipts 2 total/both C; February/March/April C coverage all false, matching the saved baseline. Queries used restricted logins and read-only transactions rolled back afterward.

## Limits and next step

Existing isolated acceptance evidence remains 31 first-pilot and 26 reporting-package browser checks, plus typecheck/build and review. No application code changes required repeating that entire matrix here. This run verifies integration using existing synthetic records; it does not certify real-source completeness, actual costs/cash or monitoring operation.

Paul can now walk through Cash Control, Margin Analysis and Monitoring in this preview. Full-page reloads currently ask him to select a store again; this is an observed usability limitation, not loss of authentication. Financial completeness remains unapproved. Keep reference comparison paused until an agreed real source exists.

No migration, grant, import, main merge, Replit sync or production release occurred. Production remains subject to GitHub/Replit baseline reconciliation and an explicitly approved release/rollback package. The local preview depends on the current computer/process remaining available.
