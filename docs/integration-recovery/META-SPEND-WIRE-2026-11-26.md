# Meta saved-spend producer wire — 26 November 2026

Exact executable contract: `experiments/marketing/meta-spend-report-contract.mjs`. The API route and recovered provider client both use its strict parser. The current website does not mount the recovered panel; pages owns the separate consumer/adapter. This wire implements the accepted semantic interface while keeping runtime opt-in off.

Selected-context response retains `status: available`, exact `storeId`, inclusive `from`/`to`, `account: {providerAccountId,currency,timeZone}` and complete calendar `days`. “available” at the outer level means a selected reporting context; it does not imply that every day has spend. Each day retains `date`, `coverageState`, exact decimal-string `spendMinor` or null, `observedAt`, `runId`, `runStatus`, `runStartedAt`. Missing provider rows remain unknown/null.

Additional required fields:

| Field | Contract |
| --- | --- |
| lineage | Exact `{storeId,accountId,connectionId,from,to,version}`; accountId equals account.providerAccountId |
| lineage.version | `sha256:` followed by 64 lowercase hex characters; deterministic digest of selected lineage, selection instant, account metadata, requested period and accepted day evidence. Snapshot coherence token, not a durable database revision or proof of authorization. |
| connectionState | `current` or `expired`; separate from evidence freshness |
| reauthorizationRequired | Exactly true for expired, false for current |
| evidenceAvailability | `available` when at least one day has a provider-row amount (including genuine zero); otherwise `unavailable` |
| observationFreshness | `unknown` in this implementation. No agreed evidence-age threshold exists, so valid credentials or a new callback never certify fresh observations. Show original observation dates and reconnect status. |

No selected eligible lineage returns exactly `{status:not_connected,storeId,from,to,account:null,days:[]}`. This withholds disconnected, revoked, superseded or ineligible latest selections without returning another account's history. Unauthorized membership returns a generic failure, not an alternate account. A newer pending account is not selected and cannot replace an authoritative selection until explicit activation.

The database chooses the authoritative latest selected lineage before status/owner filtering. It rejects ambiguous latest choices instead of guessing. It checks current membership independently of configured staging user/store. Per-day observations join that exact account/connection/store and requested period. The producer binds currency/timezone to the snapshot digest. The client does not invent missing metadata or trust browser-supplied account selection.

Pages should compare the complete lineage to its authoritative display context and retain unknown freshness wording. It must not map outer status alone to complete spend, convert unknown days to zero, fall back across accounts, or add a “fresh” label based on connectionState. No new financial calculation is introduced. Hosted installation and provider access remain separately gated.
