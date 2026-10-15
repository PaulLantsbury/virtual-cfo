# Provider writer — operational handoff, 15 October 2026

> Superseded hosting boundary, 15 October 16:02 London: Paul requires the main Night Scout product and readers to remain read-only. Do not configure writer credentials, consent UI or writer callback on the customer app host. Use the isolated operator design in `experiments/test-programme/OPERATOR-HOST-ISOLATION.md`; the earlier customer-host callback instructions below are historical and must not be followed. No separate operator host is active yet.

This is the consolidated setup sequence for the existing approved trial, not a new proposal to widen it. The adjacent `writer-provisioning-manifest.json` is a non-secret checklist: no runtime reads or applies it. Installation was acknowledged by the 9 October operator receipt; current apps, passwords, secrets, consent and scheduler state still need secure external inspection. A local source review cannot establish their presence.

## 1. Inspect existing resources, then provision privately

| Resource | Required boundary | Concrete next operation |
| --- | --- | --- |
| Staging schema/roles | Supabase `bioalckltvkhlczusdvl`; existing `night_scout_test_writer` login and NOLOGIN `night_scout_test_writer_service` | Run existing `activation-postflight.sql` through the authorised database operator. Do not rerun the combined installation. |
| Dedicated password | Existing restricted login only; three or fewer connections; sole SET-only service membership, no admin/inherit/bypass | Inspect password presence as a boolean through the existing authorised operator. If missing, provision through its secure password workflow (for an already authorised interactive psql session, `\password night_scout_test_writer` prompts privately). Never put a value in command arguments, committed SQL, chat or screenshots. |
| Session pooler | `aws-1-eu-west-1.pooler.supabase.com:5432/postgres`, username `night_scout_test_writer.bioalckltvkhlczusdvl` | Compose the restricted URL inside the hosted secret interface; retain verified TLS and existing trusted CA. No reporting, read-worker or bootstrap credential substitution. |
| Shopify app | Separate writer app in the same organisation as PocketLaunchpad1; `read_orders write_orders`, optional `read_all_orders` | Inspect/create this app, choose development-store installation and privately provision its client ID/secret. Do not broaden the collector app. |
| Xero app | Separate writer OAuth client; exact hosted callback; invoice/settings/contact read scopes | Inspect/create the separate app, register the callback below, privately provision its own credentials and writer encryption key. Do not reuse the read app or read envelope master key. |
| Owner consent | Actual GBP Demo Company; no ordinary trial-company substitution | Enable the configured consent-only host/card, then owner selects the genuine demo tenant. Success is `writer_connected_programme_disabled`. |
| Invoice bindings | Existing synthetic contact and active non-stock revenue account in that demo tenant | Verify/select them through the secure provider/operator session. The current writer does not create contacts/accounts. |
| Read feed | Same tenant as the writer for accounting acceptance | Check the existing reader tenant. If different, prepare a separate demo read binding; preserve the working reader and its mappings. |

An operator password-presence query may return only `rolpassword IS NOT NULL`, never the stored hash. The ordinary writer cannot inspect `pg_authid`, and no elevated login should be borrowed to bypass that boundary. The runtime already validates actual role flags and the sole non-inherited SET membership before credential RPCs.

Root owns shared-browser operations. Owner consent is intrinsically an owner step; app configuration and secure provisioning can be performed within existing authority where supported interfaces allow it. Report a specific observed restriction, not a hypothetical demand for the user to repeat all setup.

## 2. Configure the consent host while generation remains off

Web service exact callback:

`https://night-scout-xero-staging.onrender.com/api/xero/test-writer/callback`

| Setting | Hosted API / consent | Generator process |
| --- | --- | --- |
| Writer OAuth client ID | `NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_ID` | `NIGHT_SCOUT_TEST_WRITER_XERO_CLIENT_ID` |
| Writer OAuth client secret | `NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_SECRET` | `NIGHT_SCOUT_TEST_WRITER_XERO_CLIENT_SECRET` |
| Writer encryption key | `NIGHT_SCOUT_TEST_WRITER_ENVELOPE_MASTER_KEY` | Same variable, same separate writer key |
| Writer key version | `NIGHT_SCOUT_TEST_WRITER_ENVELOPE_KEY_VERSION` | Same variable and version |
| Restricted writer DB URL | `NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL` | Same restricted identity; never a reader URL |
| Trusted CA | `NODE_EXTRA_CA_CERTS` points to existing valid secret file | Equivalent trusted CA path on that host |
| Staging project | `NIGHT_SCOUT_TEST_PROGRAMME_PROJECT_REF=bioalckltvkhlczusdvl` | Same |

Hosted consent additionally requires `NIGHT_SCOUT_XERO_TEST_WRITER_BOOTSTRAP_ENABLED=true`, `NIGHT_SCOUT_RUNTIME_ENV=staging`, existing exact `NIGHT_SCOUT_XERO_STAGING_OWNER_ID` / `NIGHT_SCOUT_XERO_STAGING_STORE_ID`, public auth configuration `NIGHT_SCOUT_REVIEW_AUTH_URL` / `NIGHT_SCOUT_REVIEW_PUBLIC_KEY`, and `NIGHT_SCOUT_XERO_TEST_WRITER_REDIRECT_URI` equal to the callback above. Pin `NIGHT_SCOUT_XERO_TEST_WRITER_EXPECTED_TENANT_ID` only after the demo tenant is actually verified. With no pin, bootstrap permits only one connected organisation and still requires provider GBP/demo proof.

