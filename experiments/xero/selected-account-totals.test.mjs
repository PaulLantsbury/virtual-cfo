import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSelectedAccountTotals} from './selected-account-totals.mjs';

const mapping={revenue:['sales','shipping'],processingFee:'fees',advertising:'ads',software:'software',includedCash:['bank1','bank2']};
const row=(id,value)=>({RowType:'Row',Cells:[{Value:id,Attributes:[{Id:'account',Value:id}]},{Value:value,Attributes:[{Id:'account',Value:id}]}]});
const report=(id,rows)=>({Reports:[{ReportID:id,Rows:rows}]});
test('uses account IDs and converts selected report values to integer minor units',()=>{
 const result=extractSelectedAccountTotals({mapping,profitAndLoss:report('ProfitAndLoss',[row('sales','100.00'),row('shipping','6.00'),row('fees','3.00'),row('ads','20.00'),row('software','50.00')]),balanceSheet:report('BalanceSheet',[row('bank1','1,000.00'),row('bank2','0.00')])});
 assert.deepEqual(result,{sales:10000,shipping:600,fees:300,ads:2000,software:5000,bank1:100000,bank2:0});
});
test('withholds totals for missing, duplicate, ambiguous or non-money account rows',()=>{
 const valid={profitAndLoss:report('ProfitAndLoss',[row('sales','100.00'),row('shipping','6.00'),row('fees','3.00'),row('ads','20.00'),row('software','50.00')]),balanceSheet:report('BalanceSheet',[row('bank1','1.00'),row('bank2','2.00')])};
 for(const mutate of [x=>x.profitAndLoss.Reports[0].Rows.pop(),x=>x.balanceSheet.Reports[0].Rows.push(row('bank1','2.00')),x=>x.profitAndLoss.Reports[0].Rows[0].Cells.push({Value:'2.00'}),x=>x.balanceSheet.Reports[0].Rows[0].Cells[1].Value='not-money']){const input=structuredClone(valid);mutate(input);assert.throws(()=>extractSelectedAccountTotals({mapping,...input}),/unavailable/);}
});
