# First financial import — local prototype

`experiments/shopify/import-first-evidence.mjs` converts an existing current candidate into raw order/refund rows and matching finance evidence in one transaction. This first version only accepts a store with no existing orders, refunds or coverage records; replays and incremental updates are refused rather than overwriting evidence. It is not an HTTP endpoint and has no live configuration or deployment.

The writer locks source/settings/candidate/evidence dependencies, confirms the requested candidate remains the current head, checks the store identity/currency/timezone and source versions, and recomputes the mapping from retained source data. Blocked, excluded or empty event sets are refused. Only the already supported unedited tax-exclusive single-sale mapping is accepted.

Original successful sale/refund timestamps populate raw event times. Store-local event dates, actual tax components and matching raw snapshots populate evidence. The original net product amount is stored before later refunds; refund payments stay separate. Historic costs are not invented. The first coverage row is always false: matching transaction evidence does not establish completeness. Although the existing mapping view calls matching evidence 'verified', public financial completeness remains false until independent review. Existing legacy aggregate columns are not a new certification of older dashboard calculations.

The trusted administrative caller supplies the transaction database. The restricted review login must not be used or expanded to run this importer. Remote importer provisioning, invocation/authentication, batch/import audit linkage, incremental updates and source-to-customer/product/order-item mapping remain future work. No staging or production data was changed by this package.

Focused tests cover import/reconciliation with February sale and March refund, coverage remaining false, other-store preservation, replay refusal, stale source refusal, and late-error rollback of all inserted records/evidence.

The full Shopify/source/review suite passes: 64 tests, including the three new import groups.

## Restricted importer role — local proposal

The importer now uses a fixed lock-only definer helper so it does not need source UPDATE privileges simply to acquire transaction locks. Apply the new proposed ingest_v1_import_service.sql in disposable environments before using this version. No migration has been applied remotely.

The proposed NOLOGIN/NOINHERIT role can read required source/candidate/evidence tables and insert raw records/evidence. Coverage insertion/update is constrained by RLS to false; head updates can only require recheck. These update grants allow existing invoker invalidation triggers to work while prohibiting restoration. Raw updates/deletes/truncates, permission grants and candidate writes are not granted. This is a trusted internal capability across stores, not a tenant-facing authorisation boundary; it can insert records or invalidate coverage and must remain behind a separately reviewed service. Database grants do not enforce the application's empty-store rule by themselves.

Four focused test groups pass, including actual SET LOCAL ROLE import success and denial of certification, source overwrite/delete/truncate, clearing recheck and granting role membership. A dedicated login, route, credentials and remote setup remain absent. Repeat imports are still explicitly refused pending audited idempotency design.

Full regression after this change: 65 Shopify/source/review tests pass.

## Safe repeat requests — local proposal

The new ingest_v1_import_receipts.sql follows the importer-role proposal. A receipt is written in the same transaction as the financial rows; its primary key and scope foreign key bind it to one candidate batch. Receipts retain the candidate fingerprint, counts and completion time and reject update/delete/truncate. The importer role can read/append but cannot mutate history. This records a technical import, not a human review or proof that present-day figures are still correct.

Under the existing dependency locks, a retry checks for a matching receipt before inspecting the current candidate head or inserting rows. It returns already_imported with original counts and never changes records, verification flags or recheck state. Fingerprint inconsistency is refused. Changed/new batches still cannot overwrite an occupied store. No automatic retry follows an uncertain commit; a later explicit retry can inspect the committed receipt.

Six focused groups pass, including restricted-role retry, one-receipt behaviour, preserving subsequently verified or invalidated status, append-only enforcement and rolling back records if receipt writing fails. Actual concurrent importer connections have not yet been exercised in standalone PostgreSQL; that is the next verification step. These changes remain local/draft only, with no staging migration or runtime enablement.

Full regression after retry support: 67 Shopify/source/review tests pass.
