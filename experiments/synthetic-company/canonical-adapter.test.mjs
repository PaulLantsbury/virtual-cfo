import test from 'node:test';
import assert from 'node:assert/strict';
import {generate,summarise} from './generator.mjs';
import {rehearseCanonicalMonth} from './canonical-adapter.mjs';
const fixture=generate();
const scope={company:fixture.scope.company,currency:'GBP',from:'2025-01-01',to:'2025-01-31',complete:true};
test('all twelve months reconcile through existing mapped sales and profit calculation engines',()=>{
 let revenue=0,profit=0;
 for(let m=1;m<=12;m++){
 const month=`2025-${String(m).padStart(2,'0')}`,from=`${month}-01`,to=new Date(Date.UTC(2025,m,0)).toISOString().slice(0,10);
 const actual=rehearseCanonicalMonth(fixture,{...scope,from,to}),oracle=summarise(fixture,from,to);
 assert.equal(actual.sales.netProductSales,oracle.netProduct);assert.equal(actual.sales.originalOrders,oracle.orders);assert.equal(actual.sales.netShipping,oracle.shipping);
 assert.equal(actual.profit.grossProfit,oracle.grossProfit);assert.equal(actual.profit.operatingProfit,oracle.operatingProfit);assert.equal(actual.profit.ebitda,oracle.ebitda);
 assert.equal(actual.sales.cogs,null,'sales mapping does not certify costs');assert.equal(actual.status,'offline-rehearsal-only');
 revenue+=actual.profit.revenueDenominator;profit+=actual.profit.operatingProfit;
 }
 assert.equal(revenue,50000000);assert.equal(profit,-2425200);
});
test('rejects incomplete scopes, absent review, wrong company/currency and unsupported opening cohort',()=>{
 for(const change of [{complete:false},{company:'fictional-other'},{currency:'USD'},{from:'2025-01-02'},{to:'2025-02-01'},{from:'2026-11-01',to:'2026-11-30'},{from:'2024-11-01',to:'2024-11-30'}])assert.throws(()=>rehearseCanonicalMonth(fixture,{...scope,...change}));
});
test('cross-company, duplicate and unbalanced source events are rejected before calculations',()=>{
 for(const mutate of [f=>f.events[0].company='fictional-other',f=>f.events.push(f.events[0]),f=>f.events[0].postings[0].amount++]){const f=structuredClone(fixture);mutate(f);assert.throws(()=>rehearseCanonicalMonth(f,scope));}
});
