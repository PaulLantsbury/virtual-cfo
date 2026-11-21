# Prepared Render Shopify reader cutover

Source and local tests only; no new service, spend, schedule, secret, database change or provider call is authorised or performed by this package. Existing Replit collector is unchanged. The approved Render **writer** service is a different resource and must never host this reader's credentials.

## Prepared command and semantics

Proposed headless cron command:

```sh
node deployments/nightly-staging/render-shopify-daily.mjs
```

Proposed UTC expression: `0 1,2 * * *`. The executable takes its actual clock, admits only 02:00–02:14:59 Europe/London, and skips the other candidate **before importing the collector**. It accepts no clock arguments. Generation/writer modules are never imported. Missing/non-true `NIGHT_SCOUT_CLOUD_ENABLED` returns disabled before collector import. Enabled runs require `NIGHT_SCOUT_REPORT_SCOPE=rolling-31-completed-days` with fixed date variables absent.

The wrapper calls the existing `runCloudNightly` with tick and exact project/store acknowledgment. That existing collector still owns restricted login/target/TLS validation, private temporary config, five-minute child timeout, rolling scope and sanitized output; the existing child owns real-time admission and durable once-per-local-date claims. No lock, retry, catch-up or financial coverage decision is added here. An admitted dispatch can fail and is not a success receipt.

## Hosting preparation still needed

Use source repository PaulLantsbury/virtual-cfo, development branch codex/restart-baseline, Node24 and the committed pnpm lock. Review a dedicated frozen dependency packaging/build step before creating the service. `prepare-export.mjs`, Replit artifact stripping and the existing Replit smoke command are not directly usable as a Render build contract; they deliberately inspect Replit artifact metadata. This package provides **no unverified one-click blueprint**.

The proposed reader host needs only the existing reader contract: staging project reference, dedicated intake database URL, Shopify **reader** app client ID/secret, trusted CA PEM, enabled flag and rolling policy. Keep all writer app secrets, writer database login, Xero keys and customer frontend variables absent. Provision privately; never export secrets into source/logs or borrow an administrator credential. Check actual hosting cost against a separately approved budget before service creation. The writer's US$5 approval does not approve a second paid service.

## Reviewed cutover sequence

1. Prepare/verify frozen build closure and import smoke; record revision. Create replacement only after its concrete service/cost approval. Keep enabled false and no active collecting schedule while configuring secrets.
2. Run existing `node experiments/shopify/cloud-nightly.mjs --check` through the replacement's dedicated environment; retain safe readiness result. It may access the staging database read-only when enabled, so use the authorised readiness workflow. Do not use tick/Trigger Run as a readiness command.
3. Record old Replit service identity, exact command/schedule/timezone, last host receipt, durable claims and unresolved attempts. Preserve the existing rollback details privately, without credential values.
4. Before a future window, disable the old schedule and confirm no in-flight/uncertain job. Then enable the replacement's exact reviewed command/schedule; do not intentionally overlap schedules. The durable guard remains defence in depth, not a migration strategy.
5. At the next real 02:00 London run correlate replacement host ID/revision/start/exit, safe receipt and durable claim/attempt metadata. Verify exact trailing 31 completed days, candidate result and test exclusion. Retain `financeImported=false`, `coverageCertified=false`, `reviewRequired=true`. The non-admitted UTC candidate should safely skip.
6. Confirm the old schedule remains disabled and no other Replit dependency remains before advising subscription cancellation. If a replacement result is uncertain, inspect durable records first; do not automatically re-enable the old schedule or clear claims. Rollback changes scheduler ownership, never resets history.

## Local verification

```sh
node --test deployments/nightly-staging/render-shopify-gate.test.mjs experiments/shopify/cloud-nightly.test.mjs experiments/shopify/nightly-plan.test.mjs
```

15 October: 17 tests passed (5 new wrapper tests plus 12 existing collector/window tests). Includes BST/GMT boundary, both DST changes, disabled/import avoidance, rolling-mode refusal, exact delegation and error propagation. Tests use synthetic clock/collector dependencies; the actual CLI does not. No frozen-host build, live read, real scheduled cutover or provider reliability is claimed.
