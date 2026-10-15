/** Fixed synthetic design data only. No provider, store, API, storage or forecast access. */
export type Granularity = 'weekly' | 'monthly';
export type Horizon = 'last-week' | 'last-month' | 3 | 6 | 12;
export type BaseAmounts = { gross: number; discounts: number; reversals: number; sales: number; shipping: number; cogs: number; variable: number; advertising: number; overheads: number; da: number; orders: number };
export type ProfitTotals = BaseAmounts & { grossProfit: number; contribution: number; cashOverheads: number; ebitda: number; operatingProfit: number };
export type DailyProfit = BaseAmounts & { date: string };
export type ProfitPeriod = { from: string; to: string; label: string; values: ProfitTotals; priorYear: ProfitTotals };
export type PreviewModel = { granularity: Granularity; months: Horizon; periods: ProfitPeriod[]; from: string; to: string; current: ProfitTotals; priorYear: ProfitTotals; previous: ProfitTotals; previousFrom: string; previousTo: string; benchmark: ProfitTotals; benchmarkFrom: string; benchmarkTo: string; benchmarkCount: number; selectedCount: number };
export type ProfitKey = keyof ProfitTotals;
export type WaterfallStep = { id: string; label: string; start: number; end: number; amount: number; subtotal: boolean; checkpoint?: boolean; effect?: number };
const DAY = 86_400_000;
const baseKeys: (keyof BaseAmounts)[] = ['gross','discounts','reversals','sales','shipping','cogs','variable','advertising','overheads','da','orders'];
const iso = (d: Date) => d.toISOString().slice(0,10);
export const shiftDay = (date: string, days: number) => iso(new Date(Date.parse(date+'T00:00:00Z') + days*DAY));
const shiftMonth = (date: string, months: number) => { const d=new Date(date+'T00:00:00Z');return iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+months,1))); };
const derive = (v: BaseAmounts): ProfitTotals => {const grossProfit=v.sales-v.cogs,contribution=grossProfit+v.shipping-v.variable-v.advertising,cashOverheads=v.overheads-v.da,ebitda=contribution-cashOverheads;return {...v,grossProfit,contribution,cashOverheads,ebitda,operatingProfit:ebitda-v.da};};
export function aggregateDays(days: readonly DailyProfit[]): ProfitTotals {
 const t:BaseAmounts={gross:0,discounts:0,reversals:0,sales:0,shipping:0,cogs:0,variable:0,advertising:0,overheads:0,da:0,orders:0};
 for(const day of days)for(const key of baseKeys)t[key]+=day[key];
 return derive(t);
}
const start='2023-10-01',last='2026-10-11';
export const DAILY_SAMPLE: readonly DailyProfit[]=Object.freeze(Array.from({length:(Date.parse(last)-Date.parse(start))/DAY+1},(_,index)=>{
 const date=shiftDay(start,index),d=new Date(date+'T00:00:00Z');
 const seasonal=1+.12*Math.sin(d.getUTCMonth()/12*Math.PI*2)+.045*Math.cos(d.getUTCDay());
 const gross=Math.round((7600+index*1.9)*seasonal*100),late=date>='2026-07-01';
 const discounts=Math.round(gross*(late?.14:.09)),reversals=Math.round(gross*(.026+(d.getUTCDate()%4)*.002));
 const sales=gross-discounts-reversals,shipping=Math.round(gross*.022),cogs=Math.round((gross-discounts)*.37),variable=Math.round(sales*(late?.156:.14));
 const advertising=Math.round(sales*(late?.235:.185))+(index%91===60?1_450_000:0),overheads=145_000+(d.getUTCDay()===1?5000:0),da=12_000; // Fixed synthetic D&A, never actual cost evidence.
 return Object.freeze({date,gross,discounts,reversals,sales,shipping,cogs,variable,advertising,overheads,da,orders:Math.max(1,Math.round(gross/8200))});
}));
function range(from:string,endExclusive:string):ProfitTotals{
 const rows=DAILY_SAMPLE.filter(d=>d.date>=from&&d.date<endExclusive);
 if(rows.length!==(Date.parse(endExclusive)-Date.parse(from))/DAY)throw Error('Synthetic preview range not fully covered');
 return aggregateDays(rows);
}
export function buildProfitPreview({granularity,months}:{granularity:Granularity;months:Horizon}):PreviewModel{
 if(!['weekly','monthly'].includes(granularity)||!['last-week','last-month',3,6,12].includes(months))throw Error('Invalid preview controls');
 const effectiveGranularity:Granularity=months==='last-week'?'weekly':months==='last-month'?'monthly':granularity;
 const weekly=effectiveGranularity==='weekly',count=typeof months==='number'?(weekly?({3:13,6:26,12:52} as const)[months]:months):1;
 const end=weekly?'2026-10-12':'2026-10-01',advance=(date:string,n:number)=>weekly?shiftDay(date,n*7):shiftMonth(date,n);
 const from=advance(end,-count),priorStart=weekly?shiftDay(from,-364):shiftMonth(from,-12),priorEnd=weekly?shiftDay(end,-364):shiftMonth(end,-12);
 const benchmarkCount=weekly?12:3,benchmarkFrom=advance(from,-benchmarkCount),previousFrom=advance(from,-count);
 const periods=Array.from({length:count},(_,index)=>{const a=advance(from,index),b=advance(a,1),pa=weekly?shiftDay(a,-364):shiftMonth(a,-12),pb=weekly?shiftDay(b,-364):shiftMonth(b,-12);return {from:a,to:shiftDay(b,-1),label:weekly?new Date(a+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}):new Date(a+'T00:00:00Z').toLocaleDateString('en-GB',{month:'short',year:'2-digit',timeZone:'UTC'}),values:range(a,b),priorYear:range(pa,pb)};});
 return {granularity:effectiveGranularity,months,periods,from,to:shiftDay(end,-1),current:range(from,end),priorYear:range(priorStart,priorEnd),previous:range(previousFrom,from),previousFrom,previousTo:shiftDay(from,-1),benchmark:range(benchmarkFrom,from),benchmarkFrom,benchmarkTo:shiftDay(from,-1),benchmarkCount,selectedCount:count};
}
export function amount(values:ProfitTotals,key:ProfitKey,perOrder:boolean):number|null{return perOrder?(Number.isFinite(values.orders)&&values.orders>0?values[key]/values.orders:null):values[key];}
export function benchmarkAmount(model:PreviewModel,key:ProfitKey,perOrder:boolean):number|null{return perOrder?amount(model.benchmark,key,true):model.benchmark[key]/model.benchmarkCount;}
export function selectedAverageAmount(model:PreviewModel,key:ProfitKey,perOrder:boolean):number|null{return perOrder?amount(model.current,key,true):model.current[key]/model.selectedCount;}
export function chartRows(model:PreviewModel,perOrder:boolean){return model.periods.map(period=>({...period,sales:amount(period.values,'sales',perOrder),profit:amount(period.values,'ebitda',perOrder),priorYearProfit:amount(period.priorYear,'ebitda',perOrder)}));}
export function compositionSteps(values:ProfitTotals,perOrder:boolean):WaterfallStep[]{
 if(perOrder&&(!Number.isFinite(values.orders)||values.orders<=0))return [];
 const scale=perOrder?1/values.orders:1,steps:WaterfallStep[]=[];let cursor=0;
 const add=(id:string,label:string,value:number,subtotal=false)=>{const target=value*scale;const start=subtotal?0:cursor,end=subtotal?target:cursor+target;steps.push({id,label,start,end,amount:target,subtotal});cursor=end;};
 add('sales','Sales',values.sales,true);add('cogs','Product costs',-values.cogs);add('grossProfit','Gross profit',values.grossProfit,true);add('shipping','Net shipping',values.shipping);add('variable','Variable costs',-values.variable);add('ads','Advertising',-values.advertising);add('contribution','Contribution',values.contribution,true);add('cashOverheads','Overheads excluding D&A',-values.cashOverheads);add('ebitda','EBITDA',values.ebitda,true);return steps;
}
export function changeSteps(model:PreviewModel,perOrder:boolean):WaterfallStep[]{
 if(perOrder&&(!Number.isFinite(model.current.orders)||model.current.orders<=0||!Number.isFinite(model.previous.orders)||model.previous.orders<=0))return [];
 const current=model.current,previous=model.previous,c=perOrder?1/current.orders:1,p=perOrder?1/previous.orders:1;
 const baseline=previous.ebitda*p,steps:WaterfallStep[]=[{id:'previous',label:'Previous EBITDA',start:0,end:baseline,amount:baseline,subtotal:true}];
 let cursor=baseline;
 const movement=(id:string,label:string,value:number)=>{const start=cursor;cursor+=value;steps.push({id,label,start,end:cursor,amount:value,subtotal:false});};
 movement('gross','Gross product sales',current.gross*c-previous.gross*p);
 movement('discounts','Product discounts',previous.discounts*p-current.discounts*c);
 movement('reversals','Refunds / sales reversals',previous.reversals*p-current.reversals*c);
 const netSalesEffect=current.sales*c-previous.sales*p;
 // Grouped summary of the three sales movements already applied. This column
 // spans their combined effect above the PRIOR EBITDA baseline, not a new cost
 // or a reset to sales. The renderer must show amount, not the running end.
 steps.push({id:'netSales',label:'Net sales change (subtotal)',start:baseline,end:cursor,amount:netSalesEffect,subtotal:true,checkpoint:true,effect:netSalesEffect});
 movement('shipping','Net shipping',current.shipping*c-previous.shipping*p);
 movement('cogs','Product costs',previous.cogs*p-current.cogs*c);
 movement('variable','Variable costs',previous.variable*p-current.variable*c);
 movement('ads','Advertising',previous.advertising*p-current.advertising*c);
 movement('cashOverheads','Overheads excluding D&A',previous.cashOverheads*p-current.cashOverheads*c);
 steps.push({id:'current',label:'Selected EBITDA',start:0,end:current.ebitda*c,amount:current.ebitda*c,subtotal:true});
 return steps;
}
export type PreviewScenario={id:string;title:string;category:string;low:number;high:number;midpoint:number;input:string;assumption:string;next:string;confidence:string;effort:string;timing:string};
export function scenarioRanges(model:PreviewModel):PreviewScenario[]{const t=model.current;return [
 {id:'carrier',title:'Review the cost to serve',category:'Operations',low:t.orders*50,high:t.orders*100,midpoint:t.orders*75,input:`£0.50–£1 lower variable cost × ${t.orders} original orders`,assumption:'Constant order volume and service level; the eligible carrier/fulfilment/payment-fee cost pool is unverified. This broad scenario includes payment processing, so the payment scenario cannot be added again. A modelled expense reduction improves EBITDA under these assumptions; it is not cash released.',next:'Review parcel mix and contracted rates; obtain a like-for-like quote before estimating a saving.',confidence:'Arithmetic only · rates unverified',effort:'Medium',timing:'2–4 weeks to assess'},
 {id:'discount',title:'Test a shallower discount',category:'Pricing',low:t.gross*.005,high:t.gross*.01,midpoint:t.gross*.0075,input:'0.5–1 percentage point less discount × selected gross product sales',assumption:'Constant gross demand, refunds and product mix. Lower discounts may reduce sales; no price-response evidence is supplied.',next:'Define a controlled promotion trial and compare contribution, not sales alone.',confidence:'Arithmetic only · demand unknown',effort:'Medium',timing:'2–3 weeks to test'},
 {id:'payment',title:'Check payment processing rates',category:'Operations',low:t.gross*.001,high:t.gross*.0025,midpoint:t.gross*.00175,input:'0.10–0.25 percentage point fee reduction × gross product sales proxy',assumption:'Gross product sales are only a modelled charge-volume proxy; actual processor volume, VAT, shipping, minimum fees and eligible rate base are unknown. This is a component of the broader cost-to-serve scenario and is excluded from the combined range.',next:'Reconcile processor charges to billed volume before negotiating rates.',confidence:'Arithmetic only · fee base unknown',effort:'Low',timing:'1–2 weeks to review'},
 ];}
