# Historical publisher timeout amendment — 20 November 2026

**Prepared and tested, not applied. No second publication attempt has been made.**

## Current safe state

The approved installer correction succeeded, with inherited administrator access preserved and source-derived function/permission checks matching. One historical publication attempt ended in an uncertain rollback state. Independent readback then found all **15 receipts absent**, all **17 history/correction relations exactly unchanged**, no active restricted runtime backend and all **22 protected global fingerprints unchanged**.

Temporary runtime bridge access has been revoked. The historical bridge and ordinary programme are both disabled. All 45 reviewed inputs remain staged. The already approved expiry adjustment remains applied. The disabled bridge schema is retained because its retirement guard requires committed receipts; it has not been bypassed.

## Identified defect and correction

The earlier private publisher inherited a **65-second client query limit** while allowing a **90-second database statement**. That mismatch can hide a useful database response. The 15-day reconciliation also repeats substantial whole-history hashing. The connection reset's sole cause is not established, and a longer limit is not a success guarantee.

The revised private publisher uses aligned, finite limits:

| Control | Limit |
|---|---:|
| Connection | 5 seconds |
| Preparation database statement | 30 seconds |
| Lock wait | 5 seconds |
| Publication database statement | 240 seconds |
| Client query | 270 seconds |
| Overall stop | 300 seconds |
| Rollback query | 20 seconds, within the overall stop |
| Final cleanup | Up to 3 additional seconds |

It reports only a fixed operation phase and allowlisted SQLSTATE. Raw exception messages, SQL, credentials and private bindings are excluded. An uncertain commit or rollback still stops for independent inspection; there is no automatic retry.

Exact private amendment manifest SHA256: **9327974bb1d946b3df30c04906fbd7c607c785dbab0d86153a5654d4bb2dca1a**.

Exact revised publisher SHA256: **58c16f12ed7a8fc09fc19c370d106376df85263a7e4ea76b195bbe16e894df37**. Its code, tests and private manifest remain outside GitHub because they contain local operational bindings. The exact bytes are available for private review. Existing database financial functions, materials, financial definitions, expiry and ordinary daily runtime are unchanged.

## Evidence

Root independently ran **10 focused publisher checks** and **one native PostgreSQL timeout-protocol check**, all passing. The focused checks cover zero-access default, strict approval/file/TLS/session/function gates, receipts, uncertain commit, sanitized diagnostics and deterministic overall-stop behavior. The native test demonstrates acknowledged rollback with server-before-client cancellation using scaled limits; it is not a hosted performance benchmark.

The full native financial rehearsal and hosted read-only TLS checks remain separate evidence. The revised publisher has not made a live financial call.

## Requested approval: one further bounded attempt

After exact amendment approval, repeat independent checks that all 15 receipts are absent, the original 17-table prefix and original example match, protected global data is unchanged, both switches are off and temporary runtime access is absent. Verify source-derived function/permission expectations for that disabled state.

Re-arm only the same already approved temporary SET-only membership and finite bridge. Require the original full pre-publication function/authority audit to match after re-arming, then make **at most one further manual invocation** of this exact publisher. Do not restage inputs, reinstall the bridge or repeat the expiry adjustment.

The range remains **5–19 November**, with expiry **21 November 01:45 London**. No automatic extension or catch-up. On success independently reconcile all receipts/source/protection evidence, remove temporary access, retire the bridge and continue the existing conditional daily-activation approval. First ordinary publication remains **21 November 02:00 London** for 20 November, with financial-day ceiling **19 December**.

The approval changes only the one-off publisher's timeout handling/diagnostics and authorizes one further guarded attempt. It adds no provider transactions, website/production changes, new service, ongoing feed privilege or budget.

[Roadmap](roadmap-2026-11-20.md) · [Handover](session-handover-2026-11-20.md) · [Approved installer amendment](daily-feed-installer-amendment-2026-11-20.md)
