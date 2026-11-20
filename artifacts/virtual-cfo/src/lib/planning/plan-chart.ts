import {metrics,sampleTotals,type MarketingTotals} from '../marketing/review-model.ts';
import type {Projection} from './future-plan.ts';

/** Compare the SAME month-of-year, not a historical segment joined to a forecast.
 * The reader must supply a complete actual month. Missing/partial evidence stays null. */
export function futureChartRows(projection:Projection,perOrder=false,target:number|null=null,readActual:(from:string,to:string)=>MarketingTotals=sampleTotals){
 return projection.rows.map(row=>{
  const year=Number(row.from.slice(0,4))-1,month=Number(row.from.slice(5,7));
  const previousFrom=new Date(Date.UTC(year,month-1,1)).toISOString().slice(0,10);
  const previousTo=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
  let priorActual:number|null=null;
  try{
   const actual=readActual(previousFrom,previousTo),expected=(Date.parse(previousTo)-Date.parse(previousFrom))/86400000+1;
   const profit=metrics(actual).ebitda;
   if(actual.days===expected&&Number.isFinite(profit)&&(!perOrder||Number.isFinite(actual.orders)&&actual.orders>0))priorActual=perOrder?profit/actual.orders:profit;
  }catch{/* No zero, interpolation or fixture extrapolation for missing actuals. */}
  return {from:row.from,previousFrom,previousTo,priorActual,baseline:perOrder?row.baseline/row.baselineOrders:row.baseline,plan:perOrder?row.ebitda/row.orders:row.ebitda,goal:target===null||!Number.isFinite(target)||target<0?null:perOrder?target/row.orders:target};
 });
}
