# Financial integration next step

Status: applied to Night Scout Staging on 9 September 2026 after explicit approval; populated development preview verified. Main briefing integration remains outstanding.

## Current boundary

The dashboard calls legacy RPCs through getTradingMetrics.ts. The isolated readMappedSales adapter implements event-period sales and pre-refund AOV using private finance_v1 evidence. The schema is now present in staging, with an authorised RPC used by the development-only /verified-sales preview. Passing access tests on legacy RPCs does not certify their financial definitions.

## Rules approved 9 September

Approved: original paid/completed sales count, including orders refunded later; unpaid, test and pre-sale-cancelled orders do not. Use the store timezone and actual sale/refund event timestamps, not import timestamps. Ambiguous edits, cancellations and goodwill adjustments require review. Paul confirmed these rules in this task. Source status labels alone cannot establish original payment/event history.

## Implementation sequence

1. Completed: record the user's rule decisions in agreed-financial-definitions.md. Preserve the approved tax-exclusive sales, original pre-refund AOV and event-period refund contract.
2. Prepare and test a staging-only evidence population for hand-specified synthetic sale/refund cases. Do not certify the historic legacy dataset by assumption.
3. Design the authorised read boundary for finance_v1. Do not expose the private schema or reuse an unauthenticated service-role proxy. Store membership must be enforced before accessing evidence; parameterised queries and request-supplied store IDs alone are insufficient. Keep evidence writes restricted to the controlled verification process.
4. Test and review the schema/read boundary locally, then apply the concrete reviewed change to staging. Keep the existing public financial functions unchanged during comparison.
5. Connect the briefing's sales/AOV fields to verified results with explicit unavailable/incomplete states. Keep unsupported profit/cost outputs unavailable. Refund-rate and repeat-customer rules require their own agreed definitions; do not silently inherit legacy ratios.

## Acceptance checks

- A February sale refunded in March retains its original February AOV; March records the refund reduction.
- Refund-only periods remain activity rather than being labelled empty.
- Missing/stale tax, currency, eligibility or coverage evidence produces unavailable data, not zero or a legacy fallback.
- The same reporting period and verified result drive both figures and narrative.
- Each real staging account sees only its assigned store through the new entry point, including direct requests for another store.
- No historic-cost evidence means profit remains incomplete, even when sales are verified.

This plan does not represent completed integration. Natural session expiry/refresh and additional access checks are still outstanding separately. Replit/main and the original Supabase project are unchanged.

## Local preparation completed

event-evidence.mjs now prepares event_date/original_eligible from explicit verified source facts; it never falls back to created_at/current refund status. Five regression groups pass. This helper only prepares event metadata, not tax/currency/coverage certification or database writes. Staging population and the authorised read boundary remain the next implementation steps.

## Prepared staging connection — subsequently applied below

Implemented public.verified_sales_source as a SECURITY INVOKER, member-checked single-snapshot JSON read. The private evidence tables and mapping views gain authenticated SELECT only with per-store RLS. Anonymous access and evidence writes are denied, including where permissive default table grants existed. The endpoint does not use a service-role proxy. It returns all mapped records for the permitted store to conservatively detect incomplete evidence; this is a bounded synthetic staging design, not yet a scalable production query.

The existing calculation logic now also consumes this snapshot through rpc-sales-adapter.mjs. It checks response store/date/version and coverage, and shares the same tested arithmetic as readMappedSales. A development-only /verified-sales page is inside the existing authentication/store gate. It displays verified sales, shipping and original AOV, labels refund-only periods and withholds profit. The current briefing remains on legacy calculations for comparison; this page is not a production replacement.

The atomic staging package db-migrations/staging/20260909_finance_setup.sql combines the evidence schema, member read permissions and explicit synthetic fixtures. It refuses a changed fixture or existing finance schema. It preserves the two existing sample orders, adds product-only zero-VAT refunds of A GBP 23 and B GBP 87 dated 5 September, and updates their synthetic cumulative refund fields. It records complete synthetic August/September evidence only. September's completeness applies solely to these hand-created fixtures, never to live month-to-date trading. Expected August sales/AOV: A 123, B 987. Expected September net product sales: A -23, B -87, no original orders and unavailable AOV. Store assignments and real accounts are unchanged.

Verification: nine existing cloud-adapter tests passed after sharing the calculation function; three new integration groups pass against the exact staging schema/package, covering event periods, RLS, non-members, anonymous requests, denied evidence updates, stale/missing evidence, revocation, permissive defaults and rerun refusal. Type checking and frontend build pass with existing sourcemap/chunk warnings. The live preview's missing-endpoint state shows unavailable, not zero. Remote application and populated UI verification remain pending.

Prepared package SHA-256: `bdb703c3578774c439524bcd02dd886372619a7e8ec2ff53207fa8d58630ea7d`.


## Applied and verified — 9 September 2026

After explicit user approval, applied the exact package above to Night Scout Staging only. The SQL editor copy-back matched the recorded SHA-256; Supabase returned success. This package must not be rerun against the existing finance schema.

The real signed-in Store B preview showed August gross/net product sales and original AOV of GBP 987 with one original order. September showed the GBP 87 product refund, net product sales of GBP -87, zero original orders and unavailable AOV, with a refund-only explanation. July, without verified coverage, showed unavailable rather than zero or legacy figures. Store A's GBP 23 refund is part of the applied fixture; its populated browser view was not rechecked in this checkpoint.

Real-session checks of the new endpoint confirmed an other-store request was rejected (403), an anonymous request was rejected (401), and the permitted response contained only the account's assigned store evidence. The temporary diagnostic page was removed after these checks. Earlier local tests cover the wider permission and calculation cases; natural session expiry/refresh remains unverified remotely.

These are synthetic staging results. The main briefing still uses legacy calculations; no production release, Replit sync or merge occurred. Next: connect the briefing's sales/AOV figures and related narrative to the same verified result, preserving explicit unavailable states and withholding unsupported profit/cost claims.
