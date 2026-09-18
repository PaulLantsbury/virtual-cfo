# Cash Control readiness contract

This local/staging-only contract is the boundary between the illustrative Cash Control page and a future read-only accounting cash reader. It stores no amounts, credentials, report payloads, or account names.

## Approved prototype methodology

- Available cash is the total of **dated, unrestricted** balances in owner-confirmed included bank or payment accounts.
- Transfers between two included accounts are excluded from cash movement.
- Unsettled processor funds are classified and displayed separately from available cash.
- Missing balance dates, eligibility, restriction status, mapping, or settlement classification produce an incomplete/review state. They do not become zero or estimated cash.
- A later posting, source change, or mapping change requires review before figures are presented as current.
- A failed refresh may retain a snapshot only for the same store, labelled as potentially out of date. It is never described as current.

The current page continues to show its fixed, clearly labelled samples. The readiness notice does not turn sample amounts into actual figures and no live reader, migration, credential, or network call is enabled by this work.
