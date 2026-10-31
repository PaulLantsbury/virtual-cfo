# Shopify live connection — 17 September 2026

## Delivered

Three parallel workstreams implemented server-only credential acquisition/refresh, an independently tested identity/settings/scope verifier, and a code-backed staging intake proposal. Coordinator integrated these with existing fixed Shopify queries and conducted live read-only checks. This is an operator connection package, not merchant onboarding or an enabled import service.

- `credential-provider.mjs`: fixed canonical Shopify token destination, client-credentials flow, private just-in-time loader, expiring in-memory cache, bounded requests, redirect refusal, explicit invalidation and sanitised failures. Same-organisation development use only; future merchant OAuth remains separate.
- `verify-connection.mjs`: existing fixed context query; exact Shop ID/domain/currency/timezone, actual token scopes and pinned API version. No collection/import/coverage claims from context success.
- `check-development-connection.mjs`: repeatable explicit-private-config operator check, optional bounded order read and safe counts. No database writes or raw order output.
- [Staging intake proposal](shopify-staging-intake-proposal-2026-09-17.md): separate new store and restricted intake authority; no live grants applied.

## Live evidence

Installed Night Scout Development app 424626651137, Custom distribution. Active version `night-scout-full-history-readonly` (1132636897281). Partners permission was approved; refreshed Dev Dashboard exposed the scope after an initial stale-form validation failure. Initial token still granted only `read_orders`. Reopened the developer install route, selected PocketLaunchpad1, reviewed “Update data access / All orders”, and approved the update under Paul's setup authority. A fresh token then passed both required scopes.

Verified shop: `gid://shopify/Shop/95601983836`; domain `pocketlaunchpad1.myshopify.com`; GBP; Europe/London; actual API response version 2026-07. Existing collector completed one page and returned zero orders, zero refunds and zero review flags. No raw records persisted, no Supabase writes, no financial coverage certified. Empty-source success does not validate order detail/refund fields against actual transactions.

## Private configuration and repeatability

Local private configuration is `.local/shopify-development-credentials.json`, ignored by Git and owner-readable/writable only. It contains the expected shop context plus client ID/secret. Never copy it into documentation, frontend variables, source fixtures or public GitHub. Clipboard used for private capture was cleared. Tokens are acquired in memory; no token file is published.

Run the operator checker with an explicit `--config` private file path; add `--read-orders` for bounded read-only collection. No scheduled job or public endpoint is installed. After grant or secret changes invalidate/recreate the provider and verify again. Do not treat a historical successful receipt as continuous connection health.

## Limits and next task

Development store is empty. Next prepare Shopify development transactions and verify test flags, exclusions and later refunds without changing the agreed financial rules. Test orders must not become actual revenue. Staging intake remains gated on a tested, exact new-store/access proposal and Paul's approval. Existing local staging application continues using its current data; no application UI changed in this package and no new connected badge was added. Production and Replit are unchanged.

## Verification

33 focused tests pass: 8 credential provider, 7 context verifier (including real-provider integration), 4 operator runner, 4 existing persistent readiness tests and 10 existing collector/transport tests. Independent review found no blocker. Final operator command also passed live with both scopes and the zero-order result above. Whitespace checks pass. No frontend changes, so browser suite/build was not rerun for this server-only package. No new database capability was enabled in staging.
