# Synthetic review scenario — applied and reconciled

Target: Night Scout Staging bioalckltvkhlczusdvl only. Exact artifact: db-migrations/staging/20260910_review_scenario.sql. SHA-256: 4fc6665fa39ad0019e75360907b01ddd5f8b9d9972fdb578ec83ad69b8314faf.

Read-only inspection found the original staging fixtures use non-Shopify placeholders for shop, order and refund identities. The review reconciler deliberately requires numeric Shopify identities. This test package normalises store A's domain/shop ID and its single order/refund source IDs, then inserts one deterministic August candidate batch, its head and two source-version records. It does not contact Shopify or create a real store connection.

Existing monetary values and authoritative financial evidence are not updated: August sale GBP 123, September refund GBP 23. Invalidation triggers intentionally revoke both store A coverage periods until independently reviewed. Store B and its coverage remain untouched. No audit, reviewer assignment, login or automatic restoration is included. This is an import/reconciliation test, not certification of an actual merchant's history.

The script locks dependencies and refuses unexpected source identifiers, amounts, counts or existing candidate history. It runs atomically. Two disposable database tests pass: exact generated artifact produces a candidate ready for independent review, preserves amounts/store B and rejects replay; late failure rolls back identifiers/candidates/coverage.

Separately fixed the missing-candidate API response with REVIEW_DATA_MISSING and a clear screen instruction to load transactions first. Five HTTP groups and frontend type checking pass. The running review API still needs restart to load that response change.

Original execution plan (subsequently approved and completed below): confirm dashboard project, copy/compare exact script, execute once, verify both stores' amounts/coverage, prepare August through the existing signed-in screen on localhost:3000, and inspect the candidate before any synthetic completeness confirmation/restoration. September remains unverified unless separately prepared and reviewed. Keep original production project/Replit/main unchanged.

## Applied result — 10 September 2026

Paul explicitly approved loading this package. Confirmed Night Scout Staging in the dashboard, matched the artifact SHA-256 and copied the editor content back for an exact comparison. The guarded transaction returned success. Read-only checks through the restricted login confirmed: one batch, one head, two source versions, zero review audits; A sales/refund still GBP 123/23, B still GBP 987/87; both A coverage periods false and both B periods true.

Opened localhost:3000/financial-review using the existing signed-in member session and prepared August 1–31 for store A. The live browser reported “Transaction checks passed” and displayed the independent completeness form. No checkbox, evidence statement or restoration was submitted. Thus real Auth, role checks, candidate reading and reconciliation work through the UI; final review/audit/restoration remains to be tested explicitly using the documented synthetic evidence. September is still unverified.

## Real signed-in synthetic restoration passed

After Paul instructed continuation, the assistant re-read the constructed fixture and its documented complete history, prepared August again through the real signed-in screen, and submitted a confirmation explicitly labelled synthetic and assistant-submitted with Paul's authorisation. The statement referenced the exact scenario SHA-256, the single eligible GBP 123 August sale and GBP 23 September refund, absence of additional/excluded records in this constructed dataset, and exclusion of September from restoration. This does not certify actual merchant history.

The browser confirmed restoration and recording. Independent read-only database checks then confirmed exactly one audit, attributed to the selected reviewer, with an object snapshot and 64-character digest. August A coverage is true and references that audit; September A remains false. Both B periods remain true. Order net sales remain A123/B987. No real Shopify data, production deployment or Replit changes.

This completes the positive synthetic end-to-end path through real sign-in, HTTP/API, restricted database role, reconciliation, confirmation, audit and period restoration. Live merchant imports, source-to-authoritative evidence writing, deployment hardening and additional real-auth failure scenarios remain unfinished. The missing-data response code fix still needs a local API restart before its changed branch is exercised.