Frontend consent card is hidden unless the build receives `VITE_XERO_TEST_WRITER_CONSENT_ENABLED=true`, `VITE_XERO_TEST_WRITER_OWNER_ID` and `VITE_XERO_TEST_WRITER_STORE_ID` matching the exact server bindings. These IDs are display gates, not authentication. Never put a client secret, DB URL or encryption key in a `VITE_` variable. Keep generation flag `NIGHT_SCOUT_TEST_PROGRAMME_ENABLED=false`; consent stores an encrypted separate envelope and a disabled programme only.

## 3. Use existing readiness paths; do not misuse the write runner

- Existing database check: `experiments/test-programme/activation-postflight.sql`. It returns capability/count metadata, not secrets or account balances.
- Existing Shopify source check: `mintShopifyWriterToken` in `shopify-writer-token.mjs` followed by `createProviderTransport(...).verifyTarget(...)` in `provider-transport.mjs`. These mint a short-lived writer token, verify actual granted scopes, and query only exact shop/domain/GBP/development identity. No order or ledger action is created by those functions. Invoke them only in the secured operator process after app provisioning; retain only safe true/false receipt metadata. Never print the token or provider body.
- Existing Xero demo proof: owner bootstrap validates the connected tenant and `IsDemoCompany=true` / GBP before saving its disabled writer envelope. It preserves owner/store-bound one-use state; its receipt contains no token.
- Existing plan-only check: valid private config + `NIGHT_SCOUT_TEST_PROGRAMME_ENABLED=false` + `node experiments/test-programme/run-provider-test-programme.mjs`. Expected exit 0, `state=prepared-disabled`. Its `actions=6` field describes the original plan, **not transactions created**. It does not validate live secrets, DB login, envelope or scheduler.

**Do not call `withRefreshedXeroWriter` as a disabled preflight.** Its existing database envelope claim requires an enabled programme, and its failure handler calls `stop_programme`. Using it while disabled can stop the programme without verifying the connection. Do not set generation true or alter time to turn the write runner into a source-only check. Initial fresh demo proof belongs to the bootstrap; action-time renewal/target verification belongs to the actual approved scheduled action after all enablement gates pass.

The CLI first reads/validates its config, then checks the enable flag. Missing config therefore returns exit 1 / `configuration-or-provider-unavailable` even while disabled. `outside-generation-window` and `no-mutation-day` return exit 0; they are not provider-success receipts. `uncertain-stop`, `reconciliation-required` and `configuration-or-provider-unavailable` return exit 1 and need investigation, never claim clearing or blind resubmission.

## 4. Bind private configs and disabled rows

Use the existing `prepareOriginalTrialActivation` only as a preparation aid; it is not evidence of installed roles, usable secrets, activation authority or posted-demo approval. Use `disabledProgrammeRowsSql` only after both actual provider identities are verified. It preserves an exactly matching disabled Xero row from consent and refuses used/incompatible keys. Root coordinates any operator SQL step; this package does not apply SQL.

Private Shopify config exact keys: `provider=shopify`, `target=pocketlaunchpad1.myshopify.com`, `startMonday=2026-10-12`, `programmeKey=shopify-staging-20261012`.

Private Xero config exact keys: `provider=xero`, actual verified demo UUID `target`, `startMonday=2026-10-12`, `programmeKey=xero-staging-20261012`, existing synthetic `contactId`, validated revenue `accountCode`, `financialMode=posted_demo_only`. No guessed live UUIDs or mock contact/account bindings. Do not put `enabled` into these config files; the runner rejects unknown config keys.

Generator runtime also needs `NIGHT_SCOUT_TEST_PROGRAMME_CONFIG_FILE` pointing to the appropriate private per-provider config, exact `NIGHT_SCOUT_TEST_PROGRAMME_TARGET`, and `NIGHT_SCOUT_TEST_PROGRAMME_VERIFIED_TEST_TARGET=true` only after actual checks. Shopify secrets are exactly `NIGHT_SCOUT_TEST_WRITER_SHOPIFY_CLIENT_ID` / `NIGHT_SCOUT_TEST_WRITER_SHOPIFY_CLIENT_SECRET`. Posted demo mode additionally requires action-time `NIGHT_SCOUT_TEST_WRITER_POSTED_DEMO_APPROVED=true` under the existing explicit approval. The database programme remains disabled until role/config/envelope/target checks and the operational schedule are reviewed together.

## 5. Original remaining windows and acceptance

| Date | London window | UTC window | Maximum new activity per provider |
| --- | --- | --- | --- |
| 17 October | 18:00–18:14 | 17:00–17:14 | One Shopify nominal £60 test order; one £10 Xero demo invoice |
| 19 October | 18:00–18:14 | 17:00–17:14 | Same |
| 20 October | 18:00–18:14 | 17:00–17:14 | Same |
| 24 October | 18:00–18:14 | 17:00–17:14 | Same |

12/13 October remain missed, with no catch-up. Hard stop is `2026-10-26T00:00:00Z`; no extension or restarted Monday. Original cap is six actions per provider: Shopify £360 nominal / £0 charged and Xero £60 posted demo revenue/receivables / £0 paid. At the Thursday checkpoint the remaining ceilings are Shopify £240 nominal and Xero £40. This is not a £60 nominal Shopify-total cap. All orders stay `test=true`; no VAT/payment/email/stock transaction is added.

No schedule is installed here. Keep source collection and generation separate: future first genuine test write should be followed by its next real overnight read, then source/candidate/report acceptance. Shopify test orders remain excluded from financial sales; a receipt cannot certify zero merchant revenue or financial completeness. Xero invoice effects must appear through the matching demo read feed and its supported accounting period.

Local verification on 15 October: existing CLI executed in isolated child processes with synthetic temporary config and generation disabled for both providers. Each exited 0 / `prepared-disabled`; missing config exited 1 / `configuration-or-provider-unavailable`. No DB credentials, API credentials, provider calls or writes were involved. This confirms the command’s disabled path only, not live provisioning.
