# Historical synthetic staging application package — 18 September 2026

Status: **prepared and tested in disposable PostgreSQL only; not applied**. A restricted, read-only staging preflight was performed on 18 September. It confirmed the exact staging project, a vacant reserved target and existing reviewer membership/review authorisation, but could not read `auth.users`; it also found a schema-contract mismatch. No live writes, new account, permission grant, Shopify write, Replit change or recurring job accompanies this package. The nightly worker remains separately governed by its fixed-date deployment decision.

## Exact proposed change

The generator is `experiments/financial-v1/historical-staging-package.mjs`. Call `prepareHistoricalStagingPackage` with all four explicit inputs: staging project `bioalckltvkhlczusdvl`, direct host `db.bioalckltvkhlczusdvl.supabase.co`, database `postgres`, and the UUID of an **existing, separately approved synthetic reviewer**. There is no default reviewer, database connection adapter or executable apply command. The disposable tests use a fixture identity; it must never be substituted for an actual approved staging account.

The dedicated new store is `90000000-0000-4000-8000-000000000007`, domain `historical-pipeline.invalid`, Shopify-store identifier `synthetic-historical-v1`, name “Staging Synthetic Historical Store”, currency GBP and timezone Europe/London. It is separate from PocketLaunchpad1 and existing synthetic stores. Only one new membership links the explicitly selected existing reviewer to this new store. No auth user or review-service authorization is created.

The generated transaction inserts 912 rows in 15 existing relations:

| Content | Rows |
| --- | ---: |
| Store and membership | 1 each |
| Original orders and matching original-sale evidence | 132 each |
| Refunds and matching refund evidence | 2 each |
| Exact sales coverage periods | 15 |
| Invented original line-item sources | 132 |
| Invented expense categories and actual expense records | 115 each |
| Complete-month profit versions and seals | 13 each |
| Historical landed-cost evidence | 127 |
| Independently dated saleable-stock recovery | 1 |
| Classified expense evidence | 111 |

Coverage comprises August 2025–August 2026, September 1–17 2026, and the matched September 1–17 2025 sales scope. Profit is sealed only for the 13 complete months. The four partial-September expense records remain unsealed; there is no September profit version. The 127 cost-evidence records represent 126 complete-month original lines plus the February line required to support the April recovery. The source manifest contains 132 orders because September also has six originals.

This route deliberately installs a **direct invented financial ledger**, not an imported Shopify candidate. The generator retains the manifest's evidenced tax bases and actual recorded VAT. It does not use the tax-exclusive API-shaped equivalents employed by the separate importer lifecycle fixture, does not certify external-source completeness, and does not demonstrate tax-inclusive Shopify collection support. All amounts and coverage statements are explicitly synthetic. Fixed source/evidence timestamps are reproducibility markers, not claims about when a live import occurred. No customer/contact identifiers are supplied.

## Generation and guards

Generation builds and closes an isolated PostgreSQL database, freezes its synthetic timestamps, then exports explicit inserts from PostgreSQL text snapshots. Keeping numeric JSON text intact preserves the sales-revision and immutable-cost bindings; generated columns are allowed to recompute instead of being explicitly inserted. No schema/default changes from the preparation database are exported.

The result includes `manifestSha256`, `schemaSha256`, `sqlSha256`, exact row counts, reserved version IDs, and five SQL artifacts: `preflightSql`, `rehearsalSql`, `applySql`, `postflightSql`, `rollbackSql`. Identical inputs produce identical output. The apply hash covers the complete transaction including its final COMMIT; the rehearsal is the same transaction ending in ROLLBACK.

The transaction refuses absent/wrong target or reviewer attestations, an absent reviewer or a reviewer without an existing membership, any occupied target store/domain/source-store identifier, and differing table layouts, constraints, generated-column definitions or trigger implementations. Primary/unique-key collisions also abort the entire transaction. It never uses an upsert or updates existing sources. It has five-second lock and sixty-second statement timeouts. Missing installed schemas are a stop, not permission to install them.

