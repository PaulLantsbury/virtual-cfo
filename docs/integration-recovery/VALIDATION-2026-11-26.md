# Integration validation — 26 November 2026

Initial recovered checkpoint: `57b2c6e2e2a8fd0426ac819bb6b2d6c598445fc4`. This initial run precedes coordinator composition/security fixes; final candidate rerun remains required.

Node 24.22.3, pnpm 11.25.0. Locked dependencies installed with `CI=true pnpm install --frozen-lockfile --ignore-scripts`. Offline installation lacked tarballs; restricted network attempt failed DNS; approved dependency installation completed. No secret/configuration files copied. No provider or live database calls were used.

- `node --experimental-strip-types --test experiments/marketing/*.test.mjs artifacts/api-server/tests/*ads*.test.mjs`: **80/80 pass**, no skips/failures. Includes recovered Meta/Google runtime, route, repository, collector, reader, acceptance and cloud provider-facts tests.
- `node_modules/.bin/tsc --strict --noEmit --target ES2022 --module nodenext experiments/marketing/provider-facts.ts`: pass.
- `node --experimental-strip-types --test artifacts/api-server/tests/safe-request-path.test.mjs`: **2/2 pass**. This proves application query stripping only, not hosted ingress/outbound logs.
- Full root build attempted with `pnpm_config_verify_deps_before_run=false PORT=5189 BASE_PATH=/ pnpm run build`: failed frontend typecheck because recovered MetaDailySpendPanel imports missing metaAdsSpendApi. API, mockup and scripts typechecks passed. The missing helper causes four derivative implicit-any diagnostics. Coordinator informed; no UI edits made by test owner.

The pnpm environment switch prevents pnpm 11 automatically reinstalling dependencies before each script; it does not disable any TypeScript or build checks. Unmodified root build command remains the final required gate. Earlier plain build attempts stopped at pnpm dependency-state network/reinstall checks before compilation.

Raw local logs: `/tmp/night-scout-provider-tests.log`, `/tmp/night-scout-integration-build.log`. Historical 27/42 results are superseded only for the actual scopes above; not live acceptance.

## Integrated source rerun

After helper recovery and startup composition, full root build passed. Actual mounted Express tests found a malformed Google report UUID expression that stub-only tests had missed. Coordinator corrected that route and the recovered Meta client helper. Fresh full root build then passed again, including every workspace typecheck, API bundle and both frontend builds. Existing nonfatal bundle-size warnings remain.

Added `marketing-mounted.test.mjs`: **2/2 pass**, actual app/router composition, local-only ephemeral server, disabled connect/callback/spend JSON/no-store responses before SPA, independent report-only authentication/company binding, malformed UUID denial and connection still disabled. Uses fictional ports; no live provider/database calls. Loopback execution needed approved process permissions. Added `meta-spend-client.test.mjs`: actual client with injected fictional auth/fetch checks standard UUID acceptance and malformed UUID refusal before auth/fetch.

Strict standalone TypeScript compilation of both provider-facts and provider-history-contract-proposal passed; whitespace check passed. Full suite initially exposed a real SQL failure (94/95), now owned by SQL implementation lane; final suite result follows after freeze. Test logs are disposable and not public artifacts.

After six SQL function fixes froze, the complete command below passed **98/98**, zero failures/skips (includes five SQL rehearsals and five offline history-proposal tests):

```sh
node --experimental-strip-types --test experiments/marketing/*.test.mjs artifacts/api-server/tests/*ads*.test.mjs artifacts/api-server/tests/marketing-provider-startup.test.mjs artifacts/api-server/tests/meta-spend-client.test.mjs artifacts/api-server/tests/safe-request-path.test.mjs
```

This checkpoint still certifies the explicitly labelled known Meta expiry-history gate, not its future repair. Any subsequent repair requires another targeted/full provider rerun and final source manifest. Mounted tests remain separate **2/2**, not included in the 98. Full build passed on latest application changes; SQL proposal modifications do not enter application bundle.

## Scoped public-source audit

84 changed/untracked selected files inspected at this checkpoint. No environment files, credential stores or private captures selected. Automated source scan found zero private-key, JWT, Google client-secret, AWS-access-key, GitHub-token or HTTP credential-URL patterns. Four email-like matches were fictional database credential fixtures using mock passwords and the existing pinned project host/role labels; no email/operator binding. Synthetic fixture UUIDs retained. This scoped scan does not certify hosted telemetry or replace final diff review after further changes.

## Actual application logging canary

Mounted suite expanded to **3/3 pass**. New case bundles the actual application and launches an isolated child with only PATH, production mode and info log level. A fictional loopback callback supplies distinct canaries in code/state/token query fields, Authorization and Cookie headers. Captured JSON logs retain `/api/meta-ads/callback` and 503 status while containing none of those canaries. This verifies the real Pino application composition, beyond the existing helper-only tests. It does not establish Render ingress, external log drains, tracing or outbound instrumentation treatment. No hosted configuration or telemetry changed.

Mounted suite now **4/4 pass** following shared Meta wire-validator integration. Actual Meta route preserves expired saved spend and a distinct unknown day, denies company/account-lineage mismatch and refuses extra private credential fields without echoing the payload. This uses injected fictional report ports and verifies the route's real validator. Standalone strict TypeScript passes for facts, history proposal and Meta wire contract. Producer/storage repair freeze and final suite/build are still required after this checkpoint.

## Producer repair verification

Frozen expiry producer update passed complete provider command **103/103** (including real SQL and wire-contract tests); mounted application **4/4** rerun passed. Standalone strict contract checks and whitespace checks passed. Full build caught TS6059: the shared TypeScript contract under experiments is outside API `rootDir`. Coordinator is fixing the packaging boundary; this interim source is not build-ready. No compiler setting was weakened.

## Final frozen source result

After converting the shared wire contract to canonical `.mjs` plus precise `.d.mts`, with no compiler relaxation, all final gates pass:

- Complete provider command above: **103/103**, zero skips/failures.
- `node --test artifacts/api-server/tests/marketing-mounted.test.mjs`: **4/4**, zero skips/failures (approved loopback-only process).
- `pnpm_config_verify_deps_before_run=false PORT=5189 BASE_PATH=/ pnpm run build`: **PASS**, all workspace TypeScript checks, API bundle and both frontend builds. Nonfatal sourcemap/chunk-size warnings remain.
- `node_modules/.bin/tsc --strict --noEmit --target ES2022 --module nodenext experiments/marketing/provider-facts.ts experiments/marketing/provider-history-contract-proposal.ts experiments/marketing/meta-spend-report-contract.d.mts`: **PASS**.
- `git diff --check`: **PASS**.

API route and recovered client now consume the same canonical pure contract. The full build checks both imports. The final result supersedes the intermediate packaging failure and known expiry gate described historically above. The final coordinator commit/manifest binds these receipts to exact source; no hosted/provider effects were performed.
