# Night Scout demo — 15 October 2026

Private demo: https://night-scout-demo.quickraven4.chatgpt.site
Site project: appgprj_6ad0edd6b1748191914045905aba817d
Local publication checkout: /workspace/sites/night-scout-demo

The standalone static build uses the existing New-Profit page, calculation helpers, recommendation logic and sample plan component. A separate Vite config substitutes only the demo layout and fixed fictional identity. The normal customer build retains its real authentication provider and store gate. Demo authentication is not a flag or bypass in the customer build. Build-time checks reject customer SDK/API/provider imports. CSP blocks network connections and form submission. No provider or customer credentials are present.

Profit is implemented. Scout’s view, marketing, cash, scenarios and monitoring are visibly unavailable until their redesigns are added. Reset removes only the demo sample plan; no real storage is cleared. Fixed sample dates are 5–11 October for last week and September for last month; provider writes do not change these examples.

Build: pnpm --filter @workspace/virtual-cfo exec vite build --config vite.demo.config.ts
Export: node scripts/export-night-scout-demo.mjs /workspace/sites/night-scout-demo
Use the Sites source helper for the same project to commit/package/publish the refreshed static output. Never create another Site to update it. Main repository holds the shared source; Site source holds the static release. No duplicate page implementation.

Old margin-analysis.tsx, pricing-optimisation.tsx and profit-engine.tsx are recoverable at canonical Git commit dfbb54fe3def0d63ed6a4acd5140d3bc60f16550. They were subsequently removed from main navigation at Paul’s request. Their source files remain in Git; the revised page is now Profit Engine at /profit-engine, with /new-profit and the retired margin/pricing URLs redirecting there. This is an exact source reference, not a claim of archived rendered screenshots.

Replit cancellation: not cleared. The 15 October Shopify acceptance runbook still places its nightly job on Replit. Website and Xero worker are on Render. Migrate the Shopify reader to a dedicated replacement, verify a genuine scheduled run and disable the old job before advising cancellation.

Verification: demo and normal builds pass, frontend typecheck passes; demo build graph excludes live infrastructure. Browser visual QA is not claimed; managed preview browser skill unavailable in this session. Sites confirmed private deployment succeeded. Test-data activation remains separate and incomplete; Shopify operator sign-in awaits manual email verification after secure field entry was unavailable.
