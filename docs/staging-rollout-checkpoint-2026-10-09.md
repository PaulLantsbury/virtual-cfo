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
