import test from 'node:test';
import assert from 'node:assert/strict';
import {historicalReportingFixture,historicalExtraction,HISTORICAL_REPORTING_STORE as STORE} from './historical-reporting-fixture.mjs';
import {mapShopifySales} from './map-sales.mjs';
import {recordShopifyCandidate} from './record-candidate.mjs';
import {U} from './finance-fixture.mjs';
const expected={
 '2025-08':[48000,1800,6],'2025-09':[72000,2700,9],'2025-10':[72000,2700,9],
 '2025-11':[96000,3600,12],'2025-12':[120000,4500,15],'2026-01':[48000,1800,6],
 '2026-02':[46000,1700,6],'2026-03':[69000,2700,9],'2026-04':[72000,2700,9],
 '2026-05':[72000,2700,9],'2026-06':[96000,3600,12],'2026-07':[96000,3600,12],
 '2026-08':[96000,3600,12],'2026-09':[48000,1800,6],'2025-09-partial':[48000,1800,6],
};
test('invented API-shaped source has explicit conversion boundary and test-order exclusion',()=>{
 const {data}=historicalExtraction();assert.equal(data.orders.length,132);
 const scope={storeId:STORE,shopId:data.settings.shopId,from:'2026-08-01',to:'2026-08-31'};
 const before=mapShopifySales(data,scope);assert.equal(before.events.length,134);
 const excluded={...structuredClone(data.orders[0]),id:'gid://shopify/Order/99999',test:true};
 const after=mapShopifySales({...data,orders:[...data.orders,excluded]},scope);
 assert.deepEqual(after.candidate,before.candidate);assert.deepEqual(after.events,before.events);
 assert.deepEqual(after.excluded,[{id:excluded.id,reason:'TEST_ORDER'}]);
 const unsupported=structuredClone(data);unsupported.orders[0].taxesIncluded=true;
 assert.equal(mapShopifySales(unsupported,scope).status,'blocked');
});
test('132 orders and two refunds traverse actual intake/import/separate review and member SQL for all14 periods plus comparison',async()=>{
 const f=await historicalReportingFixture(),{db}=f;
 try{
  const otherBefore=(await db.query('SELECT to_jsonb(o) row FROM orders o ORDER BY id')).rows;
  for(const key of Object.keys(expected))await assert.rejects(f.read(key),/coverage|evidence/i);
  const imported=await f.importEvidence();assert.equal(imported['2025-08'].orders,132);assert.equal(imported['2025-08'].refunds,2);
  for(const [key,result] of Object.entries(imported)){assert.equal(result.coverageCertified,false);if(key!=='2025-08'){assert.equal(result.orders,0);assert.equal(result.refunds,0);}}
  assert.equal((await f.orderIds()).size,132);assert.ok([...await f.orderIds()].every(([,id])=>id));
  for(const key of Object.keys(expected))await assert.rejects(f.read(key),/coverage/i);
  await f.review('2025-09');await assert.rejects(f.read('2025-09-partial'),/coverage/i);
  for(const key of Object.keys(expected)){
   if(key!=='2025-09')await f.review(key);
   const r=await f.read(key);assert.deepEqual([r.netProductSales,r.netShipping,r.originalOrders],expected[key],key);assert.equal(r.aov.value,8000);assert.equal(r.cogs,null);
  }
  const feb=await f.read('2026-02'),march=await f.read('2026-03');
  assert.equal(feb.cashRefunded,2520);assert.equal(feb.productRefundVat,400);assert.equal(feb.shippingRefundVat,20);
  assert.equal(march.cashRefunded,3600);assert.equal(march.productRefundExVat,3000);
  assert.equal((await f.read('2026-08')).netProductSales,2*(await f.read('2025-08')).netProductSales);
  assert.equal((await f.read('2026-09')).netProductSales,(await f.read('2025-09-partial')).netProductSales);
  const repeat=await f.importEvidence();assert.ok(Object.values(repeat).every(r=>r.status==='already_imported'));
  const replay=await recordShopifyCandidate(db,f.data,{...f.scopes['2025-08'],shopId:f.data.settings.shopId});assert.equal(replay.status,'replay');
  assert.deepEqual((await db.query('SELECT to_jsonb(o) row FROM orders o WHERE store_id<>$1 ORDER BY id',[STORE])).rows,otherBefore);
  await db.query('DELETE FROM store_memberships WHERE user_id=$1 AND store_id=$2',[U,STORE]);await assert.rejects(f.read('2026-08'),/Store access unavailable/);
  await db.query('INSERT INTO store_memberships VALUES($1,$2)',[U,STORE]);
  await db.query('UPDATE orders SET gross_sales=gross_sales+0.01 WHERE id=$1',[(await f.orderIds()).get('history-2025-08-1-a')]);
  await assert.rejects(f.read('2025-08'),/stale|mapping|evidence/i);
 }finally{await db.close();}
});
