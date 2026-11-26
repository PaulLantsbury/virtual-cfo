# Offline CFO rule engine: bounded implementation

This implementation supersedes the declaration-only frozen WIP for the bounded offline runtime. It has no UI integration, provider calls, model calls, credentials, or execution authority. The approved rulebook remains unchanged. The registry pins its commit, blob and SHA-256 and distinguishes implemented gates from adapter requirements and unsupported families; it is not a claim that every rulebook recommendation has been automated.

## Contract tightening

`SourceRecord.scope` is now required, including company, store, currency, timezone, selection version and the source period. `profitInput` supplies the unchanged shared `calculateProfitEvidence` contract. Source report and cost revisions bind to the raw calculator input. There is at most one accepted source snapshot per period. Comparisons use the previous complete calendar month with its own bound snapshot. Invalid comparator evidence withholds comparator claims while retaining valid current facts.

The engine does not trust caller-provided totals: it recomputes supported measures and makes a mismatched measure unavailable. Missing later costs preserve earlier valid subtotals. Contribution and operating margins require explicit numerator and revenue-denominator metrics from the same source and period. Other ratios and per-order claims remain unavailable. Zero and negative supported monetary facts are preserved; unresolved nonpositive margin denominators stay unavailable.

These changes intentionally tighten the frozen declaration: metadata alone could not prove financial claims. No consumers existed for that declaration. Raw data is accepted only as plain JSON data, copied and frozen. Caller accessors are rejected without execution. The runtime brand is private; structural imitations cannot become authoritative contexts. Exact claim-result validation regenerates the complete canonical result and rejects additions, altered text, claims, references and hidden fields.

## Authority and remaining gaps

This is a trusted-adapter boundary, not authentication. The engine checks consistency of caller-supplied evidence; it cannot establish that a provider record is genuine, a company assignment is true, coverage assertions reflect complete provider data, or a freshness classification remains current. A production adapter must perform authorization, select authoritative revisions, establish completeness/freshness, and invalidate context on access or selection changes. The source scope and selection-version checks enforce the adapter's declared selection; they do not independently authenticate it.

Facts are explicitly dated. A stale context permits dated facts only and warns that refresh is required. Invalidated and denied contexts clear scope, sources, metrics and plans. No numeric staleness policy has been invented.

Investigation prose is bounded and makes no causal claim. Conditional-test and human-review requests never authorize an action: both require human review of substantive economics, assumptions, downside, measurement, stop rule, owner and review date. Caller plan references alone do not validate those contents. `canExecute` is always false. Cash, customer/cohort evidence, forecasting, attribution, benchmarks, targets, and unapproved numerical policy choices remain unsupported.

The fictional acceptance examples under `samples/` are not the published synthetic company, real provider data or ChatGPT-generated responses. Their prose is deterministically rendered from validated engine results.

## Validation commands

- `node --test lib/cfo-engine/index.test.mjs experiments/cfo-engine-samples/*.test.mjs experiments/financial-v1/profit-evidence*.test.mjs experiments/financial-v1/calculations.test.mjs`
- `node_modules/.bin/tsc --noEmit --strict --target es2022 --module nodenext --moduleResolution nodenext lib/cfo-engine/contract.test.mts`
- `PORT=5189 BASE_PATH=/ pnpm run build` (dependency pre-run verification disabled only to reuse the existing local frozen-lockfile dependency installation).
