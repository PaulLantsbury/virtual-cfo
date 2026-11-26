# Executable fictional logging canary and finite cleanup

Prepared only; no remote probe or deployment performed. This package supplies an actual HTTP server, probe, offline attestation evaluator and tests. It never forwards traffic, queries providers, opens a database, reads provider credentials or writes observations. The standalone listener is not imported by the customer app or provider API runtime.

## Exact placement and approval boundary

The selected architecture is the existing public website's narrowly scoped proxy → a new private API service. Before API credentials are delivered, temporarily run the private service with `node deployments/provider-activation/logging-canary.mjs`. Pages owns two exact temporary POST proxy paths:

- `/__night_scout_fictional_logging_canary__/capture`
- `/__night_scout_fictional_logging_canary__/failure`

Preserve query, Authorization and `x-provider-secret` headers and JSON body for these fictional requests; do not broaden the proxy to arbitrary URLs. The existing reviewed public website origin is compiled into the probe allowlist. A different public origin needs a reviewed source change; configuration cannot repoint this probe at Meta, Google or an arbitrary host. `x-provider-secret` is a generic fictional sensitive-header test, not an actual Google developer-token requirement.

The temporary process must have no Meta/Google credential, Auth, database or API-key bindings. Both CLIs reject credential names without reading their values. Known nonsecret host/provider enable controls may remain present only with the literal string `false`; `NIGHT_SCOUT_PROVIDER_API_HOST_ENABLED`, Meta API runtime and Google API runtime flags can therefore remain as the disabled Blueprint specifies. True or malformed controls fail. Use a credential-free environment before the API/collector secrets are provisioned. Do not expose this endpoint beside a credentialed customer application. Existing website keys need not be moved into the diagnostic process: only its normal narrowly scoped proxy handles fictional traffic.

This requires the specific temporary private-service start command, exact proxy paths, absolute expiry, run location/profile, log inspection and teardown approval. No creation, deployment, flags, shell-on-host or remote request is performed by the local tests. A new paid host remains PM's separate approval step.

## Bounded execution

The server is off unless `NIGHT_SCOUT_FICTIONAL_CANARY_ENABLED=true`. Local mode binds only `127.0.0.1`; `isolated-host` mode binds `0.0.0.0` on supplied `PORT` and requires the exact existing HTTPS public origin. `NIGHT_SCOUT_FICTIONAL_CANARY_EXPIRES_AT` must be a reviewed absolute UTC instant in `YYYY-MM-DDTHH:mm:ss.sssZ` format, in the future and at most15minutes away. Do not automatically regenerate an expiry on process restart.

One process accepts one ordered two-request attempt, then closes. A malformed request also closes it. The second request deliberately exercises an error path; its expected HTTP503 is a successful probe condition, not a production error. Every request/response is small, bounded and fictional; redirects and oversized responses fail. A maximum five-second request budget and finite socket closure apply. SIGTERM/SIGINT invokes the same cleanup.

**Render may restart an exited process.** The two-request limit is per process, not a durable global once-only guarantee. The fixed absolute expiry stops subsequent listeners after that deadline. Immediately restore the approved disabled API start command and remove the temporary proxy after the single authorized attempt; do not leave a restart loop, retry the probe automatically or treat an automatic restart as fresh approval.

## Operator sequence and commands

Before executing, privately record the exact source/host/proxy configuration, absolute expiry and approved profile. No account identifiers, dates, credentials or real OAuth material belong in this binding.

1. Configure the temporary private-service process with `NIGHT_SCOUT_FICTIONAL_CANARY_ENABLED=true`, `NIGHT_SCOUT_FICTIONAL_CANARY_MODE=isolated-host`, the approved absolute expiry, platform `PORT`, and `NIGHT_SCOUT_FICTIONAL_CANARY_ORIGIN` equal to the compiled existing website origin. Start only:

   ```sh
   node deployments/provider-activation/logging-canary.mjs
   ```

2. Prepare the separately approved credential-free probe environment with `NIGHT_SCOUT_FICTIONAL_CANARY_PROBE_ENABLED=true`, that same absolute expiry, `NIGHT_SCOUT_FICTIONAL_CANARY_ORIGIN` and `NIGHT_SCOUT_FICTIONAL_CANARY_APPROVED_REMOTE_ORIGIN` both equal to the exact public origin, and profile `api` (default). Leave `NIGHT_SCOUT_FICTIONAL_CANARY_OBSERVATIONS_PATH` unset for the initial run. Run once, saving only the redacted receipt:

   ```sh
   node deployments/provider-activation/logging-probe.mjs > canary-transport-receipt.json
   ```

   Initial exit1 is expected until sink evidence is supplied. A transport pass means only that the five fictional field classes reached the two endpoints. It proves neither absent logging nor safe retention. Launching this probe on a desktop does **not** exercise private API outbound instrumentation; the API profile needs the approved probe to originate in the matching credential-free private-host/instrumentation environment, using the controlled public endpoint. A separate collector profile later uses the approved credential-free operator/collector environment. Do not run an unapproved extra host merely to satisfy another phase.

