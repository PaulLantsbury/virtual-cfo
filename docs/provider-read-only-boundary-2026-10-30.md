# Provider read-only boundary — 30 October 2026

Night Scout reads Shopify/Xero business records. Creating test orders, refunds,
invoices or other provider transactions belongs to distinct external test writers
with separate provider apps, credentials, runtime packages and hosts.

| Runtime | Provider capability | Separation reviewed |
| --- | --- | --- |
| Customer API and existing Xero reader | Organisation/account/report GETs; fixed read-only OAuth scopes | Customer `/api/xero/test-writer` returns 404. Its transitive local imports exclude writer runtimes. |
| Shopify nightly/identity intake | Fixed GraphQL queries over HTTP POST | Query operation allowlist contains no mutations. Context verification and collection now reject every granted scope outside `read_*`, including substituted writer credentials. |
| Proposed separate Demo reader/consent | Fixed read-only scopes, actual demo/GBP checks, report/account GETs | Dedicated reader app, store, schema, roles and encrypted envelope; reader package excludes generator/consent-writer runtime. Source remains default off and time bounded. |
| External Shopify and Xero test writers | Explicit provider business writes within their approved trial | Separate operator/generation packages and provider credentials. They are not imported or mounted by Night Scout. |

OAuth authorization-code exchange and refresh use provider token POSTs. Shopify
GraphQL queries also use POST. These do not create or modify provider business
transactions. Local ingestion, mapping confirmation, encrypted token rotation,
leases, evidence and consent-state persistence are database writes needed to
operate readers; they do not confer provider business-write permission.

The hosted existing and proposed Demo Xero reader refresh guards reject additional
`accounting.transactions`, `accounting.contacts` and `accounting.settings` write
scopes. The historical localhost-only Xero OAuth exchange now independently
requires exactly its requested fixed read scope set in the response, rejecting
missing, incomplete, duplicate or additional grants before returning access.

Verification: `node --test experiments/shopify/provider-read-only-boundary.test.mjs
experiments/shopify/verify-connection.test.mjs
experiments/shopify/collect-customer-identities.test.mjs
experiments/shopify/shopify.test.mjs` passed **28/28**. The focused Xero OAuth,
token-exchange and boundary check command passed **13/13** (four boundary checks
overlap the first command). Checks exercise substituted
write grants before collection, identity permission elevation during collection,
Xero reader scope refusal and the literal local transitive import graphs of the
customer API, reader cron entries and Demo consent server. Existing financial
collector cases remain passing. Writer credential preflights were not changed.

This is a source audit. It does not attest every live app grant, environment,
deployment revision or token. The Shopify guard must be deployed to affect hosted
collection. An overprivileged reader app must have its provider grant corrected;
the guard refuses collection and does not revoke or alter provider permissions.
Package and token separation still require verification during actual setup.
