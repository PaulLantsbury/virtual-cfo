# Margin Recovery and Monitoring — approved parallel package

12 September 2026. Paul approved both tasks with two coding agents and an independent reviewer. Status: implemented, independently reviewed and verified locally. No new financial rules or live integrations are included.

## Margin Recovery

Remove fabricated source fallbacks, including revenue £124,500 and AOV £68.40 when a source value is zero or missing. Preserve finite source zeros; show missing, loading and failed data explicitly. Source-reported values remain unverified because the existing source calculations have not been certified against the approved definitions. Do not feed these into unsupported factual margin, trend or recovery claims.

Keep the existing prototype/model available as clearly labelled sample analysis with independent fixed inputs. Sample inputs must never stand in for absent source figures. Actual margin/recovery reporting remains unavailable pending verified inputs. Remove page-local routes into canned business diagnoses or fake active monitoring. Do not change shared formulas, sample snapshots, plan gates, database contracts or financial policy.

Ownership: `artifacts/virtual-cfo/src/pages/margin-analysis.tsx`, dedicated page helper if required and dedicated margin browser/unit tests. Acceptance: genuine zero retained, missing/error/partial/loading states do not become sample facts, current/historical context does not certify source data, model remains clearly illustrative, free/pro and relevant interactions behave correctly. Test only against isolated fixtures.

## Night Scout Monitoring

Clearly distinguish the prototype from active monitoring. Remove or rewrite claims of completed monitoring checks, live business diagnoses, saved schedules or delivered notifications. Retain clearly labelled examples and existing free/pro gates. Existing frequency/delivery controls may demonstrate the interface locally, with explicit unsaved/unscheduled/no-delivery wording. Upgrading must not imply that an unimplemented service becomes active.

Replace canned AI entry points with an honest page-local explanation and disable fake active monitoring via the existing page prop. No scheduling, messaging, backend, billing or financial-policy implementation.

Ownership: `artifacts/virtual-cfo/src/pages/cfo-alerts.tsx` and `artifacts/virtual-cfo/tests/monitoring-browser.mjs`. Acceptance: truthful status on desktop/mobile and free/pro, sample history/insights clearly identified, controls create no persistence or notification promise, no new remote effects.

## Coordination and boundaries

The reviewer checks both diffs and coverage, including collapsed sections, plan teasers, simulation branches and shared UI entry points. The coordinator owns shared documentation, preview/test execution, integration and GitHub publication. Changes remain on `codex/restart-baseline` and the existing draft PR. No main merge, staging mutation, production release or Replit synchronisation. The Shopify/reference-data comparison pause remains in force.

Completion requires appropriate browser checks, frontend type checking, visual inspection, review and a dated handover. Record failed checks and corrections honestly. Broader financial-source wiring or other pages are separate packages.

## Completion — 12 September 2026

Margin Recovery now shows source-reported revenue/AOV separately, without a fabricated substitute and without assuming a currency. Finite zeros remain visible; failed/partial/missing/malformed responses are unavailable under the existing period-hook contract. Unverified source figures do not feed actual margin or recovery claims. The existing sample simulator and supporting analyses use explicitly fixed inputs, with their formulas and capability gates retained. Removed unused fallback/delta plumbing and unsupported verdict/canned-AI entry points; no shared source calculations changed.

Monitoring now labels examples and fictional history, explains that no checks or notifications run, and identifies frequency/delivery controls as temporary local previews. No settings persistence, scheduling, notification delivery or business-specific AI answer is claimed. Both pages disable the shared misleading monitoring indicator using its existing page-level option.

Verification: 20 Margin browser checks and 6 Monitoring browser checks pass against a fixed loopback build with fake Supabase configuration and blocked/mocked requests. Coverage includes desktop/mobile, free/pro, source zero/nonzero/loading/missing/malformed/error/partial/historical/empty states, sample-model isolation and interaction, opened supporting sections and settings storage/reload reset. Frontend type checking and build pass; inherited tooltip sourcemap and bundle-size warnings remain. Screenshots inspected. Independent review found no remaining in-scope issues; document links/diff checked.

The initial Monitoring run passed five checks but its mobile settings interaction lost its DOM element during development-preview updates. A rerun of all six against the fixed build passed; no settings implementation change was needed. Use a fixed build for future combined browser acceptance to avoid concurrent agent edits causing development reloads. This is not live-service verification.

Publication is to the existing GitHub development branch/draft PR only. No staging records, access grants, review approvals, financial policy, shared sample formulas, entitlements, production, main or Replit were changed. Actual margin/cost-source wiring and operational monitoring remain unfinished. The inherited mobile development-toggle clipping and illustrative-model inconsistencies are not resolved by this page-scoped package. Shopify/reference comparison remains paused pending a real source.
