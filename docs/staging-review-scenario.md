# Synthetic review scenario — prepared, not applied

Target: Night Scout Staging bioalckltvkhlczusdvl only. Exact artifact: db-migrations/staging/20260910_review_scenario.sql. SHA-256: 4fc6665fa39ad0019e75360907b01ddd5f8b9d9972fdb578ec83ad69b8314faf.

Read-only inspection found the original staging fixtures use non-Shopify placeholders for shop, order and refund identities. The review reconciler deliberately requires numeric Shopify identities. This test package normalises store A's domain/shop ID and its single order/refund source IDs, then inserts one deterministic August candidate batch, its head and two source-version records. It does not contact Shopify or create a real store connection.

Existing monetary values and authoritative financial evidence are not updated: August sale GBP 123, September refund GBP 23. Invalidation triggers intentionally revoke both store A coverage periods until independently reviewed. Store B and its coverage remain untouched. No audit, reviewer assignment, login or automatic restoration is included. This is an import/reconciliation test, not certification of an actual merchant's history.

The script locks dependencies and refuses unexpected source identifiers, amounts, counts or existing candidate history. It runs atomically. Two disposable database tests pass: exact generated artifact produces a candidate ready for independent review, preserves amounts/store B and rejects replay; late failure rolls back identifiers/candidates/coverage.

Separately fixed the missing-candidate API response with REVIEW_DATA_MISSING and a clear screen instruction to load transactions first. Five HTTP groups and frontend type checking pass. The running review API still needs restart to load that response change.

Application remains pending approval under the repository's remote-database change boundary. After approval: confirm dashboard project, copy/compare exact script, execute once, verify both stores' amounts/coverage, prepare August through the existing signed-in screen on localhost:3000, and inspect the candidate before any synthetic completeness confirmation/restoration. September remains unverified unless separately prepared and reviewed. Keep original production project/Replit/main unchanged.
