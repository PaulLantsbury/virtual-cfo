import { Link } from 'wouter';
import type { useProfitReporting, ProfitMetric } from '@/lib/analytics/useProfitReporting';

/** Presents the existing scoped report; never calculates or substitutes profit. */
export function VerifiedProfitSummary({ profit, currency }: {
  profit: ReturnType<typeof useProfitReporting>;
  currency: string | undefined;
}) {
  const report = profit.report;
  const money = (metric: ProfitMetric | undefined) => metric?.state === 'ready' && metric.value !== null && currency
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(metric.value / 100)
    : 'Unavailable';
  const percent = (metric: ProfitMetric | undefined) => metric?.state === 'ready' && metric.value !== null
    ? new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 }).format(metric.value)
    : 'Unavailable';
  const metrics = [['Gross profit', report?.grossProfit], ['Contribution', report?.contribution], ['Operating profit', report?.operatingProfit], ['EBITDA', report?.ebitda]] as const;
  return <section aria-label="Verified profit summary" className="rounded-xl border border-border bg-card p-5 my-6">
    <h2 className="text-lg font-bold">Profit for the selected period</h2>
    <p role="status" className="text-sm text-muted-foreground mt-2">{profit.loading ? 'Checking profit evidence…' : report?.state === 'complete' ? 'All profit subtotals have supporting evidence for this month.' : report ? 'Some profit subtotals need more evidence. Supported figures remain available.' : profit.reason ?? 'Profit evidence is unavailable for this period.'}</p>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
      {metrics.map(([label, metric]) => <div role="group" aria-label={label} key={label} className="min-w-0">
        <h3 className="text-xs font-semibold">{label}</h3>
        <p className="text-xl font-bold tabular-nums mt-2">{money(metric)}</p>
        {metric?.state === 'unavailable' && <p className="text-xs text-muted-foreground mt-2">{metric.reason}</p>}
      </div>)}
    </div>
    <p className="text-sm text-muted-foreground mt-4">Contribution margin: {percent(report?.contributionMargin)} · Operating margin: {percent(report?.operatingMargin)}</p>
    <p className="text-xs text-muted-foreground mt-2">Contribution is after marketing. Operating profit includes depreciation and amortisation; EBITDA adds them back. Margins use net product sales plus net shipping revenue. Unsupported margins remain unavailable.</p>
    <Link href="/profit-engine" className="inline-flex text-sm font-semibold text-primary underline mt-3">View the full breakdown in Profit Overview</Link>
  </section>;
}
