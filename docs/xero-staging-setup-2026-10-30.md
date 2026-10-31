# Xero isolated staging setup — 30 October 2026

## Approved and applied

Paul explicitly approved the separate Free consent operator, a separate generation cron within a US$5 incremental trial budget, the two reviewed staging SQL packages, the separate writer app with Xero's platform terms/security commitment and no model training, and the exact bounded trial. This approval does not remove actual readiness or owner credential-entry gates.

The exact proposal remains `xero-staging-20261030` / `daily-xero-20261030-v1`, 30 October–5 November, at most seven £10 NoTax non-stock posted GBP Demo Company invoices and £0 paid. Missed days skip. Hard stop 6 November 00:00 UTC. Do not extend dates or reset history. Hosting billing is separate from programme expiry: the approved budget is not authority for an indefinite paid resource.

- A separate Free operator host was created and its first deployment succeeded on the reviewed source revision. Its `/health` endpoint responded; its root refused sign-in while bootstrap was off.
- A separate generation cron was created on the smallest compute plan with `0 18 * * *` UTC and generation explicitly `false`. Its first build succeeded. A credential-free hosted shell smoke returned `prepared-disabled`, seven proposed actions and `configurationBound=false`; no provider job or scheduled financial action was triggered.
- The separate Xero Web app was created with the actual operator callback, no AI model training, and the approved platform terms/security commitment. It had zero connections. No client secret was generated or entered by the agent.
- `xero-restart-proposal-2026-10-29.sql` and `xero-member-active-tenant-binding-2026-10-30.sql` were applied once to verified Night Scout Staging. Do not reapply them from their historical proposal comments.
- Post-application read-only checks returned all twenty metadata checks true: required functions/ACLs/RLS, denied reader-table access, closed underlying claim implementations and the preserved active Shopify binding. No new Xero programme, envelope, consent state or action existed.
- The member-role SQL probe returned one exact scope under `authenticated`, then rolled back. This is database scoping evidence, not a signed owner/JWT, MFA, Data API or reader-health test.
- The owner's aggregate verified TOTP factor count was zero. Strong owner authentication therefore needs an explicit owner-operated enrollment before consent. No account enrollment or security change was performed by the agent.
- Public staging pins and the existing official public Supabase CA were saved separately on the two new hosts. No reader credential, service-role key, customer-host secret or shared environment group was copied. Required private credentials remain absent.

Actual resource identifiers, deployment receipts, public configuration and operator evidence are retained in the private checkpoint. The original working reader and Shopify provider setup were not repointed or replaced.

## Compatibility and usable owner setup

Live Xero configuration showed a compact 32-character hexadecimal client ID. The isolated runtime now accepts that exact format alongside existing canonical UUID identifiers; it does not trim, change case or insert hyphens. Tests prove preservation in both the authorization URL and token authentication. Other owner, project, TLS, restricted-role and source gates are unchanged.

The owner page now offers **Set up authenticator** only after password sign-in and a fresh match to the configured existing owner when no verified TOTP factor exists. Enrollment requires the owner's explicit click. Supabase receives the request directly; the returned QR is displayed only as an encoded image, with a text-only manual key. Secrets are cleared on success, expiry, clear or leaving; delayed responses cannot restore them. No enrollment/recovery/removal is automatic and no factor secret, OTP or password reaches the operator server. The server still independently validates signed AAL2 claims and the current owner before consent SQL.

**Credential creation, entry and submission remain owner-only actions.** The agent must not click enrollment/generate-secret controls or inspect the resulting secret/QR/OTP. Complete those steps privately in the owner's browser; do not repeat the broken cloud takeover route or paste values into chat.

## Remaining sequence

1. The reviewed compatibility/authentication source and reader diagnostic are published; actual deployments of the operator, generator and existing reader were verified. Retain exact source/deployment receipts privately.
2. On the existing authorised reader host only, use the [organisation diagnostic](../deployments/nightly-staging/XERO-READER-ORGANISATION-CHECK.md) to establish actual API demo/currency facts. Its normal token rotation, lease and health writes are explicit. It collects no accounting evidence, adds no business-data request and copies no credential to a writer.
3. Keep bootstrap/generation off while completing the private writer app secret, restricted writer URL and separate writer encryption key. Genuine GBP Demo Company and existing synthetic contact/revenue-account selections must be proved, not guessed.
4. If the working reader is not the same genuine demo tenant, prepare a separately scoped reader and resolve that setup explicitly. Do not repoint the working reader or infer demo status from its name. Same-tenant metadata alone is not reader health.
5. Complete owner-operated MFA and the separately approved consent, confirm the newly seeded programme/envelope are disabled, then verify exact source/database/reader readiness before any generation activation.
6. Acceptance still requires an actual scheduled provider invoice, durable confirmed action and next real matching-tenant accounting read. No paid cash receipt, dashboard completeness or production readiness is inferred from setup.

## Validation

Final root regression: **118 tests passed** across the retained integration checks plus client-ID compatibility, owner-operated enrollment, post-application verification and reader organisation diagnostic. Independent review found no blocking source issue. Diff whitespace checks passed. These checks do not prove owner credential entry, live MFA, writer consent or scheduled invoices. The customer frontend is unchanged; the previously recorded backend-wide TypeScript limitation remains.

## Actual organisation finding after publication

The hosted diagnostic on the existing reader completed successfully: `organisationVerified=true`, **`isDemoCompany=false`**, `currency=GBP`, preflight connected/organisation/ok and no accounting collection. Normal reader credential rotation/lease/health persistence completed; no credential was copied to a writer and no reader target was changed. The separate Demo Company (UK) is accessible in Xero with its explicit fictional-data banner, but has no verified API tenant binding or reader/writer consent yet.

This mismatch blocks the approved demo-only writer trial. The [separate demo-reader proposal](xero-demo-reader-proposal-2026-10-30.md) explains why adding another eligible connection to the legacy schema could break its single-job discovery and proposes a separately scoped store/schema/roles/RPC/runtime. The new implementation and database/consent scope remain unapproved; preserve the working reader. Private writer credential entry and owner MFA remain owner-only steps and do not resolve this mismatch on their own.
