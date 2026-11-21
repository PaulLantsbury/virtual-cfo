import test from 'node:test';
import assert from 'node:assert/strict';
import {generate,summarise} from './generator.mjs';
const baseline=generate({asOf:'2026-11-05',from:'2024-11-01'});
const sum=values=>values.reduce((a,b)=>a+b,0);
const period=(e,from,to)=>e.date>=from&&e.date<=to;

test('both completed rolling twelve-month histories meet independent four-person financial budgets',()=>{
 for(const [from,to] of [['2024-11-01','2025-10-31'],['2025-11-01','2026-10-31']]){
 const actual=summarise(baseline,from,to);
 for(const [key,value] of Object.entries({revenue:75000000,netProduct:72000000,grossProfit:36000000,operatingProfit:10224448,ebitda:10464448,orders:19895}))assert.equal(actual[key],value,`${from} ${key}`);
 const payroll=baseline.events.filter(e=>e.kind==='payroll_accrual'&&period(e,from,to));
 assert.equal(payroll.length,48);assert.equal(new Set(payroll.map(e=>e.refs.staffId)).size,4);
 assert.equal(sum(payroll.map(e=>e.refs.gross+e.refs.employer+e.refs.pension)),13647552);
 assert.equal(sum(payroll.map(e=>e.refs.gross)),11900000);
 }
});
test('734-day scope has one opening and no future actuals or artificial balance clamping',()=>{
 assert.equal(baseline.daily.length,734);assert.equal(baseline.from,'2024-11-01');assert.equal(baseline.to,'2026-11-04');
 const openings=baseline.events.filter(e=>e.kind==='opening');assert.equal(openings.length,1);assert.equal(openings[0].date,baseline.from);
 assert.equal(openings[0].postings.find(p=>p.account==='bank').amount,6000000);
 const balances={};let offset=0;
 for(const day of baseline.daily){
 while(offset<baseline.events.length&&baseline.events[offset].date===day.date){const e=baseline.events[offset++];assert.equal(sum(e.postings.map(p=>p.amount)),0);for(const p of e.postings)balances[p.account]=(balances[p.account]||0)+p.amount;}
 // Compare signed values directly: a real negative bank would remain negative.
 assert.deepEqual(day.balances,balances);assert.equal(sum(Object.values(balances)),0);
 }
 assert.equal(offset,baseline.events.length);assert.ok(baseline.events.every(e=>e.date<'2026-11-05'));
});
test('one completed November day appends without altering earlier VAT, payroll, inventory or bank history',()=>{
 const extended=generate({asOf:'2026-11-06',from:'2024-11-01'});
 assert.deepEqual(extended.events.filter(e=>e.date<'2026-11-05'),baseline.events);
 assert.deepEqual(extended.daily.slice(0,baseline.daily.length),baseline.daily);
 const last={...baseline.daily.at(-1).balances};const added=extended.events.filter(e=>e.date==='2026-11-05');assert.ok(added.length>0);
 for(const event of added)for(const p of event.postings)last[p.account]=(last[p.account]||0)+p.amount;
 assert.deepEqual(extended.daily.at(-1).balances,last);
 for(const account of ['bank','inventory','vat_control'])assert.equal(extended.daily.at(-1).balances[account],last[account]);
 assert.equal(extended.events.filter(e=>e.kind==='opening').length,1);assert.ok(extended.events.every(e=>e.date<'2026-11-06'));
});
test('January financial flows and original-order denominator survive different opening editions',()=>{
 const january=generate({asOf:'2025-02-01',from:'2025-01-01'});
 const full=summarise(baseline,'2025-01-01','2025-01-31'),isolated=summarise(january);
 for(const key of ['orders','productSales','netProduct','shipping','grossProfit','operatingProfit','ebitda'])assert.equal(full[key],isolated[key],key);
 const originals=baseline.events.filter(e=>e.kind==='sale'&&period(e,'2025-01-01','2025-01-31'));
 assert.equal(originals.length,full.orders);assert.equal(sum(originals.map(e=>e.metrics.orders)),full.orders);
 assert.equal(full.productSales/full.orders,isolated.productSales/isolated.orders);
 const refunds=baseline.events.filter(e=>e.kind==='refund'&&period(e,'2025-01-01','2025-01-31'));
 assert.ok(refunds.some(e=>e.refs.originalDate<'2025-01-01'));assert.ok(refunds.every(e=>e.date!==e.refs.originalDate));
 // Closing cash belongs to its opening edition; equality is explicitly not required.
 assert.notDeepEqual(baseline.daily.find(d=>d.date==='2025-01-31').balances,january.daily.at(-1).balances);
});
