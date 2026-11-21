# Offline recovery and continuation proofs — 21 November 2026

Separate source-preparation batch after local storage/reader candidate `9adb5ff` and activation-readiness review `820bc21`. It does not alter the published website candidate `3eda388d534b820728172e0edb7ab9b51d0cc3ad`. No hosted SQL, roles, grants, runtime route, summary publication/invalidation, provider operation, feed change or spending is performed.

## Engineering delivered

`customer-sidecar-recovery.sql` proposes one append-only withdrawal for an exact selected original-base/sidecar tuple, with a member reviewer, a bounded timestamp and an enumerated reason. Insert is owner-reviewed and SECURITY INVOKER; changes, deletion and truncation are refused, including by the ordinary owner path. The original 48 records, immutable sidecar and original selection remain audit evidence. No generic grant revocation or deletion is used as recovery.

The activity reader checks withdrawals in the same read-only repeatable-read transaction as financial authority, membership, original acquisition and selected version. A withdrawal withholds activity without choosing another version or merging the old payload. Missing recovery storage also fails closed. It returns only activity counts, not private reviewer identity or infrastructure errors.

The actual disposable schema-to-reader tests use a restricted NOINHERIT, non-superuser, non-BYPASSRLS role with SELECT-only fixture grants. They check read-only mode, public/browser access absence, member denial, withdrawal RLS, rollback versus committed withdrawal and unchanged original/sidecar/selection fingerprints. Auth and canonical financial reads remain labelled test seams: this is not hosted identity, real-role or full source-authority acceptance.

Same-base activity correction remains deliberately unsupported by the immutable unique-base selection contract. A correction must first withdraw the wrong result, then undergo a separately reviewed successor/selection model; neither a new UUID nor a financial revision may be invented to bypass the existing immutable key. The tests refuse replacing or silently reselecting the old record.

## Finite continuation and closed-month manifest

`continuation-manifest.mjs` prepares an offline, hashed and frozen review manifest for **20 December 2026–19 March 2027 inclusive: 90 days**. A canonical synthetic generator rehearsal binds the exact future candidate hashes and 10,947 events, not actual transactions. Its earlier generated-prefix hashes are reference anchors, not a claim about current hosted completeness.

The original 48 summary identities/version/body hashes require independent readback and an exact protected-inventory digest. Additive refresh is limited to contiguous complete November–February candidates; March remains partial at the proposed ceiling. Every day needs a matched financial-version/source proof. Provenance preserves the actual accepted sequence: 1–4 November sealed prefix, 5–19 November approved historical publication, and subsequent genuine scheduled evidence. Manual or unknown activity cannot masquerade as scheduled acceptance. The module observes no receipts itself and always returns activationAllowed=false.

Zero, missing or open-month evidence is not replaced by illustrative values. Month aggregates cannot establish distinct multi-month customer populations, second-purchase timing or repeat forecast volume. This proposal does not extend the existing programme ceiling or restricted-login expiry.

## Validation and remaining concrete gates

Final focused tests passed **31/31**: five storage, four withdrawal, nine reader-port, six actual SQL integration and seven continuation cases. Final root workspace typecheck and all configured production builds passed. A serial complete synthetic-domain run passed **201/201**, zero failures/skips/cancellations (about five minutes). The final continuation provenance/input hardening was completed during that run and then rechecked in the final 31-case focused receipt above, including its seven final manifest cases. Counts overlap and are not summed. Independent read-only security review found no concrete new privilege, correction or replay defect.

Live application remains gated on current owner-authorised catalog/RLS/effective-role fingerprints; exact independently read back original 48 inventory; bound candidate periods and source hashes; an operator-owned compiler/transaction manifest with pre/postflight and unknown-outcome readback; explicit necessary access only; exact data scope and separate owner approval; and hosted/member-denied/read-only/browser acceptance. Full retrospective activity would be at most 24 sidecars plus 24 selections preserving 48 originals, but that is a possible shape, not an approved publication quantity. Withdrawal must be rehearsed against the inspected live-compatible schema before use.

The finite continuation additionally needs actual through-19-December evidence, reviewed staged materials and effective runtime capability/expiry/configuration proofs before any extension approval. Existing observed through-20-November receipts do not certify those future gates. No financial-definition decision is required to continue the authorised offline engineering; no executable hosted activation package is ready from this document alone.
