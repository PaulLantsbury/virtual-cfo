import test from 'node:test';
import assert from 'node:assert/strict';
import {requestedReportingRange,reportingRangeLabel,reportingSourceMonth,monthlyRangeSupported,reportingLondonToday,validReportingDate} from './reportingRange.ts';
import {DEFAULT_REPORTING_SELECTION as initial} from './reportingSelection.ts';
const now=new Date('2026-11-27T15:00:00Z');

test('presets follow the London clock and ignore an old saved ending month',()=>{
 assert.deepEqual(requestedReportingRange({...initial,month:'2024-02-01',period:'last-month',view:'monthly'},now),{from:'2026-10-01',to:'2026-10-31',description:'1 complete calendar month'});
 assert.deepEqual(requestedReportingRange({...initial,period:'last-week',view:'weekly'},now),{from:'2026-11-16',to:'2026-11-22',description:'1 complete Monday–Sunday week'});
 assert.equal(reportingSourceMonth({...initial,period:'last-month'},now),'2026-10-01');
 assert.match(reportingRangeLabel({...initial,period:'last-month'},now),/^Last month/);
});
test('monthly spans use actual calendar boundaries including leap February and year rollover',()=>{
 const monthly={...initial,period:'last-month' as const,view:'monthly' as const};
 assert.equal(requestedReportingRange(monthly,new Date('2024-03-15T12:00:00Z'))?.to,'2024-02-29');
 assert.equal(requestedReportingRange({...monthly,period:3},new Date('2026-02-15T12:00:00Z'))?.from,'2025-11-01');
 assert.equal(requestedReportingRange({...monthly,period:12},now)?.from,'2025-11-01');
});
test('weekly rolling windows exclude the current incomplete week, including Sunday itself',()=>{
 const r=requestedReportingRange({...initial,period:3,view:'weekly'},now)!;
 assert.equal(r.from,'2026-08-24');assert.equal(r.to,'2026-11-22');
 assert.equal((Date.parse(r.to)-Date.parse(r.from))/86400000+1,91);
 assert.equal(requestedReportingRange({...initial,period:'last-week'},new Date('2026-11-22T23:00:00Z'))?.to,'2026-11-15');
 assert.equal(requestedReportingRange({...initial,period:'last-week'},new Date('2026-11-23T00:00:00Z'))?.to,'2026-11-22');
});
test('London local dates govern midnight and DST, not UTC or device locale',()=>{
 const time=new Date('2026-03-31T23:30:00Z');
 assert.equal(reportingLondonToday(time),'2026-04-01');
 assert.equal(requestedReportingRange({...initial,period:'last-month',view:'monthly'},time)?.from,'2026-03-01');
 assert.equal(reportingLondonToday(new Date('2026-10-25T00:30:00Z')),'2026-10-25');
 assert.equal(reportingLondonToday(new Date(NaN)),'');
});
test('custom range is exact and partial-month sources cannot pass monthly adapter guard',()=>{
 const s={...initial,period:'custom' as const,view:'monthly' as const,customFrom:'2026-09-03',customTo:'2026-09-17'};
 assert.deepEqual(requestedReportingRange(s,now),{from:'2026-09-03',to:'2026-09-17',description:'Custom dates'});
 assert.equal(reportingSourceMonth(s,now),'2026-09-01');assert.equal(monthlyRangeSupported(s,now),false);
 assert.equal(monthlyRangeSupported({...s,customFrom:'2026-09-01',customTo:'2026-09-30'},now),true);
 assert.equal(monthlyRangeSupported({...s,customFrom:'2026-09-01',customTo:'2026-09-30',view:'weekly'},now),false);
 assert.equal(monthlyRangeSupported({...s,customFrom:'2026-09-01',customTo:'2026-10-31'},now),false);
});
test('custom future, malformed, empty, reversed or impossible dates fail closed',()=>{
 const s={...initial,period:'custom' as const,customFrom:'2026-10-01',customTo:'2026-10-31'};
 for(const pair of [['',''],['2026-02-30','2026-03-01'],['2026-11-28','2026-11-29'],['2026-10-31','2026-10-01'],['2026-10-01T12:00:00Z','2026-10-31']]){
  const invalid={...s,customFrom:pair[0],customTo:pair[1]};assert.equal(requestedReportingRange(invalid,now),null);assert.equal(reportingSourceMonth(invalid,now),'');assert.equal(monthlyRangeSupported(invalid,now),false);
 }
 assert.equal(validReportingDate('0000-01-01'),false);assert.equal(validReportingDate('2024-02-29'),true);assert.equal(validReportingDate('2023-02-29'),false);
});
test('year 1–99 boundaries do not silently turn into 1900s',()=>{
 const s={...initial,period:'custom' as const,view:'monthly' as const,customFrom:'0099-02-01',customTo:'0099-02-28'};
 assert.equal(reportingSourceMonth(s,now),'0099-02-01');assert.equal(monthlyRangeSupported(s,now),true);
});
