# Isolated Xero Demo SQL contract — 30 October 2026

Status: source-only, unapproved and unapplied. The SQL, tests and helper are preparation, not evidence of hosted installation, provider consent, scheduled execution or writer activation.

## Installation and isolation

Proposal: `db-migrations/proposals/xero-demo-isolation-2026-10-30.sql`. It installs only the new fixed store `f59e3a44-7106-4df8-9c08-52da30c9de30`, schema `xero_demo_v1`, four dedicated roles and two public member RPCs. The store's reserved `.invalid` domain and non-Shopify identifier are synthetic metadata; they do not represent a Shopify connection. Its membership copies the sole existing authenticated member of the exact original PocketLaunchpad store. No customer identity is invented.

The transaction checks PostgreSQL17+, existing source contracts, original store identity/GBP/London configuration, member RLS, the sole owner and an entirely empty new target. Occupied targets fail without resetting anything. Installation after 6 November03:00UTC refuses and requires fresh review. No old `xero_v1` objects, roles, credentials, discovery results, evidence, schedules or writer programmes are changed. The SQL expands explicit source-reviewed clones of the September18/24/25 and October3 reader contracts, with provenance comments; there is no runtime schema substitution. It retains separate connections, account directories/mappings, encrypted envelopes and audits, leases, preflight receipts and append-only accounting evidence.

No passwords, envelopes, tenant IDs, provider permissions, schedules or active connection are seeded by installation. Existing customer pages continue to use the existing reader; a unified customer dashboard and financial completeness are not delivered by this package.

## Private role and RPC contract

| Login | SET-only service role | Authority |
|---|---|---|
| `night_scout_demo_import_login` | `night_scout_demo_import_service` | Fixed demo reader worker RPCs |
| `night_scout_demo_bootstrap_login` | `night_scout_demo_bootstrap_service` | Initial connection bootstrap only |

Both logins have no password, NOINHERIT, connection limit1, no superuser/create/replication/bypass privileges. Services are NOLOGIN/NOINHERIT. Membership is SET TRUE, INHERIT FALSE, ADMIN FALSE. Hosts must connect as the exact login and `SET LOCAL ROLE` inside a transaction; `session_user` checks prevent role borrowing. RLS is enabled on all new tables; no direct table access is granted. PUBLIC/anon execution is denied; existing reader/bootstrap/writer roles have no new private capabilities. No new schema is exposed through the Data API.

All names below are in `xero_demo_v1`. Types are positional PostgreSQL argument types:

| Function | Arguments | Result |
|---|---|---|
| `bootstrap_create_initial_connection` | uuid,uuid,text,uuid,date,timestamptz,jsonb,jsonb,bytea,bytea,text,text | connection_id uuid,mapping_version_id uuid |
| `worker_get_refresh_context` | uuid,uuid | Existing envelope/context fields, with store_id uuid appended |
| `worker_get_latest_supported_evidence` | uuid,uuid,date,date,text,boolean | evidence_id uuid,report_as_of **text**,retrieved_at timestamptz,source_fingerprint text,five bigint totals |
| `worker_get_single_refresh_job` | date,date,text,boolean | connection_id uuid,mapping_version_id uuid |
| `worker_get_single_connection_preflight_job` | none | connection_id uuid,mapping_version_id uuid |
| `worker_acquire_refresh_lease` | uuid,integer,integer | timestamptz or NULL |
| `worker_release_refresh_lease` | uuid,integer,timestamptz | boolean |
| `worker_store_refresh_envelope_leased` | uuid,bytea,bytea,text,text,integer,integer,timestamptz | boolean |
| `worker_record_accounting_evidence_leased` | uuid,uuid,date,date,text,boolean,text,text,date,timestamptz,text,bigint,bigint,bigint,bigint,bigint,integer,timestamptz | uuid |
| `worker_record_connection_preflight` | uuid,integer,text,text,text,smallint,boolean,timestamptz | boolean |
| `worker_record_credential_refresh_failure` | uuid,text | void |

Context fields are connection_id,tenant_id,mapping_version_id,mapping,ciphertext,encrypted_dek,key_version,algorithm,version,lease_expires_at,store_id. Mapping retains the existing five category arrays. Supported evidence date-only report_as_of is text explicitly, avoiding client timezone conversion. New preflight failure reasons include `non_demo_organisation` and `unsupported_currency`.

