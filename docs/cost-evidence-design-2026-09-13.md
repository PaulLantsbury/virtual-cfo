# Historical product cost and return evidence — proposed design

**Subsequent decision:** Paul approved the three bounded recommendations on 13 September: actual restock-date recovery, actual-only costs and complete months with independent subtotals. See `agreed-financial-definitions.md`. Earlier proposal wording below is historical; other allocation/correction/FX decisions remain unresolved.

13 September 2026. **Design only; no schema, application or database change.** This proposes a small extension to existing Night Scout source/evidence records, not a second sales dataset. It uses the saved catalog and recorded staging setup; no live schema or customer records were inspected today.

## Authority and present boundary

Read [agreed financial definitions](agreed-financial-definitions.md), [financial input map](financial-input-map-2026-09-13.md), and `experiments/financial-v1/source-schema.sql`, `source-adapter.mjs`, `calculations.mjs` with [source adapter status](source-adapter-status.md).

Already agreed: use goods cost applicable when sold, including consistently allocated freight/import costs; missing cost means incomplete profit, not zero. Reverse related cost only for goods returned to saleable inventory. A refund without recoverable goods reduces revenue without reversing COGS. Refund sales effects occur on the refund event date, preserving original-order links. Exact landed-cost allocation, return-to-stock timing and some rounding/edge policies remain unresolved.

The 8 September catalog records `public.order_line_items(id,store_id,order_id,variant_id,quantity,price,discount,total)` and `public.refund_line_items(id,store_id,refund_id,order_line_item_id,quantity,subtotal,created_at)`. `public.product_variants.cost` is a current catalogue field, not proof of historic cost. The recorded staging bootstrap copied structure; it did not certify cost data. Applied `finance_v1` sales evidence and `sales_and_refunds_complete` do not cover historical costs or recoveries.

The disposable prototype is deliberately simpler: one historic unit cost per original order, cumulative recovery quantity checks and same-refund-period stock recovery. It blocks cross-period stock recovery and does not settle multi-line/partial-line cost allocation. Reuse its guards and worked examples, not its simplified table shape as production authority.

## Narrow implementation boundary

Prepare an evidence layer for **one existing store, one currency, one selected complete calendar month**, plus the original lines needed to support that month's return recoveries. It should derive cost totals from existing identified order lines and separately identified physical stock-recovery events. It must not alter raw orders, refund dates, sales arithmetic or current catalogue costs to force a reconciliation.

An initial implementation can calculate historical goods cost and expose readiness, while contribution/profit remain unavailable until variable expenses, marketing, overheads and D&A have their own supported coverage. Cost readiness is not a shortcut around those other prerequisites. Complete sales remain visible when cost evidence fails.

The initial accepted source forms, unit precision and cross-period return behaviour need Paul's decisions below. Unsupported cases should be explicit exclusions that block complete COGS when relevant, not silently ignored records.

## Proposed logical records

Names below are illustrative schema proposals, not existing objects or approved DDL. Keep new evidence private under `finance_v1`; reuse `public` original IDs. The implementation proposal must verify actual catalog/constraints before preparing a migration.

### 1. Historical line-cost evidence

A record such as `finance_v1.historic_line_cost_evidence` would contain:

- A stable evidence ID, store ID, original order ID and original order-line ID, with same-store relationships to existing records. Existing id-only primary keys may require additional same-store unique indexes before composite foreign keys can be declared.
- The observed original line snapshot: line/order/variant identities and quantity; links to the verified original sale's eligibility, event-date/currency evidence; a snapshot/revision identifier sufficient to detect later changes. Sales evidence currently snapshots order-level fields, so a new line-level snapshot is essential.
- Evidenced sold quantity, original cost currency and a normalised recorded historical cost amount. Retain original source representation and evidence references. If reliable unit cost and line total are both provided, validate their reconciliation rather than treating whichever matches the UI as correct.
- Cost basis/provenance: actual recorded historical cost versus a disclosed estimate; source document/event reference; whether freight/import allocation is included and the source allocation method/version. Evidence must substantiate applicability when sold. A current timestamp or current variant price does not establish that fact.
- Verification metadata and immutable observation/correction linkage. A changed source line or superseded evidence cannot continue yielding a verified total unnoticed.

