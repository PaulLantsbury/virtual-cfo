# Live feeds and recurring test programme — 9 October 2026

## Verified hosted state

The existing Shopify Replit scheduled worker ran on 9 October, completed in 29.15 seconds and returned a replay for the fixed 17 September period. Its receipt explicitly reports financeImported=false, coverageCertified=false and reviewRequired=true. This is working source collection, not current dashboard financial evidence. No Run now, fake clock or reservation clearing was used.

A fresh read-only Shopify source check on 9 October succeeded: one order, all test; two refunds; zero reviewed orders; one collection page; 837ms. The existing 100-page/60-second bounds leave capacity for ten additional orders without widening limits. Test orders remain excluded from merchant revenue. The dedicated nightly-history check subsequently passed using the existing validated root CA: current intended scope 8 September–8 October, latest attempt and today claim both completed but fixed-scope, no unresolved retry and no current-scope candidate. No TLS weakening was used.

The existing Xero Render cron is parked at annual 1 January rather than daily. A non-consuming connection preflight returned reconnect_required on 9 October. No accounting scope was consumed. The previous successful refresh does not prove current connectivity or current-period figures.

## Integrated preparation

Shopify supports the already-agreed trailing 31 completed London days, computed once and consistently passed through collection, claims and intake. Fixed mode remains the default; rolling mode refuses leftover fixed-date configuration. Read-only cloud diagnostics inspect bounded metadata and source capacity without collecting or approving financial candidates.

Xero supports completed month-to-date and last-complete-month scope modes. Rolling mode refuses fixed-date variables. The first local day safely skips an empty current-month period before credential/job acquisition. Authentication is bounded and honours cancellation. Profit Overview adds a separate authenticated Xero accounting snapshot: booked revenue, processing fees, advertising and software, with exact scope and provenance. It is not full P&L, cash reporting or Shopify reconciliation. Reader installation remains a reviewed migration; the reader stays default-off. Settings wording now distinguishes saved connection/last supported snapshot from live refresh. A separate reviewed readiness-function replacement uses the latest preflight for the current credential to expose reconnect and stale evidence without new metadata fields or grants.

The default-off provider test programme uses real fixed-origin transports, development/demo target checks, bounded responses and verified TLS. Durable PostgreSQL claims protect against duplicate writes and uncertain outcomes. The starter plan is six Shopify test orders or six Xero draft invoices over two explicit weeks, Monday/Tuesday/Saturday at 18:00 London, with no catch-up. Draft invoices exercise transport, not posted P&L. A separately gated posted-demo-only mode prepares six GBP10 authorised invoices for an exact provider-verified Xero demo company, without VAT, stock, payment or email; it requires explicit activation approval and never applies to an ordinary live organisation. The earlier richer ten-order/four-refund scenario is not fully executable. No live provider write or recurring generator has been activated.

## Activation gates and next acceptance

1. Restore the existing Xero read-only connection through the application; preserve tenant, mapping and evidence history.
2. Deploy rolling Shopify worker configuration to the existing scheduled staging host, preserving the 02:00–02:15 London start guard and durable claims. Next genuine scheduled receipt must show the current scope.
3. Review/install the exact Xero member amount-reader proposal and test ACL/isolation, then enable only the staging web reader. Configure the existing Xero worker current-period mode and daily schedule only after connection and exact-scope/mapping readiness pass.
4. Review the dedicated generator ledger/access proposals and separate provider write consent. Never borrow the collector/reporting/bootstrap identity. Recurring Xero generation requires securely refreshed writer credentials.
5. Verify provider receipt → collected candidate → independently reviewed coverage → supported financial result. A collection receipt or excluded test order cannot replace this acceptance.
6. Keep the accepted synthetic dashboard baseline available; review each dashboard in detail after its own source-backed inputs work. Customer-friendly Xero mapping and fuller accounting/cash remain roadmap package 3.

The user requested a large multi-agent batch. Preparation, code and tests may be published to the approved development branch; production, new grants and unapplied schema proposals remain separate activation decisions.

## Concrete staging proposals for review

- Existing metadata correction: `db-migrations/proposals/xero-merchant-preflight-readiness-2026-10-09.sql` replaces only the existing member readiness function; no new grant or evidence mutation.
- Authenticated accounting view: `db-migrations/proposals/xero-accounting-period-reader-2026-10-09.sql` supplies the narrowly scoped member amount reader; no direct accounting-table or credential access.
- Isolated generator: `experiments/test-programme/provider-ledger-proposal.sql` followed by `provider-access-proposal.sql`, plus dedicated restricted login and disabled programme rows. Separate encrypted writer credential, no reader/reporting identity reuse. Provider consent and enabled programme rows are later explicit gates, not implied by schema installation.
- Proposed trial: 12–25 October inclusive; six mutations per provider on 12,13,17,19,20,24 October at 18:00–18:14 London, hard stop 26 October. Shopify six GBP60 nominal test orders (no real charge, excluded from revenue). Xero six GBP10 draft invoices by default, or separately approved posted-demo invoices to exercise booked revenue; no VAT/payment/email/stock. Provider must verify the exact development/demo target before every write.

These proposals are intentionally unapplied. Existing repository instructions exclude database migrations from standing publication approval. No manual SQL, account keys or secret values are required in chat.
