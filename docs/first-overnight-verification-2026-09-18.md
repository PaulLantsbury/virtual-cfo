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
