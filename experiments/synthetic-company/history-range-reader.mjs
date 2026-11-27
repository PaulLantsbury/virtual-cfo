/** Read-only range composition over already validated complete historical months.
 * Authority, rows and corrections are supplied only by the trusted history reader,
 * in its member-scoped repeatable-read transaction. No generator or source writes. */
import {calculateMappedSales} from '../financial-v1/cloud-sales-adapter.mjs';
import {profitBridge} from '../financial-v1/calculations.mjs';
import {profitEvidenceDigest as digest} from '../financial-v1/profit-evidence-reader.mjs';
import {allocateMonthlyRecurringCost,MONTHLY_COST_ALLOCATION_METHOD} from '../financial-v1/monthly-cost-allocation.mjs';
import {HISTORY_EDITION,HISTORY_FORMULA,historyToday,historySourceAsOf} from './history-context.mjs';

export const HISTORY_RANGE_CONTRACT='history-range-v1';
export const SYNTHETIC_PAYROLL_ALLOCATION_POLICY='uk-gifts-v2-monthly-payroll-recurring-v1';
const recurring=new Set(['salary','employer','pension']);
// These synthetic accruals already have reliable dated source rows. They are
// not spread a second time merely because their monthly sum is also available.
const dated=new Set(['storage','returns','pickPack','carrier','packaging','processor','marketing','premises','software','insurance','utilities','professional','depreciation']);
const operatingBankKinds=new Set(['processor_payout','refund','processor_fee','supplier_payment','payroll_payment','payroll_remittance','vat_settlement']);
const workingCapitalAccounts={stock:['inventory'],debtors:[],providerSettlements:['processor'],supplierCredit:['supplier_payable','accrued_payable'],other:['vat_control','net_payable','payroll_liability']};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!v.startsWith('0000')&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
const monthStart=v=>v.slice(0,7)+'-01';
const monthEnd=v=>{const d=new Date(monthStart(v)+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);d.setUTCDate(0);return d.toISOString().slice(0,10);};
const nextMonth=v=>{const d=new Date(v+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);return d.toISOString().slice(0,10);};
const ensure=(v,m)=>{if(!v)throw Error(m);};
const safe=n=>{ensure(Number.isSafeInteger(n),'Unsafe range amount');return n;};
const sum=values=>{ensure(values.every(Number.isSafeInteger),'Incomplete range amount');return safe(Number(values.reduce((n,v)=>n+BigInt(v),0n)));};
const ratio=(n,d)=>({value:d>0?n/d:null,reason:d>0?null:'Non-positive denominator policy unresolved'});
const unavailable=reason=>({state:'unavailable',contract:HISTORY_RANGE_CONTRACT,reason});

export function validHistoryRangeScope(scope){
 return !!scope&&typeof scope==='object'&&!Array.isArray(scope)&&Object.keys(scope).sort().join(',')==='currency,from,storeId,to'
  &&uuid(scope.storeId)&&scope.currency==='GBP'&&day(scope.from)&&day(scope.to)&&scope.from<=scope.to
  &&((Number(scope.to.slice(0,4))-Number(scope.from.slice(0,4)))*12+Number(scope.to.slice(5,7))-Number(scope.from.slice(5,7)))<24;
}
export function requiredHistoryRangeMonths(scope){
 if(!validHistoryRangeScope(scope))return [];
 const months=[];for(let from=monthStart(scope.from);from<=scope.to;from=nextMonth(from))months.push({from,to:monthEnd(from)});
 return months;
}
function checkedSelection(scope,selection){
 const months=requiredHistoryRangeMonths(scope);
 if(!selection||typeof selection!=='object'||Object.keys(selection).sort().join(',')!=='edition,versions'||selection.edition!==HISTORY_EDITION||!Array.isArray(selection.versions)||selection.versions.length!==months.length||months.length===0)return null;
 for(let i=0;i<months.length;i++){
  const v=selection.versions[i];if(!v||Object.keys(v).sort().join(',')!=='from,to,versionId'||v.from!==months[i].from||v.to!==months[i].to||!uuid(v.versionId))return null;
 }
 return months.map((month,i)=>({...month,versionId:selection.versions[i].versionId}));
}
function payroll(report,{requireMonthly=false}={}){
 const totals={salary:0,employer:0,pension:0};
 const staff=new Set(),categories=new Set();
 ensure(Array.isArray(report.costEvents),'Dated range cost evidence missing');
 for(const row of report.costEvents){
  const event=row?.body;ensure(event&&Array.isArray(event.postings),'Dated cost source missing');
  for(const posting of event.postings){
   if(!posting.account.startsWith('expense:'))continue;
   const category=posting.account.slice(8);safe(posting.amount);
   if(recurring.has(category)){
    ensure(event.kind==='payroll_accrual'&&typeof event.refs?.staffId==='string'&&/^fictional-staff-[1-4]$/.test(event.refs.staffId),'Recurring payroll classification unsupported');
    staff.add(event.refs.staffId);categories.add(category);
    totals[category]=sum([totals[category],posting.amount]);
   }else ensure(dated.has(category),'Unclassified range cost');
  }
 }
 if(requireMonthly)ensure(staff.size===4&&categories.size===3,'Complete classified monthly payroll source required');
 return totals;
}
/** Actual journal movements only. These offsets are NOT bank balances: a caller
 * must still verify the matching monthly cash proof and its opening balance. */
