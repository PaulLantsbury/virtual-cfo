# Cash resilience and fixed trend context

Cash and Profit Engine trend charts now retain twelve complete weeks or twelve complete calendar months independently of headline selection. Headline KPIs, selected-period bridges and recommendations keep their selected dates. Trend averages, comparator summaries, date captions and accessible tables match the displayed window. Profit discount/refund rate charts use the same fixed history.

Negative cash is described as cash used; a negative profit is a loss. This avoids ambiguous dash formatting in the CFO sentence. The profit-to-cash bridge, prioritised reviews and standard action tracker remain.

The cash forecast and future-payment entry UI were removed from this design. Previous committed implementation and arithmetic modules remain recoverable. A smaller Cash resilience block retains editable buffer, current headroom, and average movement over three complete months including trading, tax, investment and other bank movements, excluding all financing (also debt repayments). Negative historical movement may show historical cash cover with explicit past-rate assumptions; positive/flat/missing history never becomes infinite runway or a dated reassurance. One-off investment is not silently forecast to recur. Future stock, tax and debt payments remain unknown.

No connected cash reporting or forecast accuracy claim. Figures remain synthetic. Reminder baseline explicitly has unavailable forecast values and date-only as-of. Independent review caught and fixed a 26-versus-12-point chart summary mismatch and timestamp-versus-date reminder regression; targeted checks include these cases. TypeScript and demo build checked; browser layout QA unavailable. Main app/read collectors remain read-only and writer activation unchanged.
