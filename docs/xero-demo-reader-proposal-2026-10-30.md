# Separate Xero demo reader — proposal, 30 October 2026

**No live configuration, organisation, consent, credential, schema, grant, store or schedule change is authorised/applied by this document.** Preserve the working reader and its current store/organisation/envelope/mappings/history. Do not create a company or repoint the existing connection.

## Why a separate path is required

The genuine hosted reader diagnostic completed: `organisationVerified=true`, **`isDemoCompany=false`**, `currency=GBP`, with connected/organisation/ok preflight and no accounting collection. The current reader therefore cannot provide a same-tenant binding for a writer that correctly requires a genuine GBP Demo Company. A company/display name is not a substitute for the API fact.

The Xero UI opened Demo Company (UK) and explicitly identified it as fictional demo data. It is separate from the working reader account and is not connected to the new writer app. Use it **only after actual OAuth/Organisation API verification** of its tenant identity, `IsDemoCompany=true` and GBP. No live tenant UUID is known or invented in this proposal. New read-only consent to that tenant is a separate explicit approval. The prepared package uses a new separate Demo Reader app; it does not reuse the existing app or its provider grant surface.

## Important implementation constraint

**Do not simply add a second complete connection/envelope to `xero_v1`.** Existing `worker_get_single_connection_preflight_job()` and `worker_get_single_refresh_job(...)` search eligible connections globally and require exactly one. A second eligible demo connection could make the current working reader fail as ambiguous. Existing worker SQL also enforces `session_user='night_scout_import_login'` and hardcodes `xero_v1`; the runtime pins that login/project/pooler. Environment store/connection IDs alone do not select an isolated job.

The narrow preservation-first design is a separate **proposed** demo schema, e.g. `xero_demo_v1`, with dedicated demo reader/bootstrap roles and RPCs. Reuse tested logic through a dedicated fixed adapter; do not alter the legacy discovery functions, roles, active records or old cron. This is more than copying an environment file, but avoids putting a second eligible row into legacy discovery.

## Exact delta and dependencies

| Item | Proposed change | Preserve / required evidence |
| --- | --- | --- |
| Synthetic store | One separate logical Night Scout demo store plus the existing owner's explicit membership | Assign actual new IDs only during reviewed setup. Agree non-commerce metadata required by the current `stores` schema; do not invent a Shopify connection or reuse the current reader's store. |
| Reader consent | New read-only consent selecting only the actual GBP Demo Company; a new separate Demo Reader app, with its own callback and strictly read-only scopes | Do not revoke/change current consent or overwrite its refresh envelope. Keep read-only app credentials on reader-side hosts; never place them on the writer operator/generator. The prepared package uses a separate Free reader-consent host; the working reader/customer/writer hosts remain separate. |
| Demo persistence | Dedicated connection/account directory, five-category mapping and separate encrypted reader envelope/key version; own evidence/credential/health history and scoped bootstrap/refresh/preflight/lease RPCs | New schema/objects/least-privilege roles and secure private login provisioning require a concrete SQL package and approval. Separate fresh consent material; no copied reader/writer envelope or guessed account IDs. Map actual demo accounts; preserve missing-data states. |
| Reader process | Dedicated demo config/parser and fixed schema/RPC adapter using its own login; separate daily cron | Existing `xero-worker.mjs` pins `night_scout_import_login`, project/pooler and GBP; `xero-refresh-runtime.mjs`/preflight hardcode legacy RPC names. These need a separate demo composition, not environment-only repointing. Reuse completed-period calculation and real London window gate. |
| Member binding | Narrow member-authenticated **public RPC** that can read the new scoped demo binding without exposing its private schema | The prepared `xero_member_active_tenant_binding_v1` currently reads only `xero_v1.connections`, so is not sufficient unchanged. The existing member-binding RPC is already approved and applied for the working reader. Prepare a separately reviewed dedicated demo RPC/transport rather than silently replacing it or broadening its scope. Preserve `auth.uid()` membership, ambiguity guards, no credentials and no health inference. Never expose whole schemas. |
| Writer configuration | Point the separate writer's store binding at the new synthetic store; select the same actually verified demo tenant/contact/non-stock revenue account | This does not move the existing reader. Preserve AAL2 owner verification, new public RPC proof, separate writer app/credentials and API demo checks. |
| Bounded programme | Use the existing unused new identity `xero-staging-20261030`, 30 October–5 November, cap seven, hard stop 6 November | Inspect its ledger/binding first. If already bound/used, never retarget/reset it; seek a fresh explicit identity decision. Keep the approved dates/caps unchanged; skip missed windows, no catch-up or automatic renewal. The old October programme remains expired. |
| End-to-end acceptance | Actual demo-reader connected/Organisation API receipt, disabled writer source proof, then separately authorised first write and following genuine scheduled reader observation | A configured cron or working UI is insufficient. Demo-only reporting must remain separate from genuine merchant revenue and current synthetic dashboard illustrations; dashboard wiring is another explicit data contract. |

The new demo reader must be scoped by store/connection at both database and runtime boundaries, not merely named “demo”. Tests must prove adding/using it leaves old discovery results, mappings, credential versions and accounting evidence unchanged.

## Trial cost envelope

Render's official [cron documentation](https://render.com/docs/cronjobs) currently states a **US$1 minimum per cron service per month** and runtime-based billing. Its [pricing](https://render.com/pricing) lists the smallest 0.5 CPU/512 MB cron at **US$0.00016/minute** (checked 30 October).

For the **Xero demo reader + separate Xero generator pair**, spanning October and November, budget conservatively **2 services × 2 months × US$1 = about US$4 minimum**, leaving US$1 contingency within the already approved **US$5 incremental Xero trial budget**. At seven runs each lasting five minutes, aggregate runtime is about US$0.0112 and ordinarily remains below the per-service monthly minimum; it is not automatically an additional flat US$4 charge plus all runtime. Actual billing, existing service reuse, account credits/taxes and platform treatment must be checked before creation. These are estimates, not a guaranteed invoice.

That cap must cover all **incremental** Xero trial services. A separate new Free reader-consent host is included in the prepared proposal; a paid always-on web host would break this estimate and is not authorised by it. Existing Night Scout/Shopify/Supabase baseline bills are not silently included in the US$4 estimate; if “US$5 total” means all existing project hosting too, reconcile actual billing first. Avoid creating both a replacement and a duplicate generator. Stop at the existing hard stop, remove paid trial resources after evidence/credential review, and verify monthly minimum exposure; merely disabling generation is not proof billing stopped.

## Completed source implementation

The coherent source-only isolation package is now implemented: dedicated demo schema/roles/RPC SQL; fixed demo reader/preflight and frozen deployment; separate two-phase reader consent host/app; member status/binding; exact writer revenue-account proof; and independent tests for isolation, freshness, mapped scope, expiry and old-reader preservation. See [the current concrete approval](xero-demo-setup-approval-2026-10-30.md).

170 regression tests and one real disposable-SQL consent/crypto/member-binding journey passed. Neither the new SQL nor app/host/consent is installed by source completion. Its membership can make an additional empty Demo store visible in the existing selector; customer financial UI integration remains later work. The source trial permits a final6 November02:00 intake and stops6 November03:00UTC. Existing writer dates/cap do not change.

Only the separately reviewed live setup may create the logical store/membership, least-privilege objects, app, hosts/cron or provider connection. Private credentials and MFA must be entered by the owner. Preserve the current successful reader and never add a second eligible row to its legacy global discovery.
