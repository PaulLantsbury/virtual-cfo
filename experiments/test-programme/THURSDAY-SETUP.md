# Original provider trial — Thursday 15 October setup

This package prepares the already approved isolated test programme. No provider writes, credential provisioning, SQL application or schedule activation is performed by these helpers.

The original programme starts **12 October**, stops **26 October**, and caps each provider at six actions. The 12/13 October slots were missed and must stay missed. At Thursday's checkpoint the remaining slots are **17, 19, 20 and 24 October, 18:00–18:14 Europe/London**. All four are before the clock change and correspond to 17:00–17:14 UTC. Do not move the original Monday, enlarge the cap or extend the stop. A newly requested later recurring programme is a separate bounded plan.

Remaining maximum activity is four Shopify nominal GBP60 test orders (GBP240, no charge, excluded from merchant revenue) and four GBP10 posted Xero demo invoices (GBP40 revenue/receivables, no payment/email/VAT/stock). The original six-action Xero maximum remains GBP60; missed slots do not get added to later dates.

## Inspect before setup

1. Use `activation-postflight.sql` in the existing authorised operator interface to check installed roles, RLS tables, RPCs, programme count, action count and encrypted writer envelopes. The combined installer was already applied. **Do not reapply the installer** or reset any claims/used programme rows.
2. Provision a password for the existing restricted writer login privately, retaining the same role isolation. Build the restricted session-pooler URL in the secret interface. Never place passwords/tokens in SQL committed to GitHub, chat, command arguments or logs. Existing reader/reporting/bootstrap credentials cannot be substituted.
3. Create and install a separate same-organisation Shopify writer app for `pocketlaunchpad1.myshopify.com`, exact scopes `read_orders write_orders`, optional `read_all_orders`. Do not expand the read collector app. The existing token adapter verifies fresh grants; the transport checks actual development/GBP identity on every action.
4. Provision a separate Xero writer OAuth client, exact hosted callback and encryption key. Enable the consent-only bootstrap route and its default-off Settings card only after its required server configuration is present. Follow `ACTIVATION.md` for the distinct hosted versus CLI environment variable names.
5. Owner completes the separate **Connect demo test writer** consent using the actual GBP **Demo Company**. An ordinary trial organisation is not sufficient. Confirm receipt `writer_connected_programme_disabled`. Select an existing synthetic contact and active non-stock revenue account; do not create contacts or accounts as an implicit fallback.
6. Verify which tenant the accounting read feed uses. Posted demo invoices cannot appear in a feed attached to another tenant. Preserve the existing read-only connection while preparing any separate demo read binding; do not broaden it to invoice-writing scopes.

App creation, secret provisioning and inspection may proceed through supported secure interfaces within the existing approval. Hand off only a specific step actually blocked by access protection; never ask for secret values in chat. Xero owner consent is the intrinsic owner interaction.

## Pure preparation helper

`prepareOriginalTrialActivation` in `trial-activation-readiness.mjs` accepts a provider, authenticated provider-check evidence, a list of configured environment **names** and the real current time. It returns the remaining original windows, missed dates, hard stop, ceilings, setup blockers and, only with fresh matching provider evidence, a private config matching the existing CLI runner. Config is prepared only; it does not carry authority to enable a programme. Environment-name presence is explicitly not credential validation.

The helper never fetches providers, reads environment values, writes a file/SQL row, starts consent or installs a schedule. Its returned `platformResourcesVerified`, `activationAuthorized` and `postedDemoActivationApprovalVerified` are always false. It cannot replace live dedicated-role postflight, writer consent, target checks, encrypted-envelope readiness or durable claims. Actual write execution independently checks the target, date/window, enabled database programme, posted-demo approval and duplicate/uncertain-outcome ledger.

Generate disabled rows with the existing `disabledProgrammeRowsSql` only after both provider targets are independently verified. Keep their existing programme keys and private target bindings exact. The helper deliberately provides no enablement SQL. Before enablement, separately verify the restricted database login, each programme/config match, initial Xero envelope, per-provider writer credentials and safe scheduler invocation. Schedule installation and first action acceptance remain later operational steps.

For any first action, require provider receipt → scheduled source collection → supported report evidence. Shopify test orders prove transport/freshness, not merchant revenue. A Xero posted invoice must be observed through a read feed on the same demo tenant. An uncertain provider result stops the programme; no blind resend or claim clearing.

Checks: `node --test experiments/test-programme/trial-activation-readiness.test.mjs` plus the existing provider safeguard suite. Passing local tests does not prove external apps/secrets/schedules are configured.

## Approval wording clarification — coordinator review 15 October

The concrete original activation package at Git revision 6d03ffe4c05d5644ecb738c56126f23caf0e5e4d, docs/live-feeds-batch-2026-10-09.md, specified six Shopify GBP60 nominal test orders with no real charge and six Xero GBP10 invoices. Paul approved that linked package. Later assistant shorthand “GBP60 per-provider caps” did not record a user-requested change. Preserve original limits: Shopify GBP360 nominal total/GBP0 charged (GBP240 nominal remaining); Xero GBP60 total (GBP40 remaining). No new consent, credentials, provider identity, activation or scheduler verification is implied by this clarification.
