import {reportingSourceMonth, validReportingDate} from './reportingRange.ts';
/** Display preferences only. A saved choice never authorises a report or evidence version. */
export type ReportingPeriod = 'last-week' | 'last-month' | 3 | 6 | 12 | 'custom';
export type ReportingView = 'weekly' | 'monthly';
export type ReportingComparison = 'last-year' | 'rolling' | 'none' | 'custom';
export type ReportingSelection = Readonly<{
  period: ReportingPeriod;
  view: ReportingView;
  perOrder: boolean;
  comparison: ReportingComparison;
  /** Optional month anchors are hints; each reader must revalidate its own evidence. */
  month: string;
  comparisonMonth: string;
  customFrom: string;
  customTo: string;
}>;
export type ReportingSelectionPatch = Partial<ReportingSelection>;
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
type Scope = { userId: string | null; storeId: string };
export type ReportingSelectionMetadata = Readonly<{ hasPreference: boolean; monthTouched: boolean; comparisonMonthTouched: boolean; revision: number }>;
const EMPTY_METADATA: ReportingSelectionMetadata = Object.freeze({ hasPreference: false, monthTouched: false, comparisonMonthTouched: false, revision: 0 });

export const DEFAULT_REPORTING_SELECTION: ReportingSelection = Object.freeze({
  period: 3, view: 'weekly', perOrder: false, comparison: 'last-year', month: '', comparisonMonth: '', customFrom: '', customTo: '',
});
const periods: readonly unknown[] = ['last-week', 'last-month', 3, 6, 12, 'custom'];
const comparisons: readonly unknown[] = ['last-year', 'rolling', 'none', 'custom'];
const validMonth = (value: unknown): value is string => typeof value === 'string' && (value === '' ||
  (/^\d{4}-(0[1-9]|1[0-2])-01$/.test(value) && value.slice(0, 4) !== '0000'));
const scopeKey = ({ userId, storeId }: Scope) => userId && storeId ? JSON.stringify([userId, storeId]) : null;
const storageKey = (scope: string) => `night-scout:reporting-selection:v1:${scope}`;
const monthLastDay = (month: string) => { const d = new Date(month + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.toISOString().slice(0, 10); };
const previousYearMonth = (month: string) => month && +month.slice(0, 4) > 1 ? `${String(+month.slice(0, 4) - 1).padStart(4, '0')}${month.slice(4)}` : '';

export function updateReportingSelection(current: ReportingSelection, patch: ReportingSelectionPatch): ReportingSelection {
  const next = { ...current };
  if (periods.includes(patch.period)) next.period = patch.period!;
  if (patch.view === 'weekly' || patch.view === 'monthly') next.view = patch.view;
  if (typeof patch.perOrder === 'boolean') next.perOrder = patch.perOrder;
  if (comparisons.includes(patch.comparison)) next.comparison = patch.comparison!;
  if (validReportingDate(patch.customFrom) || patch.customFrom === '') next.customFrom = patch.customFrom!;
  if (validReportingDate(patch.customTo) || patch.customTo === '') next.customTo = patch.customTo!;
  // Old page/deep-link month choices remain meaningful as exact custom dates.
  if (validMonth(patch.month) && patch.period === undefined) {
    next.period = 'custom';
    next.month = patch.month;
    next.customFrom = patch.month;
    next.customTo = patch.month ? monthLastDay(patch.month) : '';
  }
  if (validMonth(patch.comparisonMonth)) next.comparisonMonth = patch.comparisonMonth;
  if (validMonth(patch.comparisonMonth) && patch.comparison === undefined) next.comparison = patch.comparisonMonth ? 'custom' : 'none';
  if (next.comparison === 'none') next.comparisonMonth = '';
  else if (next.comparison === 'last-year' && (patch.comparison === 'last-year' || validMonth(patch.month))) next.comparisonMonth = previousYearMonth(next.month);
  // One-period presets have a meaningful bucket size. Changing View instead
  // leaves that preset behind rather than silently rendering a different view.
  if (patch.period === 'last-week') next.view = 'weekly';
  else if (patch.period === 'last-month') next.view = 'monthly';
  else if (patch.view === 'monthly' && next.period === 'last-week') next.period = 'last-month';
  else if (patch.view === 'weekly' && next.period === 'last-month') next.period = 'last-week';
  next.month = reportingSourceMonth(next);
  if (next.comparison === 'last-year') next.comparisonMonth = previousYearMonth(next.month);
  if (next.month && next.comparisonMonth && next.comparisonMonth >= next.month) next.comparisonMonth = '';
  return Object.freeze(next);
}

export function restoreReportingSelection(raw: string | null): ReportingSelection | null {
  if (!raw || raw.length > 2048) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const v = value as Record<string, unknown>;
    if (!periods.includes(v.period) || !['weekly', 'monthly'].includes(v.view as string) ||
      typeof v.perOrder !== 'boolean' || !comparisons.includes(v.comparison) ||
      !validMonth(v.month) || !validMonth(v.comparisonMonth)) return null;
    const modern = v.schemaVersion === 2 || ('customFrom' in v && 'customTo' in v);
    if (modern && (!(validReportingDate(v.customFrom) || v.customFrom === '') || !(validReportingDate(v.customTo) || v.customTo === ''))) return null;
    if (v.period === 'custom' && !modern) return null;
    const migrated = !modern && !!v.month;
    // Project only preference fields. Never retain an injected business/version/payload.
    return updateReportingSelection(DEFAULT_REPORTING_SELECTION, {
      period: migrated ? 'custom' : v.period as ReportingPeriod, view: v.view as ReportingView, perOrder: v.perOrder,
      comparison: v.comparison as ReportingComparison, comparisonMonth: v.comparisonMonth,
      customFrom: migrated ? v.month as string : modern ? v.customFrom as string : '',
      customTo: migrated ? monthLastDay(v.month as string) : modern ? v.customTo as string : '',
    });
  } catch { return null; }
}

