// Pure preparation only: no clock reads, collection, claims, scheduling or writes.
const invalid = () => new Error('Explicit valid timestamp and named timezone required');
const DAY = 86_400_000;

function parseInstant(now) {
  if (typeof now !== 'string') throw invalid();
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(now);
  if (!match) throw invalid();
  const [, date, hour, minute, second, , offset] = match;
  const midnight = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(midnight) || Number(date.slice(0,4)) < 1 || new Date(midnight).toISOString().slice(0,10) !== date || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) throw invalid();
  if (offset !== 'Z') {
    const hours = Number(offset.slice(1,3)), minutes = Number(offset.slice(4,6));
    // -00:00 represents an unknown offset, not a confirmed source instant.
    if (offset === '-00:00' || hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) throw invalid();
  }
  const instant = new Date(now);
  if (!Number.isFinite(instant.getTime())) throw invalid();
  return instant;
}

/** Inclusive 31-calendar-date window, ending yesterday in the supplied zone.
 * Missing runs are not replayed: this only selects the next window. Historical
 * gaps outside it and uncertain outcomes still require separate review.
 * Named-zone support here does not activate any additional store or timezone.
 */
export function rollingReportingScope({now, timezone} = {}) {
  const instant = parseInstant(now);
  if (typeof timezone !== 'string' || !timezone || timezone.length > 128 || /\s/.test(timezone) || /^[+-]/.test(timezone)) throw invalid();
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {timeZone:timezone, calendar:'gregory', numberingSystem:'latn', year:'numeric', month:'2-digit', day:'2-digit'});
  } catch { throw invalid(); }
  const parts = Object.fromEntries(formatter.formatToParts(instant).map(({type,value}) => [type,value]));
  const localDate = `${parts.year.padStart(4,'0')}-${parts.month}-${parts.day}`;
  const anchor = Date.parse(`${localDate}T00:00:00Z`);
  // Subtract calendar labels in UTC, never 24 elapsed hours from a local instant.
  const from = new Date(anchor - 31 * DAY).toISOString().slice(0,10);
  const to = new Date(anchor - DAY).toISOString().slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate) || from.startsWith('0000') || !/^\d{4}-\d{2}-\d{2}$/.test(from)) throw invalid();
  return Object.freeze({from, to, localDate, timezone, calendarDays:31});
}
