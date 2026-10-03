import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../auth/AuthProvider';
import type { useSalesReporting } from './useSalesReporting';
import type { VerifiedSales } from '../../../../../experiments/financial-v1/rpc-sales-adapter.mjs';

export type ProfitMetric = { value: number | null; state: 'ready' | 'unavailable'; reason: string | null };
export const profitMetricKeys = ['originalCosts', 'recoveredCosts', 'cogs', 'variableCosts', 'advertising', 'overheads', 'da', 'revenueDenominator', 'grossProfit', 'contributionBeforeMarketing', 'contribution', 'operatingProfit', 'ebitda', 'contributionMargin', 'operatingMargin'] as const;
export type ProfitReport = Record<typeof profitMetricKeys[number], ProfitMetric> & {
  scope: { storeId: string; currency: string; from: string; to: string };
  sales: VerifiedSales | null;
  state: 'complete' | 'partial' | 'unavailable';
  reason: string | null;
};
type ProfitResponse = { state: 'ready'; report: ProfitReport; versionId: string } | { state: 'unavailable'; reason: string };

export function isFullProfitMonth(from: string, to: string) {
  if (!/^\d{4}-\d{2}-01$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from.slice(0, 7) !== to.slice(0, 7)) return false;
  const [year, month] = from.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12) return false;
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return Number(to.slice(8)) === days;
}

export function profitReportMatches(report: ProfitReport, scope: ProfitReport['scope']) {
  return report && report.scope && Object.entries(scope).every(([key, value]) => report.scope[key as keyof typeof scope] === value)
    && profitMetricKeys.every(key => {
      const metric = report[key];
      return metric && (metric.state === 'ready' ? typeof metric.value === 'number' && Number.isFinite(metric.value) : metric.state === 'unavailable' && metric.value === null);
    }) && (!report.sales || Object.entries(scope).every(([key, value]) => report.sales!.provenance?.[key as keyof typeof scope] === value));
}

export function useProfitReporting(storeId: string, reporting: ReturnType<typeof useSalesReporting>) {
  const auth = useAuth();
  const { config, period } = reporting;
  const fullMonth = isFullProfitMonth(period.dateFrom, period.dateTo);
  const userId = auth.status === 'ready' ? auth.userId : null;
  const scope = { storeId, currency: config?.currency ?? '', from: period.dateFrom, to: period.dateTo };
  const enabled = !!userId && !!config && reporting.valid && fullMonth;
  const query = useQuery<ProfitResponse>({
    queryKey: ['profit-reporting', userId, storeId, scope.currency, config?.timezone, scope.from, scope.to],
    enabled, retry: false, placeholderData: undefined,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session || data.session.user.id !== userId) throw new Error('Sign in again to check profit evidence.');
      const response = await fetch(`/api/profit-reporting?${new URLSearchParams(scope)}`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` }, signal,
      });
      if (!response.ok) throw new Error(response.status === 403 ? 'Profit evidence is not accessible for this store.' : 'Profit evidence could not be checked.');
      const result = await response.json() as ProfitResponse;
      if (result.state === 'unavailable' && typeof result.reason === 'string') return result;
      if (result.state !== 'ready' || !profitReportMatches(result.report, scope)) throw new Error('Profit evidence does not match this reporting period.');
      return result;
    },
  });
  const report = enabled && query.isSuccess && query.data.state === 'ready' && profitReportMatches(query.data.report, scope) ? query.data.report : null;
  const reason = !reporting.valid ? 'Choose a valid reporting period.' : !fullMonth ? 'Profit reporting requires one complete calendar month. Select custom dates from the first to the last day of a month.' : !config ? 'Store reporting settings are unavailable.' : query.isError ? query.error.message : query.data?.state === 'unavailable' ? query.data.reason : report?.reason;
  return { report, reason, loading: enabled && query.isPending, fullMonth };
}
