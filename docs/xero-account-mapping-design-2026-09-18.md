# Xero account mapping design — 18 September 2026

This design turns the account-mapping matrix into a safe merchant onboarding capability. It applies to Xero accounting data only. Shopify sales remain a separate source: Night Scout does not match, reconcile or calculate a variance between the two.

## Mapping lifecycle

1. A read-only account-directory refresh retrieves account ID, name, type and status for the connected Xero organisation.
2. Night Scout presents deterministic suggestions based on those fields. Each suggestion includes confidence and reasons, and is never activated automatically.
3. The merchant selects one or more accounts for each required category and confirms the selection.
4. The application writes a versioned mapping record with the effective date, confirmer identity, confirmation time and selected account IDs. It does not retain report payloads in the mapping record.
5. Before any accounting view uses a version, Night Scout checks that every mapped account is still present and active in the current directory. A missing or archived account blocks the view and requests review; it is never treated as zero.
6. Any selection change creates a new version and marks affected accounting output for review from its effective date. Prior versions remain auditable.

## First categories

| Category | Required choice | Initial validation |
| --- | --- | --- |
| Booked revenue | One or more revenue accounts | Active and not selected in another category |
| Processing fees | One or more expense accounts | Active and not selected elsewhere |
| Advertising | One or more expense accounts | Active and not selected elsewhere; platform-spend duplication stays separately governed |
| Software | One or more expense accounts | Active and not selected elsewhere |
| Included cash | One or more bank or payment accounts | Active; merchant confirms restrictions and unsettled-fund treatment |

## Current implementation evidence

The local test path now displays a value-free, owner-confirmed mapping matrix and the completed test’s report identity. The reusable readiness check accepts only complete mappings of active directory accounts with suitable account types and returns explicit review reasons for incomplete, missing, inactive or wrong-type selections. It performs no Xero request, writes no mapping, produces no financial values and does not accept Shopify input.

The code also defines a persistence-agnostic immutable mapping-version contract: version ID, Night Scout store ID, pinned Xero tenant ID, effective date, confirmer identity/time and the selected account IDs. It normalises every selection to an account-ID list and refuses raw reports, credentials, financial values, Shopify data or a version outside its exact store/tenant scope. This is preparation only; it does not create a database record or authorise a merchant-facing endpoint.

## Before a merchant-facing release

Implement the authenticated, organisation-scoped mapping store and audit trail; connect account-directory refresh to the organisation’s Xero consent; provide selection, confirmation, version history and review prompts; then test access isolation, account renames/status changes, effective dates and currency/cutoff treatment. Product decisions still needed for cash restrictions/unsettled funds, accounting basis, tax/cutoff policy and the handling of categories outside the first five.
