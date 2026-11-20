# Pinned Render binding delivery — 20 November 2026

**Prepared and tested, not approved or deployed. Exact source: fb5beb6ccb2f38df9d535ad96136747b5c0ab45e.**

Current deployed source 1168b0b2ae5fa2fe7211de64f9fcd2b5a675b439 passed its clean Linux build and was restored to the normal disabled command after the real mount check stopped before opening a database connection. A fresh disabled run succeeded with zero connections. The accepted statistics metadata audit now has no findings; the full audit remains blocked only by the deliberately unaccepted original-evidence/closed-month/unrelated fingerprint gate.

The previously approved wrapper correctly refused a world-writable `/etc/secrets` parent. The current service remains disabled. This proposal has not been deployed and needs a new exact-source approval.

The proposed wrapper treats that directory as untrusted transport. Before any filesystem access, staging requires a separately delivered private `NIGHT_SCOUT_BINDING_SHA256` value. Its value must be derived from the independently reviewed private binding artifact, never from the mounted file or an observed target digest. The exact bounded bytes must match before text decoding, JSON parsing or copying. The digest value and binding remain outside GitHub and logs.

Only `/etc/secrets`, with the exact fixed production mount path, root ownership, a non-symlink directory and the original trusted root chain, may have writable permission bits. Every other source/target ancestor remains protected from group/other writes. The target must still be a root-owned regular non-symlink file without group/other write permissions. Existing identity, bounded-read, rotation and race checks remain in place. An exclusive runtime-owned 0600 copy in a private 0700 directory is passed to the unchanged strict reader.

A writable mount can now cause refusal or denial of service, but cannot authorize different bytes. Old otherwise valid bindings fail against the new independently approved pin. An attacker controlling both the service's private environment and its mounted secret is outside this delivery integrity boundary; the service control plane remains trusted. SHA256 is an integrity pin, not encryption or a password. Changing the approved binding requires separately approving and delivering its new pin; the wrapper never learns a replacement from the mount.

The normal disabled command still reads neither the private environment pin nor the mounted binding, creates no copy, imports no operator and makes no database connection. Delivery-only and read-only checks require the pin. Financial flags stay false. No grants, database schema, provider actions, publication or activation are included.

UTF-8 BOM input is explicitly rejected so decoding cannot change the authenticated bytes. Tests cover exact pinned delivery, missing/malformed pins before filesystem access, changed/old bytes before parsing/copy, the single fixed writable mount exception, non-root/writable other ancestors, target races and rotations, strict private-copy consumption, disabled zero-I/O behavior and uncertain-outcome preservation. A real hosted build and layout check remain gates after exact approval. This proposal is source preparation, not proof that the live Render layout is accepted.


## Tested package and exact next approval

The combined candidate has **79 passed checks, zero failed/cancelled/skipped**, covering native PostgreSQL 17.6 permission/statistics/operator cases, real filesystem staging and controlled-client connection checks. Its local build probe loads locked pg 8.20.0 on Node 24.22.3 and confirms both disabled paths open zero connections. Actual hosted acceptance of the new pin path is still required; no target digest was used as an expected value.

Request approval to deploy exact revision **fb5beb6ccb2f38df9d535ad96136747b5c0ab45e** to the same existing disabled synthetic staging service, deliver the independently derived fingerprint as its separate private setting and use the already approved private connection artifact. Run bounded delivery-only and read-only connection checks, then restore/reverify the normal disabled command. The user already approved the statistics metadata contract; this request changes file-delivery integrity only. Existing service and budget, no additional resource or cost plan. No database DDL or login recreation.

The separately approved private artifact and its fingerprint must be delivered together from the reviewed local source, not recovered from or inferred from the mounted file. Do not print either value, publish either in GitHub or share the setting through provider environment groups. Changing approved bytes requires a newly reviewed private artifact/pin; never learn a replacement at runtime.

After approval: move only the isolated release branch with a lease; save the private pin on only this service; verify a clean exact-source Linux build; run delivery-only and read-only connection verification; perform the remaining metadata check with append approval and original-evidence acceptance false; restore the disabled command and verify zero connections. Preserve the restricted credential and existing statistics approval. Stop on mismatch without changing expected hashes.

Financial writes, historical publication, material/programme provisioning, feed enablement, provider transactions, website/production deployment and new permissions remain excluded. No successful file/connection check can accept the financial baseline or permit append.

The separate historical bridge proposal covers 5–19 November only if the live horizon remains 4 November, with a fresh finite expiry. It still requires full canonical rehearsal, private live baseline/protected evidence acceptance and separate financial approval. The expired 5–18 November proposal must not be reused.

[Current roadmap](roadmap-2026-11-20.md) · [Handover](session-handover-2026-11-20.md) · [Previous release package](daily-feed-hosted-compatibility-2026-11-19.md)
