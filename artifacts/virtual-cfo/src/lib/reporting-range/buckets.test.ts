import test from 'node:test';
import assert from 'node:assert/strict';
import {reportingFinancialBuckets} from './buckets.ts';
function fixture(){
 const daily=Array.from({length:8},(_,i)=>({date:new Date(Date.UTC(2024,1,26+i,12)).toISOString().slice(0,10),grossProductSales:1200+i,discounts:100,netProductSales:1100+i,netShipping:100,originalOrders:i+1,cogs:500,variableCosts:100,advertising:100,overheadIncludingDA:200,depreciationAmortisation:10}));
 const sum=(k:string)=>daily.reduce((n,r)=>n+(r as any)[k],0);
 return {selection:{period:{from:'2024-02-26',to:'2024-03-04'}},originalOrders:sum('originalOrders'),amounts:{netProductSales:sum('netProductSales'),netShipping:sum('netShipping')},input:{profit:Object.fromEntries([['cogs','cogs'],['variableCosts','variableCosts'],['advertising','advertising'],['overheads','overheadIncludingDA'],['da','depreciationAmortisation']].map(([target,k])=>[target,{value:sum(k)}]))},range:{dailyFinancial:daily}};
}
test('weekly buckets cross leap day/month boundary and clip to exact Custom end',()=>{
 const f=fixture(),rows=reportingFinancialBuckets(f,'weekly')!;
 assert.equal(rows.length,2);assert.equal(rows[0].from,'2024-02-26');assert.equal(rows[0].to,'2024-03-03');assert.equal(rows[1].from,'2024-03-04');assert.equal(rows[1].to,'2024-03-04');
 assert.equal(rows.reduce((n,r)=>n+r.sales!,0),f.amounts.netProductSales);
 assert.equal(rows.reduce((n,r)=>n+r.orders,0),36);
});
test('monthly buckets and per-order amounts recompute from each bucket own inputs',()=>{
 const f=fixture(),rows=reportingFinancialBuckets(f,'monthly')!,per=reportingFinancialBuckets(f,'monthly',true)!;
 assert.equal(rows[0].to,'2024-02-29');assert.equal(rows[1].from,'2024-03-01');
 assert.equal(per[0].sales,rows[0].sales!/rows[0].orders);assert.equal(per[1].ebitda,rows[1].ebitda!/rows[1].orders);assert.equal(per[0].margin,rows[0].margin);
});
test('missing/duplicate/fractional or unreconciled daily data cannot produce chart values',()=>{
 for(const mutate of [(f:any)=>f.range.dailyFinancial.splice(2,1),(f:any)=>f.range.dailyFinancial[1].date=f.range.dailyFinancial[0].date,(f:any)=>f.range.dailyFinancial[0].advertising=.5,(f:any)=>f.range.dailyFinancial[0].overheadIncludingDA++,(f:any)=>f.originalOrders++]){const f=fixture();mutate(f);assert.equal(reportingFinancialBuckets(f,'weekly'),null);}
});
