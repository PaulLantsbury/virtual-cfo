/** Fixed history for context charts; selected-period cards and bridges are separate. */
import {aggregateDays,buildProfitPreview,comparisonChartRows,shiftDay,type Granularity,type ComparisonBasis} from './newProfitPreview.ts';
import {DAILY_SAMPLE} from './newProfitPreview.ts';
import {buildCashPeriodView,type CashPeriodComparison} from './cashPeriodView.ts';
const contextLabel=(granularity:Granularity)=>`Last 12 complete ${granularity==='weekly'?'weeks':'months'}`;
export function buildProfitTrendContext({granularity,comparison,perOrder=false}:{granularity:Granularity;comparison:ComparisonBasis;perOrder?:boolean}){
 const base=buildProfitPreview({granularity,months:granularity==='weekly'?3:12}),periods=base.periods.slice(-12),from=periods[0].from;
 const start=new Date(from+'T00:00:00Z');start.setUTCMonth(start.getUTCMonth()-3);
 const benchmarkFrom=granularity==='weekly'?shiftDay(from,-84):start.toISOString().slice(0,10);
 const benchmarkTo=shiftDay(from,-1),benchmark=aggregateDays(DAILY_SAMPLE.filter(d=>d.date>=benchmarkFrom&&d.date<=benchmarkTo));
 const model={...base,periods,from,selectedCount:12,current:aggregateDays(DAILY_SAMPLE.filter(d=>d.date>=from&&d.date<=base.to)),benchmark,benchmarkFrom,benchmarkTo};
 return {model,rows:comparisonChartRows(model,perOrder,comparison),contextLabel:contextLabel(granularity),benchmarkFrom,benchmarkTo};
}
export function buildCashTrendContext({granularity,comparison}:{granularity:Granularity;comparison:CashPeriodComparison}){
 const base=buildCashPeriodView({granularity,months:granularity==='weekly'?6:12,comparison});
 let history=base.history.slice(-12);
 if(granularity==='weekly'&&(comparison==='rolling'||comparison==='previous-period')){
  const reference=base.history.slice(-24,-12),avg=(key:'profit'|'sales'|'operatingCash')=>reference.reduce((s,r)=>s+r[key],0)/12;
  history=history.map((r,i)=>({...r,comparisonProfit:comparison==='rolling'?avg('profit'):reference[i].profit,comparisonSales:comparison==='rolling'?avg('sales'):reference[i].sales,comparisonCash:comparison==='rolling'?avg('operatingCash'):reference[i].operatingCash}));
 }
 const average=(key:'profit'|'sales'|'operatingCash')=>history.reduce((s,r)=>s+r[key],0)/12;
 const refAverage=(key:'comparisonProfit'|'comparisonSales'|'comparisonCash')=>history.reduce((s,r)=>s+r[key],0)/12;
 const profit=average('profit'),operatingCash=average('operatingCash'),referenceProfit=refAverage('comparisonProfit'),referenceCash=refAverage('comparisonCash');
 return {history,granularity,comparison,contextLabel:contextLabel(granularity),unit:base.unit,comparisonLabel:base.comparisonLabel,
  selectedAverage:{sales:average('sales'),profit,operatingCash,gap:operatingCash-profit},
  referenceAverage:{sales:refAverage('comparisonSales'),profit:referenceProfit,operatingCash:referenceCash,gap:referenceCash-referenceProfit},
  from:history[0].from,to:history.at(-1)!.to,
  benchmarkFrom:granularity==='weekly'?base.history.at(-24)!.from:buildProfitPreview({granularity,months:12}).benchmarkFrom,
  benchmarkTo:granularity==='weekly'?base.history.at(-13)!.to:buildProfitPreview({granularity,months:12}).benchmarkTo,
 };
}
