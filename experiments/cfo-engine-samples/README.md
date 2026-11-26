# Fictional CFO engine samples

These deterministic briefings exercise the new shared CFO rule engine with the earlier Northbridge Home acceptance fixtures. They are not the actual Night Scout synthetic company's published results, real provider data, or ChatGPT output. No network, database, credential or external action is used.

Run from the repository root:

```sh
node --test experiments/cfo-engine-samples/briefings.test.mjs
node experiments/cfo-engine-samples/generate.mjs
```

The readable output is `docs/cfo-engine/samples/briefings.md`. Its companion `evidence.md` and `examples.json` expose the accepted or withheld engine decisions, rule IDs, numerical claims and evidence references. Input fixtures remain in the source generator; the shared financial calculator rederives each profit figure. The engine then verifies the fixture's declared metrics before admitting a claim.

The fourteen cases cover supported profit and comparison, missing historical costs, advertising, overheads, cash and customer populations; stale, withdrawn, denied and wrong-company results; an incompatible comparator; supported zero; refund-only negative activity; and source-note instructions. A missing prerequisite never becomes a zero. Supported current subtotals survive unrelated missing inputs and incompatible prior evidence.

This is a sample adapter, not an authorized production data reader. The profit calculator validates declared evidence and arithmetic; it cannot independently prove actual source completeness, permission, event identity or a database transaction. Current fixture freshness is deliberately declared for acceptance testing. Cash and customer claims and commercial tests remain unavailable in this slice; no plan reference is treated as proof that those dependencies exist.

All prose is deterministic. `validateBriefing` recreates the canonical result, so editing a returned number or statement is rejected. A future model adapter needs its own policy, data-processing and output-validation work; these examples authorize none.
