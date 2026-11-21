# Supported Scout and Profit release validation — 5 November 2026

Status: locally built and tested release preparation. The signed-in hosted supported pages are not yet accepted. This product checklist contains no connection, account, operator or access-policy details. Private access and deployment approvals remain separate.

## Product scope

The opt-in `/supported-v11/scout` and `/supported-v11/profit` routes share authenticated canonical reporting. The existing fictional preview remains a separate design review. These routes are a supported sales/profit slice, not completion of all v11 page designs, cash reporting, recommendation ranking, marketing attribution or monitoring.

The page offers an explicit complete-calendar-month picker and shared reporting-period context. January 2025 must be selected deliberately for the loaded fictional-company month. Other periods or businesses retain their own evidence availability; there is no sample substitution or fallback to January. Changing business or sign-in identity changes the query scope.

## January acceptance reference

All amounts are GBP, excluding VAT. The reporting window is 1–31 January 2025 in Europe/London.

| Measure | Reference |
| --- | ---: |
| Original eligible orders | 1,194 |
| Net product sales | £43,200 |
| Net shipping revenue | £1,800 |
| Total revenue denominator | £45,000 |
| Product gross profit | £21,600 |
| Contribution after marketing | £15,099 |
| Operating profit | £1,976.02 |
| Depreciation added back for EBITDA | £200 |
| EBITDA | £2,176.02 |

The four supported headline cards show net product sales, gross profit, contribution after marketing and EBITDA. The other amounts above are reconciliation references; they are not a claim that every measure has its own current card. Source-as-of reflects the completed fictional January horizon. It must come from verified source metadata, never page load time. “Canonical current” means the snapshot matches retained scoped evidence; it does not claim recent or healthy provider collection.

## Hosted acceptance journey

1. Sign in through the existing access flow and select the isolated fictional company. Visit Scout’s View, explicitly choose January 2025 and confirm business, GBP, London timezone and dates agree.
2. Check the four cards against the reference above. Visit Profit Engine and confirm the same shared period and values. Missing values remain unavailable rather than zero.
3. Open **Explore the Numbers** on each page. Its amounts, formulas, units, business, snapshot and as-of must match the visible cards. The table remains usable on a narrow screen and by keyboard.
4. Enable comparison. Without independently supported matching prior-period evidence, withhold comparison values, changes and comparative verdicts. The custom-period comparison limitation remains explicit.
5. Select an unseeded month, a partial/custom range or another business. Do not carry January figures into that selection. Unsupported profit ranges remain unavailable. Return to January and verify the scoped result again.
6. Verify denied, signed-out, missing-metadata, invalidated-source and incomplete-cost behaviour. Verified sales may survive incomplete costs; unsupported profit must remain unavailable. No fixture may fill a source gap.
7. Perform the representative-owner ten-second comprehension test: can the owner identify the period, main supported profit story and where to inspect the evidence? Record the actual result; automated tests and screenshots do not satisfy this human test.

## Validation and release boundary

Local production API and frontend builds pass using the repository’s existing locked dependencies. The previous missing workspace-package problem was local dependency-link preparation; no package, lockfile or build configuration change was required. The full hosted-app API test now runs, alongside authentication, scoped reporting, unavailable-data and redaction checks. The finished built server serves both supported routes and its health endpoint; without external configuration it leaves reporting unavailable.

Existing non-fatal frontend notices concern tooltip sourcemaps, mixed static/dynamic imports and bundle size. They have not been hidden. Local static-serving verification uses a normal temporary release directory because the hidden desktop workspace path is not a deployment layout.

Before any deployment, compare the exact published page/parser files with the locally tested source and name one immutable candidate commit. A local recovery checkout’s Git revision is not proof of the remote release revision. Retain a compatible prior application build for rollback; reverting application code does not reverse loaded evidence or access changes. No generic deployment trigger should accidentally select a moving branch instead of the approved candidate.

Completion requires the intended candidate to be live, approved scoped metadata access to work, and the signed-in acceptance journey above to pass on the hosted site. Until then, distinguish locally implemented/tested, published, deployed and hosted-verified status.
