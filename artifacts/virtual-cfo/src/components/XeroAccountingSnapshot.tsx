import {useQuery} from '@tanstack/react-query';
import {fetchXeroAccountingPeriod, type XeroAccountingScope} from '@/lib/xeroAccountingApi';
import {validXeroScope} from '../../../api-server/src/lib/xero-accounting-reader';
const reasons: Record<string, string> = {
  accounting_evidence_unavailable: 'No supported Xero snapshot matches this exact period and currency.',
  source_refresh_failed: 'The latest Xero refresh failed.',
  source_review_required: 'The Xero source needs review before amounts can be shown.',
  account_mapping_review_required: 'The saved account mapping needs review before amounts can be shown.',
};
/** Independent accrual evidence. Never feeds the merchant profit calculation. */
export function XeroAccountingSnapshot({scope}: {scope: XeroAccountingScope}) {
  const enabled = validXeroScope(scope);
  const query = useQuery({
    queryKey: ['xero-accounting', scope.storeId, scope.from, scope.to, scope.currency],
    queryFn: ({signal}) => fetchXeroAccountingPeriod(scope, signal), enabled,
    retry: false, refetchOnWindowFocus: false, placeholderData: undefined,
  });
  // Revalidate ownership and scope at display time as well as at the network boundary.
  const data = query.data?.storeId === scope.storeId && query.data.scope.from === scope.from && query.data.scope.to === scope.to && query.data.scope.currency === scope.currency ? query.data : null;
  const accounting = !query.isError && data && (data.state === 'available' || data.state === 'stale') ? data.accounting : null;
  const money = (minor: string) => new Intl.NumberFormat('en-GB', {style: 'currency', currency: scope.currency}).format(Number(minor) / 100);
  return <section aria-label="Xero accounting snapshot" aria-live="polite" className="rounded-xl border border-border bg-card p-4 space-y-3">
    <h2 className="text-lg font-bold">Xero accounting snapshot</h2>
    <p className="text-sm text-muted-foreground">Independent booked accounting amounts on an accrual basis. These selected mapped categories do not form a complete P&amp;L and do not change the sales and profit figures above.</p>
    <p className="text-xs text-muted-foreground">Selected period: {scope.from} – {scope.to} · {scope.currency || 'Currency unavailable'}</p>
    {!enabled && <p role="status" className="text-sm">Select a store, period and currency to check Xero accounting evidence.</p>}
    {enabled && query.isPending && <p role="status" className="text-sm">Checking Xero accounting evidence…</p>}
    {enabled && query.isError && <div className="space-y-2"><p role="status" className="text-sm">Xero accounting could not be loaded for this store and period. Amounts are unavailable.</p><button type="button" className="text-sm underline underline-offset-4" onClick={() => query.refetch()}>Retry Xero accounting check</button></div>}
    {!query.isError && data && !accounting && <p role="status" className="text-sm">{reasons[data.reason ?? ''] ?? 'Xero accounting evidence is unavailable.'}</p>}
    {accounting && <>
      {data?.state === 'stale' && <p role="status" className="rounded-md border border-amber-500/30 p-3 text-sm">The latest refresh failed. These are retained figures from the last supported closed-period snapshot; they are not a current refresh.</p>}
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">{([
        ['Booked revenue', accounting.bookedRevenueMinor], ['Processing fees', accounting.processingFeesMinor],
        ['Advertising', accounting.advertisingMinor], ['Software', accounting.softwareMinor],
      ] as const).map(([label, amount]) => <div key={label} className="rounded-lg bg-secondary/40 p-3"><dt className="text-xs font-semibold">{label}</dt><dd className="text-xl font-bold tabular-nums mt-2">{money(amount)}</dd></div>)}</dl>
      <p className="text-xs text-muted-foreground">Source: Xero · Accrual P&amp;L · As of {accounting.asOf} · Retrieved {accounting.retrievedAt} · {accounting.closedPeriod ? 'Closed period' : 'Open period snapshot'}.</p>
      <p className="text-xs text-muted-foreground">Basis: saved confirmed account mapping for this snapshot. These four categories do not cover every P&amp;L account. Cash balances and Shopify reconciliation are not supplied by this snapshot.</p>
    </>}
  </section>;
}
