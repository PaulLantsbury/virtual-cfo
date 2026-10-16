# Agreed Xero prototype policies — 18 September 2026

Paul approved the following policies on 18 September 2026. They are Night Scout's prototype contract for the Xero connection, mapping and accounting-reader work. This record supersedes the pending-decision wording previously held here.

The approved Shopify sales definitions remain in [agreed-financial-definitions.md](agreed-financial-definitions.md). Shopify sales analysis and Xero accounting analysis are independent sources: Night Scout must not match, reconcile or calculate variances between them.

## Approved policies

| Policy | Agreed prototype rule | Implementation consequence |
| --- | --- | --- |
| Accounting basis | Use accrual/P&L for accounting performance. Show cash separately. | Accounting-reader views must label P&L and cash as different measures and must not infer one from the other. |
| Xero tax presentation | Use Xero-reported amounts without conversion or blending with Shopify. | Preserve Xero report semantics and labels. Do not apply Shopify VAT normalisation to Xero figures. |
| Closed periods and corrections | Report completed periods; retain a same-scope supported snapshot after a failed refresh; flag later postings for review. | A failed refresh never creates zeroes or silently replaces evidence. A changed closed period requires a visible review state. |
| Available cash and unsettled funds | Available cash is dated, unrestricted balances in the owner-confirmed included bank/payment accounts. Exclude transfers between included accounts. Show unsettled processor balances separately, never as available cash. | The Cash Control reader must require an explicit account mapping, dated evidence and a separate unsettled category. It must not treat all Xero accounts or report totals as cash. |
| Mapping authority | Only the store owner may confirm mappings, reconnect or disconnect for the prototype. | Server-side authorisation derives the actor/store and rejects delegates. A later role-delegation package needs separate invitation/audit controls. |
| Mapping history | Mapping versions are append-only. Do not backdate mappings. Historic correction will be a later explicit restatement workflow. | A changed account directory or tenant forces review; historical versions remain attributable to their directory snapshot. |
| Credential retention and scheduled reads | Development/staging may use a retained, server-only encrypted refresh credential for scheduled read-only Xero updates. | Implement the lifecycle in [xero-merchant-credential-lifecycle-design-2026-09-18.md](xero-merchant-credential-lifecycle-design-2026-09-18.md), using a separate credential store and audit trail. No credential or accounting value belongs in mapping records. |

## Authority boundary

The credential-store/database-migration authority applies **only to the development/staging prototype environment**. It does not authorise production database changes, production OAuth activation, production scheduled reads, use of real merchant credentials, or display of real merchant financial figures. Each of those needs Paul's explicit later approval.

This approval permits reversible code, mock/disposable-database tests, schema and migration preparation, and staging-only configuration once its non-production environment is verified. It does not permit connecting the existing local test flow to a merchant tenant.

## Cash methodology

For the prototype, cash control follows the existing approved financial definition: available cash is the total of balances that are both dated and unrestricted at the stated reporting time. The owner selects the included accounts through mapping; Night Scout records that selection and its effective mapping version. Transfers between two included accounts do not count as cash movement. Processor funds still awaiting settlement are labelled **Unsettled funds** and displayed outside available cash. Missing balance dates, unclear restrictions, or unmapped accounts result in incomplete/review status rather than an estimated cash total.

The remaining later policy questions are financing and one-off cash-flow treatment in burn/runway, currency treatment where a merchant has multiple currencies, and any exception to the ordinary processor-settlement distinction. These do not block the prototype reader; they must be surfaced as incomplete/review rather than guessed.

## Work now unblocked

The approved policies unblock a staging/local merchant-facing Xero connection workflow, owner-only mapping confirmation, append-only mapping persistence, a read-only accounting-period reader, and a Cash Control read model. The proposed data shape remains in [xero-mapping-store-proposal-2026-09-18.md](xero-mapping-store-proposal-2026-09-18.md); it must be applied only to a verified non-production environment.

## Decisions intentionally deferred

Customer-cohort policy, CAC/payback definitions, opportunity scoring thresholds, cash forecast assumptions, treatment of financing and one-off cash flows, foreign-exchange methodology, and accounting categories outside the initial mapping matrix remain separate product packages. Their absence must not block local safety, mapping, evidence or UX work, but it does block any calculation that depends on them.
