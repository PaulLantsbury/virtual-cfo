# Canonical history CFO evidence adapter

Source-only server slice based on integrated `3a41ae8` (exact engine `652e`), with no engine, calculator, SQL, provider or configuration changes. The authenticated history reader adds `cfoBriefing` only after existing store membership, explicit selected version, sealed coverage, source revision and observation/horizon checks. Unsupported history responses remain unchanged. Other financial response fields and their formulas are untouched.

Wire contract `history-cfo-briefing-v1`:

- `scope`: existing storeId, currency, from, to plus timezone `Europe/London`.
- `sourceBasis`: `synthetic-local`; `financialVersionId`, `salesRevision`, `costRevision`, `observedAt` preserve the selected source lineage and original observation time.
- `engineFormulaVersion`: `profit-evidence-v1`; `policyVersion`: `cfo-guardrails-core-v1` (engine policy pin b675ede).
- `status`: `supported` or `unavailable`.
- `facts`: exactly six supported integer-pence current-period facts, keyed netProductSales, netShipping, grossProfit, contribution, operatingProfit, ebitda. Each includes value, unit, evidenceRefs containing only `history-v2:<financialVersionId>`, and exact engine ruleIds context/calculation/freshness.
- `investigation`: canonical engine text/ruleIds only, or null. Supported text is “Check the underlying sales and classified costs before attributing a cause. These figures alone do not establish which action will improve results.” Rules are calculation/ladder. No comparisons, causal assertions, action, savings, forecast or model-generated text.

The pure adapter maps original line/order IDs, historical unit costs and quantities directly from selectedLines; cumulative costManifest.returns supply recovery dates/quantities. Every expense is one actual selected event posting with a stable event-plus-posting-index identity, exact classification matching the reader, and D&A only for depreciation. Full-month coverage wraps selected actual postings; it does not invent a monthly expense from aggregate totals or allocate new costs. Existing canonical source hashes/manifests are checked; shared approved profit-evidence calculation computes the evidence and exact CFO engine creates/evaluates current fact claims. Every mapped cost component and every emitted fact must equal the existing report. Negative expense corrections remain unsupported by profit-evidence-v1 and withhold the CFO slice rather than abs/netting the journal or changing the financial report.

Any adapter inconsistency returns the same bounded lineage with status unavailable, facts empty and investigation null. It emits no raw event, unit-cost record, arbitrary source text, underlying error, customer identity or credential. The selected-source “current” engine context means this revision passed this read; it does not assert recent collection. Original observedAt remains visible. The synthetic source label remains explicit even though engine mode reviewed avoids an unrelated fictional-example name/prefix.

Five focused tests pass using generated canonical source records in a disposable in-memory PostgreSQL rehearsal: exact six facts and independent generator totals; actual authenticated reader attachment with unchanged report values and nonmember denial; missing/tampered evidence and subtotal mismatch; unsupported signed correction; cumulative prior-period recovery over-count rejection. No live resource, schema installation, publication or external request occurred. This does not certify hosted access or enable live provider/CFO model work.
