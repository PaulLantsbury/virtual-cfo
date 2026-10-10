# Dashboard and decision specification — 17 September 2026

Status: Package 1 planning specification, following Paul's approval of the revised ecommerce CFO direction and documentation package. Existing approved financial rules remain authoritative. This document does not approve new calculations, renames, integrations, grants or releases. It records code inspection and the 13 September end-of-day evidence; no fresh database or browser verification was performed for this specification.

Night Scout helps an owner understand profit, cash and financially sustainable growth and choose supported next actions. It is not the separate Sam assistant, an advertising attribution platform, or an audience activation tool. Keep the existing dashboards and useful navigation; implement complete evidence-backed journeys rather than replace the application wholesale.

## Current truth and naming

The [13 September end-of-day checkpoint](session-handover-2026-09-13.md) supersedes early entries in that day's inventory: actual shared sales and monthly profit reporting are already implemented in CFO Briefing, Profit Overview and Margin Analysis. Their synthetic staging verification does not establish real merchant source completeness. Do not rebuild that foundation or mark the remaining sample pages complete.

The current names below come from the approved [site naming record](page-naming.md). **CFO Overview**, **Profit & EBITDA**, **Customer Economics**, and **Forecast & Scenarios** are proposed information-architecture labels from the new direction, not names silently applied by this document. CFO Briefing, Profit Overview and Scenario Planner remain the current names. Customer Economics has no dedicated route: decide whether it is a Growth Quality section or a separate destination before implementing navigation. Cash Control remains prominent regardless of the naming decision.

## One result contract across pages

Every actual result must be read from the shared, member-scoped reporting path, using the same store, currency, store-local period, definition and evidence version. Supabase is the common evidence store; simply moving page constants into database tables would not satisfy this requirement. Existing `useSalesReporting`, `useProfitReporting`, the sales adapter and monthly profit service are the foundation. New connectors feed that path; pages must not invent parallel Shopify/Xero calculations.

A result carries amount/unit, period, source/evidence reference, calculation definition, completeness and availability. Preserve valid zero and negative amounts. Unknown inputs are unavailable, not zero. Preserve supported earlier profit subtotals when later inputs are missing. Distinguish source availability, source validity, completeness and a human review: passing arithmetic is not a financial approval. Unsupported comparisons and nonpositive percentage denominators must not be presented as meaningful growth rates.

Actual reporting must not contain hardcoded business amounts, example trends, scores, confidence percentages or generated advice that reads as merchant evidence. Separately labelled sample models may remain during migration, but must not feed headline actuals, actual decision cards, recommendation rankings or monitoring. The end state replaces sample business outputs with evidence or an explicit unavailable state. This restriction does not prohibit constants that define units, formatting or an approved calculation.

## Existing page inventory and target roles

Paths below are existing application routes. Implementation references are under `artifacts/virtual-cfo/src/pages/`; aliases are recorded to avoid duplicate work.

