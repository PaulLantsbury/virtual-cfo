/** A complete explicit-zone confirmation instant; never normalize an invalid date. */
export function validXeroMappingInstant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/.test(value)) return false;
  const calendar = value.slice(0, 10);
  const date = new Date(`${calendar}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === calendar && Number.isFinite(Date.parse(value));
}
