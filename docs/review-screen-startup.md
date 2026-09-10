# Review screen and API startup — 10 September, local/draft only

The API startup can now compose the checked runtime into the review router. It is off by default. Only `NIGHT_SCOUT_REVIEW_ENABLED=true` enables initialisation, with all four dedicated variables required:

- NIGHT_SCOUT_REVIEW_PROJECT_REF
- NIGHT_SCOUT_REVIEW_AUTH_URL
- NIGHT_SCOUT_REVIEW_PUBLIC_KEY
- NIGHT_SCOUT_REVIEW_DATABASE_URL

The runtime rejects missing/mismatched configuration before connecting. Failed enabled startup logs a fixed message and stops instead of exposing a partially initialised service. SIGTERM/SIGINT closes the HTTP server and review pool. Generic DATABASE_URL is not used for review configuration (other pre-existing API features still have their own database dependency). No enablement variable or real login was provisioned during this work.

The API now directly declares the already-used workspace versions of Supabase JS, pg and pg types. The pnpm lockfile records these dependencies. No new package versions were selected; cached packages were linked offline with install scripts disabled.

## Reviewer screen

Authenticated merchant routing now includes `/financial-review`. The screen uses the active authorised store, lets the reviewer choose a period and prepares a review through the API. It shows unavailable, blocked and passed-check states. A successful reconciliation still requires an evidence reference, a written description of the independent check and explicit completeness confirmation before restoration. Changing dates clears the packet and approval. Store/account transitions remount protected state, and late/unmounted responses are discarded.

Only a matching server response can confirm restoration. Errors clear the approval; stale evidence requires another review. Timeouts/network uncertainty do not trigger automatic retries. Successful restoration invalidates frontend query caches. A missing API (including a Vite HTML fallback) shows an unavailable message rather than offering restoration. The screen does not itself grant review permission, create source evidence or prove historical completeness.

The route is available directly; it is not yet added to ordinary merchant navigation. The frontend expects `/api/financial-reviews` on the same origin. Local Vite needs a reviewed proxy or combined host before calling an enabled API. No browser-visible credentials or cross-origin API override were introduced.

## Validation

- Two startup tests pass for default-off and invalid enabled configuration.
- Four isolated Chrome groups pass: evidence/confirmation requirements and exact period submission; blocked/unavailable states; date reset and stale review handling; HTML fallback.
- Four HTTP groups pass again through the service composition.
- Full workspace type checking, API build and frontend build pass. Existing frontend tooltip sourcemap/large-chunk warnings remain; the API bundle is larger after including the runtime/SDK.
- Browser responses were synthetic and all non-preview traffic was mocked/blocked. The screen was visually inspected in an isolated browser. No live Supabase authentication, migration or restoration was exercised.

Next: prepare the exact staging migration/login/enablement plan and review deployment request limits/origin controls. After approval, provision only the staging role/login, verify real Auth plus the same-origin UI/API path and test the review end to end. Source-to-authoritative-evidence importing and wider financial product work remain unfinished. No Replit sync, merge or production release occurred.
