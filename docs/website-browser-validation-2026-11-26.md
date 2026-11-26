# Website browser validation — 26 November 2026

Tests ran against the isolated website candidate on HTTP loopback, with fictional auth and synthetic fixtures only. External requests were mocked or blocked. No hosted login, provider call, database operation or deployment occurred. Node 24.22.3, local Google Chrome and bundled Playwright were used. The package lock matched the existing installation exactly before dependencies were copied. Initial local socket access was denied with EPERM; managed review subsequently approved the loopback preview and isolated browser execution.

## Fresh results

- Focused UI command from the cloud handover: 69 passed, zero failed/skipped; includes the actual Cash query-function race. Its SHA-256 remains dae319f66bf863158c3bab6c53b82a0cc215b92a217124651542ca2692268e9f. Receipt: focused-ui-tests.log.
- Browser suite: 16 passed, zero failed/skipped (24.2 seconds); final receipt browser-tests.log. Sixteen cases cover the retained ten cloud cases plus desktop Explore the Numbers, supported alias context, fixed Plan alias precedence, authenticated non-member preparation and two controlled cross-tab investigations.
- 390px mobile and 1440px desktop checked. Screenshots: mobile-plan-evidence.png and desktop-profit-evidence.png. The first mobile visual inspection exposed a clipped recovery button despite the old body scroll-width check. Coordinator fixed only the scoped baseline-status CSS. Added a button bounding-box containment assertion; the refreshed mobile screenshot is readable and the retry button is fully contained.
- Original first run had 14/15 passes: cross-tab inspection used a role locator for a disclosure that had closed. Exact values remained in the DOM. Test now deliberately opens the disclosure before inspection. Historical failure is preserved in browser-initial-visibility-failure.log; it is not an application regression claim.

## Controlled cross-tab observation

In a fresh same-session fixture browser context, opening a second tab closed the first tab's comparison disclosure. A first tab opened with exact supported URL context retained/rehydrated its current March and comparison February values. Selecting the second fictional store in tab two did not instantly replace tab one's active store; an explicit tab-one reload revalidated the shared store preference, selected that store and withheld the incompatible original URL context.

In a separate control starting without URL context, manually chosen current/comparison selectors reset to blank when tab two opened; the first tab stayed on the same company. The receipt prints before/after selector snapshots. The test prevents foreign or substitute evidence, but intentionally does not assert a new persistence policy. AuthProvider's access clearing/revalidation and keyed page remount are consistent with the observed local reset. This does not prove the cause of the earlier hosted reset, or certify broad cross-tab persistence.

## Limits and ownership

Non-member preparation confirms the UI access gate displays with zero reporting requests under a mocked empty membership list. It is not a hosted authenticated denial or database policy acceptance. Hosted signed-in acceptance remains separate. No provider availability, reauthorization or freshness UI was changed; the provider contract proposal is outside this package. No financial definitions, selectors, navigation, accepted Scout design or auth/persistence semantics were changed by this test lane.

## Tested file identities

- `artifacts/virtual-cfo/tests/reviewed-pages-browser.mjs` — SHA-256 `22c0f93c142df5b999407b8a7516dc6bad531653906a150bf39b7b16a1f7d526`
- `artifacts/virtual-cfo/src/pages/plan-visual.css` — SHA-256 `e10a7824a8d932063158272d62ef42b212626d21480746972dec3fc6d57fe4f7`
- `artifacts/virtual-cfo/src/lib/useReviewedCash.query-race.test.mjs` — SHA-256 `dae319f66bf863158c3bab6c53b82a0cc215b92a217124651542ca2692268e9f`

The loopback preview was stopped after validation.
