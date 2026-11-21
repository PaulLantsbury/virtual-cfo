# Customer identity sidecar — independent review

Review below describes preparation. Approved live enablement subsequently passed; see [applied evidence](customer-identity-package-2026-09-17.md#customer-identifier-connection--applied-and-live-verified).

## Source permission check

Checked official Shopify documentation on 17 September 2026. The current Admin GraphQL [Customer object](https://shopify.dev/docs/api/admin-graphql/latest/objects/Customer) requires `read_customers`; [access scopes](https://shopify.dev/docs/api/usage/access-scopes) maps that scope to Customer access. [Order](https://shopify.dev/docs/api/admin-graphql/latest/objects/Order) requires an order scope, with `read_all_orders` for older history. No documented exception allowing an ID-only Customer selection with order scopes alone was found. Consequently, do not assume the installed order-only token can collect `customer { id }`; verify its actual grants before enabling this path. This is a conservative inference from object/scope documentation, not a live permission test.

Shopify's [protected customer data guide](https://shopify.dev/docs/apps/launch/protected-customer-data) separates non-contact customer data (Level 1) from name/address/phone/email fields (Level 2). Its table states Level 1 is available for custom apps; development access still needs the relevant data selection in the dashboard, and public apps have review requirements. Identifier collection must not request contact fields. No app scope, consent, protected-data setting or live query was changed by this review.

## Boundaries to verify

- Separate observations must never be added to existing financial order objects or fingerprints. Same financial source must still replay unchanged.
- Store and Shopify shop must match the configured connection. Same-looking identifiers do not imply cross-store identity.
- An explicit null customer differs from missing/unreadable/redacted data. GraphQL errors must fail collection rather than create a guest classification.
- Store only the projected ID/timestamp fields; no full responses, contact fields or free text.
- Changed identity observations preserve previous evidence. No guest matching, identity merge or repeat-customer calculation is approved implicitly.
- New database storage/access is a proposal until separately applied. Current financial import does not populate the legacy customer table or orders.customer_id.

## Reviewed implementation and verification

Reviewed the separate collector, private operator runner, append-only identity writer and proposed schema. The collector checks the pinned shop context and actual `read_customers` scope before collecting and again at completion; malformed or partly redacted GraphQL responses fail without returning an observation batch. Its output is a strict projection. The runner defaults to storage checks; explicit recording uses private owner-only configuration and the fixed staging target. The writer grants no browser access, updates or deletes, and does not write financial/customer tables.

The independent `customer-identity-integration.test.mjs` passes using synthetic HTTP responses and the real restricted SQL role in disposable PostgreSQL. It proves identified and explicit-null observations record once, replay without duplication, reject partial access errors, and preserve the original financial candidate replay. Selected financial/source/contact-table snapshots stay identical. This is not live Shopify permission verification or a claim about every database table.

A retained source fact is deduplicated independently of its observation time. If identity A changes to null and back to A at the same source update time, the A fact replays rather than creating a new last-seen observation. Therefore the newest inserted row must not be treated as an authoritative current-customer mapping. Conflicting facts are retained; resolving them and deriving repeat metrics require the next agreed identity policy. No current-identity resolver exists in this package.

No remaining implementation blocker found for preparation/publication. Applying the proposed schema/grants and changing Shopify scope/data-access configuration remain separate live actions.
