# Separate Meta consumer contract review — 26 November 2026

Read-only inspection of `work/night-scout-integration-recovery-20261126`; that checkout is actively changing, so this is a scoped observation, not a frozen producer receipt. No current website candidate edits, provider operations or schema changes were made. Integration owns producer/runtime; Pages owns a future separate consumer commit after the actual schema is pinned.

## Finding

The required semantics are clear but the actual producer interface is not ready at this checkpoint. Ordinary credential expiry alone must preserve eligible dated saved spend for exactly the selected company/account/connection/period. Disconnect, supersession, revocation and mismatched selection must withhold; never choose an archived account as fallback. Old observations retain original timestamps and may not be labelled fresh/connected merely because they remain readable.

`experiments/marketing/provider-history-contract-proposal.ts` is an explicitly offline, unimported composition proposal, not the route contract. It defines Lineage `{storeId, accountId, connectionId, from, to, version}`, connection `current|expired|disconnected|superseded`, evidence availability, reauthorizationRequired and observationFreshness. It lacks the explicit revoked state required by this follow-on. Its DayEvidence uses `amountMinor/coverage` rather than the existing endpoint's `spendMinor/coverageState`, and collapses existing detailed coverage states to reported/unknown. Do not silently implement this proposal as if it were the deployed response.

## Existing consumer files and behavior

All paths below are relative to the integration checkout.

| File | Actual behavior / follow-on ownership |
| --- | --- |
| `artifacts/virtual-cfo/src/lib/metaAdsApi.ts` | Status parser exposes connectionId, connected/reauthorization_required/disconnected/revoked state, account/currency/timezone, token expiry and latest run. There is no distinct superseded state or authoritative selected-history envelope. Consumer must not infer selected history by choosing an old array entry. |
| `artifacts/virtual-cfo/src/lib/metaAdsSpendApi.ts` | New untracked client at inspection. Typed result is available/not_connected with storeId/from/to/account/days only. Strict parser binds store and period, but receives no expected account/connection/version and no reauth/freshness. Existing integer-string amounts, coverage/null rules and run timestamps are valuable and should be preserved. |
| `artifacts/virtual-cfo/src/components/MetaDailySpendPanel.tsx` | Finds the first status=connected account; query is disabled otherwise. Query key includes identity/store/auth revision/connection/period. Applied period is reset when active connection disappears. Current render formats response amounts using status-account currency/timezone without comparing the response account to that selected account. These gates must change together with a pinned producer contract, not by simply admitting all expired entries. |
| `artifacts/virtual-cfo/src/components/MetaSpendConnectionStatus.tsx` | Displays Connected only for connected array entries; other states get reconnect messaging. Expiry timestamp is displayed but not itself used to prevent a Connected label. Disconnect invalidates status only; follow-on must ensure the spend view is withheld immediately during invalidation and cannot resurface cached observations. |
| Current mounting | Search of all consumer source found only component declarations, not imports/mounts in Settings, current Marketing or App. Mount location and included consumer source must be deliberately scoped in the separate package, preserving accepted page structure. |

No dedicated spend hook exists: the panel owns its React Query logic. Existing client tests are under `artifacts/api-server/tests/meta-spend-client.test.mjs`; they do not establish the new lifecycle behavior.

## Producer gaps to resolve through integration/PM

- `artifacts/api-server/src/routes/meta-ads-spend-report.ts` accepts only storeId/from/to and its ReportService result is Promise<unknown>. It validates only broad response identity/status before serialization. The producer must publish the actual exported response type and validator, not only the offline example.
- `db-migrations/proposals/meta-ads-spend-read-rpc-2026-11-20.sql` still selects `status='connected' AND token_expires_at>p_now`. Expiry currently hides observations. Changing UI alone cannot satisfy retention.
- Determine authoritative current selection, exact connection identity, account and evidence identity. If the proposed version field is retained, define where its durable value comes from; do not invent a browser version. The endpoint must bind selection coherently with spend reads and reject superseded/revoked/disconnected lineage.
- Explicitly project ordinary expiry separately from revocation, missing permission, supersession and explicit disconnect. `reauthorization_required` alone is insufficient if it can encode multiple causes.
- Keep original daily amount, observation/run identity, currency/timezone and coverage. Use the existing detailed coverage states or publish a deliberate lossless mapping. Unknown is null, not zero; subtotal must remain labelled partial when days lack provider values.
- Freshness needs an evidence-defined meaning, independent of credential connectivity. A fresh HTTP response is not a fresh observation. State whether retained history is stale/unknown and how this is derived without changing original observedAt.
- Provide route→service→reader typed fixtures for connected and expired same-selection equivalence, plus no selected account, revoked, superseded, disconnected, cross-company/account/connection/period/version and selection-changing-during-read denial. No browser-supplied lineage is authority.

## Consumer implementation after schema pin

Use authoritative selected-history metadata and validate every returned binding against the requested/current selection. Preserve the applied period across expiry of that same eligible selection; clear it and accepted display data across actual selection/user/company changes. Query keys must include every evidence-selection identity returned by the final contract. While identity/status is unverified, withhold cached figures; never preserve a display by weakening membership clearing.

Render retained dates and original observation/run information with clear reconnect/stale wording. A safe message is: “Meta access expired. Saved spend for this account and period remains available; reconnect to collect new observations.” Display it only when the producer confirms ordinary expiry and eligible evidence. No callback/reconnect time substitutes for an observation. Never automatically collect, retry provider reads or resurrect an archived connection to fill a gap.

