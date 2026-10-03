import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import {
  parseStoreReporting, storeReportingPeriod, isValidReportingRange,
  restoreSalesReportingSelection, type SalesReportingSelection,
} from './storeReporting';
import { fetchVerifiedSales, type VerifiedSales } from '../../../../../experiments/financial-v1/rpc-sales-adapter.mjs';

// Only non-sensitive period preferences are stored. Each store has its own scope.
const selections = new Map<string, SalesReportingSelection>();
const listeners = new Set<() => void>();
const defaultSelection: SalesReportingSelection = { mode: 'last_complete_month' };
const storageKey = (storeId: string) => `night-scout:sales-reporting:${storeId}`;
function selectionFor(storeId: string): SalesReportingSelection {
  if (!selections.has(storeId)) {
    let saved: SalesReportingSelection | null = null;
    try { saved = restoreSalesReportingSelection(sessionStorage.getItem(storageKey(storeId))); } catch { /* Storage can be disabled. */ }
    selections.set(storeId, saved ?? defaultSelection);
  }
  return selections.get(storeId)!;
}
function select(storeId: string, value: SalesReportingSelection) {
  selections.set(storeId, value);
  try { sessionStorage.setItem(storageKey(storeId), JSON.stringify(value)); } catch { /* In-memory navigation still works. */ }
  listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useStoreReporting(storeId: string) {
  return useQuery({
    queryKey: ['store-reporting', storeId], enabled: !!storeId, retry: false,
    placeholderData: undefined,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('stores').select('id,currency_code,timezone').eq('id', storeId).abortSignal(signal).single();
      if (error) throw new Error('Store reporting settings unavailable');
      return parseStoreReporting(data, storeId);
    },
  });
}

/** One scope and query identity for all sales-reporting consumers. */
export function useSalesReporting(storeId: string) {
  const selection = useSyncExternalStore(subscribe, () => selectionFor(storeId), () => defaultSelection);
  const settings = useStoreReporting(storeId);
  const config = settings.isSuccess && settings.data.storeId === storeId ? settings.data : null;
  const absent = { dateFrom: '', dateTo: '', label: 'Reporting settings unavailable' };
  const period = selection.mode === 'custom'
    ? { dateFrom: selection.from, dateTo: selection.to, label: 'Custom reporting period' }
    : config ? storeReportingPeriod(selection.mode, config.timezone) : absent;
  const prior = selection.mode !== 'custom' && config
    ? storeReportingPeriod(selection.mode, config.timezone, 1)
    : { dateFrom: '', dateTo: '', label: 'Custom-period comparison unavailable' };
  const valid = isValidReportingRange(period.dateFrom, period.dateTo);
  const canRead = !!storeId && !!config && valid;
  const queryOptions = (from: string, to: string, enabled: boolean) => ({
    queryKey: ['verified-sales', storeId, config?.currency, config?.timezone, from, to],
    enabled, retry: false, placeholderData: undefined,
    queryFn: ({ signal }: { signal: AbortSignal }) => {
      if (!config || !isValidReportingRange(from, to)) throw new Error('Reporting scope unavailable');
      return fetchVerifiedSales((name, params) => supabase.rpc(name, params).abortSignal(signal), {
        storeId, currency: config.currency, from, to,
      });
    },
  });
  const current = useQuery(queryOptions(period.dateFrom, period.dateTo, canRead));
  const matches = (data: VerifiedSales | undefined, from: string, to: string) => !!config && !!data &&
    data.provenance.storeId === storeId && data.provenance.currency === config.currency &&
    data.provenance.from === from && data.provenance.to === to;
  const data = canRead && current.isSuccess && matches(current.data, period.dateFrom, period.dateTo) ? current.data : null;
  const previous = useQuery(queryOptions(prior.dateFrom, prior.dateTo, !!data && selection.mode !== 'custom'));
  const previousData = data && selection.mode !== 'custom' && previous.isSuccess && matches(previous.data, prior.dateFrom, prior.dateTo) ? previous.data : null;
  const invalidCustom = selection.mode === 'custom' && !valid;
  const loading = !invalidCustom && !!storeId && (settings.isPending || (canRead && current.isPending));
  const status = invalidCustom ? 'invalid' : loading ? 'loading' : data ? 'ready' : 'unavailable';
  const comparisonStatus = selection.mode === 'custom' ? 'error' : previousData ? 'ready' :
    !data || previous.isPending ? 'loading' : 'error';
  return {
    period, prior, config, settings, data, previousData, valid, loading, status,
    comparison: { status: comparisonStatus as 'loading' | 'ready' | 'error', period: prior },
    selection,
    setRange: (from: string, to: string) => select(storeId, { mode: 'custom', from, to }),
    setMode: (mode: SalesReportingSelection['mode']) => select(storeId, mode === 'custom'
      ? { mode, from: period.dateFrom, to: period.dateTo } : { mode }),
  };
}
