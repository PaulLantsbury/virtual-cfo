# Local nightly status read model — 18 September 2026

Status: executable local-only preparation. It does not read a database, contact Shopify, run a scheduler, create a claim, or certify financial coverage.

`experiments/shopify/nightly-status-read-model.mjs` turns explicitly supplied durable claim/attempt evidence into a small, safe status object. It applies the approved rolling window of 31 completed London calendar dates and the existing 02:00–02:15 local startup policy.

The model distinguishes:

- `scheduled_not_due` and `scheduled_window_open`;
- `completed_requires_review`, which remains non-financial and non-certified;
- `run_in_progress` and `run_unconfirmed`, which must never be retried automatically;
- `missing_run_requires_review` after the startup window with no durable claim;
- unavailable or scope-mismatched durable history, which fail safe and require review.

Each result states `financeImported: false`, `coverageCertified: false`, and `retryPermitted: false`. It is intentionally unable to conceal missing history, treat a changed reporting scope as the same run, or create a catch-up collection. The next implementation step can inject a member-authorised, scope-bound database reader and render the returned state in Settings. That requires separate live/staging authorisation and must preserve the existing fixed-date worker until an activation package is approved.
