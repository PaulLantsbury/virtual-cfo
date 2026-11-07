# Render staging web/API migration preparation

Status: prepared only. No Render service has been created, no redirect has been
changed, and the Replit website and scheduled worker remain unchanged.

## Boundary and topology

This package creates one paid Render Web Service for the Night Scout **staging**
React application and Express API. Express serves the built SPA and `/api` from
one process and one origin. It connects only to Supabase staging project
`bioalckltvkhlczusdvl`. It does not define a Render database, cron job,
background worker, production service, migration, or database privilege.

The Blueprint is `deployments/render-staging/render.yaml`. In Render, deploy a
Blueprint from `PaulLantsbury/virtual-cfo`, branch `codex/restart-baseline`, and
select that file as the Blueprint path. It pins the current paid 0.5 CPU/512 MB
web plan, Frankfurt, one instance, Node 24.21.0, the existing hosted build, the
existing API start command, and `/api/healthz`. Automatic deploys are disabled
for the migration so a reviewed branch revision must be deployed deliberately.

The build command installs only the API/frontend dependency closure through
`build-hosted.mjs`, builds the React SPA into
`artifacts/virtual-cfo/dist/public`, and bundles Express into
`artifacts/api-server/dist/index.mjs`. Render supplies `PORT`; do not set it.

## Exact callback gate

The reviewed runtime accepts exactly the existing Replit staging callback and
the proposed Render staging callback. It retains the configured value and uses
that byte-identical URI for both authorisation and token exchange; arbitrary
hosts, HTTP, production URLs and path changes remain rejected.

Initial Blueprint creation is only to reserve the hostname and deploy inert
staging. Do not edit the Xero app or begin consent during service creation. If
Render assigns any hostname other than the exact value below, stop and update
the allow-list, Blueprint and tests together. Do not use a redirect, proxy,
wildcard callback or relaxed hostname validation.

The proposed Render hostname is:

```text
https://night-scout-xero-staging.onrender.com
```

Confirm Render actually assigns that exact hostname before merging the callback
change or editing Xero. If the name is unavailable, update the Blueprint,
runtime allow-list, tests and Xero redirect together before deployment.

## Environment contract

The Blueprint commits only non-secret staging constants. Render prompts for the
following values; copy each from the existing **Night Scout Xero Staging**
Replit project without printing it in a shell, chat or deployment log:

- `VITE_SUPABASE_ANON_KEY`
- `NIGHT_SCOUT_XERO_CLIENT_ID`
- `NIGHT_SCOUT_XERO_CLIENT_SECRET`
- `NIGHT_SCOUT_XERO_STAGING_OWNER_ID`
- `NIGHT_SCOUT_XERO_STAGING_STORE_ID`

Do not add the bootstrap database URL, staging CA, envelope master key or key
version during initial creation. Discovery does not require them, and omitting
them keeps retained bootstrap fail-closed.

The following values are intentionally omitted from the initial Blueprint
because discovery has not established them. Add them together in Render only
after owner review of the returned test-tenant directory:

- `NIGHT_SCOUT_XERO_STAGING_TENANT_ID`
- `NIGHT_SCOUT_XERO_MAPPING_EFFECTIVE_FROM`
- `NIGHT_SCOUT_XERO_STAGING_MAPPING_JSON`

At that same later, separately reviewed step, add the dedicated staging-only
bootstrap database URL, staging CA, envelope master key and key version. Remove
them again immediately after the retained connection is verified.

Use the existing dedicated, staging-only bootstrap session-pooler URL. Do not
substitute the importer login, `postgres`, a service-role key, transaction
pooling, or any production credential. Values not yet known after discovery may
remain unset only if the reviewed runtime explicitly supports discovery-only
startup; they must be added before retained bootstrap.

`NIGHT_SCOUT_REVIEW_AUTH_URL`, `NIGHT_SCOUT_REVIEW_PUBLIC_KEY`,
`NIGHT_SCOUT_XERO_STATE_KEY`, and `PORT` are not required. The existing public
Supabase variables in the Replit repository configuration point at production;
the Blueprint deliberately overrides them with the staging URL and a staging
publishable key.

## Callback transition

1. Complete and test the exact Render callback allow-list code change locally.
2. Confirm the assigned Render hostname exactly matches the Blueprint and code.
3. Add, but do not yet remove, this redirect in the Xero staging test app:
   `https://night-scout-xero-staging.onrender.com/api/xero/staging/callback`.
4. Populate Render secrets and deploy the reviewed branch revision.
5. Verify the same-origin SPA, health endpoint, owner boundary and malformed
   callback before starting consent.
6. Run discovery/consent only against the Render origin. A state created on one
   process/origin cannot be completed against the other.
7. Keep the Replit web deployment available for rollback until the Render flow
   has persisted and verified the staging connection. The existing Replit
   scheduled worker is not moved or modified.
8. Only after successful cutover, remove the old Replit redirect from the Xero
   test app and retire the Replit **web** deployment. This does not authorise
   stopping the scheduled worker.

## Acceptance checks

Use the assigned hostname in place of `$base`:

```sh
base=https://night-scout-xero-staging.onrender.com
curl -fsS "$base/api/healthz"
curl -fsS "$base/" | grep -F '<!doctype html'
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$base/api/xero/staging/discover"
curl -sS -o /dev/null -w '%{http_code}\n' "$base/api/xero/staging/callback"
```

Expected results are health `200`, SPA `200`, unauthenticated discovery `401`,
and malformed callback `400`. Confirm `Cache-Control: no-store` on the Xero
responses. Then perform the existing authenticated owner discovery flow. Do not
claim cutover from health checks alone.

Rollback is to leave DNS/Xero callback selection on Replit and delete or suspend
only the new Render staging web service. No schema or database rollback is
needed because this preparation creates no database objects.
