# First financial import — local prototype

`experiments/shopify/import-first-evidence.mjs` converts an existing current candidate into raw order/refund rows and matching finance evidence in one transaction. This first version only accepts a store with no existing orders, refunds or coverage records; replays and incremental updates are refused rather than overwriting evidence. It is not an HTTP endpoint and has no live configuration or deployment.

The writer locks source/settings/candidate/evidence dependencies, confirms the requested candidate remains the current head, checks the store identity/currency/timezone and source versions, and recomputes the mapping from retained source data. Blocked, excluded or empty event sets are refused. Only the already supported unedited tax-exclusive single-sale mapping is accepted.

Original successful sale/refund timestamps populate raw event times. Store-local event dates, actual tax components and matching raw snapshots populate evidence. The original net product amount is stored before later refunds; refund payments stay separate. Historic costs are not invented. The first coverage row is always false: matching transaction evidence does not establish completeness. Although the existing mapping view calls matching evidence 'verified', public financial completeness remains false until independent review. Existing legacy aggregate columns are not a new certification of older dashboard calculations.

The trusted administrative caller supplies the transaction database. The restricted review login must not be used or expanded to run this importer. Dedicated importer permissions, invocation/authentication, batch/import audit linkage, incremental updates and source-to-customer/product/order-item mapping remain future work. No staging or production data was changed by this package.

Focused tests cover import/reconciliation with February sale and March refund, coverage remaining false, other-store preservation, replay refusal, stale source refusal, and late-error rollback of all inserted records/evidence.

The full Shopify/source/review suite passes: 64 tests, including the three new import groups.
