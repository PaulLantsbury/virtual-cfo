> **APPROVED DESIGN BASELINE — 30 October 2026:** [Version 11 specification and 33 linked mockups](design/v11/README.md) are the reference for signed-in page redesign work. Includes principles, page behavior, financial fixtures, priorities and acceptance criteria. Design approval does not imply implementation or alter current data/reader priorities or deployment safeguards.

> **Latest source finding — 30 October:** The real reader organisation check is connected and GBP but API `IsDemoCompany=false`. The separate UK Demo Company is accessible in Xero. Keep writer generation off; prepare the [isolated demo-reader package](xero-demo-reader-proposal-2026-10-30.md) without adding a second eligible connection to legacy global discovery or repointing the working reader. Exact setup/deployment/private-owner steps are in the current checkpoint.

> **APPROVED SETUP — 30 October 2026:** Paul approved the separate bounded Xero setup. Both reviewed staging SQL packages are now applied; the separate operator, cron and writer app exist. Bootstrap and generation remain off pending private owner credentials, MFA, genuine demo/source checks and matching reader acceptance. Read [the setup checkpoint](xero-staging-setup-2026-10-30.md); do not repeat migration/hosting/app approval or application. Benchmarking remains deferred.

# Night Scout — 30 October 2026 development handover

## Today's decisions

Reliable daily development data and reader acceptance remain first. Page redesigns follow; broader CFO recommendations remain deferred. Cross-client benchmarking is deferred indefinitely and may be dropped. Protect authorised Shopify feed access: no additional collection or pooling for benchmarking, and no assumption that anonymisation or merchant consent overrides platform terms. Retention/deletion and access controls remain real-merchant rollout requirements.

The Shopify trial was activated on 29 October under the existing approval. Its first eligible scheduled action is 30 October at 18:00 UTC, followed by the next real overnight intake. The missed 29 October action must remain skipped. Do not reset actions, extend dates, use fake time or trigger an order to make acceptance appear complete. Read the private operational handover for the actual host/database state.

## Parallel source batch

- Xero source verification now derives selected organisation/contact/revenue-account facts from the fresh isolated consent token. Owner confirmation of synthetic contact/non-stock intent stays distinct from API facts. Matching owner-authorised reader tenant identity permits only disabled seeding; identity alone never establishes reader health or activation authority. Conflicting evidence fails closed.
- A separate reproducible Xero generation package pins the proposed dates/profile/provider and starts disabled without credentials. It excludes the customer/reader/consent deployment graph and uses an independently frozen dependency closure. The consent host remains a separate package.
- A narrow public metadata RPC proposal closes the discovered private-schema API blocker without exposing `xero_v1`. It checks current membership and returns only one active store/tenant binding. The isolated runtime has an explicit transport opt-in; missing/denied RPCs fail closed without fallback. The SQL remains unapplied and the flag remains unset live.
- Operator sign-in supports an existing enrolled TOTP factor; the server independently verifies signed AAL2 claims and current owner identity before consent SQL. Password-only sessions are refused. Actual owner enrollment and hosted MFA remain unverified; no account security setting was changed.
- A read-only data-handling inventory and source/copy audit identify retained Shopify payload versions, review snapshots, customer identifiers, bounded Xero accounting evidence, credentials, browser/host copies and backup gaps. Visible zero rows never means erasure. No retention period, deletion executor, extra collection or benchmark store was introduced.

## Verified live state and remaining gates

Today's actual overnight Shopify claim completed, and the Xero scheduled host receipt matches its current supported accounting evidence. These are reader checks, not proof of a generated test order/invoice or reconciled dashboard financial acceptance.

The Xero developer account currently has an existing reader app; a separate writer app has not been created. Genuine GBP Demo Company status and exact existing synthetic contact/revenue-account selections still require source verification. Do not infer demo status from an account name or repoint the working reader.

Live inspection found `xero_v1` is not exposed through the current Supabase Data API. The earlier direct-RLS consent binding path therefore cannot be treated as live-ready. The narrow authenticated metadata RPC proposal passed independent review and remains subject to separate application approval. No live API exposure/grant changed.

Render's new-service form offers a Free isolated operator web service; the draft is not deployed and no hostname is reserved. A generation cron is a separate resource with a monthly minimum charge. The existing Shopify budget does not authorise new Xero spending. New app terms/security attestations, private credential setup, exact SQL/proposed trial and activation remain explicit gates.

## Resume order

1. Resume from the validated development-branch source revision recorded in the private checkpoint. Source implementation, final regression and independent review are complete; keep operational/private material separate.
2. Obtain one concrete bundled decision for the separate Xero app/isolated hosting, exact proposed trial and reviewed database changes. Preserve reader/customer/writer separation and leave generation off during setup.
3. Complete genuine demo consent/source selection, strong owner authentication, restricted credential/CA checks and matching-reader health verification. If the working reader is not the same genuine demo tenant, prepare a separately scoped reader rather than overwriting it.
4. Accept only a real scheduled provider action, durable confirmed action and next real matching read. Shopify's next expected action/read are 30 October 18:00 and 31 October 02:00 UTC. Xero remains inactive until its distinct gates pass.

## Related source

- [Xero source proof](../experiments/test-programme/XERO-SOURCE-PROOF-2026-10-30.md)
- [Xero generation package](../experiments/test-programme/XERO-GENERATION-DEPLOYMENT-2026-10-30.md)
- [Data-handling readiness](data-handling-readiness-2026-10-30.md)
- [Narrow member binding proposal](xero-public-member-binding-proposal-2026-10-30.md)
- [Prior source handover](session-handover-2026-10-29.md)

Operational observations, identifiers and deployment receipts are recorded separately. Source/test preparation does not prove hosting, consent, provider action execution, full financial reconciliation or production readiness. No production/main merge or Shopify reader cutover is included.

## Validation and limits

Final root regression: **92 tests passed**, covering the new source proofs, public metadata SQL/helper/runtime route, verified AAL2 owner authentication, isolated consent/generation packages, retained provider/Shopify safeguards, restricted database preflight, data inventory and ingestion acceptance verifier. Independent review found no remaining source blocker. Diff whitespace checks passed. The generation package's actual isolated frozen production install passed for all fourteen existing integrity-pinned dependency snapshots; installed-tree import and disabled startup smokes made zero provider/database calls. The consent package's previously verified 92-snapshot lock is unchanged; closure tests cover the additional proof modules.

The customer frontend is unchanged by this batch, so its build was not repeated. The previously recorded backend-wide TypeScript limitation remains: missing declarations in unchanged Xero modules and unbuilt api-zod outputs are not resolved by these tests. Live owner MFA, restricted Xero credentials, app consent, hosted deployment, SQL/API application, scheduling and accounting effects remain separate acceptance work.

The current callback returns JSON, without HTML, at the OAuth callback URL. An empty-body 302 to a clean result URL is a follow-up hardening task; do not describe it as installed or infer that app creation certifies whole-system security compliance.
