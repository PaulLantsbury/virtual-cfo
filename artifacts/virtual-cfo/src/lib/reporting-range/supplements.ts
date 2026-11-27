import type {ReviewedMonth} from '../reviewedHistorySeries.ts';
import {reviewedSupplement} from '../reviewedSupplement.ts';
import {cashFinancialContext,cashSupplementView} from '../cashSupplement.ts';
import {acquisitionView,acquisitionFinancialContext,type DerivedAcquisitionEconomics,type AcquisitionEconomics,type SyntheticFunnel} from '../marketing/acquisition-evidence.ts';
import {validReportingDate} from '../reportingRange.ts';

const workingKeys=['stock','debtors','providerSettlements','supplierCredit','other'] as const;
const movementKeys=['taxAndInterest','investing','financing','other'] as const;
const integer=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n);
const sum=(values:unknown[]):number|null=>{
  if(!values.every(integer))return null;
  const n=values.reduce<bigint>((total,v)=>total+BigInt(v as number),0n);
  return n<=BigInt(Number.MAX_SAFE_INTEGER)&&n>=BigInt(Number.MIN_SAFE_INTEGER)?Number(n):null;
};
const nextDay=(day:string)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);};
const completeMonth=(from:string,to:string)=>validReportingDate(from)&&validReportingDate(to)&&from.endsWith('-01')&&from<=to&&nextDay(to).endsWith('-01')&&from.slice(0,7)===to.slice(0,7);
const binding=(month:ReviewedMonth)=>({
  from:month.selection.period.from,to:month.selection.period.to,
  financialVersionId:month.selection.versionId,salesRevision:month.evidence.salesRevision,costRevision:month.evidence.costRevision,
  financialObservedAt:month.evidence.observedAt,
});
function wholeMonthContext(months:ReviewedMonth[],financial:any){
  if(!Array.isArray(months)||months.length<1||months.length>24||!financial?.range||!Array.isArray(financial.range.months)||financial.range.months.length!==months.length)return null;
  const first=months[0],last=months.at(-1)!;
  if(!first?.selection||!last?.selection||!financial.selection||!financial.amounts)return null;
  const scope={storeId:first.selection.storeId,currency:first.selection.currency,timezone:first.selection.timezone,from:first.selection.period.from,to:last.selection.period.to};
  const f=financial.selection;
  if(f.storeId!==scope.storeId||f.currency!==scope.currency||f.timezone!==scope.timezone||f.edition!==first.selection.edition||f.anchor!==first.selection.anchor||f.period?.from!==scope.from||f.period?.to!==scope.to)return null;
  for(let i=0;i<months.length;i++){
    const month=months[i],s=month?.selection,paired=financial.range.months[i];
    if(!s||s.storeId!==scope.storeId||s.currency!=='GBP'||s.timezone!=='Europe/London'||s.edition!==first.selection.edition||s.anchor!==first.selection.anchor||!completeMonth(s.period?.from,s.period?.to)||!month.evidence||month.evidence.versionId!==s.versionId||month.evidence.costCoverage!=='complete')return null;
    if(i&&nextDay(months[i-1].selection.period.to)!==s.period.from)return null;
    if(!paired?.selection||JSON.stringify(binding(paired))!==JSON.stringify(binding(month))||paired.amounts?.ebitda!==month.amounts.ebitda)return null;
  }
  const ebitda=sum(months.map(month=>month.amounts.ebitda));
  if(ebitda===null||financial.amounts.ebitda!==ebitda)return null;
  return {scope,ebitda,financialBindings:months.map(binding)};
}
async function fingerprint(value:unknown):Promise<string|null>{
  if(!globalThis.crypto?.subtle)return null;
  const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
}
function immutable<T>(value:T,seen=new WeakSet<object>()):T{
  if(value&&typeof value==='object'&&!seen.has(value)){seen.add(value);for(const child of Object.values(value))immutable(child,seen);Object.freeze(value);}
  return value;
}

