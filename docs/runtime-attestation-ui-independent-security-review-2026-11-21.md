# Temporary runtime diagnostic UI — independent security review

21 November 2026. Isolated source candidate based on `f978784`. No deployment, live UI/browser session, hosted invocation, permission/configuration change or source publication belongs to this review.

## Acceptance scope

The diagnostic must remain separate from preparing/restoring financial evidence. It may only call the existing protected preparation endpoint with the exact diagnostic body; it must never submit restoration, alter business records, invalidate reporting caches or infer that a matching runtime fact establishes complete/healthy financial data.

Server reviewer assignment plus current membership remains authoritative. A visible button, signed-in client session or ordinary store membership is not reviewer permission. The browser uses normal internal Auth session retrieval; no token copying, extraction instructions or token text is rendered. Fixed unavailable/denied messages must not imply that a rejected/disabled response is configured or successful.

The starting library/release defaults were off. The final coordinator-frozen candidate explicitly enables both UI and API source flags; it must use the unchanged 16:00–18:00 UTC 21 November window, including exact-expiry rejection, and not invent a later window or override the server's five-minute/process-local single-use policy. A synthetic fixture can explicitly render the standalone control as enabled; that is not the deployed page state or an activation decision.

Responses need a strict primitive contract/state/revision/boolean projection. Poisoned extra fields or nested/coerced state values must never reach UI text. Aborted, expired, changed-store/period/user or unmounted requests must not install a stale result or a false success message. Cancellation and diagnostic failure leave the normal review workflow separate.

## Final source and browser receipt

Frozen source: `d12a6ab38f9d78a9317464a609cf56100ca5abc2`; tree `4f46d8ca23f7ae06be0c57b6a908458cdf342de1`. Both source release flags are true in this local candidate. The original 16:00–18:00 UTC 21 November window is unchanged; no later window, configuration secret or hosted enablement is implied.

Final sequential browser run: **28/28 passed**, zero failures/skips/cancellations, about 34.33 seconds. This comprises **19 existing financial-review cases** (including generated date cases) and **9 new independent diagnostic UI cases**. No page errors occurred.

Enabled cases load the actual enabled candidate release export unchanged. One explicit off fixture overrides only that local browser module export to false to verify absent-control behaviour; it does not describe the final enabled source state. All cases use fresh isolated Chrome contexts, a loopback Vite preview, a simulated 17:00 browser clock and fictional Auth/API replies; every non-preview external request is mocked or blocked. No real browser profile, token extraction, server authorization, hosted target or runtime invocation is used.

The nine independent cases cover: off-control normal prepare/explicit restore; diagnostic-only exact preparation body and preserved review packet; fixed 403 denial without confirmed facts; pending period-change abort; pending company-change abort; cancellation and source expiry without automatic retry; poisoned nested-state rejection; shared-busy suppression of ordinary review/restore actions until explicit restoration; and removal of success text/checks/revision when a fully confirmed observation expires. Diagnostic actions never invoke restore or change the financial review packet by themselves.

The first combined parallel attempt was interrupted after a fixture-run stall. An isolated legacy case passed, and a clean serial run passed all 28; no product regression was reproduced. A separate test-only assertion incorrectly assumed one release-module fetch despite eager login/page imports; that assertion was removed without weakening the functional checks. The final receipt above is the completed sequential run against the frozen enabled source.

## Source findings resolved

The implementation separates normal financial review and diagnostic state, coordinates busy controls, keys results by user/store/period, aborts old work and maintains a page-session dispatch latch. Scope changes do not rearm a dispatched attempt. The server's own assignment/membership, expiry and process-local consumption remain authoritative; the browser latch is not durable/global permission.

A concrete expiry presentation defect was corrected during review: previously the checklist disappeared after expiry but the old success message could remain. Status now explicitly says the temporary check expired and the old observation is no longer current confirmation. The new success-to-expiry browser case verifies hidden checks/revision, no old success text, disabled button and no extra request. Unavailable results hide their checklist; any false observed check yields an explicit needs-attention message. These statements do not establish source-data completeness or permission to change configuration.

## Synthetic screenshot

Local output: `/private/tmp/night-scout-runtime-diagnostic-fixture.png`. It is visibly labelled **DISPOSABLE SYNTHETIC UI FIXTURE — NOT LIVE**, contains fictional revision/check facts, and includes no bearer, raw UUID, private role row or connection string. The example deliberately leaves the project check unconfirmed, with the qualified needs-attention status. It is a visual review artifact, not a hosted attestation receipt. Do not treat its Confirmed labels as observations of the real service.

## Reproduce locally

With the existing locked dependencies, fake Supabase URL/key and a loopback-only Vite preview, use the existing browser test environment variables for the bundled Playwright module, Chrome executable and preview URL:

```sh
node --experimental-strip-types --test --test-concurrency=1 --test-timeout=20000 \
  artifacts/virtual-cfo/tests/review-browser.mjs \
  artifacts/virtual-cfo/tests/runtime-attestation-ui-independent-browser.mjs
```

The completed tests closed their browser contexts; the review's local Vite process was stopped after the final run. These browser counts overlap normal-workflow coverage elsewhere and are separate from source/unit/build receipts. No deployment, hosted authorization proof or public publication was performed by this reviewer.
