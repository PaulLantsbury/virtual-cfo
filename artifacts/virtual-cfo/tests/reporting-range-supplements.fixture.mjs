// Disposable browser-only sources. No hosted data or provider evidence.
import {createHash} from 'node:crypto';
import {rangeMonths} from './reporting-range-response.fixture.mjs';
const observedAt='2026-11-20T12:00:00Z',mappingVersion='browser-fictional-cash-v1';
const sha=value=>createHash('sha256').update(JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)).digest('hex');
const wc=()=>({stock:0,debtors:0,providerSettlements:0,supplierCredit:0,other:0});
function balances(entry){const index=rangeMonths.findIndex(e=>e.month.selection.period.from===entry.month.selection.period.from);const opening=100000+rangeMonths.slice(0,index).reduce((n,e)=>n+e.month.amounts.ebitda,0);return {opening,closing:opening+entry.month.amounts.ebitda};}
function analytics(entry){
 const {from,to}=entry.month.selection.period,days=Number(to.slice(8)),special=entry.month.selection.period.from.slice(5,7)==='01'?new Set([27,28,29,30,31]):entry.month.selection.period.from.slice(5,7)==='02'?new Set([1,2]):new Set();
 // Each selected Jan27–Feb2 day has one real fictional order. The remaining
 // monthly original orders stay on an earlier/later date outside that week.
 const residualDay=special.has(1)?3:1,residual=entry.month.originalOrders-special.size;
 const daily=Array.from({length:days},(_,i)=>{const date=from.slice(0,8)+String(i+1).padStart(2,'0'),orders=(special.has(i+1)?1:0)+(i+1===residualDay?residual:0);return {date,sessions:100,cartSessions:30,checkoutSessions:20,purchasingSessions:orders,orders,sourceHash:sha({date,orders})};});
 const totals=Object.fromEntries(['sessions','cartSessions','checkoutSessions','purchasingSessions','orders'].map(k=>[k,daily.reduce((n,r)=>n+r[k],0)]));
 return {contract:'synthetic-funnel-v1',policy:'synthetic-session-events-v1',coverage:{from,to,complete:true},daily,totals,sourceHash:sha(daily)};
}
export function browserSupplement(entry,kind,index=0){
 const m=entry.month,{from,to}=m.selection.period,bank=balances(entry),sourceRevision=sha({from,to,kind:'browser-cash'});
 const evidence={contract:'eligible-cash-v1',storeId:m.selection.storeId,currency:'GBP',timezone:'Europe/London',from,to,state:'reviewed',sourceRevision,mappingVersion,observedAt,invalidated:false,coverage:{accountsComplete:true,workingCapitalComplete:true,bankMovementsComplete:true,internalTransfersExcluded:true},accounts:[{id:'browser-fictional-bank',included:true,unrestricted:true,openingDate:from,closingDate:to,opening:bank.opening,closing:bank.closing}],ebitda:m.amounts.ebitda,workingCapital:wc(),operatingCash:m.amounts.ebitda,bankMovements:{taxAndInterest:0,investing:0,financing:0,other:0},unsettledProviderFunds:100};
 const payload=kind==='acquisition'?{...structuredClone(entry.acquisition),analytics:analytics(entry)}:{evidence,source:{contract:'synthetic-cash-journal-v1',sourceBasis:'synthetic-model',profile:'uk-gifts-v2',anchor:m.selection.anchor,from,to,sourceRevision,mappingVersion,sourcePrefixHash:'a'.repeat(64),bankLedgerHash:'b'.repeat(64),openingControlBalances:{bank:bank.opening,processor:100},closingControlBalances:{bank:bank.closing,processor:100}}};
 return {contract:'reviewed-supplement-v1',state:'supported',kind,sourceBasis:'synthetic-local',snapshotId:`90000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,financialVersionId:m.selection.versionId,salesRevision:entry.response.salesRevision,costRevision:entry.response.costRevision,scope:{storeId:m.selection.storeId,currency:'GBP',timezone:'Europe/London',from,to},observedAt,payload};
}
export function attachPartialCash(raw){
 raw.cashDatedPortions=[];
 for(const version of raw.versions){
  const from=raw.scope.from>version.from?raw.scope.from:version.from,to=raw.scope.to<version.to?raw.scope.to:version.to;
  if(from===version.from&&to===version.to)continue;
  const entry=rangeMonths.find(e=>e.month.selection.period.from===version.from);if(!entry)throw Error('No disposable monthly cash fixture');
  const days=Number(version.to.slice(8)),full=entry.month.amounts.ebitda;
  const cumulative=n=>Math.floor(full*n/days),openingBankOffsetPence=cumulative(Number(from.slice(8))-1),closingBankOffsetPence=cumulative(Number(to.slice(8))),selectedBankMovementPence=closingBankOffsetPence-openingBankOffsetPence;
  const rows=raw.dailyFinancial?.filter(d=>d.date>=from&&d.date<=to);if(!rows?.length)throw Error('Daily fictional allocation required for partial cash fixture');
  const allocatedEbitda=rows.reduce((n,d)=>n+d.netProductSales+d.netShipping-d.cogs-d.variableCosts-d.advertising-d.overheadIncludingDA+d.depreciationAmortisation,0);
  const body={state:'supported',from,to,monthFrom:version.from,monthTo:version.to,versionId:version.versionId,salesRevision:version.salesRevision,costRevision:version.costRevision,policy:'synthetic-cash-journal-v1',openingBankOffsetPence,closingBankOffsetPence,selectedBankMovementPence,fullMonthBankMovementPence:full,closingProviderOffsetPence:0,fullMonthProviderMovementPence:0,workingCapital:wc(),datedAccrualEbitda:selectedBankMovementPence,allocatedEbitda,allocatedToDatedEbitdaAdjustment:selectedBankMovementPence-allocatedEbitda};
  raw.cashDatedPortions.push({...body,proofHash:sha(body)});
 }
 return raw;
}
