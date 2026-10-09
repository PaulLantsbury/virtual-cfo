import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseXeroReportStructure} from './report-structure-diagnostic.mjs';

const mapping={revenue:['sales','shipping'],processingFee:['fees'],advertising:['ads'],software:['software'],includedCash:['bank1','bank2']};
const row=(id,value='SECRET VALUE')=>({RowType:'Row',Cells:[{Value:`SECRET ${id}`,Attributes:[{Id:'account',Value:id}]},{Value:value,Attributes:[{Id:'account',Value:id}]}]});
const report=(ReportID,Rows)=>({Reports:[{ReportID,ReportName:'SECRET NAME',ReportDate:'2026-09-25',Rows}]});
const snapshot={profitAndLoss:report('ProfitAndLoss',[{RowType:'Header',Cells:[{Value:'SECRET'}]},{RowType:'Section',Rows:[row('sales'),row('shipping'),row('fees'),row('ads'),row('software')]}]),balanceSheet:report('BalanceSheet',[{RowType:'Section',Rows:[row('bank1'),row('bank1')]}]),trialBalance:report('TrialBalance',[]),bankSummary:report('BankSummary',[{RowType:'SummaryRow',Cells:[{Value:'SECRET'}]}])};

test('reports bounded shapes and selected-account presence without source content',()=>{
 const result=diagnoseXeroReportStructure({snapshot,mapping});
 assert.equal(result.state,'observed');
 assert.deepEqual(result.reports.profitAndLoss.selected,{revenue:{expected:2,found:2,missing:0,duplicate:0},processingFee:{expected:1,found:1,missing:0,duplicate:0},advertising:{expected:1,found:1,missing:0,duplicate:0},software:{expected:1,found:1,missing:0,duplicate:0}});
 assert.deepEqual(result.reports.balanceSheet.selected.includedCash,{expected:2,found:0,missing:1,duplicate:1});
 assert.deepEqual(result.reports.profitAndLoss.shape.rowTypes,{Header:1,Section:1,Row:5,SummaryRow:0,Other:0});assert.equal(result.reports.profitAndLoss.shape.maxDepth,2);
 const output=JSON.stringify(result);for(const secret of ['sales','shipping','fees','ads','bank1','bank2','SECRET','2026-09-25'])assert.doesNotMatch(output,new RegExp(secret,'i'));
});
test('malformed envelopes remain structural booleans rather than raw payloads',()=>{const result=diagnoseXeroReportStructure({snapshot:{...snapshot,trialBalance:{Reports:[{private:'SECRET'},{private:'SECRET'}]}},mapping});assert.deepEqual(result.reports.trialBalance.envelope,{reports:2,singleReport:false,reportIdMatches:false,rowsArray:false});assert.doesNotMatch(JSON.stringify(result),/SECRET/);});
