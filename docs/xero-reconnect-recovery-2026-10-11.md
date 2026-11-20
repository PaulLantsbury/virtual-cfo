# Xero membership recurrence — controlled recovery

Status: recovery proposal prepared for review, not applied. Latest Render preflight returned zero connections and reconnect_required. The cash fallback repair is published, but accounting retry remains blocked. The discovery offline-access change is published as 9e6e499; hosted deployment must be verified before owner consent.

## Owner action after approval

1. Confirm the existing Night Scout staging web deployment includes 9e6e499 or a later revision containing its discovery repair. This is the web consent runtime, separately from the Render worker. Do not infer web deployment from a worker build.
2. Apply only db-migrations/proposals/xero-reviewed-sixth-reauthorization-2026-10-11.sql in the existing Night Scout Staging Supabase SQL editor, once explicitly approved. It refuses stale/mismatched evidence, changed functions/grants, an active lease or prior installation. Do not rerun earlier installers. If it refuses, stop and return the bounded exception.
3. Use Settings to reconnect the existing expected organisation. Initial consent now requests ongoing read-only organisation/account discovery; the separate second consent requests the existing accounting report access. No mapping change is required. Do not run worker preflight or report diagnostics between installing this version-bound permission and completing the second consent.
4. After reconnection completes, run node deployments/nightly-staging/run-xero-connection-preflight.mjs once from the existing configured Render shell. Record its connected/organisation/ok result and time.
5. At least31 minutes after that successful check, run the same preflight once more. It checks connectivity and rotates credentials; it does not collect financial evidence. Any failed result stops recovery acceptance. Run the accompanying read-only duration verifier to confirm the two observations span the boundary and the latest receipt matches the current credential.
6. Only after duration acceptance and cash repair deployment verification, review/apply the separately prepared exact October failure retry authorization. Then run one accounting refresh for its exact Oct1–10GBP scope. Accept returned evidence before changing the parked daily schedule.

## Access and permission boundaries

AGENTS.md standing publication approval covers code, tests and SQL proposals, but states it “does not authorise ... applying database migrations”. The sixth recovery creates one restricted authorization table and replaces the existing two bootstrap functions to consume it once. Explicit application approval is required. Existing mapping, accounting evidence, connection identity and prior consumed authorizations are preserved.

Direct Render shell control remains blocked by browser credential protection. Owner consent and SQL application require the existing supported secure interfaces; no credentials should be pasted into chat. Shopify host verification and the separate default-off writer programme remain independent.

Two successful checks establish observed connectivity at those times, not uninterrupted uptime. The suspected relation to short discovery consent remains unproved. No accounting collection, provider transaction or cron activation is part of installing this recovery.