/** Compose actual cash only for a complete, contiguous set of independently
 * validated monthly records. The distinct range contracts are deliberately not
 * accepted as monthly snapshots or as permissions by the existing validators.
 * Fingerprints identify this display composition; they are not source authority. */
export async function composeWholeMonthCashRange(months:ReviewedMonth[],rawSupplements:unknown[],rangeFinancial:any){
  try{
    // Own the source snapshot across the asynchronous fingerprint operation.
    [months,rawSupplements,rangeFinancial]=structuredClone([months,rawSupplements,rangeFinancial]);
    const context=wholeMonthContext(months,rangeFinancial);
    if(!context||!Array.isArray(rawSupplements)||rawSupplements.length!==months.length)return null;
    const rows=months.map((month,index)=>{
      const wrapper=reviewedSupplement(rawSupplements[index],month,'cash');
      const point=wrapper?cashSupplementView(wrapper.payload,cashFinancialContext(month)):null;
      return wrapper&&point?{wrapper,point}:null;
    });
    if(rows.some(row=>!row))return null;
    const checked=rows as NonNullable<typeof rows[number]>[];
    const mappingVersion=checked[0].point.cash.mappingVersion;
    const firstAccounts=[...checked[0].point.evidence.accounts].sort((a,b)=>a.id.localeCompare(b.id));
    for(let i=0;i<checked.length;i++){
      const row=checked[i],accounts=[...row.point.evidence.accounts].sort((a,b)=>a.id.localeCompare(b.id));
      if(row.point.cash.mappingVersion!==mappingVersion||accounts.length!==firstAccounts.length||accounts.some((a,j)=>a.id!==firstAccounts[j].id))return null;
      if(i){
        const prior=checked[i-1].point;
        const previousAccounts=new Map(prior.evidence.accounts.map((a:any)=>[a.id,a.closing]));
        if(prior.cash.closingBankCash!==row.point.cash.openingBankCash||accounts.some(a=>previousAccounts.get(a.id)!==a.opening))return null;
      }
    }
    const workingCapital=Object.fromEntries(workingKeys.map(key=>[key,sum(checked.map(row=>row.point.evidence.workingCapital[key]))])) as Record<typeof workingKeys[number],number|null>;
    const bankMovements=Object.fromEntries(movementKeys.map(key=>[key,sum(checked.map(row=>row.point.evidence.bankMovements[key]))])) as Record<typeof movementKeys[number],number|null>;
    const operatingCash=sum(checked.map(row=>row.point.cash.operatingCash));
    if(operatingCash===null||Object.values(workingCapital).some(n=>n===null)||Object.values(bankMovements).some(n=>n===null)||sum([context.ebitda,...Object.values(workingCapital)])!==operatingCash)return null;
    const first=checked[0].point,last=checked.at(-1)!.point;
    const openingBankCash=first.cash.openingBankCash,closingBankCash=last.cash.closingBankCash;
    if(sum([openingBankCash,operatingCash,...Object.values(bankMovements)])!==closingBankCash)return null;
    const bankMovement=sum([closingBankCash,-openingBankCash]),cashLessProfit=sum([operatingCash,-context.ebitda]);
    if(bankMovement===null||cashLessProfit===null)return null;
    const observedAt=checked.map(row=>row.point.cash.observedAt).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)!;
    const dependencies=checked.map((row,index)=>({...context.financialBindings[index],supplementalSnapshotId:row.wrapper.snapshotId,supplementalObservedAt:row.wrapper.observedAt,sourceRevision:row.point.cash.sourceRevision,mappingVersion:row.point.cash.mappingVersion,cashObservedAt:row.point.cash.observedAt,sourcePrefixHash:row.point.source.sourcePrefixHash,bankLedgerHash:row.point.source.bankLedgerHash}));
    const accounts=firstAccounts.map(a=>({id:a.id,included:true as const,unrestricted:true as const,openingDate:context.scope.from,closingDate:context.scope.to,opening:a.opening,closing:last.evidence.accounts.find((v:any)=>v.id===a.id)!.closing}));
    const amounts={ebitda:context.ebitda,workingCapital,operatingCash,bankMovements,accounts,unsettledProviderFunds:last.cash.unsettledProviderFunds};
    const rangeHash=await fingerprint({contract:'whole-month-cash-range-v1',scope:context.scope,dependencies,amounts});
    if(!rangeHash)return null;
    const sourceRevision='range:'+rangeHash;
    return immutable({
      cash:{scope:context.scope,openingBankCash,closingBankCash,operatingCash,bankMovement,unsettledProviderFunds:last.cash.unsettledProviderFunds,cashLessProfit,sourceRevision,mappingVersion,observedAt},
      evidence:{contract:'eligible-cash-range-v1' as const,...context.scope,state:'reviewed' as const,invalidated:false as const,coverage:{accountsComplete:true as const,workingCapitalComplete:true as const,bankMovementsComplete:true as const,internalTransfersExcluded:true as const},...amounts,sourceRevision,mappingVersion,observedAt},
      source:{contract:'verified-monthly-cash-range-v1' as const,sourceBasis:'synthetic-model' as const,profile:'uk-gifts-v2' as const,anchor:months[0].selection.anchor,from:context.scope.from,to:context.scope.to,sourceRevision,mappingVersion,rangeHash,dependencies},
      range:{contract:'whole-month-cash-range-v1' as const,basis:'actual-monthly-cash-no-allocation' as const,from:context.scope.from,to:context.scope.to,rangeHash,financialBindings:context.financialBindings},
    });
  }catch{return null;}
}


