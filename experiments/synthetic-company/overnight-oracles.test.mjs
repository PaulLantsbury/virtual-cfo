/** Independent accounting oracle: derive results from signed postings, never summary metrics. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {generate} from './generator.mjs';

test('raw journal postings independently reconcile both rolling years and calendar 2025',()=>{
 const fixture=generate({from:'2024-11-01',asOf:'2026-11-05'});
 const variable=new Set(['storage','returns','pickPack','carrier','packaging','processor']);
 for(const [from,to] of [['2024-11-01','2025-10-31'],['2025-01-01','2025-12-31'],['2025-11-01','2026-10-31']]){
  const accounts=new Map(),orders=new Set(),staff=new Set();
  for(const event of fixture.events){
   if(event.date<from||event.date>to)continue;
   assert.equal(event.postings.reduce((sum,p)=>sum+p.amount,0),0);
   for(const {account,amount}of event.postings)accounts.set(account,(accounts.get(account)||0)+amount);
   if(event.kind==='sale'){assert.ok(!orders.has(event.refs.orderId));orders.add(event.refs.orderId);}
   if(event.kind==='payroll_accrual')staff.add(event.refs.staffId);
  }
  const get=key=>accounts.get(key)||0;
  const product=-get('product_revenue'),shipping=-get('shipping_revenue');
  let variableCosts=0,marketing=0,overheads=0;
  for(const [key,value]of accounts){if(!key.startsWith('expense:'))continue;const category=key.slice(8);if(variable.has(category))variableCosts+=value;else if(category==='marketing')marketing+=value;else overheads+=value;}
  const gross=product-get('cogs'),contribution=gross+shipping-variableCosts-marketing,operating=contribution-overheads;
  assert.deepEqual({turnover:product+shipping,gross,operating,ebitda:operating+get('expense:depreciation'),orders:orders.size,staff:staff.size},
   {turnover:75000000,gross:36000000,operating:10224448,ebitda:10464448,orders:19895,staff:4},`${from}–${to}`);
 }
});
