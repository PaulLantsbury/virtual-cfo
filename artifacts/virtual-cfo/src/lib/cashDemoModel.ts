/** Fixed, reconciled illustrative cash only. No provider, banking or storage access. */
import { DAILY_SAMPLE, aggregateDays } from './newProfitPreview.ts';
// Identical ex-VAT net product sales to Profit; never inferred from cash receipts.
function salesInRange(from:string,endExclusive:string){
 const rows=DAILY_SAMPLE.filter(row=>row.date>=from&&row.date<endExclusive);
 if(rows.length!==(Date.parse(endExclusive)-Date.parse(from))/86400000)throw Error('Profit sample does not fully cover cash chart sales period');
 return aggregateDays(rows).sales;
}
export type StockPaymentAssumption={date:string;amount:number;commitment:'uncommitted-order'|'supplier-invoice'|'planned-purchase';description:string;timingBasis:'week-ending-assumption';evidence:'Illustrative only; payment date and commitment not verified';actionId?:CashActionId};
export type CashActionId='stock-order'|'supplier-deferral'|'overheads';
export type CashAmounts={receipts:number;stock:number;payroll:number;tax:number;other:number;financing:number};
export type CashPeriod=CashAmounts&{from:string;to:string;label:string;opening:number;closing:number;net:number};
export type CashAction={id:CashActionId;title:string;description:string;assumption:string;firstStep:string;guardrail:string;effects:{date:string;amount:number;reason:string}[];benefitByDate:number;benefitDate:string;scope:string};
const DAY=86400000;
const shift=(date:string,days:number)=>new Date(Date.parse(date+'T00:00:00Z')+days*DAY).toISOString().slice(0,10);
const monthShift=(date:string,months:number)=>{const d=new Date(date+'T00:00:00Z');return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+months,1)).toISOString().slice(0,10);};
const keys=['receipts','stock','payroll','tax','other','financing'] as const;
const empty=():CashAmounts=>({receipts:0,stock:0,payroll:0,tax:0,other:0,financing:0});
export const CASH_DEMO_AS_OF='2026-10-11';
export const CASH_DEMO_CURRENT=18_600_000;
const net=(a:CashAmounts)=>a.receipts+a.financing-a.stock-a.payroll-a.tax-a.other;
const split=(total:number,index:number,count:number)=>Math.floor(total/count)+(index<total-Math.floor(total/count)*count?1:0);
const daily=Array.from({length:(Date.parse(CASH_DEMO_AS_OF)-Date.parse('2023-01-01'))/DAY+1},(_,i)=>{
 const date=shift('2023-01-01',i),d=new Date(date+'T00:00:00Z'),year=d.getUTCFullYear(),m=d.getUTCMonth(),count=new Date(Date.UTC(year,m+1,0)).getUTCDate(),index=d.getUTCDate()-1;
 const receipts=30_000_000+m*100_000,payroll=6_000_000,tax=2_000_000,stock=15_000_000;
 const targetNet=year===2026&&m===9?0:year===2026&&m===8?1_400_000:m%2===0?400_000:-200_000;
 return {date,receipts:split(receipts,index,count),stock:split(stock,index,count),payroll:split(payroll,index,count),tax:split(tax,index,count),other:split(receipts,index,count)-split(stock,index,count)-split(payroll,index,count)-split(tax,index,count)-split(targetNet,index,count),financing:0};
});
const openingBalance=CASH_DEMO_CURRENT-daily.reduce((sum,row)=>sum+net(row),0);
function balanceBefore(date:string){return openingBalance+daily.filter(row=>row.date<date).reduce((sum,row)=>sum+net(row),0);}
function historicalPeriod(from:string,endExclusive:string):CashPeriod{
 const amounts=empty();for(const row of daily.filter(row=>row.date>=from&&row.date<endExclusive))for(const key of keys)amounts[key]+=row[key];
 const opening=balanceBefore(from),change=net(amounts),to=shift(endExclusive,-1);
 return {...amounts,from,to,label:new Date(from+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}),opening,closing:opening+change,net:change};
}
export function buildCashDemo({granularity='weekly',months=3,minimumBuffer=5_000_000,selectedActionIds=[]}:{granularity?:'weekly'|'monthly';months?:3|6|12;minimumBuffer?:number;selectedActionIds?:CashActionId[]}={}){
 if(!['weekly','monthly'].includes(granularity)||![3,6,12].includes(months)||!Number.isSafeInteger(minimumBuffer)||minimumBuffer<0||minimumBuffer>Math.floor(Number.MAX_SAFE_INTEGER/2))throw Error('Invalid cash demo controls');
 const count=granularity==='weekly'?({3:13,6:26,12:52} as const)[months]:months;
 const end=granularity==='weekly'?'2026-10-12':'2026-10-01',advance=(date:string,n:number)=>granularity==='weekly'?shift(date,n*7):monthShift(date,n);
 const from=advance(end,-count),history=Array.from({length:count},(_,i)=>{const a=advance(from,i),b=advance(from,i+1),period=historicalPeriod(a,b);
 const priorYear=historicalPeriod(granularity==='weekly'?shift(a,-364):monthShift(a,-12),granularity==='weekly'?shift(b,-364):monthShift(b,-12));
 const refCount=granularity==='weekly'?12:3,rollingAverageClosing=Array.from({length:refCount},(_,n)=>historicalPeriod(advance(a,n-refCount),advance(a,n-refCount+1)).closing).reduce((sum,value)=>sum+value,0)/refCount;
 const priorFrom=granularity==='weekly'?shift(a,-364):monthShift(a,-12),priorEnd=granularity==='weekly'?shift(b,-364):monthShift(b,-12);
 const sales=salesInRange(a,b),priorYearSales=salesInRange(priorFrom,priorEnd);
 const rollingAverageSales=Array.from({length:refCount},(_,n)=>salesInRange(advance(a,n-refCount),advance(a,n-refCount+1))).reduce((sum,value)=>sum+value,0)/refCount;
 return {...period,sales,priorYearSales,rollingAverageSales,date:period.to,payments:period.stock+period.payroll+period.tax+period.other,priorYearClosing:priorYear.closing,rollingAverageClosing};});
 const historical=historicalPeriod(from,end);
 const bridge=[{id:'opening',label:'Opening cash',amount:historical.opening,subtotal:true},...keys.map(key=>({id:key,label:key==='receipts'?'Customer receipts':key==='stock'?'Stock and suppliers':key==='other'?'Other payments':key[0].toUpperCase()+key.slice(1),amount:(key==='receipts'||key==='financing'?1:-1)*historical[key],subtotal:false})),{id:'closing',label:'Closing cash',amount:historical.closing,subtotal:true}];
 const dates=Array.from({length:13},(_,i)=>shift('2026-10-18',i*7));
 const actions:CashAction[]=[
 {id:'stock-order',title:'Reduce an uncommitted stock order',description:'Illustrative £15,000 lower purchase payment in week 2; stock is not sold or cash released today.',assumption:'The order is uncommitted and genuinely unnecessary for forecast demand. No replacement purchase or lost sales are assumed within these 13 weeks.',firstStep:'Check stock cover and the purchase order before asking the supplier to reduce it.',guardrail:'Protect availability and check whether purchases merely move beyond the forecast.',effects:[{date:dates[1],amount:1_500_000,reason:'Smaller uncommitted purchase'}],benefitByDate:1_500_000,benefitDate:dates[1],scope:'One-off purchase avoided within the 13-week view; not an EBITDA saving.'},
 {id:'supplier-deferral',title:'Agree more time to pay a separate supplier invoice',description:'Illustrative £20,000 payment moves from week 3 to week 9, with no reduction in the bill.',assumption:'The supplier agrees in advance with no fee. This invoice is separate from the stock-order action.',firstStep:'Identify the invoice and ask for written agreement to the revised payment date.',guardrail:'Do not delay payment without agreement; confirm fees, supply continuity and the later repayment.',effects:[{date:dates[2],amount:2_000_000,reason:'Agreed payment deferred'},{date:dates[8],amount:-2_000_000,reason:'Deferred invoice repaid'}],benefitByDate:2_000_000,benefitDate:dates[2],scope:'Temporary cash timing only; fully repaid within the forecast.'},
 {id:'overheads',title:'Stop a non-essential recurring service after notice',description:'Illustrative £1,000 less cash paid each week from week 5.',assumption:'A separate unused service can be cancelled after four weeks, with no termination cost or replacement spending.',firstStep:'Check the contract, notice period and service owner before cancelling.',guardrail:'Protect essential operations; include any exit costs before treating the benefit as achievable.',effects:dates.slice(4).map(date=>({date,amount:100_000,reason:'Cancelled service payment avoided'})),benefitByDate:100_000,benefitDate:dates[4],scope:'£1,000 weekly from week 5; £9,000 inside this forecast. Not a guaranteed annual saving.'}
 ];
 if(selectedActionIds.some(id=>!actions.some(action=>action.id===id)))throw Error('Unknown cash action');
 const selected=new Set(selectedActionIds);
 const receipts=[70,68,72,66,70,78,90,95,100,105,95,90,85];
 let opening=CASH_DEMO_CURRENT,adjusted=CASH_DEMO_CURRENT;
 const forecast=dates.map((date,i)=>{
  const amounts:CashAmounts={receipts:receipts[i]*100_000,stock:([1,3,5].includes(i)?85:40)*100_000,payroll:([0,4,8,12].includes(i)?35:0)*100_000,tax:([2,6,10].includes(i)?35:0)*100_000,other:25*100_000,financing:0};
  const stockPayments:StockPaymentAssumption[]=[];
  const specialAmount=i===1?1_500_000:i===2?2_000_000:0;
  if(specialAmount)stockPayments.push({date,amount:specialAmount,commitment:i===1?'uncommitted-order':'supplier-invoice',description:i===1?'Separate uncommitted stock order considered for reduction':'Separate supplier invoice considered for agreed deferral to week 9',timingBasis:'week-ending-assumption',evidence:'Illustrative only; payment date and commitment not verified',actionId:i===1?'stock-order':'supplier-deferral'});
  stockPayments.push({date,amount:amounts.stock-specialAmount,commitment:'planned-purchase',description:'Other planned supplier and stock payments; deposits and balance dates need purchase-order confirmation',timingBasis:'week-ending-assumption',evidence:'Illustrative only; payment date and commitment not verified'});
  const change=net(amounts),actionEffect=actions.filter(action=>selected.has(action.id)).flatMap(action=>action.effects).filter(effect=>effect.date===date).reduce((sum,effect)=>sum+effect.amount,0);
  const row={...amounts,stockPayments,date,from:shift(date,-6),to:date,label:new Date(date+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}),opening,net:change,closing:opening+change,actionEffect,withActionsOpening:adjusted,withActionsNet:change+actionEffect,withActions:adjusted+change+actionEffect};opening=row.closing;adjusted=row.withActions;return row;
 });
 const lowest=forecast.reduce((a,b)=>b.closing<a.closing?b:a),adjustedLowest=forecast.reduce((a,b)=>b.withActions<a.withActions?b:a);
 const burnMonths=Array.from({length:3},(_,i)=>historicalPeriod(monthShift('2026-10-01',i-3),monthShift('2026-10-01',i-2)));
 const averageMonthlyNet=burnMonths.reduce((sum,row)=>sum+row.net,0)/3,averageMonthlyBurn=averageMonthlyNet<0?-averageMonthlyNet:0;
 return {source:'synthetic-demo' as const,asOf:CASH_DEMO_AS_OF,currentCash:CASH_DEMO_CURRENT,granularity,months,minimumBuffer,history,historical:{...historical,bridge},comparisonNote:'Last year uses matching completed periods. Rolling compares with the mean of the previous 12 weekly or 3 monthly closing cash balances, not a cash-flow total or annualised balance. Sales use the same exact-date net product sales as Profit, excluding VAT and shipping, after product discounts and refund events. Sales and cash receipts are different measures.',forecast,actions,selectedActionIds:[...selected],lowestForecast:{date:lowest.date,balance:lowest.closing},headroom:lowest.closing-minimumBuffer,shortfall:Math.max(0,minimumBuffer-lowest.closing),withActionsLowest:{date:adjustedLowest.date,balance:adjustedLowest.withActions},withActionsShortfall:Math.max(0,minimumBuffer-adjustedLowest.withActions),forecastActionBenefit:forecast.reduce((sum,row)=>sum+row.actionEffect,0),runway:{from:burnMonths[0].from,to:burnMonths[2].to,months:burnMonths,averageMonthlyNet,averageMonthlyBurn,monthsRemaining:averageMonthlyBurn>0?CASH_DEMO_CURRENT/averageMonthlyBurn:null,status:averageMonthlyBurn>0?'Burning cash':'Not currently burning cash'},limitations:['Illustrative sample only; not connected bank balances or a live forecast.','Weekly receipts and payments are assumptions, not committed transactions.','Cash and EBITDA differ: stock purchases, payment dates, tax and financing affect cash separately.','The three action examples concern separate payments. Their effects are counted once and supplier repayment is included.']};
}
