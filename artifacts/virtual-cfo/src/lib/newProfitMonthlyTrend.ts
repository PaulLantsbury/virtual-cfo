import type { composeHistoryMonth } from './v11/history-composition.ts';
import { newProfitLinkedAmounts } from './newProfitLiveModel.ts';
import type { ProfitKey } from './newProfitPreview.ts';
export type ProfitMonth = NonNullable<ReturnType<typeof composeHistoryMonth>>;
export type ProfitTrendComparison = 'none' | 'last-year' | 'rolling';
const ratio = (n:number|null,d:number|null) => n!==null&&d!==null&&d>0?n/d:null;
const safeSum = (values:(number|null)[]) => { if(values.some(v=>v===null||!Number.isSafeInteger(v)))return null; const total=values.reduce<bigint>((s,v)=>s+BigInt(v!),0n); return total<=BigInt(Number.MAX_SAFE_INTEGER)&&total>=BigInt(Number.MIN_SAFE_INTEGER)?Number(total):null; };
/** Only complete, same-scope, contiguous reviewed monthly compositions; never allocate weeks. */
export function buildNewProfitMonthlyTrend(months:ProfitMonth[],end:ProfitMonth|null,count:3|6|12,perOrder:boolean,comparison:ProfitTrendComparison){
 if(!end||!months.length)return null;
 const expected=end.selection;
 for(let i=0;i<months.length;i++){
  const s=months[i].selection;
  if(['storeId','currency','timezone','edition','anchor'].some(k=>s[k as keyof typeof s]!==expected[k as keyof typeof expected])||s.period.to>expected.period.to||!s.versionId)return null;
  const date=new Date(`${s.period.from}T12:00:00Z`);
  const monthEnd=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).toISOString().slice(0,10);
  if(s.period.from.slice(8)!=='01'||monthEnd!==s.period.to)return null;
  if(i){const next=new Date(`${months[i-1].selection.period.to}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+1);if(next.toISOString().slice(0,10)!==s.period.from)return null;}
 }
 const last=months.at(-1)!;
 if(last.selection.period.from!==expected.period.from||last.selection.period.to!==expected.period.to||last.selection.versionId!==expected.versionId)return null;
 const values=months.map(newProfitLinkedAmounts);
 const all=months.map((month,index)=>{
  const v=values[index], own=(key:ProfitKey)=>perOrder?ratio(v[key],v.orders):v[key];
  const priorYearFrom=String(Number(month.selection.period.from.slice(0,4))-1)+month.selection.period.from.slice(4);
  const priorIndex=months.findIndex(m=>m.selection.period.from===priorYearFrom);
  const reference=comparison==='last-year'&&priorIndex>=0?[values[priorIndex]]:comparison==='rolling'&&index>=3?values.slice(index-3,index):[];
  const referenceProfit=reference.length?safeSum(reference.map(r=>r.ebitda)):null;
  const referenceOrders=reference.length?safeSum(reference.map(r=>r.orders)):null;
  const comparisonProfit=comparison==='none'?null:perOrder?ratio(referenceProfit,referenceOrders):referenceProfit===null?null:referenceProfit/reference.length;
  const discountRate=ratio(v.discounts,v.gross),refundRate=ratio(v.reversals,v.gross);
  const source=month.selection;
  return {from:source.period.from,to:source.period.to,label:new Date(source.period.from+'T12:00:00Z').toLocaleDateString('en-GB',{month:'short',year:'2-digit',timeZone:'UTC'}),versionId:source.versionId,
   revenue:perOrder?ratio(month.amounts.turnover,v.orders):month.amounts.turnover,sales:own('sales'),profit:own('ebitda'),comparisonProfit,orders:v.orders,
   discountRate:discountRate===null?null:discountRate*100,refundRate:refundRate===null?null:refundRate*100,
   overheads:own('cashOverheads'),overheadRate:ratio(v.cashOverheads,month.amounts.turnover),profitMargin:ratio(v.ebitda,month.amounts.turnover),
   referenceFrom:reference.length?months[comparison==='rolling'?index-3:priorIndex].selection.period.from:null,
   referenceTo:reference.length?months[comparison==='rolling'?index-1:priorIndex].selection.period.to:null};
 });
 const rows=all.slice(-count);
 return {rows,requestedCount:count,actualCount:rows.length,from:rows[0].from,to:rows.at(-1)!.to,comparison,perOrder};
}
export function newProfitMonthRatios(month:ProfitMonth|null){
 const v=newProfitLinkedAmounts(month),revenue=month?.amounts.turnover??null;
 return {grossMargin:ratio(v.grossProfit,v.sales),contributionMargin:ratio(v.contribution,revenue),ebitdaMargin:ratio(v.ebitda,revenue),operatingMargin:ratio(v.operatingProfit,revenue),retainedSalesRate:ratio(v.sales,v.gross),overheadRatio:ratio(v.cashOverheads,revenue),discountRate:ratio(v.discounts,v.gross),refundRate:ratio(v.reversals,v.gross)};
}
