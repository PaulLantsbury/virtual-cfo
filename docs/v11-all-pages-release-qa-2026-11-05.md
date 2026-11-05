# All redesigned pages: release QA matrix

Status: current source audit against all 33 approved v11 reference states. This matrix establishes implemented route/control reachability, not pixel parity or a new hosted browser receipt. Fictional, unlinked previews satisfy the current release priority; full source connectivity is a separate workstream.

All seven destinations are implemented: Scout’s View, Profit Engine, Growth & Marketing, Cash Control, Plan, Monitoring and Settings. Growth, Plan and Settings expose their specified subtabs. The preview is inside the existing sign-in/store-access boundary. Its fixed Scout & Co fixture does not read merchant financial data; supported reporting remains a separately labelled destination.

| Ref | Approved reference | Route | How to inspect | Current audit |
| --- | --- | --- | --- | --- |
| 01 | Scout View default | `/v11/scout` | Default | Present in source; visual acceptance pending |
| 02 | Scout View expanded | `/v11/scout` | Expand diagnostics | Present in source; visual acceptance pending |
| 03 | Profit Engine default | `/v11/profit` | Default Total; toggle Per order | Present in source; visual acceptance pending |
| 04 | Profit Engine expanded | `/v11/profit` | Expand diagnostics | Present in source; visual acceptance pending |
| 05 | Investment Scorecard default | `/v11/growth?tab=investment` | Investment Scorecard | Present in source; visual acceptance pending |
| 06 | Investment Scorecard expanded | `/v11/growth?tab=investment` | Expand acquisition and coverage diagnostics | Present in source; visual acceptance pending |
| 07 | Customer Economics default | `/v11/growth?tab=customers` | Customer Economics | Present in source; visual acceptance pending |
| 08 | Customer Economics expanded | `/v11/growth?tab=customers` | Expand current-acquisition and mature-cohort diagnostics | Present in source; visual acceptance pending |
| 09 | Channels default | `/v11/growth?tab=channels` | Channels | Present in source; visual acceptance pending |
| 10 | Channels expanded | `/v11/growth?tab=channels` | Expand channel evidence and metric controls | Present in source; visual acceptance pending |
| 11 | Cash Control default | `/v11/cash` | Default | Present in source; visual acceptance pending |
| 12 | Cash Control expanded | `/v11/cash` | Expand independent cash/stock/settlement diagnostics | Present in source; visual acceptance pending |
| 13 | Plan Opportunities default | `/v11/plan?tab=opportunities` | Opportunities | Present in source; visual acceptance pending |
| 14 | Plan Opportunities expanded | `/v11/plan?tab=opportunities` | Expand opportunity evidence | Present in source; visual acceptance pending |
| 15 | Plan Order assumptions | `/v11/plan?tab=planner` | Order assumptions method | Present in source; visual acceptance pending |
| 16 | Plan Spend and CPA | `/v11/plan?tab=planner` | Spend & CPA method | Present in source; visual acceptance pending |
| 17 | Plan Traffic and conversion | `/v11/plan?tab=planner` | Traffic & conversion method | Present in source; visual acceptance pending |
| 18 | Plan Scenario planner expanded | `/v11/plan?tab=planner` | Expand assumption review/sensitivity | Present in source; visual acceptance pending |
| 19 | Accepted actions empty | `/v11/plan?tab=accepted` | Inspect fictional state: Empty | Present in source; visual acceptance pending |
| 20 | Accepted actions active | `/v11/plan?tab=accepted` | Inspect fictional state: Active | Present in source; visual acceptance pending |
| 21 | Accepted actions overdue review | `/v11/plan?tab=accepted` | Inspect fictional state: Overdue | Present in source; visual acceptance pending |
| 22 | Monitoring service unavailable | `/v11/monitoring` | Default Service unavailable | Present in source; visual acceptance pending |
| 23 | Monitoring ready to set up | `/v11/monitoring` | Inspect fictional state: Ready | Present in source; visual acceptance pending |
| 24 | Monitoring active and actionable | `/v11/monitoring` | Inspect fictional state: Actionable | Present in source; visual acceptance pending |
| 25 | Monitoring verified quiet | `/v11/monitoring` | Inspect fictional state: Quiet | Present in source; visual acceptance pending |
| 26 | Monitoring incomplete data | `/v11/monitoring` | Inspect fictional state: Incomplete | Present in source; visual acceptance pending |
| 27 | Monitoring delivery failed | `/v11/monitoring` | Inspect fictional state: Delivery failed | Present in source; visual acceptance pending |
| 28 | Settings Connections default | `/v11/settings?tab=connections` | Connections | Present in source; visual acceptance pending |
| 29 | Settings Connections expanded | `/v11/settings?tab=connections` | Expand connection/readiness evidence | Present in source; visual acceptance pending |
| 30 | Settings Business guardrails | `/v11/settings?tab=guardrails` | Business guardrails | Present in source; visual acceptance pending |
| 31 | Settings Team and access | `/v11/settings?tab=team` | Team & access | Present in source; visual acceptance pending |
| 32 | Scout View verified quiet state | `/v11/scout` | Data state: Verified quiet example | Present in source; visual acceptance pending |
| 33 | Scout View incomplete evidence state | `/v11/scout` | Data state: Incomplete cost evidence | Present in source; visual acceptance pending |

## Independent release checks

- The preview’s seven-item navigation matches the approved destinations. Entry links and the top banner identify a new fictional page preview, and the return-to-current-reporting action remains available.
- Historical defaults use a fixed sample clock and visibly label Q3 2026. Unsupported period selections withhold amounts rather than relabelling that fixture as current trading.
- Explore the Numbers is available from page header/footer in all destinations. Historical evidence retains business, period/comparison, snapshot, formula, coverage, denominator and rounding. Planner evidence follows active assumptions. Service-page evidence describes capability boundaries; detailed workflow/policy controls expose their own fictional context.
- Accepted actions, monitoring and settings explicitly distinguish examples from saved or operating services. Activation, save preferences, guardrail save and invitation controls remain disabled. Selecting an illustrative active/quiet/delivery state never activates a service.
- Existing sign-in/store membership gates cover hosted preview routes. Public development review is a fixture-only build path, not a merchant-data reader. No provider transaction, access grant or persistence operation is introduced by preview navigation.

Prior independent desktop/mobile browser receipts on 31 October cover all seven destinations, representative tabs/disclosures, evidence focus and unavailable service controls. They are historical local evidence, not current hosted acceptance. A fresh independent local-server attempt in this review was blocked by environment loopback restrictions; the current signed-in staging walkthrough belongs to the release lead. Do not infer hosted success from this matrix alone.

## Practical follow-through

Ship every fictional preview destination together once the immutable frontend build is verified. Check the real hosted entry link, all seven navigation paths and each specified subtab, with a clear fiction label on every page. Check header/footer Explore and at least one contextual disclosure per destination; keep method, unit and selected state consistent. For Monitoring/Settings, carry the selected fictional workflow/policy into top-level evidence more directly as a polish improvement; this does not require activating either service.

Full 33-image visual parity, exhaustive accessibility and the representative-owner ten-second comprehension test remain acceptance follow-ups. Do not hold clearly labelled preview availability on full Supabase wiring. Conversely, do not call sample charts live financial evidence or imply that every illustrated persistence/notification capability now operates.
