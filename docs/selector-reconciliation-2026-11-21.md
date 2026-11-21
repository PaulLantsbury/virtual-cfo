# Shared selector reconciliation — 21 November 2026

Status: source reconciliation integrated in the independent coordinated copy; held locally for PM publication review. No deployment performed. The published c6e72ca baseline, original Scout checkout and its Git metadata are preserved.

## Compared snapshots

- Accepted Scout/navigation source: `c6e72ca`, branch `codex/scout-navigation-20261121`, read from the original Scout checkout. Its only untracked path observed was `review/`.
- Combined integration: local `4a69533`, based on accepted Scout `5dd18ef` plus independently tested generic receiving-selector handoff. This combined repository is now independent; earlier worktree metadata sharing was corrected by the coordinator.

The c6e navigation snapshot retains accepted Scout and customer contracts `c118969`; its broader navigation changes are separate from choosing the shared selector implementation. Do not replace the navigation source wholesale with the older combined checkout.

## Architectural differences

| Concern | c6e `reviewHandoff.ts` / receiving hook | Combined `reviewedHandoff.ts` / receiving hook |
| --- | --- | --- |
| API | `useReviewedHistory({handoffRole:'current'|'comparison'|'none'})` | `useReviewedHistory('current'|'comparison')`; omitted disables inheritance |
| State | Pure one-shot pending/applied/rejected/cancelled state machine; effect seeds explicit local choice | Pure parse/advertised lookup; effect binds module-owned navigation; local choice overrides inherited candidate |
| Validation | Full calendar month, bounded strings/control characters, exact selected advertised version/company, earlier nonoverlap; comparison validates both candidate and named current evidence | Strict real dates, duplicate recognized keys, bounded URL, selected exact version/company; receiver advertised monthly list limits actual selectable scopes |
| Feedback | Rejected linked scope exposes an actionable warning | Invalid hint remains unselected; no specialized warning |
| Manual choice | Cancels one-shot handoff, including blank choice | Explicit same-identity local choice, including blank, suppresses hint |
| Company/user lifetime | Owner exists only in component `useRef` state | Bounded application-module navigation registry survives component remounts |
| Recipient policy | Profit current+comparison; Cash current; Marketing current; Plan untouched | Profit current+comparison; Cash current; Marketing current+comparison; Plan untouched |

Both treat URL context as a hint, not authorization, and use existing authenticated reader and financial-version validation. Neither may choose a replacement/latest evidence version when the advertised exact version is absent.

## Verified remount issue and recommended resolution

`StoreAccessGate` keys its ready children by `auth.revision`; store selection increments that revision. All receiving hooks therefore remount during a company switch. A per-hook owner/ref state cannot prevent the unchanged URL replaying when the user returns to the original company. The combined implementation first reproduced this exact failure in its new browser test, then fixed it with application-module ownership; all six browser cases passed after that fix.

Choose the c6e one-shot state machine, role-object API and rejection warnings as the coherent shared implementation. Add a single application/module-scoped ownership guard to that same helper/hook, carrying the tested remount protection. Remove/omit the parallel `reviewedHandoff.ts` implementation in the coordinated source; do not maintain two receiving-selection paths.

Ownership guard requirements:

- Key records by the exact captured navigation URL; current and comparison slots share one record.
- Bind the first ready authenticated user/company in an effect. Rendering only looks up eligibility and performs no registry mutation.
- A later different user/company permanently invalidates that navigation record, even if receiving hooks unmount and remount or return to the original company.
- Bound memory without evicting old records and thereby silently rearming them. The tested combined guard uses 64 records and fails new hints closed at capacity.
- Ordinary same-identity refetch/remount can revalidate a valid hint. A true full-page specialist navigation creates a fresh application realm and may carry a fresh legitimate Scout link.
- Manual selectors, including an explicit blank selection, continue to cancel inherited selection during the mount.
- Retain strict comparison validation against both exact advertised current/prior versions and retain rejection warnings.

Keep Plan separate: Scout deliberately omits Plan source hints because Plan accepts three independent baseline months and acquisition proofs. Preserve Scout page design/source unchanged. Receiving Marketing comparison policy should be explicit: current Scout links carry comparison only to Profit, so inheriting no Marketing comparison matches c6e policy; widening it later is a separate tested behavior decision.

## Required coordinated validation

Create an independent checkout/copy of the exact c6e source, preserving newer navigation and customer contracts; reconcile only the shared helper/hook and deliberate receiving calls. Do not reuse linked `.git` metadata from the original Scout worktree. Preserve its untracked review fixtures separately from committed source.

Carry forward the combined six-case mocked browser suite: existing Marketing legacy optional fields; Plan missing source; Plan repeat-population gate; Profit exact current/prior URL selection followed by explicit clearing; foreign/unknown-version no substitution; company switch and return no replay. The prior combined run passed 6/6 in an isolated local browser, with all non-loopback services mocked or blocked and no application page errors. That receipt does not certify the yet-unreconciled c6e implementation.

Also run c6e state-machine tests, navigation-routing tests, Scout overview/profit-flow tests, module ownership/remount/capacity regression, full workspace typecheck/build, then bounded desktop/mobile navigation checks. Canonical URLs/redirect aliases in c6e may require fixture route updates; do not weaken assertions merely to accept changed routing.

Publication, website deployment and read-only signed-in acceptance remain coordinator-owned separate steps. The subsequent coordinated-source section records the local reconciliation; this note does not authorize live changes.


## Coordinated source resolution

The coordinator created independent `work/night-scout-coordinated-20261121` at c6e72ca. The selected implementation is now the single existing `reviewHandoff.ts` state machine and role-object hook API. Its warnings, strict complete-month checks and current/prior advertised-version validation are preserved. One module-scoped 64-record navigation ownership registry now prevents the keyed-remount replay; capacity fails closed without eviction. Registry mutation occurs only through effect registration, with pure render eligibility checks. Duplicate parameters across all seven recognized context keys and URLs exceeding 8192 characters reject receiving roles with warnings; disabled recipients remain unaffected. No parallel `reviewedHandoff.ts` module is introduced.

Only `reviewHandoff.ts`, `useReviewedHistory.ts` and the corresponding pure test file are changed for this reconciliation. Accepted Scout/navigation pages and Plan are unchanged. Coordinated pure handoff tests passed **13/13** and the frontend TypeScript check passed; the browser-suite owner separately reruns all six carried-forward cases on the reconciled application. Publication/deployment remains coordinator-owned.

## Final coordinated validation

The selected implementation remains c6e72ca plus one remount-safe registry in its existing helper/hook, not a layered second selector. The coordinator reran all four navigation, handoff and Scout suites: **46/46 passed**. Full root workspace typecheck and every configured production build passed after final duplicate/URL-bound hardening. The six carried-forward browser regressions passed against the coordinated source; additional warning/recipient/sample isolation cases are recorded in the final release checkpoint. No accepted Scout/navigation/Plan/App/authentication file changed in this reconciliation.

Final browser reconciliation receipt: **10/10 passed**, retaining all six prior regressions and four warning/recipient/sample-isolation cases. No application page errors. Tests used an isolated loopback preview with external routes mocked/blocked, and all test processes were closed. Full hosted acceptance remains separate.
