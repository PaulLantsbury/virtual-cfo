import test from 'node:test';import assert from 'node:assert/strict';
import {eligibleCashView,cashProfitHistory,type CashScope,type EligibleCashEvidence} from './cashSourceAdapter.ts';
const scope:CashScope={storeId:'fictional-test',currency:'GBP',timezone:'Europe/London',from:'2026-09-01',to:'2026-09-30'};
const now=new Date('2026-10-02T12:00:00Z');
const evidence=():EligibleCashEvidence=>({contract:'eligible-cash-v1',...scope,state:'reviewed',sourceRevision:'test-source',mappingVersion:'test-map',observedAt:'2026-10-01T12:00:00Z',invalidated:false,coverage:{accountsComplete:true,workingCapitalComplete:true,bankMovementsComplete:true,internalTransfersExcluded:true},accounts:[{id:'bank-one',included:true,unrestricted:true,openingDate:scope.from,closingDate:scope.to,opening:20000000,closing:18600000}],ebitda:3553300,workingCapital:{stock:-2400000,debtors:-500000,providerSettlements:-300000,supplierCredit:1200000,other:-153300},operatingCash:1400000,bankMovements:{taxAndInterest:-800000,investing:-400000,financing:-1600000,other:0},unsettledProviderFunds:1200000});
test('eligible bank balance reconciles EBITDA to operating cash to bank without adding pending funds',()=>{const v=eligibleCashView(evidence(),scope,now)!;assert.equal(v.closingBankCash,18600000);assert.equal(v.operatingCash,1400000);assert.equal(v.bankMovement,-1400000);assert.equal(v.unsettledProviderFunds,1200000);assert.equal(v.cashLessProfit,-2153300);});
test('unknown, wrongscope, stale/invalidated, missingcoverage, duplicate/restrictedaccounts and unreconciled evidence fail closed',()=>{
 const edits=[(v:any)=>v.storeId='other',(v:any)=>v.currency='USD',(v:any)=>v.invalidated=true,(v:any)=>v.state='stale',(v:any)=>v.observedAt='2027-01-01T00:00:00Z',(v:any)=>delete v.coverage.accountsComplete,(v:any)=>v.coverage.internalTransfersExcluded=false,(v:any)=>v.accounts.push({...v.accounts[0]}),(v:any)=>v.accounts[0].unrestricted=false,(v:any)=>v.accounts[0].closingDate='2026-10-01',(v:any)=>delete v.workingCapital.stock,(v:any)=>v.operatingCash++,(v:any)=>v.accounts[0].closing++,(v:any)=>v.ebitda=NaN,(v:any)=>v.accounts[0].opening=Number.MAX_SAFE_INTEGER+1];
 for(const edit of edits){const v=evidence();edit(v);assert.equal(eligibleCashView(v,scope,now),null);}
 assert.equal(eligibleCashView({ebitda:10000},scope,now),null);assert.equal(eligibleCashView(null,scope,now),null);
});
const month=(from:string,to:string,ebitda:number|null)=>({selection:{...scope,period:{from,to}},amounts:{ebitda}});
test('cash page profit history preserves signed actual months, refuses gaps/partialmonths/missingprofits/wrongstore',()=>{
 const months=[month('2026-08-01','2026-08-31',-100),month('2026-09-01','2026-09-30',0)];assert.deepEqual(cashProfitHistory(months,scope.storeId)?.map(m=>m.ebitda),[-100,0]);
 assert.equal(cashProfitHistory(months,'other'),null);assert.equal(cashProfitHistory(months.slice(1),scope.storeId),null);
 for(const bad of [month('2026-10-01','2026-10-31',100),month('2026-09-01','2026-09-29',100),month('2026-09-01','2026-09-30',null)])assert.equal(cashProfitHistory([months[0],bad],scope.storeId),null);
});
