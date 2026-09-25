import test from 'node:test';
import assert from 'node:assert/strict';
import {readFixedXeroPeriodSnapshot} from './read-only-period-snapshot.mjs';

test('period snapshot applies bounded period and point-in-time parameters',async()=>{
 const calls=[];
 const snapshot=await readFixedXeroPeriodSnapshot({accessToken:'a'.repeat(20),tenantId:'tenant-test',from:'2026-09-01',to:'2026-09-25',fetchImpl:async(url,options)=>{calls.push([url.toString(),options]);return new Response('{}');}});
 assert.equal(calls.length,5);
 assert.ok(calls.every(([,options])=>options.method==='GET'&&options.redirect==='error'&&options.headers['xero-tenant-id']==='tenant-test'));
 assert.match(calls[0][0],/Organisation$/);
 assert.match(calls[1][0],/ProfitAndLoss\?fromDate=2026-09-01&toDate=2026-09-25$/);
 assert.match(calls[2][0],/BalanceSheet\?date=2026-09-25$/);
 assert.match(calls[3][0],/TrialBalance\?date=2026-09-25$/);
 assert.match(calls[4][0],/BankSummary\?fromDate=2026-09-01&toDate=2026-09-25$/);
 assert.deepEqual({date:snapshot.date,from:snapshot.from,to:snapshot.to},{date:'2026-09-25',from:'2026-09-01',to:'2026-09-25'});
});

test('period snapshot rejects malformed, reversed and future scopes before networking',async()=>{
 for(const scope of [{from:'bad',to:'2026-09-25'},{from:'2026-09-26',to:'2026-09-25'},{from:'2999-01-01',to:'2999-01-02'}]){
  await assert.rejects(readFixedXeroPeriodSnapshot({accessToken:'a'.repeat(20),tenantId:'tenant-test',...scope,fetchImpl:()=>{throw Error('must not fetch');}}),/invalid/);
 }
});

test('period diagnostics expose only bounded phase and reason enums',async()=>{
 const diagnostics=[];
 await assert.rejects(readFixedXeroPeriodSnapshot({accessToken:'private-token-value',tenantId:'private-tenant',from:'2026-09-01',to:'2026-09-25',diagnose:value=>diagnostics.push(value),fetchImpl:async url=>url.pathname.endsWith('/Reports/TrialBalance')?new Response('private-body',{status:403}):new Response('{}')}),/unavailable/);
 assert.deepEqual(diagnostics,[{event:'xero_source_refresh_failed',phase:'trial_balance',reason:'forbidden'}]);
 assert.doesNotMatch(JSON.stringify(diagnostics),/private|token|tenant|body|2026/);
});