3. Inspect the fixed fictional markers from `logging-canary.mjs` in every required sink using the approved log/configuration viewer. Record field coverage and configuration equivalence privately, not raw log extracts. For each sink, write an observation with `sink`, `evidenceReviewed:true`, `sameConfiguration:true`, and all five `fields` (`query`, `headers`, `body`, `error`, `response`). A field verdict is `absent-verified` or `disabled-verified` only with actual observed/configured evidence. Use `present` or `unobservable` otherwise. A no-match search without demonstrated sink coverage is not verified absence. Platform/workspace exports, injected APM and request logs must not be omitted.

4. Evaluate the saved transport and inspection **offline**, without repeating the probe. Set `NIGHT_SCOUT_FICTIONAL_CANARY_RECEIPT_PATH` to the saved receipt and `NIGHT_SCOUT_FICTIONAL_CANARY_OBSERVATIONS_PATH` to the reviewed observations JSON; keep the same approved profile:

   ```sh
   node deployments/provider-activation/logging-attest.mjs > canary-privacy-receipt.json
   ```

   Exit0 requires all required sinks/fields verified; missing, duplicate, unknown or exposed required evidence produces exit1. This evaluator validates the completeness of operator attestations, not their truth independently. It is never a substitute for inspectable configuration and log evidence.

## Fixed profiles and exact receipt shape

`api` requires ten sinks: website ingress/application/runtime-agent/proxy-outbound/exports, and API ingress/application/runtime-agent/outbound/exports. `collector` requires four: collector application/runtime-agent/outbound/exports. `combined` requires all14. Profile selection is a fixed source map, not an arbitrary caller-provided exclusion list. API setup may progress with its approved ten-sink evidence while collector remains disabled; a collector acceptance still needs its own four-sink evidence. Any sink newly identified in the approved architecture requires source/profile review, not silent omission.

Receipts contain **only** sink names, field counts and pass/fail. Each required sink must have `fieldCount:5` and `pass:true`; transport likewise has five fields/pass. Top-level `pass` must be true. Exact successful `api` receipt shape:

```json
{
  "transport":{"sink":"transport","fieldCount":5,"pass":true},
  "sinks":[
    {"sink":"website-ingress","fieldCount":5,"pass":true},
    {"sink":"website-application","fieldCount":5,"pass":true},
    {"sink":"website-runtime-agent","fieldCount":5,"pass":true},
    {"sink":"website-proxy-outbound","fieldCount":5,"pass":true},
    {"sink":"website-exports","fieldCount":5,"pass":true},
    {"sink":"api-ingress","fieldCount":5,"pass":true},
    {"sink":"api-application","fieldCount":5,"pass":true},
    {"sink":"api-runtime-agent","fieldCount":5,"pass":true},
    {"sink":"api-outbound","fieldCount":5,"pass":true},
    {"sink":"api-exports","fieldCount":5,"pass":true}
  ],
  "pass":true
}
```

A server cleanup receipt is exactly `{"sink":"cleanup","fieldCount":0,"pass":true}`. The response intentionally contains a fictional response marker so response capture is exercised; neither CLI output nor its application logger emits any marker, query, header, body, error message, URL, account ID or secret value.

## Finite teardown checklist

After the approved attempt, confirm the server emitted cleanup and stopped its listener. Restore the private service's approved **disabled** API entry/start command, remove canary flags/absolute expiry, and have pages remove both temporary proxy paths. Verify the canary paths are unavailable without re-sending marker payloads, service health is normal, provider flags remain off, no collector schedule was added and no fictional diagnostic instance/restart loop remains. Remove temporary inspection files according to the approved operational retention choice; retain redacted outcome/provenance only. Do not claim platform log deletion from local file removal. Failed teardown blocks real OAuth.

## Local evidence

Focused tests use real loopback HTTP and the actual probe, including expected error response, redacted application output, automatic close, invalid request termination, expiry, disabled mode, provider-origin rejection, secret-name rejection, sink-profile completeness and the offline attestation CLI. No remote request or provider call is used. Local transport and redaction pass cannot close the hosted capture gate.

Validation: **8/8 focused groups passed**, zero failures/skips/cancellations. Raw local receipt: `/tmp/night-scout-logging-canary-tests.log`. The initial restricted listener attempt failed with local EPERM; the authorized loopback-only execution then passed. No remote probe was executed.
