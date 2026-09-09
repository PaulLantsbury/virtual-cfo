# Financial integration next step

Status: prepared 9 September 2026; not implemented or deployed. The user has requested continuation from staging access checks into financial integration.

## Current boundary

The dashboard calls legacy RPCs through getTradingMetrics.ts. The isolated readMappedSales adapter implements event-period sales and pre-refund AOV using private finance_v1 evidence. That schema is not present in staging and the adapter has no authorised application entry point. Passing access tests on legacy RPCs does not certify their financial definitions.

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