Bootstrap requires the actual fresh source observation retained by the dedicated, authenticated consent server as transaction-local `night_scout.demo_reader_source_receipt` JSON with exactly connectionId,storeId,ownerId,tenantId,isDemoCompany,baseCurrency,observedAt. The first four match the arguments; isDemoCompany must be true, baseCurrency GBP, and observedAt finite/nonfuture/within five minutes. This is a trusted server observation, not cryptographic provider evidence SQL can independently establish. The server must obtain it from genuine Organisation API facts under the approved OAuth journey. Account-directory retrieval is independently fresh; account IDs must be UUIDs, active, and of allowed types: revenue REVENUE/SALES, expense categories EXPENSE/OVERHEADS, cash BANK. All five categories are required. Bootstrap is atomic and initial-only; there is no reauthorisation/reset path.

## Bounded intake and evidence semantics

New bootstrap, job selection, context, lease acquisition and accounting intake are allowed only from 30 October00:00UTC until **6 November03:00UTC exclusive**. Production paths use actual clocks, with no configurable date override. Historical member status/evidence reads remain available. An exact still-live lease may save an already-rotated encrypted credential, record failed preflight cleanup and release after the deadline; it cannot collect new accounting evidence or record connected intake. Host deletion, consent revocation, credential disposal and billing cancellation remain separate operator actions.

The current mapping is selected first and must cover the entire requested accounting period. A newer incompatible mapping never falls back to an older mapping. Both selector and direct accounting-write RPC require a finite, at-most31-day, GBP, nonfuture, closed_period=false scope and mapping.effective_from<=scope_from. Credential version and exact lease fences remain mandatory. A failed preflight can coexist with older supported totals; status exposes the latest health separately. A known newer mapping-review failure removes current mapping eligibility and the revenue account list.

## Narrow public member reads

Only authenticated members of this exact new store can execute these two definer functions. Both fix search_path to pg_catalog and use explicit qualified tables/auth.uid membership. They expose no envelopes, tokens, source reports, contacts or reader credentials; anon/nonmember/cross-store access is denied.

`public.xero_demo_member_active_tenant_binding_v1(p_store_id uuid)` returns only `(store_id uuid,tenant_id text)`, requiring exactly one active valid binding.

`public.xero_demo_reader_status_v1(p_store_id uuid)` returns this JSON shape, including storeId for an authorized member before the initial connection:

```json
{
  "storeId": "fixed new store UUID",
  "tenantId": null,
  "bindingState": "unavailable",
  "mappingState": "unavailable",
  "mappingVersion": null,
  "mappingEffectiveFrom": null,
  "revenueAccountIds": [],
  "readerHealth": {"state": "unavailable", "checkedAt": null, "matchesCurrentCredential": false},
  "latestSupportedPeriod": null
}
```

Binding states are active/unavailable/ambiguous; mapping states current/unavailable/review_required. MappingVersion is the positive mapping ordinal; mappingEffectiveFrom is an ISO date; revenueAccountIds contains at most100 distinct UUID account IDs from the current revenue mapping. Reader health states are connected/failed/stale/unavailable and require a matching current credential version for connected, with a nonfuture check no more than one hour old. A supported period has from,to,currency,reportAsOf,retrievedAt and values containing bookedRevenueMinor,processingFeeMinor,advertisingMinor,softwareMinor,includedCashMinor. Values are safe JavaScript integers. This metadata does not establish whole-period accounting completeness, writer activation, an exact invoice match, or actual cron execution.

## Independent activation check and validation

`experiments/xero/demo-reader-activation-check.mjs` exports a parameterised read-only SQL template and `checkDemoReaderForWriter(client,{storeId,tenantId,accountId,scopeFrom,scopeTo})`. Use an already-authorized idle dedicated audit client; the helper owns its read-only repeatable-read transaction and rollback. No credentials are loaded and no grants, provider requests or writes are performed. It outputs booleans and current mapping ordinal/effective date only, with activationAuthorized=false and exactInvoiceLinkageVerified=false.

The check requires the exact current completed London month-to-yesterday period (on November1 this is October1–31), the intake window, unique same-store/tenant binding, exact selected revenue **account ID**, current full-period mapping, a matching supported period with finite/nonfuture receipt, no newer same-period failed/review/invalid receipt, fresh current reader health and idle lease. Historical successful periods, same code/name on another ID, expenses, mismatched tenants and stale health cannot satisfy activation. Overall programme dates/permissions, real source account selection, writer source proof and host schedule evidence remain separate activation gates.

Run `node --test experiments/xero/demo-isolation.test.mjs`. Eight disposable PostgreSQL/PGlite tests exercise original-reader preservation, atomic prerequisites/bootstrap, membership/private privileges, mapping/account/period guards, lease replay/expiry, evidence immutability and bounded intake cleanup. Clock substitution exists only in a disposable SQL clone for deadline tests; it is not an operational option. These are synthetic checks, not hosted proof or a multi-backend concurrency test.