export function opportunityPareto(model:PreviewModel,perOrder:boolean){const scenarios=scenarioRanges(model).filter(item=>Number.isFinite(item.midpoint)&&item.midpoint>0&&item.low>=0&&item.high>=item.low).sort((a,b)=>b.midpoint-a.midpoint);const denominator=scenarios.reduce((s,item)=>s+item.midpoint,0);let running=0;return scenarios.map(item=>{running+=item.midpoint;return {...item,displayLow:perOrder?(Number.isFinite(model.current.orders)&&model.current.orders>0?item.low/model.current.orders:null):item.low,displayHigh:perOrder?(Number.isFinite(model.current.orders)&&model.current.orders>0?item.high/model.current.orders:null):item.high,displayImpact:perOrder?(Number.isFinite(model.current.orders)&&model.current.orders>0?item.midpoint/model.current.orders:null):item.midpoint,cumulativePct:denominator?running/denominator*100:0,individualMidpointDenominator:denominator};});}

export function sankeyFlows(values:ProfitTotals,perOrder:boolean){
 const source=[{id:'sales',label:'Net product sales',amount:values.sales},{id:'shipping',label:'Net shipping',amount:values.shipping}];
 const uses=[{id:'cogs',label:'Product costs',amount:values.cogs},{id:'variable',label:'Variable costs',amount:values.variable},{id:'advertising',label:'Advertising',amount:values.advertising},{id:'cashOverheads',label:'Overheads excluding D&A',amount:values.cashOverheads},{id:'ebitda',label:'EBITDA',amount:values.ebitda}];
 if([...source,...uses].some(flow=>!Number.isFinite(flow.amount)||flow.amount<0))return {state:'unavailable' as const,reason:'Signed or loss period: use the waterfall.'};
 const revenue=values.sales+values.shipping;
 if(uses.reduce((total,item)=>total+item.amount,0)!==revenue)return {state:'unavailable' as const,reason:'Composition does not reconcile.'};
 if(revenue===0||perOrder&&(!Number.isFinite(values.orders)||values.orders<=0))return {state:'unavailable' as const,reason:'A positive flow and original-order denominator are required.'};
 const scale=perOrder?1/values.orders:1;return {state:'ready' as const,sources:source.map(item=>({...item,amount:item.amount*scale})),uses:uses.map(item=>({...item,amount:item.amount*scale})),total:revenue*scale};
}

