import test from 'node:test';
import assert from 'node:assert/strict';
import {reportingComparisonRange} from './reportingComparisonRange.ts';
import {DEFAULT_REPORTING_SELECTION,type ReportingSelection} from './reportingSelection.ts';
const now=new Date('2026-11-27T12:00:00Z');
const selection=(patch:Partial<ReportingSelection>):ReportingSelection=>({...DEFAULT_REPORTING_SELECTION,comparison:'custom',comparisonMonth:'2026-09-01',...patch});
const weekday=(s:string)=>new Date(s+'T12:00:00Z').getUTCDay();
test('custom weekly comparison uses a complete Monday–Sunday week before a midweek month end',()=>{
 const r=reportingComparisonRange(selection({period:'last-week',view:'weekly'}),now);assert.ok(r);
 assert.deepEqual({from:r.from,to:r.to},{from:'2026-09-21',to:'2026-09-27'});assert.equal(weekday(r.from),1);assert.equal(weekday(r.to),0);
});
test('multi-week custom comparison retains all thirteen full weeks and aligns both weekdays',()=>{
 const r=reportingComparisonRange(selection({period:3,view:'weekly',comparisonMonth:'2026-07-01'}),now);assert.ok(r);
 assert.deepEqual({from:r.from,to:r.to},{from:'2026-04-27',to:'2026-07-26'});assert.equal(weekday(r.from),1);assert.equal(weekday(r.to),0);
 assert.equal((Date.parse(r.to)-Date.parse(r.from))/86400000+1,91);
});
test('a Sunday month end is included rather than unnecessarily losing another week',()=>{
 const r=reportingComparisonRange(selection({period:'last-week',view:'weekly',comparisonMonth:'2026-05-01'}),now);assert.ok(r);
 assert.deepEqual({from:r.from,to:r.to},{from:'2026-05-25',to:'2026-05-31'});
});
test('monthly comparisons retain complete calendar months instead of weekly alignment',()=>{
 const single=reportingComparisonRange(selection({period:'last-month',view:'monthly'}),now);assert.ok(single);
 assert.deepEqual({from:single.from,to:single.to},{from:'2026-09-01',to:'2026-09-30'});
 const quarter=reportingComparisonRange(selection({period:3,view:'monthly',comparisonMonth:'2026-06-01'}),now);assert.ok(quarter);
 assert.deepEqual({from:quarter.from,to:quarter.to},{from:'2026-04-01',to:'2026-06-30'});
});
test('same-week last year preserves weekdays and overlapping comparisons stay unavailable',()=>{
 const year=reportingComparisonRange(selection({period:'last-week',view:'weekly',comparison:'last-year'}),now);assert.ok(year);
 assert.deepEqual({from:year.from,to:year.to},{from:'2025-11-17',to:'2025-11-23'});
 assert.equal(reportingComparisonRange(selection({period:'last-week',view:'weekly',comparisonMonth:'2026-11-01'}),now),null);
 assert.equal(reportingComparisonRange(selection({period:3,view:'monthly',comparison:'none'}),now),null);
 assert.equal(reportingComparisonRange(selection({period:3,view:'monthly',comparison:'rolling'}),now),null);
});
