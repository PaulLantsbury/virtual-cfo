# Integration acceptance — 15 October 2026

Repository-evidence review only. This checklist creates no service, migration, credential, collection, provider action or new live verification. Later dated operational receipts supersede this snapshot. The main Night Scout customer app and provider collectors must remain read-only; development writers use separate apps, restricted credentials and hosts.

## Observed checkpoints recorded in the repository

| Stream | Recorded observation | What is still unproved |
| --- | --- | --- |
| Xero reader | Supported 1–14 October GBP accounting collection; existing Render cron `crn-darap1qd0e5s73e1dcn0` saved with `0 1,2 * * *` and `node deployments/nightly-staging/run-xero-daily-cron.mjs` after explicit approval | First genuine scheduled collection; sustained unattended renewal; customer reconnect and financial UI acceptance |
| Shopify reader | Saved 15 October collection: `completed/recorded_requires_review`, 14 September–14 October GBP, started `2026-10-15T01:00:18.529323Z`, zero unresolved attempts/claims at inspection | Independently retained host receipt/revision correlation; coverage certification; migration away from Replit |
| Shopify writer | Separate writer app installed on PocketLaunchpad1; separate Render cron `crn-db8g0n8u01pc7383j2d0`, smallest plan; build and disabled smoke passed at 16:35:24 UTC with `prepared-disabled`, actions 4 | Secure credentials, restricted database readiness/binding, actual API scope/target proof, activation, confirmed order and next reader exclusion |
| Xero writer | Isolated source/proposals exist | Separate operator hosting/consent, actual GBP Demo Company and reader-tenant match, credentials, programme binding and confirmed invoice |

The Shopify writer cron exists but **generation remains disabled**. A successful disabled smoke does not connect to either provider or prove database readiness. Shopify test orders must never become merchant revenue. Neither the Profit Engine sample nor the Cash demo is live financial UI acceptance.

Evidence: [latest operational additions](session-handover-2026-09-17.md), [writer hosting receipt](shopify-writer-hosting-gate-2026-10-15.md), [sprint](restart-sprint.md). Earlier prepared-only app/hosting statements are historical.

## Next genuine overnight reader acceptance

- [ ] **Xero: 16 October, 02:00 London / 01:00 UTC.** Retain actual host run ID, revision, start/end/exit and safe receipt. Verify the supported completed-period scope ends 15 October, with month-boundary behavior as implemented. Correlate persisted job/evidence metadata and retain previous supported evidence if this fails. The 02:00 UTC candidate is outside the London gate on this date and should skip. Do not use Trigger Run, a fake clock or a manual refresh as substitute overnight proof.
- [ ] **Shopify: 16 October, 02:00 London / 01:00 UTC.** Expect trailing 31 completed days **15 September–15 October inclusive**. Correlate host receipt with durable claim/attempt metadata. Claim and attempt have no explicit linking FK: report ambiguous correlation. Retain `financeImported=false`, `coverageCertified=false`, `reviewRequired=true`; candidate collection is not approved financial coverage.
- [ ] Inspect bounded seven-day history for gaps/unconfirmed outcomes before repeating anything. Never clear claims/reservations. A source-only API check cannot retrospectively certify a scheduler run.

Exact Shopify sequence: [read-pipeline acceptance](shopify-read-pipeline-acceptance-2026-10-15.md). Xero clock contract: [daily cron](../deployments/nightly-staging/XERO-DAILY-CRON.md).

## Writer completion gates

