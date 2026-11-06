# Independent monthly reader review — 6 November 2026

Local preparation only. The accepted hosted history and its 24 seals were not read or changed by this reviewer. No hosted SQL, access change, index installation, service setting or deployment was performed. Product financial definitions and the existing revision contract are unchanged.

## Findings and disposition

1. **Fixed — benchmark evidence could hide sample drift.** The overnight harness overwrote each month's full-response digest on every iteration and compared only final outputs between separately invoked variants. Matching headline amounts or a final digest did not demonstrate that every measured response had identical source/version evidence. `assertBenchmarkDigest` now checks each complete availability response and each complete January/October result against the first result, across warmups, measured rounds and both variants. A new regression deliberately changes a source revision or selected snapshot without changing money and verifies refusal.
2. **Fixed — baseline provenance and measurement order were not reproducibly bound.** The earlier private baseline module was manually materialised, and before/after variants used separately loaded clusters under overlapping test load. The harness can now read the exact local Git blob at an explicit 40-character base commit, without checkout/reset/network. A paired run uses a single fresh PostgreSQL cluster and the same fixture, excludes an explicit warmup, and alternates baseline/candidate order over six measured rounds. Receipts record the original baseline source SHA-256, candidate and harness source SHA-256, shared dependency hashes, exact fixture-byte SHA-256 and unchanged-byte checks. Shared current calculation/authentication dependencies are intentional: this isolates the reader diff, rather than claiming an independent checkout of all baseline dependencies.
3. **Reviewed, no correctness defect found — map substitutions.** SQL primary keys enforce unique `(store_id, source_id)` rows. The new refund/line lookup maps therefore have the same selected row as the previous first-match searches. Grouping lines preserves their source order and all canonical source arrays remain unchanged. The actual disposable SQL regression compares complete baseline/candidate responses for November, December and January, rejects a duplicate stored line, confirms malformed raw-source bodies fail closed, and verifies unchanged seals.
4. **Reviewed, no cross-request cache found — availability context reuse.** Contract/store reuse is scoped to one authenticated repeatable-read read-only transaction. Each month still validates its coverage, seal, explicit selected head and correction lineage. The new SQL regression verifies one contract/store lookup per availability transaction, changes the store currency between calls, restores it, then withdraws membership and proves both availability and selected reads are denied. Raw-source reads still validate actual bodies; availability remains explicitly a sealed-candidate listing.

5. **Fixed — benchmark PostgreSQL share directory was workspace-specific.** Server executables and share files now resolve from the same local or explicitly selected `pg_config`; an explicit share directory override is supported. Absolute directories are required. A regression covers a portable installation, explicit override and malformed paths.

No reader runtime change was needed beyond the preserved overnight optimisation. The fixes in this review affect the disposable benchmark and its regression evidence.

## Reproduction and acceptance

Use retained Node 24.21.0, pnpm 10.26.1 and PostgreSQL 17.11 tools. The benchmark accepts explicit private fixture/output paths only and creates a new Unix-socket cluster with TCP disabled. It never reads an operational connection URL or provider credential. Its generic restricted reader role is separate from the disposable setup owner. Both variants must refuse non-members on availability and selected reads. A coherent balanced expense/hash mutation must make the selected read unavailable, while all 24 original seal bodies remain unchanged.

```sh
node --experimental-strip-types --test --test-concurrency=1 experiments/synthetic-company/reader-review-independent.test.mjs
node experiments/synthetic-company/history-performance.mjs <private-fixture.json> <private-paired-results.json> --pair 1022f42aff121df1b8cb5451d76bba3a341d7477
```

The three independent SQL/digest regression cases and one PostgreSQL tool-resolution regression passed. Repeated focused runs are not new test cases. Raw fixture rows, restricted-role plans and individual timing samples stay outside version control.

## Paired local reader-module comparison with current shared dependencies

The quiet-window paired run passed on the same representative fixture: 92,504 events, 734 reporting days and 24 seals. Each variant completed six measured rounds after one excluded warmup; order alternated AB/BA. Every complete response digest matched across every measured and warmup read. Non-member denials, coherent corruption refusal and unchanged seals passed. No other team test/build load was scheduled during this run; system load averages were 0.42/0.56/0.49 before and 0.96/0.68/0.53 after. This reduces timing interference without claiming exclusive machine resources or causal attribution.

| Read | Baseline median ms (range) | Candidate median ms (range) | SQL statements baseline → candidate |
| --- | ---: | ---: | ---: |
| 24-month availability | 56.07 (51.62–61.29) | 42.16 (35.88–49.28) | 196 → 126 |
| Original January | 296.15 (290.42–307.13) | 275.81 (260.01–295.37) | 15 → 15 |
| October | 433.15 (406.49–456.00) | 356.32 (344.57–373.67) | 15 → 15 |

Provenance: baseline commit `1022f42aff121df1b8cb5451d76bba3a341d7477`; baseline reader SHA-256 `01cf5179e7d8642c56cfa0806a6e7b91f9d324773e59f2de787f81f326b90695`; candidate reader SHA-256 `01af5ec7685d96330e1a9699167d975acc33bcb32b4ecd90852623a91a7c3f3a`; harness SHA-256 `bddd4e25ac3836d3fa83be4910fe7331fbaa02f3b79d897f514589166b506097`. Fixture-byte and shared dependency hashes and individual paired samples are retained in the private receipt. These controlled local observations supersede the earlier separately loaded, concurrent-run timing comparison for reproducibility; they do not establish hosted latency or a performance target.

## Remaining release limits

The separate six-index file remains a proposal; the overnight restricted plans used only some candidates. This review does not authorise installing any index. Review write/storage costs and actual hosted statistics separately. No new performance target is agreed. Local fixture reads exclude hosted authentication/network/HTTP/browser latency, larger membership populations and user interactions. First-request and warm-cache behaviour are distinct; neither is a cold operating-system-cache guarantee. Signed-in hosted page timing remains a separate release acceptance gate.


## Parent hosted acceptance update
Exact web revision c7e69211be65b5fb054062d327451844042d38bc is live. Signed-in January/October cards, monthly composition and Explore agreed; month changes withheld prior figures and reset version selection. Original January recheck and unsigned direct API refusal passed. Keyboard Enter toggled the chart disclosure. These limited checks do not establish comprehensive race/error, screen-reader, phone layout, full mockup parity or representative-owner ten-second acceptance. See [current roadmap](roadmap-2026-11-06.md) and [website release](staging-web-release-2026-11-06.md) for current status.
