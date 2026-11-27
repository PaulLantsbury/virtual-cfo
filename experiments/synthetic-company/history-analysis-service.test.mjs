import test from 'node:test';
import assert from 'node:assert/strict';
import {createHistoryRehearsal,importHistory,invalidateHistoryMonth} from './history-rehearsal.mjs';
import {createHistoryService} from './history-reader.mjs';
import {HISTORY_EDITION} from './history-context.mjs';
const now=()=>new Date('2026-11-27T12:00:00Z');
let h,service,scope,selection;
const auth=id=>({auth:{getUser:async()=>({data:{user:{id,is_anonymous:false}}})}});
test.before(async()=>{h=await createHistoryRehearsal({withLoadedJanuary:false,now});await importHistory(h,{from:'2025-01-01',asOf:'2025-03-01'});service=createHistoryService(h.db,auth(h.reviewerId),{now});scope={storeId:h.storeId,currency:'GBP',from:'2025-02-01',to:'2025-02-28'};const rows=(await service.available({storeId:h.storeId,currency:'GBP'},'Bearer fixture')).months;selection={edition:HISTORY_EDITION,versionId:rows.find(r=>r.from===scope.from).versionId};});
test.after(async()=>h?.db.close());
test('same readonly service validates two sealed months, bounds wire and preserves normal history',async()=>{
 const before=await service.read(scope,'Bearer fixture',selection),result=await service.analyze(scope,'Bearer fixture',selection);
 assert.equal(result.analysis.status,'ready');assert.equal(result.current.financialVersionId,selection.versionId);assert.equal(result.current.salesRevision,before.salesRevision);assert.equal(result.prior.from,'2025-01-01');assert.equal(result.prior.to,'2025-01-31');assert.equal(result.analysis.bridge.length,6);
 assert.deepEqual(await service.read(scope,'Bearer fixture',selection),before);
 assert.ok(JSON.stringify(result).length<20000);assert.doesNotMatch(JSON.stringify(result),/profitInput|postings|costEvidence|historic_unit_cost/);
});
test('missing prior retains current facts; wrong scope, selection and denied user do not leak facts',async()=>{
 const january={...scope,from:'2025-01-01',to:'2025-01-31'};const month=(await service.available({storeId:h.storeId,currency:'GBP'},'Bearer fixture')).months.find(m=>m.from===january.from);
 const result=await service.analyze(january,'Bearer fixture',{edition:HISTORY_EDITION,versionId:month.versionId});assert.equal(result.prior,null);assert.ok(result.analysis.facts.length);assert.equal(result.analysis.bridge.length,0);assert.equal(result.analysis.investigation,null);
 const wrong=await service.analyze(scope,'Bearer fixture',{edition:HISTORY_EDITION,versionId:month.versionId});assert.equal(wrong.current,null);assert.equal(wrong.analysis.facts.length,0);
 await assert.rejects(service.analyze({...scope,from:'2025-02-02'},'Bearer fixture',selection));
 const denied=createHistoryService(h.db,auth('00000000-0000-4000-8000-000000000099'),{now});await assert.rejects(denied.analyze(scope,'Bearer fixture',selection),/membership/);
});
test('withdrawn prior removes comparison; withdrawn selected month clears all analysis',async()=>{
 await invalidateHistoryMonth(h,{from:'2025-01-01',to:'2025-01-31',reason:'Local test withdrawal'});
 let r=await service.analyze(scope,'Bearer fixture',selection);assert.ok(r.current);assert.equal(r.prior,null);assert.equal(r.analysis.bridge.length,0);
 await invalidateHistoryMonth(h,{from:scope.from,to:scope.to,reason:'Local current withdrawal'});
 r=await service.analyze(scope,'Bearer fixture',selection);assert.equal(r.current,null);assert.equal(r.prior,null);assert.equal(r.analysis.status,'withheld');assert.equal(r.analysis.facts.length,0);
});
