/**
 * Shared, pure allocation of explicitly classified recurring monthly costs.
 * Inputs are resolved business-calendar dates and integer pence. This module
 * does not authenticate, infer account classifications, fetch evidence, change
 * source totals, calculate profit or assert an actual cash-payment date.
 * A trusted adapter must establish classification/selection/coverage authority;
 * approved:true and approvalId below are data-contract checks, not security.
 */
export const MONTHLY_COST_ALLOCATION_METHOD = 'recurring-monthly-calendar-days-cumulative-half-away-v1';
const DAY_MS = 86_400_000;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const leap = year => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
const monthDays = (year, month) => [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
function resolvedDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) return null;
  const year = Number(value.slice(0, 4)), month = Number(value.slice(5, 7)), day = Number(value.slice(8));
  if (year < 1 || day > monthDays(year, month)) return null;
  return { value, year, month, day, ordinal: Date.parse(`${value}T00:00:00.000Z`) / DAY_MS };
}
const monthId = (year, month) => `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
const safeNumber = value => value >= -MAX_SAFE && value <= MAX_SAFE ? Number(value) : null;
const label = 'Allocated recurring cost estimate — not actual cash';
function unavailable(code, reason) {
  return Object.freeze({ state: 'unavailable', valuePence: null, portions: Object.freeze([]), code, reason,
    kind: 'allocated-estimate', isActualCash: false, label, methodVersion: MONTHLY_COST_ALLOCATION_METHOD });
}
// Round cumulative boundaries, never daily fractions independently. Applying
// the sign after rounding magnitude makes credit allocations sign-symmetric.
function cumulativeBoundary(amountPence, completedDays, calendarDays) {
  const signed = BigInt(amountPence), magnitude = signed < 0n ? -signed : signed;
  const rounded = (2n * magnitude * BigInt(completedDays) + BigInt(calendarDays)) / (2n * BigInt(calendarDays));
  return signed < 0n ? -rounded : rounded;
}

/**
 * Allocate one explicitly identified cost across an inclusive date range.
 * Supply exactly one selected, complete monthly envelope per intersecting month.
 * Missing data yields null, never zero or a partial amount. Every portion keeps
 * its immutable monthly source amount and exact cumulative rounding boundaries.
 */
export function allocateMonthlyRecurringCost(request) {
  if (!object(request) || !text(request.storeId) || !text(request.costId) ||
    typeof request.currency !== 'string' || !/^[A-Z]{3}$/.test(request.currency)) {
    return unavailable('invalid-scope', 'An exact company, currency and cost identifier are required.');
  }
  const from = resolvedDay(request.from), to = resolvedDay(request.to);
  if (!from || !to || from.ordinal > to.ordinal) return unavailable('invalid-period', 'A valid inclusive business-calendar date range is required.');
  if (!Array.isArray(request.sources)) return unavailable('missing-source', 'Complete selected monthly cost sources are required.');
  const expectedMonths = new Set();
  for (let year = from.year, month = from.month; year < to.year || year === to.year && month <= to.month;) {
    expectedMonths.add(monthId(year, month));
    if (month === 12) { year++; month = 1; } else month++;
  }
  const sources = new Map();
  for (const source of request.sources) {
    if (!object(source) || source.storeId !== request.storeId || source.currency !== request.currency || source.costId !== request.costId) {
      return unavailable('source-scope-mismatch', 'Every monthly source must match the selected company, currency and cost.');
    }
    if (typeof source.month !== 'string' || !expectedMonths.has(source.month)) {
      return unavailable('unexpected-source-month', 'Supply only exact monthly sources intersecting the requested period.');
    }
    if (sources.has(source.month)) return unavailable('ambiguous-source', 'More than one source or version was supplied for a month.');
    if (!text(source.sourceVersionId) || source.selection !== 'selected') {
      return unavailable('unselected-source', 'Each month needs one explicitly selected source version.');
    }
    if (!object(source.classification) || source.classification.type !== 'recurring-monthly' ||
      source.classification.approved !== true || !text(source.classification.approvalId)) {
      return unavailable('unsupported-classification', 'Only explicitly approved recurring monthly costs may be allocated; one-off, order-linked and actual-date costs retain their own dates.');
    }
    const year = Number(source.month.slice(0, 4)), month = Number(source.month.slice(5, 7)), days = monthDays(year, month);
    const sourceFrom = `${source.month}-01`, sourceTo = `${source.month}-${String(days).padStart(2, '0')}`;
    if (!object(source.coverage) || source.coverage.complete !== true || source.coverage.from !== sourceFrom || source.coverage.to !== sourceTo) {
      return unavailable('incomplete-source', 'Monthly source coverage must explicitly cover the complete calendar month.');
    }
    if (!Number.isSafeInteger(source.amountPence)) return unavailable('invalid-money', 'Every source amount must be an explicit safe integer number of pence.');
    sources.set(source.month, { source, calendarDays: days, sourceFrom, sourceTo });
  }
  if ([...expectedMonths].some(month => !sources.has(month))) {
    return unavailable('missing-source', 'At least one intersecting month has no complete selected cost source.');
  }
  let total = 0n;
  const portions = [];
  for (const month of expectedMonths) {
    const { source, calendarDays, sourceFrom, sourceTo } = sources.get(month);
    const portionFrom = month === request.from.slice(0, 7) ? request.from : sourceFrom;
    const portionTo = month === request.to.slice(0, 7) ? request.to : sourceTo;
    const firstDay = Number(portionFrom.slice(8)), lastDay = Number(portionTo.slice(8));
    const start = cumulativeBoundary(source.amountPence, firstDay - 1, calendarDays);
    const end = cumulativeBoundary(source.amountPence, lastDay, calendarDays);
    const portion = end - start;
    total += portion;
    if (safeNumber(portion) === null) return unavailable('money-overflow', 'An allocated portion exceeds safe integer pence.');
    portions.push(Object.freeze({ month, sourceVersionId: source.sourceVersionId, classificationApprovalId: source.classification.approvalId,
      sourceAmountPence: source.amountPence, sourceFrom, sourceTo, from: portionFrom, to: portionTo,
      calendarDays, allocatedDays: lastDay - firstDay + 1, valuePence: Number(portion),
      cumulativeStartPence: Number(start), cumulativeEndPence: Number(end) }));
  }
  if (safeNumber(total) === null) return unavailable('money-overflow', 'The allocated period total exceeds safe integer pence.');
  return Object.freeze({ state: 'supported', valuePence: Number(total), portions: Object.freeze(portions), code: null, reason: null,
    scope: Object.freeze({ storeId: request.storeId, currency: request.currency, costId: request.costId, from: request.from, to: request.to }),
    kind: 'allocated-estimate', isActualCash: false, label, methodVersion: MONTHLY_COST_ALLOCATION_METHOD });
}

/** Exactly one complete Monday–Sunday bucket; cross-month buckets use both sources. */
export function allocateCompleteMondaySundayWeek(request) {
  const from = resolvedDay(request?.from), to = resolvedDay(request?.to);
  const weekday = ordinal => ((ordinal + 4) % 7 + 7) % 7;
  if (!from || !to || weekday(from.ordinal) !== 1 || weekday(to.ordinal) !== 0 || to.ordinal - from.ordinal !== 6) {
    return unavailable('invalid-week', 'A complete Monday–Sunday seven-calendar-day bucket is required.');
  }
  return allocateMonthlyRecurringCost(request);
}