export const CASH_TIMING_ASSUMPTIONS:readonly string[]=Object.freeze([
 'Month 1: implementation dates and customer collection, refund and payment-processor settlement lags are unknown; no same-month cash benefit is assumed.',
 'Month 2: supplier/carrier invoices, contractual payment terms, stock purchases and any transition costs determine when an expense change affects cash.',
 'Month 3: sustained demand, realised rates and collection/payment evidence are needed before extrapolating; working capital, VAT/tax and financing can move cash independently of EBITDA.',
 'These are qualitative timing considerations, not a bank balance, cash forecast or promise that all EBITDA improvement becomes cash.'
]);
/** An arithmetic sensitivity under explicit fixed-demand assumptions, not a
 * forecast. Payment is already inside cost-to-serve and never added twice. */
export function combinedScenario(model:PreviewModel,perOrder=false){
 const scenarios=scenarioRanges(model),carrier=scenarios.find(s=>s.id==='carrier')!,discount=scenarios.find(s=>s.id==='discount')!;
 const low=carrier.low+discount.low,high=carrier.high+discount.high,midpoint=(low+high)/2;
 const denominator=Number.isFinite(model.current.orders)&&model.current.orders>0?model.current.orders:null;
 const assumptions=[
  'Includes cost-to-serve and discount sensitivities only. Payment processing is contained in cost-to-serve and excluded as a separate addition.',
  'Assumes unchanged gross demand, original order volume, product mix, refund amounts, service levels and all other expense amounts. These assumptions are unverified; lower discounts may reduce demand.',
  'The eligible cost pool and realised rates require validation. This is a combined EBITDA sensitivity with overlap removed, not an achievable-benefit estimate, causal forecast or cash saving.'
 ];
 return {includedIds:['carrier','discount'] as const,excludedIds:['payment'] as const,low,high,midpoint,displayLow:perOrder?(denominator?low/denominator:null):low,displayHigh:perOrder?(denominator?high/denominator:null):high,ebitdaLow:model.current.ebitda+low,ebitdaHigh:model.current.ebitda+high,assumptions,cashTimingAssumptions:CASH_TIMING_ASSUMPTIONS};
}

