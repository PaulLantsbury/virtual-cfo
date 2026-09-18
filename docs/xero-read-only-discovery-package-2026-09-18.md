# Xero read-only discovery and reconciliation package — 18 September 2026

Status: **prepared only**. No Xero app, demo company, OAuth credential, organisation connection, data read, write-back, database table, recurring job or deployment has been created.

## Local consent boundary — prepared, not connected

`experiments/xero/read-only-oauth.mjs` now defines the first local OAuth boundary. Its three focused checks pass. It is disabled by default and only accepts the exact callback `http://localhost:3000/xero/callback`; `127.0.0.1`, HTTPS substitutions and arbitrary URLs are rejected. The authorisation request uses Xero’s documented granular read scopes for organisation settings, invoices, payments, bank transactions, manual journals and the four first reports (Profit and Loss, Balance Sheet, Trial Balance and Bank Summary). It deliberately does **not** request `offline_access`, so it cannot create a retained refresh-token connection at this stage.

When the browser callback/runtime is added, the local-only configuration will contain `NIGHT_SCOUT_XERO_ENABLED=true`, the app’s client ID, its client secret, and a randomly generated state-signing key of at least 32 characters. Keep that configuration in an ignored `.local` file with owner-only permissions. Do not paste any of those values into chat, source files, browser settings or Git. The code signs a ten-minute OAuth state and rejects malformed, replaced, wrong-key and expired returns before any token exchange. No callback route, token exchange, tenant read or browser control is enabled by this preparation.

## Verified current test route

Xero’s documented development route is a free Xero account, its Demo Company and a separate OAuth 2.0 test app. The Demo Company can be connected to an application in the same way as another organisation, but is reset automatically after 28 days and must be reconnected after a reset. A trial organisation is the alternative when a longer-lived, blank ledger or multiple invited users are needed. New test apps created after 2 March 2026 use granular scopes by default. See Xero’s [development-account guidance](https://developer.xero.com/documentation/development-accounts/), [getting-started guide](https://developer.xero.com/documentation/getting-started-guide/) and [current granular-scope FAQ](https://developer.xero.com/faq).

For a single UK business connection, a Custom Connection is a possible later operational choice, but it is a paid production option. It can use the Demo Company without charge for development. It should not be selected before the prototype proves its read-only contract. Standard OAuth code flow remains the proposed prototype path because it exercises the consent experience that a merchant connection needs. Xero states that organisation data uses tenanted endpoints and cannot be accessed through ordinary client-credentials access tokens. See [Custom Connections](https://developer.xero.com/documentation/guides/oauth2/custom-connections/) and [client-credentials guidance](https://developer.xero.com/documentation/guides/oauth2/client-credentials/).

## First safe integration slice

The initial connector reads only the selected tenant’s organisation settings, chart of accounts, bank-account balances, bank transactions, invoices/credit notes, and the dated Profit and Loss, Balance Sheet, Trial Balance and Bank Summary reports. Xero documents these accounting/reporting endpoints as readable APIs; reports need an authorising user with the relevant reports role. See its [Accounting API overview](https://developer.xero.com/documentation/api/accounting/overview) and [Reports documentation](https://developer.xero.com/documentation/api/accounting/reports).

The connector must request only the granular read permissions required by the final endpoint inventory. It must reject a tenant that is not explicitly selected, store encrypted refresh credentials outside the repository, and record the Xero tenant, organisation status, region, base currency, tax basis, financial year end, report date and source retrieval time with every snapshot. It must never call POST, PUT, DELETE, email, attachment, note, webhook-registration, invoice or bank-transaction endpoints. The implementation must explicitly reject a response that identifies itself as a write operation.

Each collection is a dated source snapshot, not proof that accounting is complete or reconciled. The nightly Shopify worker remains independent. A failed Xero collection must preserve the last supported snapshot and make freshness uncertain; it must not overwrite cash or profit figures with zeroes.

## Reconciliation boundary

Night Scout’s Shopify financial ledger remains the source for commerce-event sales, refunds, VAT components and product-cost evidence. Xero supplies separate accounting and cash views. The first version must not add, match, compare, explain variances between, or otherwise reconcile the two sales totals. A future reconciliation feature would require its own explicit scope and financial definitions.

| Question | Initial treatment |
| --- | --- |
| Sales/refunds | Present Shopify net sales and Xero booked sales as separately sourced measures. Do not calculate a difference or assert correspondence. |
| VAT | Retain Shopify VAT components and compare only after a documented tax-basis and settlement-date decision. |
| Fees, advertising, payroll, overheads | Use selected Xero accounts only after an account mapping; classify each as operating cost, variable cost, financing, tax, exceptional or excluded. |
| Cash/runway | Use an explicit included-account list and dated balances. Transfers between included accounts do not count as movement. Restricted/unsettled accounts remain separately labelled. |
| Inventory/COGS | Keep the existing cost-evidence model authoritative until stock valuation, accounting method and adjustment policy are agreed. |
| Journal timing | Retain both Xero transaction date and retrieval timestamp. Do not turn report-period summary values into transaction-level evidence. |

The connector must retain each source’s report date, scope and freshness. Settlement timing, fees netted by payment processors, manual journals, VAT timing, currency differences, duplicate channels and cash-account exclusions are accounting interpretation concerns only if a later feature explicitly requests them; they are not reconciliation differences in this scope.

## Deterministic demo fixtures and acceptance

Before a Xero connection is made, create local fixtures for: Shopify sale settled in a later period; refund after the original order month; payment fee netted from settlement; advertising and software costs; internal bank transfer; owner financing; VAT liability/payment; an excluded restricted/unsettled account; manual journal; and missing account mapping. Expected outcomes must distinguish operating profit, cash movement, available cash and reconciliation difference. Every fixture needs a clear report period and accounting timezone.

The first connected test should use the Demo Company only and run once on a fixed historical date range. It verifies tenant binding, all requested read scopes, pagination, report-date labels, account filtering, source fingerprints, idempotent same-snapshot handling, expired/revoked consent, unavailable reports and a failure that preserves prior evidence. It does not claim compatibility with a real merchant ledger. The Demo Company’s automatic reset is itself an expected stale-source test case.

## Gates before a real connection

1. Select Demo Company or a trial organisation for the prototype, then create a **separate test app** and consent only to the final read-scope set.
2. Agree the selected revenue, fee, advertising, overhead, tax, financing, inventory and included-cash account mappings; decide accounting-period cutoff and VAT treatment.
3. Review the deterministic fixture outcomes and approve the isolated staging data model and encrypted credential boundary.
4. Perform one bounded, read-only Demo Company retrieval and reconciliation review. A real organisation, recurring collection, dashboard exposure and any accounting write-back each need separate approval.

No product or financial rule is silently selected by this document. In particular, account mappings, cutoff/timing, tax treatment, cash-account inclusion and any production connection remain decisions for Paul when the connector reaches that gate.
