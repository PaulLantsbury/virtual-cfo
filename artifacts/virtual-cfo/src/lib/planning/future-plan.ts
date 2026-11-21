import {metrics, type MarketingTotals} from '../marketing/review-model.ts';
import type {BridgeRow} from './plan-model.ts';
export const FUTURE_VERSION='plan-monthly-v2';
export type Lever='cac'|'conversion'|'repeat'|'aov'|'costs'|'overheads';
export type FutureInput={months:3|6|12;startMonth:number;rampMonths:number;trend:number;spend:number;cac:number;conversion:number;repeat:number;aov:number;costs:number;overheads:number;ongoing:number;setup:number;aovMargin:number};
export const futureDefaults=(base:MarketingTotals):FutureInput=>({months:3,startMonth:1,rampMonths:1,trend:0,spend:0,cac:0,conversion:0,repeat:0,aov:0,costs:0,overheads:0,ongoing:0,setup:0,aovMargin:base.beforeAds/base.revenue*100});
export const LEVERS:{id:Lever;title:string;assumption:string;value:number;unit:string;min:number;max:number;step:number;detail:string}[]=[
 {id:'cac',title:'Acquire customers more efficiently',assumption:'Lower acquisition cost',value:10,unit:'%',min:0,max:30,step:1,detail:'Lower CAC at the same acquisition budget, excluding any separately modelled website conversion improvement.'},
 {id:'conversion',title:'Convert more website visits',assumption:'Conversion change',value:10,unit:'% relative',min:-30,max:30,step:1,detail:'A +10% relative assumption multiplies orders by 1.10; no absolute conversion rate is asserted. Traffic and advertising stay fixed. This applies to new and existing-customer orders.'},
 {id:'repeat',title:'Bring existing customers back',assumption:'Repeat-order change',value:10,unit:'%',min:-30,max:30,step:1,detail:'Extra repeat orders from the existing customer base; not a percentage-point change in retention and not future repeat orders from newly acquired customers.'},
 {id:'aov',title:'Grow the average basket',assumption:'Net AOV change',value:5,unit:'%',min:-20,max:20,step:.5,detail:'Net revenue per order including net shipping, after discounts/refunds and excluding VAT. Only the stated contribution margin on extra revenue becomes profit.'},
 {id:'costs',title:'Reduce the cost of each order',assumption:'Order cost saving',value:.5,unit:'£ / order',min:0,max:5,step:.1,detail:'Combined product, fulfilment, delivery and payment-cost saving per order. Include any setup or service costs below.'},
 {id:'overheads',title:'Reduce fixed overheads',assumption:'Monthly overhead saving',value:1000,unit:'£ / month',min:0,max:10000,step:100,detail:'Recurring overhead reduction excluding depreciation/amortisation, subject to available baseline overheads.'},
];
export const zeroLevers=(i:FutureInput):FutureInput=>({...i,cac:0,conversion:0,repeat:0,aov:0,costs:0,overheads:0,spend:0,ongoing:0,setup:0});
export function nextMonth(today:string,offset=0){const [y,m]=today.split('-').map(Number);return new Date(Date.UTC(y,m+offset,1)).toISOString().slice(0,10);}
export function validFuture(base:MarketingTotals,i:FutureInput){
 if(!i||!Object.values(i).every(Number.isFinite)||![3,6,12].includes(i.months)||!Number.isInteger(i.startMonth)||i.startMonth<1||i.startMonth>i.months||!Number.isInteger(i.rampMonths)||i.rampMonths<1||i.rampMonths>12||i.trend< -10||i.trend>10||i.spend< -80||i.spend>80||i.aovMargin<0||i.aovMargin>100||i.ongoing<0||i.ongoing>100000||i.setup<0||i.setup>100000)return false;
 if(!LEVERS.every(l=>i[l.id]>=l.min&&i[l.id]<=l.max)||i.overheads>base.overheads)return false;
 const repeatOrders=base.orders-base.customers;
 return Object.values(base).every(Number.isFinite)&&base.days===30&&base.orders>0&&base.customers>0&&repeatOrders>0&&base.acquisitionSpend>0&&base.revenue>0&&base.firstContributionTotal>=0&&base.firstRevenueTotal>0&&base.revenue>=base.firstRevenueTotal&&base.beforeAds>=base.firstContributionTotal&&i.costs<=(base.revenue-base.beforeAds)/base.orders;
}
export function projectFuture(base:MarketingTotals,i:FutureInput,today:string){
 if(!validFuture(base,i)||!/^\d{4}-\d{2}-\d{2}$/.test(today)||!Number.isFinite(Date.parse(today)))return null;
 const initial=metrics(base),repeatOrders=base.orders-base.customers;
 const firstRevenue=base.firstRevenueTotal/base.customers,firstContribution=base.firstContributionTotal/base.customers;
 const repeatRevenue=(base.revenue-base.firstRevenueTotal)/repeatOrders,repeatContribution=(base.beforeAds-base.firstContributionTotal)/repeatOrders;
 const rows=Array.from({length:i.months},(_,idx)=>{
  const from=nextMonth(today,idx),until=nextMonth(today,idx+1),days=(Date.parse(until)-Date.parse(from))/86400000;
  const factor=days/30*(1+i.trend/100)**idx,progress=idx+1<i.startMonth?0:Math.min(1,(idx+2-i.startMonth)/i.rampMonths);
  const customers=base.customers*factor,existing=repeatOrders*factor,spend=base.acquisitionSpend*factor;
  const beforeAds=base.beforeAds*factor,revenue=base.revenue*factor,ads=base.advertising*factor,baseline=beforeAds-ads-base.overheads;
  const spendFactor=1+i.spend/100*progress;
  const spendCac=initial.cac!*spendFactor**.35;
  const spendCustomers=spend*spendFactor/spendCac;
  const efficientCustomers=spendCustomers/(1-i.cac/100*progress);
  const conversionFactor=1+i.conversion/100*progress;
  const newCustomers=efficientCustomers*conversionFactor;
  const convertedRepeat=existing*conversionFactor;
  const scenarioRepeat=convertedRepeat*(1+i.repeat/100*progress);
  const orders=newCustomers+scenarioRepeat;
  const volumeRevenue=newCustomers*firstRevenue+scenarioRepeat*repeatRevenue;
  const aovRevenue=volumeRevenue*i.aov/100*progress;
  const advertising=ads+spend*(spendFactor-1);
  const movements=[
   {label:'Spend-driven orders',amount:(spendCustomers-customers)*firstContribution},
   {label:'Advertising budget',amount:-spend*(spendFactor-1)},
   {label:'Acquisition efficiency',amount:(efficientCustomers-spendCustomers)*firstContribution},
   {label:'Website conversion',amount:(newCustomers-efficientCustomers)*firstContribution+(convertedRepeat-existing)*repeatContribution},
   {label:'Existing-customer repeats',amount:(scenarioRepeat-convertedRepeat)*repeatContribution},
   {label:'Higher basket value',amount:aovRevenue*i.aovMargin/100},
   {label:'Order cost savings',amount:orders*i.costs*progress},
   {label:'Overhead savings',amount:i.overheads*progress},
   {label:'Ongoing test costs',amount:-i.ongoing*progress},
   {label:'One-off setup expense',amount:idx+1===i.startMonth?-i.setup:0},
  ];
  const delta=movements.reduce((s,m)=>s+m.amount,0);
  return {from,until,days,progress,baseline,ebitda:baseline+delta,delta,baselineOrders:customers+existing,orders,revenue:volumeRevenue+aovRevenue,baselineRevenue:revenue,customers:newCustomers,repeatOrders:scenarioRepeat,advertising,cac:spend*spendFactor/newCustomers,movements};
 });
 const sum=(key:'baseline'|'ebitda'|'delta'|'orders'|'baselineOrders')=>rows.reduce((s,r)=>s+r[key],0);
 const movements=rows[0].movements.map((m,j)=>({label:m.label,amount:rows.reduce((s,r)=>s+r.movements[j].amount,0)}));
 return {rows,baseline:sum('baseline'),ebitda:sum('ebitda'),delta:sum('delta'),orders:sum('orders'),baselineOrders:sum('baselineOrders'),movements};
}
export type Projection=NonNullable<ReturnType<typeof projectFuture>>;
export function futureBridge(p:Projection,perOrder=false):BridgeRow[]{
 const denominator=perOrder?p.orders:1,initial=perOrder?p.baseline/p.baselineOrders:p.baseline;
 const rows:BridgeRow[]=[{label:'Carry on as now',start:0,end:initial,amount:initial,total:true}];let cursor=initial;
 const add=(label:string,amount:number)=>{rows.push({label,start:cursor,end:cursor+amount,amount,total:false});cursor+=amount;};
 if(perOrder&&p.orders!==p.baselineOrders)add('Order-count basis',p.baseline/denominator-initial);
 p.movements.filter(m=>Math.abs(m.amount)>1e-7).forEach(m=>add(m.label,m.amount/denominator));
 rows.push({label:'With your plan',start:0,end:cursor,amount:cursor,total:true});return rows;
}
export function leverImpacts(base:MarketingTotals,i:FutureInput,today:string,values:Record<Lever,number>){
 return LEVERS.map(l=>{const input={...zeroLevers(i),[l.id]:values[l.id]};const result=projectFuture(base,input,today);return {...l,value:values[l.id],delta:result?.delta??null};}).sort((a,b)=>(b.delta??-Infinity)-(a.delta??-Infinity));
}
export type FutureDraft={reviewedBindings?:import('./reviewed-plan-baseline').ReviewedPlanBaseline['bindings'];version:typeof FUTURE_VERSION;id:string;owner:string;reviewDate:string;objective:string;stopRule:string;createdAt:string;today:string;sourceFrom:string;sourceTo:string;base:MarketingTotals;input:FutureInput;target:number|null;ebitda:number;notes:string;history:{at:string;note:string}[]};
const validDay=(d:unknown):d is string=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
const nonempty=(s:unknown,max:number):s is string=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
/** Persisted reviewed baselines retain all source identities; legacy drafts remain valid separately. */
export function validReviewedBindings(value:unknown,from:string,to:string):boolean {
 try {
 const b=value as NonNullable<FutureDraft['reviewedBindings']>;
 const nonempty=(v:unknown)=>typeof v==='string'&&v.length>0;
 const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 if(!b||!nonempty(b.company)||b.currency!=='GBP'||b.timezone!=='Europe/London'||!nonempty(b.edition)||!validDay(b.anchor)||!Array.isArray(b.months)||b.months.length!==3)return false;
 return b.months[0].from===from&&b.months[2].to===to&&b.months.every((m,i)=>{
 const days=(Date.parse(m.to)-Date.parse(m.from))/86400000+1;
 return validDay(m.from)&&validDay(m.to)&&m.from.endsWith('-01')&&m.to===new Date(Date.UTC(+m.from.slice(0,4),+m.from.slice(5,7),0)).toISOString().slice(0,10)
 &&m.days===days&&m.weight===i+1&&nonempty(m.versionId)&&[m.salesRevision,m.costRevision,m.acquisitionSourceHash,m.ordersHash,m.refundsHash,m.allocationHash,m.economicsSource?.costSourceHash,m.economicsSource?.allocationHash,m.economicsSource?.repeatMarketingHash].every(hash)
 &&typeof m.matureCohort==='boolean'&&(i===0||new Date(Date.parse(b.months[i-1].to)+86400000).toISOString().slice(0,10)===m.from);
 });
 }catch{return false;}
}
export function validFutureDraft(d:FutureDraft){try{const p=projectFuture(d.base,d.input,d.today);return (d.reviewedBindings===undefined||(d.input.repeat===0&&validReviewedBindings(d.reviewedBindings,d.sourceFrom,d.sourceTo)))&&d.version===FUTURE_VERSION&&nonempty(d.id,100)&&nonempty(d.owner,80)&&validDay(d.today)&&validDay(d.reviewDate)&&validDay(d.sourceFrom)&&validDay(d.sourceTo)&&d.sourceFrom<=d.sourceTo&&nonempty(d.objective,400)&&nonempty(d.stopRule,400)&&Number.isFinite(Date.parse(d.createdAt))&&(d.target===null||Number.isFinite(d.target)&&d.target>=0)&&typeof d.notes==='string'&&d.notes.length<=1000&&Array.isArray(d.history)&&d.history.length<=100&&d.history.every(h=>Number.isFinite(Date.parse(h.at))&&nonempty(h.note,1400))&&p!==null&&Number.isFinite(d.ebitda)&&Math.abs(p.ebitda-d.ebitda)<1e-6;}catch{return false;}}
export function readFutureDrafts(storage:Pick<Storage,'getItem'>,key:string):FutureDraft[]{const raw=storage.getItem(key);if(!raw)return [];const list=JSON.parse(raw);if(!Array.isArray(list)||list.length>20||!list.every(validFutureDraft)||new Set(list.map(d=>d.id)).size!==list.length)throw Error('Saved monthly plans are unreadable. They have been preserved; saving is blocked.');return list;}
export function writeFutureDrafts(storage:Pick<Storage,'setItem'>,key:string,list:FutureDraft[]){if(list.length>20||!list.every(validFutureDraft)||new Set(list.map(d=>d.id)).size!==list.length)throw Error('Keep at most 20 valid monthly sample plans.');storage.setItem(key,JSON.stringify(list));}
