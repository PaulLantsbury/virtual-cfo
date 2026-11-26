# CFO shared engine — independent bounded review

Completed 26 November 2026 against the frozen runtime and generated samples below. No remaining blocker was identified for this bounded offline implementation. This supersedes the earlier paused declaration-only checkpoint; it is not production, live-data, model-output or publication approval.

## Scope and method

The reviewer read the approved policy at commit `b675ede2e6028e5891ef7e179ee391447f5133d0` (blob `b3affd81ca7b353e112e9d70272494942af81c72`, SHA-256 `683b348dff7e03ae7befac60dbccb0fdfca9d3edcbeeff345a76c6255dfce768`), the prior tested prototype, unchanged shared profit calculator, new runtime and declarations, owner regression tests, sample fixtures/rendering and all 14 generated briefings. The base checkout is `16df211a5d82dbaff74471de4b7feee4f553c624`; the final containing commit is recorded by the implementation owner. The policy and financial implementation have no tracked changes against that base.

This was an independent source and arithmetic review. The reviewer did not rerun the owners' suites or author duplicate tests. The implementation owner reported 63 combined checks before the final malformed-kind regression and 27 runtime/sample checks after it, plus strict declaration compilation. The final-source workspace build passed according to the owner receipt `validation-2026-11-26.json`, which the reviewer read and matched to the runtime hash below. The reviewer did not independently rerun the build.

## Findings resolved before freeze

- Multiple accepted snapshots in one period could combine incompatible figures. The runtime now rejects that ambiguity.
- Hidden non-enumerable properties could evade canonical result equality. Plain-data validation now rejects them.
- Inherited dictionary names could crash topic or intent handling. Own-property and allowed-kind guards now fail closed; owner regression tests cover these cases.
- The normal sample investigation requested a prior metric that its current-evidence gate rejects. The sample now requests the four supported current profit measures and asserts the supported outcome.

The reviewer inspected each correction in source. No runtime or sample file was edited by the reviewer.

## Financial and policy conclusions

Normal example arithmetic reconciles: GBP14,000 net product sales minus GBP6,000 product costs gives GBP8,000 gross profit; adding GBP500 shipping and subtracting GBP1,500 variable costs and GBP1,000 advertising gives GBP6,000 contribution; GBP2,500 overheads leaves GBP3,500 operating profit. September operating profit is GBP2,700, so the movement is GBP800. The zero case remains zero; the refund-only negative case gives minus GBP75 operating profit and a minus GBP2,775 movement.

Missing later costs preserve supported upstream facts. Stale facts remain dated while comparisons/advice are withheld. Denied, invalidated or mismatched selected scopes disclose no numerical claims. An incompatible prior formula does not hide supported current facts. Ratios require named matching numerator/positive revenue denominator evidence; rate changes use percentage points. Other ratios and per-order measures remain unsupported.

Claim validation regenerates the exact deterministic result, including prose, numbers, evidence references and rule IDs. Fictional notices and provenance remain visible. No sample attributes arithmetic to a business cause, invents a cash/customer measure, recommends unsupported numeric action or enables execution. Conditional commercial requests require human review even when callers supply plan references.

## Reviewed frozen SHA-256

| File | SHA-256 |
| --- | --- |
| `lib/cfo-engine/index.mjs` | `18ed11b1571a397acf0edd6921284553c6cf7ab2ca9d475ce2d0f95e1dd4b9fd` |
| `lib/cfo-engine/index.d.mts` | `db87f4b69d3bf0da133fa0c3b4ac4751383cf5fe39485e3aae957af0adcc6fd6` |
| `lib/cfo-engine/index.test.mjs` | `68e2cafc82855af548b5132669fc1983c760c63079c61e73861578a4c50bb3e8` |
| `docs/cfo-engine/samples/briefings.md` | `c6af73a7f23a93e74d69b9db61af55669602e7e06b2efe6a4d916f24190e917e` |
| `docs/cfo-engine/samples/evidence.md` | `38f67431948d35009785c48cebac2f228574a9344a04798e26d31d17550937e8` |
| `docs/cfo-engine/samples/examples.json` | `133c17afc7cac79e7972c22808a1ed390ff0533c6c86d2aa4cb4f8132658d2b8` |

## Limits

This engine validates consistency of supplied offline evidence, not its real-world truth. Authorization, authoritative revision selection, actual completeness, source freshness and lifecycle invalidation remain trusted-adapter responsibilities. No live adapter, provider reconciliation, causal model, UI integration or model response was reviewed. Cash, customer/cohort, forecasting, attribution and unapproved numerical policy families remain unsupported. Fictional Northbridge examples are not the published Night Scout synthetic company.

No credentials, provider/model calls, spending, publication or hosted action were performed by this review lane. This receipt is its only file change.
