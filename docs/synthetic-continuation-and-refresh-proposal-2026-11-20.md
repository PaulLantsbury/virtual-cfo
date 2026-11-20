# Synthetic continuation and summary-refresh proposal — 20 November 2026

## Status

**Prepared and locally verified only.** The deterministic continuation is future-dated synthetic test material. Nothing was added to the hosted synthetic company, database, daily financial feed, reader grants, worker schedule, credentials, or provider accounts.

The requested cloud source baseline is `02858054d5b112b3f1bba15af3054530c9eaf069`; this package is being prepared on a separate development branch from that commit. The existing financial worker/runtime remains a separate branch and stays pinned. The saved-environment launch request has no confirmed task ID; this report describes the selected cloud task only.

## Candidate continuation

`experiments/synthetic-company/continuation-proposal.mjs` materialises the existing immutable `uk-gifts-v2` profile in memory, pinned to the original `2024-11-01` opening anchor. It emits a proposal for **20 December 2026–19 March 2027 inclusive**: 90 daily dates and 10,947 fictional ledger events for `fictional-uk-gifts`, £750,000 annual net turnover, four employees, GBP and Europe/London. The dates are explicitly candidate future activity, not observed or published financial receipts.

| Check | Result |
| --- | --- |
| Candidate days | 90, exactly once each |
| Candidate ledger events | 10,947 |
| Candidate daily hash | `1cf5ec6dd9c128fe4209642637d56df049505cb31421fdc9e14592ec3f54e5a8` |
| Candidate event hash | `28d60972176cd93255eeea7cf2acb593ccd3dcd3d88af80e4fd7143304c37d29` |
| Deterministic protected prefix through 19 November | 749 daily rows; 95,338 events |
| Prefix daily/event hashes | `164a189f01a1913ec192533ee1aa5de553cdaaee3e583810f749d3884e559a3c` / `47112998f85c7edfa532bf46d7c796d3e5e2dc9e0555d7f47b508590c620d570` |

The prefix hashes are local generator fingerprints. They are **not** a hosted readback or a claim that the existing database was compared in this task. A future continuation release must compare source-generated results with the exact current private baseline first. Existing records are append-only; changed IDs or changed values must fail closed. The 24 original financial seals and the separately published 48 Cash/Acquisition summaries remain protected.

## Closed-month Cash and Acquisition summaries

The already completed historical publication covers Cash and Acquisition summaries for November 2024–October 2026 (48 rows). Do not recreate it. `summary-refresh-proposal.mjs` accepts only the exact 48-row month/kind key inventory and outputs eligibility; it does not compile, connect, write, invalidate, or update.

At the 20 November checkpoint, November 2026 is still open, so no new summary month is eligible. A refresh may be considered one month at a time after:

1. A genuine scheduled financial-feed receipt is independently observed and read back for every day in the closed London month. A manual append/retry is not evidence of scheduled operation.
2. The exact supported monthly financial version, sales revision, cost revision and source coverage are validated.
3. The offline Cash and Acquisition compiler is run with that month's exact financial evidence. The output is reviewed, hashed, rehearsed in disposable Postgres, and checked against existing row keys.
4. The existing publisher's exact preflight/postflight is used only for a new key or byte-equivalent replay. Corrections, invalidation, replacement, access, and scheduler changes require separate reviewed packages.

The next new month is November 2026. When the real monthly evidence exists, November may be compiled after its close and scheduled receipt are verified. December 2026 through February 2027 can be considered after each month has closed and all receipts are checked. March 2027 is partial through 19 March in this proposal; **do not publish a closed-month summary for it**. The programme adds no catch-up, extension, credential renewal, access expiry, scheduler change, or remote publication.

## Remaining Marketing and customer measures

The supported synthetic acquisition source now carries privacy-safe month aggregates for distinct identified customers, unique customers with at least one repeat order, and identified orders. Purchase frequency is derived in the browser from those integer counts. Raw synthetic IDs remain in the offline proof source and are not returned in the monthly payload or page. Guest and unknown identities stay separate.

The page labels these counts **Synthetic identity · selected month**. They are a fictional source rehearsal, not Shopify or merchant customer evidence, a retention probability, a customer lifetime value, or future repeat revenue. No prior-period customer series is substituted. Second-purchase timing and mature customer probabilities remain unavailable pending an explicitly reviewed observation window and genuine merchant source. Multi-month CAC and session comparisons remain unavailable because those source windows are not present in the reviewed monthly payload. No provider permission, query, transaction, or credentials were used.

## Verification

- `experiments/synthetic-company/continuation-proposal.test.mjs`: exact dates/profile, deterministic candidate hashes, protected prefix and scope refusals.
- `experiments/synthetic-company/summary-refresh-proposal.test.mjs`: exact 48-row protection, open-month block, closed-month and verified receipt gates, duplicate/altered inventory refusal.
- `experiments/synthetic-company/acquisition-source.test.mjs`: order/customer aggregate lineage, privacy projection, integer-only payload and malformed-source rejection.
- New Marketing frontend typecheck is run with the exact release package checks.

This proposal does not change the already published November 2024–October 2026 summary history or claim an attended/scheduled feed receipt.
