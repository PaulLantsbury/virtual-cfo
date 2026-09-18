// In-memory PostgreSQL only. This bypasses intake/review writers deliberately:
// it verifies the existing member SQL reader against the invented ledger.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,U} from '../shopify/finance-fixture.mjs';
import {historicalInput,PERIODS} from './historical-testing-fixture.mjs';
import {fetchVerifiedSales} from './rpc-sales-adapter.mjs';
const STORE='90000000-0000-4000-8000-000000000006';
const id=n=>`96000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const expected={
 '2025-08':[48000,1800,6], '2025-09':[72000,2700,9],
 '2025-10':[72000,2700,9], '2025-11':[96000,3600,12],
 '2025-12':[120000,4500,15], '2026-01':[48000,1800,6],
 '2026-02':[46000,1700,6], '2026-03':[69000,2700,9],
 '2026-04':[72000,2700,9], '2026-05':[72000,2700,9],
 '2026-06':[96000,3600,12], '2026-07':[96000,3600,12],
 '2026-08':[96000,3600,12], '2026-09':[48000,1800,6],
};
test('historical ledger reaches real authenticated SQL reporting with exact periods and isolation',async()=>{
 const {db}=await setup();
 try {
  const before=(await db.query('SELECT to_jsonb(o) row FROM public.orders o ORDER BY id')).rows;
  const input=historicalInput('2026-09',{excludedTestOrder:true});
  const ids=new Map(input.mapped.orders.map((o,i)=>[o.id,id(i+1)]));
  await db.query("INSERT INTO public.stores(id,shopify_domain,shopify_store_id,name,currency_code,timezone) VALUES($1,'historical-reporting.invalid','synthetic-historical','Disposable Synthetic Historical Store','GBP','Europe/London')",[STORE]);
  await db.query('INSERT INTO public.store_memberships VALUES($1,$2)',[U,STORE]);
  for(const o of input.mapped.orders){
   await db.query(`INSERT INTO public.orders(id,store_id,shopify_order_id,order_date,currency,gross_sales,discounts,shipping,tax,financial_status) VALUES($1,$2,$3,$4,'GBP',$5,$6,$7,0,'paid')`,[ids.get(o.id),STORE,o.id,o.occurredAt??`${o.day}T12:00:00+01:00`,o.gross,o.discount,o.shipping]);
   await db.query(`INSERT INTO finance_v1.order_evidence(store_id,order_id,observed_raw,event_date,currency,original_eligible,tax_basis,gross_product_vat,discount_vat,shipping_vat,evidence_ref,verified_by) SELECT store_id,id,current_snapshot,$2,'GBP',$3,$4,$5,$6,$7,'invented disposable historical ledger','synthetic fixture' FROM finance_v1.order_mapping WHERE id=$1`,[ids.get(o.id),o.day,o.original_eligible,o.tax_basis,o.gross_vat,o.discount_vat,o.shipping_vat]);
  }
  for(const [i,r] of input.mapped.refunds.entries()){
   const rid=id(1000+i);
   await db.query('INSERT INTO public.refunds(id,store_id,order_id,shopify_refund_id,refund_date,amount) VALUES($1,$2,$3,$4,$5,$6)',[rid,STORE,ids.get(r.order_id),r.id,r.occurredAt,r.amount]);
   await db.query(`INSERT INTO finance_v1.refund_evidence(store_id,refund_id,order_id,observed_raw,event_date,currency,product_cash,product_vat,shipping_cash,shipping_vat,evidence_ref,verified_by) SELECT store_id,id,order_id,current_snapshot,$2,'GBP',$3,$4,$5,$6,'invented disposable refund split','synthetic fixture' FROM finance_v1.refund_mapping WHERE id=$1`,[rid,r.day,r.product_cash,r.product_vat,r.shipping_cash,r.shipping_vat]);
  }
  const scopes=PERIODS.map(([month])=>historicalInput(month).scope);
  scopes.push(historicalInput('2025-09',{throughDay:17}).scope);
  for(const s of scopes)await db.query(`INSERT INTO finance_v1.coverage_evidence(store_id,date_from,date_to,currency,sales_and_refunds_complete,evidence_ref,verified_by) VALUES($1,$2,$3,'GBP',true,'complete invented fixture only; no real-source attestation','synthetic fixture')`,[STORE,s.from,s.to]);
  async function read(scope,store=STORE){
   await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[U]);
   await db.exec('SET ROLE authenticated');
   try{return await fetchVerifiedSales(async(_,p)=>({data:(await db.query('SELECT public.verified_sales_source($1,$2,$3) data',[p.p_store_id,p.p_date_from,p.p_date_to])).rows[0].data,error:null}),{...scope,storeId:store});}
   finally{await db.exec('RESET ROLE');}
  }
  for(const scope of scopes){
   const r=await read(scope),values=scope.to==='2025-09-17'?[48000,1800,6]:expected[scope.from.slice(0,7)];
   assert.deepEqual([r.netProductSales,r.netShipping,r.originalOrders],values,scope.from);
   assert.equal(r.aov.value,8000);assert.equal(r.cogs,null);
  }
  const feb=await read(historicalInput('2026-02').scope);
  assert.equal(feb.cashRefunded,2520);
  const march=await read(historicalInput('2026-03').scope);
  assert.equal(march.cashRefunded,3600);assert.equal(march.productRefundExVat,3000);
  await assert.rejects(read({...scopes[0],to:'2025-08-30'}),/coverage/i);
  await db.query('DELETE FROM public.store_memberships WHERE user_id=$1 AND store_id=$2',[U,STORE]);
  await assert.rejects(read(scopes[0]),/Store access unavailable/);
  await db.query('INSERT INTO public.store_memberships VALUES($1,$2)',[U,STORE]);
  await db.query('UPDATE public.orders SET gross_sales=gross_sales+0.01 WHERE id=$1',[ids.get(input.mapped.orders[0].id)]);
  await assert.rejects(read(scopes[0]),/stale|mapping|evidence/i);
  assert.deepEqual((await db.query('SELECT to_jsonb(o) row FROM public.orders o WHERE store_id<>$1 ORDER BY id',[STORE])).rows,before);
 } finally {await db.close();}
});
