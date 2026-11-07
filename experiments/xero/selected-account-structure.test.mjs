import test from 'node:test';import assert from 'node:assert/strict';import {describeSelectedAccountRows} from './selected-account-structure.mjs';
const mapping={revenue:['sales','shipping'],processingFee:'fees',advertising:'ads',software:'software',includedCash:['bank1','bank2']};
const row=(id,count=2)=>({RowType:'Row',Cells:Array.from({length:count},(_,index)=>({Value:index?'123.45':id,Attributes:[{Id:'account',Value:id}]}))});
const report=(id,rows)=>({Reports:[{ReportID:id,Rows:rows}]});
test('retains selected identifiers and row shapes but never names or values',()=>{
 const output=describeSelectedAccountRows({mapping,profitAndLoss:report('ProfitAndLoss',[row('sales'),row('shipping',3),row('other')]),balanceSheet:report('BalanceSheet',[row('bank1',3),row('other')])});
 assert.deepEqual(output.profitAndLoss,{selectedAccountIds:['sales','shipping','fees','ads','software'],foundAccountIds:['sales','shipping'],missingAccountIds:['fees','ads','software'],accountAttributeRows:3,cellCounts:[2,3]});
 assert.deepEqual(output.balanceSheet.missingAccountIds,['bank2']);assert.equal(JSON.stringify(output).includes('123.45'),false);
});
