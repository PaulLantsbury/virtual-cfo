# Customer activation and recovery review package — 21 November 2026

Status: **offline preparation and disposable rehearsal only**. The manifest always returns `activationAllowed: false`, `remoteApplied: false`, `executorIncluded: false` and `hostedReviewComplete: false`. Neither this document nor complete supplied receipt headers authorise hosted changes. No application page/route, database, grant, provider, scheduler or source publication was changed by this review.

## What is concrete

`customer-activation-manifest.mjs` exports `prepareCustomerActivationManifest`. It checks exact source revision syntax, the actual UTF-8 bytes and independently supplied SHA-256 anchors for the storage SQL, recovery SQL and reader source, the complete protected 48-envelope inventory hash, a bounded explicitly listed acquisition subset, base snapshot mappings and exact sidecar version IDs. Selection and withdrawal plans bind member identity assertions and bounded timestamps to the appropriate immutable tuples; database membership is verified separately.

The manifest names at most 24 acquisition bases. It never silently selects all months, changes Cash summaries or enables repeat forecasting. New sidecars require matching explicit selection plans; existing selected content cannot be overwritten or reselected. Withdrawal is a separate append-only operation against the exact previously selected pair. It withholds activity without deleting the base, version or original selection. Same-base correction/replacement remains unsupported under the immutable uniqueness rules.

The candidate hash binds the source revision, three file hashes, protected inventory, sidecar operations and exact selection/withdrawal actions. Hosted header assertions must name that candidate hash as well as source/inventory and a receipt hash, with observation not future and within 24 hours of the declared review instant. Missing headers produce blockers; malformed or cross-candidate headers are rejected. Even all matching headers mean only `suppliedHostedHeadersComplete: true`: this compiler does not authenticate receipt signatures, operator identity, connection, completeness or hosted success. The overall package hash additionally fixes the review/header context.

No parameterised hosted writer, live catalog preflight, operator credentials, runtime grant change, endpoint or UI activation is included. Artifact bytes/hash equality does not independently establish that a supplied revision contains those files; the final release needs a verified immutable checkout/commit receipt too.

## Independent disposable rehearsal

`customer-activation-rehearsal.test.mjs` exercises the manifest with actual original supplemental, sidecar-storage and withdrawal SQL in newly created in-memory PostgreSQL/PGlite databases. Four independent cases passed:

1. One explicitly selected retrospective October 2026 customer sidecar and selection commit atomically. The protected 48-row inventory and artificial financial seals remain byte-equivalent; the reader changes from unavailable to supported only after the explicit selection.
2. Injected failures immediately after candidate insertion and after selection insertion roll back both new relations. No partial candidate/selection survives and all protected records remain unchanged.
3. A separately compiled withdrawal against the committed exact selection withholds activity through the actual restricted-role reader SQL, while preserving original summaries, sidecar body and selection. A non-member is denied before activity is released.
4. Changed reader artifact bytes are rejected before any write. A syntactically valid non-member reviewer passes no membership authority merely by appearing in a manifest: the real selection trigger rejects the transaction and rolls back the candidate as well.

The test-local transaction is deliberately contained in the test file. It consumes manifest operations and rechecks the full original body/hash inventory in the same transaction before insertion. It is not an exported operator/apply function and has no remote connection or credential input.

The fixture has 24 independently scoped fictional acquisition envelopes plus 24 minimal Cash placeholders, November 2024–October 2026. Acquisition inputs use the existing labelled browser-fixture builder; Cash placeholders are protected records, **not cash arithmetic acceptance**. All IDs, users and source-revision strings are artificial. This is not a capture or reconciliation of the actual hosted 48 records.

Authentication uses an explicit artificial Auth responder. The canonical financial port checks current artificial seals/invalidation/version-head authority with real SQL but returns prepared financial response fixtures; it does not invoke the full retained-journal canonical engine. These are deliberate seams, not evidence of hosted JWT/provider acceptance or financial-source completeness. The real sidecar service, original/sidecar/withdrawal queries, membership tables, triggers and RLS execute under a `NOINHERIT` role with `rolsuper=false`, `rolbypassrls=false` and `transaction_read_only=on`. Local SELECT grants exist only in the disposable fixture.

