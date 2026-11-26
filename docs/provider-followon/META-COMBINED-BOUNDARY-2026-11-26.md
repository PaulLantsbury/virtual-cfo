# Meta combined-boundary review and new acceptance fixture — 26 November 2026

## Exact source and ownership

Provider source reviewed: tested74ce7893eb60dac8549043355ef6f287d31b2c10, documentation8472f2182bc33aab1552a0ab49aae0ec2f505948. Frozen provider candidate remains untouched. Pages display is clean at379fbb9 (full commit pinned in the new fixture JSON), based on2a557ea consumer,28853bb website and actual public cleanup204226d. This lane did not edit pages/UI or any production source.

Root provided new independent follow-on work/night-scout-provider-next-20261126 at8472f21. New files only:
- artifacts/api-server/tests/meta-display-pipeline.mjs
- artifacts/api-server/tests/meta-display-pipeline-pins.json

The explicit fixture requires NIGHT_SCOUT_META_DISPLAY_ROOT and checks exact SHA-256 for actual pages metaSpendDisplay.ts/controller, metaHistoryWire.ts/adapter and metaHistoryPresentation.ts/model before importing them. It does not copy or silently rewrite UI.

## Compatibility findings

No provider API/runtime change is needed for this mounted display contract. Pages requests only GET /api/meta-ads/spend with current user/store/revision and explicit inclusive dates. Its controller intentionally bootstraps the authoritative selected account/connection/evidence version from a successful server response; it does not claim an independently selected version. The server refuses browser account selectors, verifies Auth, pinned owner/store and current SQL membership, and chooses the latest selected account before eligibility filtering. Runtime binds exact period, currency/timezone, selected lineage and accepted days to snapshot version. Expiry metadata is separate from freshness.

Known auth/company/revision/period changes synchronously hide old UI, abort previous requests and reject late results. New requests remove old evidence rather than carrying it through denial. The version is a coherence digest, not an authorization proof. Unknown freshness and unknown days remain explicit; no financial formula/CAC/ROAS coupling is added. Default-off display mount and default-off report runtime are independent gates.

Preservation observation: pages' preexisting Cash/Plan evidence helpers match provider/cloud bytes; differences in NewProfitLive, cash/new-profit/new-marketing/Plan wording/layout and reviewed-pages-browser belong to reviewed website28853bb and pages379fbb9. Do not overwrite them wholesale with cloud baseline. Root/pages should integrate their exact frozen deltas deliberately in a combined candidate and run combined build/page checks. This lane does not own that candidate.

## Newly executed end-to-end local boundary

Five cases run actual Express report router → actual report runtime → exact Meta store/RPC/read-RPC SQL in disposable PGlite under effective report-login session authorization → actual HTTP JSON → actual pages fetch/controller/adapter/model. Auth is a fictional injected getUser port; HTTP is127.0.0.1 only; external runtime fetch is a failing tripwire. No real provider, Auth server, database, feed or hosted service is contacted.

1. Current→expired retains exact saved amounts, original source days and evidence version; unknown day stays null. A different period has no borrowed facts and its own digest.
2. Wrong Auth user, another store and deleted membership all return unavailable and clear earlier values.
3. A newly selected account with different currency/timezone and no facts is unavailable rather than falling back; disconnect/revocation of that latest account also withholds old history.
4. An actual delayed HTTP response captured before membership removal cannot restore saved evidence after a newer revision receives denial.
5. An actual delayed HTTP response for the old period cannot replace a newer period's unavailable result.

The transport deliberately ignores cancellation; controller sequence checks therefore matter. SQL identity changes are restored before holding the delayed result. Cleanup releases blocked fixtures before stopping server/database. No automatic collector, retry or OAuth path is mounted.

Command from follow-on root, Node24.22.3:

```
NIGHT_SCOUT_META_DISPLAY_ROOT=<absolute frozen pages checkout> node --experimental-strip-types --test artifacts/api-server/tests/meta-display-pipeline.mjs
```

Default sandbox attempt failed solely with EPERM binding loopback. Approved local-server execution passed5/5 with no failures/skips. A final cleanup-only rerun is recorded to root separately. No unrelated unchanged suites were rerun by this lane; root owns final exact candidate/build receipt.

## Limits and exact next integration handoff

These tests cross previously separate API/storage and UI/controller mocks, but they do not run the browser rendering layer or certify a production request hook on a combined deployment. Pages' separate recorded browser cases cover real Growth/hook/mobile behavior with intercepted API; rerun those on the exact combined source when created. Local PGlite is not live installed-role evidence, TLS/network proof or separate-session contention evidence.

Membership/selection authority is evaluated for each read. This is not continuous revocation notification: an already displayed response cannot know about an external membership/account change until known auth/context change or a fresh read. Do not claim real-time invalidation or invent polling/retry semantics. Explicit reload revalidates and withholds; request sequencing prevents an older result from defeating a newer denial.

No source defect or new owner decision was found. Remaining gates are exact combined source preservation/build/page acceptance, separately approved source publication, installed-source/access verification, platform telemetry closure, hosted configuration/deployment and real-provider acceptance. PM owns GitHub CLI/auth/publication and shared roadmap; do not duplicate installation or ask Paul here.
