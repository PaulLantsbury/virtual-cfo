import { useSalesReporting } from './useSalesReporting';
import { buildVerifiedBriefing } from './verifiedBriefing';
export { useStoreReporting } from './useSalesReporting';

export function useVerifiedBriefing(storeId: string) {
  const reporting = useSalesReporting(storeId);
  return {
    period: reporting.period,
    loading: reporting.loading,
    comparison: reporting.comparison,
    briefing: reporting.data ? buildVerifiedBriefing(reporting.data, reporting.previousData, reporting.comparison.status) : null,
    reporting,
  };
}
