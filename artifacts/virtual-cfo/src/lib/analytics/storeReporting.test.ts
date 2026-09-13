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

test('custom dates validate the real calendar and retain explicitly valid zero-length ranges', async () => {
 const {isValidReportingDate,isValidReportingRange}=await import('./storeReporting.ts');
 for(const date of ['2024-02-29','2000-02-29','2026-02-28','2026-04-30','2026-12-31']) assert.equal(isValidReportingDate(date),true,date);
 for(const date of ['2026-02-29','1900-02-29','2026-04-31','2026-00-01','2026-13-01','2026-01-00','0000-01-01','2026-9-01','2026-09-1','2026-09-01T00:00:00Z',' 2026-09-01','']) assert.equal(isValidReportingDate(date),false,date);
 assert.equal(isValidReportingRange('2026-03-05','2026-03-05'),true);
 assert.equal(isValidReportingRange('2026-03-01','2026-03-31'),true);
 assert.equal(isValidReportingRange('2026-04-01','2026-03-31'),false);
 assert.equal(isValidReportingRange('2026-02-30','2026-03-31'),false);
});

test('persisted selections accept known modes and preserve invalid custom drafts without fallback', async()=>{
 const {parseSalesReportingSelection}=await import('./storeReporting.ts');
 assert.deepEqual(parseSalesReportingSelection({mode:'last_complete_month'}),{mode:'last_complete_month'});
 assert.deepEqual(parseSalesReportingSelection({mode:'last_complete_week'}),{mode:'last_complete_week'});
 assert.deepEqual(parseSalesReportingSelection({mode:'custom',from:'2026-02-30',to:''}),{mode:'custom',from:'2026-02-30',to:''});
 for(const value of [null,{},'last_complete_month',{mode:'unknown'},{mode:'custom',from:1,to:'2026-02-01'}]) assert.equal(parseSalesReportingSelection(value),null);
});

test('corrupt saved period withholds figures until a new selection is made', async()=>{
 const {restoreSalesReportingSelection}=await import('./storeReporting.ts');
 assert.deepEqual(restoreSalesReportingSelection(null),{mode:'last_complete_month'});
 assert.deepEqual(restoreSalesReportingSelection('{"mode":"last_complete_week"}'),{mode:'last_complete_week'});
 for(const value of ['{broken','null','{}','{"mode":"unknown"}','{"mode":"custom","from":42,"to":"2026-01-01"}']) {
  assert.deepEqual(restoreSalesReportingSelection(value),{mode:'custom',from:'',to:''});
 }
});
