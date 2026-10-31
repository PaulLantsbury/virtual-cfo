import type { useSalesReporting } from '@/lib/analytics/useSalesReporting';

/** Presentation only: all business amounts come from the shared evidence adapter. */
export function VerifiedSalesSummary({ reporting }: { reporting: ReturnType<typeof useSalesReporting> }) {
  const { data, config, status } = reporting;
  const money = (amount: number | null | undefined) => amount == null || !config
    ? 'Unavailable'
    : new Intl.NumberFormat('en-GB', { style: 'currency', currency: config.currency }).format(amount / 100);
  const amounts = [
    ['Net product sales', data?.netProductSales],
    ['Original average order value', data?.aov.value],
    ['Gross product sales', data?.grossProductSales],
    ['Product discounts', data?.discounts],
  ] as const;
  return <section aria-label="Verified sales figures" className="rounded-xl border border-border bg-card p-5 mb-6">
    <h2 className="font-semibold">Verified sales figures</h2>
    <p role="status" className="text-sm text-muted-foreground mt-2">{status === 'loading'
      ? 'Loading verified sales evidence…'
      : data ? 'Verified sales figures for the selected period.'
      : 'Verified figures unavailable — evidence is missing, incomplete or unavailable.'}</p>
    <p className="text-sm text-muted-foreground mt-2">Sales and discounts exclude VAT and shipping. Original average order value is after discounts and before later refunds. No older period or sample amount is substituted.</p>
    {data && <p className="text-sm mt-2">{data.hasRefundActivity && data.originalOrders === 0
      ? 'This period contains refunds from earlier sales, with no new qualifying orders.'
      : data.hasActivity ? `${data.originalOrders} qualifying original orders in this period.`
      : 'Verified coverage shows no sales or refunds in this period.'}</p>}
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">{amounts.map(([label, value]) =>
      <div key={label} role="group" aria-label={label}><dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="text-xl font-bold">{money(value)}</dd></div>)}</dl>
    {data?.aov.value === null && <p className="text-xs text-muted-foreground mt-2">Average order value is unavailable when there are no qualifying original orders.</p>}
  </section>;
}
