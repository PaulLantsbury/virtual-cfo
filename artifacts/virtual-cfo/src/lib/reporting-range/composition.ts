import {composeHistoryMonth,type HistorySeriesId} from '../v11/history-composition.ts';
import {supportedSlice} from '../v11/supported-slice.ts';
import {FORMULA_VERSION} from '../v11/fixtures.ts';
import {HISTORY_EDITION,type HistorySelection} from '../v11/history-supported.ts';
import {validRange} from '../v11/periods.ts';
import {MONTHLY_COST_ALLOCATION_METHOD,allocateMonthlyRecurringCost} from '../../../../../experiments/financial-v1/monthly-cost-allocation.mjs';
import type {ReportingAdapterInput,SupportedProfitMetric} from '../v11/reporting-adapter.ts';
export type ReviewedRangeSelection=Omit<HistorySelection,'versionId'>&{versions:readonly {from:string;to:string;versionId:string}[]};
const money=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v);
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const metric=(v:number):SupportedProfitMetric=>({value:v,state:'ready',reason:null});
const sum=(values:number[])=>{const n=values.reduce((a,b)=>a+BigInt(b),0n);return n>=BigInt(Number.MIN_SAFE_INTEGER)&&n<=BigInt(Number.MAX_SAFE_INTEGER)?Number(n):null};
/** New range contract only. Monthly source witnesses remain separately validated;
 * an aggregate identity is never treated as a stored monthly version. */