- [ ] Inspect installed roles/programmes/actions through `experiments/test-programme/activation-postflight.sql`; do not reinstall or infer live state from a manifest.
- [ ] Establish the dedicated restricted writer database password through an owner-secure workflow, verified TLS and trusted CA; never reuse reader/admin credentials or put secrets in chat/SQL history.
- [ ] Provision private Shopify writer app credentials on the isolated writer service. Mint/verify through existing adapters while disabled; retain only safe fresh API proof of exact development domain, GBP and granted scopes.
- [ ] Review and, with applicable operational approval, apply the **Shopify-only** disabled binding proposal. The older combined daily amendment is not a Shopify prerequisite. No SQL application is evidenced here.
- [ ] Check exact deployed private config, durable remaining capacity and future windows before enablement. Opt-in daily profile permits **15–18 October, 18:00–18:14 London**, one GBP60 nominal test order per eligible date, cap four, original programme identity and 26 October hard stop. Skip elapsed windows; no catch-up, clock changes, new key or cap reset. Source approval of a cadence does not prove it is installed.
- [ ] Confirm first actual provider receipt and durable confirmed action, then the next genuine Shopify reader collection and test exclusion. No payment, email, fulfilment or inventory change.
- [ ] Keep Xero writer independently blocked until actual GBP Demo Company, synthetic contact/account and reader tenant match are verified; never move writer consent back onto the customer app.

Reference: [Shopify daily readiness](../experiments/test-programme/SHOPIFY-DAILY-READINESS.md), [operator deployment](../experiments/test-programme/SHOPIFY-OPERATOR-DEPLOYMENT.md). The older read-pipeline document lists original writer dates; the daily-profile amendment replaces those dates only after its reviewed installation. They are not additive.

## Replit retirement: package and remaining implementation

Existing reader runtime is reusable: `experiments/shopify/cloud-nightly.mjs`; existing host manifest is `deployments/nightly-staging/replit-worker.toml`; `prepare-export.mjs` is specifically a Replit-export helper, **not a ready Render migration**. The subsequent bounded source package now adds `render-shopify-daily.mjs`, its pure admission gate/tests and [cutover specification](../deployments/nightly-staging/render-shopify-reader.md). No dedicated frozen host build, Render reader service or live cutover receipt exists yet.

Prepared in this bounded batch: a real-clock pre-import London wrapper and cutover specification; 17 focused tests passed. Remaining implementation/operational work:

1. A separate Render reader deployment manifest/runbook with frozen dependency closure, disabled default and existing restricted intake credentials only. Keep writer credentials absent. Verify build and import smoke before host activation.
2. A real-clock London admission wrapper, if needed for Render UTC candidates, that skips outside the window before provider/database work. Preserve existing durable once-per-local-date claims, rolling completed-period scope and uncertain-outcome handling. Test BST/GMT and transition dates; never relax the source runner's gate.
3. A cutover checklist retaining the old service ID/config and rollback path: provision/verify the replacement, prevent overlapping schedules, record the last Replit receipt, switch at a future window, verify the replacement's genuine scheduled receipt and durable claim, then confirm the old schedule is disabled. Re-enabling the old host after an uncertain run requires inspecting durable state first.

**Do not cancel Replit yet.** Cancellation follows a verified replacement scheduled run and confirmed retirement of the old job, not just a successful build or disabled check. New service spend/activation requires its own concrete authority; existing writer hosting approval does not automatically cover it.

## Useful local verification targets

The initial documentation review executed no tests. The subsequent minimal Render reader wrapper passed 17 focused tests, as recorded in its cutover specification. Additional focused suites for later changes:

```sh
node --test deployments/nightly-staging/xero-cron-window.test.mjs deployments/nightly-staging/xero-completed-periods.test.mjs
node --test experiments/shopify/cloud-nightly.test.mjs experiments/shopify/nightly-plan.test.mjs experiments/shopify/check-cloud-nightly.test.mjs experiments/shopify/nightly-recent-history.test.mjs
node --test experiments/test-programme/operator-deployment.test.mjs experiments/test-programme/shopify-daily-readiness.test.mjs experiments/test-programme/shopify-daily-binding-db.test.mjs
```

Local passes establish only the tested implementation. Live credentials, provider behavior, scheduled execution, multi-day reliability and customer readiness need their own retained evidence. Customer reconnect SQL/adapter/PKCE preparation remains a separate stream; independent PostgreSQL concurrency and full hosted OAuth integration are still acceptance gates.
