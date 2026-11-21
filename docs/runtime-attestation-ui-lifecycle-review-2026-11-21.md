# Temporary runtime-check UI lifecycle review — 21 November 2026

Source review only. No hosted query, activation, new window, publication or deployment. This batch prepares a normal signed-in operator workflow rather than asking an assistant to handle an access token.

## Coherent invocation

Use the existing financial review page and protected prepare request with its explicit runtime-check mode. The browser obtains its own current session through the existing Auth client and sends the existing bearer header internally; tokens must never be copied to chat, an assistant tool, a document, a URL or a log. Show only a bounded result with revision and match booleans. Never instruct the user to paste a token or execute a console request.

The UI release switch is a visibility control, not authorization or proof that the signed-in person is a reviewer. Ordinary members may reach the existing page but must receive denial from the server unless current exact-store membership and reviewer assignment both match fresh verified Auth. Do not expose a public capability/role metadata endpoint just to determine whether to show the control. The diagnostic button can state that it is restricted to authorised reviewers; it must not create assignments or imply entitlement.

Validate one complete closed London calendar month. Reuse explicit store/period context; forbid an open month, a partial period or caller-supplied revision, role, target, clock or policy. Diagnostic response handling must be separate from ordinary prepare-review packets and must not invoke restoration, invalidate query data or represent the result as financial verification. Context change, logout/unmount or expired operation must cancel/ignore stale responses and clear the previous diagnostic display. Denial or uncertainty is not an instruction to retry automatically.

## Timing and release semantics

The current service policy pins 21 November 2026 **16:00–18:00 UTC**, with the end exclusive. There is no new window chosen in this review. A later invocation requires a separately reviewed exact-source timing change; do not renew dates, restart to extend an expired absolute window, or add an environment override silently.

The process-age limit is five minutes from service construction, not five minutes after clicking the button. A deployment/startup delay can exhaust that limit before an operator is ready. One accepted authorised attempt consumes the process-local latch; denial before the gate does not. Multiple instances/restarts can each own a latch, so this is **not a globally one-use authorization**. An uncertain response must be investigated through receipt/status rather than restarted/retried to manufacture success. Check expiry before Auth, after Auth, before diagnostic SQL and after the result/transaction, as the current service does.

Both server and UI release flags must be false in the source-review candidate. Only a concrete separately reviewed active revision can expose/enable the temporary path. A visible button cannot imply that the server is active; a hidden button does not secure an enabled server. No runtime environment/credential change is needed for the proposed source-controlled lifecycle.

## Removal and cleanup package

After the single bounded operator workflow, prepare a concrete cleanup revision that:

1. Sets the temporary server and UI switches false immediately and removes the extra page control, diagnostic display/state, handler and temporary imports without disturbing normal prepare/restore controls.
2. Detaches the temporary startup composition and optional service method. Remove the diagnostic-mode router branch and its response projection while preserving normal review validation, safe errors and authentication.
3. Removes or archives temporary source helpers and declarations only after confirming no production import remains. Retain test/review receipts and a non-sensitive outcome record; do not delete audit/database records or revoke general reporting access as cleanup.
4. Runs normal review-route, denied-operator, context/expiry and workspace checks; confirms the old opt-in request is unavailable and ordinary preparation/restoration semantics remain unchanged.
5. Names the tested cleanup revision and verifies deployment and control disappearance separately. Passing the absolute expiry prevents further diagnostic results but does not itself remove the UI/code. No scheduled cleanup job, automatic release or persistence deletion is claimed.

Do not bundle customer-sidecar schema/data/grants, financial correction, provider activity, feed changes or broader UI redesign into this cleanup.

## Acceptance and decision boundary

Before requesting the active revision, demonstrate normal browser sign-in, exact closed month, current reviewer denial/success, one coherent pending state, no automatic retry, response whitelist, abort/stale-context protection, keyboard status, and disabled/off mode. Test the exact process-age and absolute boundaries using controlled clocks; actual browser checks belong to the deployed accepted candidate and cannot be inferred from source tests.

No new product decision is necessary to prepare this normal-auth workflow. A concrete active source/timing revision and its cleanup plan need the bounded release review after implementation/testing. If the existing window has passed, the unresolved decision is the exact replacement invocation window for that reviewed revision—not generic permission, access expansion or a new role.

## Whole-package access preflight — prepared, not executed

Existing private proof contains one membership candidate ID only and explicitly states no owner/operator authorization receipt. It contains no verified binding between that ID and Paul or the currently signed-in browser session. Proposed selection actor/time are not a saved action or permission. Therefore **Paul's current reviewer assignment for the exact company remains unverified**; do not infer identity or operator access from membership count/UUID.

The smallest pre-deployment access check can reuse the **currently deployed normal financial review page**, before changing any runtime flag or deploying the new candidate:

1. In the existing signed-in app, select the intended isolated company and October 2026 (1–31 October). Use normal **Prepare review once**, with runtime attestation absent. Browser Auth attaches its own session; no assistant token access, console request, copied bearer or identity field is needed. Do not click Restore or confirm completeness.
2. Record only company/period match and one bounded outcome. A validated200 preparation packet proves that fresh Auth and the existing assignment+membership gate passed for that exact request, even if the packet reports financial checks blocked. A409 with the exact `REVIEW_DATA_MISSING` code also follows that gate in the inspected implementation and can establish reviewer authorization while stating that no imported candidate is ready. A generic409, UI message alone without the known code mapping,503, network failure or timeout does **not** establish the gate.401 requires ordinary sign-in;403 means stop. Do not create assignments, widen grants or deploy to overcome denial.
3. This authorization fact is transaction-specific and may later be revoked; it is not a stored single-use approval or the new process attestation. Bind a successful preflight receipt to the current deployed source/path semantics. No financial records are changed by normal preparation. Do not retry automatically on uncertainty.

This is one proposed read-only preflight action for inclusion in the combined concrete review; it has not been executed by this reviewer and authorizes no release on its own.

The coherent release package should name an immutable **both-flags-active** candidate and its tested timing, the one readiness invocation and a concrete cleanup revision/action, preserving the earlier f978 source untouched. The current16:00–18:00UTC window must still be valid when reviewed/deployed and the process-age limit must allow the deliberate invocation. If it has expired, the candidate needs an explicitly reviewed new source/timing revision; silently selecting a replacement window or restarting to bypass the absolute expiry is not permitted. This document chooses no new window.

## Subsequent executed existing-access preflight

The coordinator subsequently used the already signed-in existing app UI, selected the intended staging test company and October period, and clicked normal Prepare once. The visible result was the specific missing-import message. In the accepted deployed client this message is emitted only for REVIEW_DATA_MISSING409; the known server preparation service verifies fresh Auth and current assignment+membership before candidate inspection. This supports the current signed-in account's existing reviewer gate for that scope. It is UI observation plus source-order inference, not a captured HTTP trace or a real-world name/email identity audit. Raw Auth identifiers/tokens were not inspected. No Restore, new diagnostic, grant, assignment or record change occurred. It does not attest the web process's database session; that remains the purpose of the separately reviewed enabled diagnostic. Private scope/session receipt remains outside the repository.
