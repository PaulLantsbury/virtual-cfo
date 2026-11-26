# Independent Meta display and release review — 26 November 2026

Source-review verdict: no blocking consumer-source finding in the default-off read-only display delta. Final candidate identity and validation receipts must accompany this review. This review does not authorize enabling the flag, mounting a hosted release, producer changes or publication.

## Scope and preservation

Base is local consumer candidate `2a557ea`, itself on website `28853bb8567a503f7847f0e028f9e6277b2b384a` and actual cleanup `204226d0c796561d5bb812cde1bd9cec8da6a8d5`. Reviewed additions are the saved-report reader/controller, auth-bound hook and explicit-load panel. Existing renderer is exported for reuse; the only Marketing change is import plus a conditional section requiring both non-sample mode and `VITE_META_SAVED_SPEND_DISPLAY === 'true'`. Unset/false values do not mount the panel, obtain a session for this reader or make report calls. No flag/configuration was enabled by review.

Financial formulas, Scout, selectors, original/reference pages, saved plans and existing reporting remain unchanged. No API/provider runtime, SQL, grant, data, scheduler or feed file is part of this delta. Integration's producer remains a separate package.

## Read boundary and source identity

The reader requests only `/api/meta-ads/spend` on the same origin with GET, exact selected store and user-entered inclusive dates, `cache: no-store`, `redirect: error`, abort signal and a current same-user session bearer token. It does not invoke Meta, OAuth, reconnect, collection, writes or provider retry. There is no automatic initial request, background refresh or retry loop. Date fields start empty, avoiding a guessed account timezone or reporting range; valid explicit periods are capped at 93 days.

The response is a bootstrap of the server's latest authorized selected account/connection/version. Known request store/from/to must match the response before the strict wire adapter accepts it. The returned lineage is not independently preselected by the browser; copy correctly discloses that fact. The snapshot token is a coherence token, not authorization proof or a durable database revision. The server remains responsible for membership, coherent latest selection, account metadata and evidence. This is not a new account selector or financial evidence-version selector.

Expired Meta access is not used to disable the read. Eligible saved history can remain visible with reconnect and unknown-freshness labels. Invalid/not-connected/revoked/superseded/mismatched reports fail closed. Account currency/timezone and original timestamps come from the strict accepted wire; no GBP/UTC default or refreshed observation date is invented. Platform spend remains separate from CAC, ROAS, contribution and forecasts.

## Late responses and view clearing

Each load immediately removes old display state, aborts its predecessor and increments a request sequence. Completion checks both sequence and abort state before publishing; cleared or superseded requests cannot resurrect old rows. There is no persistent or React Query cache for this reader.

The hook binds state to user, store, auth revision and both dates. A changed/unready auth scope hides old state during render, before layout-effect cancellation. Date-input changes explicitly clear the controller before changing dates. Scope changes and unmount clear/abort, and the existing AuthProvider already clears access on auth and visibility revalidation. A new load after a denied/disconnected result cannot retain an earlier accepted amount. This establishes a read snapshot, not continuous knowledge of a remote revocation that has not reached any auth/report check; there is no invented polling or provider status subscription.

## Reviewed source pins

SHA-256, paths relative to `artifacts/virtual-cfo/src`:

| Path | SHA-256 |
| --- | --- |
| `lib/metaSpendDisplay.ts` | `6fc815c477d16dd057993a70d42a01f0b965eaa1851b6cbf5a73aa7c6ec1b9a5` |
| `lib/useMetaSavedSpend.ts` | `aac8f44d9b9943b8c657300258aa5d0b62b24e908855bf39cf0108da8838dd9e` |
| `components/MetaReadOnlySpendPanel.tsx` | `826b93a31f06b7b1ab6ae5e388831dcef803f47f81f3e4b38799dd47e9e5779d` |
| `components/MetaSavedHistory.tsx` | `61800f856cdf9bcc162cfea5efb3ace383482c2c0c3ac10d3ffca742a1d4c21a` |
| `pages/new-marketing.tsx` | `c8a0392050fbeecf63ca0b6af2aee57d07fb76e54fc831f6892580976a0a8cc6` |

