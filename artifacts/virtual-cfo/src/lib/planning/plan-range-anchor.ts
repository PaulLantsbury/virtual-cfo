import {validReportingDate} from '../reportingRange.ts';

/** Plan uses complete calendar months as historical inputs, never the unfinished
 * remainder of a selected week/custom period. This chooses a date hint only;
 * the authenticated history reader still validates every monthly source. */
export function planBaselineMonthForRange(range:{from:string;to:string}|null):string {
  if (!range || !validReportingDate(range.from) || !validReportingDate(range.to) || range.from > range.to) return '';
  const end = new Date(range.to + 'T12:00:00Z');
  const next = new Date(end);
  next.setUTCDate(next.getUTCDate() + 1);
  const month = new Date(end);
  month.setUTCDate(1);
  if (next.getUTCDate() !== 1) month.setUTCMonth(month.getUTCMonth() - 1);
  const result = month.toISOString().slice(0, 10);
  return validReportingDate(result) ? result : '';
}
