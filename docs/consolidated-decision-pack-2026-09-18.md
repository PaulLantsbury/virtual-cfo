# Consolidated merchant and accounting decision pack — 18 September 2026

This is the single holding pack for decisions that code cannot safely invent. The current Shopify sales definitions remain approved in [agreed-financial-definitions.md](agreed-financial-definitions.md). Shopify sales analysis and Xero accounting analysis remain independent: no matching, reconciliation or variance is proposed here.

## Decisions needed before accounting figures are shown

| Decision | Why it matters | Options and material implication | Recommended default | Work unblocked |
| --- | --- | --- | --- | --- |
| Accounting view basis | Determines the period and meaning of Xero figures. | **Accrual/P&L:** recognised accounting activity by period; **cash basis:** cash receipts/payments; **both:** more complete but needs two clearly separate views. | Start with an accrual P&L view and keep cash separate, matching the approved distinction between profit and cash. | Report-field contract, accounting-period reader and first accounting overview. |
| Tax presentation | Prevents a misleading blend of VAT-inclusive and VAT-exclusive figures. | **Tax-exclusive**, **tax-inclusive**, or **both** with explicit labels. | Display Xero-reported amounts without converting or blending them with Shopify. Choose tax-exclusive as the primary reporting presentation only if it matches the organisation's accounting reports. | Report normalisation and labels. |
| Cut-off, freshness and closed-period corrections | Controls whether later postings rewrite historical results. | **Closed completed periods only**, **rolling periods subject to correction**, or **formal close/restate workflow**. | Use completed periods; retain the last supported same-scope snapshot when a refresh fails; require review on a late posting or changed mapping. | Freshness status, snapshot retention and correction workflow. |
| Included cash accounts and unsettled funds | Defines available cash accurately. | Select named bank/payment accounts; decide whether processor balances are unrestricted cash, separately presented unsettled funds, or excluded. | Apply the already approved definition: unrestricted dated balances only; show unsettled processor funds separately; exclude transfers between included accounts. | Cash-account mapping and cash-control reader. |
| Mapping authority | Limits who may configure financial classifications. | **Owner only**, **owner plus finance delegates**, or a custom role. | Owner-only for the prototype; add delegated finance roles after audit and invitation controls are in place. | Authorisation rules for mapping confirmation and disconnect. |
| Effective-date corrections | Determines historic mapping behaviour. | Allow backdating, prohibit it, or allow a controlled restatement workflow. | Append-only mapping versions effective no earlier than the preceding version; treat historic correction as a later explicit restatement workflow. | Merchant mapping confirmation and version-selection rules. |
| Credential retention and live connection | Needs a live owner authorisation and operational retention choice. | One-time local test only, retained refresh credential for scheduled reads, or connection via a later managed worker. | Retained server-only refresh credential with encrypted envelope, rotation, revocation and owner disconnect, as designed in [the credential lifecycle](xero-merchant-credential-lifecycle-design-2026-09-18.md). | Applied credential store, production-ready OAuth flow and scheduled Xero refresh. |

## Decisions intentionally deferred

Customer-cohort policy, CAC/payback definitions, opportunity scoring thresholds, cash forecast assumptions, treatment of financing and one-off cash flows, and any accounting categories outside the initial mapping matrix remain separate product packages. Their absence does not block the local safety, mapping, evidence or UX work already under way.

## What is safe to complete first

Before these answers, Night Scout can complete credential lifecycle mocks, a value-free mapping API and Settings workflow, account-directory refresh validation, evidence/freshness models, local fixture-based CFO screens, and disposable schema tests. It must not display live accounting totals, persist a real credential, activate scheduled Xero reads, apply a database migration, or make Shopify/Xero comparisons.
