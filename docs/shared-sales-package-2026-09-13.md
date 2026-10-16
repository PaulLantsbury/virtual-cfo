# Shared sales reporting — approved implementation package

Paul approved the 13 September inventory proposal and three-agent implementation: common sales data/period handling for CFO Briefing, Verified Sales and Margin Analysis, page integration and reconciliation testing. Coordinator owns integration/staging/documentation/publication. Status: implemented and verified in the existing local staging preview.

## Scope

Reuse the existing evidence-aware `verified_sales_source` and agreed sales calculation path with member access, store currency/timezone and explicit common date scope. Remove Verified Sales hardcoded August selection and Margin legacy order-only lookback/broad RPC bundle. Maintain source/sample separation in Margin and retain incomplete profit status. No DB/schema/data/grant changes or financial definition revisions. Other legacy pages and test-only scenario inputs remain later migrations, not certified by this package.

Selections must survive navigation among the three pages, with strict calendar checks, no implicit prior-order fallback or guessed currency. Loading/errors/incomplete evidence must not become zeros or fixtures. Valid empty coverage and refund-only negative periods are legitimate outcomes. Current/prior readiness is independent. Existing completed week/month comparison rules remain; arbitrary custom-range comparison must not silently invent a new policy.

## Acceptance

Cross-page values agree for identical store, dates and currency; gross product sales, net product sales and original pre-refund AOV have distinct labels. Test completed period selection, valid/invalid custom dates if retained, stale store/date response isolation, current/prior errors, currency/timezone, zero vs incomplete and refund-only cases. Do not reimport data or restore staging coverage to demonstrate a successful read. Verify source scope and unavailable state in current local staging using existing access, and record precise limits. Tests use isolated synthetic evidence; no fixture amounts in actual reads.

## Implementation and validation

- `useSalesReporting.ts` owns scoped settings/reads, per-store session period selection and stale-response exclusion. `SalesReportingPeriod.tsx` supplies consistent controls. `useVerifiedBriefing.ts` preserves the existing briefing interface. No sales formula changes.
- All three page consumers migrated. Margin source labels now distinguish net product sales and original AOV; sample controls remain separate. The briefing header reflects the selected period. Invalid saved dates withhold financial reads. Custom comparison remains explicitly unavailable pending policy.
- Typecheck and production build pass. Existing tooltip sourcemap and bundle-size warnings remain.
- Ten focused store/date/briefing tests pass. Eighteen browser tests pass: 14 shared-sales cases and four retained Margin regressions across desktop/mobile and free/pro gates. They prove matching amounts, custom selection persistence, timezone boundary handling, refund-only negative sales, valid zero, missing evidence/settings, current figures with unavailable prior period, corrupted dates and delayed store/date response isolation.
- Initial browser attempts used a production build where the intentionally development-only Verified Sales route is absent; those route timeouts were test setup failures. Rerun used an isolated Vite development server with fake Supabase configuration and blocked/mocked external services. A two-store fixture was corrected to select a store before expecting the active-store selector. Final full run: 18/18. No assertions were weakened or production route exposed.

## Local staging evidence

13 September walkthrough at localhost:3000 used existing authenticated access and staging store A. August 1–31, Europe/London, GBP showed one qualifying original order and matching net product sales / original AOV of £123.00 across Verified Sales, CFO Briefing and Margin. Gross product sales also matched £123.00 where presented. Briefing retained valid current figures with previous-period comparison unavailable; Margin retained unavailable actual profit/cost reporting.

Changing to last complete week carried August 31–September 6 between Briefing and Margin. Both withheld figures for missing/incomplete evidence and did not reuse August's money. Month selection was restored for review. No source data, coverage, memberships or grants were changed.

CUA native date fill changed DOM fields without delivering the React state update in this walkthrough; normal Playwright input in the isolated browser tests did update the dates, request scopes and all three pages. The staging custom-date path is therefore not claimed as manually verified. Week/month staging scope and custom-date isolated regression are separately evidenced.

## Remaining scope

This is the first shared actual-sales slice, not completion of all-site reconciliation. Other legacy readers and sample/hardcoded models remain documented in the source map. Historic COGS, inventory recovery, costs, expenses and marketing completeness must be designed and connected before actual contribution/profit. Shopify development setup and ingestion remain future work. No Replit synchronisation, main merge, production deployment or database migration occurred.
