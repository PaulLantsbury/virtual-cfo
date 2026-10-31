# Shopify rolling collection — 10–11 October acceptance

## Evidence already recorded

The 11 October signed-in Settings check recorded in the current roadmap shows a successful saved collection at 01:01 UTC for 10 September–10 October. It reports one excluded test order, two refunds and zero financial events. This proves a saved rolling-scope collection; it does not independently establish its scheduled host trigger or the 10 October execution.

The 9 October publication retained the daily 02:00 Europe/London schedule and six-minute host timeout, with `NIGHT_SCOUT_REPORT_SCOPE=rolling-31-completed-days` and fixed date variables retired. Publication is distinct from scheduled execution.

## Exact remaining host evidence

Read the existing Replit staging Shopify worker's Publishing → Schedule/Logs without triggering a run. For each date below record host run identifier, deployed revision, actual UTC start/end, exit outcome and the sanitized nightly JSON receipt. These records have not yet been supplied to this verification package.

| Local execution date | Expected UTC trigger | Expected inclusive reporting dates |
|---|---|---|
| 10 October 2026 | 01:00 UTC | 9 September–9 October |
| 11 October 2026 | 01:00 UTC | 10 September–10 October |

The receipt should identify staging project `bioalckltvkhlczusdvl`, store `56d92f8a-746e-4b4f-b408-81fc98c4aa17`, the expected period, `executionMode=tick`, `state=completed`, and `financeImported=false`. Source outcomes `recorded_requires_review`, `changed_requires_review` or `replay` establish candidate collection; `historical_replay`, `stale_source`, `conflicting_source` or `missing_source` need separate explanation. Retain `coverageCertified=false` and `reviewRequired=true`.

## Existing bounded diagnostics

From a shell already configured with the dedicated Shopify intake login:

```bash
node experiments/shopify/check-cloud-nightly.mjs
```

This validates the target, dedicated role and TLS, then uses a read-only transaction. It inspects today's claim and the latest attempt, unresolved attempt count and exact-current-scope candidate presence. It does not check both weekend dates or authenticate to Shopify. A missing intake configuration is an access limit; do not substitute reporting, Xero, bootstrap or administrator credentials.

The existing source-only diagnostic is separate:

```bash
node experiments/shopify/check-cloud-shopify-source.mjs
```

It needs the existing collector app environment, verifies source access/capacity, and makes no database import or provider mutation. It cannot prove historical scheduled execution.

## Bounded durable weekend correlation

Run through the same validated dedicated intake identity, within `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, `SET LOCAL ROLE night_scout_intake_service`, and `ROLLBACK`:

```sql
SELECT local_date::text, timezone, scheduled_at,
       date_from::text, date_to::text, state, started_at, finished_at
FROM ingest_v1.nightly_claims
WHERE store_id = '56d92f8a-746e-4b4f-b408-81fc98c4aa17'
  AND local_date BETWEEN DATE '2026-10-10' AND DATE '2026-10-11'
ORDER BY local_date;

SELECT date_from::text, date_to::text, state, result_code,
       started_at, finished_at
FROM ingest_v1.sync_attempts
WHERE store_id = '56d92f8a-746e-4b4f-b408-81fc98c4aa17'
  AND started_at >= TIMESTAMPTZ '2026-10-10T00:00:00Z'
  AND started_at < TIMESTAMPTZ '2026-10-12T00:00:00Z'
ORDER BY started_at
LIMIT 8;
```

Claims and attempts have no linking foreign key. Correlate exact store/period/timestamps with the host receipt; preserve ambiguity rather than inferring a link. A completed claim alone does not establish a successful source result. Unexpected running/unconfirmed states block blind retry. Do not click Run Now, fake the clock, clear reservations or recreate missed executions.

## Verification limits

The pure rolling-scope helper was rerun on 11 October for both expected trigger instants and returns exactly the windows above. The earlier focused 21-test package passed the diagnostic, rolling launcher, DST/missed-day and claim/journal/intake consistency checks. Neither local checks nor the recorded saved 11 October collection prove the still-missing host correlation. Shopify test orders remain excluded from merchant revenue; this transport acceptance cannot replace coverage review, cost evidence or financial dashboard acceptance.
