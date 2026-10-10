import { useQuery } from '@tanstack/react-query';
import { useActiveStore } from '@/lib/auth/AuthProvider';
import { fetchCashControlReadiness } from '@/lib/xeroMerchantApi';
import { cashControlReadinessFromXeroMerchant } from '@/lib/analytics/cashControlReadiness';
import { CashControlReadiness } from '@/components/CashControlReadiness';

/**
 * Reads status from the authenticated server only. A response error deliberately
 * falls back to unavailable rather than treating failed data as a zero balance.
 */
export function CashControlXeroReadiness() {
  const storeId = useActiveStore();
  const query = useQuery({ queryKey: ['xero-cash-readiness', storeId], queryFn: ({ signal }) => fetchCashControlReadiness(storeId, signal), retry: false, refetchOnWindowFocus: false });
  const fallback = cashControlReadinessFromXeroMerchant(null, true, storeId);
  return <div>
    <CashControlReadiness readiness={query.data ?? fallback} />
    {query.isError && <button type="button" className="-mt-3 mb-5 text-sm font-medium text-primary underline underline-offset-4" onClick={() => query.refetch()}>Check Xero cash status again</button>}
  </div>;
}
