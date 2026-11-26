# Combined website/browser validation — 26 November 2026

The checks below ran in `work/night-scout-combined-release-20261126`, with independently copied dependencies from an identical lockfile. The original website and previous consumer/display checkouts were not edited. Final source imports were frozen by the coordinator; tested application hashes are listed below. This lane changed only tests and this report. The coordinator/implementation lane made the shared anchor repair.

## Fresh validation scopes

| Scope | Result | Receipt |
| --- | --- | --- |
| Actual Meta fetch/controller (real source, fictional auth/fetch ports) | 13/13 passed | controller-tests.log |
| Focused UI, Plan, Cash, Scout, navigation and context | 69/69 passed | ui-tests.log |
| Existing reviewed-page headless regressions | 16/16 passed | browser-default-and-pages.log |
| Default-off actual Growth page | 1/1 passed, zero Meta requests | browser-default-and-pages.log |
| Five core page journeys, each at 390px and 1440px | 5/5 passed | browser-default-and-pages.log |
| Opt-in actual Growth page and hook | 7/7 passed | browser-opt-in.log |
| Actual mounted app → report parser → actual display fetch/controller | 2/2 passed | api-consumer-bridge.log |

All scopes have zero skips or failures on their final runs. The three default browser scopes are reported together as 22 cases; the five-core cases each contain two viewport journeys. Counts are separate scopes, not an aggregate end-to-end acceptance count. The focused UI suite was rerun after the shared anchor repair. The small mounted bridge was rerun after final provider imports. Coordinator-owned provider, SQL, Xero and full build checks are documented separately.

The actual Cash query-function fixture remains SHA-256 `dae319f66bf863158c3bab6c53b82a0cc215b92a217124651542ca2692268e9f` and was executed in the 69-case suite.

## New integrated evidence

The new `artifacts/api-server/tests/meta-display-mounted.test.mjs` bundles the actual combined createApp composition and listens only on an ephemeral loopback port. Auth and report-service ports are fictional. The actual display request helper obtains a fictional token, makes its GET to the mounted endpoint, receives the strict producer parser's JSON and passes it through the real controller/consumer. Current and expired access preserve exact source day records and amounts. Auth denial removes the displayed amount without another service read; poisoned scope/account/version/timestamp is rejected by the mounted parser. not_connected withholds; all-unknown remains unavailable with null subtotal. No retry, OAuth, provider request or database operation occurs. This modest bridge does not claim SQL/runtime acceptance; the separate coordinator/provider-owned full bridge covers those layers.

The opt-in browser cases exercise the actual Growth page, hook and controller with fictional session/API responses. They cover explicit reads, expired credentials, wrong account/store/period/version, denied refresh, unknown days, late responses after period/store/route changes, revoked membership revalidation, and no read in fictional mode or for invalid periods. The default-off source mounts no reader and sends no Meta request.

## Five-core and Explore the Numbers review

Scout, Profit, Growth, Cash and Plan were inspected at desktop/mobile sizes with exact fictional reviewed month/version selection. Tests assert the page title is visible in the first viewport, no page-level horizontal overflow, one unique Explore destination, the expected hash and actual jump to evidence, and readable source content. Nested evidence disclosures are opened before evidence screenshots. Twenty screenshots (`<page>-<width>-top.png` and `...-evidence.png`) are saved with the receipts. An independent reviewer inspected the refreshed captures.

The first five-core run exposed a pre-existing Scout anchor defect: the header linked to `#scout-numbers`, but DecisionSection only rendered `#scout-numbers-heading`. The coordinator authorized the nonvisual shared section `id={id}` fix. Scout source and styling remain unchanged. Final unique-target/jump checks pass at both widths. The original failing receipt is preserved as browser-initial-scout-anchor-failure.log; the original frozen website checkout was not altered.

The first viewport shows Scout's purpose, selected evidence state, “What matters now” and next action. Profit shows its EBITDA headline; Cash explicitly shows unavailable cash rather than zero; Plan labels its conditional baseline. Growth shows purpose, evidence mode, selected context and Explore access, but its four selectors push the financial headline below the initial 390px viewport. This is an existing mobile density limitation, not a new redesign or a measured ten-second usability certification. Detailed source/lineage and unavailable states remain reachable through Explore. No sample financial amounts replace missing evidence.

The controlled cross-tab investigations retain their earlier limits: exact URL context can rehydrate after revalidation, whereas manually selected comparison state can reset when another same-session tab opens. No persistence semantics were changed and no cause is asserted for the earlier hosted observation.

## Boundaries and receipts

Everything here is source review, isolated loopback execution and fictional browser evidence. There was no hosted login, provider API call, account selection, credential inspection, OAuth, deployment, database/schema/grant/data action or scheduler/feed change. The previews were stopped after validation. Local evidence directory: `work/combined-release-20261126-evidence/`. Missing live membership, collection freshness and hosted acceptance remain explicit release gates.

## Exact checked application hashes

- `artifacts/virtual-cfo/src/components/DecisionSection.tsx` — SHA-256 `b1dfda7640e7bf3b06fdbb28bd71d6e82d1d7cdf5521fe37ff1a83372db26a9e`
- `artifacts/virtual-cfo/src/pages/scouts-view.tsx` — SHA-256 `2bf9dfdba309f13d07a625610e7883eb459b64a952ce2e20192f41a5f54677c5`
- `artifacts/virtual-cfo/src/pages/new-marketing.tsx` — SHA-256 `c8a0392050fbeecf63ca0b6af2aee57d07fb76e54fc831f6892580976a0a8cc6`
- `artifacts/virtual-cfo/src/lib/metaSpendDisplay.ts` — SHA-256 `6fc815c477d16dd057993a70d42a01f0b965eaa1851b6cbf5a73aa7c6ec1b9a5`
- `artifacts/virtual-cfo/src/lib/useMetaSavedSpend.ts` — SHA-256 `aac8f44d9b9943b8c657300258aa5d0b62b24e908855bf39cf0108da8838dd9e`
- `artifacts/virtual-cfo/src/components/MetaReadOnlySpendPanel.tsx` — SHA-256 `826b93a31f06b7b1ab6ae5e388831dcef803f47f81f3e4b38799dd47e9e5779d`
- `artifacts/virtual-cfo/src/lib/metaHistoryWire.ts` — SHA-256 `9ad80194a991f24353dc152cc9501e466c89fc1bae57c06e2ecbec8372ef7702`
- `artifacts/api-server/src/app.ts` — SHA-256 `11be84749e3d2fc7aa74c6467a0fadb2931cf4e8c550f281dd05a54a0e09fd05`
- `artifacts/api-server/src/routes/meta-ads-spend-report.ts` — SHA-256 `92ff0a63230ee8a289ac8a549e1c5916e77818679b462e5e3e6c5ca3799da934`
- `experiments/marketing/meta-spend-report-contract.mjs` — SHA-256 `d4105763bb861616e4c6836fc25bc61662e851572d7c6800f17af4905fcdee86`
- `artifacts/virtual-cfo/src/lib/useReviewedCash.query-race.test.mjs` — SHA-256 `dae319f66bf863158c3bab6c53b82a0cc215b92a217124651542ca2692268e9f`
