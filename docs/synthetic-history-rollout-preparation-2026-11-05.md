# History corrections, supported reader and staged rollout preparation

Subsequent checkpoint: the explicitly approved staging application and signed-in checks are recorded in [hosted history acceptance](synthetic-history-hosted-acceptance-2026-11-05.md). The preparation-only statements below describe this package before that approval; daily scheduling remains off.

Status: implemented, independently reviewed and rehearsed locally. No hosted schema, financial data, access policy, application deployment, environment setting, provider transaction or recurring schedule changed in this batch. The existing January example remains the current hosted checkpoint.

## Delivered behaviour

The private v2 history now supports an immutable, explicitly reviewed **expense-accrual amount correction**. Preparation records the exact company, month, source event, predecessor version and proposed amount. A separate approval/rejection record precedes publication. Publication retains the original source and seal, appends the correction and selected-version history, and refuses a stale predecessor. The reader requires the explicitly selected version after replacement; it does not fall back to an old or arbitrary latest result. Both cross-period pointers and a rollback to a valid but superseded version fail closed.

This is a bounded correction type, not a general accounting editor. Sales, refunds, original dates, quantities, inventory corrections and their cross-period dependency graph remain unsupported. The financial scenario itself remains the agreed four-person, £750,000 profile; correction examples are disposable tests, not changes to the proposed initial history.

Durable request identities and receipts support read-only reconciliation after a simulated lost commit acknowledgement. Exact replay returns the original outcome without selecting an older version again. Tests inject failures at three publication points and require complete rollback. These are local deterministic failure simulations, not proof of a real network outage or independently concurrent workers.

## Supported page connection

Prepared an authenticated, optional history endpoint and `/supported-v11/history` page. The existing reporting runtime supplies the permission-checked database and bounded authentication client; the new service remains off unless separately enabled. Existing v1 reporting and fictional previews keep their own contracts and defaults.

The journey is **History → Month → Evidence version → Figures**. Month listings are reviewed sealed candidates only and explicitly require source validation on selection. The selected read recomputes sources and costs before returning figures. One scoped response feeds the shared cards and Explore the Numbers, retaining edition, opening basis, period, version, formula and separate source/observation dates. Missing cost components withhold profit instead of constructing it from unsupported subtotals. Cash, cohorts, channels, provider freshness and daily/custom-range reporting remain unavailable in this slice.

This is prepared wiring, not full Scout/Profit mockup parity or hosted visual acceptance. Native mobile, accessibility and representative-owner ten-second comprehension still require the normal design acceptance programme.

## Bounded initial rollout package

The offline exporter prepares the initial uncorrected two-year history beside the occupied January company. Private preflight binds existing membership, the isolated company, an absent v2 namespace and fingerprints for 22 protected relations. Generated account bindings, SQL and operational receipts remain private.

The staged form loads source-only parcels into a private area. It withholds the reporting contract, monthly coverage, seals and final run receipt until publication. Each parcel has an immutable digest/receipt, compares actual stored rows on replay and uses the shared company transaction lock. Serializable publication requires the exact parcel set, all ten initial-history table fingerprints, unchanged protected data, and empty correction/selection tables. Failed final publication leaves the staged sources private and reporting unavailable. Read-access preparation refuses an unfinished staged release.

Unknown initialisation first requires a namespace/ledger existence check. Subsequent inspection returns exact parcel receipts and actual/expected row fingerprints; a count alone is insufficient. Inspect before deciding whether an explicit exact replay is appropriate. Do not reset reservations, overwrite rows, delete the staged ledger or alter expected hashes to force acceptance. No automatic remote execution or retry helper is supplied.

The full prepared payload contains 92,504 retained journal events, 40,169 retained orders, 2,275 refunds, 41,764 product lines, 2,275 stock returns and 24 monthly seals. Journal counts include earlier original-sale dependencies as well as the 734-day reporting horizon. It is packaged into 146 bounded source parcels. The final initial history remains uncorrected and uses completed days through 4 November 2026.

## Validation

| Check | Result and scope |
| --- | --- |
| Independent correction SQL | Six groups passed, including immutable review, selected replacements, exact-month cost delta, stale publication, lost acknowledgement, source drift and superseded/cross-period pointer refusal. |
| Existing full-history SQL regression | Five groups passed on the changed reader, including 24 monthly reports, financial oracles, daily extension and preservation of the existing January trusted snapshot/service. |
| Independent staged-release SQL | Five groups passed: unavailable partial state, exact replay, failure rollback, missing parcels, actual body drift, final publication, detailed inspection and stray correction refusal. |
| Restricted read-access proposal | One test passed for original and corrected versions through the actual service with a representative restricted role; member isolation, browser denial, no server table writes/schema creation, unfinished-release refusal and access rollback were checked. Exact hosted-role acceptance remains pending. No live grants were applied. |
| Atomic exporter | One test passed for local rollback, commit, protected-data drift and occupied-target refusal. |
| Frontend shared suite | 66 tests and frontend TypeScript passed. |
| Actual SQL-to-page contract | One test passed through candidate listing, explicit version read, adapter and shared card/evidence results. |
| HTTP boundary | Four tests passed for disabled-by-default service, authentication, exact scope/version, response checks and safe errors. |
| Runtime/startup regression | Twelve tests passed, including optional history composition and existing permission/authentication safeguards. |
| Full-size staged rehearsal | All 146 source parcels plus final publication succeeded in a fresh disposable database. All 24 months were listed, January and October reads succeeded, and all 22 protected fingerprints stayed unchanged. The same financial payload/compiler used independently bound disposable preflight guards; the private hosted-bound SQL was not executed. |
| Builds | Frontend production build and server bundle passed. Full API TypeScript remains blocked by existing Xero declaration and library-output issues; the new history declaration was supplied. |

The automated groups total 101 checks; repeated focused runs are not additional tests. The full-size rehearsal is an additional manual acceptance script. Product/source review and tests are local evidence, not installation authority.

## Next authorised boundary

The concrete staged-load, read-only access and application package is prepared for explicit staging review. Apply only the reviewed private artifacts and exact web revision, inspect each durable outcome, then verify real server-role/authenticated HTTP and signed-in browser reads. Existing January and unrelated data must remain intact. No role with history write privileges or daily scheduler is activated by this package.

Real multi-backend contention remains unverified: no local PostgreSQL server/container runtime was available, and an overlapping read-only hosted lock probe did not establish actual contention. Therefore unattended daily operation still needs its own restricted writer, real concurrency/uncertain-outcome rehearsal and scheduling approval. Shopify and Xero provider tests remain separate; no retry, catch-up transaction or programme extension follows from this work.
