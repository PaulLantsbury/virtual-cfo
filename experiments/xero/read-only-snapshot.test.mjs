import test from 'node:test';import assert from 'node:assert/strict';import {readFixedXeroSnapshot,readXeroSnapshotDate} from './read-only-snapshot.mjs';
test('fixed snapshot uses only five pinned GET endpoints with tenant binding',async()=>{const calls=[];const out=await readFixedXeroSnapshot({accessToken:'a'.repeat(20),tenantId:'t-1',date:'2026-09-17',fetchImpl:async(u,o)=>{calls.push([u.toString(),o]);return new Response(JSON.stringify({ok:true}));}});assert.equal(calls.length,5);assert.ok(calls.every(([,o])=>o.method==='GET'&&o.headers['xero-tenant-id']==='t-1'&&o.redirect==='error'));assert.match(calls[1][0],/ProfitAndLoss\?date=2026-09-17/);assert.match(calls[4][0],/BankSummary\?toDate=2026-09-17/);assert.equal(out.date,'2026-09-17');});
test('invalid scopes and upstream errors fail safely',async()=>{await assert.rejects(readFixedXeroSnapshot({accessToken:'x',tenantId:'t',date:'bad'}),/invalid/);await assert.rejects(readFixedXeroSnapshot({accessToken:'a'.repeat(20),tenantId:'tenant-secret',date:'2026-09-17',fetchImpl:async()=>new Response('secret response body',{status:403})}),error=>{assert.equal(error.message,'Xero snapshot unavailable');assert.deepEqual({phase:error.safePhase,reason:error.safeReason},{phase:'organisation',reason:'forbidden'});assert.deepEqual(Object.keys(error),['safePhase','safeReason']);assert.doesNotMatch(JSON.stringify(error),/secret|tenant/i);return true;});});
test('diagnostics use only bounded phase and reason enums',async()=>{
 const cases=[
  {at:0,result:()=>{throw Error('socket leaked-value')},phase:'organisation',reason:'network_failure'},
  {at:1,result:()=>new Response('token leaked-value',{status:401}),phase:'profit_and_loss',reason:'unauthorized'},
  {at:2,result:()=>new Response('id leaked-value',{status:429}),phase:'balance_sheet',reason:'rate_limited'},
  {at:3,result:()=>new Response('amount leaked-value',{status:503}),phase:'trial_balance',reason:'upstream_unavailable'},
  {at:4,result:()=>new Response('{not json',{status:200}),phase:'bank_summary',reason:'malformed_response'}
 ];
 for(const item of cases){let call=0;await assert.rejects(readFixedXeroSnapshot({accessToken:'a'.repeat(20),tenantId:'private-tenant-id',date:'2026-09-17',fetchImpl:async()=>call++===item.at?item.result():new Response('{}')}),error=>{assert.equal(error.message,'Xero snapshot unavailable');assert.equal(error.safePhase,item.phase);assert.equal(error.safeReason,item.reason);const exposed=JSON.stringify(error);assert.doesNotMatch(exposed,/leaked-value|private-tenant-id|Bearer|amount|token/i);return true;});}
});
test('snapshot date must be explicit, real, and no later than today',()=>{
 assert.equal(readXeroSnapshotDate('2026-09-18',{today:'2026-09-18'}),'2026-09-18');
 for(const value of [undefined,'2026-02-30','2026-09-19','2026-9-18'])assert.throws(()=>readXeroSnapshotDate(value,{today:'2026-09-18'}),/invalid/);
});
