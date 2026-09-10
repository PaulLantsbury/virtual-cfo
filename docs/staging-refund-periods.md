# March/April refund-only reviews — ready for staging approval

10 September 2026. Local implementation and exact package tests complete; not applied remotely.

## Proposed bounded run

Apply `db-migrations/staging/20260910_refund_periods.sql` only to Night Scout Staging bioalckltvkhlczusdvl. SHA-256: `6e6a53184b8353df68ada928b87ce515b19e6051130a931a13c6f785f0ec4f20`.

The atomic package adds two retained candidate batches, two scoped heads marked for recheck and two false completeness records for synthetic store C: 1–31 March and 1–30 April 2026. Deterministic batch IDs end in 0005 and 0006. Source content is the same cumulative sale/refund history already imported; source versions are not modified. The package guards the current February head/fingerprint/receipt, source versions, store settings, financial counts and absence of overlapping March/April review periods. Replay or a changed baseline is refused. Late failure rolls back both periods.

It creates no orders, refunds, financial evidence or import receipts. It does not change memberships, reviewer grants or review audits. February and other-store records remain unchanged. No human completeness approval or restoration is included.

After approval: confirm the actual dashboard project and capture before-state; verify exact SQL hash/editor contents; apply once; inspect after-state rather than repeating after any uncertainty. Restart the existing local review preview so the updated packet summary is loaded. As the already-authorised reviewer, prepare each new month in the connected screen and check the summary and period labels without checking the completeness box or submitting restoration. Confirm false coverage, unchanged audits and financial/receipt counts. Record the result in GitHub and stop for the day.

## Expected screen results

| Selected month | Net product sales | Original orders | Activity | Completeness |
| --- | ---: | ---: | --- | --- |
| February | GBP 90 | 1 | Sale | Unverified |
| March | GBP -20 | 0 | Refund only | Unverified |
| April | GBP -20 | 0 | Refund only | Unverified |

The selected-period summary uses the existing mapped candidate calculation only after complete event reconciliation with stored evidence. It is explicitly labelled unverified and is separate from public verified figures (which remain null in the review packet). It is computed from all retained events before the displayed list is capped at 200. Refund-only activity is not labelled no activity. The original event table still shows linked history outside the selected period with labels.

## Verification

Two exact-package disposable-database groups pass: independent March/April preparation and correct negative results, preserved February values, unchanged orders/refunds/evidence/receipts/source versions/access/audits and existing coverage, replay rejection, rollback and changed-source refusal. All 86 source/import/review tests pass. Six isolated browser groups pass, including both refund-only months, negative sales, zero original orders and disabled completeness approval. Frontend type checking and diff checks pass.

No staging changes have been made by this package. No live Shopify account, production release, Replit sync or main merge is implied.
