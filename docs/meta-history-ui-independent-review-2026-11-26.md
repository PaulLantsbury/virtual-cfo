# Independent Meta saved-history consumer review — 26 November 2026

## Final adapter review — supersedes preliminary scope and pins below

Final verdict: cleared for separate local, unmounted consumer preparation, now including the actual-wire adapter and `MetaSavedHistoryFromWire` wrapper. No blocking consumer-source defect remains. This is not approval to mount, deploy, alter the producer or access providers. Existing tracked website application source is unchanged.

Final reviewed SHA-256 pins:

| File | SHA-256 |
| --- | --- |
| `artifacts/virtual-cfo/src/lib/metaHistoryPresentation.ts` | `1f0697cf06b39cde0d01d282b259536b49b7d499f76b5d847720a474b2d19405` |
| `artifacts/virtual-cfo/src/lib/metaHistoryWire.ts` | `9ad80194a991f24353dc152cc9501e466c89fc1bae57c06e2ecbec8372ef7702` |
| `artifacts/virtual-cfo/src/components/MetaSavedHistory.tsx` | `53156e21490befa4b23b46dd38b6f766c7ff577e3f73e5dfaf0c4fa29a72a616` |

PM identifies final producer source `870c59fbadfc62c017ce3b988648a02bb80415de` and documentation `fea71fcccdebe7e094d23f28fb57b51cb37ab673`. Independently read the actual `.mjs`, declaration and `META-SPEND-WIRE-2026-11-26.md`; observed `.mjs` SHA-256 `251d65fd8f6aeabeb339399e289ecae430cb043d3677b249abb862402eff0fb9` and declaration SHA-256 `f43d692e19d59bd1e7acebcc3d141dd0b89959bdb493938ac741410743e98ec3` match the tested producer. The original offline proposal and old component pin below are historical, superseded by this final scope.

The adapter validates the exact envelope, UUID store/connection/run identities, account digits, lowercase SHA-256 version syntax, original provenance and authoritative response account metadata. Requested lineage must match every returned binding. Its version is a **snapshot coherence token**, not a durable database revision or proof of authorization. The adapter checks syntax and expected equality, not token derivation or server authority. The future caller must supply trusted membership and authoritative requested selection, withholding cached/late responses while authority is uncertain.

Only current or expired eligible wire contexts pass. `not_connected`, malformed, disconnected, superseded, revoked and mismatched contexts withhold rather than falling back to archived rows. Ordinary expiry preserves exact saved amounts and original observation/run timestamps with reconnect wording. The actual wire permits only `observationFreshness: unknown`; invented current/stale labels are rejected by this adapter. Current access never makes old observations fresh.

Detailed `provider_row`, `no_row`, `partial`, `failed`, `not_collected` coverage and run status/start time remain in `sourceDays` and are displayed by the wrapper. Generic reported/unknown mapping does not erase those source details. Unknown amounts remain null, all-unknown periods are unavailable, and BigInt subtotals are labelled partial when appropriate and explicitly denominated in currency minor units. Rows are complete, ordered and unique for at most 93 days. Neither adapter nor wrapper imports network/storage/provider actions or is mounted in production. Mobile evidence scrolls within its container.

The exact final **producer** still contains `String(v.connectionState)` coercion and a broad timestamp regex/Date.parse that can accept 24:00 rollover. These producer gaps remain unresolved; do not describe them as fixed. Integration should use direct literal validation and explicit calendar/time/offset bounds, then rerun producer/consumer agreement with malformed cases. The final consumer is strict and withholds these malformed values. Four shared valid fixtures are not proof that all producer-accepted inputs are consumer-accepted. No producer files were edited by this reviewer.

Independently inspected final local receipts: **28/28 unit cases, 5/5 desktop/mobile browser cases, 4/4 actual-producer shared fixtures, full workspace build passed**. Receipts are in `work/meta-history-ui-20261126-evidence`. These are separate disposable scopes, not a combined end-to-end count, live isolation or real-provider acceptance. Bundle-size warnings remain nonfatal.

Before mounting, prove coherent server membership/selection/evidence reads, authoritative currency/timezone binding, selection-change and stale/late-response denial at the real boundary. Future integration must apply the reviewed tree delta onto true public website ancestry and test the combined source. Do not merge local archive ancestry or treat this isolated build as validation of that future combination. Earlier publication rejection remains in force; this candidate stays local with no alternate destination retry.

## Preliminary review retained as history

Source-review verdict: cleared for the separate local, unmounted consumer preparation, conditional on final unit/browser/build receipts. This is not approval to mount the consumer, change producer contracts or deploy. The website candidate at `28853bb8567a503f7847f0e028f9e6277b2b384a` remains the base and its existing tracked application source is unchanged.