**Connection verification is still mandatory.** SQL session settings are operator attestations and cannot prove a PostgreSQL host identity. Before any execution, the operator must independently verify a TLS-validated connection to the exact staging host/project above; production `futkktdebdygsdrcknpr` is excluded. Only then may the same session explicitly set `night_scout.approved_project` and `night_scout.approved_reviewer` to the approved project and exact reviewer UUID. The package never sets these attestations itself. Do not paste connection strings or credentials into the package or documentation.

## Preflight, application and postflight sequence

1. Read-only inspect the actual connected staging target, installed schema/reader versions, reserved IDs/domain, existing reviewer identity and current memberships. Record the chosen reviewer privately and establish that it is the approved synthetic-review account. Capture fingerprints of existing source/evidence/coverage/membership relations before changes.
2. Generate the reviewer-bound package and record its manifest, schema and SQL hashes. Inspect `preflightSql` under the verified staging connection. It is a read-only transaction; a schema mismatch requires reconciliation and a new tested package rather than weakening the guard.
3. Present Paul with the exact new store, reviewer membership, counts, hashes and preflight result. Obtain the separate staging-data application approval. Preparation and development-branch publication are not this approval. A rollback rehearsal on staging itself also performs temporary writes and belongs inside that approval.
4. After approval, run the exact guarded transaction once. Pre-COMMIT postflight verifies every target table's count and complete row fingerprint, including sealed manifests, and checks that September has no profit version. On any failure explicitly ROLLBACK the aborted transaction; do not retry automatically.
5. Independently run the read-only `postflightSql`, the real authenticated sales/profit reader checks for all 13 complete months, matched September sales and withheld partial profit, then the signed-in staging UI checks. Compare all earlier-store fingerprints with preflight. Confirm existing memberships are unchanged except the one approved addition. Record the installed hashes and distinguish applied from browser/live-verified state.

The current package completed the safe parts of step 1 on staging on 18 September. The restricted TLS connection confirmed project `bioalckltvkhlczusdvl`; the reserved store ID/domain/source-store identifier had zero rows; and the selected reviewer had an existing membership and review authorisation. The role was denied access to `auth.users`, so the reviewer account's existence remains unverified by that restricted role.

The package then stopped as designed: all 154 target columns agreed with the disposable bootstrap, while the full schema contract differed. The live target reported 95 constraints and 10 triggers; the disposable bootstrap reported 221 constraints and 5 triggers. This is a material compatibility question, not evidence that any source data is wrong. Do not bypass the gate, create grants, or apply this package. Reconcile the contract with a read-only, least-privilege schema inspection and produce a newly tested package before seeking staging-data approval.

## Rollback and uncertain outcomes

`rehearsalSql` always ends in ROLLBACK and leaves no rows in disposable testing. `rollbackSql` is only `ROLLBACK`, intended for an open or failed transaction. It is **not a post-commit removal script**. The private evidence model is append-only; no deletion or trigger disabling is proposed.

If the client loses its connection around COMMIT, preserve the database and use exact read-only postflight to determine whether the whole package exists. Never replay an uncertain transaction or clear occupied IDs. A committed package needing removal/correction requires a separately reviewed plan; leave existing evidence intact in the meantime.

## Disposable verification

Three tests in `experiments/financial-v1/historical-staging-package.test.mjs` cover deterministic generation, unsafe target rejection, exact SQL rehearsal/application, unchanged existing rows, all 13 independent fixed profit expectations, supported September sales with withheld profit, replay refusal, missing reviewer membership, occupied store, schema drift and postflight detection of altered evidence sources. These tests execute only against newly created PGlite databases. They do not exercise a live staging connection or establish deployment approval.

Financial highlights remain February net products £460 / operating profit £197, March net products £690 / operating profit £308, April £15 cost recovery / operating profit £357, and August 2026 net products £960 / operating profit £466. September 1–17 sales are £480; monthly profit remains unavailable.

Activation decision still required: **approve the exact new synthetic store and one membership after an actual read-only staging preflight identifies the reviewer and confirms the package contract**. Daily Shopify transaction generation, rolling-window deployment and production remain separate work.
