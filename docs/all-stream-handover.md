# Night Scout all-stream handover — 21 November 2026

The three-wave closeout ran in an OpenAI-managed Codex Cloud environment with GitHub and loopback-only test fixtures. The saved checkout was `work` at `2cf59f65982714037e43bbd0554ece2fd81d113f`. Work used an isolated checkout from remote seed `56ecbac3dce05dd32481c54c4eae9c0b6cb986b8` and proceeded independently of the Mac. The departure roadmap records this managed execution and the three lanes.

## Source and approvals

| Source | Exact identity and role |
| --- | --- |
| Approved programme | `f808e5b1cdf6842092ce074782bcec64baf1eb54`, with seed handover, repository instructions and [updated capsule manifest](absence-source-capsules-2026-11-21.json) |
| Latest consulted roadmap | `08a5b88898d338afcb16793bc22e3645ee0c8101` on `codex/synthetic-company-20261105` |
| Accepted website | `3eda388d534b820728172e0edb7ab9b51d0cc3ad`, tree `0374ce28afb8c259117818498d73e915f13dc6df`. Scout frozen at `5dd18ef2282db09a4f389fbc68c3701fbdcfc6cc`. |
| Final staging baseline from published receipt | `204226d0c796561d5bb812cde1bd9cec8da6a8d5`, tree `d528978a0a6e763786cd3968328a1b6c7b2ec955`. Receipt `5cbc35db69298a880617aded60785bff8eb9458b` preserved in candidate ancestry. |
| Exact cloud-tested source | `c8b04003d986c4a7bf32dde954a22844e9a68f57`, tree `e8fd3262b1452958a961ac3e2cc4371a7d950771`. The subsequent handover commit changes only documentation. |
| Changed-path inventory | [Git comparison from the cleanup receipt to the tested source](https://github.com/PaulLantsbury/virtual-cfo/compare/5cbc35db69298a880617aded60785bff8eb9458b...c8b04003d986c4a7bf32dde954a22844e9a68f57). 14 UI/test paths, 16 disposable data paths, two provider contract/test paths and the five seed documents. |

The separately approved local operation published enabled source `f34d13d0662975b78c923877a2a0efe9d999763f` and cleanup `204226d` with trees matching the tested local candidates. The [immutable receipt](runtime-attestation-completed-handover-2026-11-21.md) records one read-only observation, all eight checks confirmed and cleanup live at 17:11:07 London time. The cleanup restores the ordinary review flow and removes the diagnostic. The `f978784` source package itself has a fixed 21 November 18:00 UTC expiry and five-minute/single-attempt limits per process. It was neither invoked nor extended in this cloud run.

The cloud programme performed source reads, fixture execution, independent review and scoped repository closeout. It performed no deployment, live database, private inventory, provider, feed, scheduler, configuration, credential, browser-session or spending action.

## Wave 1 and Wave 2

- **UI and evidence.** Reviewed `405c3eb19124c6f6a0641326b50a7267ad2381bb` against `3eda388` and incorporated the applicable Plan/Cash paths. Used the approved fictional Cash fixture at SHA-256 `dae319f66bf863158c3bab6c53b82a0cc215b92a217124651542ca2692268e9f` after checking compatibility. It exercises the actual query function with a coherent control and mixed-snapshot rejection, retained current evidence and paired recovery. The headless Plan case exercises an unavailable acquisition source, 390px evidence disclosure and successful targeted retry. The supported query allowlist and fixed Plan precedence remain intact. The unsupported acceptance-marker probe was withdrawn in the corrected receipt `1407e47299b6b10329d92a8227a82602f9e26ee2`. Copy proposal `25515ab436528eb5b76d523a4aca0baa1a501b2e` and alias proposal `9500535d8a15346eb7e6050b09cd57a1159aa9dc` remain available on their own branches.
- **Synthetic protocol.** Reviewed published capsule `8fdf04824e21aa44b09e04709b08f118969cef6a`, tree `e2fe40fccafd53e97e44337ca1136b5d064d2e3d`. A fictional persisted timestamp one microsecond after the approved instant incorrectly confirmed through JavaScript millisecond conversion. The exact parameterized SQL equality fix covers both selected and withdrawn instants. Readback binds canonical financial authority, archived selection, protected fixture inputs and receipts. The exact-match lost-ack path resolves via readback, and mismatches fail closed. The candidate imports the necessary offline protocol, dependencies and tests. [Published package](https://github.com/PaulLantsbury/virtual-cfo/blob/8fdf04824e21aa44b09e04709b08f118969cef6a/docs/customer-data-package-index-2026-11-21.md)
- **Provider contracts.** Reproduced acceptance of an extra named attribution-array property in the published normalized facts contract, then added rejection of extra and accessor-backed properties. The change is offline. Existing app log coverage checks query stripping and denial behaviour. Shopify and shared Xero reader boundary tests also exercised elevated-scope refusal, intake field minimization and separation from writer runtimes using mocks and import inspection. The missing Meta/Google implementation needs a hash-pinned source transfer, relevant lockfile, route/runtime/report/acceptance tests and exact run commands. The historical 27 Meta and 42 Google results were reported on a local checkout and were unavailable to rerun here. Real platform/proxy/outbound log handling, full Meta dated totals and account timezone, Google historical positive spend and Xero live acceptance remain open.

## Wave 3 independent review and test receipts

A fresh reviewer examined the tested tree against the seed and final cleanup. The review verified baseline ancestry, non-document equality of the published cleanup and accepted release, exact Cash test hash, evidence fail-closed behaviour, no automatic live side effects and scope of changed files. It found no publication blocker. The UI lane also cross-reviewed the provider change. These are source review findings.

The following ran on the exact cloud-tested source, after a frozen install using Node 24.22.1 and pnpm 10.26.1. Counts are reported per command, without aggregating overlapping history.

| Check | Result |
| --- | --- |
| Focused Node UI, Scout, navigation and handoff | 69/69, including the one real Cash query-function regression |
| Reviewed pages in headless Chromium | 10/10, with fictional Auth and mocked reporting on loopback |
| Complete synthetic-company Node domain | 226/226, with zero skips or failures across 42 test files |
| PostgreSQL 17.11 private Unix-socket rehearsal | 4/4, withdrawal, membership, authority and duplicate selection barriers |
| Provider facts, request logging and Xero mocks | 60/60, plus standalone strict TypeScript for provider-facts |
| Shopify and shared provider reader boundaries | 5/5, mocked and static checks |
| Root workspace typecheck and build | Passed, including the API bundle and both frontend builds. Nonfatal bundler warnings were emitted. |

Commands from the repository root, using Bash for the brace expansions:

```bash
CI=true pnpm install --frozen-lockfile --store-dir /workspace/work/pnpm-store
PORT=5189 BASE_PATH=/ pnpm run build
node --test artifacts/virtual-cfo/src/lib/planning/{plan-baseline-evidence.test.ts,useReviewedPlanBaseline.test.mjs,reviewed-plan-baseline.test.ts} artifacts/virtual-cfo/src/lib/{reviewedCashWindow.test.ts,useReviewedCash.test.mjs,useReviewedCash.query-race.test.mjs} artifacts/virtual-cfo/tests/{nav-routing,review-handoff,scout-overview,scout-profit-flow}.test.mjs
node --experimental-strip-types --test --test-concurrency=1 --test-timeout=300000 experiments/synthetic-company/*.test.mjs
NIGHT_SCOUT_TEST_PG_BIN=/workspace/work/closeout-pg/usr/lib/postgresql/17/bin node --experimental-strip-types experiments/synthetic-company/customer-sidecar-concurrency.mjs
node --experimental-strip-types --test experiments/marketing/provider-facts.test.mjs artifacts/api-server/tests/safe-request-path.test.mjs experiments/xero/{read-only-oauth,read-only-snapshot,tenant-pin,customer-lifecycle-reconnect,mapping-api-contract}.test.mjs
node_modules/.bin/tsc --strict --noEmit --target ES2022 --module nodenext experiments/marketing/provider-facts.ts
node --experimental-strip-types --test experiments/shopify/{provider-read-only-boundary,customer-data-boundary}.test.mjs
```

The initial build and synthetic wrapper invocations stopped during pnpm 11's dependency status check. The completed build used pnpm 10.26.1, and the synthetic suite used the repository script's direct Node command. The PostgreSQL case creates and removes a private disposable cluster. Its fixtures evidence metadata and receipt consistency plus separate-session barriers. Canonical live arithmetic, summaries and role configuration require their own evidence.

Run the browser preview in `artifacts/virtual-cfo` with `PORT=5187 BASE_PATH=/ VITE_SUPABASE_URL=https://night-scout-test.invalid VITE_SUPABASE_ANON_KEY=fictional-anon node_modules/.bin/vite --host 127.0.0.1 --strictPort`. From the repository root use `NIGHT_SCOUT_TEST_URL=http://127.0.0.1:5187 NIGHT_SCOUT_CHROME_PATH=/usr/bin/chromium NIGHT_SCOUT_PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright/index.mjs node --test artifacts/virtual-cfo/tests/reviewed-pages-browser.mjs`. The fixture mocks or rejects every external request. The preview was stopped after the run.

## Next session

- Approve any future website action against a fresh hosted baseline and an exact tested website package. Retain the accepted Scout, selectors/navigation, financial definitions and explicit unavailable labels. The recorded hosted run left authenticated non-member denial and cross-tab comparison persistence uncertified. Current cloud membership cases use fictional fixtures.
- Keep returning customers, frequency, wider distinct cohorts, repeat-order economics and the repeat lever unavailable until exact population, member-bound evidence and reconciled financial partitions are verified. Never sum monthly unique customers or treat residual orders as repeat customers. Wider clean CAC/funnel composition, genuine monitoring and shared plans, weekly/detail inputs and real cash affordability remain separately evidenced work.
- For synthetic data, separately approve any installed schema/role/reader/runtime or publication. Reconcile canonical totals independently, bind protected originals and archived provenance, require exact durable receipts and rehearse denial/withdrawal/read-disable. November needs complete closed-month evidence, and the proposed 20 December 2026–19 March 2027 extension needs its own finite approval. The departure roadmap records the 21 November unattended financial run publishing 20 November. Future feed receipts remain separate from supplemental activation.
- Preserve the absent Meta/Google capsule as a missing input. Require hosting and outbound redaction evidence, Meta timezone and complete daily spend reconciliation, and independently available historical spend before Google positive-spend acceptance. Require Xero OAuth/renewal/reconnect, tenant/membership isolation, an explicitly permitted company target, confirmed mapping and period/currency evidence. No new spend or expired trial is part of the gates.

See [roadmap-delta.md](roadmap-delta.md) for the scoped coordinator update.
