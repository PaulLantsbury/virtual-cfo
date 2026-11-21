> **Latest —21November2026:** [Build/test cleanup and next batch](roadmap-2026-11-21.md). Full workspace build/typecheck,321Xero tests and146baseline synthetic checks pass; final guard regressions pass separately. Source only; no live changes. The overnight prepared features remain unactivated. Earlier checkpoints below are historical.

# Autonomous cloud programme checkpoint — 20 November 2026

This is a separate, bounded cloud task on `codex/autonomous-cloud-prototype-20261120`, based on the requested development baseline `02858054d5b112b3f1bba15af3054530c9eaf069`, not `main`. The task workspace was initially empty; connected GitHub clone/build works. Inspection found no competing autonomous implementation branch or fresh programme PR. The previously requested saved-environment launch remains unconfirmed; this work does not claim that other job started. The programme file at its specified GitHub SHA ends with literal `undefined`, so the user’s chat scope and latest roadmap were used to define the bounded work.

## Completed locally on the separate branch

- Prepared the exact 90-day future synthetic continuation through 19 March 2027 as an in-memory candidate, plus a gated closed-month summary-refresh proposal. The existing 48 Cash/Acquisition summary rows remain untouched. Candidate hashes are generator fingerprints only; no hosted readback or publication occurred.
- Added synthetic selected-month customer counts to New Marketing, retained integer counts and source lineage, derived purchase frequency in the browser, and preserved compatibility with the already-published summaries that lack the new optional aggregate. Raw customer identifiers are never exposed.
- Added a pure fail-closed Plan baseline calculation from three contiguous, complete reviewed months with matching acquisition and supported economics evidence. It is tested but not yet wired into the Plan page; the page continues to use its labelled fictional sample.
- Wrote the reversible Scout’s View opt-in proposal. No page choice or monitoring behaviour was implemented.
- Updated the [roadmap](roadmap-2026-11-20.md) and added the synthetic/summary and Scout proposals.

## Cloud validation and remaining gates

Frozen dependency install and baseline suite passed (45/45). Focused continuation/refresh, Marketing source and Plan baseline tests passed (6/6, 9/9 and 2/2). Frontend typecheck, configured frontend production build and API-server bundle build passed. Build warnings about the existing tooltip sourcemap, mixed Supabase chunking and large bundle remain. Root workspace build is still blocked by 17 existing Xero `.mjs` TypeScript declaration errors.

This branch contains source, tests and documentation only. No live database reads/writes, grants, credentials, feed or scheduler changes, provider transactions, deployments, production changes or spending occurred. The genuine scheduled financial receipt still needs independent verification before any closed-month summary refresh. Shopify/Meta customer permission and acceptance, multi-month acquisition/session comparisons, a live verified Plan baseline, and Scout’s View design/owner acceptance remain blocked. See [the continuation proposal](synthetic-continuation-and-refresh-proposal-2026-11-20.md) for exact hashes and gates.

---

# Day-end checkpoint — Cash and New Marketing connected and verified

**20 November 2026: approved staging batch complete. Stop for the day.**

