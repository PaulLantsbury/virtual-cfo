import {DAILY_SAMPLE,shiftDay,buildProfitPreview,aggregateDays} from '../newProfitPreview.ts';
import {buildMarketingReview,type Comparison} from './review-model.ts';
export type GrowthTab='acquisition'|'conversion'|'retention';
export function growthTab(query:string):GrowthTab{const t=new URLSearchParams(query).get('tab');return t==='conversion'||t==='retention'?t:'acquisition';}
export type BehaviourTotals={sessions:number;cartSessions:number;checkoutSessions:number;purchaseSessions:number;orders:number;originalProductSales:number;netProductSales:number;newCustomers:number;repeatCustomers:number;newOriginalSales:number;repeatOriginalSales:number;repeatOrders:number;newRevenue:number;repeatRevenue:number;days:number};
const ratio=(a:number,b:number)=>Number.isFinite(a)&&Number.isFinite(b)&&b>0?a/b:null;
/** Deliberately fictional behavioural observations, never an importer or live fallback.
 * Counts and revenue reconcile to the existing daily financial sample. Session
 * conversion uses purchasing SESSIONS; orders can exceed purchasing sessions. */
export function behaviourSample(from:string,to:string):BehaviourTotals{
 const days=DAILY_SAMPLE.filter(d=>d.date>=from&&d.date<=to),expected=(Date.parse(to)-Date.parse(from))/86400000+1;
 if(days.length!==expected||!days.length)throw Error('Behaviour sample does not cover the complete period');
 const financial=aggregateDays(days);
 const repeatIds=new Set<number>();
 let newOriginalSales=0;
 let sessions=0,cartSessions=0,checkoutSessions=0,purchaseSessions=0,newCustomers=0,newRevenue=0;
 for(const d of days){
  const late=d.date>='2026-07-01',rate=(late?.019:.022)+(Number(d.date.slice(8))%5)*.0001;
  const purchasing=Math.max(1,Math.floor(d.orders*.96)),visits=Math.ceil(purchasing/rate);
  sessions+=visits;purchaseSessions+=purchasing;cartSessions+=Math.max(purchasing,Math.round(visits*.085));checkoutSessions+=Math.max(purchasing,Math.round(visits*.044));
  const first=Math.max(1,Math.round(d.orders*(late?.39:.43)));newCustomers+=first;newRevenue+=d.sales/100*first/d.orders*.98;newOriginalSales+=(d.gross-d.discounts)/100*first/d.orders*.98;
  const dayIndex=Math.round((Date.parse(d.date)-Date.parse(DAILY_SAMPLE[0].date))/86400000);for(let j=0;j<d.orders-first;j++)repeatIds.add((dayIndex*53+j)%5000);
 }
 const netProductSales=financial.sales/100;
 return {sessions,cartSessions,checkoutSessions,purchaseSessions,orders:financial.orders,originalProductSales:(financial.gross-financial.discounts)/100,netProductSales,newCustomers,repeatCustomers:repeatIds.size,newOriginalSales,repeatOriginalSales:(financial.gross-financial.discounts)/100-newOriginalSales,repeatOrders:financial.orders-newCustomers,newRevenue,repeatRevenue:netProductSales-newRevenue,days:days.length};
}
export function behaviourMetrics(t:BehaviourTotals){return {conversion:ratio(t.purchaseSessions,t.sessions),cartRate:ratio(t.cartSessions,t.sessions),checkoutRate:ratio(t.checkoutSessions,t.sessions),checkoutCompletion:ratio(t.purchaseSessions,t.checkoutSessions),aov:ratio(t.originalProductSales,t.orders),repeatOrderShare:ratio(t.repeatOrders,t.orders),newRevenueShare:ratio(t.newRevenue,t.netProductSales),repeatRevenueShare:ratio(t.repeatRevenue,t.netProductSales)};}
const scale=(t:BehaviourTotals,factor:number)=>Object.fromEntries(Object.entries(t).map(([k,v])=>[k,v*factor])) as BehaviourTotals;
export function buildGrowthReview(months:3|6|12,comparison:Comparison){
 const marketing=buildMarketingReview({granularity:'monthly',horizon:months,comparison}),profit=buildProfitPreview({granularity:'monthly',months});
 const current=behaviourSample(marketing.from,marketing.to);
 const pool=comparison==='rolling'?behaviourSample(marketing.benchmarkFrom,marketing.benchmarkTo):null;
 const poolMonths=pool?Array.from({length:marketing.benchmarkCount},(_,i)=>{const dt=new Date(marketing.benchmarkFrom+'T00:00:00Z');dt.setUTCMonth(dt.getUTCMonth()+i);const from=dt.toISOString().slice(0,10);dt.setUTCMonth(dt.getUTCMonth()+1);dt.setUTCDate(0);return behaviourSample(from,dt.toISOString().slice(0,10));}):[];
 const repeatMonthlyAverage=poolMonths.reduce((s,t)=>s+t.repeatCustomers,0)/Math.max(1,poolMonths.length);
 const previous=comparison==='none'?null:pool?{...scale(pool,marketing.selectedCount/marketing.benchmarkCount),repeatCustomers:repeatMonthlyAverage*marketing.selectedCount}:behaviourSample(marketing.referenceFrom!,marketing.referenceTo!);
 const rows=marketing.rows.map(r=>{
  const summary=behaviourSample(r.from,r.to),old=comparison==='none'?null:pool?{...scale(pool,1/marketing.benchmarkCount),repeatCustomers:repeatMonthlyAverage}:behaviourSample((Number(r.from.slice(0,4))-1)+r.from.slice(4),(Number(r.to.slice(0,4))-1)+r.to.slice(4));
  return {...r,behaviour:summary,previousBehaviour:old,behaviourMetrics:behaviourMetrics(summary),previousMetrics:old?behaviourMetrics(old):null};
 });
 return {marketing,profit,current,previous,metrics:behaviourMetrics(current),previousMetrics:previous?behaviourMetrics(previous):null,rows};
}
/** Separate mature population from v11 6B; never a selected-quarter forecast. */
export const MATURE_COHORT={from:'2026-04-01',to:'2026-06-30',observedThrough:'2026-09-30',customers:2700,cac:90000/2700,grossProfit90:75,contribution90:55,paybackDays:55,
 curve:[{day:0,contribution:26},{day:30,contribution:30},{day:55,contribution:90000/2700},{day:60,contribution:38},{day:90,contribution:55}]};
export function cohortMature(lastFirstOrder:string,observedThrough:string,windowDays=90){return Number.isFinite(Date.parse(lastFirstOrder))&&Number.isFinite(Date.parse(observedThrough))&&shiftDay(lastFirstOrder,windowDays)<=observedThrough;}

export type CustomerSegment='all'|'new'|'repeat';
/** Distinct customer counts are calculated for the chosen window, never added across months. */
export function customerDrivers(t:BehaviourTotals,segment:CustomerSegment){
 const customers=segment==='new'?t.newCustomers:segment==='repeat'?t.repeatCustomers:t.newCustomers+t.repeatCustomers;
 const orders=segment==='new'?t.newCustomers:segment==='repeat'?t.repeatOrders:t.orders;
 const sales=segment==='new'?t.newOriginalSales:segment==='repeat'?t.repeatOriginalSales:t.originalProductSales;
 return {customers,orders,sales,aov:ratio(sales,orders),frequency:ratio(orders,customers)};
}
