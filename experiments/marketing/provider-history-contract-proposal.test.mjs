import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeHistoryContract} from './provider-history-contract-proposal.ts';
const lineage = {storeId:'fictional-store',accountId:'fictional-account',connectionId:'fictional-connection',from:'2026-10-01',to:'2026-10-02',version:'fixture-v1'};
const days = [{date:'2026-10-01',amountMinor:'1200',observedAt:'2026-10-03T09:00:00Z',runId:'fixture-run',coverage:'reported'},{date:'2026-10-02',amountMinor:null,observedAt:null,runId:null,coverage:'unknown'}];
const base = {membershipAuthorized:true,requested:lineage,selected:lineage,connection:'current',observationFreshness:'stale',days};
test('current and expired connections preserve exact evidence and independent freshness',()=>{
 for(const connection of ['current','expired']) {
  const result=proposeHistoryContract({...base,connection});
  assert.equal(result.evidenceAvailability,'available');
  assert.equal(result.reauthorizationRequired,connection==='expired');
  assert.equal(result.observationFreshness,'stale');
  assert.deepEqual(result.days,days);
  assert.notEqual(result.days,days);
  assert.equal(result.days[1].amountMinor,null);
  assert.equal(result.days[1].observedAt,null);
 }
});
test('disconnect and supersession withhold evidence without fallback',()=>{
 for(const connection of ['disconnected','superseded']) {
  const result=proposeHistoryContract({...base,connection});
  assert.equal(result.evidenceAvailability,'withheld');
  assert.equal(result.lineage,null);
  assert.deepEqual(result.days,[]);
 }
});
test('every lineage mismatch including cross-store and version is denied',()=>{
 for(const key of Object.keys(lineage)) {
  const result=proposeHistoryContract({...base,requested:{...lineage,[key]:'different'}});
  assert.equal(result.evidenceAvailability,'withheld',key);
  assert.deepEqual(result.days,[]);
 }
 assert.equal(proposeHistoryContract({...base,selected:null}).evidenceAvailability,'withheld');
});

test('expired connection without reported history remains unavailable, unknown days unchanged',()=>{
 for(const days of [[],[base.days[1]]]) {
  const result=proposeHistoryContract({...base,connection:'expired',days});
  assert.equal(result.evidenceAvailability,'unavailable');
  assert.equal(result.reauthorizationRequired,true);
  assert.deepEqual(result.days,days);
 }
});
test('revoked trusted membership withholds even exact retained history',()=>{
 const result=proposeHistoryContract({...base,membershipAuthorized:false});
 assert.equal(result.evidenceAvailability,'withheld');
 assert.equal(result.lineage,null);
 assert.deepEqual(result.days,[]);
});