Recheck response account/currency/timezone against authoritative selected metadata before formatting. Disconnect/revoke/supersede transitions must promptly withhold prior spend even if a stale cache or late request resolves. Expiry alone must not clear an applied historical period or suppress otherwise eligible data.

## Required disposable verification

1. Same selected company/account/connection/period and saved daily records: connected→expired shows identical amounts, coverage, run IDs and timestamps with reconnect status; unknown days stay null. No provider call.
2. Disconnected/revoked/superseded status and late old responses never show historical rows or totals, including navigation away/back and cached query reuse.
3. Cross-company, account, connection, period and evidence mismatch is withheld before formatting; company A→B→A cannot replay stale A evidence without fresh authorization/selection confirmation.
4. Status failure/loading/revalidation withholds stale authorized data. Ordinary read failure does not invent zero or change original observation times.
5. Desktop/mobile shows account-local dates, coverage and explicit saved-history limitations without falsely saying connected/fresh. Settings status and spend panel agree under expiry.

Readiness: consumer implementation awaits one actual pinned producer schema and fixtures, not a new owner product answer. Current website release stays separate. This review did not run tests or certify live behavior.

## Subsequent authorized offline implementation checkpoint

PM explicitly requested a separate offline proposal consumer while integration adapts the real producer. Implemented only `artifacts/virtual-cfo/src/lib/metaHistoryPresentation.ts` and the unmounted `artifacts/virtual-cfo/src/components/MetaSavedHistory.tsx` in `work/night-scout-meta-history-ui-20261126`, based on exact website candidate `28853bb8567a503f7847f0e028f9e6277b2b384a`. Independent tests/review belong to separate owners; this implementation note makes no test-pass claim.

Accepted proposal separation, exact lineage, original observations and unknown handling. Required adjustments are implemented at the consumer boundary: caller-supplied trusted membership must be true; revoked, disconnected, superseded, unknown and malformed states withhold; exact requested/result/display-context lineage must match; validated authoritative currency/timezone is mandatory. No currency or durable evidence version is invented. Every original amount string, observation instant and run identifier is retained; subtotal uses integer arithmetic. Full ordered inclusive daily coverage is required, with unknown days explicit. A current connection and stale/unknown observations remain independent labels; expiry does not independently discard eligible data.

The model consumes only the offline proposal's reported/unknown day shape. It is not a lossless adapter for the existing endpoint's finer coverage states and is not imported by production routes or mounted pages. Actual producer endpoint/type/selection/version reconciliation and deliberate mounted integration remain outstanding. No network, OAuth, runtime, data, provider retry or configuration behavior was added. The component labels original values in currency minor units to preserve exact representation without introducing a guessed currency exponent/conversion contract.

Proposal pin after producer edits: SHA-256 `43427425b25705d7bcad87fb8c3b595c3f9fe1d35437150715592171904b2a09` for `experiments/marketing/provider-history-contract-proposal.ts`. This revision adds trusted membershipAuthorized and emits evidenceAvailability=unavailable for eligible lineage with no reported amount. The consumer accepts available/unavailable with consistent rows; withheld always withholds. The earlier description above captured the previous file revision before these edits.

PM reports a separately evolving runtime envelope with outer available/not_connected, lineage digest, connectionState=current/expired, reauthorization, evidenceAvailability=available/unavailable and freshness=stale/unknown. That envelope is deliberately not consumed by this frozen offline model. An explicit typed adapter and producer fixtures are still required. The offline model's current freshness label merely displays supplied evidence metadata; it never derives current freshness from credentials, HTTP or a clock.

## Subsequent additive wire adapter checkpoint

PM then authorized immediate unmounted consumer adaptation to the actual producer type. Read `experiments/marketing/meta-spend-report-contract.ts` at SHA-256 `7c271d303c403120d9264348ed1b5c2aa440aca352ea031af625b927ee690937`. Actual freshness is **unknown only**, superseding the provisional stale/unknown wire description above. Added UI-only `src/lib/metaHistoryWire.ts` and `MetaSavedHistoryFromWire` export in the existing unmounted component. No fetch/client/runtime or production mount changes.

The adapter validates the exact additive available response, outer store/period, UUID store/connection/run identifiers, numeric account identifier, sha256 digest syntax and exact requested lineage before reusing the stricter presentation model. not_connected or any malformed/revoked/unmatched result withholds. It obtains currency/timezone only from matched authoritative response account metadata. The adapter never computes a substitute evidence digest or guesses a currency. Source coverage, run status and run-start timestamp are retained separately as immutable sourceDays and displayed alongside the original observations; mapping to reported/unknown does not discard the detailed source record. Mobile table uses an explicit minimum width inside its keyboard-focusable horizontal scroller, preserving complete amounts and dates.

Producer hardening observations were communicated without editing producer source: the inspected producer validator used String(connectionState), allowing coercion, and unbounded ISO hour fields could admit 24:00 rollover; the consumer adapter rejects both. Independent test/review owners are exercising the final consumer source separately. These notes supersede the previous adapter-pending statement for this unmounted fixture scope only; actual mounted provider integration and hosted acceptance remain separate.

Latest authoritative producer file pin supersedes the transient `.ts` pin above: `experiments/marketing/meta-spend-report-contract.mjs` SHA-256 `251d65fd8f6aeabeb339399e289ecae430cb043d3677b249abb862402eff0fb9`, declarations `meta-spend-report-contract.d.mts` SHA-256 `f43d692e19d59bd1e7acebcc3d141dd0b89959bdb493938ac741410743e98ec3`. Fresh read confirms unchanged additive schema, unknown-only freshness, exact digest and account/connection fields. No consumer code change required for this source packaging change. The producer hardening observations still apply to this inspected mjs revision.
