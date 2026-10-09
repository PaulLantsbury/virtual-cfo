import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseXeroReportStructure} from './report-structure-diagnostic.mjs';

const mapping={revenue:['sales','shipping'],processingFee:['fees'],advertising:['ads'],software:['software'],includedCash:['bank1','bank2']};
const row=(id,value='123.45')=>({RowType:'Row',Cells:[{Value:`SECRET ${id}`,Attributes:[{Id:'account',Value:id}]},{Value:value,Attributes:[{Id:'account',Value:id}]}]});
const report=(ReportID,Rows)=>({Reports:[{ReportID,ReportName:'SECRET NAME',ReportDate:'2026-09-25',Rows}]});
const snapshot={profitAndLoss:report('ProfitAndLoss',[{RowType:'Header',Cells:[{Value:'SECRET'}]},{RowType:'Section',Rows:[row('sales'),row('shipping'),row('fees'),row('ads'),row('software')]}]),balanceSheet:report('BalanceSheet',[{RowType:'Section',Rows:[row('bank1'),row('bank1')]}]),trialBalance:report('TrialBalance',[]),bankSummary:report('BankSummary',[{RowType:'SummaryRow',Cells:[{Value:'SECRET'}]}])};

test('reports bounded shapes and selected-account presence without source content',()=>{
 const result=diagnoseXeroReportStructure({snapshot,mapping});
 assert.equal(result.state,'observed');
 assert.deepEqual(result.reports.profitAndLoss.selected.revenue,{expected:2,found:2,missing:0,duplicate:0,occurrences:2,extractorEligible:2,consistentAccountAttributes:2,conflictingAccountAttributes:0,usableMoney:2,noValue:0,malformedValue:0,minCells:2,maxCells:2});
 assert.deepEqual(result.reports.balanceSheet.selected.includedCash,{expected:2,found:0,missing:1,duplicate:1,occurrences:2,extractorEligible:2,consistentAccountAttributes:2,conflictingAccountAttributes:0,usableMoney:2,noValue:0,malformedValue:0,minCells:2,maxCells:2});
 assert.deepEqual(result.reports.profitAndLoss.shape.rowTypes,{Header:1,Section:1,Row:5,SummaryRow:0,Other:0});assert.equal(result.reports.profitAndLoss.shape.maxDepth,2);
 const output=JSON.stringify(result);for(const secret of ['sales','shipping','fees','ads','bank1','bank2','SECRET','2026-09-25'])assert.doesNotMatch(output,new RegExp(secret,'i'));
});
test('classifies the exact current extractor gates without exposing their contents',()=>{
 const wrongType={...row('sales'),RowType:'SummaryRow'};
 const conflicting={RowType:'Row',Cells:[{Value:'SECRET',Attributes:[{Id:'account',Value:'fees'}]},{Value:'1.00',Attributes:[{Id:'account',Value:'other-private-id'}]}]};
 const noValue={RowType:'Row',Cells:[{Value:'SECRET',Attributes:[{Id:'account',Value:'ads'}]},{Value:''}]};
 const malformed=row('software','SECRET MONEY');
 const result=diagnoseXeroReportStructure({snapshot:{...snapshot,profitAndLoss:report('ProfitAndLoss',[wrongType,conflicting,noValue,malformed])},mapping});
 assert.equal(result.reports.profitAndLoss.selected.revenue.extractorEligible,0);
 assert.equal(result.reports.profitAndLoss.selected.processingFee.conflictingAccountAttributes,1);
 assert.equal(result.reports.profitAndLoss.selected.advertising.noValue,1);
 assert.equal(result.reports.profitAndLoss.selected.software.malformedValue,1);
 const output=JSON.stringify(result);for(const secret of ['other-private-id','SECRET MONEY'])assert.doesNotMatch(output,new RegExp(secret,'i'));
});
test('malformed envelopes remain structural booleans rather than raw payloads',()=>{const result=diagnoseXeroReportStructure({snapshot:{...snapshot,trialBalance:{Reports:[{private:'SECRET'},{private:'SECRET'}]}},mapping});assert.deepEqual(result.reports.trialBalance.envelope,{reports:2,singleReport:false,reportIdMatches:false,rowsArray:false});assert.doesNotMatch(JSON.stringify(result),/SECRET/);});
