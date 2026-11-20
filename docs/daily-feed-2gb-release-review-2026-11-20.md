# Prepared 2 GB synthetic-feed release — 20 November 2026

**Prepared for approval, not applied.** The user selected this preparation path only. No paid upgrade, helper replacement or further financial attempt has been authorised by that selection.

Exact proposal source: **cc5b9363b2936aa38a2be4d77982c8638aac0ed3**. Existing runtime remains **fb5beb6ccb2f38df9d535ad96136747b5c0ab45e**; the development branch is not a website/runtime deployment.

## Current state

All 45 reviewed inputs are staged through 19 December. Both ordinary and bridge switches are off; runtime bridge membership and temporary manager SET access are removed. Published horizon remains 4 November with zero daily receipts. Independent checks after two separately approved attempts found all 15 receipts absent, all 17 history/correction full-row hashes unchanged and all 22 protected global fingerprints unchanged.

The database briefly entered automatic recovery during the second attempt, then reported healthy. No manual restart was performed. Its current Nano capacity is up to 0.5 GB. Native profiling demonstrates substantial memory demand; the exact hosted shutdown cause has not been proven.

## Capacity and recurring cost

Pro plus one Small **2 GB** database is approximately **US$30/month before tax and extra usage**: US$25 plan + approximately US$15 compute − US$10 compute credit. This is recurring, not a hard spending cap. Keep the existing usage spend cap enabled; compute is billed outside that cap. Existing Render costs continue unchanged. Do not resume another project or buy add-ons. [Official pricing](https://supabase.com/pricing), [compute billing and credits](https://supabase.com/docs/guides/platform/manage-your-usage/compute).

The organisation's Pro upgrade does **not** automatically enlarge the existing Nano database. Select **Small / 2 GB** separately for the existing staging project, then verify the capacity and health. Resizing interrupts all staging database connections; documented usual downtime is under two minutes but can be longer. No publication is permitted on Nano or during recovery. [Compute upgrade guidance](https://supabase.com/docs/guides/platform/compute-and-disk).

The owner enters payment/tax details directly in Supabase. No card details, billing identifiers, account bindings or private fingerprints belong in GitHub or chat. If release gates fail, the feed stays off; any paid downgrade/cancellation is a separate decision, not an automatic rollback.

## Exact source correction

Replace only **finance_daily_v1.inspect_daily_receipt(date)** using the guarded installer. It assembles the same canonical UTF-8 array bytes using the built-in byte-array aggregate, preserving row order, scope, empty/single-row behavior and existing SHA256 material checks. It adds no extension, changes no financial formula and leaves immutable reviewed inputs unchanged. It still holds a full serialized prefix; it is not constant-memory hashing.

- Old stored definition: **9dcc83df08aee2998c859448bca2c9336030a8a2e52ba6e75fb97c6ba87091b3**
- New stored definition: **3ac48f815453db116edc467c972f88778e2be48ec493eaa6954f6a56c1d5d645**
- Exact guarded installation SQL: **11dc291516d63f5f5c647f6ccf8e3beb03f24007a9b5ff246309125eec44c7fb**

Installation requires the exact old source/owner/ACL/settings, disabled programme, 45 reviewed inputs and zero receipts. It temporarily uses the declared manager's SET and schema-CREATE authority, replaces only that helper, removes temporary grants and checks the exact new definition and unchanged permissions before commit. Native late-failure rollback, ACL-drift refusal and duplicate-install refusal pass. Do not replay an uncertain installation; inspect its actual definition first.

The independent core catalog admission passes with zero findings; its capture uses the operator's exact role parameters and search path. The unchanged statistics contract remains a separate hosted check. The private binding preserves all existing expectations except the intended inspection-function hash. The original 5032 capability source remains the historical baseline; after application it no longer alone describes this helper. The unaccepted binding retains false financial flags. A separate prepared financial form changes only those flags and the helper pin; its preparation is not authorisation or delivery. The execution manifest remains unapproved. No credentials, permanent access, programme dates or statistics contract change.

## Evidence and limits

- Root independently ran **six native installer checks**, all passing. The full initial canonical prefix also passed the managed installer protocol.
- Exact-byte edge cases and all five source-table hashes match the immutable expectations.
- Full 15-day native publication passed independent receipts, raw-journal financial/source/coverage oracles, original seals/archive protection and complete bridge retirement. Peak local publisher RSS was **977,056 KiB (1,000,505,344 bytes)**, around **954 MiB**, and publication took about 32 seconds.
- Ordinary SQL append, fresh-backend receipt and replay passed for **20 November**, **30 November month-end** and **19 December ceiling**. Replay inserted zero. Measured queries took about 2.1–2.5 seconds; retain the higher observed fresh-backend ordinary-case RSS peak of **401,664 KiB**. The daily operator's existing 60-second server, 65-second client and 120-second overall bounds remain unchanged.
- An extra **same-connection December-ceiling sequence** (prior receipt, append, inspect, replay) passed, peaking at **481,680 KiB (493,240,320 bytes)**. That extra sequence is a memory-retention test; the separate fresh-backend cases provide independent receipt evidence.
- The private independent receipt reader uses a fresh verified read-only connection per fixed day and stops on any mismatch. Five controlled-client checks pass. Exact external manifest, full authority and protection checks remain required.

These are native SQL/protocol and controlled-client proofs, not a hosted financial run or full hosted Render-operator acceptance. Local RSS includes shared/cache pages and can miss brief peaks. The earlier whole text-aggregation alternative is rejected for this release; it used too much memory.

## Measurable capacity gates

Use **C = 2,000,000,000 bytes** conservatively for the planned 2 GB allocation unless a smaller actual allocation is established. Let **B** be the maximum retained local backend peak across the full bridge and ordinary cases, and **I** be representative warmed-idle hosted memory.

Require all three: **B ≤ the smaller of 1 GiB and 55% of C**, **I ≤ 30% of C**, and **B + I ≤ 85% of C**. This leaves at least 15% nominal reserve; it is a conservative planning safeguard, not a guarantee. Check a stable warmed-idle interval and no competing restricted writer or heavy workload. Observe existing provider jobs without changing or catching them up.

Unknown metrics, recovery, catalog/source drift, excessive load or a failed threshold means no attempt. Do not automatically choose 4 GB, increase deadlines or retry.

## Proposed ordered application after explicit approval

1. Owner completes the required payment/plan step in Supabase; upgrade only the existing organisation to Pro and the existing staging database to Small/2 GB. Keep other projects unchanged. Verify settled health, capacity and warm-idle/concurrency gates.
2. Recheck all 15 receipts absent, the original 17-table prefix, 14-relation original-example semantics, 22 protected global checkpoints, inherited manager access and the exact disabled six-edge authority state.
3. Apply the exact guarded single-helper installer. Independently verify the source-derived new nine-function authority/catalog state, unchanged other functions/permissions/materials and private expected binding. Stop on any mismatch.
4. Re-arm only the same finite bridge and temporary SET-only runtime membership. Require the full seven-edge armed audit to match. Make **one further bounded invocation** of the previously reviewed timeout-aligned publisher; server/client/overall bounds remain 240/270/300 seconds plus up to three seconds cleanup. No automatic retry.
5. Independently verify all 15 receipts, exact source/coverage/profit oracles, original 24 seals and archive, and global protections. Revoke runtime bridge access and use the unchanged reviewed retirement procedure. Require ordinary catalog and access restored.
6. Only after every gate passes, deliver the exact newly approved financial binding and separate independent private pin to the same service, verify file/TLS acceptance, enable the ordinary programme and existing recurring append command. Keep runtime fb5 and automatic deployment off. No website release.
7. Verify a genuine scheduled receipt and reporting readback before calling the feed operational.

Financial range remains **5–19 November** and bridge expiry **21 November 01:45 London**. **Do not start this application after 21 November 00:45 London**; prepare a fresh bounded package instead. First ordinary scheduled publication remains **21 November 02:00 London** for 20 November. The programme ceiling remains **19 December** and the existing login expiry **20 December 03:00 UTC**. No missed-window catch-up or automatic date extension.

Unknown commit or rollback always stops for independent inspection. Keep both switches off and remove temporary runtime access on failure; do not bypass retirement guards, erase evidence or silently adopt target hashes. Provider transactions, production changes, new services, additional add-ons and a fourth attempt are excluded.

[Roadmap](roadmap-2026-11-20.md) · [Handover](session-handover-2026-11-20.md) · [Current fixture guidance](synthetic-daily-reporting-data-stream.md)
