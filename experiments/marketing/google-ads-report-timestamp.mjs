/** Strict report provenance instant: never let Date.parse repair malformed input. */
export function isGoogleAdsReportTimestamp(value) {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/.test(value)) return false;
  const day = value.slice(0, 10);
  const localDay = new Date(`${day}T00:00:00.000Z`);
  return Number.isFinite(localDay.valueOf()) && localDay.toISOString().slice(0, 10) === day
    && Number.isFinite(Date.parse(value));
}
