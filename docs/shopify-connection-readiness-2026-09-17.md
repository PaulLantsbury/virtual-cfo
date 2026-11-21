# Shopify connection readiness — 17 September 2026

For the subsequent live authentication/context and empty-order check, see [connection evidence](shopify-live-connection-2026-09-17.md). For installation and permission history, see [the current handover](session-handover-2026-09-17.md). The following records Package 2 preparation, not a connected Shopify data feed. No external collection, account installation, staging write, new grant or production change was performed. The new `experiments/shopify/connection-readiness.mjs` is an executable server-only integration seam: existing fixed-query HTTP reader → bounded full-history collector → detail loader → existing persistent candidate recorder. It does not introduce another importer, financial calculator, retry ledger or review shortcut.

## Runnable verification

From the repository root, using the existing Node runtime/dependencies:

```sh
node --test experiments/shopify/connection-readiness.test.mjs
node --test experiments/shopify/shopify.test.mjs experiments/shopify/map-sales.test.mjs experiments/shopify/import-first-evidence.test.mjs experiments/shopify/import-subsequent-evidence.test.mjs experiments/shopify/import-runtime.test.mjs experiments/shopify/verified-invalidation.test.mjs
```

Verification completed: 4/4 new integration tests and 40/40 focused existing collector, mapper, import, runtime and invalidation regressions pass.

The four new integration tests exercise actual reader request construction and throttling retry, collector/detail validation, persistent February sale/March refund candidates, replay without duplicates, changed unsupported source invalidation, review visibility, test-order exclusion and secret-safe errors. They use in-memory disposable PostgreSQL and synthetic responses, not a live merchant API.

The candidate round trip stops before authorisation. Existing first/subsequent importer and invalidation regressions separately verify the already implemented reviewed finance write path. Candidate success is never reviewed coverage; `coverageCertified` stays false and `reviewRequired` true. No background process or public collection endpoint is installed by this package.

## Runtime and access boundaries

An authorised internal operator supplies the configured Night Scout store UUID, canonical Shopify domain/Shop ID, reporting range, a just-in-time `resolveCredential` function and an authorised candidate-intake database capability. The seam checks identity/range, resolves the token only at execution, and sanitises failure messages. It does not read environment files or log/store tokens. The existing Shopify client keeps credentials in its request header, disallows redirects, checks the pinned API response version and bounds retries/timeouts.

This module is **not an authorisation layer**. Never expose it directly to a browser. The caller must establish operator authority and database privileges before invocation. Do not repurpose the restricted reviewer or importer database login: candidate intake, reviewer decisions and finance imports have different powers. A live intake connection and any missing grants require a precise reviewed proposal before use. No live intake runtime/role is asserted ready here.

Existing `reviewer-auth.mjs`, review service and `import-runtime.mjs` retain their responsibilities. An expired/revoked credential must fail without claiming successful extraction. Credentials are resolved again on the next run; token acquisition/rotation belongs to the configured server credential provider, not this candidate writer. The new seam prevents overlapping runs on one instance; the existing database protocol serialises store heads across instances. An uncertain write outcome requires inspecting candidate state and replaying the same source protocol, never asserting nothing was written.

## Current installation and API assumptions

Checked against official Shopify documentation on 17 September 2026:

