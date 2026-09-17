# Cloud nightly staging plan — 17 September 2026

## Decision and inspection

Paul clarified that overnight execution should be cloud-hosted, independent of either Mac. The earlier local-computer question is withdrawn. Paul subsequently approved preparation, the 15-minute startup allowance and the US$5/month planning budget. Final deployment remains inactive pending the concrete cloud configuration and approval.

Read-only Replit inspection found the existing Virtual C F O project publicly published at virtual-c-f-o.replit.app, deployment type Autoscale (2 vCPU / 4 GiB, maximum three instances), with an older publication shown. Its visible documentation predates current GitHub packages. The repository's .replit configuration also selects Autoscale and references the original Supabase project, not Night Scout Staging. Do not infer that a GitHub upload updates this deployment. No settings, secrets or publication were changed; secret values were not revealed.

## Recommended architecture

Create a separate private Replit project for the staging nightly worker, using a pinned reviewed revision of the existing GitHub development branch. Keep the existing website deployment unchanged. Configure Scheduled deployment with Europe/London timezone and one run each day at 02:00 for the current fixed development store. Scheduled jobs execute a command and stop; they do not expose a public web URL. The Mac is not part of the runtime. Replit supports schedules, timezone, timeout and failure alerts according to its [deployment documentation](https://docs.replit.com/features/publishing/deployment-types).

Reuse the existing Node runner and Supabase durable reservations. This is a separate deployment of existing code, not a second financial database or a rewrite. Future multi-store scheduling is separate work; the current role, schema and launcher deliberately restrict the development store.

## Preparation and activation sequence

1. Prepare a minimal worker manifest/build using the committed lockfile and Node runtime; include runtime imports and pg dependency, not a web server. Do not copy the existing production .replit environment settings. Verify the imported commit/tree matches the recorded GitHub revision.
2. Add a server-only bootstrap that reads deployment secrets, materialises owner-only temporary config/CA files for the existing launcher, cleans them up and never logs credentials. The local launcher expects files; the prepared cloud bootstrap translates the explicit server-only secret contract into temporary owner-only files. See [worker preparation](cloud-worker-preparation-2026-09-17.md). Configure only the restricted staging intake login, Shopify development credentials and trusted TLS CA. Do not copy broad Supabase administrator/service-role secrets or any .local directory wholesale.
3. Verify Replit outbound connectivity to the staging database before selecting direct IPv6 vs compatible Supabase pooler. Preserve certificate verification and transaction/role behaviour. No assumption that the Mac's successful connection proves the cloud route.
4. Apply the already prepared nightly-claims proposal only after concrete schema/grant approval. Staging project is bioalckltvkhlczusdvl; production project is excluded. No automatic financial certification/import or customer-ID scheduling is included.
5. Set the approved source/reporting scope and missed-start policy, then verify disabled/default read-only checks. The current financial window is the fixed 17 September test period (maximum 31 days), not a rolling feed. A supervised cloud trial may use that fixed scope but must be labelled accordingly.
6. Propose a bounded delayed-start allowance, e.g. 02:00–02:15 local, still at most one collection per local day; never retry an uncertain write. Paul subsequently agreed this allowance, and the runner now admits starts from 02:00 inclusive to 02:15 exclusive. Missing an overnight window should surface an alert/stale status; implementation remains required.
7. Review the platform's final configuration/cost and activate only after approval. Run a controlled staging exercise, verify duplicate/restart protection, compare financial fingerprints and observe one real overnight execution with the Mac offline. A scheduled job starting alone is not proof of a complete/reconciled trading feed.

## Scope decision still needed

Separate ingestion of available source history from financial reporting periods. Design the rolling evidence/backfill path before claiming prior-period edits and later refunds are handled across the full trading history. Do not silently choose an arbitrary 30-day history cutoff: later events and changes to older orders may matter. This plan recommends a fixed-scope cloud infrastructure trial first while that financial coverage design is completed and tested.

## Cost and controls

On 17 September the authenticated Replit Usage page showed Scheduled compute at **US$3.20 per million compute units** and Scheduled executions at **US$0.033 per day**, approximately **US$0.99 for 30 days plus compute and applicable data transfer**. These are observed rates, not a deployment quote or spending commitment. Run duration, machine resources and billing semantics must be measured/confirmed in the new worker's publishing screen. Subscription credits may offset charges but must not be assumed available or reserved for this worker.

Recommend an initial **US$5/month incremental staging allowance**, agreed by Paul for planning, with platform spending controls still to be confirmed. This is a proposed budget, not an enforced cap or guaranteed bill. Stop/review if measurements project exceeding it. No new subscription, paid project or worker has been created. Do not use the old launch article's pricing as current. The [current billing guide](https://docs.replit.com/billing/deployment-pricing) describes credit-based billing; its text-rendered tariff cells were blank, so the authenticated Usage rates were used. Account balance and private billing details are deliberately excluded from this public document.

## Completion status

Completed: existing deployment inspected; official scheduling capability and current account tariff checked; cloud-only direction recorded; staging isolation, configuration adapter, historical-scope and delayed-start gaps identified. Cloud bootstrap and local tests subsequently prepared; see its package record. Remaining: worker project setup, cloud connectivity check, scoped migration/grants, historical scope decisions, final platform quote/approval, deployment and overnight verification. Production and the existing Replit website remain unchanged.
