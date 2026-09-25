import { Fragment } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SalesReportingPeriod } from '@/components/SalesReportingPeriod';
import { useActiveStore, useAuth } from '@/lib/auth/AuthProvider';
import { useSalesReporting } from '@/lib/analytics/useSalesReporting';
import { useProfitReporting, type ProfitMetric, type ProfitReport } from '@/lib/analytics/useProfitReporting';
import { canAccess } from '@/lib/plan';
import { CfoEvidenceStatus } from '@/components/CfoEvidenceStatus';
import { cfoEvidenceFromReporting } from '@/lib/analytics/cfoEvidence';

const costRows: readonly [string, keyof Pick<ProfitReport, 'originalCosts' | 'recoveredCosts' | 'cogs' | 'grossProfit' | 'variableCosts' | 'contributionBeforeMarketing' | 'advertising' | 'contribution' | 'overheads' | 'operatingProfit' | 'da' | 'ebitda'>, number, string][] = [
  ['Historical product costs', 'originalCosts', -1, 'Supported landed costs when the original goods were sold'],
  ['Saleable stock cost recovery', 'recoveredCosts', 1, 'Recognised when goods actually returned to saleable inventory, independently of refund date'],
  ['Net cost of goods sold', 'cogs', -1, 'Subtotal of historical product costs less stock cost recovery'],
  ['Gross profit', 'grossProfit', 1, 'Net product sales less net cost of goods sold'],
  ['Variable operating costs', 'variableCosts', -1, 'Actual processing, fulfilment, packaging, shipping and return-handling expenses'],
  ['Contribution before marketing', 'contributionBeforeMarketing', 1, 'Gross profit plus net shipping revenue less variable operating costs'],
  ['Advertising expenditure', 'advertising', -1, 'Actual period advertising expense, deducted once'],
  ['Contribution', 'contribution', 1, 'Contribution after marketing'],
  ['Operating overheads', 'overheads', -1, 'Includes depreciation and amortisation; excludes interest and corporation tax'],
  ['Operating profit', 'operatingProfit', 1, 'Contribution less operating overheads'],
  ['Add back depreciation and amortisation', 'da', 1, 'Identified amounts already included in operating overheads'],
  ['EBITDA', 'ebitda', 1, 'Operating profit plus depreciation and amortisation'],
];

