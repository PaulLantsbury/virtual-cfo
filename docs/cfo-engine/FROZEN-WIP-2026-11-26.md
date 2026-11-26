# Frozen incomplete CFO engine slice

Priority moved to provider end-to-end readiness before implementation. Base `0e7f99fa5c963de5fe7f3a8f88ec99b180ce08a1`; prior tested prototype `bfe9ae7`/docs `2c8373` is preserved unchanged in its separate checkout.

Canonical policy copied byte-for-byte from `b675ede2e6028e5891ef7e179ee391447f5133d0`, Git blob `b3affd81ca7b353e112e9d70272494942af81c72`. No common policy was edited.

Only proposed shared-engine declaration exists: `lib/cfo-engine/index.d.mts`, SHA-256 `59cd55a563904bb285efaa89c0b4773e551e24407349d1dfa1d659a04d43e69a`. Exports declared: createEvidenceContext, evaluateClaim, validateClaimResult, POLICY_VERSION, RULES, COVERAGE. Scope binds company/store/currency/timezone/period/selection version; metric units include pence/count/ratio/pence-per-order. Claims describe facts/arithmetic/investigation/conditional tests/human review; declared results never execute actions.

**No runtime implementation, registry, package integration or tests exist for this new shared engine. Do not import it into pages runtime or treat the proposed contract as validated.** Pages can review this pinned interface only. The independent review is an incomplete checklist, not approval.

The prior offline experiment was copied into this candidate. Its generator was edited to split readable briefings from technical evidence, but was not run; generated samples remain those of the old implementation. No shared gate adoption has been completed. No new test/build result applies to this WIP. No model/API/live action or spending occurred.
