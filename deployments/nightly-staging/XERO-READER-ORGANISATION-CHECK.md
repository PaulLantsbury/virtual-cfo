# Existing reader organisation diagnostic

Source/test preparation only. Run only in the **existing authorised Xero reader host** after source publication/review:

```sh
node deployments/nightly-staging/run-xero-reader-organisation-check.mjs
```

It uses the reader's existing pinned environment, restricted reader connection, lease and normal `createStagingXeroConnectionPreflight`. Do not copy reader keys/envelopes/database credentials into the writer or change the connected organisation. There is no new host, app consent, grant, scheduler or tenant assertion in this command.

The wrapper observes a bounded clone of the **one Organisation GET already made by that preflight**. It does not make another organisation request or select an accounting job, accounting evidence or a retry capability. It requires a single actual organisation object, an explicit boolean API `IsDemoCompany` field and valid ISO currency. A company name containing “Demo” is never proof. `false` is a genuine non-demo result, not an unavailable result.

Organisation facts are emitted only if the existing preflight returns connected after its normal persistence and successful lease release. Missing/invalid fields, malformed/ambiguous/oversized bodies, redirects or observation timeout leave `organisationVerified=false`, `isDemoCompany=null`, `currency=null`; the CLI exits nonzero. A connected preflight alone does not fill missing demo facts. The clone is capped at 262144 bytes and a default ten-second observation timeout, while normal provider fetches retain the preflight's existing timeout and redirect rejection. No raw response/name/ID/contact/token/error body is returned or logged.

**This is not a read-only database operation.** The normal authorised reader preflight can refresh/rotate its reader token and persist credential/lease/connection-health metadata. `readOnlySourceCheck=true` refers to the business-data check, not token/database immutability; `readerCredentialRotationMayWrite=true` is explicit. It creates no invoices/payments/contacts/accounts and performs no accounting collection. A failed lease release prevents a successful diagnostic result.

Output contains only verification/demo/currency flags, safe preflight state/phase/reason and the above boundary flags. It does not reveal the pinned tenant ID. Root must match this command's actual host/context to existing reader evidence rather than treating a synthetic test as live proof.

Validation:

```sh
node --test deployments/nightly-staging/xero-reader-organisation-check.test.mjs deployments/nightly-staging/xero-connection-preflight.test.mjs
```

Nineteen checks pass, including genuine false/other currency, name-based non-inference, missing boolean/currency, malformed/ambiguous/oversized/redirect/timeout cases, normal rotation/health persistence, no extra provider calls/accounting SQL and unsuccessful lease release. All responses/credentials in tests are invented. No live run was performed by the implementing agent.
