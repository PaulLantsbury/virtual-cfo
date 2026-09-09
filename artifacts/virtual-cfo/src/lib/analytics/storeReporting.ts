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
