import test from 'node:test';
import assert from 'node:assert/strict';
import {parseStoreReporting,storeReportingPeriod} from './storeReporting.ts';
test('settings require matching store, valid timezone and supported minor-unit scale',()=>{
 const r={id:'A',currency_code:'USD',timezone:'America/New_York'};
 assert.equal(parseStoreReporting(r,'A').currency,'USD');
 for(const row of [null,{...r,id:'B'},{...r,currency_code:'XYZ'},{...r,currency_code:'JPY'},{...r,currency_code:'KWD'},{...r,timezone:'Unknown/Place'},{...r,timezone:null}]) assert.throws(()=>parseStoreReporting(row,'A'));
});
test('same instant selects the completed month in the store timezone',()=>{
 const now=new Date('2026-09-01T00:30:00Z');
 assert.equal(storeReportingPeriod('last_complete_month','Europe/London',0,now).dateFrom,'2026-08-01');
 assert.equal(storeReportingPeriod('last_complete_month','America/Los_Angeles',0,now).dateFrom,'2026-07-01');
});
test('completed weeks respect store-local Monday and DST',()=>{
 const now=new Date('2026-03-30T00:30:00Z');
 assert.equal(storeReportingPeriod('last_complete_week','Europe/London',0,now).dateTo,'2026-03-29');
 assert.equal(storeReportingPeriod('last_complete_week','America/Los_Angeles',0,now).dateTo,'2026-03-22');
});