Website source `b7ea4913c928ac9dac57bc45b5478ca06688a016` is live and signed-in verified. [Hosted acceptance and remaining work](cash-acquisition-hosted-verification-2026-11-20.md) records the exact publication, restricted access, results and limits. [Connection register](https://github.com/PaulLantsbury/virtual-cfo/blob/b7ea4913c928ac9dac57bc45b5478ca06688a016/docs/new-marketing-v16-connection-register-2026-11-20.md).

- Two years of private synthetic cash/acquisition summaries published:48 records,November2024–October2026. Membership-limited server reads enabled; no direct browser access.
- Cash now shows reconciled bank balances/movements, three-month history and buffer arithmetic. New Marketing’s Acquisition/Conversion/Retention tabs use synthetic acquisition, simulated funnel and allocated cohort inputs; ratios are calculated in the page.
- October bank £301,632.59,operating cash −£22,290.26; marketing CAC£2.05,conversion3.00%,948 identified first orders and686 repeat orders. These are synthetic historical activity, not real provider acceptance.
- Preserved latest Marketing design, reviewed Profit and Plan. Unsupported figures remain yellow/unavailable.
- Owner-approved source/data/read-access/flag/website package applied successfully. No provider transactions, daily financial-feed change, production release, new service or extra spending.

## Next session — order of work

1. Confirm actual scheduled financial-feed run evidence and source freshness; then prepare a closed-month refresh for the new cash/customer summaries. The existing daily financial feed does **not** refresh them automatically. Correction/version handling and future cohort windows need a reviewed workflow.
2. Finish remaining yellow customer/funnel comparisons: unique returning customers, frequency/second-purchase timing, multi-month CAC/sessions and drilldowns. Prioritise matched source inputs and clear calculation definitions. Recheck loading, company/month changes and response time; preserve existing source safeguards.
3. Complete Scout’s View design review using the now-connected specialist conclusions and the ten-second rule. Then agree final five-area navigation/names, run Overview→specialist→Explore the Numbers→Plan owner journey, and review Monitoring/Settings. Profit/Cash/Marketing/Plan designs are already reviewed; Plan baselines/shared actions/reminders remain separate engineering work.

The design closeout from the parallel site-design branch is preserved below as product context. It predates this data release; any statement there saying cash/customer inputs are unconnected is superseded by the hosted verification above.

---

# Resume here — site design closeout, 20 November 2026

Latest website release: 8287d1024b8c90523c807450dcef1d9d2a1490b4. This closeout is documentation only.

Read the opening **End-of-day site design checkpoint** in [the roadmap](roadmap-2026-11-20.md) before older notes below.

- **Reviewed/redesigned:** Profit Engine, Cash Control, Marketing (Acquisition + Conversion + Retention), Plan.
- **Next core design review:** Scout’s View / overview, currently CFO Briefing at /dashboard, with /v11/scout as reference.
- **Supporting reviews still pending in this latest pass:** Monitoring and Settings/connections/account mapping. Earlier work exists; do not describe them as never reviewed.
- **Not separate unfinished core pages:** Growth Quality, Opportunity Finder, Scenario Planner, pricing/margin diagnostics. Customer work belongs in Marketing; opportunities/scenarios belong in Plan; relevant profit diagnostics belong in Profit.
- **Temporary references:** Marketing Efficiency and the original pages. Keep them until Paul agrees final comparison/consolidation.
- **Next design sequence:** Scout’s View → final menu/names → cross-page owner journey and consistency → Monitoring/Settings → connected/missing-data visual acceptance.
- Design review is not data readiness. Keep sample/source boundaries, restricted readers and independent integration/feed work. Acquisition-to-future-repeat forecasting stays parked.

Do not restart Cash, Profit, Marketing or Plan redesigns from the older proposals. Final minor acceptance is still possible, but their current working designs have been reviewed and implemented.

---


---

## Cash and latest New Marketing — ready for owner approval, not applied

Parallel preparation is complete and published on `codex/cash-acquisition-data-20261120`. Exact tested source: `b7ea4913c928ac9dac57bc45b5478ca06688a016`. [Bundled staging approval package](https://github.com/PaulLantsbury/virtual-cfo/blob/dbead3dc6940647a417b4634a0ca9ad3ea147315/docs/cash-acquisition-staging-approval-2026-11-20.md).

The package preserves latest live design `8287d10` and Plan. It prepares 24 complete months (November 2024–October 2026), 48 private synthetic cash/acquisition summaries, cash movements/resilience, identified/guest/unknown customers, allocated CAC, simulated conversion inputs, first-order costs and mature cohort economics. The page calculates ratios from stored integer inputs. All six April–September dependencies are rechecked for mature data. Unsupported figures remain yellow/unavailable; multi-period funnel/unique-returner comparisons and customer drilldowns still need sources.

215 combined checks passed plus 16 focused latest-design merge checks; frontend typecheck/build, API bundle, exact local 48-record publication/replay and single-call replay passed. Prepared desktop/mobile previews checked; hosted Supabase acceptance remains pending. Full API typecheck has the same 17 pre-existing Xero declarations errors.

**No schema, data publication, grants, optional flag or website deployment has been applied in this batch.** Next action: owner approval of the linked exact package, then guarded publication/read access/deploy and signed-in checks. The initial historical supplement does not change the enabled financial daily feed; future supplemental monthly refresh needs its own reviewed workflow. No provider transactions, production change, extra service or spending.

Plan hash `05e6ace2953f8857a064aa7cd58eae5c4c3ec4f87b6b3fe763c5dd62e43c0348`. Sensitive private artifacts/bindings are outside GitHub. Earlier progress notices below are historical.

---

## Cash and new Marketing data batch in progress — 20 November 2026

The current live design baseline is146e80c1c39ae25540a2f26f7ef7e0bca75582c5, including the separate /new-marketing Acquisition, Conversion and Retention tabs. That design, prior Marketing Efficiency, Plan and existing reporting connections are being preserved.

Prepared locally:24 closed months of separately reconciled synthetic cash and24 acquisition/retention/session summaries, bound to the isolated company's exact selected financial versions. Read-only staging source totals match the programme across all24months. A disposable PostgreSQL rehearsal loaded all48records and verified unchanged replay. Core cash/source/reader/RLS/browser checks pass; no staging schema, grants, data or deployment has been changed. Source privacy keeps raw fictional identity/bank proofs out of the browser and routine repository documentation.

The new Marketing cells now have prepared wiring for paid-first CAC, counts, refund-linked new/repeat revenue and separately labelled simulated sessions/funnel inputs. A bounded matched-cost/cohort review is checking the remaining first-order economics/payback figures; unsupported figures stay yellow. The final exact-source/data/permission/website package will be presented for one bundled approval after that check. Daily feed/provider transactions, production and budget remain unchanged.

---

## Live and signed-in verified — New page connections, 20 November 2026

**950baf935c33ac7c00cbdc53f3be6e93bebab81a is live**, preserving the newer115a6117 Plan. [Hosted verification](https://github.com/PaulLantsbury/virtual-cfo/blob/e27c041452669a96c75606b48472fc4aa9029d99/docs/new-pages-full-connections-hosted-verification-2026-11-20.md) records real twelve-month Profit/Cash profit-reference history, Marketing financial history/conditional scenario, October/September per-order comparisons, company switching and zero observed browser/application errors.130 local tests, TypeScript and production build passed. The earlier release hold is resolved; no repeat release approval is needed.

Next: prepare separately reviewed synthetic cash inputs/reader, then matched acquisition/cohort evidence. Cash bank/movement/resilience and customer metrics still remain yellow/unavailable; New Plan remains explicitly sample. Daily-feed/provider/database/production settings unchanged. Genuine overnight acceptance remains a separate milestone. Twelve-month source reads completed interactively; formal latency/load benchmarking remains outstanding.

---

## Release held to preserve newer live Plan — 20 November 2026

The approved2ec14a6 deployment was not triggered: preflight found newer live Plan115a6117. Exact tested union **950baf935c33ac7c00cbdc53f3be6e93bebab81a** preserves all eight live Plan application/test files and all approved connections; independent file comparison,130 tests, TypeScript and production build pass. [Concrete amendment](https://github.com/PaulLantsbury/virtual-cfo/blob/10e935954ead2c81f79745534cd98539a365f832/docs/new-pages-connections-preserve-plan-amendment-2026-11-20.md) awaits exact-source website approval. No hosted settings, database, provider or feed changes were made. Current staging remains115a6117. Next: approve amended website source, deploy and verify the signed-in pages, then separate cash/acquisition evidence work.

---

## Tested connections package awaiting website approval — 20 November 2026

Implemented and published exact source `2ec14a6d16905fd64bd18bb2fc0bab14c4bb39ab`: Profit monthly trends/full comparisons, Marketing monthly financial history/targets/conditional scenarios, and a separate Cash EBITDA history. **112 tests, TypeScript and production build pass**; local browser controls checked with labelled fixtures. [Concrete website-only release package](https://github.com/PaulLantsbury/virtual-cfo/blob/543c5ca92bccee042a701424f260b54fc2b9d4c7/docs/new-pages-full-connections-staging-release-2026-11-20.md). Not deployed; staging remains a77e658 until approval.

Read-only staging confirmed zero cash snapshots for the isolated synthetic company. Cash adapter/evidence builder is prepared only; cash and acquisition source publication/permissions are separate future packages. Existing daily feed, provider jobs and production remain unchanged. Next: approve exact website deployment, verify real selected-month inputs/company switching/history latency, then prepare isolated cash/acquisition evidence. Earlier prepared/publish-next wording below is historical.

---

## Full figure audit — 20 November 2026

The comprehensive [New pages figure and calculation audit](https://github.com/PaulLantsbury/virtual-cfo/blob/e41eebdd3ca991d09236208fec0333b74b647126/docs/full-figure-lineage-audit-2026-11-20.md) covers all three New pages, including expanded charts/tables, comparisons, scenarios and saved local records. It traces deployed source `a77e65822345087aa708fad19c98bbf3e9a73b21`. The earlier 4-of-13 gap count covered headline cards only; it was not a full-page count.

A figure derived on the server or in the browser from verified database inputs is connected; it does not require its own stored database cell. User assumptions are separate labelled inputs. Sample baselines remain examples even where their arithmetic works.

Next batch, in order: wire eligible multi-month financial trends/comparisons to existing reviewed monthly inputs; define and connect missing cash balance/movement and customer/acquisition inputs; then update sample planners to use verified baselines while retaining explicit assumptions. Do not infer daily/weekly data by dividing monthly totals. Maintain yellow example/unsupported indicators and unavailable states for missing evidence. See the three page registers for individual formulas, sources and required work.

This checkpoint publishes documentation only. Website release, database permissions, provider jobs and daily-feed settings are unchanged. The first unattended daily publication remains a separate verification milestone.

---

**New pages released and verified — 20 November:** Approved website revision **a77e65822345087aa708fad19c98bbf3e9a73b21** is live. October financial figures, per-order/earlier-month comparison, yellow unavailable/sample states and store-change clearing were signed-in verified. New Plan is preserved; TypeScript/builds and 119 tests pass. [Hosted verification](https://github.com/PaulLantsbury/virtual-cfo/blob/b47c91153fbebe262c58523ba05486aef9c0f43f/docs/new-pages-hosted-verification-2026-11-20.md). Cash reconciliation and acquisition/cohort evidence remain separate gaps. No database/provider/daily-feed change occurred. Next: genuine 21 November 02:00 London daily-feed receipt acceptance and the next evidence package; do not repeat the completed website release.

# Night Scout handover — 20 November 2026

Read the [current roadmap](roadmap-2026-11-20.md) and [approved paid package](daily-feed-2gb-release-review-2026-11-20.md). The full paid package was approved and applied. Do not ask for the same approval or repeat completed setup.

## Verified applied state

- Pro subscription was upgraded by the owner. Existing staging was resized to Small / **2 GB RAM**, healthy; reviewed capacity and idle-reserve gates passed. Disk allocation remains unchanged; the included 8 GB disk allowance is separate from compute memory.
- Exact source **cc5b9363b2936aa38a2be4d77982c8638aac0ed3** changed only the inspection helper. Stored helper hash **3ac48f815453db116edc467c972f88778e2be48ec493eaa6954f6a56c1d5d645**, guarded installer **11dc291516d63f5f5c647f6ccf8e3beb03f24007a9b5ff246309125eec44c7fb**. Financial definitions and immutable inputs are unchanged.
- Approved publication attempt three committed exactly **5–19 November**. Each of the **15 receipts** passed independent inspection through a fresh restricted connection; all **17** company relations matched source expectations. The original **14-relation** example and **22 protected global** fingerprints remained unchanged.
- Published horizon is **19 November**, with **24 unchanged monthly seals**. All **45** reviewed daily inputs through **19 December** remain staged; 30 await their future daily windows.
- Temporary catch-up membership was revoked and the exact reviewed bridge retirement completed. The retirement artifact was unchanged; execution used bounded session limits. Normal catalog/statistics checks returned zero findings; existing administrator read-only inheritance was unchanged.
- Do not restage the 23 batches, repeat expiry adjustment, reinstall capability/login/helper or re-arm the retired bridge. The one further financial attempt is consumed successfully.
- Runtime remains **fb5beb6ccb2f38df9d535ad96136747b5c0ab45e**, separate runtime branch, automatic deployment off.

**Recurring feed enabled; first unattended update still awaiting verification.** Exact private settings and their separate fingerprint were verified. Hosted restricted TLS/session checks passed, then the final financial configuration read the reconciled 19 November receipt with `mutationAttempted=false`. The ordinary programme is enabled; the existing Render service is live on exact runtime **fb5beb6ccb2f38df9d535ad96136747b5c0ab45e** with recurring append mode, schedule `0 1,2 * * *` UTC and automatic deployment off. The winter 01:00 run is outside the write window; the first eligible publication is **21 November 02:00–02:15 London** for 20 November. No manual append was triggered.

## Resume next

Verify the **genuine 21 November 02:00–02:15 London** scheduled publication for **20 November**, and reporting readback. This remains outstanding until observed. A successful historical repair, file/TLS check or manual inspection is not proof of unattended daily operation. Do not manually append the next day to manufacture that evidence.

Then continue v11 page wiring and full visual/mobile acceptance, the ten-second rule and **Explore the Numbers**. Existing tables and live page designs do not prove every chart, insight and dynamic link. Cash, cohorts/attribution, planner persistence and monitoring delivery each retain their own evidence gates.

The fictional company remains **£750,000 annual net turnover and four employees**, UK gifting seasonality, VAT and outsourced fulfilment. Preserve original January 2025, Store D, other stores/customer data and separate Shopify/Xero provider acceptance.

## Finite limits and safe stopping

The programme ceiling remains **19 December**; restricted-login expiry is **20 December 03:00 UTC**. A missed window, drift or uncertain result requires independent inspection and a fresh bounded proposal where needed. No automatic catch-up, extension, financial retry, higher memory tier or downgrade.

No website deployment, provider transactions, production changes or new service were included. Preserve spend cap, but do not call it a compute cap. Private connection files, credentials, private pins, account bindings, live fingerprints and raw catalogs stay outside GitHub. Private operator evidence records the exact execution, receipt checks and delivery checks.
