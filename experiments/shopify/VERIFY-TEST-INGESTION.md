# Read-only Shopify test-ingestion verifier

Run `verify-test-ingestion.sql` only in the verified **Night Scout Staging** operator SQL editor, preferably inside `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; … ROLLBACK;`. It is one SELECT; it creates no objects, grants, claims or provider activity. Alternatively import `verifyTestIngestion(client)` with an already authorised operator client; that wrapper starts a read-only snapshot and rolls back. It does not load credentials, open a connection, switch roles or broaden existing reader/writer permissions. The separate restricted writer login cannot read the intake tables and is not an appropriate client. A permission error is unavailable evidence, never permission to grant more access.

The query is deliberately pinned to the approved 29 October–4 November Shopify programme, exact staging store, seven-action ceiling and the deterministic daily action keys/payload digests produced by its £60 nominal/£0 charged test plans. It returns no provider IDs, action keys, customer data, credentials or retained source payloads. The ordinal orders existing actions by creation date/key; it is not a nominal calendar-day number when dates were skipped.

For each confirmed writer action it checks:

- Valid unique provider order identity and matching bounded daily plan/date/window.
- The immediately following London 02:00 nightly claim, completed within the recorded path, with the approved trailing 31 completed-day reporting period.
- Exactly one successful attempt inside that claim’s interval and exactly one newly retained candidate inside that attempt’s interval.
- Matching store/currency/timezone/reporting context, exactly one source order marked test, exactly one `TEST_ORDER` exclusion, zero matching mapped financial events and no corresponding merchant order in `public.orders`.

`awaiting_writer_actions`, `not_yet_due`, `nightly_window_open`, `nightly_missing` and blocked/unavailable states distinguish incomplete evidence from success. `stored_test_exclusion_confirmed` means those database facts and temporal correlations passed; a candidate needing broader recheck remains flagged separately.

**It does not prove a host scheduler triggered.** `hostReceiptCorrelation` always remains `not_assessed`; inspect the real Render/Replit host receipt independently. There is no caller flag to manufacture scheduled success. The durable schema has no explicit attempt-to-candidate foreign key, so linkage is honestly described as unique period/time correlation. An older candidate reused by a replay cannot establish exact receipt by this verifier and reports `candidate_linkage_unavailable`. A missed first scheduled night remains visible rather than silently substituting a later catch-up run.

This does not certify source completeness, financial reporting, Profit Engine/Cash sample data or production readiness. It never retries a writer or collector. The accompanying tests use invented data in disposable PGlite databases; clock substitution exists only in their local adapter, never in the operational verifier.
