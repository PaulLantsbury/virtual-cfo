import { useCallback, useSyncExternalStore } from 'react';
import { DEFAULT_REPORTING_SELECTION, reportingSelectionStore, type ReportingSelectionPatch } from './reportingSelection';

/** Shared non-sensitive controls. Readers still authenticate and validate scope independently. */
export function useReportingSelection(userId: string | null, storeId: string, firstUseDefaults: ReportingSelectionPatch = {}) {
  const subscribe = useCallback((listener: () => void) => reportingSelectionStore.subscribe({ userId, storeId }, listener), [userId, storeId]);
  const getSnapshot = useCallback(() => reportingSelectionStore.read({ userId, storeId }, firstUseDefaults), [userId, storeId, firstUseDefaults]);
  const selection = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_REPORTING_SELECTION);
  const getMetadata = useCallback(() => reportingSelectionStore.metadata({ userId, storeId }), [userId, storeId]);
  const metadata = useSyncExternalStore(subscribe, getMetadata, () => reportingSelectionStore.metadata({ userId: null, storeId: '' }));
  const setSelection = useCallback((patch: ReportingSelectionPatch) => reportingSelectionStore.update({ userId, storeId }, patch), [userId, storeId]);
  return { selection, setSelection, ...metadata };
}
