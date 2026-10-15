# Daily test-feed amendment — 15 October 2026

Status: concrete bounded proposal, not activated. Paul requested daily Shopify/Xero test updates today. Existing approval covers isolated development/demo writes, but the installed runner still has six specific dates; this document does not silently turn that into indefinite daily generation. No code, SQL, grants, secrets or schedules are changed here.

## Smallest useful daily trial

Replace the four remaining original windows (17, 19, 20, 24 October) with **15, 16, 17, 18 October**, each **18:00–18:14 Europe/London (17:00–17:14 UTC)**. Do not add these to the old dates. Preserve original programme identities, targets, hard stop 26 October and durable action history. The missed 12/13 October actions stay missed.

| Provider | Per date maximum | Four-date maximum | Forbidden effects |
| --- | --- | --- | --- |
| Shopify | One GBP60 nominal development test order | GBP240 nominal; GBP0 charged | Payment, receipt email, fulfilment, inventory changes, merchant financial inclusion |
| Xero | One GBP10 AUTHORISED synthetic invoice in actual GBP Demo Company | GBP40 posted demo revenue/receivables; GBP0 paid | Payment, invoice email, VAT, stock, new contacts/accounts, real-company posting |

These are remaining ceilings, conditional on inspecting the real durable ledger. Any previously submitted, confirmed or uncertain action consumes its existing safety budget and must be reconciled before calculating remaining capacity. Never clear claims or create a new programme key to recover capacity. This is a cadence amendment, not permission for more than four future actions per provider. A daily programme beyond 18 October needs an explicit bounded duration and financial cap; indefinite daily operation is not proposed.

If provisioning/review is incomplete at today's window, skip 15 October. Do not run immediately outside the window, fake the clock, backdate an invoice or catch up tomorrow. A later start requires re-confirming the four future dates while preserving the same ceilings and hard stop.

Decision before activation: accept the four-date replacement at the existing remaining ceilings, or specify a different bounded daily period/cap. Implementation and disabled preparation can proceed before this decision; operational enablement cannot assume an enlarged budget or changed schedule.

## Required implementation before the new cadence can work

`run-provider-test-programme.mjs` currently hard-codes offsets `[0,1,5,7,8,12]` from 12 October. It returns `no-mutation-day` on 15/16/18 October even if a cron is installed. A cron change alone is therefore insufficient. Prepare and test a versioned explicit-date amendment that retains original programme keys and original ledger history, removes superseded future dates, prohibits past/catch-up execution and validates the approved remaining ceilings. Review the database claim enforcement alongside the runner: the original aggregate cap of six does not itself enforce an amended four-date allowlist. Do not assume a source-code date list provides an independently durable schedule/currency cap.

Acceptance must cover original dates disabled, new dates exactly once, restart/duplicate protection, uncertain-outcome stop, stale config refusal, missed windows skipped, hard stop and real concurrent claims. Preserve invoice idempotency identities once an action has been submitted; changing its date/payload requires a newly reviewed future action, never a replay under a different key.

## Exact live prerequisites

1. Run existing `activation-postflight.sql` through the authorised operator; confirm actual installed writer roles, programme rows, envelope presence and all action states. Do not replay the installer. Inspect the restricted login's password presence privately as a boolean, not its password/hash.
2. Provision/verify the dedicated writer session-pooler identity, verified TLS and trusted CA. No reader, reporting or bootstrap DB credential substitution. Existing separate writer secret configuration must be inspected on the actual host, not inferred from names in a manifest.
3. Shopify: separate same-organisation writer app, granted `read_orders write_orders`, development-store installation, exact `pocketlaunchpad1.myshopify.com`/GBP/development proof using the existing token/target check. Keep collector permissions unchanged.
4. Xero: separate writer app/client secret and separate writer encryption key, exact callback `https://night-scout-xero-staging.onrender.com/api/xero/test-writer/callback`, configured consent-only server/card. Owner consents to actual GBP Demo Company; bootstrap must return `writer_connected_programme_disabled`. Verify the exact synthetic contact and active non-stock revenue account.
5. Compare actual Xero writer and reader tenant IDs. They must match for the posted invoice to reach the intended accounting feed. An ordinary test organisation is not automatically Demo Company. Preserve the working read connection/mappings if a separate demo read binding is needed.
6. Bind private per-provider configs and disabled programme rows, matching the existing keys. Follow `experiments/test-programme/OPERATOR-PROVISIONING.md` for exact environment names; hosted consent and generator OAuth variable names differ. Verify deployed runner revision and actual host clock. Never use `withRefreshedXeroWriter` as a disabled readiness probe: its failure path can stop the programme.
7. Review amended schedule/config/remaining-cap evidence together; obtain the concrete cadence decision and operational enablement before enabling database rows, generation flag and scheduler. Separate provider execution remains gated by verified test target and posted-demo approval. Install only reviewed future windows; no Run now outside them.
8. Accept first write by safe provider receipt plus durable confirmed ledger, then the next genuine source collection and resulting source/accounting evidence. A confirmed write is not a successful read, supported report, cash movement or healthy next-day credential refresh.

As of preparation, app/secret/consent/scheduler presence is not verified by this document. These are practical operational dependencies, not requests for passwords in chat. Most configuration can be handled through authorised secure interfaces; owner Xero consent is the necessary owner interaction if not already completed.

## What will move, and when

**Shopify source activity:** genuine development orders should produce changing source activity, collection timestamps and excluded-test counts after the next completed read. They remain `test=true` and excluded from merchant revenue, orders and profitability. Do not disable exclusion or mislabel them as live financial sales to make a chart move.

**Xero accounting:** AUTHORISED GBP10 invoices can increase demo revenue and receivables through a matching tenant/account mapping and supported reporting scope. They do not add bank cash. A scope ending yesterday cannot include today's invoice: a 15 October evening invoice first belongs in a read whose completed period includes 15 October, ordinarily the following day. Monthly aggregate changes do not by themselves demonstrate true weekly profit allocation.

**New-Profit:** the review page currently renders fixed, explicitly labelled synthetic sample data. Provider writes do not automatically replace its fixture or move those graphs. Real feed-backed dashboard wiring needs supported calculation contracts, coverage/freshness/error states and source labels. For visible dynamic testing, show provider test activity separately from financial KPIs; if a changing financial UI is needed before that wiring, use an explicitly synthetic preview dataset isolated from merchant reporting. That is a separate UI/data package, not a hidden consequence of activating writers.

Daily generation for four dates validates a short source/read cycle. Dependable customer integration still requires scheduled unattended refresh evidence across multiple days, durable token lifecycle, failed-run recovery and freshness presentation. No fixed future timing is guaranteed until the actual prerequisites are inspected.
