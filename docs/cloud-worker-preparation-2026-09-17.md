# Cloud nightly worker preparation — 17 September 2026

## Prepared capability

`experiments/shopify/cloud-nightly.mjs` adapts explicit deployment environment settings to the existing file-based nightly runner. It starts a fresh Node child with `NODE_EXTRA_CA_CERTS` present at process startup, rather than changing TLS settings after Node has already started. It reuses the existing candidate-only pipeline, durable reservations, restricted login and store identity. No new financial calculation or second database is introduced.

This is code and test preparation only. No Replit project, cloud secret, scheduled deployment, live schema/grant or nightly collection was created by this package. The existing website deployment is unchanged. Paul's approved 15-minute startup allowance and US$5/month planning allowance are not final deployment activation or an enforced billing cap.

## Configuration contract

The bootstrap is disabled unless `NIGHT_SCOUT_CLOUD_ENABLED` is exactly `true`. Missing or `false` returns a disabled receipt without creating files or starting a child. With opt-in enabled, the default command remains read-only `--check`; candidate collection requires `--tick` and the exact target acknowledgement.

| Environment value | Required constraint |
| --- | --- |
| `NIGHT_SCOUT_CLOUD_ENABLED` | Exact `true` opt-in; unset/`false` disables the bootstrap. |
| `NIGHT_SCOUT_STAGING_PROJECT_REF` | Exactly `bioalckltvkhlczusdvl`. |
| `NIGHT_SCOUT_INTAKE_DATABASE_URL` | Existing dedicated `night_scout_intake_login`, direct staging database host, database `postgres`, port 5432, password present, no query/fragment or TLS override; maximum 4,096 characters. |
| `NIGHT_SCOUT_SHOPIFY_CLIENT_ID` | Explicit development app ID; nonempty/no whitespace or controls; maximum 256 characters. |
| `NIGHT_SCOUT_SHOPIFY_CLIENT_SECRET` | Explicit private development app secret; nonempty/no whitespace or controls; maximum 4,096 characters. |
| `NIGHT_SCOUT_STAGING_CA_PEM` | Trusted staging CA material, parsed X.509 CA certificate(s), maximum 32 KiB/eight certificates; no unrelated trailing text. |
| `NIGHT_SCOUT_REPORT_FROM` / `NIGHT_SCOUT_REPORT_TO` | Exact valid calendar dates; ordered and at most 31 days inclusive. No implicit rolling range. |

Store UUID, Shopify Shop ID/domain, GBP and Europe/London come from the existing fixed target. Original/production project, broad database users and alternative hosts are rejected. A cloud network route using a pooler is not silently substituted; direct database connectivity remains a deployment check.

```sh
node experiments/shopify/cloud-nightly.mjs --check
node experiments/shopify/cloud-nightly.mjs --tick --confirm-target bioalckltvkhlczusdvl/56d92f8a-746e-4b4f-b408-81fc98c4aa17
```

The proposed first infrastructure exercise retains the explicitly selected 17 September test period. Source collection still follows the existing available-history reader, while financial candidate scope remains that fixed date. This is not automatic rolling financial coverage or financial completeness certification.

## Private files and process boundary

After validation, the bootstrap creates a random private temporary directory (0700) and configuration, Shopify credential and CA files (0600, exclusive creation). The child receives only `NODE_EXTRA_CA_CERTS` and `TZ=UTC` environment entries. It does not inherit deployment secrets, arbitrary `NODE_OPTIONS`, Supabase administrator keys or other ambient settings. Database/Shopify secrets appear neither in command arguments nor returned receipts; private temporary paths are passed internally.

The child runs the existing `nightly-development.mjs` with a five-minute timeout and 32 KiB output bounds. Raw stdout/stderr and exceptions are never forwarded. Only recognised receipt fields are returned; any child warning, invalid JSON, failure or timeout becomes a sanitised uncertain outcome. No automatic retry follows.

Temporary material is removed in `finally` on success or handled failure, including malformed output and simulated timeout. A forced termination of the bootstrap process itself can prevent language-level cleanup; deployment storage must remain private and ephemeral, with its lifecycle verified before activation. Owner-only files are not encryption, and this does not replace deployment-secret access controls.

## Schedule and failure semantics

The existing runner owns the agreed 02:00–02:15 local startup window and durable once-per-store/local-date reservation. A cloud tick outside the allowed window fails with a safe nonzero result instead of presenting a successful `not_due` invocation; no collection is attempted in that case.

An `already_claimed` receipt means this invocation did not repeat the reserved collection. It is not a new successful collection and does not establish whether the earlier claim completed or is unresolved; inspect persistent history for that distinction. A timeout or lost acknowledgement can occur after a database commit. Do not infer rollback, retry blindly or clear unresolved reservations automatically.

The bootstrap installs no timer/scheduler and exposes no web endpoint. Platform scheduling, timeout limits and alerts remain deployment configuration. Successful source collection still does not import or certify financial results, clear recheck flags or schedule customer-identifier collection.

## Verification

Six focused bootstrap tests passed:

- Disabled default and explicit fixed-target tick argument gate.
- Private temporary-file permissions, exact configuration and no inherited secret/NODE_OPTIONS environment.
- Rejection of original project, broad role, wrong host, TLS overrides, malformed CA, oversized values and invalid/broad date ranges before spawning.
- Sanitised child failures, simulated timeout, invalid output/warnings and cleanup without retry.
- Exact tick acknowledgement, late-window failure and truthful existing-claim receipt.
- A real fresh Node **synthetic** child receiving its CA setting at startup and reading owner-only test configuration, followed by cleanup.

The last case uses a test child to prove process/file/environment plumbing. It does not connect to Supabase/Shopify, execute the real cloud runner, test Replit outbound routing or establish cloud scheduling reliability. No live credentials were used or uploaded. Existing nightly, runtime and lock tests remain separate evidence for their own layers.

## Remaining activation gates

Use the coordinator's deployment runbook to select and verify the pinned revision, isolated private worker project, committed dependencies, explicit secret placement, direct database connectivity and trusted CA. Review the exact scheduled configuration/cost, fixed scope, required nightly reservation migration and failure alert behaviour before final activation. Then conduct the authorised staging trial and observe an actual overnight run independently of either Mac; this preparation alone is not that result.
