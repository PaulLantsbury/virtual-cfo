import { useQuery } from '@tanstack/react-query';
import { useActiveStore } from '@/lib/auth/AuthProvider';
import { fetchXeroMerchantReadiness } from '@/lib/xeroMerchantApi';
import { xeroMerchantReadinessView } from '@/lib/xeroMerchantReadiness';

/** Merchant-safe status only; Xero figures never pass through this component. */
export function XeroMerchantEvidenceStatus() {
  const storeId = useActiveStore();
  const query = useQuery({
    queryKey: ['xero-merchant-readiness', storeId],
    queryFn: ({ signal }) => fetchXeroMerchantReadiness(storeId, signal),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const view = xeroMerchantReadinessView(query.data ?? null, true);
  const style = view.tone === 'positive' ? 'border-emerald-500/30 bg-emerald-500/5' : view.tone === 'warning' || query.isError ? 'border-amber-500/30 bg-amber-500/5' : 'border-border bg-card';
  const title = query.isError ? 'Xero accounting evidence is unavailable' : view.title;
  const detail = query.isError ? 'Night Scout could not verify Xero accounting evidence for this store. No Xero amount is shown or inferred.' : view.detail;
  return <section aria-live="polite" aria-label="Xero accounting status" className={`rounded-xl border p-4 ${style}`}>
    <h3 className="font-medium">{query.isPending ? 'Checking Xero accounting evidence' : title}</h3>
    <p role="status" className="mt-1 text-sm text-muted-foreground">{query.isPending ? 'No Xero accounting amount is shown until Night Scout verifies the current store, mapping and dated evidence.' : detail}</p>
    {query.isError && <button type="button" className="mt-3 text-sm font-medium text-primary underline underline-offset-4" onClick={() => query.refetch()}>Check again</button>}
  </section>;
}
