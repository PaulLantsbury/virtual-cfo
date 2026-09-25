# Proposed exact profit staging fixture and recovery — 13 September 2026

Prepared helper: `experiments/financial-v1/profit-staging-fixture.mjs`. Read-only preflight: `db-migrations/proposals/profit-preflight-20260913.sql`. **Applied to staging on 13 September following explicit approval; see execution record below.** No runtime import, automatic execution, grants or production work. The helper requires the existing source/evidence schema and proposed private profit evidence tables. A controlled existing synthetic reviewer identity must be supplied; no password or user identity is embedded in files.

## Exact planned mutations

New Store D only: `90000000-0000-4000-8000-000000000004`, domain `night-scout-profit-fixture-d.invalid`, GBP, Europe/London, name “Staging Synthetic Profit Store D”. Every other source/version UUID has prefix `94000000-0000-4000-8000-` with suffixes exported in `PROFIT_STAGING_IDS`:

| Object | IDs / count |
| --- | --- |
| Orders | suffixes1,2; two February15 paid original orders |
| Order lines |3,4; one unit each, linked to those orders |
| Refund |5; March5 linked to order1 |
| Overhead categories |6,7,8: synthetic variable expenses, ordinary overhead, D&A |
| Overhead entries |9,10,11: February GBP15,20,5 actual tax-supported period amounts |
| Advertising daily row |12: February15 GBP10, channel other / source manual, explicit synthetic proof |
| Profit versions |20,21,22: February/March/April |
| Sales evidence |Two order and one refund evidence rows linked to existing mapping snapshots |
| Sales coverage |Three complete synthetic-only calendar-month records, explicitly not real-store certification |
| Historical line cost |February lines1/2 at GBP40/20; April repeats original line1 cost evidence in its new version |
| Saleable recovery |One April5 warehouse event for one unit of line1, independent of March refund |
| Expense evidence |Four February source references; March/April complete explicit zero-expense fixtures |
| Profit coverage |Three sealed component manifests, complete only for this synthetic acceptance set |
| Access |One `public.store_memberships` row linking supplied **existing** user ID to Store D; no `auth.users` creation or privilege grant |

The proposed membership is an access change requiring inclusion in separate staging approval. Tests use their own synthetic auth user; actual execution must privately verify the intended existing Paul's user ID. Existing A/B/C access, source rows, coverage, import receipts and review audit are not updated by the helper.

## Independently reviewable amounts (GBP)

February order1: gross100, discount10, net90, shipping5; actual VAT gross20, discount2, shipping1. Order2: gross50, no discount, no shipping, VAT10. AOV140÷2=70 before later refunds. Historic landed costs40+20=60. Variable15 and advertising10; overhead20 plus D&A5.

| Month | Net product sales | Net shipping | COGS | Gross profit | Contribution after marketing | Operating profit | EBITDA |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| February |140|5|60|80|60|35|40|
| March |−70|−5|0|−70|−75|−75|−75|
| April |0|0|−40|40|40|40|40|

March refund cash90 comprises product84 (VAT14) and shipping6 (VAT1), so event-period reductions are70 and5. It does not reverse COGS. April saleable-stock event reverses original evidenced cost40. March and April have no original orders, hence original AOV unavailable, not zero. All amounts are test evidence, not real-store estimates.

## Transaction, replay and failure handling

`setupProfitStagingFixture(db,{userId,readSales,failAt})` uses one transaction. All source/sales evidence and three coverage periods are inserted before any profit manifest is sealed. It invokes the real mapped-sales callback inside that transaction to obtain current evidence revisions, then computes exact planned line/expense digests **before** inserting immutable versions; no mutation of a sealed manifest is required.

If Store D/domain already exists the helper refuses the whole operation, whether unchanged or changed. This deliberately provides safe replay refusal, not a silent upsert/no-op. UUID or source-reference conflicts also abort. No source deletion, overwrite or automatic repair exists. `failAt:'after-sources'` or `'before-commit'` are explicit test-only rollback injection points; normal setup omits them. They must leave no Store D rows on failure.

Preflight gives compact object/column-count diagnostics, selected source-enum constraints, RLS/grants and current D/prefix collisions, plus existing store/order/refund/coverage baselines. The SQL itself cannot prove the connection project; separately confirm staging `bioalckltvkhlczusdvl`, never original `futkktdebdygsdrcknpr`. Preflight output contains no secrets but may include private source metadata and belongs in private audit records. Resolve any schema drift or collision before a reviewed application attempt. The preflight is diagnostic, not automatic approval.

## Recovery plan and readiness

Before commit, any error rolls back this complete fixture transaction. The private schema proposal itself is a separate atomic transaction: if fixture creation then fails, leave its empty private tables in place pending review rather than automatically dropping schema.

