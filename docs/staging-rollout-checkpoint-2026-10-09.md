## 9 October SQL Editor recovery — UTC fixture serialization

The original 1.3 MB operator file exceeded the SQL Editor size limit. A compact equivalent retained all rows and guards, but the owner then reported `Unsupported or stale overhead source` from the profit evidence trigger. The preparation database serialized timestamps with a fixed +01:00 offset; operator/runtime UTC sessions produced different JSON strings for the same instants. Pinning only the load to that offset would leave runtime evidence revisions stale.

The replacement regenerates the synthetic sources, observed snapshots, manifests and fingerprints together under explicit UTC, and pins only its transaction and standalone postflight to UTC. Store business timezone remains Europe/London. Its compact ordered table batches retain explicit column lists and all schema/auth/reviewer/target, Store D preservation and replay checks. No trigger, schema, grants or global database setting changes. Private replacement `night-scout-current-test-data-utc.sql`, 646,619 bytes, SHA-256 `8db9e4293417d1a113e71de9abf316e44dff514bd62ecb62f380b907b0404523`. Earlier private files are superseded. Six disposable integration checks passed, including the exact private compact artifact, UTC runtime September figures, October limits, Store D preservation, rollback and replay. An unpinned export reproduces the overhead error in a different session timezone. Application remains unverified; no current dashboard data success is claimed.

## Final hosted batch receipt — 9 October

Staging web revision `d834ddf18a8e026d124e821130b80e1ec56403b6` is **Live**, deployment `dep-db4gdotg1s2s739bq680`, duration 55.2 seconds. It includes the integrated package `924828885ee6f794f0396eb6b665c93cb55f5301` plus handling for idle PostgreSQL pool errors. Idle failures no longer crash the process or print raw clients/sockets; nine focused runtime checks and API build pass. TLS and transaction/replay behaviour remain intact.

The deployed read-only CLI passed against actual staging: server major 17, expected catalog major 18, zero column/constraint/trigger/nullability mismatches, compatible=true. Constraint type counts: check46, foreign-key24, primary15, unique10. It explicitly reports applicationAuthorized=false; compatibility is diagnostic rather than data-application approval.

Authenticated Store D February was independently verified across CFO Briefing, Margin Analysis and Profit Overview. Store/date/currency persist on fresh page navigation and all show £140 sales, £80 gross profit, £60 contribution, £35 operating profit and £40 EBITDA (original AOV £70, two orders where shown). This is historical shared-reader evidence, not current fixture acceptance or all-dashboard completion.

The exact private current fixture is prepared, not applied: one labelled synthetic store and one membership for the existing verified reviewer, 980 rows, 141 orders, two refunds, 16 sales scopes, 14 complete profit versions. Its operator transaction guards target/auth/schema, preserves existing Store D fingerprints across 16 relations and refuses replay. Apply SHA-256 `e1a3847d2e446c318383c2e7e2fada8eb0fc78adc3929d3c51436e142fce2a3b`. Reviewer-bound SQL and identities stay outside GitHub.

Remaining immediate blocker: protected SQL-editor entry and absence of insert privileges on the dedicated reporting login. The owner can run the single reviewed operator file in **Night Scout Staging**; no ID/key lookup is required. After successful application, coordinator verifies postflight and current September/elapsed-October across the supported pages. New Xero saved-mapping RPC remains unapplied/default-off; ongoing source writers and detailed page revision remain roadmap work.

## Latest verified state — reporting startup recovered

The owner confirms successful deployment following dedicated review configuration, exact staging session pooler and CA-file repair. Coordinator independently verified signed-in Store D February Profit Overview: sales £140, gross profit £80, contribution £60, operating profit £35, EBITDA £40. Earlier absent-configuration statements below describe the first deployment, not current readiness.

Read-only diagnostics executed through Render using the existing dedicated review role and TLS validation. Actual staging is PostgreSQL 17. The reconciled intake-aware canonical contract matches: 154 visible/expected columns, 95 portable constraints, ten triggers including full function bodies, reserved target vacant. No schema changes or financial writes were made. The sole existing Store D reviewer membership was verified privately, with identities excluded from public documentation.

Current synthetic September/October data remains unapplied. Its reviewer-bound operator package must pass the same guarded contract/target/auth checks before any writes. The default-off saved mapping code is prepared separately; its new member RPC proposal remains unapplied. Full authenticated cross-page current figures are still a release gate.

# Staging rollout checkpoint — 9 October 2026

Revision `d3a2ad54dc3ec46fa276f7f3033fee619cf45b91` deployed successfully to the existing staging web service. Hosted build and health check passed; authenticated Settings and Profit Overview load the updated UI. No production/main changes.

The value-free startup receipt confirms `NIGHT_SCOUT_REVIEW_ENABLED` is false and all four dedicated review configuration values are absent. Thus deployment is complete but reporting activation is not. Do not substitute Xero worker/bootstrap/admin credentials.

An authorised staging operator must restore these existing intended configuration names privately:

- `NIGHT_SCOUT_REVIEW_ENABLED=true`
- `NIGHT_SCOUT_REVIEW_PROJECT_REF`: verified staging project
- `NIGHT_SCOUT_REVIEW_AUTH_URL`: corresponding staging auth URL
- `NIGHT_SCOUT_REVIEW_PUBLIC_KEY`: existing public key for that project
- `NIGHT_SCOUT_REVIEW_DATABASE_URL`: existing dedicated read-only `night_scout_review_login` direct staging TLS connection

If the dedicated credential is unavailable, stop and review a concrete access proposal; creating or widening grants is not implied. Save/redeploy once configuration is restored; startup must report every presence check and `validDedicatedConfiguration` true. Verify member-scoped reporting against existing synthetic Store D February evidence before loading new fixtures.

The current-period fixture remains unapplied. Run [reviewer-independent read-only schema check](../experiments/financial-v1/current-dashboard-schema-readiness.sql) against independently verified staging. It emits only safe counts, contract agreement/vacancy and verification-needed flags. Then bind the remaining package to the independently verified existing reviewer and follow [current package](current-dashboard-test-package-2026-10-09.md). Do not execute disposable-reviewer apply files against staging.

Browser credential protection prevented SQL editor observation; no schema result or database application is claimed. Automatic approval review rejected an unredacted environment-page snapshot; the safe startup receipt supplied the configuration diagnosis instead.

Next batch acceptance: restore reporting configuration, reconcile live schema, apply the exact reviewer-bound synthetic package, verify September/elapsed-October figures across supported pages, then conduct detailed dashboard review. Proposed Xero amount RPC remains disabled and unapplied.

## Network recovery

Owner supplied a value-free socket diagnostic: direct staging endpoint returns ENETUNREACH from Render. Configuration syntax was valid but enabled runtime startup failed. Reporting now supports the exact staging session pooler already verified for intake, aws-1-eu-west-1.pooler.supabase.com:5432, with project-qualified dedicated review username. TLS verification, role/readiness checks and connection bounds remain. Other hosts, projects, privileged logins and transaction pooling are rejected. No credential values or grants change in this code repair. Live pooler authentication and permission readiness remain to verify after owner configuration.
