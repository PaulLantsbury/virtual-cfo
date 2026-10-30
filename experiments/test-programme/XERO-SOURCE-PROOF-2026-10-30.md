> **30 October approved setup:** Separate hosts/app now exist and the two reviewed staging SQL packages are applied. Bootstrap and generation remain off; private owner credentials, actual MFA, genuine demo/source and matching-reader checks remain. See [the current setup record](../../docs/xero-staging-setup-2026-10-30.md). Earlier prepared/unapproved wording below records the package stage; do not repeat completed setup or reset dates/history.

# Xero source-proof path — 30 October 2026

Prepared/tested source only. No new host, live API call, SQL application, scope/grant, schema exposure, trial renewal or activation was performed. Existing Shopify code/settings/history are unchanged. Xero app/host/consent and programme approvals remain separate gates.

## What was missing

The existing OAuth callback verified a GBP Demo Company but returned only a disabled-consent state. Restart readiness then expected contact/account/reader claims that no actual source path produced. Calling the enabled-only writer refresh while disabled would be unsafe; copying bearer material manually is not a solution.

The opt-in path now uses the **fresh access token already in the isolated OAuth callback**, reads exactly the selected existing contact/account, and returns a narrow expiring proof. The owner session automatically verifies the current read-tenant binding at consent start. No access/refresh token is returned to the browser, stored in a URL or copied by an operator.

## Facts and confirmations stay distinct

The source verifier performs three fixed, scoped, bounded **GET** requests:

1. `Organisation`: exactly one organisation, `IsDemoCompany=true`, GBP.
2. `Contacts/{selected ContactID}`: exactly the selected existing active contact.
3. `Accounts/{selected AccountID}`: exactly the selected existing active REVENUE/SALES account, with a usable account code.

UUID validation prevents path/query substitution. Responses have time/size limits and reject redirects; names, email, address/bank fields and raw bodies are discarded. Only stable selected IDs/code, boolean facts, scope names, timestamps and provenance enter the proof. No invoices, contacts, items, payments or accounts are created/changed.

**“Synthetic contact” is an owner confirmation bound to the exact selected ContactID, not a fact inferred from a name.** Non-stock invoice use is similarly confirmed against the selected AccountID; active revenue type/code are API facts. The existing no-item/no-inventory invoice plan remains separate. Separate-writer-app provenance is the operator's app-boundary confirmation, not an assertion supplied by the Organisation API.