/** One app-lifetime store shared by every page; user AND company isolate hints. */
export function createReportingSelectionStore(storage?: () => PreferenceStorage | undefined) {
  const selections = new Map<string, ReportingSelection>();
  const metadata = new Map<string, ReportingSelectionMetadata>();
  const listeners = new Map<string, Set<() => void>>();
  const read = (scope: Scope, firstUseDefaults: ReportingSelectionPatch = {}): ReportingSelection => {
    const key = scopeKey(scope);
    if (!key) return DEFAULT_REPORTING_SELECTION;
    if (!selections.has(key)) {
      let saved: ReportingSelection | null = null;
      let savedMetadata = EMPTY_METADATA;
      try {
        const raw = storage?.()?.getItem(storageKey(key)) ?? null;
        saved = restoreReportingSelection(raw);
        if (saved) {
          const fields = JSON.parse(raw!) as Record<string, unknown>;
          savedMetadata = Object.freeze({ hasPreference: true,
            monthTouched: typeof fields.monthTouched === 'boolean' ? fields.monthTouched : !!saved.month,
            comparisonMonthTouched: typeof fields.comparisonMonthTouched === 'boolean' ? fields.comparisonMonthTouched : !!saved.comparisonMonth,
            revision: 1 });
        }
      } catch { /* Optional storage. */ }
      selections.set(key, saved ?? updateReportingSelection(DEFAULT_REPORTING_SELECTION, firstUseDefaults));
      metadata.set(key, savedMetadata);
    }
    return selections.get(key)!;
  };
  return {
    read,
    metadata(scope: Scope): ReportingSelectionMetadata {
      const key = scopeKey(scope);
      if (!key) return EMPTY_METADATA;
      read(scope);
      return metadata.get(key)!;
    },
    update(scope: Scope, patch: ReportingSelectionPatch) {
      const key = scopeKey(scope);
      if (!key) return;
      const current = read(scope), next = updateReportingSelection(current, patch);
      const oldMetadata = metadata.get(key)!;
      const monthTouched = oldMetadata.monthTouched || validMonth(patch.month) || patch.period !== undefined || patch.customFrom !== undefined || patch.customTo !== undefined;
      const comparisonMonthTouched = oldMetadata.comparisonMonthTouched || validMonth(patch.comparisonMonth) || patch.comparison !== undefined;
      if (oldMetadata.hasPreference && monthTouched === oldMetadata.monthTouched && comparisonMonthTouched === oldMetadata.comparisonMonthTouched && (Object.keys(next) as (keyof ReportingSelection)[]).every(field => next[field] === current[field])) return;
      selections.set(key, next);
      metadata.set(key, Object.freeze({ hasPreference: true, monthTouched, comparisonMonthTouched, revision: oldMetadata.revision + 1 }));
      try { storage?.()?.setItem(storageKey(key), JSON.stringify({ ...next, schemaVersion: 2, monthTouched, comparisonMonthTouched })); } catch { /* In-memory navigation remains usable. */ }
      listeners.get(key)?.forEach(listener => listener());
    },
    subscribe(scope: Scope, listener: () => void) {
      const key = scopeKey(scope);
      if (!key) return () => {};
      const group = listeners.get(key) ?? new Set<() => void>();
      listeners.set(key, group); group.add(listener);
      return () => { group.delete(listener); if (!group.size) listeners.delete(key); };
    },
  };
}

export const reportingSelectionStore = createReportingSelectionStore(() =>
  typeof window === 'undefined' ? undefined : window.sessionStorage);
