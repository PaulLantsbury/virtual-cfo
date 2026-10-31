# Shopify writer restart — 29 October 2026

This is the source specification and operator sequence. Consult the current private session handover for approval/application/deployment evidence; do not infer live state from this proposal file. Do not reapply completed SQL or repeat an approval already recorded there. Preserve the read-only customer app and collectors. The previous four-day trial expired 18 October, with a 26 October hard stop. Do not enable or amend it, clear actions, catch up missed days or reuse its programme key.

## Bounded programme specification

Separate installed app **Night Scout Test Data Writer**, PocketLaunchpad1 (`pocketlaunchpad1.myshopify.com`) development store only. Propose **29 October–4 November inclusive, 18:00–18:14 Europe/London**, at most **one GBP60 nominal test order/day, seven total (GBP420 nominal / GBP0 charged)**. New immutable identity `shopify-staging-20261029`; hard stop **5 November 00:00 UTC**. No transactions/payment, emails, fulfilment, shipping, tax or inventory changes. Test orders remain excluded from genuine merchant revenue. Elapsed dates are skipped and do not transfer to later days. New disabled config uses `startMonday=2026-10-26` purely as schedule anchor, not permission for 26–28 October. Runtime starts 29 October.

Binding SQL `shopify-daily-binding-proposal-2026-10-29.sql` installs a separate profile-ready RPC and a narrow wrapper around the existing claim function, preserving old function behaviour and records. The old underlying function is revoked from the writer so the new daily gate cannot be bypassed directly. New binding stays disabled and refuses unresolved Shopify claims/active overlapping programmes. Its profile is identified by the exact immutable row and dedicated RPC; any historical `schedule_profile` column is left untouched (the new row uses its existing default). It neither resets old caps nor modifies Xero. Application is a separate reviewed operator action requiring approval.

## Exact setup sequence

1. In verified Night Scout Staging, run **read-only** `shopify-writer-inspection-2026-10-29.sql`. Inspect role capabilities/membership, existing programmes/actions and unresolved counts; do not replay the schema installer. Resolve any uncertain old provider action through reconciliation, never deleting it.
2. Complete the restricted writer password/URL/CA secure steps in `SHOPIFY-SECURE-SETUP.md` if still absent. Use only the separate existing Render cron `crn-db8g0n8u01pc7383j2d0`. Shopify secret was already privately entered and verified on 15 October; recheck rather than rotate or ask for it again. Restricted login `night_scout_test_writer`, SET-only service membership, no inherited/admin capability.
3. Keep generation false. Run `node experiments/test-programme/shopify-source-preflight.mjs` inside the secured hosted operator context for a fresh actual provider receipt. It must be under one hour old when binding. Inspect same-organisation/sole-development-store installation and actual read_orders/write_orders scopes. Never paste secret values into chat or SQL.
4. After explicit programme/binding approval, set `night_scout.shopify_writer_config` and `night_scout.shopify_writer_receipt` session metadata to the exact non-secret current config/actual receipt, then apply the complete binding transaction. No guessed/fabricated receipt. Clear metadata afterwards. Missing, stale, wrong-target or excessive-scope evidence blocks atomically.
5. For the new deployment **only after approval**, build the isolated writer with:

```sh
node experiments/test-programme/prepare-operator-deployment.mjs experiments/test-programme/.operator-runtime daily-20261029-v1
pnpm --dir experiments/test-programme/.operator-runtime install --config.auto-install-peers=false --frozen-lockfile --ignore-workspace --prod --ignore-scripts
```

Existing command remains `node experiments/test-programme/.operator-runtime/shopify-operator-entry.mjs`; private config path remains `.operator-runtime/shopify-programme.json`. The new profile argument is opt-in; the no-argument packager deliberately retains the expired profile rather than silently extending a deployed service.

6. Verify disabled smoke says seven actions and inspect deployed revision/config plus restricted writer connectivity. The metadata helper accepts `scheduleProfile:'daily-20261029-v1'` and returns remaining windows/blockers from current time; receipt presence is not authority. New database receipt flag is `renewedDailyReadinessRpcPresent`.
7. Enable only the specifically approved new row and separate host flag after all checks. Cron **`0 18 * * *` UTC** matches 18:00 London for these dates (GMT). Do not retain the old `0 17 * * *` schedule; it will safely skip outside the window. Pause after the bounded programme and assess usage against the existing initial US$5 budget; no new resource/spend approval is implied.
8. Confirm provider receipt + durable confirmed action + next genuine overnight reader observation with test exclusion. No instant probe/fake clock or manual Run now to manufacture scheduled proof. Missed 18:00 dates are skipped. Order ingestion and real merchant financial reporting are separate acceptance gates.

## Validation limits

PGlite tests exercise SQL atomic rollback, least-privilege RPC access, old-ledger preservation, stale/wrong evidence, one-per-day/cap/window checks and replay refusal. They do not establish hosted credentials, multi-backend PostgreSQL concurrency, live Shopify result shape, schedule activation, actual overnight execution or a populated connected dashboard.
