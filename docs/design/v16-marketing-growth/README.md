# Marketing growth review — 20 November 2026

Paul approved a temporary duplicate so the prior Marketing design remains reviewable. Marketing Efficiency stays at /marketing-efficiency; New Marketing is /new-marketing. The prior implementation changes only its visible New prefix. The new page has Acquisition, Conversion and Retention tabs within one destination; this is not a permanent expansion of the core navigation.

## Page contract
Each tab retains shared context, one plain-English verdict and primary next step, four headline measures, a visual explanation, practical action and accessible Explore the Numbers. Numbered blue sections match the established pages. Detail is progressively disclosed. Evidence remains accessible on Free; planning entitlement is checked independently. Green/red comparative text includes direction; yellow explicitly identifies unavailable or fictional evidence.

This implements the current refinement of v11 shared contract SH01–05, DT03/04, UN01/02 and Growth GM01/04/05/08. The approved three tabs supersede the earlier mockup tab names; v11 mockups 05–08 remain references, not overwritten specifications.

Acquisition keeps CAC, POAS, ROAS and contribution with business overhead coverage and optional selected-period EBITDA goal. Its CAC or POAS trend uses one selected unit at a time. Conversion shows sessions, purchase conversion, approved product AOV and checkout completion, with an all-session funnel and optional trend. Retention compares new/repeat net product spending, with separate mature-cohort evidence below. A rising repeat share is not automatically improving retention.

## Sources and definitions
Reviewed mode uses only the existing authenticated read-only monthly financial history. Supported totals remain visible; customer identities, acquisition counts, sessions, funnel events, retention and cohorts remain unavailable. No new endpoint, schema, provider permission, scheduled feed or test write is introduced. Complete reviewed monthly versions are selected explicitly; unsupported weekly or multimonth allocations are not invented.

Fictional design is an explicit user choice, never a fallback. It uses the existing daily financial fixture plus declared v16 synthetic behaviour observations, 3/6/12 historical months, last-year/previous-three-month-average/None comparisons, and summed numerator/denominator ratios. Explore the Numbers explains every constructed behaviour allocation. None removes comparative series and verdicts.

Product AOV is original product sales after discounts before later refunds, excluding shipping/VAT, divided by eligible original orders. Purchasing sessions are not orders; repeat orders are not unique returning customers. Per-order values use their own eligible original-order denominators. The separate Apr–Jun mature cohort has its own observation window and is never substituted for the selected trading-period customers. Business break-even limits hold other model quantities fixed and are not marginal CAC ceilings. EBITDA is not cash; Plan is a separate illustrative model and receives no implicit live values.

## Remaining acceptance
Audit full first-order history, identity/guest and cancellation/test policies, acquisition-spend eligibility, original-order-linked refunds, session funnel coverage and cohort maturity before wiring real customer measures. Second purchase, unique returning customers, frequency and acquisition-to-future-repeat forecasts remain pending; the latter remains parked as agreed.

## Validation
Frontend TypeScript passed. Seven new growth model tests plus four existing linked Marketing tests passed: reconciliation, aggregate ratios, approved AOV, distinct session/order denominators, comparisons, zero/missing evidence, cohort maturity and tab validation. Desktop and 390px review checked explicit source selection, context persistence, comparison None and no mobile page overflow. Hosted build and final live smoke check are performed at publication.


## Customer drivers and conversion trends — 20 November refinement

Retention now leads with three aligned monthly charts: distinct purchasing customers, eligible orders and approved product AOV. The group selector supports Returning, New (first orders) and All. An equation shows customers × orders/customer × AOV = original product sales before later refunds; net spending stays separately disclosed. Counts stay absolute under Per order; AOV uses the selected group’s orders. Whole-period identities are deduplicated rather than summed from monthly points. The explicit fictional identity model assigns repeat orders to a pool of 5,000 pre-existing customers with deterministic IDs; first-order identities remain separate. This fixture does not model a new customer's future repeat path. Rolling comparison points use average monthly distinct customer counts; scaled whole-window values are labelled reference equivalents, not distinct people. This supersedes the earlier sample-frequency limitation, while live customer identities remain unavailable.

Conversion now leads with visible aligned Website sessions and Purchase conversion charts, each with its own scale, solid selected and dotted comparison paths. The funnel and optional AOV detail are progressively disclosed. Both respect the historical period and comparison selector, including None. The same exact data tables remain available. The new charts are sample-only until matched customer/session evidence is accepted; no provider or database changes are included.

Validation: nine growth tests include distinct-window counts, group reconciliation and rolling customer reference semantics; existing four linked Marketing tests continue to pass. TypeScript and hosted build are checked at release.