/** Shared sample comparison: rolling amounts are a reference average scaled to
 * the selected span, never actual transactions or a prediction for that span. */
export type ComparisonBasis = 'last-year' | 'rolling';
export function comparisonTotals(model:PreviewModel,basis:ComparisonBasis):ProfitTotals {
 if(basis==='last-year')return {...model.priorYear};
 if(basis!=='rolling')throw Error('Invalid sample comparison');
 const factor=model.selectedCount/model.benchmarkCount;
 return Object.fromEntries(Object.entries(model.benchmark).map(([key,value])=>[key,value*factor])) as ProfitTotals;
}
export function comparisonChartRows(model:PreviewModel,perOrder:boolean,basis:ComparisonBasis){
 const reference=comparisonTotals(model,basis);
 return chartRows(model,perOrder).map(row=>({...row,comparisonProfit:basis==='last-year'?row.priorYearProfit:perOrder?amount(reference,'ebitda',true):reference.ebitda/model.selectedCount}));
}
export function comparisonChangeSteps(model:PreviewModel,perOrder:boolean,basis:ComparisonBasis):WaterfallStep[]{
 const reference=comparisonTotals(model,basis);
 return changeSteps({...model,previous:reference},perOrder).map(step=>step.id==='previous'?{...step,label:basis==='last-year'?'Prior-year EBITDA':'Reference EBITDA'}:step);
}
