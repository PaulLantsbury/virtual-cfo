# Shopify read pipeline — Thursday 15 October

## Accepted evidence and remaining gap

The saved 11 October checkpoint records signed-in Settings showing a successful collection at 01:01 UTC for 10 September–10 October: one excluded test order, two refunds, zero financial events. This proves a saved rolling-period collection. Actual scheduler/claim correlation and the intervening overnight receipts have not yet been independently accepted.

For 15 October, the expected genuine scheduled trigger is 02:00 Europe/London / 01:00 UTC. Its inclusive 31-day reporting window is **14 September–14 October**. Do not trigger Run Now, change clocks or clear reservations to replace missing scheduled evidence.

## Prepared metadata improvement

`node experiments/shopify/check-cloud-nightly.mjs` retains the existing dedicated intake login, exact staging store/project and verified TLS checks. Its read-only transaction now also reads:

- Seven local calendar dates of claim metadata, at most seven rows, including actual start/end and scheduled timestamps.
- At most fifteen recent attempt summaries, with an explicit truncation flag when a sixteenth row exists. Bounds use Europe/London calendar midnights rather than fixed UTC offsets.
- Unresolved claims as well as unresolved sync attempts. Either now sets `retryBlocked=true`; a completed source journal cannot hide an unconfirmed claim.

Only allowlisted dates, states, source result codes and timestamps leave the diagnostic. No IDs, payloads, customer data, provider responses, credentials or raw database errors are emitted. The output explicitly reports `hostReceiptCorrelation=not_assessed`. No claim, attempt, provider mutation or financial review is created.

The helper `experiments/shopify/nightly-recent-history.mjs` must be deployed alongside the updated diagnostic. This package does not itself publish the separate Replit worker or change its schedule. Existing worker import smoke checks load the diagnostic and therefore detect a missing helper.

## Exact live acceptance sequence

1. In the existing separate Replit staging Shopify worker, inspect Publishing → Schedule/Logs for the genuine 15 October run. Record run identifier, deployed revision, actual UTC start/end, exit status and its sanitized JSON receipt.
2. Run the read-only diagnostic using that worker's existing dedicated intake environment. Do not print environment values or substitute Xero, reporting, bootstrap or administrator credentials if access is missing.
3. Correlate store, exact 14 September–14 October scope and timestamps across host receipt, the 15 October claim and a completed sync attempt. Claims/attempts have no linking foreign key, so report ambiguity instead of asserting a link.
4. Inspect the remaining seven-day metadata for missing claims, unconfirmed/running outcomes, wrong periods or fixed-period replays. A truncated attempt list needs a separately bounded follow-up, not an inference that all dates passed.
5. `recorded_requires_review`, `changed_requires_review` or `replay` can establish candidate collection. Other result codes need explanation; a completed claim alone cannot certify a successful source result.
6. Retain source receipt flags: `financeImported=false`, `coverageCertified=false`, `reviewRequired=true`. Keep dated Settings evidence distinct from host execution proof.

`node experiments/shopify/check-cloud-shopify-source.mjs` is a separate bounded source-read/capacity check using collector credentials. It makes no database import or provider mutation and cannot retrospectively certify overnight execution.

## Writer-to-reader acceptance remains separate

After dedicated writer setup and reviewed activation, a confirmed Shopify development test order must be observed through its own provider receipt, the next genuine eligible scheduled collection, persisted candidate metadata and the application's dated collection status. It must remain `test=true` and contribute no merchant revenue. The accepted isolated synthetic financial fixture continues to test dashboard arithmetic; provider test orders must not silently populate that revenue baseline.

Original writer windows 12 and 13 October have passed. Remaining original windows are 17, 19, 20 and 24 October at 18:00–18:14 Europe/London, without catch-up or extension. Writers remain disabled until dedicated resources and live provider target checks pass. This read-diagnostic package neither activates them nor verifies their credentials.

## Local evidence

Focused checks cover read-only metadata bounds, London-midnight SQL behavior on disposable PostgreSQL, timestamp/scope validation, private-field exclusion, truncation, and unconfirmed-claim retry blocking. Local fixtures are not receipts from the hosted worker. Live scheduled correlation remains outstanding until the sequence above is completed.
