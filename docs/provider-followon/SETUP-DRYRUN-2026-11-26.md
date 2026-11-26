# Independent offline setup/disable rehearsal — 26 November 2026

Scope: actual web composition and actual Meta/Google report-runtime constructors from frozen provider source8472f21, using injected pool/Auth/fetch ports only. No hosted or catalog queries, no live provider/database operation, no secret/configuration inspection, no publication or spending. Existing setup and logging proposals were reviewed rather than rerun as purported new hosted evidence. New test is experiments/marketing/provider-setup-dryrun.test.mjs.

## New sequence evidence

Four new tests passed first on the frozen source through an explicit local source path, then on the new follow-on checkout using its default repository-relative source resolution. Command: `node --test experiments/marketing/provider-setup-dryrun.test.mjs`; Node24.22.3;4/4, zero skips/failures. No production module changed.

Cases:

1. Report-only Meta and Google setup opens separate matching report pools, verifies each identity, reads no OAuth/envelope/PKCE secret fields, performs no Auth/provider request and exposes only report route ports. Closing twice closes each pool exactly once.
2. A later Google pool reporting the API identity instead of its report identity aborts the whole composed setup. The rejected Google pool and the earlier successful Meta pool both close. The error remains generic.
3. Supplying Meta's report URL as Google's report URL is rejected before opening that second pool, and the first pool closes. Credentials are not silently reused across provider capabilities.
4. Disabling report/API controls and restarting opens no pool and exposes no routes. Even stray collector flags cannot cause web startup to construct a collector or schedule; the test ensures the web composition only reads API/report control names. This does not excuse leaving such flags enabled in a real setup.

This adds sequencing evidence beyond the existing isolated constructor and mocked factory tests. It verifies runtime configuration and resource cleanup, not installed SQL/grants or credential deletion. All fixtures are explicitly fictional; default network ports fail if invoked.

## Exact later setup/disable sequence

1. Bind the exact combined source and six SQL hashes, exact staging target, provider and private company/account context in the PM-approved package. Source publication alone is not runtime authority.
2. Repeat catalog absence/signature and effective-grant preflight under separately authorised read-only access immediately before an approved install. Previous zero counts are dated evidence only. If source/signature/role state differs, stop and review drift; do not blindly apply a changed-return-type function.
3. Provision distinct API/report/collector group/login pairs through the secure approved process, retaining only their intended capability. Apply base store, API/collector RPCs then report RPC in the provider's reviewed order. Verify database-wide ownership, memberships, PUBLIC/default/direct grants and denied-role/nonmember cases before enabling credentials. No shared writer or browser raw-table grants.
4. Keep all runtime, collector and acceptance controls off. Close ingress/outbound/export logging gates using the existing exact harmless-canary proposal under later explicit authority. Real tokens/codes are never probes. No temporary diagnostic is authorised by this rehearsal.
5. Configure only the approved capability's environment. A report-only process must receive only report credentials/Auth configuration; OAuth API and collector secrets belong to their separately approved contexts. Constructors sharing process.env are logical separation, not operating-system secret isolation. This rehearsal proves report constructors do not read those fields, not that a host lacks them.
6. Under exact later setup authority, start only the named capability and attest its installed role/grant/source state. Wrong-role or incomplete configuration aborts setup with prior pools closed. No collector runner is a readiness probe. Perform consent or a bounded one-off read only after its separate exact approval; no retry/catch-up/schedule implied.
7. For rollback, stop acceptance/collector controls first. While an approved API remains available, cancel pending selection or disconnect and verify local encrypted credential removal without deleting accepted observations. Separately revoke the external provider grant when authorised. Then disable API/report controls, restart/stop host, verify no provider route ports and revoke dedicated login capability through reviewed SQL. Source rollback alone does not remove credentials. No schema/history drop.
8. With no scheduler, pending credential expiry cleanup must be an explicitly approved finite action. A failed cleanup requires a reviewed recovery decision, not automatic retries or installing a cron.

## Concrete remaining review gaps

- The runtime attests database login identity, not complete current effective privileges. Installation SQL asserts capability boundaries during setup; privilege drift after installation needs a fresh safe ACL/ownership receipt. Passing mocked identity checks is insufficient to certify installed grants.
- There is no evidence in this batch for actual host secret separation, safe ingress/outbound capture, export sinks or log retention. The existing application canary remains narrower evidence. Logging remains unresolved activation work owned by engineering.
- Pool shutdown is not credential-envelope deletion or external grant revocation. The existing cancellation/disconnect SQL tests and later bounded readback must support those separate cleanup assertions.
- Partial first installation and an unexpected existing signature require a reviewed migration/rollback decision; these constructors cannot make a multi-file administrative install atomic. No unsafe blanket drop script is proposed.
- A combined mounted page/request lifecycle still requires pages-owned selection and stale-response tests on its exact candidate. This rehearsal adds no UI hook or request mounting.

No new owner question or tool installation is needed. PM owns GitHub CLI/auth/publication and any later exact hosted request.
