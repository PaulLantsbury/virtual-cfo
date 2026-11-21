# Integration lane handover — explicit Xero staging-company binding

Source observation from coordinated3a3720e / published tree-identical3eda388, retained in f2b8119. This is a scoped integration handover, not a provider/setup change. Design's evidence-recovery batch must not edit Xero bootstrap/server/auth/mapping behaviour.

## Owner-facing mismatch to resolve
Settings shows the active business; XeroStagingDiscovery.start posts setup without that selected store. Server xero-staging-bootstrap-runtime uses its configured pinned staging store. The existing server boundary is pinned, so this audit does not establish an authorisation bypass. An owner may nevertheless infer that setup connects the business currently selected in Settings.

Relevant source: components/XeroStagingDiscovery.tsx start; lib/xeroStagingDiscovery.ts setup port; artifacts/api-server/src/lib/xero-staging-bootstrap-runtime.ts configured store and membership checks. Verify actual current integration branch before editing; do not overwrite provider work using the website branch.

## Requested integration-owned source package
Expose a merchant-safe setup capability with explicit target business and staging-only scope, bound to authenticated membership. Permit setup only when selected business and permitted target agree, or clearly identify the pinned staging target and require the existing legitimate owner workflow. Do not accept an arbitrary browser store ID as authority, reuse credentials across stores, reveal secrets, or silently switch company. Separate saved credential, mapping-review status and dated accounting evidence as existing components do.

Acceptance: wrong active company, nonmember, membership change during setup, missing capability/pinned config, current permitted staging company, revoked/expired setup, account/tenant mismatch and stale cached capability. Check recovery wording and disabled controls without a real provider request. A completed local capability test is not live OAuth/provider acceptance.

Any schema/grants, config, OAuth/credential or activation requirement belongs in the integration lane's exact reviewed package. None is proposed or applied here. No new owner decision is needed for source investigation; surface a concrete capability/config choice only if existing contracts cannot establish the target.
