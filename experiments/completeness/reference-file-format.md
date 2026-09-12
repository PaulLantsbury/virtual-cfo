# Reference file format v1 — local prototype

This is Night Scout's normalized JSON interchange format for a supplied reference ledger. It is not a Shopify export format or a statement that a reference source has been selected. A future adapter must map an agreed real source into this contract without guessing eligibility, dates, VAT or identity.

The file is UTF-8 JSON, at most 1 MiB, with at most 10,000 events. Version 1 accepts only the documented fields. Errors identify a JSON field path and a code; at most 100 issues are returned. No values are repaired or silently converted.

## File fields

| Field | Required value |
| --- | --- |
| schemaVersion | Number 1 |
| evidenceRef | Nonblank reference to the retained supporting evidence, up to 500 characters, no surrounding spaces. A label does not prove provenance. |
| scope | Object containing storeId, currency, timezone, from and to |
| events | Array of normalized sale/refund events; an empty array is permitted but proves nothing about trading or completeness |

Scope storeId is a nonblank ID up to 500 characters. Currency must be supported by the runtime and use two decimal places (for example GBP); other precisions need a future adapter/contract. Timezone is a recognized store timezone such as Europe/London. From/to are real YYYY-MM-DD dates, ordered chronologically. A caller may supply expectedScope to require an exact match of all five fields. Neither the declared scope nor format validation provides authentication or authorizes access.

## Event fields

| Field | Required value |
| --- | --- |
| storeId, currency | Exactly match the scope |
| type | sale or refund |
| id | Stable event ID, nonblank and without surrounding spaces; type plus id must be unique within the file |
| orderId | Original order ID, nonblank and without surrounding spaces |
| timestamp | Actual event timestamp with explicit UTC offset, for example 2026-03-05T12:00:00Z; not an import timestamp |
| productExVat | Nonnegative integer minor units: product after discounts for a sale, or refunded product value, excluding VAT |
| shippingExVat | Nonnegative integer minor units, excluding VAT |
| vat | Actual normalized sale/refund VAT in nonnegative integer minor units |
| cash | Payment/refund amount in nonnegative integer minor units; must equal productExVat + shippingExVat + vat |

For GBP, 2400 means £24.00. Numeric strings, decimals, nulls, negative values and unsafe integers are refused. Refund type supplies direction; do not use the review screen's signed negative presentation in this file. No new VAT allocation or financial treatment is introduced.

Linked events outside the selected period are allowed so earlier original sales can accompany later refunds. Scope dates select the comparison period, not an assertion about collection completeness. An original order ID is required, but its authenticity, eligibility and real source linkage remain outside this format validator. A file can be syntactically valid while its contents are wrong or incomplete.

## Samples and local use

- `samples/valid-reference.json`: synthetic February sale and March/April refunds, March comparison scope.
- `samples/invalid-reference.json`: intentionally missing order ID, impossible timestamp and duplicate sale ID.

Run from the repository with its Node runtime:

```sh
node experiments/completeness/check-reference-file.mjs experiments/completeness/samples/valid-reference.json
```

The command reads only the explicitly supplied local file. It returns a status, event count and field errors, without printing transaction contents. Exit code 0 means the format is valid; 1 means invalid/unreadable. It does not upload, write or compare files automatically. JSON is parsed with the standard runtime parser; duplicate transaction IDs are checked, but duplicate JSON object-member names are not separately detected.

The library `validateReferenceFile(contents, {expectedScope})` returns a comparator-compatible ledger on success, or null on failure. All results include coverageCertified false. Validating the file does not establish independent source origin, complete collection, eligibility or permission to approve financial figures.

## Verification and remaining work

Nine validator/CLI test groups and nine comparator groups pass together (18 total). Coverage includes successful comparator integration, faulty sample paths, unknown/missing fields, scope/timezone/currency checks, amount representation/reconciliation, explicit dates/offsets, size/event limits, empty arrays, invalid UTF-8 and unreadable files. Only synthetic local files were used.

Next requires agreement on the actual independent reference source and mapping. No Shopify CSV adapter, upload UI, application route, staging write or completeness approval has been implemented here.
