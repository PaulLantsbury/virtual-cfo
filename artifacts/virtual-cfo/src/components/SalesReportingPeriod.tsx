import type { useSalesReporting } from '@/lib/analytics/useSalesReporting';

export function SalesReportingPeriod({ reporting }: { reporting: ReturnType<typeof useSalesReporting> }) {
  const { selection, period, config } = reporting;
  return <section aria-label="Sales reporting period" className="rounded-xl border border-border bg-card p-4 mb-5">
    <div className="flex flex-wrap items-end gap-4">
      <label className="text-sm font-medium">Reporting period
        <select className="block mt-1 border rounded p-2 bg-background" value={selection.mode}
          onChange={event => reporting.setMode(event.target.value as typeof selection.mode)}>
          <option value="last_complete_month">Last Complete Month</option>
          <option value="last_complete_week">Last Complete Week</option>
          <option value="custom">Custom dates</option>
        </select>
      </label>
      {selection.mode === 'custom' && <>
        <label className="text-sm font-medium">From<input className="block mt-1 border rounded p-2 bg-background" type="date" value={selection.from}
          onChange={event => reporting.setDate('from', event.target.value)} /></label>
        <label className="text-sm font-medium">To<input className="block mt-1 border rounded p-2 bg-background" type="date" value={selection.to}
          onChange={event => reporting.setDate('to', event.target.value)} /></label>
      </>}
    </div>
    <p className="text-sm text-muted-foreground mt-3">{period.label}{period.dateFrom && `: ${period.dateFrom} – ${period.dateTo}`}</p>
    <p className="text-xs text-muted-foreground mt-1">{config ? `Store timezone: ${config.timezone} · Currency: ${config.currency}` : 'Store timezone and currency unavailable.'} This store’s selection is shared across reporting pages.</p>
    {reporting.status === 'invalid' && <p role="alert" className="text-sm mt-2">Choose real calendar dates with From on or before To. Figures are unavailable until the dates are valid.</p>}
    {reporting.status === 'unavailable' && <div role="status" className="text-sm mt-2">
      <p>{reporting.reason}</p>
      <button type="button" className="mt-2 underline underline-offset-4" onClick={reporting.retry}>Retry sales evidence check</button>
    </div>}
    {selection.mode === 'custom' && <p className="text-xs text-muted-foreground mt-2">Previous-period comparisons are unavailable for custom dates.</p>}
  </section>;
}
