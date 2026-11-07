import test from 'node:test';import assert from 'node:assert/strict';
import {extractSelectedAccountTotals} from './selected-account-totals.mjs';
import {runStagingXeroRefresh} from './staging-refresh-orchestrator.mjs';
const mapping={revenue:['revenue'],processingFee:['fees'],advertising:['ads'],software:['software'],includedCash:['cash']};
const row=(id,value)=>({RowType:'Row',Cells:[{Value:'PRIVATE',Attributes:[{Id:'account',Value:id}]},{Value:value}]});
const report=(ReportID,Rows)=>({Reports:[{ReportID,Rows}]});
const bankRow=closing=>({RowType:'Row',Cells:[{Value:'PRIVATE',Attributes:[{Id:'accountID',Value:'cash'}]},...['111.11','222.22','333.33',closing].map(Value=>({Value,Attributes:[{Id:'accountID',Value:'cash'}]}))]});
const header=()=>({RowType:'Header',Cells:['Bank Accounts','Opening Balance','Cash Received','Cash Spent','Closing Balance'].map(Value=>({Value}))});
const input=()=>({mapping,profitAndLoss:report('ProfitAndLoss',[row('revenue','10.00')]),balanceSheet:report('BalanceSheet',[]),bankSummary:report('BankSummary',[header(),{RowType:'Section',Rows:[bankRow('444.44')]}]),bankSummaryContext:{from:'2026-10-01',to:'2026-10-10',snapshotFrom:'2026-10-01',snapshotTo:'2026-10-10',currency:'GBP',baseCurrency:'GBP',accountDirectory:{Accounts:[{AccountID:'cash',Type:'BANK',Status:'ACTIVE',CurrencyCode:'GBP'}]}}});
test('uses explicitly labelled closing column rather than opening or movements, including signed and explicit zero balances',()=>{for(const [raw,expected] of [['444.44',44444],['0.00',0],['-25.50',-2550],['1,000.00',100000]]){const x=input();x.bankSummary.Reports[0].Rows[1].Rows[0]=bankRow(raw);assert.equal(extractSelectedAccountTotals(x).cash,expected);}});
test('primary balance sheet stays authoritative and malformed primary is never bypassed',()=>{const x=input();x.balanceSheet=report('BalanceSheet',[row('cash','99.00')]);x.bankSummary={PRIVATE:'broken'};assert.equal(extractSelectedAccountTotals(x).cash,9900);for(const modify of [v=>v.balanceSheet.Reports[0].ReportID='Other',v=>v.balanceSheet.Reports[0].Rows=[row('cash','not-money')],v=>v.balanceSheet.Reports[0].Rows=[row('cash','1.00'),row('cash','2.00')],v=>v.balanceSheet.Reports.push(v.balanceSheet.Reports[0])]){const v=input();modify(v);assert.throws(()=>extractSelectedAccountTotals(v),/unavailable/);}});
for(const [label,modify] of [
 ['foreign account currency',x=>x.bankSummaryContext.accountDirectory.Accounts[0].CurrencyCode='USD'],
 ['missing account currency',x=>delete x.bankSummaryContext.accountDirectory.Accounts[0].CurrencyCode],
 ['oversized directory',x=>x.bankSummaryContext.accountDirectory.Accounts.push(...Array.from({length:500},(_,i)=>({AccountID:'other'+i})))],
 ['unknown directory',x=>delete x.bankSummaryContext.accountDirectory],
 ['inactive account',x=>x.bankSummaryContext.accountDirectory.Accounts[0].Status='ARCHIVED'],
 ['not bank',x=>x.bankSummaryContext.accountDirectory.Accounts[0].Type='CURRENT'],
 ['duplicate directory',x=>x.bankSummaryContext.accountDirectory.Accounts.push(x.bankSummaryContext.accountDirectory.Accounts[0])],
 ['foreign base currency',x=>x.bankSummaryContext.baseCurrency='USD'],
 ['foreign reporting currency',x=>x.bankSummaryContext.currency='USD'],
 ['wrong cutoff',x=>x.bankSummaryContext.snapshotTo='2026-10-09'],
 ['wrong start',x=>x.bankSummaryContext.snapshotFrom='2026-09-01'],
 ['invalid day',x=>x.bankSummaryContext.to='2026-02-30'],
 ['missing closing label',x=>x.bankSummary.Reports[0].Rows[0].Cells[4].Value='Total'],
 ['ambiguous movement header',x=>x.bankSummary.Reports[0].Rows[0].Cells[2].Value='Closing Balance (foreign currency)'],
 ['duplicate closing label',x=>x.bankSummary.Reports[0].Rows[0].Cells[1].Value='Closing Balance'],
 ['wrong column',x=>{const c=x.bankSummary.Reports[0].Rows[0].Cells;[c[1],c[4]]=[c[4],c[1]];}],
 ['duplicate header',x=>x.bankSummary.Reports[0].Rows.push(header())],
 ['missing account row',x=>x.bankSummary.Reports[0].Rows[1].Rows=[]],
 ['duplicate account row',x=>x.bankSummary.Reports[0].Rows[1].Rows.push(bankRow('1.00'))],
 ['conflicting attributes',x=>x.bankSummary.Reports[0].Rows[1].Rows[0].Cells[4].Attributes[0].Value='other'],
 ['missing closing amount',x=>x.bankSummary.Reports[0].Rows[1].Rows[0].Cells[4].Value=''],
 ['malformed closing amount',x=>x.bankSummary.Reports[0].Rows[1].Rows[0].Cells[4].Value='PRIVATE MONEY'],
 ['wrong width',x=>x.bankSummary.Reports[0].Rows[1].Rows[0].Cells.pop()],
])test(`fails closed for ${label}`,()=>{const x=input();modify(x);assert.throws(()=>extractSelectedAccountTotals(x),/unavailable/);});
test('orchestrator applies cutoff and GBP directory gates without persisting raw BankSummary or Accounts',async()=>{const x=input(),writes=[];const scope={from:'2026-10-01',to:'2026-10-10',currency:'GBP'};const snapshot={from:scope.from,to:scope.to,date:scope.to,tenantId:'private',organisation:{Organisations:[{BaseCurrency:'GBP'}]},profitAndLoss:x.profitAndLoss,balanceSheet:x.balanceSheet,bankSummary:x.bankSummary,accountDirectory:x.bankSummaryContext.accountDirectory,trialBalance:{}};const result=await runStagingXeroRefresh({connection:{id:'connection',tenantId:'private'},scope,mapping,readSnapshot:async()=>snapshot,persist:{writeSupported:async v=>writes.push(v),writeFailure:async v=>writes.push(v)}});assert.equal(result.state,'supported');assert.equal(result.evidence.values.includedCash,44444);assert.doesNotMatch(JSON.stringify(writes),/AccountID|CurrencyCode|Closing Balance|PRIVATE|111\.11|222\.22|333\.33/);});

