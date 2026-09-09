# Verified financial coverage invalidation — local proposal

## Behaviour

The additive SQL proposal `ingest_v1_verified_invalidation.sql` links source changes and candidate review flags to existing finance_v1 coverage. It requires the candidate schema and finance evidence schema, and is not registered in the automatic migration runner or applied remotely.

Triggers invalidate all complete coverage rows for the affected store when raw orders/refunds or source versions are inserted, changed or deleted. Candidate heads marked for rechecking or deleted also invalidate verified coverage. Changes to the configured currency, timezone, Shopify domain or shop identity invalidate coverage and flag candidate heads. An update that leaves a raw/source row entirely unchanged does not invalidate it. Other stores are unaffected.

The invalidation, source write and candidate flags share the caller's transaction. A failure rolls back all of them. Trigger functions are SECURITY INVOKER with fixed search paths and no public/anonymous/authenticated execute grants. They do not add client write privileges. The authorised future internal writer must have the required schema permissions; failures should abort rather than silently skip invalidation.

The existing member-checked verified_sales_source RPC still returns the scoped source snapshot. Its existing shared adapter rejects coverage marked incomplete, so the briefing's existing unavailable handling can hide invalidated figures without substituting legacy values. No new public endpoint or front-end code is needed for this invalidation path.

## Verification

35 Shopify tests pass, including six integration groups for this bridge. These rebuild the exact committed staging bootstrap and financial fixture package in disposable PostgreSQL, then apply the candidate and invalidation proposals locally. Tests use the real RPC SQL and shared client adapter with a simulated authenticated database role.

They show verified August figures becoming unavailable after source-version intake, raw order/refund changes, store timezone changes and deletion of a raw refund. Another store remains readable. Conflicting source content invalidates coverage without accepting its version, and a repeat of the old input cannot restore coverage. Same-value updates leave coverage intact; a failed transaction restores it. Members cannot call the private helper or re-enable coverage. No security-definer functions are added.

One test manually restores synthetic coverage between steps to simulate a prior independent review. That is a test fixture operation, not an implemented review or publication workflow.

## Still required

This is invalidation only. No candidate data is copied into authoritative order/refund evidence, and there is no approval/revalidation operation. A future publication workflow must independently establish completeness, reconcile source amounts, bind the exact reviewed batch and source versions, coordinate its transaction with source intake, and only then restore coverage. Do not treat a successful import or cleared UI state as that review.

No server-side collection can revoke figures already rendered in an open browser instantly. The adapter rejects invalid coverage on the next read; immediate client refresh/invalidation and cache behaviour need explicit integration tests before a release. Existing staging data/permissions and the browser preview were not changed by this local package.

No live Shopify or Supabase request, Replit synchronisation, merge or production deployment occurred. Next: the reviewed publication/revalidation design and tests, before proposing any staging application.
