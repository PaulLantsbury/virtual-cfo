# Meta saved-spend display validation — 26 November 2026

This source-only package is separate from the frozen website and prior unmounted consumer packages. Tests ran in the new isolated checkout. Matching lockfile dependencies were copied into independent top-level directories. No hosted service, private setting, provider API, OAuth, database, collector or scheduler was used.

## Actual request/controller tests

13/13 cases passed, zero skips/failures. The tests transpile the actual metaSpendDisplay.ts source with the real wire adapter. Only the auth/fetch ports are replaced. This exercises actual token expiry/wrong-user handling, request construction and response sequencing, not a parallel implementation.

The real request helper sends one authenticated GET to `/api/meta-ads/spend` for the exact requested store and dates, with cache:no-store and redirect:error. Missing, expired, wrong-user or expiry-free sessions fail before fetch. Invalid dates/ranges and aborted requests fail before fetch. HTTP denial performs no retry. Controller initialization performs no request; explicit reload immediately clears the old display. Current-to-expired responses keep source dates, amounts and original run metadata. Denied revalidation cannot restore the prior amount. Late responses from an earlier auth revision, store or date scope cannot replace newer data, even if the fake transport ignores cancellation. Clear/unmount also discards pending results. Wrong outer scope/account/connection/version withholds values.

## Actual Growth page and hook

Default-off build: 1/1 browser case passed. The real Growth page has no mounted Meta reader and performs no Meta request, including after opening Explore the Numbers.

Opt-in local build: 7/7 passed, zero failures/skips. Seven cases exercise the real Growth page, useMetaSavedSpend hook, controller and wire adapter under fictional authentication and mocked API responses. Cases cover desktop/mobile explicit GET/current-to-expired continuity, unavailable/HTTP-denied/wrong scopes, all-unknown coverage, late period response, store switch/route unmount, accepted or pending evidence on revoked membership revalidation, and fictional-design mode/invalid dates. New requests are manual only; no connected-status precondition, collection, provider request or retry is invoked. API interception rejects non-GET calls. All external traffic is mocked or blocked.

The first opt-in run passed six cases and failed the last test because the fixture looked for a generic sample button; the existing button is View fictional design. Correcting the test locator did not alter application behavior. Final late-response assertions await transport release before checking the newer view. Screenshot review found date labels lacked spacing, so the implementation lane added scoped form styles. Date-input and button horizontal bounds are asserted. Screenshots use the visible page around the controls because a tall element capture inside the application's scrolling layout produced a misleading blank/clipped image.

## Evidence and limits

Local receipts and fictional screenshots: `work/meta-display-20261126-evidence/` (`unit-tests.log`, `browser-default-off.log`, `browser-opt-in.log`, `meta-reader-390.png`, `meta-reader-1440.png`). No mock proves hosted membership policy, true provider totals, collection freshness or runtime installation.

Final producer application source is `74ce7893eb60dac8549043355ef6f287d31b2c10`, documentation tip `8472f2182bc33aab1552a0ab49aae0ec2f505948`. The final pure contract `meta-spend-report-contract.mjs` is SHA-256 `d4105763bb861616e4c6836fc25bc61662e851572d7c6800f17af4905fcdee86`; declarations are SHA-256 `e4b0b1d3bd46a27ede3195c753bda9bada2eaa92804eec2482691995bd18c08e`. This supersedes the earlier 870c59 parser checkpoint. Six producer/consumer agreement cases pass against that exact final module: current, expired, not_connected, all-unknown, no enum coercion and invalid timestamp rejection (24:00, invalid minutes, invalid timezone offset). The test hashes the module before importing its pure parser. Receipt: producer-agreement.log. No producer source was edited by this lane. The UI bootstraps the latest authoritative selection from a successful authenticated report and labels that fact; it does not claim an independently preselected snapshot digest. Financial models and formulas remain separate.

Commands (Node 24.22.3, bundled Playwright, local Chrome) from repository root:

```sh
node --test artifacts/virtual-cfo/tests/meta-display.test.mjs
NIGHT_SCOUT_TEST_URL=http://127.0.0.1:5192 node --test artifacts/virtual-cfo/tests/meta-display-browser.mjs
NIGHT_SCOUT_META_EXPECT_ENABLED=true NIGHT_SCOUT_TEST_URL=http://127.0.0.1:5192 node --test artifacts/virtual-cfo/tests/meta-display-browser.mjs
```

Both browser invocations supply NIGHT_SCOUT_CHROME_PATH and NIGHT_SCOUT_PLAYWRIGHT_MODULE. The first preview omits VITE_META_SAVED_SPEND_DISPLAY; the second sets it to true locally only, with fictional Supabase configuration. This is not hosted flag authority.

## Tested application hashes

- `artifacts/virtual-cfo/src/lib/metaSpendDisplay.ts`: SHA-256 `6fc815c477d16dd057993a70d42a01f0b965eaa1851b6cbf5a73aa7c6ec1b9a5`
- `artifacts/virtual-cfo/src/lib/useMetaSavedSpend.ts`: SHA-256 `aac8f44d9b9943b8c657300258aa5d0b62b24e908855bf39cf0108da8838dd9e`
- `artifacts/virtual-cfo/src/components/MetaReadOnlySpendPanel.tsx`: SHA-256 `826b93a31f06b7b1ab6ae5e388831dcef803f47f81f3e4b38799dd47e9e5779d`
- `artifacts/virtual-cfo/src/pages/new-marketing.tsx`: SHA-256 `c8a0392050fbeecf63ca0b6af2aee57d07fb76e54fc831f6892580976a0a8cc6`

Final screenshot inspection confirms the new reader title and separately labelled date controls are visible at 390px, both inputs and Load saved spend remain within the viewport, and the desktop evidence rows remain readable in their horizontal scroll region. The local previews were stopped after testing.
