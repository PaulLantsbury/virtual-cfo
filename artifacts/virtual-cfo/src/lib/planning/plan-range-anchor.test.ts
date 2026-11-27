import test from 'node:test';
import assert from 'node:assert/strict';
import {planBaselineMonthForRange} from './plan-range-anchor.ts';

test('weekly/partial ending dates use the last already complete month',()=>{
  assert.equal(planBaselineMonthForRange({from:'2026-11-16',to:'2026-11-22'}),'2026-10-01');
  assert.equal(planBaselineMonthForRange({from:'2026-10-01',to:'2026-10-17'}),'2026-09-01');
  assert.equal(planBaselineMonthForRange({from:'2026-01-01',to:'2026-01-15'}),'2025-12-01');
});
test('complete ending months remain the baseline anchor regardless of range start',()=>{
  assert.equal(planBaselineMonthForRange({from:'2026-08-01',to:'2026-10-31'}),'2026-10-01');
  assert.equal(planBaselineMonthForRange({from:'2026-10-12',to:'2026-10-31'}),'2026-10-01');
  assert.equal(planBaselineMonthForRange({from:'2026-11-01',to:'2026-11-30'}),'2026-11-01');
});
test('leap/calendar boundaries do not read the unseen remainder of February',()=>{
  assert.equal(planBaselineMonthForRange({from:'2024-02-01',to:'2024-02-28'}),'2024-01-01');
  assert.equal(planBaselineMonthForRange({from:'2024-02-01',to:'2024-02-29'}),'2024-02-01');
  assert.equal(planBaselineMonthForRange({from:'2025-02-01',to:'2025-02-28'}),'2025-02-01');
});
test('missing, invalid or reversed dates cannot choose a baseline',()=>{
  for (const range of [null,{from:'',to:''},{from:'2026-03-01',to:'2026-02-28'},{from:'2026-02-01',to:'2026-02-30'},{from:'0001-01-01',to:'0001-01-15'}]) assert.equal(planBaselineMonthForRange(range),'');
});
