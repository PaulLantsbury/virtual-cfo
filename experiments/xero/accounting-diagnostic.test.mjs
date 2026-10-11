import test from 'node:test';
import assert from 'node:assert/strict';
import {runStagingXeroRefresh} from './staging-refresh-orchestrator.mjs';
const mapping={revenue:['private-revenue'],processingFee:['private-fee'],advertising:['private-ad'],software:['private-software'],includedCash:['private-cash']};
const row=(id,value)=>({RowType:'Row',Cells:[{Value:'PRIVATE NAME',Attributes:[{Id:'account',Value:id}]},{Value:value}]});
const report=(id,rows)=>({Reports:[{ReportID:id,Rows:rows}]});
const baseline=()=>({tenantId:'private-tenant',date:'2026-10-10',organisation:{},profitAndLoss:report('ProfitAndLoss',[row('private-revenue','12345.67')]),balanceSheet:report('BalanceSheet',[row('private-cash','98765.43')]),trialBalance:{},bankSummary:{}});
async function run(snapshot,diagnose){const writes=[];const result=await runStagingXeroRefresh({connection:{id:'private-connection',tenantId:'private-tenant'},scope:{from:'2026-10-01',to:'2026-10-10',currency:'GBP'},mapping,readSnapshot:async()=>snapshot,now:()=> '2026-10-11T16:00:00Z',diagnose,persist:{writeSupported:async x=>writes.push(x),writeFailure:async x=>writes.push(x)}});return {result,writes};}
for(const [label,mutate,reason,category] of [
 ['missing revenue',s=>s.profitAndLoss.Reports[0].Rows=[], 'required_account_missing','revenue'],
 ['missing cash',s=>s.balanceSheet.Reports[0].Rows=[], 'cash_boundary_unverified','includedCash'],
 ['duplicate revenue',s=>s.profitAndLoss.Reports[0].Rows.push(row('private-revenue','12345.67')), 'duplicate_selected_account','revenue'],
 ['invalid cash amount',s=>s.balanceSheet.Reports[0].Rows[0].Cells[1].Value='PRIVATE PAYLOAD', 'amount_format_invalid','includedCash'],
 ['invalid report shape',s=>s.profitAndLoss.Reports[0].ReportID='PRIVATE REPORT', 'report_shape_invalid','revenue']
])test(`diagnostic classifies ${label} without exposing financial or provider details`,async()=>{const s=baseline();mutate(s);const diagnostics=[];const {result,writes}=await run(s,x=>diagnostics.push(x));assert.equal(result.state,'failed');assert.equal(result.failure.reason,'accounting_evidence_unavailable');assert.deepEqual(diagnostics,[{event:'xero_accounting_evidence_failed',phase:'selected_account_totals',reason,report:label==='missing cash'?'BankSummary':category==='includedCash'?'BalanceSheet':'ProfitAndLoss',category}]);assert.doesNotMatch(JSON.stringify(diagnostics),/private|PRIVATE|12345|98765|token|connectionId|tenantId/);assert.equal(writes[0].failure.reason,'accounting_evidence_unavailable');assert.equal(writes.length,1);});
test('diagnostic callback failure cannot alter persisted financial failure',async()=>{const s=baseline();s.profitAndLoss.Reports[0].Rows=[];const {result,writes}=await run(s,()=>{throw Error('PRIVATE CALLBACK');});assert.equal(result.state,'failed');assert.equal(writes.length,1);assert.equal(writes[0].failure.reason,'accounting_evidence_unavailable');});
test('supported report preserves optional expense zero rules without emitting failure diagnostics',async()=>{const diagnostics=[];const {result}=await run(baseline(),x=>diagnostics.push(x));assert.equal(result.state,'supported');assert.equal(result.evidence.values.processingFee,0);assert.equal(result.evidence.values.advertising,0);assert.equal(result.evidence.values.software,0);assert.deepEqual(diagnostics,[]);});
