# Marketing decision redesign — 19 November 2026

Paul approved the POAS-led Marketing Efficiency redesign in the 19 November review. This scoped revision supersedes the legacy Marketing Efficiency sample reallocation layout; v11 remains an unchanged historical baseline. The separate v11 workspace is not replaced by this package.

## Delivered interface

The existing authenticated /marketing-efficiency route now opens with an honest Needs evidence state and a deliberate fictional-design review button. The review contains Scale, Hold, Pull back and repeat-purchase example choices; CAC versus first-order contribution; POAS and ROAS with target/break-even context; contribution after ads; six-week trends with accessible value tables; a first-order bridge; collapsed mature-cohort/composition and channel evidence; a conditional incremental-ad-budget model; and Explore the Numbers available on Free and Pro. Pro gates the test plan and editable scenario, never source definitions.

Historical source period and verified sales remain independently available in source coverage. Sample values never inherit the store's period or substitute for missing evidence. Changing store remounts sample state. No actual marketing adapter is implemented and no real recommendation is inferred from sales alone.

## Financial contract

POAS uses contribution before advertising divided by matched advertising. Gross profit, net shipping and variable operating costs follow agreed-financial-definitions.md. Advertising is deducted once; agency, tools and salaries remain overheads. CAC uses eligible acquisition spend / first-time customers. CPA uses all matched orders and remains distinct. First-order contribution and CAC share a customer scope. Blended revenue/spend is labelled distinctly from platform attribution in evidence. Targets, headroom and marginal-CAC bounds are disclosed example assumptions.

Ratios derive from matched totals, not averages of weekly ratios. The separate channel and mature-cohort illustrations do not claim to reconcile to the six-week store fixture. Mature contribution/CAC and observed payback are not forecasts for current cohorts. Cash capacity requires dated commitments, reserves and stock checks. The incremental model reports a contribution range, not cash payback or a statistical confidence interval. It allows loss outcomes and refuses invalid inputs.

## Requirement coverage and verification

GM01–GM03: investment decision, explicit evidence refusal, bounded example review and financial guardrails. GM04–GM05: first-order gap and separately dated mature-cohort evidence. GM06–GM08: matched channel diagnostics, no automatic reallocation, no incrementality claim. SH01–SH05: progressive disclosure, persistent evidence, transparent sample scope, accessible labelled controls and values. This implements the newly approved focused marketing flow; it does not claim all v11 marketing subviews or data adapters are shipped.

Five focused behavioral test groups pass, including invalid/missing amounts, funding/capacity gates, positive contribution below target, advertising losses, repeat-purchase evidence and marginal-spend arithmetic. Frontend TypeScript check passes. Isolated browser bundle succeeds and all four example decisions, plan disclosure, invalid inputs and reset controls were exercised locally. Responsive checks at 390 and 1440 pixels showed no document overflow. Local Vite production build is blocked by the signed desktop Node runtime's inability to load the installed Rollup native binary; do not report it as passing. Hosted staging build/visual acceptance must be checked separately.

## Integration boundaries

Only the marketing page, its focused tests and this new design handover are included. No auth, navigation, provider scopes, store permissions, database, reader/writer schedule, advertising account or production branch change. Preserve concurrent roadmap changes. Paul explicitly approved uploading this redesign, tests and documentation to PaulLantsbury/virtual-cfo, codex/restart-baseline, after the initial automatic approval rejection. Publication uses an expected-head guard; hosted build and visual acceptance remain separate checks.

Next data work: source-matched ad spend, new-customer identity, historical product/variable costs, attribution reconciliation, mature cohorts and business guardrails. These gates are separate from approval of the redesign.

## Hosted acceptance — 19 November 2026

The existing staging web service was manually deployed at 767bee721badcc1640e8f4be64d90a688ba57ca7; Render reported Deploy succeeded in 1m 14s. This integration commit preserves the previously deployed c7e6921 reporting/history tree and adds only the marketing page, focused tests and this design document. The development branch had been behind deployed history; both histories were retained in a non-forced integration commit before deployment. Automatic web deployments were not enabled or otherwise changed.

The signed-in staging /marketing-efficiency page was reloaded and verified: new purpose/evidence state, explicit review opening, Hold fixture, live switching to Scale, matching CAC/POAS/ROAS/contribution values and recalculated marginal-spend inputs/results. Desktop layout visually checked in the actual app shell. Actual store recommendations remain unavailable pending their separate data gates. No database, provider, credential or scheduler changes were performed by this redesign delivery.
