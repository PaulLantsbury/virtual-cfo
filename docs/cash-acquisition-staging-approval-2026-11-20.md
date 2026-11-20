# Cash and New Marketing staging activation — 20 November 2026

**Status: prepared, not applied. Owner approval required.**

## Exact reviewed release

- Website/schema/reader source: `b7ea4913c928ac9dac57bc45b5478ca06688a016`.
- Preserved live design baseline: `8287d1024b8c90523c807450dcef1d9d2a1490b4`, including separate /new-marketing, named comparison periods and existing Plan.
- [Implementation and verification](cash-acquisition-data-batch-2026-11-20.md).
- [Every New Marketing figure and its source](new-marketing-v16-connection-register-2026-11-20.md).
- [Immutable data manifest](synthetic-supplemental-review-manifest-2026-11-20.json).
- Plan hash: `05e6ace2953f8857a064aa7cd58eae5c4c3ec4f87b6b3fe763c5dd62e43c0348`.
- Records hash: `48128db86890f6a71a5be2e02c4ecae5a20706632a80474258287f4eeb3a915c`.
- Schema SHA256: `260ff1b2e6698f4d5cc55fa40279d0e7ed2d75cd3a8508ccd4ed1a4a7526529d`.
- One-call publication SQL SHA256: `654597c8a80838bf5909df3d9231f87f28ed7ab53ef9308299042bbddd088c2f` (355,833 bytes).
- Exactly 48 summaries: cash and acquisition for 24 complete months, November 2024–October 2026. Economics included; source observed 20 November 2026 at 17:50:41 UTC.

Private operator artifacts remain outside GitHub. Reconstruct only with the pinned source and exact manifest; changed bytes, baseline, versions or hashes require stopping rather than silently substituting data.

## One proposed approval

1. Install the exact new private synthetic supplemental schema in existing Night Scout Staging. It has fixed-company scope, row-level membership checks, immutable bodies and no browser access. No new login.
2. Recheck the current sealed financial versions and source totals, then publish the exact 48 summary plan in one guarded transaction. Existing financial journals, seals, daily-feed records and other companies are unchanged. One initial publication attempt; no automatic retry after uncertain/failing outcome.
3. Give only the existing restricted reporting server schema usage and table SELECT, subject to the exact role/RLS safety preflight. Do not widen existing role capabilities or grant browser roles access. If the hosted role/policy does not match, stop.
4. Deploy exact website source `b7ea4913c928ac9dac57bc45b5478ca06688a016` to the existing staging website and set only its optional `NIGHT_SCOUT_SUPPLEMENTAL_ENABLED=true` after database checks pass. Preserve configured branch, auto-deploy setting, other private settings and the latest Plan/design.
5. Verify signed-in New Marketing Acquisition/Conversion/Retention, Cash, Profit, Plan, month/company changes, missing/stale evidence withdrawal and mature-cohort dependency checks. Confirm ordinary browser users cannot query the private table and check response timing.

No production release, provider transaction/retry, daily financial feed change, new service or additional spending is included. This is an initial historical supplement publication; future closed-month refresh/scheduling and correction/replacement protocols remain separate work.

## Gates and recovery

Before any mutation, confirm current staging target, latest live revision and restricted reporting identity privately. A newer website design must be preserved and retested before requesting a different exact source approval. Preflight current financial baseline and all six April–September mature-cohort dependencies; reject any mismatch.

Keep the optional flag off until publication, permissions and canonical readback pass. On website/read verification failure, keep or return the flag off and retain explicit unavailable/yellow states. Do not erase evidence, loosen permissions, modify financial versions or retry publication automatically. Record any applied partial step and observed outcome in the roadmap.

## Verified and practical limits

215 previously combined checks passed, with 16 focused checks after the final latest-design merge; the frontend TypeScript check and production build pass. Local database publication and exact replay, single-call replay, RLS isolation and route checks passed. Desktop and 390px prepared-data previews were checked; this is not hosted Supabase acceptance.

Full API typecheck retains 17 pre-existing Xero declaration errors; targeted changed API checks and API bundle pass. Build retains existing chunk-size warnings. Hosted latency/load and genuine scheduled-run acceptance remain outstanding.

Sessions are explicitly simulated; allocated advertising/cost policies and finite observation windows are disclosed. Unique returning-customer/frequency comparisons, unsupported multi-period funnel comparisons, future cash forecasts, current bank connections and customer drilldowns remain unavailable/yellow until separately sourced. Actual mature recovery is Day 0 (first-order day), not cash payback. Cash can fall in a profitable month.

## Why approval is required

[AGENTS.md](../AGENTS.md) states standing source-publication approval “does not authorise ... applying database migrations” and that staging-preview approval “does not authorise migrations, new grants, hosted exposure”. Prior website approvals pinned other revisions and excluded this new storage/data/read-access package. This concrete bundled approval covers those additions only.