- Create a **dev store**, intended for app testing, in Shopify Dev Dashboard. Dev stores and client-transfer stores are different purposes; do not create a client-transfer store for this connector test. [Shopify dev stores](https://shopify.dev/docs/apps/build/stores/development-stores)
- Create/configure the app in Dev Dashboard, release its configuration version and install it on the chosen development store. This is an account setup task, not something completed by committing code. [Create apps using Dev Dashboard](https://shopify.dev/docs/apps/build/dev-dashboard/create-apps-using-dev-dashboard)
- For a server-side app and store in the **same Shopify organisation**, Shopify documents client-credentials authentication. That flow must not be assumed to work for unrelated future merchant stores; merchant onboarding will need the appropriate separate authorisation flow. Its access token is short lived (24 hours), so the provider must refresh/reacquire it, not treat it as a permanent copied token. [Client credentials grant](https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant), [access token lifecycle](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens)
- The current collector requires both `read_orders` and `read_all_orders`, because refunds may refer to orders outside the default 60-day order window. Shopify requires permission for all-order access. If not granted, report the block; do not silently certify complete history from a shorter window. No write scopes are needed by this read collector. [Shopify access scopes](https://shopify.dev/docs/api/usage/access-scopes)
- Repository queries pin `2026-07`; this is the latest stable version on the verification date. The client rejects a different response version. Pinning alone does not prove our fields are compatible: actual dev-store query execution remains a live gate. [Shopify API versioning](https://shopify.dev/docs/api/usage/versioning)

## Concrete account/access checklist for Paul and the operator

1. Paul signs into Shopify Dev Dashboard, selects/creates the organisation used for Night Scout, and creates a dedicated dev store for app testing. Record the store's canonical `.myshopify.com` domain, currency and timezone. No real customer/payment details are needed for this preparation.
2. Create the Night Scout development app in that same organisation. Configure requested read permissions, including the all-orders permission process if required, release the app configuration and install it on that store. Record the app/store identity and granted scopes, not secrets, in the local connection inventory.
3. Keep client credentials and resulting access tokens in approved private server configuration/secret storage; never paste them into chat, a browser app form, a committed fixture or public GitHub. Prepare the appropriate same-organisation token provider and its expiry handling. This package accepts its just-in-time output but does not create that provider automatically.
4. Run the fixed context query first; confirm actual shop ID/domain, permissions, GBP/timezone selection and API version. Prepare the exact local store-to-Shopify mapping and candidate-intake database access delta for approval if absent. Do not point this at an existing synthetic Store D identity or overwrite its configuration.
5. Create only development transactions allowed by Shopify's dev-store facilities and inspect the source `test` and payment fields. Preserve their real source facts. Dev/test gateway orders flagged `test=true` must remain excluded from actual Night Scout sales under the approved rules. Do not turn off that rule merely to display nonzero figures. [Shopify test orders](https://help.shopify.com/en/manual/checkout-settings/test-orders)
6. Review the concrete results and unsupported cases before approving any staging intake/write. Complete the already established candidate → review → authorised import → verified source reconciliation workflow; collection and import receipts never automatically mark financial coverage complete.

**Important distinction:** the synthetic HTTP fixtures intentionally model eligible non-test source transactions in a disposable database. Their £90 original AOV and later £20 ex-VAT refund demonstrate calculations and plumbing, not proof that a Shopify dev-store test gateway produces eligible actual sales. A live excluded test order is a successful eligibility check, not a reason to manufacture revenue. A nonzero development demonstration needs a separately agreed, clearly synthetic presentation boundary if all available development orders are flagged test; it must not contaminate actual reporting.

## Live completion gate and remaining limitations

Before claiming a working Shopify feed:

- Run real installed-app context, order and detail queries against the configured development store; check actual field support and granted history.
- Independently reconcile the complete small-store source population, original payments, tax/discount/shipping amounts and refund transactions against candidates. The collector is not snapshot-isolated; source changes during/between collection need recheck, not a completeness claim.
- Demonstrate unchanged retry, changed-source invalidation, reviewer visibility, reviewed import and resulting shared sales under an explicitly approved staging setup. Verify the same scoped result on connected pages.
- Verify revocation/expiry, credential refresh and disconnected status in the actual credential provider. No permanent-token assumption or browser exposure.
- Preserve bounded-collector limitations: default maximum 100 pages, current one-order pages, limited nested details, unsupported split/capture histories, tax-inclusive allocation, edited/cancelled orders and other ambiguous adjustments. Reaching a bound fails rather than truncating into “complete”. A resumable large-store sync/webhooks/scheduling are future work.
- Shopify sales alone does not supply verified historic landed costs, saleable-restock evidence, full expenses or merchant profit. Those dependent results remain unavailable until supported.

No new financial-policy decision is required for the tested seam. Development account setup, installation, credential provision and any new database access/application remain concrete external gates; unsupported source semantics must be brought to Paul as worked cases.