function datedCashPortion(fullCosts,slice,components,part,m,report){
 const bound={from:part.from,to:part.to,monthFrom:m.from,monthTo:m.to,versionId:m.versionId,salesRevision:report.salesRevision,costRevision:report.costRevision,policy:'synthetic-cash-journal-v1'};
 try{
  ensure(Array.isArray(fullCosts.salesManifest?.sourceEvents),'Full validated journal witness missing');
  const rows=fullCosts.salesManifest.sourceEvents.filter(row=>row.event_date>=m.from&&row.event_date<=m.to&&row.body?.kind!=='opening');
  const ids=new Set();for(const row of rows){
   ensure(typeof row.source_id==='string'&&!ids.has(row.source_id)&&day(row.event_date)&&row.body?.date===row.event_date&&Array.isArray(row.body?.postings),'Invalid dated cash witness');ids.add(row.source_id);
   ensure(sum(row.body.postings.map(p=>p.amount))===0,'Unbalanced dated cash witness');
   const bank=sum(row.body.postings.filter(p=>p.account==='bank').map(p=>p.amount));
   ensure(bank===0||operatingBankKinds.has(row.body.kind),'Unclassified bank movement');
  }
  const accountSum=(chosen,account)=>sum(chosen.flatMap(row=>row.body.postings.filter(p=>p.account===account).map(p=>p.amount)));
  const through=rows.filter(row=>row.event_date<=part.to),before=rows.filter(row=>row.event_date<part.from),selected=through.filter(row=>row.event_date>=part.from);
  const workingCapital=Object.fromEntries(Object.entries(workingCapitalAccounts).map(([category,accounts])=>[category,-sum(accounts.map(account=>accountSum(selected,account)))]));
  const datedAccrualEbitda=safe(slice.profit?.ebitda),allocatedEbitda=safe(profitBridge({...slice.sales,...components}).ebitda);
  const selectedBankMovementPence=accountSum(selected,'bank');
  ensure(sum([datedAccrualEbitda,...Object.values(workingCapital)])===selectedBankMovementPence,'Actual dated profit/cash bridge does not reconcile');
  const result={state:'supported',...bound,openingBankOffsetPence:accountSum(before,'bank'),closingBankOffsetPence:accountSum(through,'bank'),selectedBankMovementPence,fullMonthBankMovementPence:accountSum(rows,'bank'),closingProviderOffsetPence:accountSum(through,'processor'),fullMonthProviderMovementPence:accountSum(rows,'processor'),workingCapital,datedAccrualEbitda,allocatedEbitda,allocatedToDatedEbitdaAdjustment:safe(datedAccrualEbitda-allocatedEbitda)};
  return {...result,proofHash:digest(result)};
 }catch{return {state:'unavailable',...bound,reason:'Independent dated cash sources could not be reconciled'};}
}

