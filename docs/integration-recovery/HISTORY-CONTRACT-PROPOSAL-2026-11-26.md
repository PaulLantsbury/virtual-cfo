> Superseded implementation checkpoint: accepted semantics now implemented by the provider producer. See META-SPEND-WIRE-2026-11-26.md and final validation; this original proposal remains a design example, not the exact wire validator.

# Provider history contract proposal — 26 November 2026

Frozen offline interface example for PM/design review; no existing route, schema, client or UI behavior changes. Typed source: experiments/marketing/provider-history-contract-proposal.ts. This is a composition proposal over already validated data, not a runtime validator or authorization substitute.

Connection state and evidence availability are separate. A current connection can have stale observations. An expired connection requires reauthorization but can retain exact previously accepted history. Neither status invents a fresh observation timestamp. Each day retains its original run identifier, observation instant and amount; unknown days remain null, never zero.

The selected lineage must exactly equal requested store, account, connection, inclusive period and evidence version. Cross-store, cross-account, different connection/version/period or absent selection withholds evidence; no fallback to another selection or archived account occurs. Superseded connections withhold evidence. Proposed explicit-disconnect policy also withholds history by default while preserving it in storage; displaying disconnected history would need a separate reviewed policy/API change. This default is proposed, not an owner-approved new display policy.

Example: the same two-day accepted snapshot has one reported amount and one unknown day. With an expired credential the result remains available, reauthorizationRequired=true, observationFreshness=stale, and both original day records unchanged. Explicit disconnect instead yields withheld, null lineage and no days. It does not delete stored records.

Integration must retain authenticated membership checks, authoritative selection/version reads, validated date/currency/amount contracts and history coherence. The proposal cannot make browser-supplied lineage authoritative. Freshness must come from evidence policy and original timestamps, not callback time. Connection, selection and evidence should be read coherently to avoid races.

Validation: Node strip-types test command ran 3/3 passing cases, covering current/expired continuity and unknowns, disconnect/supersession denial, every lineage field mismatch and absent selection. This is not SQL execution, API integration or browser acceptance. Existing Meta expiry-hides-history behavior remains unchanged pending the shared interface decision and a separately tested implementation.

Follow-up: five tests now pass. No reported history (empty or only unknown days) yields unavailable rather than available. Trusted revoked membership yields withheld even for exact lineage. membershipAuthorized is supplied only after authoritative server membership validation; it must never be accepted from the browser. No missing amount or observation time is fabricated. PM has authorized preparing the actual expiry repair; this example itself remains unmounted.
