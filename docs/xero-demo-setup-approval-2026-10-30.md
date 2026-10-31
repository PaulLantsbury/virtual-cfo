# Concrete isolated Demo reader setup — awaiting approval

This completes preparation after the existing reader's actual API returned `IsDemoCompany=false`. The already approved writer host/app/cron and two original SQL installations are complete; they must not be repeated. This proposal adds a genuine Demo reader while preserving the working Shopify and Xero connections.

## Additional actions to approve together

1. Apply exactly [xero-demo-isolation-2026-10-30.sql](../db-migrations/proposals/xero-demo-isolation-2026-10-30.sql), once, in verified Night Scout Staging. It creates synthetic store `f59e3a44-7106-4df8-9c08-52da30c9de30` with the existing owner's membership; separate `xero_demo_v1` storage; four restricted bootstrap/reader login/service roles; and authenticated-member public binding/status functions. No passwords, provider IDs, active connection, schedule or writer programme are seeded. Neither private Xero schema is exposed. No old reader objects/data/grants are replaced.
2. Create a **new separate Xero Demo Reader Web app**, proposed name **Night Scout – Demo Reader**. Declare no model training, accept the current developer terms/security commitment, and register only the actual newly verified consent-host callback `/api/xero-demo/reader/callback`. Do not reuse either existing app. Discovery requests only OpenID identity and settings-read; fresh retained consent adds the four granular report reads plus offline access. It has no invoice/contact/account/payment write scope.
3. Create a separate **Free** reader-consent web host, proposed name `night-scout-xero-demo-consent-staging`, and a separate smallest-plan reader cron, proposed name `night-scout-xero-demo-refresh-staging`, using the reviewed independent frozen packages. Names are drafts, not reserved or verified URLs. No customer/old-reader/writer secrets or shared environment groups are copied. Keep the new services disabled during secure provisioning.
4. Complete owner-operated private role-password/app-secret/key setup and MFA. The owner must personally create, enter and submit credentials/OTP; the agent must not receive them. Two fresh owner-authorised consents select the actual UK Demo Company and explicitly confirm existing active account mappings/effective date. Token material stays separate from the writer and existing reader.
5. Run the new reader's connection preflight and one bounded current completed-period collection, followed by fresh health verification. Then enable its proposed UTC schedule **`0 1,2 * * *`**, whose actual-clock guard permits only London02:00–02:14. Scope is completed days this month through yesterday, or the prior complete month on day one; no wider backfill. The fixed intake interval is30 October00:00 through **6 November03:00 UTC exclusive**, allowing the final6 November02:00 read after the final5 November invoice.
6. After actual demo/source/mapping/tenant/reader checks pass, point the **unused** writer consent setup at this new logical store and explicit `demo-public-binding-rpc-v1` transport. Preserve the already approved writer programme identity, dates, cap and £0 paid. Its selected revenue account must be in the reader mapping; its real tenant must match. The existing conditional posting approval does not waive those gates. Do not reset or retarget any used programme/envelope/action.

## Cost and visible effect

This uses the existing **US$5 incremental Xero trial budget**, not a new unlimited allowance. The additional consent host must remain Free; no paid upgrade is authorised. Two small Xero crons (existing new generator plus this reader), across October and November, imply an estimated **US$4 monthly-minimum floor** before checking actual taxes/account charges, leaving limited contingency. Check the current platform estimate before creating anything and stop if the total would exceed the cap. Other existing project hosting is outside this incremental estimate. No measured bill or automatic spend cap is claimed.

At trial close, suspend/retire the trial schedules and separately review credential/app/resource cleanup. Data-intake expiry does not stop hosting charges. A permanent deletion, credential revocation or grant removal needs its applicable concrete review; do not erase audit/action history.

The new member store may appear separately in the current Night Scout store selector. It has no Shopify data; existing customer financial pages are not wired to `xero_demo_v1` yet. This is an isolated test ingestion/acceptance dataset, not a unified Shopify/Demo dashboard or a production release.

## Exact deployment commands

Node24, repository root, development branch only. Consent build:

```sh
node experiments/xero-demo/prepare-reader-consent-deployment.mjs experiments/xero-demo/.reader-consent-runtime
pnpm --dir experiments/xero-demo/.reader-consent-runtime install --config.auto-install-peers=false --frozen-lockfile --ignore-workspace --prod --ignore-scripts
```

Consent start: `node experiments/xero-demo/.reader-consent-runtime/reader-consent-server.mjs`, health `/health`. The disabled server needs no credentials and returns503 on owner/setup routes.

Reader build:

```sh
node deployments/demo-staging/prepare-demo-reader-deployment.mjs deployments/demo-staging/.demo-reader-runtime
pnpm --dir deployments/demo-staging/.demo-reader-runtime install --config.auto-install-peers=false --frozen-lockfile --ignore-workspace --prod --ignore-scripts
```

Reader command: `pnpm --dir deployments/demo-staging/.demo-reader-runtime start`. No runtime files are placed in build-only `/tmp`. Keep `NIGHT_SCOUT_DEMO_READER_BOOTSTRAP_ENABLED=false` and `NIGHT_SCOUT_DEMO_XERO_REFRESH_ENABLED=false` until their own setup gates pass. Exact separate environment names are in the package runbooks.

## Review evidence

170 final regression tests plus one cross-boundary consent/actual-SQL/crypto/member-binding journey pass; independent review found no source blocker. Both frozen dependency installations and disabled installed-tree smokes passed. Source/SQL tests cover least privileges, store/tenant/account identity, actual demo and currency checks, period mapping, expiry/one-use state, fenced token rotation, prior-value retention, new deadline and original-reader non-interference.

See [SQL contract](xero-demo-isolation-contract-2026-10-30.md), [consent runbook](../experiments/xero-demo/README.md) and [reader runbook](../deployments/demo-staging/README.md). These tests do not prove live credentials, new hosted consent, scheduled execution, actual invoice linkage, complete financial reporting or whole-system security compliance.
