import test from 'node:test';
import assert from 'node:assert/strict';
import {requestedReportingRange} from './reportingRange.ts';
import {DEFAULT_REPORTING_SELECTION as initial} from './reportingSelection.ts';

test('monthly ranges are complete calendar months, not fixed day approximations',()=>{
 assert.deepEqual(requestedReportingRange({...initial,month:'2024-02-01',period:'last-month',view:'monthly'}),{from:'2024-02-01',to:'2024-02-29',description:'1 complete calendar month'});
 assert.equal(requestedReportingRange({...initial,month:'2026-01-01',period:3,view:'monthly'})?.from,'2025-11-01');
});
test('weekly ranges end on the latest complete Sunday within the selected ending month',()=>{
 const r=requestedReportingRange({...initial,month:'2026-10-01',period:3,view:'weekly'})!;
 assert.equal(r.from,'2026-07-27');assert.equal(r.to,'2026-10-25');
 assert.equal((Date.parse(r.to)-Date.parse(r.from))/86400000+1,91);
 assert.equal(requestedReportingRange({...initial,month:'2026-03-01',period:'last-week',view:'weekly'})?.from,'2026-03-23');
});
test('no chosen month means no invented reporting dates',()=>{
 assert.equal(requestedReportingRange(initial),null);
 assert.equal(requestedReportingRange({...initial,month:'2026-13-01'}),null);
});
