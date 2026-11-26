# Public-ancestry provider validation — 26 November 2026

Fresh execution in `work/night-scout-provider-public-candidate-20261126`, starting from real-ancestry integration commit `3187ce39fda8e3ec66710c58c2a70952efcf0d34`, parent public cloud `6cc5c542929dadedaa3a7633a6937160d4b16880`. The coordinator's subsequent parser/runtime hardening and the three new validation files below were present for this run; final coordinator application commit **74ce7893eb60dac8549043355ef6f287d31b2c10** pins these exact bytes. These are fresh results, not relabelled recovery receipts.

No shared UI/data source edits, provider calls, live database queries, secrets/env reads, deployment, schedules, spending or source publication. Tests use fictional ports, injected pool/Auth/provider boundaries, disposable in-memory PGlite and loopback. Pages modules are read-only external sources, explicitly hash-pinned to pages commit `2a557ea9c0917820151878a373bcf7196fd2a816`.

## Environment and commands

Node 24.22.3, pnpm 11.25.0. Frozen lockfile unchanged. Offline dependency installation lacked tarballs; restricted network attempt failed DNS and was stopped. Approved `CI=true pnpm install --frozen-lockfile --ignore-scripts` completed. No environment/credential files were copied. The package-manager setting below disables pnpm's automatic reinstall check only; all existing compiler/build gates run unchanged.

```sh
node --experimental-strip-types --test experiments/marketing/*.test.mjs artifacts/api-server/tests/*ads*.test.mjs artifacts/api-server/tests/marketing-provider-startup.test.mjs artifacts/api-server/tests/meta-spend-client.test.mjs artifacts/api-server/tests/safe-request-path.test.mjs
node --test artifacts/api-server/tests/marketing-mounted.test.mjs
node_modules/.bin/tsc --strict --noEmit --target ES2022 --module nodenext experiments/marketing/provider-facts.ts experiments/marketing/provider-history-contract-proposal.ts experiments/marketing/meta-spend-report-contract.d.mts
pnpm_config_verify_deps_before_run=false PORT=5189 BASE_PATH=/ pnpm run build
```

| Check | Result |
| --- | --- |
| Complete provider command | **109/109 passed**, no failures/skips |
| Mounted Express/application logger | **4/4 passed**; initial restricted bind failed EPERM, approved loopback rerun passed |
| Strict facts/history/wire declarations | Passed |
| Full root workspace build | Passed; all workspace TypeScript checks, API bundle and both frontend bundles |
| Whitespace check | Passed |

Existing nonfatal sourcemap/chunk-size warnings remain. Raw logs are disposable local files under `/tmp/night-scout-public-*`, not publication artifacts. No long-running processes remain from these gates.

## Meaningful red/green hardening evidence

`meta-wire-hardening.test.mjs` was first run against the exact preserved recovery predecessor's module (SHA-256 `251d65fd8f6aeabeb339399e289ecae430cb043d3677b249abb862402eff0fb9`) via explicit `NIGHT_SCOUT_META_TEST_PREDECESSOR`: **1/5 passed, 4/5 failed**. The same tests pass **5/5** on the hardened new module. They exercise boxed/coercible state without invoking coercion, calendar/time/offset/precision rollovers, valid leap/fractional/offset instants, record symbols/accessors and sparse/decorated/accessor arrays. This proves defect reproduction and repair rather than simply adding matching assertions.

The actual report runtime additionally passes **1/1** injected-pool regression: malformed `observed_at`, `run_started_at` and exact `selected_at` are rejected before Date normalization; valid fractional/offset evidence still normalizes successfully. No default pool/Auth/provider path is used. Both subsets overlap the 109-test command.

## Exact pages producer/consumer agreement

Provider-owned `artifacts/api-server/tests/meta-pages-agreement.mjs` requires an explicit local `NIGHT_SCOUT_META_PAGES_ROOT`, verifies three SHA-256 pins before importing the pages adapter, presentation model and fixture, and passes **6/6**. Four normal envelopes preserve current/expired/not-connected/all-unknown semantics. Malformed coercion, timestamp rollover, symbol and getter inputs are rejected by both boundaries without invoking getters. Valid wire cannot bypass revoked membership or mismatched requested lineage. No pages files changed.

The pages-owned `meta-history-producer-agreement.mjs` was also run unchanged against the new producer using explicit `NIGHT_SCOUT_META_PRODUCER_MODULE` and its freshly computed SHA-256: **4/4 passed**. These are separate overlapping scopes, not an additive end-to-end count.

## Tested file fingerprints

| Path | SHA-256 |
| --- | --- |
| `experiments/marketing/meta-spend-report-contract.mjs` | `d4105763bb861616e4c6836fc25bc61662e851572d7c6800f17af4905fcdee86` |
| `experiments/marketing/meta-spend-report-contract.d.mts` | `e4b0b1d3bd46a27ede3195c753bda9bada2eaa92804eec2482691995bd18c08e` |
| `artifacts/api-server/src/lib/meta-ads-report-runtime.mjs` | `41a33ac17806138c269a71d48ad0e2bb39d4008370e35c0dc7af0d8178fbb5b8` |
| `experiments/marketing/meta-wire-hardening.test.mjs` | `b8d98fafc81bc6ed70de1b0efd5d88b5f5f621115fffeecc44127159c8f784c6` |
| `artifacts/api-server/tests/meta-ads-timestamp-runtime.test.mjs` | `f319b96e25f062c4c5a9576ba3e8bcc605e792c6a52798752180b05029efede0` |
| `artifacts/api-server/tests/meta-pages-agreement.mjs` | `999b04011e0d5ee0a522ecfc8c477e27d3eaf9dee337a4544d3419596a1ee4de` |

## Limits

These checks establish local source/runtime/contract behaviour and disposable SQL capability boundaries. They do not establish installed hosted role/function signatures, ingress/outbound telemetry, real account timezone/spend, provider consent or signed-in live acceptance. The actual application logger test does not close the Render/platform logging gate. The consumer remains unmounted and pages-owned. Exact combined website/provider release and all hosted/access/provider operations remain separately reviewed.