export interface AcquisitionRangeView {
 contract:'synthetic-acquisition-range-v1'; state:'supported'; policy:'synthetic-identity-and-spend-v1';
 scope:{storeId:string;currency:'GBP';timezone:'Europe/London';from:string;to:string};
 coverage:{originalOrders:number;identifiedFirstOrders:number|null;identifiedRepeatOrders:number|null;guestOrders:number|null;unknownOrders:number|null;paidFirstCustomers:number|null};
 spend:{advertising:number;acquisition:number|null;retention:number|null;unallocated:number|null};
 revenue:{netProductSales:number;identifiedFirst:number|null;identifiedRepeat:number|null;guest:number|null;unknown:number|null};
 analytics?:(Omit<SyntheticFunnel,'contract'>&{contract:'synthetic-funnel-range-v1'});
 economics?:AcquisitionEconomics;
 cac:number|null;funnel:{conversion:number|null;checkoutCompletion:number|null;cartRate:number|null;checkoutRate:number|null}|null;
 customerActivityView:null;customerActivity?:undefined; economicsView:DerivedAcquisitionEconomics|null;
 source:{from:string;through:string;sourceHash:string;ordersHash:string;refundsHash:string;allocationHash:string;synthetic:true};
 limitations:string[];
 range:{contract:'acquisition-range-v1';basis:'whole-month-additive'|'actual-daily-funnel-only';rangeHash:string;financialBindings:ReturnType<typeof binding>[]};
}
export type AcquisitionDisplayEvidence=NonNullable<ReturnType<typeof acquisitionView>>|AcquisitionRangeView;

/** Validate monthly authority first. Only additive whole-month attribution is
 * combined; partial ranges expose actual daily funnel observations, never an
 * invented proportional customer split, cohort or customer-unique count. */