## Exact review scope

Reviewed additions:

- `artifacts/virtual-cfo/src/lib/metaHistoryPresentation.ts`, SHA-256 `1f0697cf06b39cde0d01d282b259536b49b7d499f76b5d847720a474b2d19405`.
- `artifacts/virtual-cfo/src/components/MetaSavedHistory.tsx`, SHA-256 `b3f412e4ca33ee3a707f57be4f7c34a11324184bfe3d8c5667507a6dd69b1764`.

Read the integration lane's actual `HISTORY-CONTRACT-PROPOSAL-2026-11-26.md` and `experiments/marketing/provider-history-contract-proposal.ts`. The latter's inspected SHA-256 is `43427425b25705d7bcad87fb8c3b595c3f9fe1d35437150715592171904b2a09`; it includes trusted membership authorization and an unavailable outcome when no days contain reported amounts. That producer checkout is mutable: pin the exact reviewed contract for eventual mounting rather than assuming an earlier note describes its current bytes.

No existing tracked source diff was present at review. Neither addition imports networking, storage, provider APIs or production routes. A search found no production mounting/import of the component. Test fixture imports do not mount it in the deployed application.

## Findings and resolved defects

The model requires explicit trusted membership authorization, exact equality of requested/returned/display-context store, account, connection, inclusive period and evidence version, and separately supplied currency/timezone metadata. Only current or expired connection states are eligible; disconnected, superseded, revoked, unknown or malformed states are withheld with no rows/subtotal. Expiry retains the same accepted values and original run/observation timestamps while changing the access label to reconnect required. Evidence freshness remains its independently supplied value; current access never makes stale observations current.

Reported amounts remain integer strings, summed with BigInt without rounding or forced two-decimal conversion. Unknown days remain null. The table names minor units explicitly; the subtotal is qualified by reported-day coverage and is not claimed to be a full-period total when days are unknown. No amount is invented for unavailable periods. Rows must be ordered, complete for the requested period, unique, and at most 93 days. Empty malformed arrays fail closed; a complete all-unknown period is unavailable rather than zero.

Original observations are retained rather than replaced by callback time. Review found that the initial timestamp validator admitted 24:00 rollover and that enum validation coerced objects with String(value). Both are repaired: hours/minutes/seconds and offsets are explicitly bounded, and enums use direct literal equality without coercion. The independent test owner was asked to cover invalid timestamps and ensure object coercion is never invoked.

No remaining blocking source defect was identified. The UI receives an already-authorized exact display context; syntax checks alone cannot establish account currency/timezone authority or membership. This is intentionally documented as a presentation adapter, not an authorization boundary.

## Required producer handoff before mounting

1. Publish a pinned actual response type and validator, with coherent server-authorized membership, selection and evidence reads. Bind durable connection/version identity, not browser-supplied authority, to every response.
2. Supply authoritative currency/timezone tied to the exact selected lineage. Do not infer these from a different connection/account status entry or default to GBP/UTC.
3. Distinguish ordinary expiry from explicit disconnect, supersession and revocation. Expired exact eligible history may remain visible; the other states must withhold. Unknown reasons fail closed. The proposed composer currently has no explicit revoked enum; it must return withheld for revoked authority or deliberately add a reviewed state.
4. Define evidence freshness separately from connectivity and retain original daily values, run IDs and timestamps. Preserve the existing producer's detailed coverage semantics or publish a reviewed lossless mapping to reported/unknown; the proposal's names are not interchangeable with the existing endpoint without an adapter contract.
5. Reconcile the consumer's complete ordered daily-row requirement and 93-day bound with the real producer, including a complete all-unknown result for no reported history. Missing days cannot be silently filled with zero. Prove stale-cache/late-response denial at the eventual authoritative consumer boundary before mounting.

These are scoped implementation requirements for integration/PM, not new financial-policy questions for Paul. API/SQL/provider producer changes remain outside this candidate. No provider request, reconnect, transaction, retry, collection, secret access, live database, scheduler or configuration operation was performed by this review.

PM's runtime envelope differs from this pinned offline proposal and still needs an explicit adapter. This review certifies neither compatibility with that runtime envelope nor a live-source connection; the model/component remains unmounted until the actual producer schema and adapter are independently tested together.

## Publication and acceptance limits

The earlier website publication was rejected by automatic approval review because its new branch was outside the standing named-branch publication authority. This separate follow-on stays local; no alternative publication destination or retry is authorized by this review. Its fixtures establish consumer behavior only, not real-provider data correctness, live access isolation or deployed retention. Final validation receipts must identify the exact candidate and distinguish offline/browser fixtures from hosted acceptance.