| Page and route | Management question | Current implementation | Target shared measures and source dependencies | Page acceptance |
| --- | --- | --- | --- | --- |
| CFO Briefing `/dashboard` (`dashboard.tsx`; `/dashboard/transactions` currently aliases it) | What needs my attention and why does it matter financially? | Evidence-based sales plus shared supported profit summary; cash/recovery unsupported. | Shared sales, original AOV, discounts, GP, contribution, operating profit and EBITDA; later supported comparisons, accounting/cash and decision cards. Shopify transactions plus evidenced costs/expenses; cash independently sourced. | Same scoped figures as Profit Overview/Margin; each card links to supporting page/evidence; no inferred cause or forecast from a movement alone; incomplete cash never suppresses supported profit. |
| Profit Overview `/profit-engine` (`profit-engine.tsx`) | Where did sales turn into profit, and what explains the result? | Actual full-month, unique sealed-version profit reporting with supported subtotal availability; duplicate simulator removed. | Approved sales-to-GP-to-contribution-to-OP-to-EBITDA bridge. Historical costs, dated stock recovery, actual expenses; Xero classification/reconciliation later. | Signed bridge reconciles to shared totals including refund-only and stock-recovery months; missing later expenses preserve earlier totals; no what-if controls duplicating Scenario Planner. Profit Sankey only after accounting reconciliation; change waterfall later. |
| Margin Analysis `/margin-analysis` (`margin-analysis.tsx`) | Which costs and trading changes are eroding contribution? | Shared verified sales and profit summaries; deeper drivers, recovery plans and simulator remain sample content. | Same profit subtotals/margins; supported product/category cost and discount breakdowns only when source grain permits. Shipping, historic COGS, actual variable costs and ads; allocation policy required for finer-grain margins. | Overview amounts match exactly; component detail sums to total or discloses unallocated residual; no channel/product margin derived through invented allocation. |
| Growth Quality `/growth-quality` (`growth-quality.tsx`) | Is growth creating contribution and durable customers? | Legacy period/source ratios are labelled unverified; scores, trends and actions are separate samples. | Shared sales, value-based discounts and contribution first; then evidenced new/repeat customer cohorts, retention and customer contribution. Needs approved customer identity/eligibility/cohort rules and sufficient history. | Stop legacy order-only period fallback; preserve refund-only periods; no sample growth score promoted to actual. Cohort outcomes reconcile within explicitly stated cohort/event scopes. |
| Marketing Efficiency `/marketing-efficiency` (`marketing-efficiency.tsx`) | Is acquisition spend affordable, and what can we responsibly change? | Unverified channel/blended snapshots and separate fixed sample channel model/budget shifts. | Actual period ad spend and shared before/after-marketing contribution; later defined blended CAC/payback and channel views. Meta first then Google Ads, customer identity and agreed attribution/coverage rules. | Spend reconciles with profit expense input exactly once; channel claims have explicit scope/window; ROAS does not masquerade as profit or incrementality; no predicted shift benefit without agreed response assumptions. Existing 30% combined sample shift cap is not a real-world rule. |
| Pricing & Discounts `/pricing-optimisation` (`pricing-optimisation.tsx`) | What do discounts cost, and what price decisions merit investigation? | Unverified legacy discount value ratio; deeper KPIs and simulator are samples. | Shared gross product sales, product discounts, net product sales and value-based discount rate; supported cost/contribution by product only with sufficient evidence. Shopify line prices, discounts, refunds and historical costs. | Discount rate matches the shared ledger; shipping discounts/VAT remain separate; discount value is not a percentage of orders using a code. No demand elasticity or profit-recovery promise inferred from observed discount spend. |
| Cash Control `/cash-control` (`cash-control.tsx`) | How much usable cash do we have, what will consume it, and when? | Fixed illustrative balance/runway/bridge/scenarios; legacy sales loader supplies context only, no actual cash feed. | Dated unrestricted bank/payment balances, processor funds separately, actual movements excluding internal transfers; approved actual-burn runway; later 13-week forecast. Xero/bank/payment coverage and explicit working-capital obligations. | Do not substitute sales, EBITDA or overheads for cash/burn; account/date/currency coverage visible; missing balances remain unavailable; forecast assumptions/version clearly separate from actuals. Cash stays a product priority while dependencies are delivered. |
| Opportunity Finder `/profit-opportunities` (`opportunities.tsx`; alias `/opportunities`) | What should we investigate or do next, and what benefit is supported? | Fixed sample actions/ranking; old actual opportunities endpoint disabled. | Evidence-backed decision cards referencing reporting snapshots; subsequently agreed prioritisation, impact ranges, effort, confidence and action outcomes. | No sample scores/weights adopted; distinguish recurring contribution, recurring profit and one-off cash; avoid overlapping benefit double counts; evidence and human action state distinct. |
| Scenario Planner `/scenario-lab` (`scenario-lab.tsx`) | What would happen under my stated assumptions versus the current position? | Corrected coherent sample-month arithmetic; visible sales/contribution/OP deltas; no actual reporting baseline or saved scenarios. | Versioned shared complete baseline plus explicit user assumptions; sales from order volume and AOV; approved cost/profit arithmetic. Forecasts/budgets and cash response require separate assumptions. | Zero changes reproduce baseline; deltas equal scenario minus baseline; controls update headlines immediately; baseline never overwritten; unavailable effects withheld; no separate overlapping sales slider. Do not imply a scenario is a forecast or its save state is persistent before implementation. |
| Monitoring `/monitoring` (`cfo-alerts.tsx`; alias `/cfo-alerts`) | Has an agreed financial guardrail been breached, and did our action help? | Prototype settings/history held locally; no scheduled checks or delivered alerts. | Shared report snapshots, agreed thresholds/windows, durable action states, scheduled evaluation and delivery. | Do not show fictional checks as completed; missing data produces a data issue, not a financial breach; deduplicate sends and evidence-link alerts; rules/channel consent agreed before activation. |

## Supporting pages and entry points

| Route | Purpose, current boundary and acceptance |
| --- | --- |
| `/financial-review` (`financial-review.tsx`) | Existing member/reviewer-scoped evidence review. Preserve transaction provenance, period completeness, audit trail and distinction between accessible evidence and reviewed figures. A CFO summary must not silently mark evidence reviewed. |
| `/verified-sales` (`verified-sales.tsx`) | Development-only diagnostic route in `App.tsx`, sharing sales reporting. Keep it aligned for acceptance and provenance checks; it is not a promised production dashboard. |
| `/settings` (`settings.tsx`) | Static company-profile example (Acme Corp) with navigation/buttons and no implemented persistence in this component. Future connector/account/coverage configuration must show actual connection and last-sync/error state only when backed by the implemented service. Presence of the screen does not certify Shopify/Xero/advertising integration or persistence. |
| `/upgrade` (`upgrade.tsx`) | Existing plan preview. Copy must distinguish implemented entitlement from sample/prototype access; payment or upgrade must never claim to activate unavailable validated analysis. Commercial packaging is a separate product decision. |
| `/`, `/login`, `/signup` (`landing.tsx`, `login.tsx`, `signup.tsx`) | Public explanation and authentication. Preserve existing signup/email-confirmation and membership boundaries. Explain ecommerce CFO outcome without claiming unfinished feeds, forecasts or monitoring. No navigation redesign required in Package 1. |
| Unmatched route (`not-found.tsx`) | Existing not-found handling; no financial behaviour. Retain accessible recovery navigation. |

