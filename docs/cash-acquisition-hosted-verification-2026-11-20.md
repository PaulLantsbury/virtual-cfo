# Cash and New Marketing — hosted verification, 20 November 2026

## Applied and verified

Owner approved the [exact package](https://github.com/PaulLantsbury/virtual-cfo/blob/dbead3dc6940647a417b4634a0ca9ad3ea147315/docs/cash-acquisition-staging-approval-2026-11-20.md). Source `b7ea4913c928ac9dac57bc45b5478ca06688a016` is live on existing Night Scout staging; deployment completed **18:19:11 UTC**.

- Exact private supplemental schema installed successfully.
- Exact plan `05e6ace2953f8857a064aa7cd58eae5c4c3ec4f87b6b3fe763c5dd62e43c0348` published in one guarded transaction on its first attempt.
- Readback: **48 active synthetic summaries**, 24 cash + 24 acquisition, covering November 2024–October 2026. None invalidated; all financial versions match the existing sealed baseline.
- Exact guarded grant passed: existing restricted reporting role has schema usage and SELECT; no source writes. Browser/default roles have no schema/table access.
- Optional supplemental reporting flag enabled only for existing staging website. Configured repository branch and automatic-deploy-off setting preserved.
- Website health returned HTTP200; anonymous supplemental endpoint returned HTTP401.

The environment-variable connector unexpectedly starts a branch-tip deployment even with auto-deploy off. That documentation-only branch-tip build was **cancelled before release**. Then the explicitly approved exact source was selected in the dashboard and deployed. Do not use this connector for a future save-only configuration change without accounting for its deploy side effect.

## Signed-in browser acceptance

Selected isolated fictional UK Gifts company, October 2026, original reviewed evidence. Checked actual website hooks/server/Supabase reads, not the local mocked preview.

| Page | Observed result |
| --- | --- |
| New Marketing Acquisition | Paid first-customer CAC £2.05; allocated first-order before-overhead benchmark £15.16; POAS9.71×; ROAS25.00×; contribution after ads £23,515; overheads £12,923. |
| New Marketing Conversion | 52,657 simulated sessions; 3.00% purchasing-session conversion; product AOV £38.01; checkout completion43.57%. Explicit synthetic analytics label retained. |
| New Marketing Retention | 948 identified first orders;686 repeat orders;£24,680 rounded repeat net product revenue. First/repeat/guest/unknown revenue table totals £64,800. |
| Mature cohort detail | Separate Apr–Jun paid cohort, observed through September:1,037 customers,£2.00 matched CAC,9.67×90-day product GP:CAC,£13.17 contribution/customer after acquisition, Day0 first-order-day contribution recovery. All six source dependencies are enforced by the reader. |
| New Cash Control | October closing bank £301,632.59; operating cash −£22,290.26; cash less EBITDA −£32,882.31; unsettled provider funds £9,205.05 shown separately. |
| Cash reconciliation | EBITDA £10,592.05 plus five working-capital effects equals operating cash; opening bank £323,922.85 plus cash movement equals closing bank. |
| Cash history/resilience | Twelve financial months loaded; three separate continuous cash months checked. EBITDA/operating cash and bank balance use separate charts. £50,000 user buffer gives £251,632.59 above buffer; three-month before-funding cash movement averages £7,973.29. |
| Preserved Profit Engine | October sales £64,800 and EBITDA £10,592 displayed from existing reviewed financial source. |
| Preserved Plan | Latest combined Plan/My Actions design intact, explicitly fictional what-if review; no live forecast or durable action claim introduced. |

Explore the Numbers opened on Marketing, with version/source definitions and linked acquisition coverage. Mature cohort detail opened and exact table checked. Cash displayed the signed reconciliation and source-status table.

Date change withdrew October cash figures immediately, cleared evidence selection and reset buffer to zero. Switching to Store D displayed unavailable cash rather than borrowing the synthetic company’s summaries; returned to the isolated company. New Marketing kept selected context while switching its three tabs. No browser console errors observed in Marketing. No live records were invalidated or altered merely to test stale-data handling; those destructive/withdrawal cases remain covered by local tests.

Observed supplemental requests completed HTTP200 in approximately1.1–8.8seconds. The first acquisition read checks six older financial dependencies; the Cash financial-history chain takes additional time. This is observed interactive timing, not a load/performance acceptance. One request was aborted during deliberate navigation; it was not a failed publication.

## Remaining work and day-end boundary

- Initial historical supplemental publication is complete. Existing daily **financial** feed is unchanged. It does not automatically publish these new cash/customer summaries: design and review a closed-month supplemental refresh, correction/replacement/invalidation handling and future cohort observation windows.
- Unique returning-customer counts, purchase frequency, second-purchase timing, multi-month CAC/session comparisons and customer/order drilldowns still need their own supported inputs. Yellow/unavailable states stay explicit.
- Historical synthetic bank amounts are not a current bank/accounting connection, forecasting service or provider acceptance. Shopify/Xero/Meta checks stay separate.
- Scout’s View is the next core design review. Profit, Cash, Marketing’s three tabs and Plan already have reviewed designs; do not restart them. Then final menu/naming, cross-page owner journey, Monitoring/Settings.
- Plan verified-baseline connection, shared action persistence and delivered reminders remain separate work.
- Improve loading/visibility-change behaviour and benchmark the bounded readers; minor Cash card minus-sign wrapping is cosmetic polish.
- Genuine overnight daily financial-run acceptance still requires reviewing actual scheduled evidence; no manual run or provider retry was performed.
- Full API typecheck retains17 pre-existing Xero declaration errors. Targeted changed checks and builds passed.

**Stop here for the day, as requested.** No further batch, provider action, feed change or additional spending is authorised by this closeout.
