# Private operator sync — 17 September 2026

Paul approved the next package using multiple agents. Three agents implemented the controller, private screen and independent HTTP checks; coordinator integrated the launcher, staging walkthrough and documentation. This is the operator slice. It does not add a merchant connection panel or a scheduler.

## What is implemented

A standalone loopback-only screen shows the fixed development store and reporting dates, a read-only snapshot of the latest candidate, source order/refund/exclusion counts, and the outcome of the most recent manual collection in the running process. It reuses the existing restricted staging intake and inspector. Opening or refreshing the page does not collect Shopify data. **Sync once** explicitly runs the existing bounded source collection and candidate recorder.

Only one collection can run at a time in this process. Duplicate clicks do not queue work. Uncertain outcomes block further runs in that process; inspection does not turn uncertainty into success or silently retry. Source refusal and unchanged replay remain explicit outcomes. Graceful shutdown waits for an accepted collection. A forced process or machine stop remains an uncertain-outcome recovery case.

Candidate history is persisted in the existing database. Attempt history is **process-local**, disappears on restart and is not presented as a durable last-successful-sync record. The operator must inspect/reconcile after an uncertain exit before restarting collection. Financial import/completeness is not assessed by this tool; no financial approval is performed. Test orders remain excluded.

## Access boundary

The server binds only to 127.0.0.1, with exact Host/Origin checks, no CORS, a random per-process capability, strict empty manual-action requests, safe output allowlists and a restrictive content policy. The capability is supplied in a URL fragment and removed from the address bar. The launcher writes it to an exclusive owner-only private access file, never logs it, and removes its own file on orderly close. Refreshing/reopening the page requires that private link again. Credentials remain in existing ignored configuration and never reach the browser.

This does not grant any human membership or reviewer access to the Shopify development store. The existing merchant application remains separate. Merchant status requires a concrete store-scoped access design; persistent run history requires a tested schema/access proposal. Neither is deployed by this package. No public hosting, production, Replit or main-branch change.

## Verification

25 controller/launcher/existing runtime-inspector checks passed. Nine HTTP server and real-controller integration checks passed: unauthorised/cross-site/host-spoofed requests, arbitrary-target inputs, overlap, uncertainty, safe output, explicit source refusal and orderly shutdown. Callbacks in these HTTP tests are synthetic. An independent reviewer found the shutdown race, which was fixed and regression-tested.

Live staging walkthrough used the existing restricted configuration for 17 September. The new screen read two retained versions, one source order, two source refunds, one TEST_ORDER exclusion and zero mapped financial events. Pressed Sync once at 15:03:06 UTC; completion at 15:03:07 UTC returned unchanged replay with no new candidate. Manual status refresh preserved needs-recheck and all counts. No new financial import, source transaction, schema or permission change. The local screen was visually checked and left open. These observations do not certify financial completeness or broader remote-disconnect recovery.

## Running locally

With the existing restricted private staging configuration and trusted certificate:

```sh
NODE_EXTRA_CA_CERTS=.local/staging-root.crt node experiments/shopify/start-operator-sync.mjs --config .local/intake-staging.json --access-file .local/operator-sync-access.txt --port 5190
```

Open the link from the owner-only access file. Never commit, share or copy that link into documentation. The reporting dates come from the private approved configuration; the browser cannot change the target or period. There is no automatic date rollover or scheduler. Startup performs read-only configuration/permission checks, not a new Shopify authentication check.

Checks:

```sh
node --test experiments/shopify/operator-sync-*.test.mjs experiments/shopify/start-operator-sync.test.mjs experiments/shopify/intake-runtime.test.mjs experiments/shopify/inspect-development-intake.test.mjs experiments/shopify/run-development-intake.test.mjs
```

The HTTP checks need permission to bind temporary loopback ports. No new dependencies are introduced.