## Standard CFO decision card

Use these seven fields consistently. This is an evidence contract, not a requirement to fill every field with persuasive prose. A field can explicitly say that evidence or an approved model is unavailable.

| Field | Required content and boundary |
| --- | --- |
| Observation | What changed or was measured, for which store, period and metric, with the comparison scope. No fabricated benchmark. |
| Driver | Supported decomposition or contributing factor. Describe correlation as correlation; causal language requires evidence. |
| Financial impact | Measured amount or explicitly modelled range, its unit and time basis; identify contribution, operating profit, EBITDA or cash. Do not add unlike/overlapping benefits. |
| Outlook | Conditional forward view only where assumptions and horizon are agreed; otherwise state that no supported forecast exists. Historical change alone is not a forecast. |
| Action | Evidence-linked investigation or proposed intervention; explicit owner/status when action tracking exists. The card does not authorise operational execution or spending. |
| Guardrail | Agreed limit and test condition, or clearly named pending decision. Never invent a safe CAC, margin, runway or budget threshold. |
| Confidence | Describe data coverage, reconciliation and model limitations. No invented probability or sample High/Medium/Low grade treated as validated confidence. |

Page specialisations: CFO Briefing summarises and routes these cards; Profit/Margin uses the reconciled bridge; Growth uses comparable cohorts; Marketing identifies spend/attribution limits; Pricing distinguishes observed discount cost from assumed response; Cash states dated balances and forecast assumptions; Opportunity Finder orders only under an agreed policy; Scenario Planner exposes user inputs; Monitoring applies approved guardrails to fresh evidence. This prevents each page inventing a separate narrative engine.

## Acceptance shared by every migrated page

1. Same store, currency, timezone, exact date range and evidence version produce the same shared metric amount and status across pages; labelled cohort and accounting comparisons may use different bases but must explain them.
2. Test a normal sale month, refund-only month, later stock recovery, missing cost, missing overhead, zero/loss, unsupported period, failed read, denied access and rapid store/date switching. Historical staging fixtures remain test inputs, not merchant benchmarks.
3. Actual metrics and narrative read the same returned snapshot. No stale previous-store copy, sample fallback, hidden current-month guess or legacy order-containing-period search.
4. Comparisons require supported comparable scopes; show both dates and availability. Dynamic words such as improving/falling agree with the figures and metric meaning.
5. Browser review covers narrow and wide layouts, readable availability messages, evidence links and current approved naming. Actual and sample sections remain distinguishable without relying only on colour.
6. Accounting reconciliation explains timing/classification differences; it must not alter trading evidence to force identical values. Profit-to-cash differences are expected and must be bridged, not concealed.
7. Record the change, focused tests, scope limits and staged revision in GitHub. Package completion is not a production release or automatic Replit synchronisation.

## Decisions needed before dependent implementation

This is a dependency register, not a request to decide everything now. The next shared-sales/discount migration can retain current names and existing financial rules. Only new comparison/observation behaviour included in the next package needs a concrete decision then; customer, cash, forecasting and ranking choices wait until their dependent work is prepared.

- Page naming and placement of Customer Economics; no existing route renamed here.
- Customer identity, new/repeat eligibility, cohort windows, refund cohort interpretation and observed versus predicted customer value/payback.
- Marketing attribution/window and CAC denominator; incremental-return and spend-response assumptions. Before-marketing contribution already exists in the approved financial definitions; it does not move agency fees, salaries or software out of overheads.
- Product/channel cost allocations where source facts cannot directly assign amounts; accounting reconciliation classifications and materiality.
- Cash account/currency coverage and exceptional burn cases; 13-week forecast assumptions including settlement, tax, stock purchases and financing timing.
- Real opportunity ranking, confidence, overlap handling and monitoring guardrails; scenario budget/forecast persistence and approval workflow.

These do not block reusing approved sales/profit data or removing legacy actual-output paths. Deliver shared sales/discount consistency and a complete Shopify development evidence journey first; prepare Xero/Cash alongside it. Growth/customer/channel analysis follows its evidence and decisions. Forecast/action workflows follow validated baselines. Build the profitability Sankey after Xero reconciliation and the explanatory change waterfall later. Refer unresolved financial choices to the consolidated decision register rather than treating this specification as an approval.

## Inspection references

Current status: [13 September handover](session-handover-2026-09-13.md), [shared profit rollout](shared-profit-pages-2026-09-13.md), [approved financial definitions](agreed-financial-definitions.md). The [initial page source map](reporting-page-source-map-2026-09-13.md) remains useful for legacy/sample dependencies, but its pre-rollout CFO/Margin/Profit descriptions are superseded.

Code inspected: `artifacts/virtual-cfo/src/App.tsx`, the page files listed above, and the approved site naming document. This inventory does not assert source feeds are operational merely because an adapter or schema exists.
