> Coordinator closeout: Xero bounded timestamp fixes subsequently completed on f8dddcd; 10 focused cases and the full324-case Xero domain passed, with independent review. The audit below preserves the earlier lane handoff.

# Google / Xero offline readiness audit — 26 November 2026

Baseline: preserved provider package8472f2182bc33aab1552a0ab49aae0ec2f505948; implementation is only in the new `night-scout-provider-next-20261126` checkout. Consulted operational roadmap on `codex/synthetic-company-20261105` at file blob a4542882ada6e299bf2f4f21213614cd01cfc81f. No live provider, hosted database, financial feed, secret/private setting, publication or spending operation was performed. PM owns CLI/auth/publication and roadmap updates.

## Implemented Google timestamp boundary

The repository's Date.parse-only timestamp adapter accepted invalid dates and date-only values, normalizing them into apparently valid observation instants. Concrete examples: February30 became March2;24:00 became midnight on the next day. The route's broad timestamp regex also accepted the invalid calendar date. This could misstate saved observation provenance even though it did not alter spend micros.

The new pure `google-ads-report-timestamp.mjs` helper requires an explicit valid calendar date, T-separated hour/minute/second, one-to-six optional fraction digits, and Z or bounded ±14:00 maximum offset. Repository validation runs before normalization; valid Date objects from PostgreSQL remain supported. The route uses the same strict predicate before serializing service evidence. Exact integer micros, coverage and response shape are unchanged; no Meta/UI coupling or financial formula change.

The two new actual repository/route regressions fail against the frozen predecessor (0/2) and pass against the corrected source (2/2). They cover invalid dates,24:00, date-only input, minute rollover and invalid offsets, plus valid leap-day/fractional/offset/Date-object cases. Route tests invoke the actual handler with a narrow Express registration double; they are not hosted HTTP acceptance.

## Implemented Google selection authority

A disposable database executing the exact three Google proposals reproduced a real query-order defect: the report filtered owner/status before choosing the latest selected account. An ineligible newest selection therefore allowed an older retained account to reappear. The reproduction returned the older customer ID for a disconnected latest selection.

The read RPC now selects the unique authoritative latest selected row across the store first, then requires the caller owner, no explicit disconnection, and either a current active connection or reauthorization-required selected history. Tied latest selections withhold. No older-account fallback occurs for disconnected, revoked, different-owner or ambiguous latest selections. Membership remains a separate prerequisite. Expired selected history and unknown coverage remain available for the exact still-selected account, without borrowing facts from another period.

The new disposable authority test failed before the fix (0/1) and passes afterward (1/1), covering disconnected/revoked/new-owner/tie denial, exact expired history retention, mismatched-period unknown, outsider denial and membership revocation. Test setup uses PGlite and effective report-login session authorization; no hosted object was touched. Only the read-function query changed: no schema, return signature, role, grant or live access change.

## Executed validation

Command with bundled Node24.22.3:

```sh
node --experimental-strip-types --test experiments/marketing/google*.test.mjs artifacts/api-server/tests/google*.test.mjs
```

Result: **45/45 passed**, no failures/skips. This is the changed Google domain, not a fresh Xero suite or whole-workspace build. Parent coordinator owns final integrated build/review after all owned changes freeze.

Owned changes:

- `experiments/marketing/google-ads-report-timestamp.mjs` and precise `.d.mts`
- `experiments/marketing/google-ads-report-repository.mjs`
- `artifacts/api-server/src/routes/google-ads-spend-report.ts`
- `db-migrations/proposals/google-ads-spend-read-rpc-2026-11-21.sql`
- `artifacts/api-server/tests/google-ads-report-provenance.test.mjs`
- `experiments/marketing/google-selection-authority.test.mjs`

## Xero audit and coordinator handoff

`mapping-version-contract.mjs` accepts confirmedAt using Date.parse alone. Offline probes confirm acceptance of invalid February30,24:00 and date-only confirmation strings. The existing tests reject only the literal bad timestamp and invalid effectiveFrom date; they do not protect confirmation provenance. Parent accepted ownership of bounded fixes in mapping-version, mapping-api and saved-mapping-view contracts. This audit edits no Xero source and does not pre-claim that parent work has passed. Existing store/tenant exact-scope checks remain requirements; no mapping change or live re-consent follows from this finding.

## Roadmap readiness, with genuine live gates kept separate

Google now has tested mocked OAuth/PKCE, account discovery/selection, encrypted storage, bounded collector, exact micros and report contracts. That is preparation, not installed access or provider acceptance. Positive-spend advertiser history remains unavailable as already settled; do not create ads/spend or ask the owner again. OAuth/discovery preparation can proceed independently when its exact future setup/telemetry permissions exist.

Xero real OAuth/renewal/reconnect, target-company/tenant membership isolation, owner-confirmed mapping and period/currency reconciliation remain separate acceptance steps. Historical tests and old declarations must not be restated as new live blockers or passes. The current task has not read private connections, retried an operation or revived any expired trial.

Both providers still need exact reviewed source/host/configuration authority, safe hosting/outbound capture evidence, installed role/signature verification and bounded live acceptance. No new routine owner question is established by these source findings. The changes are suitable for the parent's next integrated source package; any hosted activation remains separately scoped.
