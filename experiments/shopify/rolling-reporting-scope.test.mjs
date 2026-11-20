import test from 'node:test';
import assert from 'node:assert/strict';
import {rollingReportingScope} from './rolling-reporting-scope.mjs';
const scope = (now, timezone='Europe/London') => rollingReportingScope({now,timezone});

test('31 completed local dates are inclusive and exclude today', () => {
  assert.deepEqual(scope('2026-09-19T01:00:00Z'), {from:'2026-08-19',to:'2026-09-18',localDate:'2026-09-19',timezone:'Europe/London',calendarDays:31});
  assert.deepEqual(scope('2026-09-19T02:00:00+01:00'),scope('2026-09-19T01:00:00.000Z'));
  assert.ok(Object.isFrozen(scope('2026-09-19T01:00:00Z')));
});

test('local midnight rather than UTC midnight determines the date', () => {
  assert.equal(scope('2026-09-18T22:59:59.999Z').to,'2026-09-17');
  assert.equal(scope('2026-09-18T23:00:00Z').to,'2026-09-18');
  assert.equal(scope('2026-09-19T00:00:00Z','America/Los_Angeles').to,'2026-09-17');
  assert.equal(scope('2026-09-18T10:00:00Z','Pacific/Kiritimati').to,'2026-09-18');
});

test('spring and autumn DST use calendar dates without hour drift', () => {
  for (const now of ['2026-03-29T00:30:00Z','2026-03-29T01:30:00Z']) {
    assert.equal(scope(now).from,'2026-02-26');assert.equal(scope(now).to,'2026-03-28');
  }
  for (const now of ['2026-10-25T00:30:00Z','2026-10-25T01:30:00Z']) {
    assert.equal(scope(now).from,'2026-09-24');assert.equal(scope(now).to,'2026-10-24');
  }
  assert.equal(scope('2026-03-29T23:00:00Z').to,'2026-03-29');
  assert.equal(scope('2026-10-25T23:00:00Z').to,'2026-10-24');
});

test('leap, month and year boundaries retain exactly 31 calendar dates', () => {
  for (const [now,from,to] of [
    ['2024-03-01T02:00:00Z','2024-01-30','2024-02-29'],
    ['2026-03-01T02:00:00Z','2026-01-29','2026-02-28'],
    ['2027-01-01T02:00:00Z','2026-12-01','2026-12-31'],
    ['2026-05-01T02:00:00Z','2026-03-31','2026-04-30'],
  ]) {
    const result=scope(now);assert.equal(result.from,from);assert.equal(result.to,to);
    assert.equal((Date.parse(to)-Date.parse(from))/86_400_000+1,31);
  }
});

test('missed days select only the next window without replay or scope expansion', () => {
  assert.equal(scope('2026-09-19T01:00:00Z').to,'2026-09-18');
  assert.deepEqual(scope('2026-09-22T01:00:00Z'),{from:'2026-08-22',to:'2026-09-21',localDate:'2026-09-22',timezone:'Europe/London',calendarDays:31});
});

test('invalid, ambiguous and unknown-offset inputs fail closed', () => {
  for (const now of [undefined,null,0,new Date(),'', '2026-09-19','2026-09-19T02:00:00','2026-02-29T02:00:00Z','2026-04-31T02:00:00Z','2026-09-19T24:00:00Z','2026-09-19T02:60:00Z','2026-09-19T02:00:60Z','2026-09-19T02:00:00-00:00','2026-09-19T02:00:00+14:01','2026-09-19T02:00:00+25:00','2026-09-19T02:00:00+01:60','2026-09-19T02:00:00.0001Z','0000-09-19T02:00:00Z','0001-01-01T02:00:00Z']) assert.throws(()=>scope(now));
  for (const timezone of [undefined,null,'','Europe/Unknown',' Europe/London','+01:00']) assert.throws(()=>rollingReportingScope({now:'2026-09-19T02:00:00Z',timezone}));
  assert.throws(()=>rollingReportingScope());
  assert.equal(scope('2026-09-19T02:00:00+00:00','UTC').to,'2026-09-18');
});
