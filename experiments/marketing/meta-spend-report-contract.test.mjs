import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMetaSpendReport} from './meta-spend-report-contract.mjs';
const storeId='11111111-1111-4111-8111-111111111111';
const connectionId='22222222-2222-4222-8222-222222222222';
const from='2026-10-01',to=from;
const day={date:from,coverageState:'provider_row',spendMinor:'12345',observedAt:'2026-10-02T09:00:00Z',runId:connectionId,runStatus:'complete',runStartedAt:'2026-10-02T08:59:00Z'};
const base={status:'available',storeId,from,to,account:{providerAccountId:'123456',currency:'GBP',timeZone:'Europe/London'},days:[day],lineage:{storeId,accountId:'123456',connectionId,from,to,version:`sha256:${'a'.repeat(64)}`},connectionState:'expired',reauthorizationRequired:true,evidenceAvailability:'available',observationFreshness:'unknown'};
test('wire preserves exact expired saved evidence and does not claim freshness',()=>{
 const result=parseMetaSpendReport(base,storeId,from,to);
 assert.deepEqual(result,base);assert.notEqual(result.days,base.days);
 assert.equal(result.days[0].spendMinor,'12345');
 const empty={...base,evidenceAvailability:'unavailable',days:[{...day,coverageState:'not_collected',spendMinor:null,observedAt:null,runId:null,runStatus:null,runStartedAt:null}]};
 assert.equal(parseMetaSpendReport(empty,storeId,from,to).evidenceAvailability,'unavailable');
});
test('wire fails closed for missing lineage, revoked state, mismatched authority and invented freshness',()=>{
 for(const mutate of [v=>delete v.lineage,v=>v.lineage.connectionId='wrong',v=>v.lineage.version='guess',v=>v.lineage.storeId=connectionId,v=>v.lineage.accountId='654321',v=>v.lineage.to='2026-10-02',v=>v.connectionState='revoked',v=>v.reauthorizationRequired=false,v=>v.observationFreshness='current',v=>v.account.currency='not-currency',v=>v.account.timeZone='made-up',v=>v.credential='secret',v=>v.days[0].extra='secret',v=>v.days[0].observedAt=null]){
  const value=structuredClone(base);mutate(value);assert.throws(()=>parseMetaSpendReport(value,storeId,from,to));
 }
 assert.throws(()=>parseMetaSpendReport(base,connectionId,from,to));
 assert.throws(()=>parseMetaSpendReport(base,storeId,from,'2026-10-02'));
});
test('withheld response cannot retain any old account or metadata',()=>{
 const withheld={status:'not_connected',storeId,from,to,account:null,days:[]};
 assert.deepEqual(parseMetaSpendReport(withheld,storeId,from,to),withheld);
 assert.throws(()=>parseMetaSpendReport({...withheld,lineage:base.lineage},storeId,from,to));
 assert.throws(()=>parseMetaSpendReport({...withheld,days:base.days},storeId,from,to));
});
