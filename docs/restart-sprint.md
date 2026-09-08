# Restart sprint — Reliable Night Scout baseline

Started 8 September 2026 with Paul's approval. Work is on branch `codex/restart-baseline` in an isolated checkout based on `2cf59f6`. No live application or database changes have been made.

## First work package: trustworthy reporting-period states

Implemented and locally verified; not merged or deployed:

- Recovered all three Replit-only original specifications; added a project guide and decision record.
- Separated loading, current, historical, empty and unavailable period states.
- Replaced the revenue-based three-month limit with an order-count search covering two years.
- Suppressed the dashboard's unsupported briefing when data is stale, absent or unavailable; retained a clearly dated historical trading summary.
- Used one source for the dashboard opportunity headline and KPI.
- Labelled historical and unverified periods on the other pages using the shared period hook.
- Corrected completed-week handling on Sundays and prevented superseded period requests from publishing results.
- Added deterministic reporting-period regression tests.
- Addressed inherited Opportunity Finder typing errors and enabled existing build tools on macOS as well as Replit's Linux environment.

## Sprint backlog and acceptance criteria

- [x] Recover original product specifications into the working branch and provide one documentation entry point.
- [ ] Review/accept the proposed financial and scoring contract in `baseline-decisions.md`.
- [ ] Complete dashboard consistency for current data: remove fixed narratives, status claims, upside values and all-time/snapshot fallbacks; preserve zero as a valid value. Apply the same evidence rules throughout the other analysis pages.
- [ ] Make monthly and weekly calculations reconcile against a known dataset including refunds, tax, COGS, overhead and period boundaries. No misleading comparison when the prior period is absent.
- [ ] Implement real authentication, store membership and server-side entitlements. Prove user A cannot read user B's data, and anonymous requests cannot access customer records or privileged analytics. Preserve a deliberately isolated demo experience.
- [ ] Reconcile live definitions, migration ledger and repository history. Produce a reproducible baseline and test it in a disposable database before considering a live change.
- [ ] Review and merge the branch, reconcile Replit's unpushed document commit, and verify a preview before publishing.

## Validation

- `pnpm test:baseline`: 9 regression tests passing (April-from-September, zero-value trading, exhausted history, RPC/partial failures, invalid counts, cancellation, Sunday, leap/year boundaries).
- `pnpm run typecheck`: all workspace checks pass after the inherited Opportunity Finder typing fix.
- `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/virtual-cfo build`: passes. Existing bundle-size and tooltip sourcemap warnings remain.
- Local browser fixtures: verified the dated April historical summary, unavailable-data message and no-data message. Verified the historical screen excludes the old static diagnosis and 100% decline; monitoring alerts are withheld in these states. Visual layout reviewed.
- Tests and browser verification used local fixtures, not live Supabase. Native build dependency versions are unchanged; only Mac platform packages were enabled.

The application preview used a local test-data server, not real credentials. Development environment setup requires Node 24, pnpm, `PORT`, `BASE_PATH`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Use publishable/anon keys on the frontend; never put a service-role key there.

## Remaining limits

This first work package starts the agreed sprint; it does not complete authentication, financial SQL reconciliation, ingestion or the recommendation engine. Current-data dashboard narratives and other pages still contain prototype content. Weekly analytics remain semantically incomplete even though calendar boundaries are corrected. The bounded search can report no data found for history older than two years. Store timezone support is not yet implemented. The connected Supabase account remains read-only.
