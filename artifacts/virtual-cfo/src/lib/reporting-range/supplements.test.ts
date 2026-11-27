import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedBrowserMonth} from '../../../tests/reviewed-pages.test-fixture.ts';
import {createHash} from 'node:crypto';
import {composeAcquisitionRange,composeCashRange,composeWholeMonthCashRange} from './supplements.ts';

function fixture(){
  const entries=['2025-01-01','2025-02-01','2025-03-01'].map(reviewedBrowserMonth);
  const months=entries.map(entry=>entry.month);
  let bank=100000;
  const raw=entries.map((entry,index)=>{
    const month=entry.month,{from,to}=month.selection.period;
    const workingCapital={stock:-5000,debtors:-100,providerSettlements:-50,supplierCredit:200,other:-20};
    const ebitda=month.amounts.ebitda!,operatingCash=ebitda+Object.values(workingCapital).reduce((a,b)=>a+b,0),opening=bank;
    const bankMovements={taxAndInterest:-100,investing:0,financing:0,other:0};bank=opening+operatingCash-100;
    const sourceRevision=String(index+1).repeat(64),mappingVersion='fixture-cash-map-v1',observedAt='2026-11-20T12:00:00Z';
    const evidence={contract:'eligible-cash-v1',storeId:month.selection.storeId,currency:'GBP',timezone:'Europe/London',from,to,state:'reviewed',sourceRevision,mappingVersion,observedAt,invalidated:false,coverage:{accountsComplete:true,workingCapitalComplete:true,bankMovementsComplete:true,internalTransfersExcluded:true},accounts:[{id:'fixture-bank',included:true,unrestricted:true,openingDate:from,closingDate:to,opening,closing:bank}],ebitda,workingCapital,operatingCash,bankMovements,unsettledProviderFunds:200+index};
    const payload={evidence,source:{contract:'synthetic-cash-journal-v1',sourceBasis:'synthetic-model',profile:'uk-gifts-v2',anchor:'2024-11-01',from,to,sourceRevision,mappingVersion,sourcePrefixHash:'a'.repeat(64),bankLedgerHash:'b'.repeat(64)}};
    return {contract:'reviewed-supplement-v1',state:'supported',kind:'cash',sourceBasis:'synthetic-local',snapshotId:`90000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,financialVersionId:month.selection.versionId,salesRevision:entry.response.salesRevision,costRevision:entry.response.costRevision,scope:{storeId:month.selection.storeId,currency:'GBP',timezone:'Europe/London',from,to},observedAt,payload};
  });
  const financial={...months[0],selection:{...months[0].selection,versionId:'range-fixture',period:{from:months[0].selection.period.from,to:months.at(-1)!.selection.period.to}},amounts:{...months[0].amounts,ebitda:months.reduce((n,m)=>n+m.amounts.ebitda!,0)},range:{months}};
  return {months,raw,financial};
}

test('whole-month cash sums signed flows but keeps first opening and last closing/balances',async()=>{
  const {months,raw,financial}=fixture(),result=await composeWholeMonthCashRange(months,raw,financial);
  assert.ok(result);assert.equal(result.cash.openingBankCash,100000);assert.equal(result.cash.closingBankCash,89290);
  assert.equal(result.cash.operatingCash,-10410);assert.equal(result.evidence.ebitda,4500);assert.equal(result.cash.bankMovement,-10710);assert.equal(result.cash.cashLessProfit,-14910);
  assert.equal(result.cash.unsettledProviderFunds,202,'Unsettled closing funds are a balance, not a sum');
  assert.deepEqual(result.evidence.workingCapital,{stock:-15000,debtors:-300,providerSettlements:-150,supplierCredit:600,other:-60});
  assert.equal(result.source.contract,'verified-monthly-cash-range-v1');assert.equal(result.evidence.contract,'eligible-cash-range-v1');assert.match(result.source.rangeHash,/^[a-f0-9]{64}$/);assert.equal(result.source.dependencies.length,3);
  assert.equal(Object.isFrozen(result.evidence.workingCapital),true);
});
test('missing, stale or mismatched supplemental evidence fails closed',async()=>{
  for(const edit of [
    (v:any)=>v.raw.pop(),(v:any)=>v.raw[1].financialVersionId='wrong',
    (v:any)=>v.raw[1].salesRevision='a'.repeat(64),(v:any)=>v.raw[1].scope.storeId='other',
    (v:any)=>v.raw[1].payload.evidence.invalidated=true,(v:any)=>delete v.raw[1].payload.evidence.workingCapital.stock,
    (v:any)=>v.raw[1].payload.evidence.accounts[0].unrestricted=false,
    (v:any)=>v.raw[1].observedAt='2025-01-01T00:00:00Z',
    (v:any)=>v.raw[1].payload.evidence.ebitda++,
  ]){const v=structuredClone(fixture());edit(v);assert.equal(await composeWholeMonthCashRange(v.months,v.raw,v.financial),null);}
});
test('partial ranges, gaps, duplicates, cross-store financial scope and missing profit cannot become cash',async()=>{
  for(const edit of [
    (v:any)=>v.financial.selection.period.from='2025-01-02',
    (v:any)=>v.financial.selection.period.to='2025-03-17',
    (v:any)=>{v.months.splice(1,1);v.raw.splice(1,1);v.financial.range.months=v.months;},
    (v:any)=>{v.months[1]=v.months[0];v.raw[1]=v.raw[0];v.financial.range.months=v.months;},
    (v:any)=>v.financial.selection.storeId='other',
    (v:any)=>v.financial.amounts.ebitda++,
    (v:any)=>v.months[1].evidence.costCoverage='unavailable',
    (v:any)=>v.months[1].amounts.ebitda=null,
  ]){const v=structuredClone(fixture());edit(v);assert.equal(await composeWholeMonthCashRange(v.months,v.raw,v.financial),null);}
});
test('monthly mapping/account changes and per-account discontinuity cannot hide behind total bank continuity',async()=>{
  for(const edit of [
    (v:any)=>{v.raw[1].payload.evidence.mappingVersion='new-map';v.raw[1].payload.source.mappingVersion='new-map';},
    (v:any)=>v.raw[1].payload.evidence.accounts[0].id='new-bank',
    (v:any)=>{const a=v.raw[1].payload.evidence.accounts[0];a.opening++;a.closing++;},
  ]){const v=structuredClone(fixture());edit(v);assert.equal(await composeWholeMonthCashRange(v.months,v.raw,v.financial),null);}
});
test('fingerprint binds constituent versions and cloned input cannot mutate returned range',async()=>{
  const v=fixture(),result=await composeWholeMonthCashRange(v.months,v.raw,v.financial);assert.ok(result);
  const again=await composeWholeMonthCashRange(v.months,v.raw,v.financial);assert.equal(result.source.rangeHash,again!.source.rangeHash);
  v.raw[0].snapshotId='90000000-0000-4000-8000-000000000099';
  const changed=await composeWholeMonthCashRange(v.months,v.raw,v.financial);assert.ok(changed);assert.notEqual(changed.source.rangeHash,result.source.rangeHash);
  v.raw[0].payload.evidence.accounts[0].opening=0;assert.equal(result.evidence.accounts[0].opening,100000);
});

test('whole-month acquisition sums additive inputs and recomputes ratios without summing people/cohorts',async()=>{
 const v=acqFixture(),r=await composeAcquisitionRange(v.months,v.raw,v.financial);assert.ok(r);
 assert.equal(r.coverage.originalOrders,33);assert.equal(r.coverage.paidFirstCustomers,12);assert.equal(r.spend.advertising,1800);assert.equal(r.spend.acquisition,600);assert.equal(r.cac,50);
 assert.equal(r.revenue.netProductSales,27000);assert.equal(r.revenue.identifiedRepeat,6000);assert.equal(r.customerActivityView,null);assert.equal(r.customerActivity,undefined);
 assert.equal(r.economicsView?.firstOrderContribution,500);assert.equal(r.economicsView?.mature,null);assert.equal(r.contract,'synthetic-acquisition-range-v1');
});
function acqFixture(){
 const v=fixture(),entries=['2025-01-01','2025-02-01','2025-03-01'].map(reviewedBrowserMonth);
 const raw=v.raw.map((r,i)=>({...r,kind:'acquisition',payload:entries[i].acquisition}));
 const financial={...v.financial,originalOrders:33,input:{...v.financial.input,profit:{...v.financial.input.profit,advertising:{state:'ready',value:1800}}},amounts:{...v.financial.amounts,netProductSales:27000}};
 return {...v,raw,financial};
}
test('acquisition ranges refuse stale sources and partial identity allocations',async()=>{
 const v=acqFixture();v.raw[1].financialVersionId='wrong';assert.equal(await composeAcquisitionRange(v.months,v.raw,v.financial),null);
 const p=acqFixture();p.financial.selection.period.from='2025-01-16';p.financial.originalOrders=20;
 const r=await composeAcquisitionRange(p.months,p.raw,p.financial);assert.ok(r);assert.equal(r.coverage.originalOrders,20);assert.equal(r.coverage.identifiedFirstOrders,null);assert.equal(r.spend.acquisition,null);assert.equal(r.revenue.identifiedRepeat,null);assert.equal(r.cac,null);assert.equal(r.economicsView,null);assert.equal(r.analytics,undefined);
});
test('partial cash preserves actual balances and exposes the cost timing adjustment',async()=>{
 const v=partialFixture(),r=await composeCashRange(v.months,v.raw,v.financial);assert.ok(r);
 assert.equal(r.cash.openingBankCash,99000);assert.equal(r.cash.closingBankCash,98500);assert.equal(r.cash.bankMovement,-500);assert.equal(r.evidence.ebitda,800);assert.equal(r.evidence.allocatedToDatedEbitdaAdjustment,-300);assert.equal(r.evidence.workingCapital.stock,-1000);assert.equal(r.cash.operatingCash,-500);assert.equal(r.cash.unsettledProviderFunds,180);
});
function partialFixture(){
 const v=fixture(),months=v.months.slice(0,1),raw=v.raw.slice(0,1),source:any=raw[0].payload.source;
 // The complete canonical monthly source has no external bank movements.
 const e=raw[0].payload.evidence;e.bankMovements.taxAndInterest=0;e.accounts[0].closing+=100;
 source.openingControlBalances={bank:e.accounts[0].opening,processor:100};source.closingControlBalances={bank:e.accounts[0].closing,processor:200};
 const body={state:'supported',from:'2025-01-16',to:'2025-01-30',monthFrom:'2025-01-01',monthTo:'2025-01-31',versionId:months[0].selection.versionId,salesRevision:months[0].evidence.salesRevision,costRevision:months[0].evidence.costRevision,policy:'synthetic-cash-journal-v1',openingBankOffsetPence:-1000,closingBankOffsetPence:-1500,selectedBankMovementPence:-500,fullMonthBankMovementPence:e.accounts[0].closing-e.accounts[0].opening,closingProviderOffsetPence:80,fullMonthProviderMovementPence:100,workingCapital:{stock:-1000,debtors:0,providerSettlements:0,supplierCredit:0,other:0},datedAccrualEbitda:500,allocatedEbitda:800,allocatedToDatedEbitdaAdjustment:-300};
 const proofHash=createHash('sha256').update(JSON.stringify(body,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x)).digest('hex');
 const financial={...months[0],selection:{...months[0].selection,period:{from:body.from,to:body.to}},amounts:{...months[0].amounts,ebitda:800},range:{months,cashDatedPortions:[{...body,proofHash}]}};
 return {months,raw,financial};
}
test('partial cash rejects unmatched provenance, edited portions, control gaps and fabricated balances',async()=>{
 for(const edit of [(v:any)=>v.financial.range.cashDatedPortions[0].proofHash='a'.repeat(64),(v:any)=>v.financial.range.cashDatedPortions[0].costRevision='a'.repeat(64),(v:any)=>v.raw[0].payload.source.closingControlBalances.processor++,(v:any)=>delete v.raw[0].payload.source.openingControlBalances,(v:any)=>v.financial.amounts.ebitda++,(v:any)=>v.financial.range.cashDatedPortions.push(v.financial.range.cashDatedPortions[0])]){const v=partialFixture();edit(v);assert.equal(await composeCashRange(v.months,v.raw,v.financial),null);}
});

test('partial funnel uses actual selected daily counts and preserves purchasing sessions as numerator',async()=>{
 const v=acqFixture();
 for(let i=0;i<v.raw.length;i++){
  const {from,to}=v.months[i].selection.period;const days=Number(to.slice(8));
  const daily=Array.from({length:days},(_,d)=>({date:from.slice(0,8)+String(d+1).padStart(2,'0'),sessions:100,cartSessions:20,checkoutSessions:15,purchasingSessions:d===0?9:0,orders:d===0?10+i:0,sourceHash:'c'.repeat(64)}));
  (v.raw[i].payload as any).analytics={contract:'synthetic-funnel-v1',policy:'synthetic-session-events-v1',coverage:{from,to,complete:true},daily,totals:{sessions:days*100,cartSessions:days*20,checkoutSessions:days*15,purchasingSessions:9,orders:10+i},sourceHash:'d'.repeat(64)};
 }
 v.financial.selection.period.from='2025-01-02';v.financial.originalOrders=23;
 const r=await composeAcquisitionRange(v.months,v.raw,v.financial);assert.ok(r?.analytics);assert.equal(r.analytics.totals.orders,23);assert.equal(r.analytics.totals.purchasingSessions,18);assert.equal(r.analytics.daily.length,89);assert.equal(r.funnel?.conversion,18/8900);assert.equal(r.funnel?.checkoutRate,15/100);assert.equal(r.coverage.identifiedFirstOrders,null);assert.equal(r.cac,null);
 v.financial.originalOrders=22;assert.equal(await composeAcquisitionRange(v.months,v.raw,v.financial),null);
});