After a successful fixture commit, do not rerun or delete/rewrite immutable evidence. Keep the isolated synthetic store out of actual reporting by withholding/reviewing access as a separately approved operation; preserve its records for investigation. If evidence must change, prepare a new explicit version and reviewed supersession selection. Reverting the application reader does not require modifying A/B/C data. Destructive store deletion or disabling immutable guards is not the recovery plan.

Focused live staging checks and a controlled execution entry point are now prepared (below). Execution still requires explicit database/access approval and a verified privileged staging connection. Current helper is not wired to the running app. A member-scoped public profit API, runtime roles, active-version selection and actual Profit Overview integration remain separate work. This package prepares exact contents rather than applying them.

## Disposable verification

Five actual mapped-sales integration groups pass against the saved staging bootstrap plus exact evidence/profit proposals: February/March/April bridge, user membership/settings, source invalidation with dependency preservation, replay/immutable rejection and early/late rollback. The initial run caught unsupported invented enum strings for expense source and marketing channel/source; helper now uses existing `manual` / `other` values with synthetic provenance retained in evidence references. No schema relaxation was made. Read-only preflight is a compact diagnostic; full schema signatures must still be compared when actual drift is suspected.

## Live read-only checks and controlled entry point

On 13 September the coordinator inspected staging project `bioalckltvkhlczusdvl` through its authenticated SQL console. Focused checks found all five proposed profit tables absent, all eight relevant public source tables with RLS enabled, no Store D ID/domain or reserved source-ID collisions, and exactly one existing account matching Paul’s nominated review email. Mapping/source columns and expense enum constraints were compared with the saved baseline. The existing verified-sales function is present. These were focused read-only queries, not execution of every statement in the preflight file; existing-store counts and complete schema signatures must not be described as freshly certified. No database or access writes were made.

`scripts/profit-staging-setup.mjs` defaults to `--plan` without connecting. `--preflight` requires a private direct staging connection. `--apply-approved` additionally requires the exact approved schema and fixture SHA256 values plus the privately verified existing reviewer user ID. It rejects other projects, URL query overrides and nonstandard ports, supplies explicit connection fields and requires certificate-verified TLS. It checks the existing user and refuses an occupied proposal/store before applying the schema, then creates the fixture and reconciles all expected figures. Keep connection credentials outside committed files and chat. A suitable privileged connection has not yet been verified; the current restricted application login must not be assumed capable of setup.

Approved-content candidates:
- Schema SHA256: `a99ac9415d8328a41960825c393a8ee6fbc4b868a25dc697568c0b6a9fda67bb`
- Fixture SHA256: `f850a41ab3151ed2f4088862c75931d8076e9b69c9e791abd64647242c56ebcb`

Schema and fixture use **two separate atomic transactions**, not one combined transaction. A failed fixture can therefore leave the new empty private schema. Post-commit reconciliation failures preserve committed evidence for investigation. Neither case triggers automatic deletion or replay. The plan command and invalid-target checks were verified without connecting.

The combined integration, profit contract/schema, calculation and sales-adapter regression run passed **63/63** tests. Re-run the five staging integration groups using `pnpm test:profit-staging`. No frontend code changed, so no new frontend build or preview deployment is claimed. Actual profit routes, runtime permissions/version selection and page integration are still outstanding.

## Approved staging execution — 13 September

Paul approved the exact schema, synthetic Store D fixture and existing-account membership. The controlled operator connected to the verified staging project with certificate-verified TLS and the privately supplied operator password. Full read-only preflight passed: proposal/guard absent, reserved IDs clear, compatible source constraints and existing account present. The exact recorded schema and fixture hashes were applied once; no replay occurred.

Five private tables and the immutable guard were installed, followed by the complete fixture transaction. Initial post-commit verification passed February but rejected March/April: PostgreSQL DATE values decoded by the driver in UK summer time were converted to UTC and shifted back one calendar day. The reader now requests explicit SQL date text for scope, original sale and recovery comparisons. No financial formula or stored evidence was changed to repair this. A dedicated regression simulates the driver’s previous-day UTC values and verifies March scope and April recovery date.

After the reader correction all expected figures reconcile against live staging for all three months: February operating profit GBP35, March GBP−75, April GBP40. Combined regressions pass 64/64. Read-only postchecks confirm five private tables with RLS, zero client table grants, exactly one membership for the approved existing user, and unchanged A/B/C store settings, order/refund counts and coverage baselines. This comparison is not a full byte-for-byte database snapshot.

The temporary password file was removed after verification; credentials were not committed. No production/Replit changes, public profit endpoint, runtime role grants or financial-review approval were performed. Membership provides Store D access through existing membership-aware features; a profit screen is still pending. Next: prepare the member-scoped profit read API and explicit version selection, then connect the appropriate actual-reporting pages and verify their agreement.
