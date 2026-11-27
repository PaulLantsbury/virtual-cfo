import test from 'node:test';
import assert from 'node:assert/strict';
import {createHistoryRehearsal,importHistory} from './history-rehearsal.mjs';
import {createHistoryService} from './history-reader.mjs';
import {composeHistoryMonth} from '../../artifacts/virtual-cfo/src/lib/v11/history-composition.ts';
import {reviewedCfoAnalysis} from '../../artifacts/virtual-cfo/src/lib/reviewedCfoAnalysis.ts';

test('generated database history and actual analysis service cross the real month and UI boundaries',async()=>{
 const now=()=>new Date('2026-11-27T12:00:00Z');
 const h=await createHistoryRehearsal({withLoadedJanuary:false,now});
 try{
  await importHistory(h,{from:'2025-04-01',asOf:'2025-06-01'});
  const service=createHistoryService(h.db,{auth:{getUser:async()=>({data:{user:{id:h.reviewerId,is_anonymous:false}}})}},{now});
  const availability=await service.available({storeId:h.storeId,currency:'GBP'},'Bearer fictional');
  const read=async from=>{
   const row=availability.months.find(m=>m.from===from);assert.ok(row);
   const selection={storeId:h.storeId,currency:'GBP',timezone:'Europe/London',edition:availability.edition,anchor:availability.anchor,period:{from:row.from,to:row.to},versionId:row.versionId};
   const scope={storeId:h.storeId,currency:'GBP',from:row.from,to:row.to};
   const raw=await service.read(scope,'Bearer fictional',{edition:selection.edition,versionId:selection.versionId});
   const month=composeHistoryMonth(raw,selection);assert.ok(month);
   return {month,scope,selection};
  };
  const prior=await read('2025-04-01'),current=await read('2025-05-01');
  const response=await service.analyze(current.scope,'Bearer fictional',{edition:current.selection.edition,versionId:current.selection.versionId});
  const accepted=reviewedCfoAnalysis(response,current.month,prior.month);
  assert.ok(accepted,'actual service output must satisfy frontend labels, company, source refs and exact contract');
  assert.equal(accepted.facts.length,12);assert.equal(accepted.bridge.length,6);
  assert.equal(accepted.facts.find(f=>f.key==='operatingProfit').changePence,280402);
  assert.equal(accepted.bridge.reduce((n,b)=>n+b.profitEffectPence,0),280402);
  for(const mutate of [r=>r.scope.storeId='00000000-0000-4000-8000-000000000099',r=>r.current.salesRevision='stale',r=>r.prior.costRevision='stale',r=>r.analysis.sources[1].ref='unrelated']){
   const changed=structuredClone(response);mutate(changed);assert.equal(reviewedCfoAnalysis(changed,current.month,prior.month),null);
  }
  assert.equal(reviewedCfoAnalysis(response,prior.month,current.month),null);
 }finally{await h.db.close();}
});