## Publication preparation independently verified

The final hook includes an explicit `return undefined` for unauthorized/invalid load attempts to satisfy full-workspace return typing. This preserves the prior no-request behavior; its final hash is recorded above and supersedes the initial hook hash.

The final panel also vertically separates date labels from inputs and bounds/pads their controls. This scoped visual correction changes no request/selection behavior; the panel hash above supersedes its initial unstyled-input hash. Fresh final browser/build receipts must apply to this correction.

Frozen website-only candidate `28853bb` has direct parent `204226d` and tree `8f1c79025068dc8eed52f4b752c7ca26457558dd`; its 25-file delta contains 20 website/test and five scoped documentation files, with no deletions or provider/data edits. The canonical local transfer package is in `work/website-release-20261126-evidence/website-publication-manifest.json` with adjacent bundle and patch. Independently checked manifest sizes/hashes, bundle prerequisite/ref and applied the patch to cleanup using a disposable temporary index: reconstructed tree exactly matches `8f1c79025068dc8eed52f4b752c7ca26457558dd`. No working checkout or remote changed.

Requested website publication destination remains `PaulLantsbury/virtual-cfo`, `refs/heads/codex/website-release-20261126`, exact `28853bb8567a503f7847f0e028f9e6277b2b384a`. **Updated authority:** PM relayed Paul's explicit approval for that exact source publication, superseding the earlier automatic-review branch-scope rejection. The coordinator's publication-status receipt records HTTPS failure due to unavailable Git authentication and SSH failure under existing strict host verification. No credentials, keys or trust settings were changed. Read-only remote inspection found no new branch. Current blocker is authenticated Git transport, not owner approval. The verified bundle can be used from an already authenticated environment for the approved exact publication. The Meta follow-on is excluded from that website-only action. Any combined future source must preserve true public ancestry and receive combined validation. No deployment, activation or provider authority follows from source-publication approval.

## Final validation checkpoint

Producer follow-up independently inspected: the new real-ancestry producer candidate is application `74ce7893eb60dac8549043355ef6f287d31b2c10`, documentation `8472f2182bc33aab1552a0ab49aae0ec2f505948`, in `work/night-scout-provider-public-candidate-20261126`. Its executable contract hash is `d4105763bb861616e4c6836fc25bc61662e851572d7c6800f17af4905fcdee86`, declaration `e4b0b1d3bd46a27ede3195c753bda9bada2eaa92804eec2482691995bd18c08e`; both freshly matched. The producer now uses direct connection-state equality, strict timestamp calendar/time/offset bounds, descriptor-checked plain records and dense day arrays. The previously reported coercion/24:00 producer source gaps are resolved in this new exact source, superseding the older producer pins. Wire shape and unknown-only freshness remain unchanged. Shared-fixture agreement must use these new hashes; this source inspection does not certify hosted installation or combined runtime deployment.

Independently inspected final post-layout full workspace build success, 13/13 actual-source/controller checks, 1/1 actual-page default-off browser case and 7/7 opt-in browser cases. Final producer agreement receipt also passes **6/6**, including current/expired/disconnected/all-unknown fixtures, noncoercing enum rejection and malformed timestamp rejection against the new pinned strict module. These separate scopes are not an aggregate end-to-end total. The initial sample-mode selector timeout was corrected in the test; its historical failure receipt remains separate from the completed final rerun. Refreshed 390px screenshot inspection confirms readable, contained date fields/button, expired-access and unknown-freshness copy; saved-history/unknown-day/subtotal and source-version disclosure remain explicit and the evidence table scrolls inside its container. Fixture UI banners are disposable, not deployed content. Final tested path hashes in the validation report match this review. Source preparation is complete with no remaining review blocker; hosted activation, real source acceptance and exact-source publication retain their stated separate gates.
