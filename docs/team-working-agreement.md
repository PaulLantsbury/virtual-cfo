# Night Scout — team working agreement

Established 12 September 2026 following Paul's request for a project manager coordinating parallel coding/testing. Individual product packages still need an agreed scope.

## Roles and decisions

- Paul owns product behaviour, financial rules, priorities, scope changes, spending and deployment decisions.
- The coordinating agent maintains the brief, assigns work, answers questions from recorded agreements, integrates results and reports to Paul in the main conversation.
- Supporting agents implement/investigate assigned work and return findings, changed files, verification and questions. They must not treat proposals as approval or invent policy.
- A reviewer checks the combined result against acceptance criteria and meaningful failure cases. Code review does not approve financial completeness or production deployment.

Routine implementation mechanics within an agreed brief can proceed. New user-visible behaviour outside the agreed scope, or unresolved requirements, go to Paul with a concrete recommendation. The coordinator can answer from an existing decision and cite it; otherwise pause the dependent task while independent approved work continues.

## Durable context

Read [project brief](project-brief.md), [financial definitions](agreed-financial-definitions.md), applicable repository instructions, current handovers and source code. Chat memory is not the sole record. Brief workers with relevant links. Record proposed, agreed, implemented, locally verified, staging-verified and released states separately, with dates and evidence.

## Delegation

Use subagents for independent portions of agreed work when useful. Paul need not create or manage worker conversations. Start with two bounded workstreams and a reviewer; use fewer agents when dependencies make parallelism wasteful. Concurrency is an environment limit, not a permanent project promise.

Assignments specify objective, approved behaviour, references, owned files, exclusions, acceptance checks and escalation questions. Agents share a workspace unless explicitly isolated: assign disjoint files, never edit another worker's files and route shared-file changes through the coordinator. Use isolated checkouts when overlap warrants them; still test the combined result.

Only the coordinator stages, commits, publishes, updates shared status documents or controls shared preview/database resources. Workers must not reset/revert others' edits, start competing servers, apply migrations or publish independently. Review all diffs and verify the combined result before publication.

## Approval boundaries

Standing approval covers routine code/tests/docs uploads within requested work to `PaulLantsbury/virtual-cfo`, `codex/restart-baseline` and its existing draft PR. It does not cover main merges, production release, Replit synchronisation, new spending, destructive operations, access grants or database migrations. Prepare and verify concrete packages before asking for those decisions. Never upload secrets or real customer data publicly.

Do not reapply staging packages or mark figures reviewed to demonstrate progress. Preserve the real-reference-data pause. Delegation does not expand authorisation.

## Updates and completion

Give concise consolidated updates during active work: completed work, current work, blockers and next check. Continue through agreed steps without repeated “continue” requests. Updates outside active sessions require a separately agreed schedule; none is configured here.

At completion record delivered scope, relevant checks/limitations, documentation links, publication/environment status and next decision. Save the handover before stopping. Assess pilot elapsed work, rework and usefulness; do not promise a speed multiplier or purchase capacity from an estimate.