export default function ProfitGrowth() {
  const storeId = useActiveStore();
  const auth = useAuth();
  const storeName = auth.status === 'ready' ? auth.stores.find(store => store.id === storeId)?.name : null;
  const reporting = useSalesReporting(storeId);
  const profit = useProfitReporting(storeId, reporting);
  const { report } = profit;
  // Prefer the sales from the same transaction as costs. Independently verified sales remain visible if profit evidence is unavailable.
  const sales = report?.sales ?? reporting.data;
  const money = (value: number) => reporting.config ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: reporting.config.currency }).format(value / 100) : 'Unavailable';
  const value = (metric: ProfitMetric | undefined, sign = 1) => metric?.state === 'ready' && metric.value !== null ? money(metric.value * sign) : 'Unavailable';
  const missing = (metric: ProfitMetric | undefined) => metric?.state === 'unavailable' ? metric.reason : !report ? profit.reason ?? 'Verified cost evidence is unavailable.' : null;
  const bridgeAvailable = canAccess('profit_driver_table');
  const headlines: [string, ProfitMetric | undefined][] = [['Gross profit', report?.grossProfit], ['Contribution', report?.contribution], ['Operating profit', report?.operatingProfit], ['EBITDA', report?.ebitda]];
  const row = (label: string, amount: string, meaning: string, reason?: string | null) => <tr key={label} className="border-t border-border/40"><th scope="row" className="py-3 pr-3 text-left font-medium">{label}<span className="block text-xs font-normal text-muted-foreground mt-1">{meaning}</span>{bridgeAvailable && reason && <span className="block text-xs font-normal text-muted-foreground mt-1">{reason}</span>}</th><td className="text-right font-semibold tabular-nums whitespace-nowrap">{bridgeAvailable ? amount : 'Locked'}</td></tr>;
  return <AppLayout showMonitoring={false}>
    <div className="max-w-5xl mx-auto space-y-6">
      <header><h1 className="text-3xl font-display font-bold">Profit Overview</h1><p className="text-sm text-muted-foreground mt-2">See where the money goes, from sales through costs to contribution and operating profit.</p></header>
      <section aria-label="Profit reporting status" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
        <h2 className="font-bold">{import.meta.env.DEV ? 'Staging evidence preview' : 'Verified evidence preview'} · {storeName ?? 'Selected store'}</h2>
        <p className="text-sm">Synthetic staging stores contain test transactions, not merchant trading results. Figures below come from the selected store’s verified evidence; no sample profit model is substituted.</p>
        <p className="text-sm">Sales means net product sales excluding VAT and shipping. Contribution is after marketing. Missing costs remain unavailable, while earlier supported subtotals stay visible.</p>
        <p role="status" className="text-sm">{profit.loading ? 'Checking profit evidence…' : report?.state === 'complete' ? 'All profit subtotals have supporting evidence for this month.' : report ? 'Some profit subtotals are unavailable. See the reasons alongside each figure.' : profit.reason ?? 'Profit evidence unavailable.'}</p>
      </section>
      <CfoEvidenceStatus evidence={cfoEvidenceFromReporting({
        scope: { storeId, currency: reporting.config?.currency ?? '', from: reporting.period.dateFrom, to: reporting.period.dateTo },
        loading: reporting.loading,
        hasSupportedEvidence: !!reporting.data,
        detail: profit.loading ? 'Profit evidence is still being checked.' : profit.reason ?? null,
      })} />
      <SalesReportingPeriod reporting={reporting} />
      <section aria-label="Verified profit overview" aria-live="polite" className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">Selected period results</h2>
        <p className="text-xs text-muted-foreground mt-1 mb-4">{reporting.period.dateFrom} – {reporting.period.dateTo} · {reporting.config?.currency ?? 'Currency unavailable'}</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div role="group" aria-label="Sales" className="rounded-lg bg-secondary/40 p-3"><h3 className="text-xs font-semibold">Sales</h3><p className="text-xl font-bold tabular-nums mt-2">{sales ? money(sales.netProductSales) : 'Unavailable'}</p><p className="text-xs text-muted-foreground mt-2">Net product sales, excluding VAT and shipping</p></div>
          {headlines.map(([label, metric]) => <div key={label} role="group" aria-label={label} className="rounded-lg bg-secondary/40 p-3 min-w-0"><h3 className="text-xs font-semibold">{label}</h3><p className="text-xl font-bold tabular-nums mt-2">{value(metric)}</p>{missing(metric) && <p className="text-xs text-muted-foreground mt-2">{missing(metric)}</p>}</div>)}
        </div>
        {sales && <p className="text-xs text-muted-foreground mt-3">{sales.originalOrders} qualifying original orders · Original AOV: {sales.aov.value === null ? 'Unavailable — no qualifying original orders' : money(sales.aov.value)}. Later refunds affect their own event month.</p>}
      </section>
      <section className="rounded-xl border border-border bg-card p-4"><h2 className="text-lg font-bold">Detailed profit bridge</h2><p className="text-xs text-muted-foreground mt-1 mb-4">Deductions have negative signs. Subtotals summarise the preceding components and are not additional deductions. Stock recovery can produce profit in a month without new sales.</p>
        <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Verified profit bridge</caption><thead><tr><th scope="col" className="text-left py-2 pr-3">Component</th><th scope="col" className="text-right py-2">Selected period {reporting.config?.currency}</th></tr></thead><tbody>
          {row('Gross product sales', sales ? money(sales.grossProductSales) : 'Unavailable', 'Before product discounts and refunds, excluding VAT')}
          {row('Product discounts', sales ? money(-sales.discounts) : 'Unavailable', 'Product discounts deducted once')}
          {row('Product refunds', sales ? money(-sales.productRefundExVat) : 'Unavailable', 'Refund events in the selected period, excluding VAT')}
          {row('Sales', sales ? money(sales.netProductSales) : 'Unavailable', 'Net product sales, excluding VAT and shipping')}
          {costRows.map(([label, key, sign, meaning]) => <Fragment key={key}>{key === 'variableCosts' && row('Net shipping revenue', sales ? money(sales.netShipping) : 'Unavailable', 'Shipping charges less discounts and refunds, excluding VAT')}{row(label, value(report?.[key], sign), meaning, missing(report?.[key]))}</Fragment>)}
        </tbody></table></div>
        {!bridgeAvailable && <p className="text-xs text-muted-foreground mt-3">Detailed amounts are available in the Pro preview.</p>}
      </section>
      <a href="/scenario-lab" className="inline-flex font-semibold text-primary underline">Explore the separate sample model in Scenario Planner</a>
      <p className="text-sm text-muted-foreground">Scenario Planner still uses a labelled sample month. Its starting figures are not connected to these store results. Store-specific recommendations and forecasts remain unavailable.</p>
    </div>
  </AppLayout>;
}