Do not implement an invented FIFO, weighted-average, standard-cost or present-day catalogue fallback. If the source already records historical line cost, capture it with provenance. If it requires allocation, wait for the agreed allocation rule. Monetary normalisation must preserve supported precision and reject unsupported values rather than silently rounding.

### 2. Physical saleable-recovery evidence

A record such as `finance_v1.saleable_recovery_evidence` would contain:

- Store ID, stable source recovery-event ID, original order and order-line IDs; reference to the supporting historical cost evidence revision. Link a refund/refund-line ID when it is genuinely the source relationship, with same-store/original-line checks. Whether to support a recovery without any refund record in the first release is a scope decision below.
- Actual source event timestamp and timezone evidence, plus the resolved local return-to-saleable-stock date. This is distinct from refund date and import time. Capturing the fact does not yet decide the accounting recognition period.
- Quantity actually restored to saleable stock, explicit disposition/status and evidence reference. “Not recovered”, “pending inspection” and “unknown” must remain distinct. A refund's quantity or automatic inventory flag is not sufficient proof that an item is saleable.
- A reversal amount derived only from the linked supported historical cost/quantity under the agreed partial-return rule, or a source-recorded supported amount reconciled to that basis. Never derive it from today's catalogue cost or refund cash amount.
- Source snapshot/revision, verifier metadata and correction relationship, as above.

A zero reversal needs positive evidence: for example, an established non-recoverable disposition, or complete recovery-event coverage showing no eligible recovery. Missing evidence is not a zero reversal. An unrelated refund lacking recovery evidence must not invalidate otherwise supported sales arithmetic; it affects the cost-readiness layer.

### 3. Separate cost coverage

A record such as `finance_v1.product_cost_coverage_evidence` would reference store, currency, exact date bounds, cost-contract version, source/evidence manifests and verification metadata. Track original sale-line coverage and recovery-event coverage separately. Do not reuse or broaden `sales_and_refunds_complete`.

Coverage must establish that all relevant eligible original sale lines and applicable recovery events have been enumerated and mapped, including original lines outside the selected month that underpin in-period recovery. At a minimum record source scope/counts, the compared source manifest/revision and its evidence reference. Count equality by itself is insufficient: identities, quantities, costs and unresolved exceptions must reconcile.

No line costs or recoveries in the database may mean verified zero **only** when the corresponding independently supported coverage says the period is complete. An all-refund month is not an empty month; a return-to-stock-only month must be considered once its timing policy is agreed. A new/changed source line or recovery event must make affected coverage stale or otherwise block a complete result; verification cannot survive indefinitely just because a boolean remains true.

## Validation and read behaviour

The read contract should use one authorised, consistent snapshot. Parameterised IDs do not replace store membership checks. Raw/private evidence writes remain outside the browser's normal permissions; use a separately reviewed, controlled import/review path.

Required guards:

1. Verify same-store order/line/refund/recovery relationships and original sale eligibility. Reject orphan IDs, changed snapshots, duplicate source events and unsupported currencies/precision.
2. Require positive supported sold quantities and non-negative historical cost amounts. A supported actual zero-cost item is distinct from missing cost; the evidence must say so.
3. Reconcile every relevant original line. A known-cost subtotal may be diagnostic, but must not be labelled total COGS while other relevant lines lack evidence.
4. Check cumulative recovered quantities and reversals against the original line's sold quantity and historical cost across **all relevant history**, not only the selected period. Duplicate imports, split recoveries or repeated partial returns cannot reverse the same cost twice.
5. Verify saleability and date evidence independently from refund cash/tax evidence. Refund cash may legitimately include items outside goods cost, so cost reversal must not be assumed equal to refunded money.
6. Separate sales readiness, original-cost readiness and recovery readiness. Withhold dependent COGS/gross profit/contribution/profit if relevant cost evidence is missing, stale or ambiguous. Preserve supported sales, VAT and original AOV.
7. Make verified estimates visible if later approved for use; never relabel an estimate as actual because it lives in Supabase. Do not blend estimates invisibly into actual reporting or scenario baselines.
8. Return reason codes and provenance, including scope, source/evidence version, and actual/estimated basis. Counts alone or a successful SQL sum are not financial completeness proof.

