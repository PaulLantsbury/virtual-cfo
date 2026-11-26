# Proposed Meta Ads daily collector

Prepared code and schedule guidance only. No Render service, secret, database role, SQL change or cron schedule was created or activated.

Command:

```sh
node deployments/nightly-staging/run-meta-ads-daily.mjs
```

Proposed Render UTC schedule: `10 16 * * *`. This runs after the previous local day has completed across the account timezones likely to be used, while the collector itself clips every request to the account's last completed local day. Each active account is read for a rolling 31 completed local days so provider corrections can be recorded as a new observation run.

The CLI and collector runtime are inert unless both `NIGHT_SCOUT_META_ADS_COLLECTOR_RUNTIME_ENABLED=true` and `NIGHT_SCOUT_META_ADS_COLLECTOR_ENABLED=true`. The runtime must also be fully configured for staging: fixed staging project reference, direct PostgreSQL URL for the dedicated collector login, pinned staging CA, envelope master key and key version, and approved Meta API version. It does not use the API app secret, OAuth identity, or owner ID.

The scheduled role must be separate from both the OAuth/API and reporting roles. Before enabling the job, review and apply the base schema, API/collector RPC, and report RPC proposals through the normal staging process; provision and verify all three restricted logins and their complete database ACLs; configure secrets; and ensure outbound telemetry redacts OAuth query strings. Confirm Meta's app access requirements before allowing customer connections.

The job also invokes the fixed cleanup RPC for abandoned account selections and consumed/expired OAuth state. Its receipt contains counts and safe states only; it omits account IDs, tokens, provider responses, and database details. A terminally failed collection needs a fresh retry ordinal for the same account/range/day, supplied as `NIGHT_SCOUT_META_ADS_RETRY_ORDINAL`; leave the default at `0` for normal scheduled runs. An expired running lease is reclaimed automatically under its existing idempotency key.

For a one-off historical comparison, use the separate `run-meta-ads-acceptance.mjs` described in the staging setup guide. It is not a cron command and requires its own explicit enable flag, fixed store ID and bounded completed date range.

The schedule must remain off until staging setup and a bounded server-side read have been reviewed and accepted. Do not use this command as a readiness probe while the collector feature flags are enabled; it is a real provider collection entry point.
