import test from 'node:test';import assert from 'node:assert/strict';
import {createHistoryRehearsal,importHistory} from './history-rehearsal.mjs';
import {createHistoryService,calculateHistorySources} from './history-reader.mjs';
import {HISTORY_EDITION} from './history-context.mjs';
const now=()=>new Date('2026-11-27T16:00:00Z');
test('realistic September–October boundary uses validated monthly witnesses without repeated edge SQL',async()=>{
 const h=await createHistoryRehearsal({withLoadedJanuary:false,now});try{
  await importHistory(h,{from:'2026-09-01',asOf:'2026-11-01'});
  const queries=[];const db={transaction:fn=>h.db.transaction(tx=>fn({exec:(...a)=>tx.exec(...a),query:(sql,args)=>{queries.push({sql,args});return tx.query(sql,args);}}))};
  const auth={auth:{getUser:async()=>({data:{user:{id:h.reviewerId,is_anonymous:false}}})}};
  const service=createHistoryService(db,auth,{now});const listing=await service.available({storeId:h.storeId,currency:'GBP'},'Bearer fixture');
  const versions=listing.months.map(({from,to,versionId})=>({from,to,versionId}));queries.length=0;
  const scope={storeId:h.storeId,currency:'GBP',from:'2026-09-28',to:'2026-10-04'};
  const start=performance.now();const range=await service.range(scope,'Bearer fixture',{edition:HISTORY_EDITION,versions});
  const edgeQueries=queries.filter(q=>q.sql.startsWith('SELECT source_id')&&q.args?.[1]==='2026-09-28'||q.sql.startsWith('SELECT source_id')&&q.args?.[1]==='2026-10-01'&&q.args?.[2]==='2026-10-04');
  console.log(JSON.stringify({scope,elapsedMs:Math.round(performance.now()-start),queryCount:queries.length,edgeQueryCount:edgeQueries.length,state:range.state,reason:range.reason}));
  assert.equal(range.state,'supported');assert.equal(range.dailyFinancial.length,7);assert.equal(range.cashDatedPortions.length,2);
  const originals=await h.db.transaction(async tx=>Promise.all(versions.map(async m=>calculateHistorySources(tx,{...scope,from:scope.from>m.from?scope.from:m.from,to:scope.to<m.to?scope.to:m.to},{coverage_id:'independent-check'}))));
  for(const key of ['netProductSales','originalOrders','netShipping','cashRefunded'])assert.equal(range.sales[key],originals.reduce((sum,r)=>sum+r.sales[key],0));
  for(const key of ['cogs','variableCosts','advertising','depreciationAmortisation'])assert.equal(range.components[key],originals.reduce((sum,r)=>sum+r.components[key],0));
  assert.equal(edgeQueries.length,0,'No repeated partial source SQL after full monthly validation');
 }finally{await h.db.close();}
});
