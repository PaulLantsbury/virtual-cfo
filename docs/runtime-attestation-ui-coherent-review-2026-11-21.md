# Complete temporary connection-check candidate — 21 November 2026

This is a locally prepared, tested source/release proposal. The human-approved18-file runtime source at `f978784f98a05eedcc1e75d9977eb530ce0e7491` remains untouched. It has not been deployed. Approval for that source does not publish, deploy or authorize this new client change.

## Exact preparation and active source state

Default-off client/server preparation: `106c5256ab16f09aa8e2d13861f6e495a0aad324`.
Enabled implementation: `d12a6ab38f9d78a9317464a609cf56100ca5abc2`; tree `4f46d8ca23f7ae06be0c57b6a908458cdf342de1`.
Both app-owned server and UI release switches are true in the enabled candidate. The server switch matches the already approved f978 source; the new UI source is enabled only in this separate candidate. The library's default policy remains false. No request/environment flag can activate it. Later review documents are source-identical metadata additions; the final complete local release SHA/tree and cleanup SHA/tree are pinned in the coordinator's local whole-package receipt after build.

The window remains **21 November2026,16:00–18:00UTC**, expiry exclusive. No date or duration was extended. The server retains at most five minutes from process construction and one authorized attempt per process. Neither browser reload nor cancellation creates another server attempt; workers/restarts are not a globally durable latch. No restart/retry/clock workaround is authorized. If the reviewed window is no longer viable, stop: a new explicit window requires newly reviewed source and validation.

## Secure existing application workflow

The temporary control is confined to the existing financial-review page. It uses the app's existing Supabase client/session internally and sends only the exact diagnostic body to existing POST /api/financial-reviews/prepare. There is no new endpoint, credential, grant, operator assignment, generic SQL facility, caller target/revision or additional provider integration. Session retrieval is credential transport; fresh server Auth plus current reviewer assignment AND membership remains authoritative.

The client pins a same-origin URL, refuses redirects, bypasses cache, validates exact closed-month/window before session retrieval and after awaited work, bounds the response to8192bytes and the UI attempt to15seconds, and projects only primitive status/revision plus fixed boolean labels. Private server/SDK errors are never shown. User/store/period changes abort and discard old observations. A page-session dispatch latch does not rearm on scope changes; no automatic retry occurs. Cancellation/timeouts honestly report that the server attempt may already be consumed.

Diagnostic work neither prepares/restores a review nor modifies the review packet, completeness controls or financial caches. Shared busy state prevents concurrent review/restore actions during the check, and normal review work prevents a check starting. The existing normal flow remains available afterwards. Permission denial is not presented as missing configuration. Any false check shows needs-attention; unavailable evidence has no confirmed checklist. After expiry, both facts and stale success status are hidden or explicitly no longer current.

The control does not infer reviewer permission from page visibility or membership. A signed-in ordinary member may see the temporary control when source-enabled but receives no diagnostic metadata unless the existing server reviewer gate succeeds. No user-metadata role claim is trusted.

## Existing-access preflight actually performed

The coordinator used the already signed-in deployed application's normal Prepare action once for the intended staging test store and October. It returned the specific missing-import UI message. In the accepted live client's source, that exact message is produced only for REVIEW_DATA_MISSING409; the known server ordering verifies Auth and the existing assignment/membership join before candidate inspection. This supports current signed-in reviewer access for that scope, without inspecting a bearer, Auth identifier, account name or email. No raw HTTP trace was captured, so the status/code is source-order inference from the observed UI, not a claimed wire capture.

No Restore, new diagnostic, grant, assignment or business record change occurred. This check did not consume the diagnostic budget. It does not prove financial source completeness or the database session role. If the account/session/scope changes before release, preserve or repeat only an explicitly authorized normal preflight; never add access.403/401, a generic409/503 or timeout cannot be treated as approval or fixed by a new assignment.

## Final implementation validation

The frozen enabled implementation passed **44/44** focused source/API tests, zero failures/skips, including the existing37 plus seven new client checks. A serial browser run passed **28/28**:19 existing financial-review cases and nine independent diagnostic UI cases, zero page errors/failures/skips. Enabled cases used the actual true UI source export; only the explicit default-off browser fixture changed that local module to false. No repository/runtime flag was overridden by a request. Fixtures use fake local Auth/API/database records and no hosted account.

Cases cover exact request/projection, ordinary-member denial, unchanged prepare/restore, shared busy state, cancellation, user/store/date isolation, no automatic retries, poisoned state/data, delayed-session expiry and success followed by clock expiry. A stale-success message found by independent review was corrected before this receipt. The labelled synthetic screenshot is local, not a live observation. A whole workspace typecheck/build and compiled-revision check are recorded for the final complete candidate, followed by a separately tested physical cleanup candidate. Counts overlap earlier receipts; no sum is presented as end-to-end certification.

## One coherent proposed approval scope — not executed

1. Publish the precise new source package on a separate branch, with exact final candidate and cleanup trees; do not alter the approved f978 branch or use it to bypass changed-source approval. Record immutable public commit SHAs and verify source-tree equality before any release.
2. Recheck the current live and latest approved website source before deployment. The accepted live baseline was3eda388d534b820728172e0edb7ab9b51d0cc3ad; this proposal must not overwrite any later approved design/Cash/navigation work. A mismatch requires reconciliation and a new tested candidate, not a force update.
3. Only if timing/access/preflight remain valid, manually deploy the exact enabled candidate to the existing staging service, leaving configured branch, auto-deploy, compute, build/start and other service settings unchanged. This is a website/service deployment despite the narrow control; source publication alone does not do it.
4. Within five minutes of process construction and before18:00UTC, use the same signed-in application account, store and closed-month scope. Click **Check reporting connection** once in the existing review page. The app handles its own session. Do not open storage, read tokens, use console/script injection, change credentials or invoke Restore. Require state observed, all eight checks confirmed and displayed build revision equal to the exact deployed public candidate. Any denial, timeout, mismatch or not-confirmed result stops the operation without retry/restart/access repair.
5. Deploy the exact reviewed cleanup source after the observation (including failure) within the approved removal plan. It physically removes the temporary UI and server diagnostic code while retaining review documentation and normal review functionality. Merely changing a switch is not physical removal. Cleanup must preserve the then-current approved non-diagnostic source and is not a database rollback. If the enabled deployment never occurred or a source lease changes, do not blindly deploy cleanup.

The coordinator's local whole-package receipt pins exact candidate/cleanup SHAs, trees, changed files, privacy audit and test/build receipts for review before any permission question. No source-publication request, deployment, diagnostic invocation, database install/write/grant, assignment, provider/feed/scheduler or spending action is executed by this proposal. The only hosted action so far was the separately authorized existing read-only normal preparation preflight.
