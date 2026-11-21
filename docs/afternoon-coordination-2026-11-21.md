# Coordinated afternoon batch — 21 November 2026

Status: dispatched and in progress, not a completed release. Planning window approximately **13:50–15:50 Europe/London**. Paul is available for necessary sign-in, account configuration and concrete approvals. This chat is the project coordinator; implementation remains with the three existing workstreams.

## Starting position

- Four reviewed core designs: Profit, Cash, Marketing, Plan. Scout is the remaining core design pass.
- Verified historical synthetic cash/acquisition reads and financial reporting are already live from the20November release. New customer fields and Plan baseline helpers from the overnight branch are prepared, not automatically live.
- Cleanup source `4ab7b6fcec1a5cdb5be9bb09f48ea042e1755177` preserves the overnight work. Full workspace build/typecheck, Xero321 and baseline synthetic146 plus focused guards passed. Do not rediscover missing declarations or expired historical test fixtures as unresolved provider blockers.
- The actual unattended financial receipt and reporting freshness still require read-only verification. An enabled schedule is not acceptance.

## Workstreams and two-hour outcomes

| Lane | Parallel batch | Useful outcome by the end |
| --- | --- | --- |
| Integrations | Meta staging preflight/acceptance; Google OAuth/account selection/storage; independent security/tests | Meta read-only historical spend verified if existing access and reviewed activation permit, otherwise exact external blocker and concrete package. Tested Google preparation, with live positive-spend acceptance explicitly outstanding. |
| Scout design | Financial narrative/evidence model; responsive UI/Explore the Numbers; independent specification/accessibility/data-state review | Reviewable implemented Scout preview: supported business headline, why it matters, next step, context-preserving specialist links. Marketing contribution alongside EBITDA using existing definitions. |
| Non-Scout data connections | Marketing/customer comparisons; Profit/Cash coverage; Plan baseline wiring and field register | Wire supported high-value yellow figures, prioritising Plan's reviewed baseline. Produce exact remaining source-field and synthetic-population backlog, tested source and any genuinely ready staging package. |
| Project coordinator | Dependency/ownership checks, owner-input consolidation, shared roadmap and release sequencing | One accurate cross-stream status, protected shared files/staging target, owner review packages and next batch. No duplicate implementation. |

## Owner inputs and early gates

Paul confirmed **no Google Ads account with historical spend is available**. Do not ask again or create ads/spend to manufacture a test. Google live-spend reconciliation is outside the achievable afternoon outcome; OAuth/test-data preparation can continue.

Each workstream must surface foreseeable necessary inputs/decisions in its own chat during the initial preflight. The coordinator reads those checkpoints and consolidates owner actions. Do not request secrets in chat. Existing connected access must be checked before asking Paul for information already available.

Routine reversible implementation and tests continue autonomously. Exact hosted data/access/config/deployment changes retain existing project approval rules and already-granted user authorisations. Prepare a concrete reviewable package before asking; do not invent a blanket approval or require redundant approval.

## Sequence

1. **First10–15minutes:** current branch/workdir/live-target preflight; agent/file ownership; access/decision list; identify overlapping files.
2. **Main implementation window:** run independent worker batches; continue Google/source/UI work when an external Meta or database gate is pending. Keep source-only, prepared, applied and live-verified status distinct.
3. **Around14:45:** coordinator checks measurable outcomes and remaining owner actions; prioritise finishing tested work over adding speculative scope.
4. **Around15:20:** aim to freeze package scope, review cross-stream integration and exact proposed releases. No concurrent shared staging deploys.
5. **By about15:50:** concise outcome/handover, connected/unavailable field status, approval/blocker list and next session. Unfinished work is recorded honestly, not presented as complete.

These are coordination targets, not a claim that a scheduler/standing automation has been created.

## Ownership and shared-change protocol

- Scout owns dashboard/Scout-specific model, components, styles and design documents. It does not rewrite Marketing/Profit/Cash/Plan.
- Data owns non-Scout reporting/Plan/customer wiring and a field register: page+figure, source field, grain/definition, synthetic population rule, schema/read-access requirement, acceptance test and status. Derived answers and user assumptions do not each need a stored database cell.
- Integrations owns provider connection/collection/reporting source and integration setup evidence. Preserve local unpublished work and do not replace current app source with an older branch.
- Shared App.tsx, Sidebar, server app registration, common readers/roles/schemas and staging revisions must be flagged before overlapping edits. Keep isolated branches and inspect dirty files. No reset/rebase over another stream's work.
- Coordinator owns the shared operational roadmap. Workstreams maintain scoped evidence/registers and post status in their own chats for the coordinator to read.
- Reuse known baseline evidence; run changed-area checks and one integrated release gate. Avoid simultaneous broad PGlite suites competing for resources.
- Preserve the10-second rule, financial definitions, exact periods/comparison labels and accessible Explore the Numbers. Unsupported/sample figures stay visibly yellow; no silent synthetic fallback for merchants.

## Deferred or separately gated

Real provider acceptance, future summary publication, three-month programme activation, credential expiry/scheduler changes and shared action/reminder delivery are not established by a successful code build. Continue preparing the20December2026–19March2027 extension and monthly refresh package where feasible; do not sacrifice the current page connection milestone or reactivate expired provider programmes without exact review.
