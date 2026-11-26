# Independent cross-review: provider host, logging and collection

Read-only bounded review of the new candidate based on `0e7f99fa5c963de5fe7f3a8f88ec99b180ce08a1`. Reviewed other lanes' host/logging implementation and documentation, then the newly present collection wrapper. No edits to their files and no broad or repeated test execution. Root owns final candidate identity and integration testing.

## Finding

**No new blocking defect identified in the reviewed source.** This is not approval to provision, activate, consent or collect. Host/proxy and operator assumptions below remain real execution gates.

- Dedicated API host defaults off; imports only API runtimes/routers and explicitly refuses report routes. It has no collector/scheduler imports. Startup failure closes already-opened pools; fixed response/error text avoids raw request/driver messages. Capability environment checks reject known cross-capability and administrator credentials; documentation correctly limits this to source-level presence checks, not proof of platform environment-group/filesystem isolation.
- Same-origin proxy contract preserves public Origin, bearer authentication, exact callback query and individual host-only Secure/HttpOnly/SameSite=Lax selection cookies. Relative Settings redirects stay on the website. The private host does not replace public Origin with its Host header. The actual production proxy allowlist and verified private upstream remain pages-owned acceptance work; tests using local forwarding are not a live proxy claim.
- Canary is default off, fixed-target, fictional, bounded-body and finite-expiry. It does not forward to providers or mount beside a credentialed API runtime. The per-process two-request limit is honestly distinguished from a durable global once-only guarantee; fixed expiry plus explicit start-command/proxy removal and restart-loop checks remain mandatory teardown.
- Logging pass requires every fixed profile sink/field plus external review/configuration-equivalence assertions. Transport or local redaction alone cannot pass. A desktop probe does not establish private-host outbound capture; collector profile is separate. Documentation correctly says the evaluator validates attestation completeness, not truth.
- **Keep the private provenance binding with any logging receipt.** The redacted receipt itself contains only sink/count/pass fields, not source, host or expiry. A standalone `pass:true` cannot substitute for the reviewed private exact-configuration record. Source/configuration changes or newly discovered sinks require renewed scoped evidence.
- Collection wrapper pins actual clean Git HEAD to the private approval source, existing staging target, exact store/connection/account or customer/manager lineage, currency/timezone and bounded completed interval. It validates the selected account both through the listing and actual selected-account RPC before credential/provider reads. Ordinal is zero; an exclusive private attempt marker precedes runtime construction. Raw operational output and full receipt stay private; public output is state/coverage only.
- Final collection delta reviewed: private generated collector credential JSON builds only the pinned direct or session-pooler database URL in memory. Meta coverage requires the exact ordered dates, known states, minor-unit amount shape and completion consistency; selected-RPC validation also binds manager/currency/timezone before provider access. Runtime close completes before a finished receipt; close failure produces uncertain cleanup, with no receipt-write retry. `already_running` exits nonzero and no-argument invocation stays disabled.
- Collection's private files use canonical paths, owner-only directories/files, descriptor checks and no-follow/exclusive creation. Existing attempt/receipt files are never overwritten. A failed or uncertain attempt is not retried or cleared automatically. No account override or schedule is introduced.

## Remaining scope limits

The canary, role/provisioning operator and collection wrapper still depend on real approval, correct private binding, trusted host/admin execution, verified sink visibility and operator cleanup. They cannot establish those facts merely from caller-supplied receipt flags. No live network authentication, SQL installation, host secret separation, OAuth, retention eligibility, customer authorization or positive-spend reconciliation was performed here. Google empty/test acceptance remains distinct from spend reconciliation; actual runtime reports remain staging-owner/store pinned plus current membership.

The review does not claim the proposed service is created, its private hostname exists, the production website proxy is mounted, or any provider switch is enabled. Exact commands remain later approved operations. The access lane's own tests are separate from this independent review; no totals are combined.

## Reviewed source hashes

These hashes bind this review to the bytes read before root's final freeze. If another lane changes a reviewed path, assess that delta before carrying this conclusion to a final candidate.

| Path | SHA-256 |
|---|---|
| `deployments/provider-activation/host-boundary.mjs` | `d1e61ee200f01b97639df0c14dad061dfb26af8dcf19eca9efc15f499c7b9a1b` |
| `deployments/provider-activation/host-app.ts` | `ce61875ef2ea167df9163fe72889f3c7c171530c7d89dafbc7c1f2416ca33dc5` |
| `deployments/provider-activation/host-entry.ts` | `01c1b5e53bc423c3d3189596ef15508331b5a36e68e2eb3bc9c83b92f85e8bd3` |
| `deployments/provider-activation/host-service-spec.json` | `354cd5e8a9b4e4022a865afd80ab51952f8ace57101d67c831c3fadcd4fcc708` |
| `deployments/provider-activation/logging-canary.mjs` | `9f11c8a8a3e3decf5bd4f305dcfacf078406c898b4b10ab89571e935280be370` |
| `deployments/provider-activation/logging-probe.mjs` | `570fbe6f631cae4c21581c534d46b3014e6bafb64a981bfb12ce61d54b7887d9` |
| `deployments/provider-activation/logging-attest.mjs` | `e3ddd1a1bf4db6d302b315366474bd8156b17244590249ae03f40d9705d74c96` |
| `deployments/provider-activation/collection-run.mjs` | `27c60d8b3c6dda273825da5c7a3c3bbe00844978ccbf34fb10a1a044067494ba` |
| `deployments/provider-activation/collection-files.mjs` | `f897c0216436b1b6fc01df6978ea0c892997e9be65400cbe8caae1c0505192fe` |
| `deployments/provider-activation/collection-cli.mjs` | `187f98bb5570b9897002fc606bf860463f3f9f454cb85e5d2f3878d9f4ee0627` |