/** Compact dates derived from a full, hash-checked monthly witness; no source rows escape. */
export function validatedHistoryDaily(witness,full,versionId){
 const payrollTotals=payroll(witness,{requireMonthly:true});
 const mapped=witness.originalOrders.map(({body:o,event_date})=>({id:o.id,store_id:full.storeId,currency:o.currency,day:event_date,mapping_state:'verified',original_eligible:true,tax_basis:'exclusive',gross:o.gross_sales,discount:o.discounts,gross_vat:o.gross_product_vat,discount_vat:o.discount_vat,shipping:o.shipping,shipping_vat:o.shipping_vat}));
 const refunds=witness.priorRefunds.map(({body:r,event_date})=>({...r,currency:full.currency,day:event_date,mapping_state:'verified'}));
 const lineMap=new Map(witness.selectedLines.map(row=>[row.source_id,row]));
 const result=[];
 for(let date=full.from;date<=full.to;){
  const scope={...full,from:date,to:date};
  const sales=calculateMappedSales({orders:mapped,refunds,coverage:[{store_id:full.storeId,currency:full.currency,date_from:date,date_to:date,sales_and_refunds_complete:true,evidence_ref:'validated-month:'+versionId}]},scope);
  let cogs=sum(witness.selectedLines.filter(row=>row.event_date===date).map(row=>row.body.quantity*row.body.historic_unit_cost_pence));
  for(const row of witness.selectedReturns.filter(row=>row.event_date===date)){const line=lineMap.get(row.body.line_id);ensure(line,'Missing daily returned unit');cogs=safe(cogs-row.body.quantity*line.body.historic_unit_cost_pence);}
  const components={cogs,variableCosts:0,advertising:0,overheadIncludingDA:0,depreciationAmortisation:0};
  for(const row of witness.costEvents.filter(row=>row.event_date===date))for(const posting of row.body.postings){
   if(!posting.account.startsWith('expense:'))continue;const category=posting.account.slice(8);if(recurring.has(category))continue;
   if(['storage','returns','pickPack','carrier','packaging','processor'].includes(category))components.variableCosts=safe(components.variableCosts+posting.amount);
   else if(category==='marketing')components.advertising=safe(components.advertising+posting.amount);
   else{ensure(dated.has(category),'Unclassified daily cost');components.overheadIncludingDA=safe(components.overheadIncludingDA+posting.amount);if(category==='depreciation')components.depreciationAmortisation=safe(components.depreciationAmortisation+posting.amount);}
  }
  for(const costId of recurring){const allocation=allocateMonthlyRecurringCost({storeId:full.storeId,currency:full.currency,costId,from:date,to:date,sources:[{storeId:full.storeId,currency:full.currency,costId,month:full.from.slice(0,7),sourceVersionId:versionId,selection:'selected',amountPence:payrollTotals[costId],coverage:{complete:true,from:full.from,to:full.to},classification:{type:'recurring-monthly',approved:true,approvalId:SYNTHETIC_PAYROLL_ALLOCATION_POLICY}}]});ensure(allocation.state==='supported','Daily payroll allocation unavailable');components.overheadIncludingDA=safe(components.overheadIncludingDA+allocation.valuePence);}
  result.push({date,versionId,sales:Object.fromEntries(['grossProductSales','discounts','originalOrders','netProductSales','netShipping','productRefundExVat','productRefundVat','shippingRefundExVat','shippingRefundVat','cashRefunded'].map(key=>[key,safe(sales[key])])),components,profit:profitBridge({...sales,...components})});
  const next=new Date(date+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);date=next.toISOString().slice(0,10);
 }
 return result;
}

/** Trusted callbacks must return validated current monthly reports and hash-checked
 * actual-date slices with the same selected correction overlays. */
