# Night Scout — 31 October 2026 development handover

## Current direction

Paul requested a coordinated, substantial parallel implementation of approved v11, within a one-hour session. Work proceeds alongside the separate integration-acceptance workstream. Read [the approved design baseline](design/v11/README.md), [implementation ownership and assessment](v11-implementation-2026-10-31.md), and [independent verification](v11-independent-verification-2026-10-31.md).

The base was the latest development branch at `f599883`. A separate worktree preserves prior recovery and design-publication work. No main merge, production release, database migration, grant, provider transaction or new hosting is included.

## Operational position, as recorded at 30 October close-out

The isolated Demo reader passed its current preflight, scope/mapping and saved-evidence checks. The separate Xero writer consent completed against the same genuine GBP Demo Company and approved fictional selections. Its encrypted credential was checked on the generator without a provider call; the temporary credential claim was rolled back. The bounded programme and daily schedule were enabled after the missed 30 October action window closed. Temporary reader reconnect and writer consent entry points were then closed.

This is not verification of a scheduled invoice or its ingestion. Resume actual run verification in the separately authorised operational workflow: Shopify's 30 October 18:00 action and 31 October 02:00 reader; Xero's 31 October 02:00 reader, first potential writer action 31 October 18:00, and matching reader 1 November 02:00. All times London/GMT. Preserve caps, stop dates and no-catch-up policy. Do not repeat credentials, consent, migration or activation setup merely because older public notes say prepared/disabled. Private identifiers and receipts stay private.

## Batch 1 implementation

The opt-in v11 workspace contains the seven agreed destinations, required sub-tabs, progressive diagnostics, labelled fictional examples and a shared calculation/evidence layer. It does not replace missing merchant data with sample values. Current merchant routes and store access controls remain available.

- Historical financial definitions, own-period per-order values, full-precision fixtures, bridges, break-even and staff diagnostics are centralised.
- Date presets, custom/comparison ranges, London calendar boundaries, overlap refusal, leap policy and None are shared. Only the fixed Q3 sample has fixture values; another selected period correctly becomes unavailable.
- Scenario methods are mutually exclusive, preserve common inputs, and expose active assumptions/results without saving or executing anything.
- Monitoring and Accepted Actions show conditional fictional workflow states. Secured persistence, notifications, invitations, export/disconnect and billing remain unavailable.
- A pure adapter maps existing supported sales/profit evidence, including overheads with D&A into the v11 excluding-D&A basis. It rejects scope/access/coverage conflicts and preserves independently supported subtotals. It is not live-wired: the existing hooks still need verified snapshot date/version metadata.

The bounded second batch also completed the supported overhead, acquisition/cohort/composition and inventory visuals, retaining closed defaults and accessible values. The complete local regression passed 131 tests (54 new independent v11 tests plus 77 existing safeguards), with frontend typecheck/build and scoped desktop/mobile browser verification. See the implementation record for per-requirement coverage and final verification receipts. Earlier prepared-only design statements describe their historical point in time.

## Review locally

With the committed dependencies installed, run `pnpm review:v11`, then open `http://127.0.0.1:4311/design/v11/scout`. The development-only entry loads no authentication SDK and requests no merchant data. The same explicitly fictional workspace is available behind existing store authentication at `/v11/scout`; it is not the default merchant reporting route.

Use navigation for all seven pages; review sub-tabs and disclosures. The state selectors inspect examples without checking or changing real services. The development-only review entry is excluded from production. Existing bookmarked reporting aliases remain intact.

## Status and next batch

Implemented and locally verified work must remain distinct from hosted staging and deployment. No hosted rollout or live-source financial acceptance is claimed here. Human ten-second comprehension testing with representative owners remains outstanding.

Next: complete genuine scheduled reader/writer acceptance, supply verified source snapshot metadata, then wire supported v11 merchant results behind the existing access/evidence gates. Preserve separate Shopify operational and Xero accounting bases. Complete remaining interface differences from the acceptance matrix. Only then prepare secured versioned scenario/action/guardrail persistence and real monitoring under their separate service/database approvals.

No numeric materiality tolerance is invented. The interface can show exact margin movement while retaining neutral interpretation until a versioned tolerance is supplied. Monthly per-order trends remain unavailable because the approved fixture does not contain monthly order counts.
