# Handover — New page connections, 20 November 2026

Read [the audit](new-pages-data-links-2026-11-20.md) and [roadmap](roadmap-2026-11-20.md). The isolated source package is prepared and tested, not deployed. It is based on the current website d721c473b1a595f0196035fb48fbe51473123e45; preserve other concurrent work and keep provider branches unchanged.

Only the sidebar pages labelled New are targeted: marketing-efficiency, profit-engine and new-cash-control. Existing original comparison pages remain. Read-only connections reuse the existing authenticated history API, with explicit month/version selection and strict source validation. No API/schema/grant/financial write is needed for this release.

Default connected views preserve the page section framing and show only supported metrics; unavailable figures are yellow with text. The rich original examples remain explicitly available and yellow rather than appearing automatically after a source failure. Cash is not inferred from profit. The standalone demo remains isolated from live infrastructure.

107 focused financial/evidence/cash tests, TypeScript, production frontend build and standalone demo boundary checks pass. Existing build warnings remain. Local desktop and 390px browser review used fixed labelled fixtures; the actual staging history reader independently returned October EBITDA £10,592.05, sales £64,800, gross profit £32,400 and contribution £23,515. New code still needs hosted verification after the website release.

Keep private connection files, credentials and live account metadata out of GitHub. Local UI-review scaffolding is not part of the release. The next live step is the exact website-only staging release followed by signed-in period/version/store/error checks; do not publish provider or daily-feed changes with it.

[Independent daily-feed handover](https://github.com/PaulLantsbury/virtual-cfo/blob/5420b9cea960057e827422c11b479c2d5a23f1bb/docs/session-handover-2026-11-20.md): already enabled, 15 receipts through 19 November, first actual scheduled run still awaiting 21 November verification; no catch-up/reinstallation/retry.