export async function composeAcquisitionRange(months:ReviewedMonth[],rawSupplements:unknown[],rangeFinancial:any):Promise<AcquisitionRangeView|null>{
 try{
  [months,rawSupplements,rangeFinancial]=structuredClone([months,rawSupplements,rangeFinancial]);
  if(!Array.isArray(months)||!months.length||months.length>24||!Array.isArray(rawSupplements)||rawSupplements.length!==months.length||!rangeFinancial?.range||!Array.isArray(rangeFinancial.range.months)||rangeFinancial.range.months.length!==months.length)return null;
  const first=months[0],last=months.at(-1)!,f=rangeFinancial.selection;
  if(!f||!validReportingDate(f.period?.from)||!validReportingDate(f.period?.to)||f.period.from>f.period.to||f.period.from<first.selection.period.from||f.period.from>first.selection.period.to||f.period.to<last.selection.period.from||f.period.to>last.selection.period.to||f.currency!=='GBP'||f.timezone!=='Europe/London')return null;
  for(let i=0;i<months.length;i++){
   const m=months[i],s=m.selection,paired=rangeFinancial.range.months[i];
   if(!s||s.storeId!==f.storeId||s.currency!==f.currency||s.timezone!==f.timezone||s.edition!==f.edition||s.anchor!==f.anchor||!completeMonth(s.period.from,s.period.to)||!paired||JSON.stringify(binding(m))!==JSON.stringify(binding(paired))||i&&nextDay(months[i-1].selection.period.to)!==s.period.from)return null;
  }
  const scope={storeId:f.storeId,currency:'GBP' as const,timezone:'Europe/London' as const,from:f.period.from,to:f.period.to};
  const whole=scope.from===first.selection.period.from&&scope.to===last.selection.period.to;
  const checked=months.map((m,i)=>{const wrapper=reviewedSupplement(rawSupplements[i],m,'acquisition');const view=wrapper?acquisitionView(wrapper.payload,acquisitionFinancialContext(m)):null;return wrapper&&view?{wrapper,view}:null;});
  if(checked.some(v=>!v))return null;
  const rows=checked as NonNullable<typeof checked[number]>[];
  const advertising=rangeFinancial.input?.profit?.advertising;
  if(advertising?.state!=='ready'||!integer(advertising.value)||!integer(rangeFinancial.amounts?.netProductSales)||!integer(rangeFinancial.originalOrders)||rangeFinancial.originalOrders<0)return null;
  const coverage:any={originalOrders:rangeFinancial.originalOrders},spend:any={advertising:advertising.value},revenue:any={netProductSales:rangeFinancial.amounts.netProductSales};
  for(const key of ['identifiedFirstOrders','identifiedRepeatOrders','guestOrders','unknownOrders','paidFirstCustomers'] as const)coverage[key]=whole?sum(rows.map(r=>r.view.coverage[key])):null;
  for(const key of ['acquisition','retention','unallocated'] as const)spend[key]=whole?sum(rows.map(r=>r.view.spend[key])):null;
  for(const key of ['identifiedFirst','identifiedRepeat','guest','unknown'] as const)revenue[key]=whole?sum(rows.map(r=>r.view.revenue[key])):null;
  if(whole&&(Object.values(coverage).some(v=>v===null)||Object.values(spend).some(v=>v===null)||Object.values(revenue).some(v=>v===null)||sum(rows.map(r=>r.view.coverage.originalOrders))!==coverage.originalOrders||sum(rows.map(r=>r.view.spend.advertising))!==spend.advertising||sum(rows.map(r=>r.view.revenue.netProductSales))!==revenue.netProductSales))return null;
  let analytics:AcquisitionRangeView['analytics'],funnel:AcquisitionRangeView['funnel']=null;
  const daily=rows.every(r=>r.view.analytics)?rows.flatMap(r=>r.view.analytics!.daily).filter(d=>d.date>=scope.from&&d.date<=scope.to):null;
  if(daily){
   const n=Math.round((Date.parse(scope.to+'T12:00:00Z')-Date.parse(scope.from+'T12:00:00Z'))/86400000)+1;
   if(daily.length!==n||daily.some((d,i)=>d.date!==(i?nextDay(daily[i-1].date):scope.from)))return null;
   const totals=Object.fromEntries(['sessions','cartSessions','checkoutSessions','purchasingSessions','orders'].map(k=>[k,sum(daily.map(d=>(d as any)[k]))])) as SyntheticFunnel['totals'];
   if(Object.values(totals).some(v=>v===null)||totals.orders!==coverage.originalOrders)return null;
   const hash=await fingerprint({scope,daily});if(!hash)return null;
   analytics={contract:'synthetic-funnel-range-v1',policy:'synthetic-session-events-v1',coverage:{from:scope.from,to:scope.to,complete:true},daily,totals,sourceHash:hash};
   const ratio=(a:number,b:number)=>b>0?a/b:null;
   funnel={conversion:ratio(totals.purchasingSessions,totals.sessions),checkoutCompletion:ratio(totals.purchasingSessions,totals.checkoutSessions),cartRate:ratio(totals.cartSessions,totals.sessions),checkoutRate:ratio(totals.checkoutSessions,totals.sessions)};
  }
  let economics:AcquisitionEconomics|undefined,economicsView:DerivedAcquisitionEconomics|null=null;
  if(whole&&rows.every(r=>r.view.economics)){
   const fields=['netProductSales','netShipping','cogs','variableCosts','repeatMarketingCosts','contributionBeforeMarketing','customers','acquisitionSpend'] as const;
   const values=Object.fromEntries(fields.map(k=>[k,sum(rows.map(r=>r.view.economics!.first[k]))]));
   if(Object.values(values).some(v=>v===null))return null;
   const v=values as Record<typeof fields[number],number>;
   if(v.customers!==coverage.paidFirstCustomers||v.acquisitionSpend!==spend.acquisition||sum([v.netProductSales,v.netShipping,-v.cogs,-v.variableCosts])!==v.contributionBeforeMarketing)return null;
   // This distinct range carries the source-bound additive first-order result;
   // no six-month mature cohort or overlapping distinct customer set is summed.
   const before=v.customers>0?v.contributionBeforeMarketing/v.customers:null;
   economicsView={firstOrderContribution:before,firstOrderContributionAfterAcquisition:v.customers>0?(v.contributionBeforeMarketing-v.acquisitionSpend)/v.customers:null,firstOrderBreakEvenCacBeforeOverheads:before,mature:null};
  }
  const financialBindings=months.map(binding),dependencies=rows.map((r,i)=>({...financialBindings[i],snapshotId:r.wrapper.snapshotId,observedAt:r.wrapper.observedAt,source:r.view.source}));
  const rangeHash=await fingerprint({scope,dependencies,coverage,spend,revenue,analytics,economicsView});if(!rangeHash)return null;
  return immutable({contract:'synthetic-acquisition-range-v1',state:'supported',policy:'synthetic-identity-and-spend-v1',scope,coverage,spend,revenue,analytics,economics,cac:whole&&coverage.paidFirstCustomers>0?spend.acquisition/coverage.paidFirstCustomers:null,funnel,customerActivityView:null,economicsView,source:{from:scope.from,through:scope.to,sourceHash:rangeHash,ordersHash:rangeHash,refundsHash:rangeHash,allocationHash:rangeHash,synthetic:true},limitations:['Distinct customers and mature cohorts are not additive and are withheld for this range.',...(whole?[]:['Partial-period acquisition attribution and first-order costs are unavailable; only actual daily funnel observations are combined.'])],range:{contract:'acquisition-range-v1',basis:whole?'whole-month-additive':'actual-daily-funnel-only',rangeHash,financialBindings}});
 }catch{return null;}
}

