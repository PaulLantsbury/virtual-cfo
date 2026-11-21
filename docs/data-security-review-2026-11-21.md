# Independent data security review — 21 November 2026

Reviewed frozen source `9d7151cd61adfc6648cecaa9daa47e5d8cf33eb8` read-only. Only this report and new `customer-sidecar-security.test.mjs` were added; existing reader/storage/source files were not changed. No live database, provider, publication, grants or deployment action occurred.

## Findings

No concrete new privilege, correction or replay defect was found within the proposed trusted-server boundary. Source SQL grants no runtime role access and uses SECURITY INVOKER. Insert requires table-owner/superuser authority plus exact immutable selection and member reviewer; normal restricted reader roles cannot publish or withdraw. Reviewer ID is an owner-supplied audited binding, not a substitute for authenticating the operator in a future publication tool.

The reader authenticates anew, checks membership and current canonical financial authority, verifies original/sidecar hashes and scopes and checks withdrawals in one read-only repeatable-read transaction. Any withdrawal for the requested base withholds activity, including a mismatched version row; missing recovery table or denied SELECT also returns unavailable. It never chooses another version automatically. Immutable version/base uniqueness prevents same-base correction/reselection; such corrections remain deliberately unsupported rather than bypassed with invented financial versions.

RLS identity context is set by trusted server code after Auth verification. Direct possession of a broadly granted database login that can arbitrarily set this context is outside that trust boundary; no such browser/login grant is proposed. Effective hosted role and login capabilities still require independent inspection before activation.

## Additional evidence

New bounded disposable PGlite tests passed **3/3**:

1. A committed membership removal hides the preserved withdrawal from that member's next restricted-role transaction.
2. An archived selection reviewer whose membership has been removed cannot be used for a new owner-inserted withdrawal.
3. Withdrawal exactly at selection time is accepted; preselection, infinite and future times are rejected.

These augment, not replace or sum into, the previously recorded 31-case focused and 201-case domain receipts. No heavy suite was rerun here. New fixtures use actual storage/recovery SQL and local restricted-role read grants, with 48 minimal original integrity records; they are not full financial/cash arithmetic data or live fingerprints.

## Concurrency and recovery limits

A repeatable-read transaction begun before a concurrent committed withdrawal or membership change can legitimately finish against its earlier snapshot. The next transaction must observe the change; the new tests cover committed revocation between transactions. This review does not claim instantaneous mid-transaction revocation.

Actual multi-connection interleaving of financial correction, concurrent selection or withdrawal is not certified by single-connection PGlite tests. Before hosted activation, use inspected live-compatible disposable PostgreSQL with separate connections to verify a coherent old-or-new snapshot, no mixed dependency acceptance, unique selection conflict handling, withdrawal visibility on the next transaction and unknown-commit receipt/readback. Two successful calls serialized by one in-memory connection would not establish these guarantees.

Selection/version records remain immutable after withdrawal. Post-commit withdrawal is supported as an additive read-disable proposal; undoing withdrawal or replacing a same-base selection is not implemented. A later correction requires a separately reviewed successor model and exact candidate, not DELETE, regrant or arbitrary UUID replacement. Selection timestamps remain owner-supplied storage facts; the reader rejects future/pre-base selections. Owner authority, operator clock and publication identity need explicit application preflight proof.

## Activation boundary

Before any hosted package: inspect effective catalog/RLS/grants and actual server identity; capture the exact original48 IDs/body hashes/financial and unrelated-company fingerprints; compile an operator-bound exact candidate; rehearse against that schema; enumerate necessary access, atomic application, denied reads, withdrawal and uncertain-outcome recovery; and obtain the concrete bounded data decision. Existing source approval is not data activation. No hosted source completeness, installed role, JWT or genuine scheduled-run evidence was newly verified in this review.
