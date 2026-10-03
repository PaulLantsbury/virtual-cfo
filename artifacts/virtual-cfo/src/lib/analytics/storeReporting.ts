import { getReportingPeriod, type ReportingTimeline } from './reportingPeriod.ts';
export type StoreReporting = {storeId: string; currency: string; timezone: string};
export function parseStoreReporting(row: unknown, storeId: string): StoreReporting {
  const r = row as Record<string, unknown> | null;
  if (!r || r.id !== storeId || typeof r.currency_code !== 'string' || typeof r.timezone !== 'string') throw new Error('Store reporting settings unavailable');
  const currency = r.currency_code.trim();
  if (!Intl.supportedValuesOf('currency').includes(currency)) throw new Error('Unsupported currency');
  const format = new Intl.NumberFormat('en-GB', {style:'currency', currency}).resolvedOptions();
  // Current verified arithmetic uses hundredths; other minor-unit scales need a separate adapter.
  if (format.minimumFractionDigits !== 2 || format.maximumFractionDigits !== 2) throw new Error('Unsupported currency precision');
  new Intl.DateTimeFormat('en-GB', {timeZone:r.timezone}).format();
  return {storeId, currency, timezone:r.timezone};
}
export function storeReportingPeriod(timeline: ReportingTimeline, timezone: string, back=0, instant=new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:timezone,year:'numeric',month:'numeric',day:'numeric'}).formatToParts(instant);
  const part=(name:string)=>Number(parts.find(p=>p.type===name)!.value);
  return getReportingPeriod(timeline, back, new Date(part('year'),part('month')-1,part('day'),12));
}

export type SalesReportingSelection =
  | { mode: ReportingTimeline }
  | { mode: 'custom'; from: string; to: string };

/** Reject calendar rollover, partial dates and reversed ranges before any request. */
export function isValidReportingDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
export function isValidReportingRange(from: string, to: string): boolean {
  return isValidReportingDate(from) && isValidReportingDate(to) && from <= to;
}
export function parseSalesReportingSelection(value: unknown): SalesReportingSelection | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (row.mode === 'last_complete_month' || row.mode === 'last_complete_week') return { mode: row.mode };
  // Preserve an invalid in-progress custom date so every page withholds figures,
  // rather than silently substituting an older/default period after navigation.
  if (row.mode === 'custom' && typeof row.from === 'string' && typeof row.to === 'string') {
    return { mode: 'custom', from: row.from, to: row.to };
  }
  return null;
}

/** A corrupt saved selection must not silently switch to another reporting period. */
export function restoreSalesReportingSelection(serialized: string | null): SalesReportingSelection {
  if (serialized === null) return { mode: 'last_complete_month' };
  try {
    const parsed = parseSalesReportingSelection(JSON.parse(serialized));
    if (parsed) return parsed;
  } catch { /* Corrupt preferences require an explicit new selection. */ }
  return { mode: 'custom', from: '', to: '' };
}