**Validation receipt:** independent rehearsal **4/4 passed**. The manifest worker's separate pure-validation tests and previously recorded reader/storage/security/build receipts remain separate coordinator records; this review does not rerun unchanged broad suites or add their overlapping counts into a fictitious end-to-end total. These local checks do not prove concurrent hosted snapshot behaviour or operator permissions.

## Exact live proof still missing

| Gate | Required evidence before an activation decision |
| --- | --- |
| Target and operator | Privately verified staging project/connection/TLS, permitted operator identity and exact trusted server role. No copied credentials or account bindings in public repository artifacts. |
| Immutable source | Verified final commit plus actual storage/recovery/reader bytes and hashes; expected hashes supplied from an independent reviewed release record. A caller-entered 40-hex string is insufficient. |
| Catalog compatibility | Owner-authorised read-only definitions of installed tables/constraints/indexes/triggers/function bodies/RLS/policies/default grants and effective role inheritance; compare to exact candidate SQL. Limited audit catalog visibility does not prove a private table is absent. |
| Protected inventory | Actual 48 snapshot IDs/kinds/months/financial versions/sales and cost revisions/envelopes/hashes; selected corrections and invalidations; financial and unrelated-company fingerprints. Preserve all originals. The manifest's body inventory must be paired with indexed-state and authority receipts. |
| Source population | Independent deterministic inception/identity/refund proofs, privacy-safe customer union/cardinality check and exact candidate activity hash for each chosen month. Monthly unique counts must not be added into a multi-month union. No raw names/contact details/customer identifiers in the browser or public manifest. |
| Current financial authority | Authenticated canonical report for every exact selected month/version and its revisions; changed or invalidated authority must withhold old activity. Artificial seal checks are not this receipt. |
| Effective access | Actual member/non-member/cross-company denial through the trusted endpoint and effective RLS role. Enumerate any genuinely necessary new schema/table/function privileges separately; no browser/default-role access or write privileges. Withdrawal-table SELECT must be present for the reader to operate; missing access fails closed. |
| Transaction and unknown outcome | Reviewed bounded private writer/preflight/postflight with exact manifest/candidate IDs, atomic boundaries, deterministic replay/readback receipts and failure handling. Inspect an uncertain outcome before retrying; this test-local insertion is not an executable hosted writer or idempotent replay protocol. |
| Recovery | Exact append-only withdrawal artifact and reviewer/time/reason binding, proved post-commit denied activity and unchanged archives. No selection rewrite, old-row invalidation, deletion, generic grant revocation or automatic replacement. Withdrawn same-base content cannot simply be re-enabled. |
| Runtime and page acceptance | Separately reviewed server endpoint/feature integration and immutable deployment revision; token verification each request, one-transaction source binding, stale/failure/cache isolation, exact period/company/version display and browser/customer definitions. Source preparation does not populate old live JSON or connect a page. |

The current reader returns only customer activity. It does not return or certify mature-cohort economics, enable the Plan repeat lever, establish second-purchase timing or forecast cash. Customer activity, repeat-order economics, future closed-month refresh and website deployment remain distinct scopes. November 2026 is still open on 21 November; neither an enabled schedule nor this retrospective rehearsal proves a genuine daily receipt or completed November summary.

## Next bounded engineering step

Prepare the missing **read-only operator preflight/capture and exact private transaction/receipt protocol** against the accepted schemas, with uncertainty/readback and withdrawal recovery. Rehearse that exact artifact against a verified compatible disposable copy before presenting a concrete staged decision. No additional owner approval is needed to continue the already authorised offline work. An eventual decision must enumerate the precise schema/access actions, candidate subset/selection publication, reader activation and postflight/recovery; website deployment identifies its own tested source revision. Earlier source or website approvals do not activate this new data contract.
