# Provider capability isolation — proposed, not activated

Prepared 26 November 2026 against candidate based on `0e7f99fa5c963de5fe7f3a8f88ec99b180ce08a1`. No source publication, service creation, configuration delivery, OAuth, provider request, database write or collection is authorized by this document. The exact tested candidate must first be published and its remote commit verified; the existing deployed branch is not evidence that these new files are available to Render.

## Smallest viable arrangement

| Environment | Capabilities and credentials | Excluded provider credentials |
|---|---|---|
| Existing website | Report database roles, member authentication, same-origin proxy | API/collector database roles, OAuth app secrets, envelope keys |
| New `night-scout-provider-api-staging` private service | API database roles; each enabled provider's OAuth/envelope configuration and owner authentication | Report and collector roles; unrelated product/cloud administration secrets |
| Separate local operator process, one selected provider | Collector role, envelope key, required provider client configuration, approved store/date bound | API/report roles, other provider secrets; scheduler |

One private service in Frankfurt, one instance, `0.5c-512mb` (legacy name `starter`), costs **$7/month incremental base compute**, prorated for runtime. Existing website/workspace charges remain. Builds, outbound bandwidth and other metered usage can add charges; this is not an all-in invoice cap. No new database, disk, queue or scheduled worker is proposed. [Render pricing](https://render.com/pricing.md), [compute plans](https://render.com/docs/compute-plans.md).

The private service has no public hostname; the website must be on the same reachable private network. Confirm workspace, region and environment isolation before creation. Its internal hostname and port must be verified after creation and bound privately to the proxy; do not guess them. [Private services](https://render.com/docs/private-services.md).

`deployments/provider-activation/host-service-spec.json` is a deliberately non-executable provisioning specification, not a validated Blueprint or an API request. It leaves the source and upstream bindings unresolved. The selected plan's current API/tool identifier must be checked at provisioning; some tools still accept only `starter`. Auto-deploy is off. All three host/API switches start false and no secrets or environment groups are attached. No HTTP health-check field is configured; use Render's TCP check.

## Exact source and startup

From repository root, build using `pnpm install --frozen-lockfile && node deployments/provider-activation/host-build.mjs`; start using `node deployments/provider-activation/dist/host-entry.mjs`. Set `PORT=10000`. The entry binds `0.0.0.0`, reports only fixed readiness metadata, handles termination, and defaults off. `/health` provides local/operator status; it is not a provider acceptance result.

`host-app.ts` mounts only the existing Meta and Google API routers. It never imports the shared application entry, report runtime, collector or scheduler. Both `/spend` routes return 404 on this host. The website serves those routes locally. Failed startup closes already-opened pools and emits a fixed error, without underlying error text.

`host-boundary.mjs` checks presence without displaying values. It rejects cross-capability provider credentials, unknown nonempty `NIGHT_SCOUT_*` variables on dedicated API/collector profiles, common cloud/admin credentials and instrumentation injection variables. The website profile permits unrelated existing product configuration while rejecting provider OAuth/envelope/API/collector secrets. This guard is not proof of complete platform secret isolation: verify dashboard environment groups, build environment, platform instrumentation, filesystem mounts and launch inheritance separately. Collector approval must use a clean selected-provider environment; merely changing its database URL in the website shell is insufficient.

Distinct database credentials are delivered only through the access lane's approved private file/delivery procedure, separately by provider and capability. No shared multi-capability secret file, broad database URL or service-role key belongs on these hosts. Installation, credential delivery and LOGIN activation are separate approvals.

## Public callback contract, without pin changes

Keep the currently pinned public origin `https://night-scout-xero-staging.onrender.com` and each existing `/api/meta-ads/callback` or `/api/google-ads/callback`. No runtime registry/pin change, callback registration change or CORS widening is needed for this arrangement.

The website proxy must have an explicit method/path allowlist for the existing provider API routes, excluding `/spend`. Preserve the callback query exactly, request Origin, Authorization, Cookie, content type and bounded request body. Use only the privately verified fixed upstream; never accept a destination from the caller. Do not follow upstream redirects. Forward response status, relative Location and individual Set-Cookie fields without adding Domain. Do not record request URLs, payloads, cookie/header values or upstream error text.

Existing routers validate the configured public Origin; the private Host header does not replace it. Their host-only Secure/HttpOnly/SameSite=Lax selection cookies have the provider path. When returned through the public website those cookies belong to that website. Relative `/settings` redirects also remain there. The collector's existing public callback configuration remains unchanged even though collection runs locally.

Validation: standalone strict TypeScript checking passes with `skipLibCheck:false` using `host-tsconfig.json`; host bundling passes; all four focused tests pass. The focused host tests use fictional runtime factories and an actual local HTTP forwarding composition. They check disabled startup, missing report/unrelated routes, cleanup on startup failure, environment rejection, both providers' callback cookies and redirects, Google owner account selection and wrong-Origin denial. They do not prove the production website proxy allowlist, Render network behavior, provider authentication, SQL permissions or platform logging. Those are separate integration and hosted gates.

## Logging gate and activation order

Before delivering API secrets, temporarily start the logging lane's standalone canary on this same private service, using its explicit finite expiry and exact two-path website proxy. It deliberately does not mount into the API application. Capture fictional callback/query/header/body/error/response markers through website ingress and private-host logging. Run the outbound instrumentation probe from that same private host to the approved controlled sink. A desktop-only probe does not prove private-host outbound capture behavior.

Remove the two canary proxy paths and restore the disabled API entry after the finite test. Confirm canary shutdown and evidence review before credentials. Real callbacks contain sensitive values: a passing application logger check alone does not establish platform/proxy/APM behavior.

Approval scopes remain concrete and separate: (1) publish the tested source and verify SHA; (2) create exactly the named private service at the stated base cost, initially disabled; (3) verify private binding and apply reviewed website proxy/report separation; (4) install exact database objects and deliver capability credentials under the access plan; (5) activate the explicitly chosen API/report capability and perform owner connection/selection; (6) launch one approved collector attempt with a fixed provider/store/date bound and retry ordinal zero. No retry, schedule or advertising spend follows implicitly.

Use the existing bounded collector entry through a clean operator environment and the separately reviewed activation command. Do not invent a generic collector invocation here: the role/run lane owns its exact one-attempt command and receipt. Observe Supabase attempt/observation/report results through approved capability reads, then the member report and pages. An empty test account can demonstrate functional acceptance; it cannot demonstrate genuine positive-spend reconciliation, and the owner has no account with historical spend.

## Cleanup and alternatives

Stop the finite collector, retain redacted receipts, and disconnect through the API while its capability remains available when approved. Disable provider switches and proxy binding, remove temporary canary routes, revoke approved capability credentials and stop/delete the new service within its approved lifecycle. NOLOGIN does not terminate existing database sessions: session termination is a separate explicit operation. External provider revocation, destructive database cleanup and deleting the service require their stated approval; preserve source and audit evidence.

A Render one-off job inherits its base service's environment and successful build. Therefore a job launched from the website or API service is not collector secret isolation. A cloud-only collector alternative requires its own clean base environment and additional compute, plus job runtime charges; it is not the selected minimum-cost arrangement. [One-off jobs](https://render.com/docs/one-off-jobs.md).
