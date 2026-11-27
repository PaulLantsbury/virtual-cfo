import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateMonthlyRecurringCost as allocate, allocateCompleteMondaySundayWeek as week, MONTHLY_COST_ALLOCATION_METHOD } from './monthly-cost-allocation.mjs';

const scope = { storeId: 'generated-company', currency: 'GBP', costId: 'approved-software-cost' };
const daysIn = month => new Date(`${month}-01T00:00:00Z`).getUTCMonth() === 1
  ? ((+month.slice(0, 4) % 4 === 0 && (+month.slice(0, 4) % 100 !== 0 || +month.slice(0, 4) % 400 === 0)) ? 29 : 28)
  : [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][+month.slice(5) - 1];
const source = (month, amountPence, overrides = {}) => ({ ...scope, month, sourceVersionId: `generated-version-${month}`, selection: 'selected',
  classification: { type: 'recurring-monthly', approved: true, approvalId: 'explicit-recurring-classification-v1' },
  coverage: { from: `${month}-01`, to: `${month}-${daysIn(month)}`, complete: true }, amountPence, ...overrides });
const request = (from, to, sources) => ({ ...scope, from, to, sources });
const value = result => { assert.equal(result.state, 'supported', result.reason); return result.valuePence; };

test('complete months preserve exact monthly totals and immutable source provenance', () => {
  for (const month of ['2026-01', '2026-02', '2024-02', '2026-04']) {
    const input = request(`${month}-01`, `${month}-${daysIn(month)}`, [source(month, 12345)]);
    const before = JSON.stringify(input);
    const result = allocate(input);
    assert.equal(value(result), 12345);
    assert.equal(JSON.stringify(input), before);
    assert.equal(result.portions[0].sourceAmountPence, 12345);
    assert.equal(result.portions[0].cumulativeStartPence, 0);
    assert.equal(result.portions[0].cumulativeEndPence, 12345);
    assert.equal(result.portions[0].sourceVersionId, `generated-version-${month}`);
    assert.equal(result.methodVersion, MONTHLY_COST_ALLOCATION_METHOD);
    assert.equal(result.kind, 'allocated-estimate');
    assert.equal(result.isActualCash, false);
    assert.match(result.label, /not actual cash/);
    assert.equal(Object.isFrozen(result.portions[0]), true);
  }
});

test('daily boundaries and arbitrary month partitions add back exactly, including fractional pennies', () => {
  for (const month of ['2026-01', '2026-02', '2024-02', '2026-04']) {
    for (const amount of [0, 1, 2, 17, 10000, -1, -17, -10000, Number.MAX_SAFE_INTEGER]) {
      const sources = [source(month, amount)], days = daysIn(month);
      let daily = 0n;
      for (let day = 1; day <= days; day++) {
        const date = `${month}-${String(day).padStart(2, '0')}`;
        const allocated = value(allocate(request(date, date, sources)));
        assert.ok(Number.isSafeInteger(allocated));
        assert.ok(amount < 0 ? allocated <= 0 : allocated >= 0);
        daily += BigInt(allocated);
      }
      assert.equal(daily, BigInt(amount));
      for (const cut of [1, 7, 13, days - 1]) {
        const first = value(allocate(request(`${month}-01`, `${month}-${String(cut).padStart(2, '0')}`, sources)));
        const second = value(allocate(request(`${month}-${String(cut + 1).padStart(2, '0')}`, `${month}-${days}`, sources)));
        assert.equal(BigInt(first) + BigInt(second), BigInt(amount));
      }
    }
  }
});

test('exact half-penny ties round cumulative magnitude away from zero and preserve credit symmetry', () => {
  const positive = [source('2026-04', 1)], credit = [source('2026-04', -1)];
  assert.equal(value(allocate(request('2026-04-01', '2026-04-14', positive))), 0);
  assert.equal(value(allocate(request('2026-04-15', '2026-04-15', positive))), 1);
  assert.equal(value(allocate(request('2026-04-15', '2026-04-15', credit))), -1);
  assert.equal(value(allocate(request('2026-04-16', '2026-04-30', positive))), 0);
});

test('complete Monday–Sunday buckets spanning months combine both month rates without changing either total', () => {
  const sources = [source('2026-01', 10000), source('2026-02', 10000)];
  const result = week(request('2026-01-26', '2026-02-01', sources));
  assert.equal(value(result), 2292);
  assert.deepEqual(result.portions.map(p => [p.month, p.allocatedDays, p.calendarDays, p.valuePence]), [
    ['2026-01', 6, 31, 1935], ['2026-02', 1, 28, 357],
  ]);
  assert.equal(result.portions.reduce((sum, p) => sum + p.valuePence, 0), result.valuePence);
  assert.deepEqual(result.portions.map(p => p.sourceAmountPence), [10000, 10000]);
  const whole = value(allocate(request('2026-01-01', '2026-02-28', sources)));
  const left = value(allocate(request('2026-01-01', '2026-01-25', [sources[0]])));
  const right = value(allocate(request('2026-02-02', '2026-02-28', [sources[1]])));
  assert.equal(left + result.valuePence + right, whole);
});

