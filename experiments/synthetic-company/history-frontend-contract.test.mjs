import test from 'node:test';import assert from 'node:assert/strict';
import {createHistoryRehearsal,importHistory} from './history-rehearsal.mjs';
import {createHistoryService} from './history-reader.mjs';
import {generate,summarise} from './generator.mjs';
import {historyAvailableMonths,historySupportedInput,HISTORY_EDITION} from '../../artifacts/virtual-cfo/src/lib/v11/history-supported.ts';
import {supportedSlice} from '../../artifacts/virtual-cfo/src/lib/v11/supported-slice.ts';

test('actual private SQL reader and explicit version map into shared card/evidence results without sample fallback',async()=>{
 const now=()=>new Date('2026-11-05T12:00:00Z'),h=await createHistoryRehearsal({now,withLoadedJanuary:true});
 try{
 await importHistory(h,{asOf:'2025-02-01',from:'2024-11-01'});
 const auth={auth:{getUser:async()=>({data:{user:{id:h.reviewerId,is_anonymous:false}}})}},service=createHistoryService(h.db,auth,{now});
 const scope={storeId:h.storeId,currency:'GBP'},availability=await service.available(scope,'Bearer test-only');
 const base={...scope,timezone:'Europe/London',edition:HISTORY_EDITION,anchor:'2024-11-01'};
 const months=historyAvailableMonths(availability,base);assert.equal(months.length,3);
 const january=months.find(m=>m.from==='2025-01-01');assert.ok(january);
 const versionId=january.versionId,selection={...base,period:{from:january.from,to:january.to},versionId};
 const response=await service.read({...scope,from:january.from,to:january.to},'Bearer test-only',{edition:HISTORY_EDITION,versionId});
 assert.equal(response.state,'supported');
 const view=supportedSlice(historySupportedInput(response,selection));assert.equal(view.primary.state,'supported');
 const oracle=summarise(generate({asOf:'2025-02-01',from:'2024-11-01'}),'2025-01-01','2025-01-31');
 const expected=[oracle.netProduct,oracle.grossProfit,oracle.contribution,oracle.ebitda];
 assert.deepEqual(view.metrics.map(m=>m.valuePence),expected);
 assert.equal(view.primary.context.snapshotId,versionId);assert.equal(view.primary.context.snapshotAsOf,'2025-02-01T00:00:00.000Z');
 assert.deepEqual(view.metrics.map(m=>m.comparisonPence),[null,null,null,null]);
 assert.equal(view.primary.result.originalOrders,oracle.orders);
 assert.equal(view.primary.result.aov,oracle.productSales/oracle.orders);
 const wrong=historySupportedInput(response,{...selection,versionId:'another-version'});assert.equal(supportedSlice(wrong).primary.context,null);
 }finally{await h.db.close();}
});