export async function readHistoryRangeInTransaction(tx,scope,{selection,now=()=>new Date(),readMonth,readSlice,readDaily}={}){
 if(!validHistoryRangeScope(scope)||typeof readMonth!=='function'||typeof readSlice!=='function')return unavailable('Invalid historical range selection');
 const months=checkedSelection(scope,selection),clock=now();
 if(!months||!Number.isFinite(+clock)||scope.to>=historyToday(clock))return unavailable('Complete selected monthly sources are required for this range');
 try{
  const verified=[];
  // Validate every constituent month before exposing even a partial range. An
  // unavailable/open month cannot be replaced by a prior month or a zero.
  for(const m of months){
   const full={...scope,from:m.from,to:m.to},chosen={edition:HISTORY_EDITION,versionId:m.versionId};
   const report=await readMonth(tx,full,{now:()=>clock,selection:chosen});
   ensure(report?.state==='supported'&&report.contract==='history-v2-proposal'&&report.versionId===m.versionId&&report.scope?.storeId===scope.storeId&&report.scope?.currency===scope.currency&&report.scope?.from===m.from&&report.scope?.to===m.to&&report.profit?.state==='complete','A constituent monthly source is unavailable');
   ensure(report.metadata?.edition===HISTORY_EDITION&&report.metadata.formulaVersion===HISTORY_FORMULA&&report.metadata.sourceBasis==='synthetic-local'&&/^[a-f0-9]{64}$/.test(report.salesRevision)&&/^[a-f0-9]{64}$/.test(report.costRevision)&&day(report.metadata.anchor)&&report.metadata.anchor<=m.from&&report.metadata.sourceAsOf===historySourceAsOf(m.to)&&Number.isFinite(Date.parse(report.metadata.observedAt))&&Date.parse(report.metadata.observedAt)>=Date.parse(report.metadata.sourceAsOf)&&Date.parse(report.metadata.observedAt)<=+clock,'Constituent source provenance missing');
   verified.push({m,full,chosen,report});
  }
  const anchor=verified[0].report.metadata.anchor;
  ensure(verified.every(v=>v.report.metadata.anchor===anchor),'Mixed history anchors');
  const versions=verified.map(({m,report})=>({...m,salesRevision:report.salesRevision,costRevision:report.costRevision}));
  const parts=[],portions=[],cashDatedPortions=[];let allocated=false;
  for(const {m,full,chosen,report}of verified){
   const part={...scope,from:scope.from>m.from?scope.from:m.from,to:scope.to<m.to?scope.to:m.to};
   if(part.from===m.from&&part.to===m.to){parts.push({sales:report.sales,components:report.components,datedOverhead:report.components.overheadIncludingDA});continue;}
   const slice=await readSlice(tx,full,chosen,part,{now:()=>clock});
   ensure(slice?.sales&&slice.components,'Dated range slice unavailable');
   // The trusted adapter gives full cost witnesses without adding raw rows to
   // the public monthly response. Slice witnesses are independently hashed.
   const fullCosts=await readSlice(tx,full,chosen,full,{now:()=>clock});
   const monthlyPayroll=payroll(fullCosts,{requireMonthly:true}),datedPayroll=payroll(slice);
   let allocatedPayroll=0;
   for(const costId of recurring){
    const allocation=allocateMonthlyRecurringCost({storeId:scope.storeId,currency:scope.currency,costId,from:part.from,to:part.to,sources:[{storeId:scope.storeId,currency:scope.currency,costId,month:m.from.slice(0,7),sourceVersionId:m.versionId,selection:'selected',amountPence:monthlyPayroll[costId],coverage:{complete:true,from:m.from,to:m.to},classification:{type:'recurring-monthly',approved:true,approvalId:SYNTHETIC_PAYROLL_ALLOCATION_POLICY}}]});
    ensure(allocation.state==='supported','Recurring cost allocation unavailable');
    allocatedPayroll=sum([allocatedPayroll,allocation.valuePence]);
    portions.push(...allocation.portions.map(p=>({...p,costId,methodVersion:allocation.methodVersion})));
   }
   const components={...slice.components,overheadIncludingDA:sum([slice.components.overheadIncludingDA,-sum(Object.values(datedPayroll)),allocatedPayroll])};
   cashDatedPortions.push(datedCashPortion(fullCosts,slice,components,part,m,report));
   parts.push({sales:slice.sales,components,datedOverhead:slice.components.overheadIncludingDA});allocated=true;
  }
  const salesKeys=['grossProductSales','discounts','originalOrders','netProductSales','netShipping','productRefundExVat','productRefundVat','shippingRefundExVat','shippingRefundVat','cashRefunded'];
  const sales={...parts[0].sales};for(const key of salesKeys)sales[key]=sum(parts.map(p=>p.sales[key]));
  sales.hasRefundActivity=parts.some(p=>p.sales.hasRefundActivity);sales.hasActivity=parts.some(p=>p.sales.hasActivity);
  sales.aov=ratio(safe(sales.grossProductSales-sales.discounts),sales.originalOrders);sales.discountRate=ratio(sales.discounts,sales.grossProductSales);
  const components=Object.fromEntries(['cogs','variableCosts','advertising','overheadIncludingDA','depreciationAmortisation'].map(key=>[key,sum(parts.map(p=>p.components[key]))]));
  const profit=profitBridge({...sales,...components});
  const daily=typeof readDaily==='function'?verified.flatMap(({full,chosen})=>readDaily(full,chosen)).filter(row=>row.date>=scope.from&&row.date<=scope.to):[];
  if(typeof readDaily==='function'){
   ensure(daily.length===(Date.parse(scope.to)-Date.parse(scope.from))/86400000+1&&daily.length<=731,'Incomplete daily range');
   for(const key of salesKeys)ensure(sum(daily.map(row=>row.sales[key]))===sales[key],'Daily sales do not conserve range total');
   for(const key of Object.keys(components))ensure(sum(daily.map(row=>row.components[key]))===components[key],'Daily costs do not conserve range total');
  }
  const rangeId=digest({contract:HISTORY_RANGE_CONTRACT,scope,versions,formulaVersion:HISTORY_FORMULA,method:MONTHLY_COST_ALLOCATION_METHOD,policy:SYNTHETIC_PAYROLL_ALLOCATION_POLICY,sales:{...sales,provenance:undefined},components,cashDatedPortions,daily});
  sales.provenance={storeId:scope.storeId,currency:scope.currency,from:scope.from,to:scope.to,coverageEvidence:`history-range:${rangeId}`};
  const datedAccrualOverheadIncludingDA=sum(parts.map(p=>p.datedOverhead));
  const monthlyResponses=verified.map(({report})=>Object.fromEntries(['state','contract','versionId','snapshotId','metadata','scope','sales','components','profit','report','cfoBriefing','salesRevision','costRevision'].filter(key=>report[key]!==undefined).map(key=>[key,report[key]])));
  return {state:'supported',contract:HISTORY_RANGE_CONTRACT,rangeId,scope:{...scope,timezone:'Europe/London'},versions,monthlyResponses,cashDatedPortions,
   metadata:{edition:HISTORY_EDITION,anchor,formulaVersion:HISTORY_FORMULA,sourceBasis:'synthetic-local',sourceAsOf:verified.map(v=>v.report.metadata.sourceAsOf).sort().at(-1),observedAt:verified.map(v=>v.report.metadata.observedAt).sort().at(-1),verification:'constituent-source-revisions',allocationBasis:allocated?'allocated-recurring-monthly-costs':'actual-months',allocationMethod:MONTHLY_COST_ALLOCATION_METHOD},
   sales,components,profit,dailyFinancial:daily.map(({date,sales,components})=>({date,...sales,...components})),
   allocation:{kind:allocated?'allocated-estimate':'actual-months',label:allocated?'Allocated from monthly recurring payroll; other costs retain their actual dates':'Complete monthly actuals',methodVersion:MONTHLY_COST_ALLOCATION_METHOD,classificationPolicy:SYNTHETIC_PAYROLL_ALLOCATION_POLICY,portions,datedAccrualOverheadIncludingDA,allocatedOverheadIncludingDA:components.overheadIncludingDA,timingAdjustmentToDatedAccrualEbitda:safe(components.overheadIncludingDA-datedAccrualOverheadIncludingDA)}};
 }catch{return unavailable('Historical range sources could not be verified');}
}