test('unverified fallback currency emits bounded diagnostic and persists no financial or raw report values',async()=>{const x=input(),diagnostics=[],writes=[],scope={from:'2026-10-01',to:'2026-10-10',currency:'GBP'};delete x.bankSummaryContext.accountDirectory.Accounts[0].CurrencyCode;const result=await runStagingXeroRefresh({connection:{id:'connection',tenantId:'private'},scope,mapping,readSnapshot:async()=>({from:scope.from,to:scope.to,date:scope.to,tenantId:'private',organisation:{Organisations:[{BaseCurrency:'GBP'}]},profitAndLoss:x.profitAndLoss,balanceSheet:x.balanceSheet,bankSummary:x.bankSummary,accountDirectory:x.bankSummaryContext.accountDirectory,trialBalance:{}}),diagnose:v=>diagnostics.push(v),persist:{writeSupported:async v=>writes.push(v),writeFailure:async v=>writes.push(v)}});assert.equal(result.state,'failed');assert.deepEqual(diagnostics,[{event:'xero_accounting_evidence_failed',phase:'selected_account_totals',reason:'cash_currency_unverified',report:'BankSummary',category:'includedCash'}]);assert.equal(writes[0].failure.reason,'accounting_evidence_unavailable');assert.doesNotMatch(JSON.stringify(diagnostics),/PRIVATE|cash'|CurrencyCode|111|444/);});

test('partial primary cash mapping never mixes BankSummary amounts into incomplete BalanceSheet',()=>{const x=input();x.mapping={...mapping,includedCash:['cash','cash2']};x.balanceSheet=report('BalanceSheet',[row('cash','99.00')]);assert.throws(()=>extractSelectedAccountTotals(x),error=>error.safeReason==='required_account_missing'&&error.safeReport==='BalanceSheet');});
