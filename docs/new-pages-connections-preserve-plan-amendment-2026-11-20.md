# Connections release amendment — preserve the live Plan

20 November 2026. Prepared, not deployed.

## Why the approved revision was not deployed

Preflight found staging already live on `115a6117e79e50b5203a50dfb4af2408bf3e45d7`, a newer Plan release. The approved New page revision `2ec14a6d16905fd64bd18bb2fc0bab14c4bb39ab` predates that Plan. Deploying it would undo the newer Plan work. No deploy was triggered, and no service setting was changed.

## Exact amended release

Deploy **`950baf935c33ac7c00cbdc53f3be6e93bebab81a`** to the same existing Night Scout staging website. This is the tested union of the approved connections and the current live Plan. Independent file-by-file verification confirms all eight changed application/test Plan files are byte-identical to live revision115a6117; the other489 tracked application files are byte-identical to approved2ec14a6. Existing Plan routing and authenticated company/user-scoped saved workspace are preserved. There are no other application changes.

**130 tests pass**, including the18 current Plan tests plus112 connection/history/financial tests. Frontend TypeScript, integrated production build and whitespace checks pass. The original package's local fixture browser evidence remains applicable to unchanged page-connection code; real signed-in source/latency verification still follows deployment. This amendment does not claim that a fixture harness is Supabase acceptance.

## Release and verification scope

Use the same existing website's exact-commit deployment control, leaving configured branch and auto-deploy off unchanged. Confirm current live revision immediately before deploy and do not overwrite newer concurrent work. After release verify October/September supported values, Profit per-order and monthly trends, Marketing history and independent-assumption bridge/reset, Cash profit-only history/yellow missing cash, business switching, Explore the Numbers and current New Plan. Measure bounded sequential-read latency and inspect runtime errors.

The original [website package](new-pages-full-connections-staging-release-2026-11-20.md) describes the connection functionality and hosted checks; this amendment supersedes its exact deployment and rollback source. If a material regression requires rollback, preserve the now-current live115a6117 Plan release rather than reverting to oldera77.

Approval covers this website revision and signed-in checks only: no database migration/grants or financial writes, cash seed, provider transactions, daily-feed changes, production change, new service or extra spending. The earlier owner approval pinned2ec14a6, so this new exact revision requires an amended approval. The substantive connection functionality is unchanged.