/** Dated bank movements are kept separate from the calendar-day cost allocation.
 * The explicit timing adjustment bridges allocated EBITDA to dated cash accruals. */
export async function composeCashRange(months:ReviewedMonth[],rawSupplements:unknown[],rangeFinancial:any){
 try{
  [months,rawSupplements,rangeFinancial]=structuredClone([months,rawSupplements,rangeFinancial]);
  if(!months?.length||!rangeFinancial?.selection?.period)return null;
  const {from,to}=rangeFinancial.selection.period;
  if(from===months[0].selection.period.from&&to===months.at(-1)!.selection.period.to)return composeWholeMonthCashRange(months,rawSupplements,rangeFinancial);
  if(!validReportingDate(from)||!validReportingDate(to)||from>to||from<months[0].selection.period.from||from>months[0].selection.period.to||to<months.at(-1)!.selection.period.from||to>months.at(-1)!.selection.period.to)return null;
  const wholeFinancial={...rangeFinancial,selection:{...rangeFinancial.selection,period:{from:months[0].selection.period.from,to:months.at(-1)!.selection.period.to}},amounts:{...rangeFinancial.amounts,ebitda:sum(months.map(m=>m.amounts.ebitda))}};
  const whole=await composeWholeMonthCashRange(months,rawSupplements,wholeFinancial);if(!whole)return null;
  const portions=rangeFinancial.range.cashDatedPortions;
  if(!Array.isArray(portions)||portions.length>2)return null;
  const checked=months.map((m,i)=>{const wrapper=reviewedSupplement(rawSupplements[i],m,'cash');return wrapper?cashSupplementView(wrapper.payload,cashFinancialContext(m)):null;});
  if(checked.some(v=>!v))return null;
  const selected:any[]=[];let consumed=0;
  for(let i=0;i<months.length;i++){
   const m=months[i],point=checked[i]!,partFrom=from>m.selection.period.from?from:m.selection.period.from,partTo=to<m.selection.period.to?to:m.selection.period.to;
   if(partFrom===m.selection.period.from&&partTo===m.selection.period.to){selected.push({from:partFrom,to:partTo,opening:point.cash.openingBankCash,closing:point.cash.closingBankCash,workingCapital:point.evidence.workingCapital,bankMovements:point.evidence.bankMovements,ebitda:m.amounts.ebitda,timing:0,unsettled:point.cash.unsettledProviderFunds,proofHash:point.cash.sourceRevision});continue;}
   const matching=portions.filter((p:any)=>p?.monthFrom===m.selection.period.from);if(matching.length!==1)return null;
   const p=matching[0];consumed++;
   if(p.state!=='supported'||p.policy!=='synthetic-cash-journal-v1'||p.from!==partFrom||p.to!==partTo||p.monthTo!==m.selection.period.to||p.versionId!==m.selection.versionId||p.salesRevision!==m.evidence.salesRevision||p.costRevision!==m.evidence.costRevision||!p.workingCapital)return null;
   const {proofHash,...body}=p;
   const canonical=JSON.parse(JSON.stringify(body,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v));
   if(typeof proofHash!=='string'||await fingerprint(canonical)!==proofHash)return null;
   const numeric=['openingBankOffsetPence','closingBankOffsetPence','selectedBankMovementPence','fullMonthBankMovementPence','closingProviderOffsetPence','fullMonthProviderMovementPence','datedAccrualEbitda','allocatedEbitda','allocatedToDatedEbitdaAdjustment'];
   if(!numeric.every(k=>integer(p[k]))||!workingKeys.every(k=>integer(p.workingCapital[k]))||point.evidence.accounts.length!==1||Object.values(point.evidence.bankMovements).some(v=>v!==0))return null;
   if(partFrom===m.selection.period.from&&p.openingBankOffsetPence!==0||partTo===m.selection.period.to&&(p.closingBankOffsetPence!==p.fullMonthBankMovementPence||p.closingProviderOffsetPence!==p.fullMonthProviderMovementPence))return null;
   const source=point.source,opening=source.openingControlBalances,closing=source.closingControlBalances;
   if(!integer(opening?.processor)||!integer(closing?.processor)||!integer(opening?.bank)||!integer(closing?.bank)||opening.bank!==point.cash.openingBankCash||closing.bank!==point.cash.closingBankCash||closing.bank-opening.bank!==p.fullMonthBankMovementPence||closing.processor-opening.processor!==p.fullMonthProviderMovementPence||closing.processor!==point.cash.unsettledProviderFunds)return null;
   if(sum([p.closingBankOffsetPence,-p.openingBankOffsetPence])!==p.selectedBankMovementPence||sum([p.allocatedEbitda,p.allocatedToDatedEbitdaAdjustment])!==p.datedAccrualEbitda||sum([p.datedAccrualEbitda,...workingKeys.map(k=>p.workingCapital[k])])!==p.selectedBankMovementPence)return null;
   const bankOpening=sum([point.cash.openingBankCash,p.openingBankOffsetPence]),bankClosing=sum([point.cash.openingBankCash,p.closingBankOffsetPence]),unsettled=sum([opening.processor,p.closingProviderOffsetPence]);
   if(bankOpening===null||bankClosing===null||unsettled===null||unsettled<0)return null;
   selected.push({from:partFrom,to:partTo,opening:bankOpening,closing:bankClosing,workingCapital:p.workingCapital,bankMovements:{taxAndInterest:0,investing:0,financing:0,other:0},ebitda:p.allocatedEbitda,timing:p.allocatedToDatedEbitdaAdjustment,unsettled,proofHash});
  }
  if(consumed!==portions.length||selected.some((v,i)=>i&&selected[i-1].closing!==v.opening))return null;
  const ebitda=sum(selected.map(v=>v.ebitda)),timing=sum(selected.map(v=>v.timing));
  if(ebitda===null||timing===null||ebitda!==rangeFinancial.amounts.ebitda)return null;
  const workingCapital=Object.fromEntries(workingKeys.map(k=>[k,sum(selected.map(v=>v.workingCapital[k]))]));
  const bankMovements=Object.fromEntries(movementKeys.map(k=>[k,sum(selected.map(v=>v.bankMovements[k]))]));
  if([...Object.values(workingCapital),...Object.values(bankMovements)].some(v=>v===null))return null;
  const operatingCash=sum([ebitda,timing,...Object.values(workingCapital)]),openingBankCash=selected[0].opening,closingBankCash=selected.at(-1)!.closing,unsettledProviderFunds=selected.at(-1)!.unsettled;
  if(operatingCash===null||sum([openingBankCash,operatingCash,...Object.values(bankMovements)])!==closingBankCash)return null;
  const bankMovement=sum([closingBankCash,-openingBankCash]),cashLessProfit=sum([operatingCash,-ebitda]);if(bankMovement===null||cashLessProfit===null)return null;
  const scope={...whole.cash.scope,from,to},rangeHash=await fingerprint({scope,financialBindings:whole.range.financialBindings,selected});if(!rangeHash)return null;
  const sourceRevision='range:'+rangeHash;
  return immutable({cash:{...whole.cash,scope,openingBankCash,closingBankCash,operatingCash,bankMovement,unsettledProviderFunds,cashLessProfit,sourceRevision},evidence:{...whole.evidence,...scope,ebitda,workingCapital,bankMovements,operatingCash,unsettledProviderFunds,allocatedToDatedEbitdaAdjustment:timing,accounts:[{...whole.evidence.accounts[0],openingDate:from,closingDate:to,opening:openingBankCash,closing:closingBankCash}],sourceRevision},source:{...whole.source,contract:'verified-dated-cash-range-v1' as const,from,to,sourceRevision,rangeHash},range:{...whole.range,contract:'dated-cash-range-v1' as const,basis:'actual-dated-cash-with-explicit-cost-timing' as const,from,to,rangeHash,allocatedToDatedEbitdaAdjustment:timing}});
 }catch{return null;}
}