test('leap years and DST weeks use calendar days, never elapsed-hour weights', () => {
  assert.equal(value(allocate(request('2024-02-29', '2024-02-29', [source('2024-02', 2900)]))), 100);
  assert.equal(allocate(request('2026-02-29', '2026-02-29', [source('2026-02', 2800)])).state, 'unavailable');
  assert.equal(value(week(request('2026-03-23', '2026-03-29', [source('2026-03', 3100)]))), 700);
  assert.equal(value(week(request('2026-10-19', '2026-10-25', [source('2026-10', 3100)]))), 700);
  assert.equal(value(allocate(request('2000-02-29', '2000-02-29', [source('2000-02', 2900)]))), 100);
  assert.equal(allocate(request('1900-02-29', '1900-02-29', [source('1900-02', 2800)])).state, 'unavailable');
});

test('missing month, amount or coverage is unavailable rather than a zero or partial result', () => {
  const valid = source('2026-01', 3100);
  for (const input of [
    request('2026-01-26', '2026-02-01', [valid]),
    request('2026-01-01', '2026-01-31', [source('2026-01', null)]),
    request('2026-01-01', '2026-01-31', [source('2026-01', 0, { coverage: { from: '2026-01-01', to: '2026-01-30', complete: true } })]),
    request('2026-01-01', '2026-01-31', [source('2026-01', 0, { coverage: { from: '2026-01-01', to: '2026-01-31', complete: false } })]),
  ]) {
    const result = allocate(input);
    assert.equal(result.state, 'unavailable'); assert.equal(result.valuePence, null); assert.deepEqual(result.portions, []);
  }
  assert.equal(value(allocate(request('2026-01-01', '2026-01-31', [source('2026-01', 0)]))), 0);
});

test('scope, currency, cost and selected-source ambiguity fail closed', () => {
  for (const overrides of [{ storeId: 'another-company' }, { currency: 'USD' }, { costId: 'another-cost' }, { sourceVersionId: '' }, { selection: 'withdrawn' }]) {
    const result = allocate(request('2026-01-01', '2026-01-31', [source('2026-01', 3100, overrides)]));
    assert.equal(result.state, 'unavailable'); assert.equal(result.valuePence, null);
  }
  const duplicate = allocate(request('2026-01-01', '2026-01-31', [source('2026-01', 3100), source('2026-01', 3100)]));
  assert.equal(duplicate.code, 'ambiguous-source');
  const competing = allocate(request('2026-01-01', '2026-01-31', [source('2026-01', 3100), source('2026-01', 3100, { sourceVersionId: 'other-version' })]));
  assert.equal(competing.code, 'ambiguous-source');
});

test('one-off, order-linked, actual-date and unapproved classifications are not spread', () => {
  for (const classification of [null, { type: 'recurring-monthly', approved: false, approvalId: 'not-approved' },
    { type: 'recurring-monthly', approved: true, approvalId: '' },
    ...['one-off', 'order-linked', 'actual-date'].map(type => ({ type, approved: true, approvalId: 'explicit-other-basis' }))]) {
    const result = allocate(request('2026-01-01', '2026-01-31', [source('2026-01', 3100, { classification })]));
    assert.equal(result.code, 'unsupported-classification'); assert.equal(result.valuePence, null);
  }
});

test('unsafe money and cross-month overflow reject, while exact safe credit cancellation works', () => {
  for (const amount of [Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1, NaN, Infinity, 1.5, '100', undefined]) {
    assert.equal(allocate(request('2026-01-01', '2026-01-31', [source('2026-01', amount)])).code, 'invalid-money');
  }
  assert.equal(allocate(request('2026-01-01', '2026-02-28', [source('2026-01', Number.MAX_SAFE_INTEGER), source('2026-02', 1)])).code, 'money-overflow');
  assert.equal(allocate(request('2026-01-01', '2026-02-28', [source('2026-01', Number.MIN_SAFE_INTEGER), source('2026-02', -1)])).code, 'money-overflow');
  assert.equal(value(allocate(request('2026-01-01', '2026-03-31', [source('2026-01', Number.MAX_SAFE_INTEGER), source('2026-02', Number.MAX_SAFE_INTEGER), source('2026-03', -Number.MAX_SAFE_INTEGER)]))), Number.MAX_SAFE_INTEGER);
});

test('date validation rejects timestamps, invalid days and non-complete weekly buckets', () => {
  for (const from of ['2026-01-01T00:00:00Z', '2026-01-32', '2026-13-01', '0000-01-01', '', null]) {
    assert.equal(allocate(request(from, '2026-01-31', [source('2026-01', 3100)])).state, 'unavailable');
  }
  assert.equal(allocate(request('2026-01-31', '2026-01-01', [source('2026-01', 3100)])).code, 'invalid-period');
  for (const [from, to] of [['2026-01-27', '2026-02-02'], ['2026-01-26', '2026-01-31'], ['2026-01-26', '2026-02-08']]) {
    assert.equal(week(request(from, to, [source('2026-01', 3100), source('2026-02', 2800)])).code, 'invalid-week');
  }
  assert.equal(allocate(undefined).state, 'unavailable');
  assert.equal(week(undefined).code, 'invalid-week');
});