References: [Xero individual resource GETs](https://developer.xero.com/documentation/api/accounting/requests-and-responses/), [Contacts](https://developer.xero.com/documentation/api/accounting/contacts), [Accounts](https://developer.xero.com/documentation/api/accounting/accounts), [Organisation](https://developer.xero.com/documentation/api/accounting/organisation).

## Read-tenant binding is not reader health

The existing staging migration grants authenticated members RLS SELECT on `xero_v1.connections`. `createXeroOwnerSessionBindingReader` uses the freshly validated owner session automatically at `/connect` to request only `store_id,tenant_id`, filtered to this store's active connection, with at most two rows. It uses only a validated public anon/publishable key and existing owner bearer. It refuses missing, ambiguous, cross-store, redirected, oversized or denied results.

**Root inspected the actual Data API settings on 30 October: only `public` and `graphql_public` are exposed; `xero_v1` is not.** The legacy direct schema SELECT therefore cannot provide this live API binding and must fail closed. The setting was not changed. No private schema/table exposure, extra writer role, alternate database login or service-role-key fallback is authorised by this finding.

A narrow alternative is now prepared as an **unapproved SQL proposal**: `public.xero_member_active_tenant_binding_v1(uuid)` returns only the authenticated member's exact `store_id,tenant_id` binding, with explicit `auth.uid()` membership and unique-active-connection guards. It grants authenticated execute only; it reads no credentials or health evidence. The helper has a separate explicit constructor option `bindingTransport:'public-binding-rpc-v1'`, with no automatic fallback/default switch. SQL application and subsequent isolated runtime opt-in/publication remain separate reviewed steps; no live RPC call or application was verified. See [the exact proposal and checks](../../docs/xero-public-member-binding-proposal-2026-10-30.md).

The resulting branded receipt says `tenantBindingVerified=true` and `readerHealthVerified=false`; it has **no `connected=true` field**. Only that safe ten-minute metadata receipt is held in process under the one-use OAuth state digest. No owner bearer is retained. A process restart/lost or expired receipt fails closed and requires a fresh owner sign-in/consent attempt; no new persistent session schema was added.

An exact authenticated binding match permits **disabled** programme/envelope seeding after selected source facts pass. The callback explicitly returns health-unverified limitations and `activationAuthorized=false`. Restart readiness still blocks until genuine reader-health acceptance is supplied independently. A tenant mismatch or conflicting current binding/health evidence produces `source_proof_incomplete_programme_not_bound`; bad source facts fail without seeding. The legacy callback/requests are unchanged when proof is off.

The optional strict `createXeroReaderContextProofSource` can run a single membership-bound **SELECT** within an **already authorised, independently authenticated read/audit context**. It returns only tenant identity and latest/current-credential connected-preflight metadata, rejecting stale, failed, ambiguous or tied conflicting observations. Its query reads no ciphertext/tokens/passwords. It is **not wired to the restricted writer pool** and does not grant that pool reader-table access. Do not put audit/admin/reader credentials on the writer host to satisfy this port.

## Explicit isolated-runtime configuration

Proof is off by default. Only on the separately reviewed operator host:

- `NIGHT_SCOUT_XERO_TEST_WRITER_SOURCE_PROOF_ENABLED=true`.
- `NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_CONTACT_ID`: actual selected existing synthetic contact UUID.
- `NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_ACCOUNT_ID`: actual selected existing non-stock revenue account UUID.
- `NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_SYNTHETIC_CONTACT_CONFIRMED_ID`: repeat that exact ContactID after owner confirmation.
- `NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_NON_STOCK_ACCOUNT_CONFIRMED_ID`: repeat that exact AccountID after owner confirmation.
- `NIGHT_SCOUT_XERO_TEST_WRITER_APP_BOUNDARY_VERIFIED=true` only after inspecting the separate writer app.
- After the narrow public metadata RPC has been separately reviewed/approved/applied, `NIGHT_SCOUT_XERO_TEST_WRITER_READER_BINDING_TRANSPORT=public-binding-rpc-v1` selects that exact public RPC in the isolated runtime. Default remains legacy schema SELECT; unknown values fail closed when proof is enabled. This flag does not enable source proof or generation, create/apply the RPC, expose `xero_v1`, or provide a fallback. It remains unset live until authorised configuration/publication.

These are selections/confirmations, not fabricated source receipts. No default UUID/account code or reader-tenant environment assertion is supplied. Existing explicit new-consent profile, app/host/database credentials and callback checks continue to apply. This path sets no generation flag or schedule.

The isolated deployment closure now includes the two proof modules (**eleven modules total**) without dependency changes; the frozen 92-package lock is unchanged.

## Root's remaining live checks

1. Inspect/approve the actual separate Xero app/operator host/callback and current bounded trial/SQL separately; none is authorized by passing these tests.
2. Verify the genuine GBP Demo Company and choose actual existing contact/account IDs through an authorized source/UI. Do not guess or use real-customer contact details.
3. The existing owner schema endpoint is now verified **unexposed**. Review/approve the narrow public-member RPC SQL, apply once only if authorised, then explicitly opt the isolated helper/runtime into `public-binding-rpc-v1` and verify the real owner/nonmember API behaviour. Until then this API binding is unavailable. The separate strict metadata SELECT remains an independently authenticated audit/read-context port, never an excuse to copy audit/reader credentials into the writer or invent a proof flag. No broad schema exposure or silent fallback is implemented.
4. Preserve the real Xero reader's actual connected/supported receipts independently. Same tenant identity alone does not prove working credentials, current mapping, daily execution or accounting ingestion.
5. Retain only safe proof/receipt metadata. Provider facts expire within an hour; owner binding expires in ten minutes; combined proof expiry is the earliest constituent expiry. No enabled-only refresh is used to obtain a disabled preflight.

Tests use synthetic network responses/disposable databases. They verify request/identity boundaries, safe provenance/expiry, conflicting evidence, missing-data behavior, callback opt-in and disabled-only results, not live credentials, schema exposure, consent or schedule execution.

## Recovered Demo-specific proof and inspection

Strict audit proof selection accepts only explicit legacy or Demo schema modes; the isolated Demo store cannot use legacy preflight evidence. The separate consent runtime can also consume the already authenticated owner member-status RPC's fresh connected health tied to the current credential. A branded binding receipt expires at the earlier of ten minutes after binding or one hour after its health observation. Raw caller receipts cannot establish provenance. Missing/stale/failed health remains disabled-setup evidence only. Reader credentials and audit database access must not be installed on the writer host.

`xero-demo-writer-inventory-2026-10-30.sql` provides a read-only aggregate inventory before reviewing unused-writer retargeting. `inspectDemoWriterEvidence` takes caller-supplied expected binding, fresh metadata and environment **names** only; it exposes missing configuration without values. Presence is not credential validity, retarget permission or activation authority. Full current report/mapping/reader and separate writer acceptance remain required. No dates, caps, SQL grants or live activation are changed by this source package.