Append-only observations with explicit supersession are recommended for auditability. That recommendation does not settle whether a correction restates an earlier report or enters an adjustment in a later accounting period. Until that policy is agreed, changed cost evidence should block affected complete output pending review, not silently post or restate figures. Schema/reviewer logic must guarantee at most one active interpretation of an event, rather than summing every evidence version.

## Decisions for Paul before dependent implementation

These are unresolved choices, with bounded recommendations to make the next package concrete. None is adopted by this document.

| Decision | Recommended first scope | What waits on it |
| --- | --- | --- |
| Historical cost source and estimates | Initially accept evidenced, source-recorded historical costs only; keep current catalogue costs and unevidenced estimates unavailable. Synthetic staging fixtures can explicitly provide historical facts without claiming a real integration. | Which records can unlock cost readiness; whether estimates may appear in reporting/scenario starting positions. |
| Landed cost allocation | Accept a source's evidenced allocation only where its basis is explicitly agreed; do not choose a new allocation method automatically. Confirm whether source amounts include the required freight/import elements. | Costs requiring allocation across products/shipments, and VAT/currency normalisation not already evidenced. |
| Recovery recognition when stock returns later than the refund | Record both actual dates; recommend recognise cost recovery on the verified saleable-stock-return event date, keeping the refund's sales reduction on its original refund date. | Cross-month recovery calculation and return-to-stock-only periods. This timing is currently expressly unresolved in the financial definitions. |
| Partial units, fractional unit costs and penny allocation | For the first bounded package, support whole quantities with exact supported cost amounts; reject cases requiring an unagreed partial-cost/rounding allocation. Confirm before widening to allocated line totals or fractional units. | Partial-line recovery where unit cost × units cannot be represented exactly in the supported minor unit. |
| Corrections | Retain immutable evidence versions; flag affected totals incomplete until reviewed. Separately agree retrospective restatement versus a dated adjustment before automating either. | Changes to historic cost, saleability or previously verified recovery quantities. |
| Returns without refunds / exchanges / repeat-sale cycles | Exclude these from the first complete-case scope and surface exceptions; do not fabricate a refund to fit the model. | Whether/how original sale links and quantity caps represent exchanges or repeated inventory cycles. |

These may be bundled into one small first-scope decision. Paul need not choose a full inventory accounting system now. The source-recorded-cost path and an explicit set of supported synthetic cases can proceed once the relevant limits are agreed; broader cases remain visibly incomplete.

## Proposed acceptance cases and rollout

Use disposable tests and hand-specified fixtures before any database application:

- Two original lines with different historic costs; total reconciles to both, changing current variant cost does not change historic COGS.
- One missing-cost line: sales still available, total COGS/profit unavailable; supported zero cost remains a valid distinct case.
- Refund without saleable recovery: revenue reduction only; cost not reversed by refund quantity alone.
- Partial saleable recovery with sufficient historical evidence; successive recoveries cannot exceed original quantity/cost and reimport is idempotent.
- Recovery in a later month than refund, plus recovery-only month, **only after** recognition timing is agreed; otherwise explicit unsupported status.
- Same-store foreign-key and authorised reader tests; cross-store links/requests denied, stale snapshots rejected, currency/precision conflicts fail closed.
- Complete empty cost/recovery scope versus missing coverage; late source events invalidate previous completeness.
- Correction/supersession cannot double-count old and new evidence; unresolved period treatment prevents automatic restatement.

After decisions: prepare schema/read-contract changes and tests as a reviewable package, then obtain explicit approval for any staging migration or synthetic population. Do not infer application approval from this design task. Profit expenses/overheads/D&A and Shopify ingestion should consume the same verified dataset later; this narrow evidence extension does not itself complete those workstreams.
