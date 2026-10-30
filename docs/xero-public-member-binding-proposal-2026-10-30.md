> **Applied checkpoint — 30 October:** Paul approved this exact proposal and it was applied once in verified staging. Metadata/ACL/RLS checks and a read-only member-role SQL probe passed. Actual signed owner/MFA/Data API consent remains unverified. Do not reapply. See [the current setup record](xero-staging-setup-2026-10-30.md).

# Narrow public Xero tenant-binding RPC — unapproved proposal

Prepared on 30 October 2026. **No live SQL, grants, schema-exposure change or hosted transport activation was performed by this package.** Installing this proposal changes the database function/execute privileges and requires separate review/approval. The function itself performs metadata reads only.

## Concrete blocker

The operator inspected Supabase Data API settings: `public` and `graphql_public` are exposed; `xero_v1` is not. The existing owner's direct `GET /rest/v1/connections` with `Accept-Profile: xero_v1` therefore fails closed. Existing SQL SELECT grants/RLS do not make an unexposed schema reachable through that API. Do not expose all of `xero_v1`, grant writer access to reader tables, copy reader credentials into the operator or use a service-role API key as a workaround.

## Proposed capability

`db-migrations/proposals/xero-member-active-tenant-binding-2026-10-30.sql` adds only:

```sql
public.xero_member_active_tenant_binding_v1(p_store_id uuid)
RETURNS TABLE(store_id uuid, tenant_id text)
```

The fixed-search-path `STABLE SECURITY DEFINER` function checks `auth.uid()` and exact store membership **before** reading the active connection. It requires exactly one active connection, a valid tenant UUID and a valid nonfuture creation date. Missing, retired-only, ambiguous, malformed, revoked-membership and future/invalid binding states fail closed with one generic error. It does not choose the most recent of several active connections.

Only `authenticated` receives execute; PUBLIC, anon and known non-member/operator roles are explicitly denied. There are no new table/schema grants. The role installing the function remains a trusted reviewed database operator. The function reads membership and connection metadata only: no credentials/encrypted material, raw reports, account directories, financial amounts or customer records. Private `xero_v1` schema exposure remains unchanged.

This is member-scoped metadata, not an owner-authority assertion. The isolated operator still authenticates the configured owner session and enforces its assurance/membership requirements independently before using the result. A different signed-in store member cannot use the RPC to inspect another store; being a member does not grant writer-consent or generation authority.

## Separate opt-in helper transport

`createXeroOwnerSessionBindingReader` in `experiments/test-programme/xero-reader-context-proof.mjs` now accepts the explicit constructor option:

```js
bindingTransport: 'public-binding-rpc-v1'
```

That path posts only `{p_store_id: storeId}` to the fixed staging `/rest/v1/rpc/xero_member_active_tenant_binding_v1`, using the existing owner's bearer and public key, with public profile headers. It never sends an owner ID as authority, falls back to a database login, exposes `xero_v1`, or retries through another transport. The response must have exactly one row and only the two expected fields, within the existing bounded response/timeout limits.

The isolated runtime now wires this exact explicit setting to that constructor option:

```text
NIGHT_SCOUT_XERO_TEST_WRITER_READER_BINDING_TRANSPORT=public-binding-rpc-v1
```

The default remains `existing-schema-select`. Unknown values fail closed before pool creation when source proof is enabled; proof-off behaviour remains unchanged. This transport flag does not turn source proof or generation on. **Do not set it live until the SQL has been separately reviewed, approved and applied.** Root must then opt in and publish the isolated operator package. Missing/unapplied RPC or a denied response remains unavailable before consent SQL; no fallback is attempted. No live configuration was changed by this patch.

Both transports retain branded, owner/store-bound, ten-minute expiry receipts. `tenantBindingVerified=true` is separate from **`readerHealthVerified=false`**. No `connected` flag is invented. The query confirms a current stored tenant binding; it makes no Xero call and does not establish current provider access, preflight freshness, accounting completeness, forecast readiness or writer activation. Health evidence remains a separate current-credential preflight capability with its existing stale/future/tie guards.

## Review/application sequence

Verify the exact staging project and installed schema/function prerequisites; review the complete SQL and grants; obtain explicit approval; apply once with generation disabled; inspect member and nonmember API behaviour without exposing private response values publicly; then opt the isolated helper into this new transport and verify the separate consent flow. Do not replace a pre-existing same-named RPC or reapply blindly. No customer-app schema exposure or reader credential changes are needed.

## Verification

`node --experimental-strip-types --test experiments/xero/member-active-tenant-binding.test.mjs experiments/test-programme/xero-owner-public-binding.test.mjs experiments/test-programme/xero-reader-context-proof.test.mjs experiments/test-programme/xero-source-proof-bootstrap.test.mjs experiments/test-programme/xero-test-writer-runtime.test.mjs`

Twenty-three focused checks pass across disposable SQL/member permissions and the helper/proof/runtime regressions: exact output/private-table denial, anonymous/missing-auth/nonmember/cross-store/null scope, ambiguous/retired/future/invalid bindings, immediate membership revocation, read-only execution, transactional one-shot guards, exact public RPC request/receipt/no health inference, unavailable RPC/owner/payload failures with no fallback, default/explicit/unknown runtime transport, mandatory AAL2/current-owner validation, and unchanged existing reader/proof behaviour. These tests do not establish live migration/API/host/consent success.
