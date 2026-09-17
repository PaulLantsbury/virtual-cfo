# First overnight verification — 18 September 2026

## Approved trial and expected result

- Worker: Night Scout Staging Nightly in Replit; production website unchanged.
- Target: staging project bioalckltvkhlczusdvl, development store 56d92f8a-746e-4b4f-b408-81fc98c4aa17.
- Saved schedule: daily 02:00 Europe/London, six-minute host timeout. First expected run 18 September 2026 01:00 UTC (02:00 BST). Start permitted before 02:15 London, not at or after it.
- Reporting scope remains 17 September to 17 September; execution date advances, reporting period does not. This proves infrastructure only, not rolling coverage.
- No runs had occurred at deployment verification on 17 September. Do not infer success from publication, readiness checks, or earlier manual collections.

## Read-only verification sequence

1. Open the worker Publishing > Schedule and Logs. Record actual trigger/start/end times and exit outcome. Do not click Run now to compensate for a missing run.
2. Compare start time to the London window. The menu's saved Europe/London selection is ticked; GMT is its display group. Do not replace it with a fixed UTC offset when clocks change.
3. Use the existing private restricted intake connection to inspect ingest_v1.nightly_claims for this store and local_date 2026-09-18: exactly one reservation, scheduled_at 2026-09-18T01:00:00Z, timezone Europe/London, fixed date_from/date_to 2026-09-17. Inspect running/completed/unconfirmed state and timestamps.
4. Inspect ingest_v1.sync_attempts in the corresponding time interval. A completed claim alone is not a successful source result: check result_code and the safe worker receipt. replay/recorded_requires_review/changed_requires_review are candidate collection results; historical_replay/stale_source/conflicting_source/missing_source require explanation. Claim and attempt have no explicit foreign-key link: correlate store, period, timestamps and host receipt; flag ambiguity instead of guessing.
5. Compare source/candidate state against the last recorded baseline: one excluded Shopify test order, two refunds, two retained candidate versions before the nightly trial, needs_recheck, zero mapped financial events. If Shopify was unchanged, expect no added candidate version. Investigate changes; never overwrite history or auto-approve figures. Verify financial relations and completeness/review states are unchanged using the existing private baseline evidence.
6. Open signed-in Settings for PocketLaunchpad1. Refresh connection status, confirm journal agrees with the database, and keep the distinction between collection and financial verification. Update the dated deployment acknowledgement only after inspecting the actual overnight evidence. It is not live scheduler telemetry and cannot independently detect missing runs.
7. Record sanitized evidence, result and remaining limitations in the handover/GitHub development branch. No credentials, raw order/customer data or private output in commits.

## Failure handling

- No host run: inspect deployment active state and saved schedule. A missing run is not a successful refresh.
- not_due: investigate actual scheduler timestamp/timezone; retain the runtime start guard.
- running/unconfirmed claim or journal: inspect durable state before any retry. Do not delete/release reservations, change clocks, or rerun collection blindly.
- Candidate refusal or conflicting/missing source: retain supported financial data and investigate; never present stale or incomplete results as verified.
- First successful collection still does not certify completeness, financial accuracy, historical coverage or production readiness.

## Next work after evidence review

Agree rolling historical coverage/backfill and missed-run/catch-up policy, connect live nightly telemetry safely, then run the independent calculation cases through site-wide reporting and build the evidence-backed CFO layer. Coordinate replacement of development credentials previously pasted into chat before expanding the trial; do not publish their values.

## Fresh-session pre-run verification — 17 September, approximately 19:00 UTC

This is a pre-run access/baseline checkpoint, not an overnight result. Current time was still 17 September; first expected execution remains 18 September at 01:00 UTC / 02:00 BST.

- GitHub access verified. At session start the only branches were codex/restart-baseline at handover commit 167ffdb775af9db507d7ea1e038e33e5fef80594 and main at the older June commit 2cf59f65982714037e43bbd0554ece2fd81d113f. No newer development branch was found. Clean local commit da43b379753d433681a91b4e53d99ed2157a0e28 has the identical tree 408a1270ecd1fbb76faa0fc2004d1e56be178554; different commit metadata is not a file divergence.
- Uploaded handover and repository instructions, handover, roadmap, overnight checklist, activation record, documentation index and agreed financial definitions reviewed. Historical prepared-only sections do not supersede the activation checkpoint.
- Supabase staging authenticated access verified using existing restricted intake and review logins, verified TLS and explicit READ ONLY transactions. No production connection attempted.
- At 18:59:54 UTC candidate inspection confirmed one TEST_ORDER-excluded order, two refunds, two retained batches, needs_recheck, zero mapped events and coverageCertified=false for the fixed 17 September period.
- At 19:00:24 UTC the staging store had zero nightly claims. Collection journal contained one completed replay, started 17 September 15:31:07.851 UTC and finished 15:31:09.346 UTC. This earlier manual collection is not an overnight run. No running/unconfirmed entry was observed.
- Count/content fingerprints for batches, heads, public orders/refunds and finance coverage/order/refund evidence all matched the existing private identity-enable-before baseline (seven relations). This confirms unchanged inspected evidence, not financial completeness or site-wide correctness.
- Shopify authentication and shop-context read passed for the expected development shop, GBP and Europe/London, with read_orders, read_all_orders and read_customers. No order/customer payload was requested or collected in this check. Local credentials working does not certify deployed worker credentials.
- Replit owner browser session could open the separate worker. Publishing Overview showed published, Scheduled, Europe hosting, cron 0 2 * * *, and the documented GMT group label. Detailed Schedule/Logs inspection and a fresh timezone-menu check were not completed because the browser was in active interactive use; the prior saved Europe/London evidence remains historical. Do not infer a current host run from Overview. No Run now, republish or configuration change performed.
- Existing localhost:3000/settings responded HTTP 200. A signed-in Settings session and journal refresh were not reverified. No preview restart or application changes.
- No dedicated Supabase/Replit/Shopify/Xero connector was available in this session; staging database and Shopify access were confirmed through existing private local configuration, Replit through browser. Xero access/test organisation remains unverified; original production database and website were intentionally not probed.

Next bounded verification: after the first expected execution, inspect host trigger/receipt, correlate the local-date reservation and journal, recheck the fixed dates and financial fingerprints, and compare signed-in Settings. A completed claim can contain a refused source result; cloud --check alone explicitly does not check Shopify authentication. Keep all existing no-retry/no-reservation-clearing safeguards. No new schedule, background monitor, test transaction, database mutation or financial approval was created by this checkpoint.