export function composeReviewedRange(raw:unknown,expected:ReviewedRangeSelection){
 if(!object(raw)||!validRange(expected.period)||expected.edition!==HISTORY_EDITION||expected.currency!=='GBP'||expected.timezone!=='Europe/London'||!expected.versions.length||expected.versions.length>24)return null;
 const r=raw,m=r.metadata,s=r.scope;
 if(r.state!=='supported'||r.contract!=='history-range-v1'||typeof r.rangeId!=='string'||!/^[a-f0-9]{64}$/.test(r.rangeId)||!object(s)||s.storeId!==expected.storeId||s.currency!==expected.currency||s.timezone!==expected.timezone||s.from!==expected.period.from||s.to!==expected.period.to)return null;
 if(!object(m)||m.edition!==expected.edition||m.anchor!==expected.anchor||m.formulaVersion!==FORMULA_VERSION||m.sourceBasis!=='synthetic-local'||m.verification!=='constituent-source-revisions'||!['actual-months','allocated-recurring-monthly-costs'].includes(m.allocationBasis))return null;
 if(!Array.isArray(r.versions)||!Array.isArray(r.monthlyResponses)||r.versions.length!==expected.versions.length||r.monthlyResponses.length!==expected.versions.length)return null;
 const months:NonNullable<ReturnType<typeof composeHistoryMonth>>[]=[];
 for(let i=0;i<expected.versions.length;i++){
  const v=expected.versions[i],bound=r.versions[i];if(!object(bound)||bound.from!==v.from||bound.to!==v.to||bound.versionId!==v.versionId)return null;
  const month=composeHistoryMonth(r.monthlyResponses[i],{...expected,period:{from:v.from,to:v.to},versionId:v.versionId});
  if(!month||month.view.primary.state!=='supported'||!month.view.primary.result.complete||month.input.profit?.state!=='complete'||month.evidence.salesRevision!==bound.salesRevision||month.evidence.costRevision!==bound.costRevision)return null;
  if(i){const next=new Date(months[i-1].selection.period.to+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);if(next.toISOString().slice(0,10)!==v.from)return null;}
  months.push(month);
 }
 if(months[0].selection.period.from>expected.period.from||months.at(-1)!.selection.period.to<expected.period.to||months[0].selection.period.to<expected.period.from||months.at(-1)!.selection.period.from>expected.period.to)return null;
 if(m.sourceAsOf!==months.map(v=>v.context.snapshotAsOf).sort().at(-1)||m.observedAt!==months.map(v=>v.evidence.observedAt).sort().at(-1)||Date.parse(m.observedAt)<Date.parse(m.sourceAsOf))return null;
 const sales=r.sales,c=r.components,p=r.profit;
 if(!object(sales)||!object(c)||!object(p)||p.state!=='complete'||!['grossProductSales','discounts','netProductSales','netShipping','originalOrders'].every(k=>money(sales[k]))||sales.originalOrders<0||!['cogs','variableCosts','advertising','overheadIncludingDA','depreciationAmortisation'].every(k=>money(c[k])))return null;
 const prov=sales.provenance;
 if(!object(prov)||prov.storeId!==s.storeId||prov.currency!==s.currency||prov.from!==s.from||prov.to!==s.to||prov.coverageEvidence!==`history-range:${r.rangeId}`)return null;
 const whole=months[0].selection.period.from===s.from&&months.at(-1)!.selection.period.to===s.to;
 if(m.allocationMethod!==MONTHLY_COST_ALLOCATION_METHOD||m.allocationBasis!==(whole?'actual-months':'allocated-recurring-monthly-costs'))return null;
 const allocation=r.allocation;
 if(!object(allocation)||allocation.kind!==(whole?'actual-months':'allocated-estimate')||allocation.methodVersion!==MONTHLY_COST_ALLOCATION_METHOD||allocation.classificationPolicy!=='uk-gifts-v2-monthly-payroll-recurring-v1'||!Array.isArray(allocation.portions)||!['datedAccrualOverheadIncludingDA','allocatedOverheadIncludingDA','timingAdjustmentToDatedAccrualEbitda'].every(k=>money(allocation[k]))||allocation.allocatedOverheadIncludingDA!==c.overheadIncludingDA||allocation.timingAdjustmentToDatedAccrualEbitda!==sum([allocation.allocatedOverheadIncludingDA,-allocation.datedAccrualOverheadIncludingDA]))return null;
 if(whole&&(allocation.portions.length!==0||allocation.timingAdjustmentToDatedAccrualEbitda!==0))return null;
 if(!whole){
  const partialSources=expected.versions.filter(v=>v.from<s.from||v.to>s.to),seen=new Set<string>();
  if(allocation.portions.length!==partialSources.length*3)return null;
  for(const portion of allocation.portions){
   if(!object(portion)||!['salary','employer','pension'].includes(portion.costId)||portion.methodVersion!==MONTHLY_COST_ALLOCATION_METHOD||portion.classificationApprovalId!==allocation.classificationPolicy)return null;
   const source=partialSources.find(v=>v.versionId===portion.sourceVersionId&&v.from===portion.sourceFrom&&v.to===portion.sourceTo);if(!source)return null;
   const key=source.from+':'+portion.costId;if(seen.has(key))return null;seen.add(key);
   const from=source.from>s.from?source.from:s.from,to=source.to<s.to?source.to:s.to;
   const checked=allocateMonthlyRecurringCost({storeId:s.storeId,currency:s.currency,costId:portion.costId,from,to,sources:[{storeId:s.storeId,currency:s.currency,costId:portion.costId,month:source.from.slice(0,7),sourceVersionId:source.versionId,selection:'selected',amountPence:portion.sourceAmountPence,coverage:{from:source.from,to:source.to,complete:true},classification:{type:'recurring-monthly',approved:true,approvalId:allocation.classificationPolicy}}]});
   if(checked.state!=='supported'||checked.valuePence!==portion.valuePence||portion.from!==from||portion.to!==to)return null;
  }
 }
 if(whole){
  for(const key of ['grossProductSales','discounts','netProductSales','netShipping','originalOrders'])if(sales[key]!==sum(months.map(v=>(v.input.sales as any)[key])))return null;
  for(const [key,source]of [['cogs','cogs'],['variableCosts','variableCosts'],['advertising','advertising'],['overheadIncludingDA','overheads'],['depreciationAmortisation','da']] as const)if(c[key]!==sum(months.map(v=>v.input.profit![source].value!)))return null;
 }
 const input:ReportingAdapterInput={expected:{storeId:s.storeId,currency:s.currency,timezone:s.timezone,period:{from:s.from,to:s.to}},sourceBasis:'synthetic-local',access:'allowed',freshness:'current',snapshot:{id:r.rangeId,asOf:m.sourceAsOf},sales:structuredClone(sales) as any,
  profit:{scope:{storeId:s.storeId,currency:s.currency,from:s.from,to:s.to},state:'complete',reason:null,sales:structuredClone(sales) as any,cogs:metric(c.cogs),variableCosts:metric(c.variableCosts),advertising:metric(c.advertising),overheads:metric(c.overheadIncludingDA),da:metric(c.depreciationAmortisation),grossProfit:metric(p.grossProfit),contributionBeforeMarketing:metric(p.contributionBeforeMarketing),contribution:metric(p.contribution),ebitda:metric(p.ebitda)}};
 const view=supportedSlice(input);if(!view.primary.context||view.primary.state!=='supported')return null;
 const metrics=view.primary.result.metrics;
 if(metrics.grossProfit!==p.grossProfit||metrics.cm3!==p.contribution||metrics.ebitda!==p.ebitda||metrics.contributionBeforeMarketing!==p.contributionBeforeMarketing)return null;
 const operatingProfit=metrics.ebitda!==null?metrics.ebitda-c.depreciationAmortisation:null;
 const amounts:Record<HistorySeriesId,number|null>={netProductSales:metrics.netProductSales,netShipping:metrics.netShipping,turnover:metrics.revenue,grossProfit:metrics.grossProfit,contribution:metrics.cm3,operatingProfit,ebitda:metrics.ebitda};
 if(Object.values(amounts).some(v=>v!==null&&!money(v)))return null;
 return {input,view,selection:{storeId:expected.storeId,currency:expected.currency,timezone:expected.timezone,edition:expected.edition,anchor:expected.anchor,period:{...expected.period},versionId:r.rangeId},amounts,cfoBriefing:null,originalOrders:sales.originalOrders as number,originalProductSales:sales.grossProductSales-sales.discounts,context:view.primary.context,
  evidence:{financialProfile:'uk-gifts-v2' as const,edition:expected.edition,anchor:expected.anchor,versionId:r.rangeId,salesRevision:`range-sales:${r.rangeId}`,costRevision:`range-costs:${r.rangeId}`,observedAt:m.observedAt as string,verification:'constituent-source-revisions' as const,coverage:prov.coverageEvidence as string,costCoverage:'complete' as const},
  range:{kind:'range' as const,versions:structuredClone(r.versions),allocationBasis:m.allocationBasis as 'actual-months'|'allocated-recurring-monthly-costs',allocation:structuredClone(r.allocation),cashDatedPortions:structuredClone(r.cashDatedPortions??[]),dailyFinancial:structuredClone(r.dailyFinancial??[]),months}};
}
